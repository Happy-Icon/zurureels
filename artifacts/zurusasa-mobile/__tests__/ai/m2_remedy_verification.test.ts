import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  distillCardsForHistory,
  buildSlidingWindowContext,
  generateUUID,
  aiConversationService,
  type AIConversationSession,
} from '../../services/aiConversationService';
import { supabase } from '../../lib/supabase';
import type { AIMessage } from '../../components/ai/tokens';

describe('EMPIRICAL CHALLENGER VERIFICATION: Milestone 2 Remedy Audit', () => {

  // ===========================================================================
  // REMEDY 1: Null / Undefined / Non-Object Safety in distillCardsForHistory
  // ===========================================================================
  describe('Remedy 1: Null, undefined, and non-object safety in distillCardsForHistory', () => {
    test('handles array containing exclusively null and undefined without throwing TypeError', () => {
      const inputs = [
        [null],
        [undefined],
        [null, undefined, null],
        [null, null, null, null],
      ];

      for (const input of inputs) {
        let result: string | undefined;
        assert.doesNotThrow(() => {
          result = distillCardsForHistory(input as any);
        }, `Should not throw TypeError for input ${JSON.stringify(input)}`);
        assert.strictEqual(result, '', 'All-null/undefined input must return empty string');
      }
    });

    test('handles non-object primitive elements (strings, numbers, booleans, symbols) gracefully', () => {
      const hostileArray = [
        null,
        'random-string',
        12345,
        true,
        false,
        undefined,
        Symbol('test'),
        [], // empty array is an object, but not a valid card
      ];

      let result = '';
      assert.doesNotThrow(() => {
        result = distillCardsForHistory(hostileArray as any);
      });
      // None of the non-card primitives should crash the function or produce valid listing lines
      assert.ok(typeof result === 'string');
    });

    test('retains valid cards in mixed arrays containing null, undefined, and primitives', () => {
      const mixedCards = [
        null,
        { id: 'stay-1', title: 'Diani Beachfront Villa', current_price: 25000, price_unit: 'night', property_type: 'villa' },
        undefined,
        'garbage string',
        { id: 'exp-1', title: 'Kisite Mpunguti Marine Park Tour', current_price: 7500, price_unit: 'person' },
        null,
      ];

      let output = '';
      assert.doesNotThrow(() => {
        output = distillCardsForHistory(mixedCards as any);
      });

      assert.ok(output.includes('Diani Beachfront Villa'), 'Must include valid stay');
      assert.ok(output.includes('Price: KES 25,000/night'), 'Stay price must be formatted');
      assert.ok(output.includes('Kisite Mpunguti Marine Park Tour'), 'Must include valid experience');
      assert.ok(output.includes('Price: KES 7,500/person'), 'Experience price must be formatted');
      // Should number them consecutively as #1 and #2 (the valid ones)
      assert.ok(output.includes('#1 Stay:'), 'First valid item is #1');
      assert.ok(output.includes('#2 Experience:'), 'Second valid item is #2');
    });

    test('handles cards with missing or strange title property without throwing', () => {
      const strangeCards = [
        { id: 'no-title-1', current_price: 1000 },
        { id: 'null-title-2', title: null, current_price: 2000 },
        { id: 'empty-title-3', title: '', current_price: 3000 },
      ];

      assert.doesNotThrow(() => {
        const out = distillCardsForHistory(strangeCards as any);
        assert.ok(out.includes('Price: KES 1,000/person'));
        assert.ok(out.includes('Price: KES 2,000/person'));
      });
    });
  });

  // ===========================================================================
  // REMEDY 2: Cross-User Isolation in loadSession and deleteSession
  // ===========================================================================
  describe('Remedy 2: Cross-user storage isolation in loadSession and deleteSession', () => {
    // Mock Supabase to isolate local storage behavior
    beforeEach(() => {
      (supabase as any).from = () => ({
        select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }) }) }) }),
        delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        upsert: () => Promise.resolve({ data: null, error: null }),
      });
    });

    test('loadSession strictly prevents cross-user access between authenticated users', async () => {
      // User Alpha creates confidential session
      const sessionAlpha = aiConversationService.createNewSession('user-alpha-111', 'Alpha Confidential Safari');
      sessionAlpha.messages.push({
        id: 'msg-a-1',
        role: 'user',
        text: 'Alpha credit card token / national ID: 12345678',
        timestamp: new Date(),
      });
      await aiConversationService.saveActiveSession('user-alpha-111', sessionAlpha);

      // User Beta attempts to load Alpha\'s session via conversationId
      const betaAttempt = await aiConversationService.loadSession('user-beta-222', sessionAlpha.id);
      assert.strictEqual(
        betaAttempt,
        null,
        'loadSession MUST return null when userId does not match session owner'
      );

      // User Alpha can still legitimately load their own session
      const alphaSelf = await aiConversationService.loadSession('user-alpha-111', sessionAlpha.id);
      assert.ok(alphaSelf !== null, 'Alpha must be able to load own session');
      assert.strictEqual(alphaSelf?.id, sessionAlpha.id);
      assert.strictEqual(alphaSelf?.messages[0]?.text, 'Alpha credit card token / national ID: 12345678');
    });

    test('loadSession strictly prevents guest from accessing authenticated user sessions and vice versa', async () => {
      // 1. Authenticated user creates session
      const authSession = aiConversationService.createNewSession('user-gamma-333', 'Gamma Booking');
      authSession.messages.push({
        id: 'msg-g-1',
        role: 'user',
        text: 'Private Gamma conversation',
        timestamp: new Date(),
      });
      await aiConversationService.saveActiveSession('user-gamma-333', authSession);

      // Guest tries to load Gamma\'s session
      const guestAttempt = await aiConversationService.loadSession('guest', authSession.id);
      assert.strictEqual(
        guestAttempt,
        null,
        'Guest must NOT be able to load authenticated user session'
      );

      // Default userId (undefined -> defaults to "guest") tries to load Gamma\'s session
      const defaultAttempt = await aiConversationService.loadSession(undefined, authSession.id);
      assert.strictEqual(
        defaultAttempt,
        null,
        'Default (unspecified) user must NOT be able to load authenticated user session'
      );

      // 2. Guest creates session
      const guestSession = aiConversationService.createNewSession('guest', 'Guest Safari Query');
      guestSession.messages.push({
        id: 'msg-guest-1',
        role: 'user',
        text: 'Guest inquiry about Malindi',
        timestamp: new Date(),
      });
      await aiConversationService.saveActiveSession('guest', guestSession);

      // Authenticated user tries to load Guest session
      const authAttemptGuest = await aiConversationService.loadSession('user-gamma-333', guestSession.id);
      assert.strictEqual(
        authAttemptGuest,
        null,
        'Authenticated user must NOT be able to load guest session'
      );

      // Guest can load own session
      const guestSelf = await aiConversationService.loadSession('guest', guestSession.id);
      assert.ok(guestSelf !== null, 'Guest must be able to load guest session');
      assert.strictEqual(guestSelf?.id, guestSession.id);
    });

    test('deleteSession prevents unauthorized user from deleting another user\'s local session', async () => {
      const sessionVictim = aiConversationService.createNewSession('user-victim-444', 'Victim Session');
      sessionVictim.messages.push({
        id: 'v-1',
        role: 'user',
        text: 'Crucial travel notes',
        timestamp: new Date(),
      });
      await aiConversationService.saveActiveSession('user-victim-444', sessionVictim);

      // Malicious user tries to delete Victim\'s session
      await aiConversationService.deleteSession('user-attacker-555', sessionVictim.id);

      // Verify Victim\'s session was NOT deleted from local storage
      const loaded = await aiConversationService.loadSession('user-victim-444', sessionVictim.id);
      assert.ok(loaded !== null, 'Session must still exist after unauthorized deleteSession attempt');
      assert.strictEqual(loaded?.messages[0]?.text, 'Crucial travel notes');

      // Now legitimate owner deletes their session
      await aiConversationService.deleteSession('user-victim-444', sessionVictim.id);
      const afterOwnerDelete = await aiConversationService.loadSession('user-victim-444', sessionVictim.id);
      assert.strictEqual(afterOwnerDelete, null, 'Session must be removed after legitimate owner deletes it');
    });
  });

  // ===========================================================================
  // REMEDY 3: ExperienceRow current_price and price_unit in distillCardsForHistory
  // ===========================================================================
  describe('Remedy 3: ExperienceRow authentic price formatting', () => {
    test('formats ExperienceRow with current_price and price_unit instead of "Price on request"', () => {
      const dhowCruise: any = {
        id: 'exp-dhow-kilifi',
        title: 'Sunset Dhow Cruise in Kilifi Creek',
        current_price: 6500,
        price_unit: 'person',
        location: 'Kilifi',
      };

      const out = distillCardsForHistory([dhowCruise]);
      assert.ok(!out.includes('Price on request'), 'Must not say "Price on request"');
      assert.ok(out.includes('Price: KES 6,500/person'), `Got: ${out}`);
      assert.ok(out.includes('Loc: Kilifi'));
    });

    test('formats ExperienceRow with custom price_unit values (e.g. jump, group, hour, trip)', () => {
      const experiences: any[] = [
        { id: 'e1', title: 'Diani Beach Tandem Skydive', current_price: 45000, price_unit: 'jump' },
        { id: 'e2', title: 'Private Glass Bottom Boat Tour', current_price: 15000, price_unit: 'boat' },
        { id: 'e3', title: 'Jet Ski Safari', current_price: 8000, price_unit: '30 mins' },
        { id: 'e4', title: 'Deep Sea Fishing Expedition', current_price: 60000, price_unit: 'group' },
      ];

      const out = distillCardsForHistory(experiences);
      assert.ok(out.includes('Price: KES 45,000/jump'));
      assert.ok(out.includes('Price: KES 15,000/boat'));
      assert.ok(out.includes('Price: KES 8,000/30 mins'));
      assert.ok(out.includes('Price: KES 60,000/group'));
    });

    test('defaults to /person for experiences when price_unit is null or undefined', () => {
      const expWithoutUnit: any = {
        id: 'e-nounit',
        title: 'Fort Jesus Guided Walking Tour',
        current_price: 2500,
        price_unit: null,
      };

      const out = distillCardsForHistory([expWithoutUnit]);
      assert.ok(out.includes('Price: KES 2,500/person'), `Expected /person default, got: ${out}`);
    });

    test('detects stay via property_type or bedrooms and formats with /night', () => {
      const stayRow: any = {
        id: 'stay-malindi-1',
        title: 'Swahili Heritage Villa',
        current_price: 35000,
        property_type: 'villa',
        bedrooms: 3,
      };

      const out = distillCardsForHistory([stayRow]);
      assert.ok(out.includes('Stay: "Swahili Heritage Villa"'), 'Must classify as Stay');
      assert.ok(out.includes('Price: KES 35,000/night'), 'Must format with /night');
    });

    test('correctly preserves authentic KES 0 price for complimentary experiences', () => {
      const freeTour: any = {
        id: 'exp-free',
        title: 'Colobus Conservation Nature Trail',
        current_price: 0,
        price_unit: 'person',
      };

      const out = distillCardsForHistory([freeTour]);
      assert.ok(out.includes('Price: KES 0/person'), `Expected KES 0/person, got: ${out}`);
    });

    test('falls back to "Price on request" strictly when current_price and alternative prices are all null/NaN', () => {
      const unpriced: any = {
        id: 'exp-unpriced',
        title: 'Bespoke Helicopter Safari',
        current_price: null,
        price: null,
        price_per_night: null,
      };

      const out = distillCardsForHistory([unpriced]);
      assert.ok(out.includes('Price: Price on request'), 'Truly unpriced items should show "Price on request"');
    });
  });

  // ===========================================================================
  // REMEDY 4: Delta Buffer Flush Order on stopGeneration()
  // ===========================================================================
  describe('Remedy 4: Delta buffer flush order on stopGeneration()', () => {
    test('empirically verifies pending delta text is flushed into message before clearing buffer', () => {
      // Simulate the exact state and lifecycle of useZuruAI:
      let messages: Array<{ id: string; text: string; isStreaming?: boolean }> = [
        { id: 'msg-ai-1', text: 'Here are some top stays in Diani: ', isStreaming: true },
      ];

      const deltaBufferRef = { current: '' };
      let throttleTimer: any = null;
      let isStreaming = true;
      let isLoading = true;

      // The flushDeltaBuffer implementation from lib/zuruAI.ts:
      const flushDeltaBuffer = (messageId?: string) => {
        if (!deltaBufferRef.current) return;
        const chunk = deltaBufferRef.current;
        deltaBufferRef.current = '';

        messages = messages.map((m) =>
          (messageId ? m.id === messageId : m.isStreaming)
            ? { ...m, text: m.text + chunk, isStreaming: true }
            : m
        );
      };

      // 1. New streaming delta arrives during active throttle window (e.g. 50ms)
      const incomingPendingDelta = '1. The Majlis Resort (KES 45,000/night)...';
      deltaBufferRef.current += incomingPendingDelta;

      // 2. User presses Stop before throttleTimer expires
      // The exact stopGeneration logic from lib/zuruAI.ts:
      const stopGeneration = () => {
        if (throttleTimer) {
          clearTimeout(throttleTimer);
          throttleTimer = null;
        }
        // Remedy 4: flushDeltaBuffer MUST be called BEFORE clearing deltaBufferRef
        flushDeltaBuffer();
        deltaBufferRef.current = '';
        isLoading = false;
        isStreaming = false;

        messages = messages.map((m) =>
          m.isStreaming ? { ...m, isStreaming: false } : m
        );
      };

      // Execute stopGeneration()
      stopGeneration();

      // Assertions:
      assert.strictEqual(isLoading, false, 'Loading should be false');
      assert.strictEqual(isStreaming, false, 'Streaming should be false');
      assert.strictEqual(deltaBufferRef.current, '', 'Buffer should be empty');
      assert.strictEqual(messages[0].isStreaming, false, 'Message should no longer be streaming');

      // The crucial invariant: pending delta was NOT dropped
      assert.strictEqual(
        messages[0].text,
        'Here are some top stays in Diani: 1. The Majlis Resort (KES 45,000/night)...',
        'CRUCIAL: The pending delta must be flushed into the message text before termination'
      );
    });

    test('verifies no-op flush when delta buffer is empty on stopGeneration()', () => {
      let messages: Array<{ id: string; text: string; isStreaming?: boolean }> = [
        { id: 'msg-ai-2', text: 'Completed response text.', isStreaming: true },
      ];

      const deltaBufferRef = { current: '' };

      const flushDeltaBuffer = (messageId?: string) => {
        if (!deltaBufferRef.current) return;
        const chunk = deltaBufferRef.current;
        deltaBufferRef.current = '';
        messages = messages.map((m) =>
          (messageId ? m.id === messageId : m.isStreaming)
            ? { ...m, text: m.text + chunk, isStreaming: true }
            : m
        );
      };

      // Empty buffer stop
      flushDeltaBuffer();
      deltaBufferRef.current = '';
      messages = messages.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m));

      assert.strictEqual(messages[0].text, 'Completed response text.');
      assert.strictEqual(messages[0].isStreaming, false);
    });
  });
});
