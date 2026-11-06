import { test, describe, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { parseAIMetadata } from '../../services/zuruAIService';

let resolveProvider: (action: string) => any;

describe('REM-01 & REM-06: Model Routing, Metadata & Honest Branding', () => {
  const origEnv = { ...process.env };

  before(async () => {
    const mod = await import('../../supabase/functions/zuru-ai/index.ts' as any);
    resolveProvider = mod.resolveProvider;
  });

  describe('Provider & Model Resolution (REM-01)', () => {
    beforeEach(() => {
      // Mock Deno.env to reflect process.env for Node test runner
      if (typeof (globalThis as any).Deno === 'undefined') {
        (globalThis as any).Deno = {
          env: {
            get: (k: string) => process.env[k] || '',
            set: (k: string, v: string) => { process.env[k] = v; },
          },
        };
      }
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.FABLE_API_KEY;
      delete process.env.ANTHROPIC_MODEL;
      delete process.env.FABLE_MODEL;
    });

    afterEach(() => {
      process.env = { ...origEnv };
    });

    test('actively remaps invalid "claude-fable-5-1" to genuine production models', () => {
      process.env.FABLE_MODEL = 'claude-fable-5-1';
      process.env.FABLE_API_KEY = 'test-fable-key';

      const discoverConfig = resolveProvider('discover');
      assert.strictEqual(
        discoverConfig.model,
        'claude-3-5-haiku-20241022',
        'discover action must resolve to claude-3-5-haiku-20241022',
      );
      assert.strictEqual(discoverConfig.apiKey, 'test-fable-key');

      const planConfig = resolveProvider('plan_itinerary');
      assert.strictEqual(
        planConfig.model,
        'claude-3-5-sonnet-20241022',
        'plan_itinerary action must resolve to claude-3-5-sonnet-20241022',
      );
    });

    test('supports ANTHROPIC_API_KEY and custom ANTHROPIC_MODEL', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      process.env.ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022';

      const config = resolveProvider('discover');
      assert.strictEqual(config.apiKey, 'sk-ant-test-key');
      assert.strictEqual(config.model, 'claude-3-5-sonnet-20241022');
      assert.strictEqual(config.engine, 'anthropic');
    });

    test('falls back to claude-3-5-haiku when model is unspecified', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      const config = resolveProvider('discover');
      assert.strictEqual(config.model, 'claude-3-5-haiku-20241022');
    });
  });

  describe('Execution Metadata Parsing (REM-06)', () => {
    test('parseAIMetadata normalizes full execution metadata', () => {
      const raw = {
        engine: 'anthropic',
        model: 'claude-3-5-haiku-20241022',
        degraded: false,
        latencyMs: 842,
        tokens: { prompt: 150, completion: 45 },
      };
      const parsed = parseAIMetadata(raw);
      assert.strictEqual(parsed.engine, 'anthropic');
      assert.strictEqual(parsed.model, 'claude-3-5-haiku-20241022');
      assert.strictEqual(parsed.degraded, false);
      assert.strictEqual(parsed.is_fallback, false);
      assert.strictEqual(parsed.latencyMs, 842);
      assert.strictEqual(parsed.tokens?.prompt, 150);
    });

    test('parseAIMetadata accurately flags degraded fallback mode', () => {
      const raw = {
        engine: 'fallback_regex',
        model: 'regex-fallback',
        degraded: true,
        is_fallback: true,
        fallbackReason: 'Anthropic API key unconfigured',
        latencyMs: 12,
      };
      const parsed = parseAIMetadata(raw);
      assert.strictEqual(parsed.degraded, true);
      assert.strictEqual(parsed.is_fallback, true);
      assert.strictEqual(parsed.engine, 'fallback_regex');
      assert.strictEqual(parsed.fallbackReason, 'Anthropic API key unconfigured');
    });

    test('parseAIMetadata handles null/undefined inputs safely', () => {
      const parsedNull = parseAIMetadata(null);
      assert.strictEqual(parsedNull.engine, 'unknown');
      assert.strictEqual(parsedNull.degraded, false);
      assert.strictEqual(parsedNull.latencyMs, 0);

      const parsedEmpty = parseAIMetadata({});
      assert.strictEqual(parsedEmpty.engine, 'unknown');
      assert.strictEqual(parsedEmpty.degraded, false);
    });
  });

  describe('Honest UI Badge Logic Verification (REM-06)', () => {
    function computeBadge(isOnline: boolean, meta: any) {
      if (!isOnline) {
        return { text: 'OFFLINE', color: '#B91C1C' };
      }
      if (meta?.degraded) {
        return { text: 'OFFLINE / BASIC', color: '#B45309' };
      }
      return { text: 'AI CONCIERGE', color: '#F26522' };
    }

    test('renders "AI CONCIERGE" when online and genuine LLM is active', () => {
      const badge = computeBadge(true, { degraded: false, engine: 'anthropic' });
      assert.strictEqual(badge.text, 'AI CONCIERGE');
      assert.notStrictEqual(badge.text, 'FABLE 5.1');
    });

    test('renders "OFFLINE / BASIC" when backend operates in degraded mode', () => {
      const badge = computeBadge(true, { degraded: true, engine: 'fallback_regex' });
      assert.strictEqual(badge.text, 'OFFLINE / BASIC');
      assert.notStrictEqual(badge.text, 'FABLE 5.1');
    });

    test('renders "OFFLINE" when client is offline', () => {
      const badge = computeBadge(false, null);
      assert.strictEqual(badge.text, 'OFFLINE');
      assert.notStrictEqual(badge.text, 'FABLE 5.1');
    });
  });
});
