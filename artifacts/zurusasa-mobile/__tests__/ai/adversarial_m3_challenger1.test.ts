import { test, describe, before } from 'node:test';
import assert from 'node:assert';

import {
  extractRating,
  extractReviewsCount,
  determineTimeSlotAndStart,
  getDestinationKeyword,
  getAdjacentDestinationKeyword,
  zuruPlanService,
  parseConstraintsFromConversation,
} from '../../services/zuruPlanService';

import {
  DESTINATIONS,
  type TripPlan,
  type TripPreferences,
  type ItineraryItem,
  type DestinationConfig,
} from '../../types/zuruPlan';

// Edge function module placeholder
let edgeModule: any;

describe('ADVERSARIAL CHALLENGER SUITE: Milestone 3 Verification (m3_challenger_1)', () => {
  before(async () => {
    // Provide Deno global mock for Edge function testing under Node
    if (typeof (globalThis as any).Deno === 'undefined') {
      (globalThis as any).Deno = {
        env: {
          get: (k: string) => process.env[k] || '',
          set: (k: string, v: string) => {
            process.env[k] = v;
          },
        },
        serve: () => {},
      };
    }
    edgeModule = await import('../../supabase/functions/zuru-ai/index.ts' as any);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 1. RATINGS & REVIEWS REALISM EMPIRICAL CHALLENGES (REM-09)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Challenge Vector 1: Ratings & Reviews Grounding Realism (REM-09)', () => {
    test('extractRating returns null for null, undefined, empty, 0, negative, and non-numeric inputs', () => {
      const unratedInputs = [
        null,
        undefined,
        {},
        { rating: null },
        { rating: undefined },
        { rating: 0 },
        { rating: 0.0 },
        { rating: -1 },
        { rating: -4.5 },
        { rating: NaN },
        { rating: '4.8' }, // String rating must not be blindly trusted without numeric type
        { rating: '5.0' },
        { rating: true },
        { rating: false },
        { rating: [] },
        { rating: {} },
      ];

      for (const input of unratedInputs) {
        const rating = extractRating(input);
        assert.strictEqual(
          rating,
          null,
          `Expected null rating for input: ${JSON.stringify(input)}, got: ${rating}`
        );
        // Explicitly confirm NO fabricated 4.8 or 4.9 stars
        assert.notStrictEqual(rating, 4.8, 'Must NEVER fabricate 4.8 stars');
        assert.notStrictEqual(rating, 4.9, 'Must NEVER fabricate 4.9 stars');
      }
    });

    test('extractRating handles corrupted or malformed metadata objects without throwing or fabricating', () => {
      const corruptedMetadataInputs = [
        { metadata: null },
        { metadata: undefined },
        { metadata: 'string_corrupted_json' },
        { metadata: 12345 },
        { metadata: [] },
        { metadata: {} },
        { metadata: { rating: null } },
        { metadata: { rating: 0 } },
        { metadata: { rating: -0.5 } },
        { metadata: { rating: 'not-a-number' } },
        { metadata: { rating: '4.9' } },
        { metadata: { average_rating: null } },
        { metadata: { average_rating: 0 } },
        { metadata: { average_rating: -1 } },
        { metadata: { average_rating: 'five' } },
      ];

      for (const input of corruptedMetadataInputs) {
        assert.doesNotThrow(() => {
          const rating = extractRating(input);
          assert.strictEqual(
            rating,
            null,
            `Corrupted metadata input ${JSON.stringify(input)} must yield null, got ${rating}`
          );
        });
      }
    });

    test('extractRating rounds authentic positive numeric ratings to 1 decimal place', () => {
      const authenticRatings = [
        { input: { rating: 4.86 }, expected: 4.9 },
        { input: { rating: 4.84 }, expected: 4.8 },
        { input: { rating: 5.0 }, expected: 5.0 },
        { input: { rating: 3.75 }, expected: 3.8 },
        { input: { metadata: { rating: 4.61 } }, expected: 4.6 },
        { input: { metadata: { average_rating: 4.38 } }, expected: 4.4 },
      ];

      for (const { input, expected } of authenticRatings) {
        assert.strictEqual(
          extractRating(input),
          expected,
          `Failed rounding check for ${JSON.stringify(input)}`
        );
      }
    });

    test('extractReviewsCount returns 0 for empty or unreviewed listings and NEVER fabricates 18 or 42', () => {
      const unreviewedInputs = [
        null,
        undefined,
        {},
        { reviews_count: null },
        { reviews_count: undefined },
        { reviews_count: 0 },
        { review_count: null },
        { review_count: 0 },
        { metadata: null },
        { metadata: {} },
        { metadata: { reviews_count: null } },
        { metadata: { review_count: 0 } },
        { metadata: 'invalid' },
        { reviews_count: '42' }, // String must not be parsed as authentic count
        { review_count: '18' },
      ];

      for (const input of unreviewedInputs) {
        const count = extractReviewsCount(input);
        assert.strictEqual(
          count,
          0,
          `Expected 0 reviews for input ${JSON.stringify(input)}, got ${count}`
        );
        // Explicitly verify NO hardcoded 18 or 42 review counts
        assert.notStrictEqual(count, 18, 'Must NEVER default to 18 review count');
        assert.notStrictEqual(count, 42, 'Must NEVER default to 42 review count');
      }
    });

    test('extractReviewsCount extracts authentic counts when legitimately provided in db columns or metadata', () => {
      assert.strictEqual(extractReviewsCount({ reviews_count: 18 }), 18); // Authentic 18
      assert.strictEqual(extractReviewsCount({ review_count: 42 }), 42);   // Authentic 42
      assert.strictEqual(extractReviewsCount({ reviews_count: 105 }), 105);
      assert.strictEqual(extractReviewsCount({ metadata: { reviews_count: 37 } }), 37);
      assert.strictEqual(extractReviewsCount({ metadata: { review_count: 8 } }), 8);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. DYNAMIC TIME SLOTS & ELIMINATION OF HARDCODED 02:30 PM (REM-09)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Challenge Vector 2: Dynamic Time Slot Scheduling (REM-09)', () => {
    test('strictly assigns morning 09:00 AM to marine and water activities', () => {
      const marineCategories = [
        'watersports',
        'boat_safari',
        'marine',
        'snorkeling',
        'deep_sea_dive',
        'dolphin_safari',
        'ocean_kayak',
      ];

      for (const cat of marineCategories) {
        const res = determineTimeSlotAndStart(cat, 1); // Even at slotIndex 1!
        assert.strictEqual(res.timeSlot, 'morning', `Category ${cat} should map to morning`);
        assert.strictEqual(res.startTime, '09:00 AM', `Category ${cat} should map to 09:00 AM`);
      }
    });

    test('strictly assigns evening 06:30 PM to dining, food, drinks, and sunset excursions', () => {
      const eveningCategories = [
        'sunset_dhow_cruise',
        'seafood_dining',
        'swahili_food',
        'beach_drinks',
        'night_events',
        'coastal_dinner',
      ];

      for (const cat of eveningCategories) {
        const res = determineTimeSlotAndStart(cat, 0); // Even at slotIndex 0!
        assert.strictEqual(res.timeSlot, 'evening', `Category ${cat} should map to evening`);
        assert.strictEqual(res.startTime, '06:30 PM', `Category ${cat} should map to 06:30 PM`);
      }
    });

    test('assigns morning 11:00 AM check-in / orientation to stays and villas', () => {
      const stayCategories = [
        'villa_stay',
        'beach_hotel',
        'safari_cottage',
        'oceanfront_resort',
      ];

      for (const cat of stayCategories) {
        const res = determineTimeSlotAndStart(cat, 0);
        assert.strictEqual(res.timeSlot, 'morning');
        assert.strictEqual(res.startTime, '11:00 AM');
      }
    });

    test('verifies fallback slot indices map to 09:00 AM, 02:00 PM, and 06:30 PM', () => {
      const fallback0 = determineTimeSlotAndStart('general_tour', 0);
      assert.strictEqual(fallback0.timeSlot, 'morning');
      assert.strictEqual(fallback0.startTime, '09:00 AM');

      const fallback1 = determineTimeSlotAndStart('general_tour', 1);
      assert.strictEqual(fallback1.timeSlot, 'afternoon');
      assert.strictEqual(fallback1.startTime, '02:00 PM');

      const fallback2 = determineTimeSlotAndStart('general_tour', 2);
      assert.strictEqual(fallback2.timeSlot, 'evening');
      assert.strictEqual(fallback2.startTime, '06:30 PM');
    });

    test('verifies preferredSlot override always takes strict precedence', () => {
      const morningOverride = determineTimeSlotAndStart('sunset_dhow', 2, 'morning');
      assert.strictEqual(morningOverride.timeSlot, 'morning');
      assert.strictEqual(morningOverride.startTime, '09:00 AM');

      const afternoonOverride = determineTimeSlotAndStart('marine_safari', 0, 'afternoon');
      assert.strictEqual(afternoonOverride.timeSlot, 'afternoon');
      assert.strictEqual(afternoonOverride.startTime, '02:00 PM');

      const eveningOverride = determineTimeSlotAndStart('villa_stay', 0, 'evening');
      assert.strictEqual(eveningOverride.timeSlot, 'evening');
      assert.strictEqual(eveningOverride.startTime, '06:30 PM');
    });

    test('empirically verifies 02:30 PM is NEVER generated under any category or slot permutation', () => {
      const testCategories = [
        undefined,
        '',
        'water',
        'boat',
        'stay',
        'dining',
        'food',
        'sunset',
        'events',
        'cultural',
        'hiking',
        'adventure',
        'wildlife',
        'shopping',
      ];

      for (const cat of testCategories) {
        for (let idx = 0; idx <= 6; idx++) {
          const res = determineTimeSlotAndStart(cat, idx);
          assert.notStrictEqual(
            res.startTime,
            '02:30 PM',
            `02:30 PM hardcoded time detected for category "${cat}" at index ${idx}`
          );
          assert.notStrictEqual(
            res.timeLabel,
            '02:30 PM',
            `02:30 PM timeLabel detected for category "${cat}" at index ${idx}`
          );
          assert.ok(
            ['09:00 AM', '11:00 AM', '02:00 PM', '06:30 PM'].includes(res.startTime),
            `Unexpected startTime: ${res.startTime}`
          );
        }
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 3. SINGLE-DAY REGENERATION & RADIUS EXPANSION (REM-08, REM-10)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Challenge Vector 3: Single-Day Regeneration & Radius Expansion (REM-08)', () => {
    test('strictly preserves multiple userModified: true items across regeneration and increments revision', async () => {
      const baseTrip: TripPlan = {
        id: 'trip-adversarial-1',
        title: '3-Day Coastal Exploration',
        destination: 'Watamu',
        destinationId: 'watamu',
        coverImage: 'https://example.com/cover.jpg',
        durationDays: 3,
        guestCount: 2,
        budgetTier: 'comfort',
        revision: 4,
        status: 'planned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        budgetBreakdown: {
          accommodationTotal: 30000,
          activitiesTotal: 12000,
          diningEstimate: 6000,
          totalEstimatedKes: 48000,
        },
        days: [
          {
            dayNumber: 1,
            dateLabel: 'Day 1',
            theme: 'Arrival & Check-in',
            revision: 4,
            items: [
              {
                id: 'd1-stay',
                timeSlot: 'morning',
                slot: 'morning',
                startTime: '11:00 AM',
                title: 'Ocean Beach Villa',
                description: 'Check into villa',
                type: 'stay',
                experienceId: 'stay-uuid-1',
                rating: 4.8,
                reviewsCount: 15,
                estimatedPriceKes: 15000,
                isBookable: true,
              },
              {
                id: 'd1-marine',
                timeSlot: 'afternoon',
                slot: 'afternoon',
                startTime: '02:00 PM',
                title: 'Watamu Coral Gardens Snorkel',
                description: 'Snorkeling tour',
                type: 'activity',
                experienceId: 'exp-d1-marine',
                rating: 4.9,
                reviewsCount: 24,
                estimatedPriceKes: 4000,
                isBookable: true,
              },
            ],
          },
          {
            dayNumber: 2,
            dateLabel: 'Day 2',
            theme: 'Coastal Adventure',
            revision: 4,
            items: [
              // User manually curated item 1: morning private yoga session
              {
                id: 'd2-user-custom-yoga',
                timeSlot: 'morning',
                slot: 'morning',
                startTime: '07:30 AM', // Custom time!
                title: 'Private Sunrise Yoga on Sandbar',
                description: 'User curated morning wellness session',
                type: 'activity',
                experienceId: 'exp-user-yoga-999',
                rating: 5.0,
                reviewsCount: 3,
                estimatedPriceKes: 3500,
                isBookable: true,
                userModified: true, // MUST BE 100% PRESERVED
              },
              // Replaceable item 2: generic afternoon tour
              {
                id: 'd2-replaceable-act',
                timeSlot: 'afternoon',
                slot: 'afternoon',
                startTime: '02:00 PM',
                title: 'Standard Town Walk',
                description: 'To be replaced',
                type: 'activity',
                experienceId: 'exp-replace-me-123',
                rating: 4.1,
                reviewsCount: 5,
                estimatedPriceKes: 2000,
                isBookable: true,
                userModified: false,
              },
              // User manually curated item 3: evening chef dinner
              {
                id: 'd2-user-custom-dinner',
                timeSlot: 'evening',
                slot: 'evening',
                startTime: '08:00 PM', // Custom time!
                title: 'Swahili Five-Course Seafood Tasting',
                description: 'Curated dining experience',
                type: 'dining',
                experienceId: 'exp-user-dinner-777',
                rating: null,
                reviewsCount: 0,
                estimatedPriceKes: 6500,
                isBookable: true,
                userModified: true, // MUST BE 100% PRESERVED
              },
            ],
          },
          {
            dayNumber: 3,
            dateLabel: 'Day 3',
            theme: 'Departure Day',
            revision: 4,
            items: [
              {
                id: 'd3-ruins',
                timeSlot: 'morning',
                slot: 'morning',
                startTime: '09:00 AM',
                title: 'Gede Ruins Forest Tour',
                description: 'Heritage walk',
                type: 'activity',
                experienceId: 'exp-d3-gede-ruins',
                rating: 4.7,
                reviewsCount: 19,
                estimatedPriceKes: 2500,
                isBookable: true,
              },
            ],
          },
        ],
      };

      // Mock candidate inventory containing both excluded neighbor items and fresh candidates
      const mockCandidates = [
        {
          id: 'exp-d1-marine', // ON DAY 1! Excluded
          title: 'Watamu Coral Gardens Snorkel',
          category: 'water',
          current_price: 4000,
        },
        {
          id: 'exp-d3-gede-ruins', // ON DAY 3! Excluded
          title: 'Gede Ruins Forest Tour',
          category: 'cultural',
          current_price: 2500,
        },
        {
          id: 'exp-fresh-marafa-canyon', // FRESH CANDIDATE
          title: 'Marafa Hell’s Kitchen Canyon Sunset',
          category: 'adventure',
          current_price: 4500,
          location: 'Watamu & Malindi',
        },
      ];

      const excludedIds = ['stay-uuid-1', 'exp-d1-marine', 'exp-d3-gede-ruins'];

      const updatedTrip = await zuruPlanService.buildGroundedLocalDayRegeneration(
        baseTrip,
        2,
        excludedIds,
        mockCandidates as any
      );

      // Invariant 1: Revision MUST increment from 4 to 5
      assert.strictEqual(updatedTrip.revision, 5, 'Trip revision must increment on day regeneration');

      const regeneratedDay = updatedTrip.days.find((d) => d.dayNumber === 2)!;
      assert.ok(regeneratedDay, 'Regenerated Day 2 must exist');
      assert.strictEqual(regeneratedDay.revision, 5, 'Day revision must match nextRevision');

      // Invariant 2: User-modified items MUST be 100% preserved
      const preservedYoga = regeneratedDay.items.find((i) => i.id === 'd2-user-custom-yoga');
      assert.ok(preservedYoga, 'Yoga item must be preserved');
      assert.strictEqual(preservedYoga!.userModified, true);
      assert.strictEqual(preservedYoga!.startTime, '07:30 AM');
      assert.strictEqual(preservedYoga!.experienceId, 'exp-user-yoga-999');

      const preservedDinner = regeneratedDay.items.find((i) => i.id === 'd2-user-custom-dinner');
      assert.ok(preservedDinner, 'Dinner item must be preserved');
      assert.strictEqual(preservedDinner!.userModified, true);
      assert.strictEqual(preservedDinner!.startTime, '08:00 PM');
      assert.strictEqual(preservedDinner!.experienceId, 'exp-user-dinner-777');

      // Invariant 3: Excluded experience IDs from other days MUST NOT be duplicated
      const scheduledExpIds = regeneratedDay.items.map((i) => i.experienceId);
      assert.strictEqual(
        scheduledExpIds.includes('exp-d1-marine'),
        false,
        'Day 1 marine activity MUST NOT be duplicated on Day 2'
      );
      assert.strictEqual(
        scheduledExpIds.includes('exp-d3-gede-ruins'),
        false,
        'Day 3 Gede ruins activity MUST NOT be duplicated on Day 2'
      );

      // Invariant 4: Replaceable item was replaced with fresh candidate
      assert.ok(
        scheduledExpIds.includes('exp-fresh-marafa-canyon'),
        'Fresh candidate must be chosen to replace non-userModified item'
      );

      // Invariant 5: Budget breakdown recalculation
      assert.ok(
        updatedTrip.budgetBreakdown.activitiesTotal > 0,
        'Activities total must be recalculated'
      );
    });

    test('Edge Function fetchPlanCandidates triggers 2-tier radius expansion when local inventory is sparse', async () => {
      // Mock Supabase client where Watamu has 0 stays and only 1 activity,
      // but adjacent town Malindi has full inventory
      const mockDatabaseExperiences = [
        {
          id: 'exp-watamu-single-activity',
          title: 'Watamu Turtle Watch',
          location: 'Watamu',
          category: 'marine',
          current_price: 2500,
          availability_status: 'available',
          max_guests: 6,
          amenities: ['guide'],
          metadata: { rating: 4.8, review_count: 14 },
        },
        // Malindi inventory (Adjacent town)
        {
          id: 'stay-malindi-villa-1',
          title: 'Malindi Oceanfront Villa',
          location: 'Malindi Coast',
          category: 'stay',
          current_price: 18000,
          availability_status: 'available',
          max_guests: 4,
          amenities: ['pool', 'wifi'],
          metadata: { rating: 4.9, review_count: 22 },
        },
        {
          id: 'exp-malindi-ruins-1',
          title: 'Vasco da Gama Pillar Walk',
          location: 'Malindi',
          category: 'cultural',
          current_price: 1500,
          availability_status: 'available',
          max_guests: 10,
          amenities: ['guide'],
          metadata: { rating: 4.7, review_count: 30 },
        },
      ];

      const mockSupabase = {
        from: (table: string) => {
          if (table === 'experiences') {
            return {
              select: () => ({
                in: () => ({
                  limit: async () => ({ data: mockDatabaseExperiences, error: null }),
                }),
              }),
            };
          }
          if (table === 'reels') {
            return {
              select: () => ({
                in: () => ({
                  in: async () => ({ data: [], error: null }),
                }),
              }),
            };
          }
          if (table === 'reviews') {
            return {
              select: () => ({
                in: () => ({
                  eq: async () => ({ data: [], error: null }),
                }),
              }),
            };
          }
          return { select: () => ({}) };
        },
      };

      const planCandidates = await edgeModule.fetchPlanCandidates(mockSupabase, 'watamu', 2);

      // Invariant: radiusExpanded must be TRUE because Watamu lacked a stay
      assert.strictEqual(
        planCandidates.radiusExpanded,
        true,
        'Radius expansion must trigger when local town has sparse inventory'
      );
      assert.strictEqual(
        planCandidates.adjacentRegionUsed,
        'malindi',
        'Adjacent region used should identify contiguous town Malindi'
      );
      // Malindi stay must be included
      assert.ok(
        planCandidates.stays.some((s: any) => s.id === 'stay-malindi-villa-1'),
        'Adjacent Malindi villa must be included in candidate stays'
      );
    });

    test('verifies destination adjacency graph contains geographic neighbors', () => {
      assert.strictEqual(getAdjacentDestinationKeyword('watamu'), 'malindi');
      assert.strictEqual(getAdjacentDestinationKeyword('malindi'), 'watamu');
      assert.strictEqual(getAdjacentDestinationKeyword('diani'), 'tiwi');
      assert.strictEqual(getAdjacentDestinationKeyword('kilifi'), 'mombasa');
      assert.strictEqual(getAdjacentDestinationKeyword('naivasha'), 'nakuru');
      assert.strictEqual(getAdjacentDestinationKeyword('unknown_desert'), null);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 4. ACTIVE DESTINATION FIDELITY & DEGRADED MODE (REM-10)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Challenge Vector 4: Active Destination Fidelity & Degraded Mode (REM-10)', () => {
    const testDestinations = [
      { id: 'lamu', name: 'Lamu Island' },
      { id: 'watamu', name: 'Watamu' },
      { id: 'naivasha', name: 'Lake Naivasha' },
      { id: 'mara', name: 'Maasai Mara' },
    ];

    test('Edge Function buildDeterministicItinerary preserves destination fidelity across all tested regions', () => {
      for (const dest of testDestinations) {
        const mockCandidates = {
          stays: [
            {
              id: `stay-${dest.id}-1`,
              title: `${dest.name} Eco Lodge`,
              category: 'stay',
              location: dest.name,
              currentPriceKes: 12000,
              priceUnit: 'night',
              rating: 4.8,
              reviewCount: 10,
              amenities: ['wifi'],
              imageUrl: null,
              maxGuests: 4,
            },
          ],
          activities: [
            {
              id: `act-${dest.id}-1`,
              title: `${dest.name} Discovery Excursion`,
              category: 'activity',
              location: dest.name,
              currentPriceKes: 3000,
              priceUnit: 'person',
              rating: null, // Test authentic null rating
              reviewCount: 0,
              amenities: [],
              imageUrl: null,
              maxGuests: 8,
            },
          ],
          dining: [
            {
              id: `dining-${dest.id}-1`,
              title: `${dest.name} Local Flavors Experience`,
              category: 'dining',
              location: dest.name,
              currentPriceKes: 2500,
              priceUnit: 'person',
              rating: 4.9,
              reviewCount: 16,
              amenities: [],
              imageUrl: null,
              maxGuests: 12,
            },
          ],
        };

        const plan = edgeModule.buildDeterministicItinerary(
          dest.id,
          dest.name,
          3,
          mockCandidates
        );

        // Invariant: Destination MUST match requested destination
        assert.strictEqual(plan.destination, dest.name);
        assert.strictEqual(plan.destinationId, dest.id);

        // Invariant: MUST NOT default to Diani Beach
        if (dest.id !== 'diani') {
          assert.notStrictEqual(
            plan.destination,
            'Diani Beach',
            `Fallback for ${dest.name} erroneously defaulted to Diani Beach`
          );
          assert.notStrictEqual(
            plan.destinationId,
            'diani',
            `Fallback for ${dest.id} erroneously defaulted to diani`
          );
        }

        // Summary and themes must reference active destination
        assert.ok(plan.summary.includes(dest.name));
        for (const day of plan.days) {
          assert.ok(
            day.theme.includes(dest.name) || day.notes.includes(dest.name.toLowerCase()),
            `Day theme/notes should reference active destination ${dest.name}`
          );
        }
      }
    });

    test('Client zuruPlanService buildGroundedLocalItinerary flags degraded: true and sets transparent fallbackReason', async () => {
      for (const dest of testDestinations) {
        const destConfig = DESTINATIONS.find((d) => d.id === dest.id) as DestinationConfig;
        assert.ok(destConfig, `DESTINATIONS registry must contain config for ${dest.id}`);

        const prefs: TripPreferences = {
          destinationId: destConfig.id,
          destinationName: destConfig.name,
          durationDays: 3,
          adultsCount: 2,
          childrenCount: 0,
          budgetTier: 'comfort',
          interests: ['beaches'],
        };

        const localPlan = await zuruPlanService.buildGroundedLocalItinerary(
          prefs,
          destConfig,
          'Simulated AI Gateway failure during adversarial verification'
        );

        // Invariant 1: Destination fidelity
        assert.strictEqual(localPlan.destination, destConfig.name);
        assert.strictEqual(localPlan.destinationId, destConfig.id);
        assert.notStrictEqual(localPlan.destination, 'Diani Beach');

        // Invariant 2: Degraded flags
        assert.strictEqual(localPlan.degraded, true, 'degraded flag must be true');
        assert.strictEqual(localPlan.generationEngine, 'grounded_local_planner');
        assert.strictEqual(
          localPlan.fallbackReason,
          'Simulated AI Gateway failure during adversarial verification'
        );

        // Invariant 3: Days structure
        assert.strictEqual(localPlan.days.length, 3);
        assert.strictEqual(localPlan.revision, 1);
      }
    });

    test('Edge Function handleRequest returns degraded: true with active destination fidelity on offline / error condition', async () => {
      // Create request payload for Lake Naivasha with invalid model / offline upstream provider
      const requestPayload = {
        action: 'plan_itinerary',
        preferences: {
          destinationId: 'naivasha',
          destinationName: 'Lake Naivasha',
          durationDays: 2,
          adultsCount: 2,
          childrenCount: 1,
          budgetTier: 'comfort',
          interests: ['safari_nature'],
        },
      };

      const req = new Request('https://edge.zurusasa.com/zuru-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      // Call handleRequest under Deno/Node test mock
      const response = await edgeModule.handleRequest(req);
      assert.strictEqual(response.status, 200);

      const json = await response.json();

      // Invariant 1: Active destination must be Lake Naivasha
      assert.strictEqual(json.itinerary.destination, 'Lake Naivasha');
      assert.strictEqual(json.itinerary.destinationId, 'naivasha');
      assert.notStrictEqual(json.itinerary.destination, 'Diani Beach');

      // Invariant 2: Degraded mode transparency
      assert.strictEqual(json.meta.degraded, true);
      assert.strictEqual(json.meta.is_fallback, true);
      assert.ok(json.meta.fallbackReason, 'fallbackReason must explain provider offline state');
      assert.ok(json.degradedNotice, 'degradedNotice must be surfaced to the traveler');
    });
  });
});
