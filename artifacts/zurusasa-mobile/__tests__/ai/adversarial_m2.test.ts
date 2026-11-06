import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  distillCardsForHistory,
  buildSlidingWindowContext,
  generateUUID,
  aiConversationService,
} from '../../services/aiConversationService';
import type { AIMessage, AICard } from '../../components/ai/tokens';

describe('ADVERSARIAL STRESS SUITE: Milestone 2 Reviewer Validation', () => {
  // ── 1. Edge Case & Malformed Input Handling in Card Distillation ───────────
  describe('Card Distillation Adversarial Stress', () => {
    test('handles cards with extreme or sparse properties without crashing', () => {
      const hostileCards: any[] = [
        {}, // completely empty
        { title: null, price: undefined },
        { title: '', location: '', rating: 0, price: 0 },
        { title: 'Extreme Price', price: 999999999999, price_per_night: null },
        { title: 'Negative Price', price: -500 },
        { title: 'Unicode & Quotes "Escape" \n\r\t <script>alert(1)</script>', rating: 5.0 },
      ];

      // Should not throw on empty/sparse object cards
      const result = distillCardsForHistory(hostileCards);
      assert.ok(typeof result === 'string');
      assert.ok(result.includes('Extreme Price'));
      assert.ok(result.includes('Price on request') || result.includes('KES 0'));
    });

    test('filters null or non-object elements without throwing TypeError (remedied)', () => {
      const cardsWithNull = [
        { id: '1', title: 'Valid Stay', price: 10000 },
        null,
      ];

      // Robustly handles null/non-object elements by filtering them out
      assert.doesNotThrow(() => {
        const distilled = distillCardsForHistory(cardsWithNull as any);
        assert.ok(distilled.includes('Valid Stay'));
      });
    });

    test('compacts massive card arrays without exceeding sane context bounds', () => {
      const manyCards = Array.from({ length: 50 }).map((_, i) => ({
        id: `card-${i}`,
        title: `Beachfront Villa Suite ${i}`,
        location: 'Diani Beach',
        price: 15000 + i * 100,
        rating: 4.8,
        category: 'stay',
      }));

      const distilled = distillCardsForHistory(manyCards);
      const lines = distilled.trim().split('\n');
      // 1 header line + 50 card lines (with closing bracket on line 51) = 51 lines
      assert.strictEqual(lines.length, 51);
      assert.ok(distilled.length < 6000, `Distilled 50 cards was ${distilled.length} chars, expected < 6000`);
    });
  });

  // ── 2. Sliding Window Buffer Boundaries & Character Ceiling ───────────────
  describe('Sliding Window Stress & Ceiling Invariants', () => {
    test('strictly enforces 3500-char ceiling under adversarial message sizes', () => {
      // 20 messages with varying sizes from 100 to 2000 chars
      const messages: AIMessage[] = Array.from({ length: 20 }).map((_, i) => ({
        id: `m-${i}`,
        role: i % 2 === 0 ? 'user' : 'ai',
        text: `Message ${i}: ${'Z'.repeat(100 + i * 50)}`,
        timestamp: new Date(),
      }));

      const context = buildSlidingWindowContext(messages, 'Summary briefing note', 12, 3500);

      // Context must include summary briefing if provided
      assert.ok(context[0].content.includes('Summary briefing note'));

      // Calculate total characters excluding the summary turn if comparing window turns
      const turns = context.slice(1);
      const totalTurnChars = turns.reduce((acc, t) => acc + t.content.length, 0);
      assert.ok(totalTurnChars <= 3500, `Total turns chars ${totalTurnChars} exceeded 3500`);

      // Verify chronological ordering of remaining turns
      const lastTurn = turns[turns.length - 1];
      assert.ok(lastTurn.content.startsWith('Message 19:'), 'Freshest turn must be preserved at end');
    });

    test('handles single message that alone exceeds the 3500 character ceiling', () => {
      const monsterMessage: AIMessage = {
        id: 'monster-1',
        role: 'user',
        text: 'A'.repeat(5000),
        timestamp: new Date(),
      };

      const context = buildSlidingWindowContext([monsterMessage], null, 12, 3500);
      assert.strictEqual(context.length, 1, 'Must retain at least 1 turn');
      assert.strictEqual(context[0].content.length, 5000, 'Preserves freshest message intact');
    });

    test('ignores blank, whitespace-only, and empty messages in context window', () => {
      const messages: AIMessage[] = [
        { id: '1', role: 'user', text: '', timestamp: new Date() },
        { id: '2', role: 'ai', text: '   \n  \t  ', timestamp: new Date() },
        { id: '3', role: 'user', text: 'Valid question', timestamp: new Date() },
        { id: '4', role: 'ai', text: '', timestamp: new Date() },
      ];

      const context = buildSlidingWindowContext(messages);
      assert.strictEqual(context.length, 1);
      assert.strictEqual(context[0].content, 'Valid question');
    });
  });

  // ── 3. High-Entropy UUID Generation Fuzzing ───────────────────────────────
  describe('UUID Generator RFC4122 v4 Invariance', () => {
    test('generates 1,000 unique UUIDs with zero collisions and 100% RFC4122 v4 conformance', () => {
      const seen = new Set<string>();
      const rfc4122v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      for (let i = 0; i < 1000; i++) {
        const id = generateUUID();
        assert.ok(rfc4122v4.test(id), `UUID "${id}" violated RFC4122 v4 spec`);
        assert.ok(!seen.has(id), `Collision detected on UUID "${id}"`);
        seen.add(id);
      }
      assert.strictEqual(seen.size, 1000);
    });
  });

  // ── 4. Session Persistence & Edge Cases ───────────────────────────────────
  describe('Session Lifecycle Adversarial Scenarios', () => {
    test('deleting a non-existent session ID does not throw or corrupt index', async () => {
      await assert.doesNotReject(async () => {
        await aiConversationService.deleteSession('guest', 'non-existent-uuid-999');
      });
    });

    test('clearing sessions when empty does not throw', async () => {
      await assert.doesNotReject(async () => {
        await aiConversationService.clearActiveSession('random-user-id');
        await aiConversationService.clearAllSessions('random-user-id');
      });
    });
  });
});
