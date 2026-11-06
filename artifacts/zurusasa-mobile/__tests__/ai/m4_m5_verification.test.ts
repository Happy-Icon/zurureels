import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import { computeReelEngagementScore, filterService } from '../../services/filterService';
import { POPULAR_DESTINATIONS, searchService } from '../../services/searchService';
import { zuruAIService } from '../../services/zuruAIService';

let edgeModule: any;

describe('Milestone 4 & 5: REM-12, REM-13, REM-14 & End-to-End Remediation Verification', () => {
  before(async () => {
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

  // ── 1. REM-12: Privacy Opt-Out & Translation "Coming Soon" ────────────────
  describe('REM-12: AI Privacy Enforcement & Translation Deferral', () => {
    test('zuruAIService.getPersonalizationAffinities honors aiImprovementOptOut=true immediately', async () => {
      const res = await zuruAIService.getPersonalizationAffinities('user-123', {
        aiImprovementOptOut: true,
      });
      assert.strictEqual(res.source, 'opted_out');
      assert.deepStrictEqual(res.categoryAffinities, {});
      assert.deepStrictEqual(res.locationAffinities, {});
    });

    test('Edge Function personalize_feed honors aiImprovementOptOut=true without querying interactions', async () => {
      const req = new Request('https://edge.zurusasa.com/zuru-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'personalize_feed',
          userId: 'user-123',
          aiImprovementOptOut: true,
        }),
      });

      const response = await edgeModule.handleRequest(req);
      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.source, 'opted_out');
      assert.deepStrictEqual(data.categoryAffinities, {});
      assert.deepStrictEqual(data.locationAffinities, {});
    });

    test('app/profile/translation.tsx marks Automatic translation as COMING SOON with disabled Switch', () => {
      const translationSrc = fs.readFileSync(
        path.resolve(process.cwd(), 'app/profile/translation.tsx'),
        'utf-8'
      );
      assert.ok(translationSrc.includes('COMING SOON'), 'Should display COMING SOON badge');
      assert.ok(translationSrc.includes('disabled={true}'), 'Switch should be disabled');
      assert.ok(translationSrc.includes('value={false}'), 'Switch value should be false');
    });

    test('app/profile/privacy.tsx clears personalization cache when ai_improvement is toggled', () => {
      const privacySrc = fs.readFileSync(
        path.resolve(process.cwd(), 'app/profile/privacy.tsx'),
        'utf-8'
      );
      assert.ok(
        privacySrc.includes('zuruAIService.clearPersonalizationCache()'),
        'Privacy screen must clear personalization cache on toggle'
      );
    });
  });

  // ── 2. REM-13: Unreachable Discover Chat Removal ──────────────────────────
  describe('REM-13: Unreachable Discover Chat Modal Removal', () => {
    test('app/(tabs)/discover.tsx no longer imports or mounts dead ZuruAgentChat modal', () => {
      const discoverSrc = fs.readFileSync(
        path.resolve(process.cwd(), 'app/(tabs)/discover.tsx'),
        'utf-8'
      );
      assert.strictEqual(
        discoverSrc.includes('<ZuruAgentChat'),
        false,
        'Discover screen must not render unreachable <ZuruAgentChat /> modal'
      );
      assert.strictEqual(
        discoverSrc.includes('const [chatOpen, setChatOpen]'),
        false,
        'Discover screen must not retain dead chatOpen state'
      );
    });

    test('app/ai/index.tsx wires history button to /ai/history', () => {
      const aiIndexSrc = fs.readFileSync(
        path.resolve(process.cwd(), 'app/ai/index.tsx'),
        'utf-8'
      );
      assert.ok(
        aiIndexSrc.includes("router.push('/ai/history'"),
        'AI hub history button must navigate to /ai/history'
      );
    });
  });

  // ── 3. REM-14: Authentic Popularity Metrics & Static Listing Count Removal ─
  describe('REM-14: Authentic Engagement Sorting & Static Count Removal', () => {
    test('computeReelEngagementScore ranks by likes, saves, shares, and views instead of video duration', () => {
      const shortHighEngagement = {
        id: 'reel-1',
        duration: 12, // short video
        likes_count: 50,
        saves_count: 30,
        shares_count: 10,
        views_count: 500,
        experience: { current_price: 10000, rating: 4.5 },
      };
      const longZeroEngagement = {
        id: 'reel-2',
        duration: 180, // long video, zero engagement
        likes_count: 0,
        saves_count: 0,
        shares_count: 0,
        views_count: 5,
        experience: { current_price: 10000, rating: 4.5 },
      };

      const scoreHigh = computeReelEngagementScore(shortHighEngagement);
      const scoreLow = computeReelEngagementScore(longZeroEngagement);
      assert.ok(scoreHigh > scoreLow, 'High engagement reel must score higher than long zero-engagement reel');

      const sorted = filterService.applyFilters(
        [longZeroEngagement as any, shortHighEngagement as any],
        { sortBy: 'popular' }
      );
      assert.strictEqual(sorted[0].id, 'reel-1', 'Popular sort must rank high-engagement reel first');
    });

    test('POPULAR_DESTINATIONS and SearchSuggestions contain zero hardcoded fake stay counts', () => {
      for (const dest of POPULAR_DESTINATIONS as any[]) {
        assert.strictEqual(
          dest.count,
          undefined,
          `Destination ${dest.name} must not have hardcoded fake stay count`
        );
        assert.ok(dest.region, `Destination ${dest.name} should have an authentic regional label`);
      }

      const searchServiceSrc = fs.readFileSync(
        path.resolve(process.cwd(), 'services/searchService.ts'),
        'utf-8'
      );
      assert.strictEqual(searchServiceSrc.includes('142 stays'), false);
      assert.strictEqual(searchServiceSrc.includes('98 stays'), false);
      assert.strictEqual(searchServiceSrc.includes('210 stays'), false);
    });

    test('searchService.parseNaturalLanguageQuery handles word-bounded AC and K budget multipliers (REM-07)', () => {
      const peacefulBeach = searchService.parseNaturalLanguageQuery('peaceful beach stay in kilifi under 25000 kes');
      assert.strictEqual(
        peacefulBeach.amenities?.includes('Air Conditioning') ?? false,
        false,
        'Must not match "ac" inside "peaceful" or "beach"'
      );
      assert.strictEqual(
        peacefulBeach.maxPrice,
        25000,
        'Must not multiply 25000 by 1000 due to "k" in "kilifi" or "kes"'
      );

      const withAc = searchService.parseNaturalLanguageQuery('villa in diani with ac under 15k');
      assert.ok(withAc.amenities?.includes('Air Conditioning'), 'Must detect explicit "ac"');
      assert.strictEqual(withAc.maxPrice, 15000, 'Must multiply "15k" to 15000');
    });
  });
});
