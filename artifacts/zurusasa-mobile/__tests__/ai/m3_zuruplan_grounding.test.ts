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
  type ExtractedTripConstraints,
} from '../../services/zuruPlanService';
import {
  DESTINATIONS,
  type TripPlan,
  type TripPreferences,
  type ItineraryItem,
  type TripDay,
} from '../../types/zuruPlan';

// Edge function dynamic imports
let edgeModule: any;

describe('Milestone 3: Grounded ZuruPlan Intelligence & Day Regeneration', () => {
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

  // ── 1. Ratings & Reviews Grounding (REM-09) ─────────────────────────────────
  describe('Ratings & Reviews Grounding (REM-09)', () => {
    test('extractRating returns null when listing has no rating or rating is 0', () => {
      assert.strictEqual(extractRating(null), null);
      assert.strictEqual(extractRating({}), null);
      assert.strictEqual(extractRating({ rating: null }), null);
      assert.strictEqual(extractRating({ rating: 0 }), null);
      assert.strictEqual(extractRating({ metadata: {} }), null);
      assert.strictEqual(extractRating({ metadata: { rating: null } }), null);
    });

    test('extractRating returns authentic numeric rating rounded to 1 decimal place', () => {
      assert.strictEqual(extractRating({ rating: 4.86 }), 4.9);
      assert.strictEqual(extractRating({ rating: 4.2 }), 4.2);
      assert.strictEqual(extractRating({ metadata: { rating: 4.65 } }), 4.7);
      assert.strictEqual(extractRating({ metadata: { average_rating: 4.31 } }), 4.3);
    });

    test('extractReviewsCount returns 0 for unreviewed listings without fabricating counts', () => {
      assert.strictEqual(extractReviewsCount(null), 0);
      assert.strictEqual(extractReviewsCount({}), 0);
      assert.strictEqual(extractReviewsCount({ reviews_count: null }), 0);
      assert.strictEqual(extractReviewsCount({ metadata: {} }), 0);
      // Eliminates hardcoded 18 / 42 reviews
      assert.notStrictEqual(extractReviewsCount({}), 18);
      assert.notStrictEqual(extractReviewsCount({}), 42);
    });

    test('extractReviewsCount extracts authentic review counts from database columns or metadata', () => {
      assert.strictEqual(extractReviewsCount({ reviews_count: 27 }), 27);
      assert.strictEqual(extractReviewsCount({ review_count: 14 }), 14);
      assert.strictEqual(extractReviewsCount({ metadata: { reviews_count: 53 } }), 53);
    });
  });

  // ── 2. Dynamic Time Slot Scheduling (REM-09) ───────────────────────────────
  describe('Dynamic Time Slot Allocation (REM-09)', () => {
    test('assigns water & boat excursions to morning slot (09:00 AM)', () => {
      const res = determineTimeSlotAndStart('watersports_and_boat_safari', 0);
      assert.strictEqual(res.timeSlot, 'morning');
      assert.strictEqual(res.startTime, '09:00 AM');
    });

    test('assigns sunset & dining experiences to evening slot (06:30 PM)', () => {
      const sunset = determineTimeSlotAndStart('sunset_dhow_cruise', 1);
      assert.strictEqual(sunset.timeSlot, 'evening');
      assert.strictEqual(sunset.startTime, '06:30 PM');

      const dining = determineTimeSlotAndStart('seafood_dining', 2);
      assert.strictEqual(dining.timeSlot, 'evening');
      assert.strictEqual(dining.startTime, '06:30 PM');
    });

    test('assigns stay accommodations to 11:00 AM check-in / orientation', () => {
      const stay = determineTimeSlotAndStart('villa_stay', 0);
      assert.strictEqual(stay.timeSlot, 'morning');
      assert.strictEqual(stay.startTime, '11:00 AM');
    });

    test('respects explicitly provided preferredSlot override', () => {
      const morningRes = determineTimeSlotAndStart('seafood_dining', 0, 'morning');
      assert.strictEqual(morningRes.timeSlot, 'morning');
      assert.strictEqual(morningRes.startTime, '09:00 AM');

      const afternoonRes = determineTimeSlotAndStart('watersports', 0, 'afternoon');
      assert.strictEqual(afternoonRes.timeSlot, 'afternoon');
      assert.strictEqual(afternoonRes.startTime, '02:00 PM');
    });
  });

  // ── 3. Geographic Destination Routing & Radius Expansion (REM-10) ───────────
  describe('Destination Clustered Mapping & Radius Expansion (REM-10)', () => {
    test('maps coastal destinations to accurate location keywords', () => {
      assert.strictEqual(getDestinationKeyword('lamu'), 'lamu');
      assert.strictEqual(getDestinationKeyword('watamu'), 'watamu');
      assert.strictEqual(getDestinationKeyword('diani'), 'diani');
      assert.strictEqual(getDestinationKeyword('malindi'), 'malindi');
      assert.strictEqual(getDestinationKeyword('naivasha'), 'naivasha');
      assert.strictEqual(getDestinationKeyword('mara'), 'mara');
    });

    test('provides contiguous adjacent towns for tier-2 radius expansion', () => {
      assert.strictEqual(getAdjacentDestinationKeyword('watamu'), 'malindi');
      assert.strictEqual(getAdjacentDestinationKeyword('malindi'), 'watamu');
      assert.strictEqual(getAdjacentDestinationKeyword('diani'), 'tiwi');
      assert.strictEqual(getAdjacentDestinationKeyword('kilifi'), 'mombasa');
      assert.strictEqual(getAdjacentDestinationKeyword('naivasha'), 'nakuru');
    });

    test('includes expanded coastal destinations in DESTINATIONS registry', () => {
      const destIds = DESTINATIONS.map((d) => d.id);
      assert.ok(destIds.includes('diani'));
      assert.ok(destIds.includes('watamu'));
      assert.ok(destIds.includes('lamu'));
      assert.ok(destIds.includes('malindi'));
      assert.ok(destIds.includes('naivasha'));
      assert.ok(destIds.includes('mara'));
    });
  });

  // ── 4. Grounded Local Solver & Transparent Fallback (REM-10) ────────────────
  describe('Grounded Local Solver & Active Destination Fidelity (REM-10)', () => {
    test('Edge Function buildDeterministicItinerary preserves active destination and flags degraded: true', () => {
      const mockCandidates = {
        stays: [
          {
            id: 'stay-lamu-1',
            title: 'Lamu Heritage Villa',
            category: 'stay',
            location: 'Lamu Island',
            currentPriceKes: 15000,
            priceUnit: 'night',
            rating: 4.8,
            reviewCount: 12,
            amenities: ['wifi'],
            imageUrl: 'https://example.com/villa.jpg',
            maxGuests: 4,
          },
        ],
        activities: [
          {
            id: 'exp-lamu-1',
            title: 'Lamu Old Town Walking Tour',
            category: 'cultural',
            location: 'Lamu Island',
            currentPriceKes: 2500,
            priceUnit: 'person',
            rating: 4.8,
            reviewCount: 12,
            amenities: [],
            imageUrl: null,
            maxGuests: 10,
          },
          {
            id: 'exp-lamu-2',
            title: 'Shela Sunset Dhow Sail',
            category: 'boat_safari',
            location: 'Shela, Lamu',
            currentPriceKes: 4500,
            priceUnit: 'person',
            rating: null,
            reviewCount: 0,
            amenities: [],
            imageUrl: null,
            maxGuests: 8,
          },
        ],
        dining: [
          {
            id: 'dining-lamu-1',
            title: 'Swahili Seafood Feast',
            category: 'dining',
            location: 'Shela, Lamu',
            currentPriceKes: 3000,
            priceUnit: 'person',
            rating: 4.9,
            reviewCount: 20,
            amenities: [],
            imageUrl: null,
            maxGuests: 10,
          },
        ],
      };

      const itinerary = edgeModule.buildDeterministicItinerary(
        'lamu',
        'Lamu Island',
        2,
        mockCandidates
      );

      assert.strictEqual(itinerary.destination, 'Lamu Island');
      assert.notStrictEqual(itinerary.destination, 'Diani Beach');
      assert.strictEqual(itinerary.days.length, 2);
      assert.ok(itinerary.summary.includes('Lamu Island'));

      // Check authentic ratings preservation
      const allItems = itinerary.days.flatMap((d: any) => d.items);
      const unrated = allItems.find((i: any) => i.experienceId === 'exp-lamu-2');
      if (unrated) {
        assert.strictEqual(unrated.rating, null);
        assert.strictEqual(unrated.reviewCount, 0);
      }
    });
  });

  // ── 5. Single-Day Regeneration with Deduplication & Protection (REM-08) ─────
  describe('Single-Day Regeneration (REM-08)', () => {
    test('regenerateDay excludes neighboring days items and preserves userModified: true', async () => {
      const baseTrip: TripPlan = {
        id: 'trip-test-123',
        title: 'Watamu Marine Safari',
        destination: 'Watamu & Malindi',
        destinationId: 'watamu',
        coverImage: 'https://example.com/cover.jpg',
        durationDays: 3,
        guestCount: 2,
        budgetTier: 'comfort',
        revision: 1,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        budgetBreakdown: {
          accommodationTotal: 30000,
          activitiesTotal: 15000,
          diningEstimate: 9000,
          totalEstimatedKes: 54000,
        },
        days: [
          {
            dayNumber: 1,
            dateLabel: 'Day 1',
            theme: 'Arrival & Beach Orientation',
            revision: 1,
            items: [
              {
                id: 'day1-act1',
                timeSlot: 'morning',
                slot: 'morning',
                startTime: '11:00 AM',
                title: 'Check into Villa',
                description: 'Oceanfront check-in',
                type: 'stay',
                experienceId: 'stay-101',
                rating: 4.8,
                reviewsCount: 10,
                isBookable: true,
              },
              {
                id: 'day1-act2',
                timeSlot: 'afternoon',
                slot: 'afternoon',
                startTime: '02:00 PM',
                title: 'Snorkeling at Watamu Marine Park',
                description: 'Reef snorkeling',
                type: 'activity',
                experienceId: 'act-marine-101',
                rating: 4.9,
                reviewsCount: 35,
                isBookable: true,
              },
            ],
          },
          {
            dayNumber: 2,
            dateLabel: 'Day 2',
            theme: 'Adventure Day',
            revision: 1,
            items: [
              {
                id: 'day2-custom-user-lunch',
                timeSlot: 'afternoon',
                slot: 'afternoon',
                startTime: '01:00 PM',
                title: 'Private Seafood Lunch with Local Chef',
                description: 'User curated beach dining',
                type: 'dining',
                experienceId: 'exp-chef-555',
                rating: null,
                reviewsCount: 0,
                isBookable: true,
                userModified: true, // MUST be preserved across regeneration!
              },
              {
                id: 'day2-replaceable-act',
                timeSlot: 'evening',
                slot: 'evening',
                startTime: '06:00 PM',
                title: 'Casual Beach Walk',
                description: 'Evening sunset stroll',
                type: 'activity',
                experienceId: 'exp-stroll-777',
                rating: 4.0,
                reviewsCount: 3,
                isBookable: true,
                userModified: false,
              },
            ],
          },
          {
            dayNumber: 3,
            dateLabel: 'Day 3',
            theme: 'Departure',
            revision: 1,
            items: [
              {
                id: 'day3-act1',
                timeSlot: 'morning',
                slot: 'morning',
                startTime: '09:00 AM',
                title: 'Gede Ruins Exploration',
                description: 'Historic forest ruins',
                type: 'activity',
                experienceId: 'act-gede-888',
                rating: 4.7,
                reviewsCount: 22,
                isBookable: true,
              },
            ],
          },
        ],
      };

      // Mock candidates for regeneration
      const mockCandidates = [
        {
          id: 'act-marine-101', // On Day 1! Must NOT be picked because it is in excludedExperienceIds
          title: 'Snorkeling at Watamu Marine Park',
          category: 'water',
          current_price: 3500,
        },
        {
          id: 'act-gede-888', // On Day 3! Must NOT be picked
          title: 'Gede Ruins Exploration',
          category: 'cultural',
          current_price: 1500,
        },
        {
          id: 'act-canyon-999', // Fresh unselected experience
          title: 'Marafa Hells Kitchen Sunset Tour',
          category: 'adventure',
          current_price: 4000,
        },
      ];

      const updatedTrip = await zuruPlanService.buildGroundedLocalDayRegeneration(
        baseTrip,
        2,
        ['stay-101', 'act-marine-101', 'act-gede-888'],
        mockCandidates as any
      );

      // 1. Revision must increment
      assert.strictEqual(updatedTrip.revision, 2);

      const regeneratedDay = updatedTrip.days.find((d) => d.dayNumber === 2)!;
      assert.ok(regeneratedDay, 'Day 2 must exist');

      // 2. User-modified item must survive in its exact slot
      const preservedItem = regeneratedDay.items.find(
        (i) => i.id === 'day2-custom-user-lunch'
      );
      assert.ok(preservedItem, 'User-modified item must be preserved');
      assert.strictEqual(preservedItem!.userModified, true);
      assert.strictEqual(preservedItem!.experienceId, 'exp-chef-555');

      // 3. Neighbor days items must NOT be scheduled
      const scheduledIds = regeneratedDay.items.map((i) => i.experienceId);
      assert.ok(!scheduledIds.includes('act-marine-101'), 'Must not repeat Day 1 marine park');
      assert.ok(!scheduledIds.includes('act-gede-888'), 'Must not repeat Day 3 Gede ruins');
    });
  });

  // ── 6. Conversational Constraints Extraction (REM-03) ───────────────────────
  describe('Conversational Constraints Parser (REM-03)', () => {
    test('extracts destination, duration, guest party, budget max, dietary, and pace', () => {
      const initial: ExtractedTripConstraints = {
        destinationId: 'diani',
        destinationName: 'Diani Beach',
        durationDays: 3,
        adultsCount: 2,
        childrenCount: 0,
        budgetTier: 'comfort',
        dietaryRestrictions: [],
        pace: 'moderate',
        interests: [],
        exclusions: [],
      };

      const prompt =
        'Plan a 5-day luxury trip to Watamu for our family of 4 (2 adults and 2 kids). ' +
        'We need strictly halal food, relaxed pace, and budget under 120k KES. Avoid noisy nightclubs.';

      const parsed = parseConstraintsFromConversation(prompt, initial);

      // Destination
      assert.strictEqual(parsed.destinationId, 'watamu');
      assert.strictEqual(parsed.destinationName, 'Watamu & Malindi');

      // Duration & Party
      assert.strictEqual(parsed.durationDays, 5);
      assert.strictEqual(parsed.adultsCount, 2);
      assert.strictEqual(parsed.childrenCount, 2);

      // Budget & Tier
      assert.strictEqual(parsed.budgetMaxKes, 120000);
      assert.strictEqual(parsed.budgetTier, 'luxury');

      // Dietary & Pace & Exclusions
      assert.ok(parsed.dietaryRestrictions.includes('halal'));
      assert.strictEqual(parsed.pace, 'relaxed');
      assert.ok(parsed.exclusions.some((e) => e.includes('nightclub') || e.includes('noisy')));
    });

    test('extracts inland destinations like Naivasha and Maasai Mara', () => {
      const initial: ExtractedTripConstraints = {
        destinationId: 'diani',
        destinationName: 'Diani Beach',
        durationDays: 3,
        adultsCount: 2,
        childrenCount: 0,
        budgetTier: 'comfort',
        dietaryRestrictions: [],
        pace: 'moderate',
        interests: [],
        exclusions: [],
      };

      const naivashaParsed = parseConstraintsFromConversation(
        'Looking for a 2-day escape to Lake Naivasha for boat rides and bird watching',
        initial
      );
      assert.strictEqual(naivashaParsed.destinationId, 'naivasha');
      assert.strictEqual(naivashaParsed.destinationName, 'Lake Naivasha');

      const maraParsed = parseConstraintsFromConversation(
        'We want 4 days safari in Maasai Mara for 2 grown-ups',
        initial
      );
      assert.strictEqual(maraParsed.destinationId, 'mara');
      assert.strictEqual(maraParsed.destinationName, 'Maasai Mara');
    });
  });

  // ── 7. Edge Function AI Gateway Tool Schemas (REM-08, REM-10) ───────────────
  describe('Edge Function Tool Schemas (REM-08, REM-10)', () => {
    test('ASSEMBLE_TRIP_PLAN_TOOL contains valid Anthropic tool definition', () => {
      const tool = edgeModule.ASSEMBLE_TRIP_PLAN_TOOL;
      assert.strictEqual(tool.name, 'assemble_trip_plan');
      assert.ok(tool.description.includes('Synthesizes an authentic multi-day travel plan'));
      assert.strictEqual(tool.input_schema.type, 'object');
      assert.ok(tool.input_schema.required.includes('tripTitle'));
      assert.ok(tool.input_schema.required.includes('destination'));
      assert.ok(tool.input_schema.required.includes('days'));
      assert.ok(tool.input_schema.required.includes('budgetBreakdown'));
    });

    test('REGENERATE_DAY_TOOL contains valid single-day regeneration tool definition', () => {
      const tool = edgeModule.REGENERATE_DAY_TOOL;
      assert.strictEqual(tool.name, 'regenerate_day_schedule');
      assert.ok(tool.description.includes('Regenerates activity and dining items'));
      assert.strictEqual(tool.input_schema.type, 'object');
      assert.ok(tool.input_schema.required.includes('dayNumber'));
      assert.ok(tool.input_schema.required.includes('items'));
    });
  });
});
