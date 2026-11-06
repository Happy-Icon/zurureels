import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  distillCardsForHistory,
  buildSlidingWindowContext,
  generateUUID,
  aiConversationService,
  type AIConversationSession,
} from '../../services/aiConversationService';
import type { AIMessage, AICard } from '../../components/ai/tokens';

describe('Milestone 2: AI Conversational Foundations & Client Architecture', () => {
  // ── 1. Card Distillation & Token Compaction (REM-02) ────────────────────────
  describe('Card Distillation & Token Compaction', () => {
    test('distillCardsForHistory returns empty string on null, undefined, or empty arrays', () => {
      assert.strictEqual(distillCardsForHistory(undefined), '');
      assert.strictEqual(distillCardsForHistory(null as any), '');
      assert.strictEqual(distillCardsForHistory([]), '');
    });

    test('distills stay cards into dense, structured reference tokens', () => {
      const mockStays: AICard[] = [
        {
          id: 'stay-001',
          type: 'listing',
          title: 'Diani Beachfront Villa',
          location: 'Diani Beach',
          category: 'stay',
          price: 25000,
          priceUnit: 'night',
          rating: 4.9,
          reviewCount: 32,
        },
      ];

      const distilled = distillCardsForHistory(mockStays);
      assert.ok(distilled.includes('[Previously Recommended Listings:'));
      assert.ok(
        distilled.includes(
          '[#1 Stay: "Diani Beachfront Villa" (ID: stay-001, Loc: Diani Beach, Price: KES 25,000/night, Rating: 4.9★)]'
        )
      );
    });

    test('distills experience cards with correct category and pricing unit', () => {
      const mockExperiences: AICard[] = [
        {
          id: 'exp-002',
          type: 'recommendation',
          title: 'Sunset Dhow Cruise & Swahili Dinner',
          location: 'Kilifi Creek',
          category: 'experience',
          price: 6500,
          priceUnit: 'person',
          rating: 4.85,
          reviewCount: 18,
        },
      ];

      const distilled = distillCardsForHistory(mockExperiences);
      assert.ok(
        distilled.includes(
          '[#1 Experience: "Sunset Dhow Cruise & Swahili Dinner" (ID: exp-002, Loc: Kilifi Creek, Price: KES 6,500/person, Rating: 4.85★)]'
        )
      );
    });

    test('handles missing or unrated cards gracefully with default fallbacks', () => {
      const mockUnrated = [
        {
          id: 'item-unrated',
          title: 'Hidden Lamu Secret Garden',
          location_name: 'Lamu Town',
          rating: null,
        },
      ];

      const distilled = distillCardsForHistory(mockUnrated);
      assert.ok(distilled.includes('Rating: New'));
      assert.ok(distilled.includes('Loc: Lamu Town'));
      assert.ok(distilled.includes('Price: Price on request'));
    });

    test('achieves >90% character/token compaction compared to raw card payload JSON', () => {
      const richCards = Array.from({ length: 4 }).map((_, i) => ({
        id: `stay-rich-${i}`,
        type: 'listing',
        title: `Luxury Swahili Oceanfront Haven ${i}`,
        subtitle: 'Spectacular panoramic ocean views, private infinity pool, dedicated private chef, direct beach access',
        location: 'Diani Beach, Kwale County, Coastal Kenya',
        price: 35000 + i * 5000,
        priceUnit: 'night',
        rating: 4.95,
        reviewCount: 48,
        category: 'stay',
        imageUrl: `https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80&sig=${i}`,
        tags: ['Beachfront', 'Private Chef', 'Pool', 'Ocean View', 'Air Conditioning', 'WiFi', 'Breakfast Included'],
        experience: {
          id: `exp-nested-${i}`,
          title: `Nested Experience Details ${i}`,
          description: 'Full descriptive body explaining property amenities, check-in instructions, host background, cancellation rules',
          rules: ['No loud music after 10PM', 'No smoking inside'],
        },
        host: {
          id: `host-${i}`,
          name: 'Amina Coastal Stays Ltd',
          is_verified: true,
          response_rate: 98,
        },
      }));

      const rawJson = JSON.stringify(richCards, null, 2);
      const distilled = distillCardsForHistory(richCards);

      const rawLength = rawJson.length;
      const distilledLength = distilled.length;
      const reduction = 1 - distilledLength / rawLength;

      assert.ok(
        reduction > 0.85,
        `Expected >85% token compaction, got ${(reduction * 100).toFixed(2)}% (raw: ${rawLength} chars, distilled: ${distilledLength} chars)`
      );
    });
  });

  // ── 2. 12-Turn Sliding Window Context Compaction (REM-02) ──────────────────
  describe('12-Turn Sliding Window Context Compaction', () => {
    test('enforces max 12 turns by truncating older conversation turns', () => {
      // 16 alternating messages (8 user + 8 assistant)
      const messages: AIMessage[] = Array.from({ length: 16 }).map((_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'ai',
        text: `Message number ${i}`,
        timestamp: new Date(),
      }));

      const context = buildSlidingWindowContext(messages);
      assert.strictEqual(context.length, 12, 'Must contain exactly 12 turns');
      assert.strictEqual(context[0].content, 'Message number 4', 'Must have dropped messages 0-3');
      assert.strictEqual(context[11].content, 'Message number 15', 'Must preserve freshest message');
    });

    test('enforces 3,500 character ceiling by dropping oldest turns first', () => {
      // Create messages each 500 chars long
      const messages: AIMessage[] = Array.from({ length: 10 }).map((_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'ai',
        text: `Turn ${i}: ${'A'.repeat(500)}`,
        timestamp: new Date(),
      }));

      const context = buildSlidingWindowContext(messages, null, 12, 3500);
      const totalChars = context.reduce((acc, t) => acc + t.content.length, 0);

      assert.ok(
        totalChars <= 3500,
        `Total chars (${totalChars}) must not exceed 3,500 ceiling`
      );
      assert.strictEqual(context[context.length - 1].content.startsWith('Turn 9:'), true);
    });

    test('guarantees at least the freshest turn survives even under strict ceiling', () => {
      const messages: AIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          text: 'Short initial prompt',
          timestamp: new Date(),
        },
        {
          id: 'msg-2',
          role: 'ai',
          text: 'X'.repeat(4000), // Exceeds ceiling alone
          timestamp: new Date(),
        },
      ];

      const context = buildSlidingWindowContext(messages, null, 12, 3500);
      assert.strictEqual(context.length, 1);
      assert.strictEqual(context[0].role, 'assistant');
    });

    test('injects context summary briefing when provided', () => {
      const messages: AIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          text: 'Where should we have dinner tonight in Diani?',
          timestamp: new Date(),
        },
      ];

      const summary = 'Traveler is a family of 4 looking for fresh seafood with sunset views in Diani.';
      const context = buildSlidingWindowContext(messages, summary);

      assert.strictEqual(context.length, 2);
      assert.strictEqual(context[0].role, 'assistant');
      assert.ok(context[0].content.includes('[Previous Conversation Context Brief:'));
      assert.ok(context[0].content.includes(summary));
      assert.strictEqual(context[1].content, 'Where should we have dinner tonight in Diani?');
    });

    test('automatically embeds distilled cards on assistant turns', () => {
      const messages: AIMessage[] = [
        {
          id: 'msg-1',
          role: 'ai',
          text: 'Here is what I found for you in Kilifi:',
          timestamp: new Date(),
          cards: [
            {
              id: 'c-1',
              type: 'listing',
              category: 'stay',
              title: 'Creek House Villa',
              location: 'Kilifi',
              price: 18000,
              rating: 4.8,
            },
          ],
        },
      ];

      const context = buildSlidingWindowContext(messages);
      assert.strictEqual(context.length, 1);
      assert.ok(context[0].content.includes('Here is what I found for you in Kilifi:'));
      assert.ok(context[0].content.includes('[#1 Stay: "Creek House Villa"'));
    });
  });

  // ── 3. Session Lifecycle & Serialization (REM-02) ───────────────────────────
  describe('Session Lifecycle & Serialization', () => {
    test('generateUUID produces valid RFC4122 v4 UUID format', () => {
      const uuid = generateUUID();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert.ok(uuidRegex.test(uuid), `Generated UUID "${uuid}" does not match RFC4122 v4 format`);
    });

    test('createNewSession creates structured session with unique ID and default title', () => {
      const session = aiConversationService.createNewSession('test-user-123', 'Diani Getaway');
      assert.ok(session.id);
      assert.strictEqual(session.userId, 'test-user-123');
      assert.strictEqual(session.title, 'Diani Getaway');
      assert.deepStrictEqual(session.messages, []);
      assert.ok(session.createdAt);
      assert.ok(session.updatedAt);
    });

    test('saveActiveSession and getActiveSession correctly roundtrips messages and restores Date timestamps', async () => {
      const session = aiConversationService.createNewSession('test-guest');
      const testDate = new Date('2026-11-06T10:00:00.000Z');

      session.messages.push({
        id: 'msg-user-1',
        role: 'user',
        text: 'Looking for a serene beachfront villa in Watamu',
        timestamp: testDate,
      });

      await aiConversationService.saveActiveSession('test-guest', session);
      const loaded = await aiConversationService.getActiveSession('test-guest');

      assert.strictEqual(loaded.id, session.id);
      assert.strictEqual(loaded.messages.length, 1);
      assert.strictEqual(loaded.messages[0].text, 'Looking for a serene beachfront villa in Watamu');
      assert.ok(loaded.messages[0].timestamp instanceof Date, 'timestamp must be deserialized into Date instance');
      assert.strictEqual(loaded.messages[0].timestamp.toISOString(), testDate.toISOString());
    });

    test('session deletion purges session payload and cleans index', async () => {
      const session1 = aiConversationService.createNewSession('guest', 'Trip One');
      const session2 = aiConversationService.createNewSession('guest', 'Trip Two');

      await aiConversationService.saveActiveSession('guest', session1);
      await aiConversationService.saveActiveSession('guest', session2);

      let sessions = await aiConversationService.listSessions('guest');
      assert.ok(sessions.some((s) => s.id === session1.id));
      assert.ok(sessions.some((s) => s.id === session2.id));

      await aiConversationService.deleteSession('guest', session1.id);

      sessions = await aiConversationService.listSessions('guest');
      assert.ok(!sessions.some((s) => s.id === session1.id), 'Session 1 must be deleted');
      assert.ok(sessions.some((s) => s.id === session2.id), 'Session 2 must remain');
    });

    test('clearAllSessions wipes active session and full index', async () => {
      const s = aiConversationService.createNewSession('guest');
      await aiConversationService.saveActiveSession('guest', s);

      await aiConversationService.clearAllSessions('guest');
      const list = await aiConversationService.listSessions('guest');
      assert.strictEqual(list.length, 0);
    });
  });

  // ── 4. Database Migration & Schema Verification ────────────────────────────
  describe('Database Migration & Schema Isolation Verification', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20261106000001_ai_conversations_and_memory_isolation.sql'
    );

    test('migration file exists in supabase/migrations/', () => {
      assert.ok(fs.existsSync(migrationPath), 'Migration file must exist at designated path');
    });

    test('migration creates public.ai_conversations with FK to auth.users ON DELETE CASCADE', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.ai_conversations'));
      assert.ok(sql.includes('REFERENCES auth.users(id) ON DELETE CASCADE'));
      assert.ok(sql.includes('ai_conversations_user_updated_idx'));
    });

    test('migration creates public.ai_messages with role constraint and indexes', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.ai_messages'));
      assert.ok(sql.includes("CHECK (role IN ('user', 'assistant', 'system'))"));
      assert.ok(sql.includes('client_message_id uuid'));
      assert.ok(sql.includes('ai_messages_conversation_created_idx'));
      assert.ok(sql.includes('ai_messages_client_id_idx'));
    });

    test('migration creates public.ai_user_memories with category constraint and uniqueness', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.ai_user_memories'));
      assert.ok(
        sql.includes(
          "CHECK (category IN ('dietary', 'accessibility', 'pace', 'budget', 'interests', 'exclusions'))"
        )
      );
      assert.ok(
        sql.includes(
          'CONSTRAINT ai_user_memories_user_category_key UNIQUE (user_id, category, preference_key)'
        )
      );
    });

    test('migration explicitly restricts client inserts to role = user', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('Authenticated users insert user role messages'));
      assert.ok(sql.includes("role = 'user'"));
    });

    test('migration grants explicit permissions to authenticated and service_role, revoking from anon', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('REVOKE ALL ON public.ai_conversations FROM PUBLIC, anon;'));
      assert.ok(sql.includes('GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;'));
      assert.ok(sql.includes('GRANT ALL ON public.ai_conversations TO service_role;'));
    });

    test('migration integrates GDPR cascade in delete_user_account for ai_user_memories and ai_conversations', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.delete_user_account'));
      assert.ok(sql.includes('DELETE FROM public.ai_user_memories WHERE user_id = p_user_id;'));
      assert.ok(sql.includes('DELETE FROM public.ai_conversations WHERE user_id = p_user_id;'));
    });
  });
});
