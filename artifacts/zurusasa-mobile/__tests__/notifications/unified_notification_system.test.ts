import { before, describe, test } from 'node:test';
import assert from 'node:assert';
import type * as TzMod from '@/lib/bookingTimezones';

interface PolicyMod {
  evaluateChannelEligibility: (input: {
    priority: 'critical' | 'normal' | 'promotional';
    category: string;
    channel: 'in_app' | 'push' | 'email';
    masterEnabled?: boolean | null;
    settings?: Record<string, { email?: boolean; push?: boolean; sms?: boolean }> | null;
    marketingOptIn?: boolean | null;
  }) => { allowed: boolean; reason?: string };
  chunkArray: <T>(items: T[], chunkSize?: number) => T[][];
  computeNextRetryIso: (attempts: number, nowMs?: number) => string;
}

interface TemplatesMod {
  renderNotificationTemplate: (
    templateKey: string,
    payload: Record<string, unknown>,
  ) => {
    subject: string;
    html: string;
    text: string;
    pushTitle: string;
    pushBody: string;
  };
}

let policy: PolicyMod;
let templates: TemplatesMod;
let tz: typeof TzMod;

before(async () => {
  const policyPath = '../../supabase/functions/_shared/notificationPolicy.ts';
  const templatesPath = '../../supabase/functions/_shared/templates/index.ts';
  const tzPath = '../../lib/bookingTimezones.ts';
  policy = (await import(policyPath)) as PolicyMod;
  templates = (await import(templatesPath)) as TemplatesMod;
  tz = (await import(tzPath)) as typeof TzMod;
});

describe('Unified Notification Policy Engine', () => {
  test('critical notifications always attempt in_app, push, and email even if user opted out', () => {
    const disabledSettings = {
      account_activity: { email: false, push: false, sms: false },
    };
    for (const channel of ['in_app', 'push', 'email'] as const) {
      const res = policy.evaluateChannelEligibility({
        priority: 'critical',
        category: 'account_activity',
        channel,
        masterEnabled: false,
        settings: disabledSettings,
        marketingOptIn: false,
      });
      assert.strictEqual(res.allowed, true, `critical channel ${channel} must not be suppressed`);
    }
  });

  test('promotional notifications are strictly blocked for new/uninitialized users and non-opted-in users', () => {
    const newUserRes = policy.evaluateChannelEligibility({
      priority: 'promotional',
      category: 'all_offers',
      channel: 'push',
      masterEnabled: true,
      settings: {},
      marketingOptIn: false,
    });
    assert.strictEqual(newUserRes.allowed, false);
    assert.strictEqual(newUserRes.reason, 'marketing_not_opted_in');

    const optedInNoChannel = policy.evaluateChannelEligibility({
      priority: 'promotional',
      category: 'all_offers',
      channel: 'email',
      masterEnabled: true,
      settings: {},
      marketingOptIn: true,
    });
    assert.strictEqual(optedInNoChannel.allowed, false);

    const optedInWithChannel = policy.evaluateChannelEligibility({
      priority: 'promotional',
      category: 'all_offers',
      channel: 'email',
      masterEnabled: true,
      settings: { all_offers: { email: true } },
      marketingOptIn: true,
    });
    assert.strictEqual(optedInWithChannel.allowed, true);
  });

  test('normal transactional notifications respect category channel opt-outs while keeping in_app', () => {
    const pushRes = policy.evaluateChannelEligibility({
      priority: 'normal',
      category: 'messages',
      channel: 'push',
      masterEnabled: true,
      settings: { messages: { push: false, email: true } },
      marketingOptIn: false,
    });
    assert.strictEqual(pushRes.allowed, false);

    const inAppRes = policy.evaluateChannelEligibility({
      priority: 'normal',
      category: 'messages',
      channel: 'in_app',
      masterEnabled: true,
      settings: { messages: { push: false } },
      marketingOptIn: false,
    });
    assert.strictEqual(inAppRes.allowed, true);
  });

  test('Expo push chunkArray splits batches into <= 100 items and retry backoff increases monotonically', () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    const chunks = policy.chunkArray(items, 100);
    assert.strictEqual(chunks.length, 3);
    assert.strictEqual(chunks[0].length, 100);
    assert.strictEqual(chunks[1].length, 100);
    assert.strictEqual(chunks[2].length, 50);

    const now = Date.UTC(2026, 10, 21, 12, 0, 0);
    const r1 = new Date(policy.computeNextRetryIso(1, now)).getTime() - now;
    const r2 = new Date(policy.computeNextRetryIso(2, now)).getTime() - now;
    const r3 = new Date(policy.computeNextRetryIso(3, now)).getTime() - now;
    assert.strictEqual(r1, 60_000);
    assert.strictEqual(r2, 5 * 60_000);
    assert.strictEqual(r3, 15 * 60_000);
  });
});

describe('Centralized Server Notification Templates', () => {
  test('payment_receipt differentiates instant booking vs approval-required copy', () => {
    const instant = templates.renderNotificationTemplate('payment_receipt', {
      recipient_name: 'Amina',
      trip_title: 'Diani Ocean Villa',
      booking_id: '12345678-abcd-efgh-ijkl-1234567890ab',
      amount: 18500,
      booking_mode: 'instant',
      booking_status: 'confirmed',
    });
    assert.ok(instant.subject.includes('Booking Confirmed'));
    assert.ok(instant.html.includes('instantly confirmed'));
    assert.ok(instant.text.length > 20);

    const approval = templates.renderNotificationTemplate('payment_receipt', {
      recipient_name: 'Amina',
      trip_title: 'Diani Ocean Villa',
      booking_mode: 'approval_required',
      booking_status: 'paid',
    });
    assert.ok(approval.subject.includes('Payment Receipt'));
    assert.ok(approval.html.includes('host has been notified'));
  });

  test('escapes untrusted HTML across all key templates and includes plain-text fallback', () => {
    const keys = [
      'host_welcome',
      'booking_confirmed',
      'booking_request',
      'booking_declined',
      'booking_cancelled_host',
      'booking_cancelled_guest',
      'payment_failed',
      'refund_processed',
      'payout_completed',
      'payout_failed',
      'verification_approved',
      'verification_declined',
      'arrival_issue_reported',
      'booking_reminder_24h',
      'booking_reminder_1h',
      'zuruplan_reminder',
      'data_export_otp',
      'data_export_ready',
      'new_message',
      'promotional_offer',
    ];

    for (const key of keys) {
      const rendered = templates.renderNotificationTemplate(key, {
        recipient_name: '<script>alert(1)</script>',
        trip_title: 'Lamu <img src=x onerror=alert(1)> Stay',
        reason: '<b>Test</b>',
        otp: '123456',
      });
      assert.ok(!rendered.html.includes('<script>alert(1)</script>'), `XSS not escaped in ${key}`);
      assert.ok(rendered.subject.length > 0, `Missing subject in ${key}`);
      assert.ok(rendered.text.length > 0, `Missing plain-text body in ${key}`);
      assert.ok(rendered.pushTitle.length > 0, `Missing pushTitle in ${key}`);
    }
  });
});

describe('Timezone-Safe Booking Serialization', () => {
  test('buildStayTimestampIso preserves calendar date in Africa/Nairobi without UTC -1 day shift', () => {
    const localDate = new Date(2026, 10, 22, 0, 0, 0); // Nov 22, 2026
    const checkInIso = tz.buildStayTimestampIso(localDate, '14:00', 14, 'Africa/Nairobi');
    assert.strictEqual(checkInIso, '2026-11-22T14:00:00+03:00');
    assert.strictEqual(tz.extractListingDateIso(checkInIso, 'Africa/Nairobi'), '2026-11-22');

    const checkOutIso = tz.buildStayTimestampIso(new Date(2026, 10, 24), '10:00 AM', 10, 'Africa/Nairobi');
    assert.strictEqual(checkOutIso, '2026-11-24T10:00:00+03:00');
  });

  test('extractListingDateIso maps UTC-shifted Nairobi midnight back to the right listing calendar day', () => {
    // 2026-11-21T21:00:00Z is 2026-11-22T00:00:00+03:00 in Africa/Nairobi
    assert.strictEqual(
      tz.extractListingDateIso('2026-11-21T21:00:00.000Z', 'Africa/Nairobi'),
      '2026-11-22',
    );
  });

  test('parseClockTime parses 24h, 12h AM/PM, and fallback values', () => {
    assert.deepStrictEqual(tz.parseClockTime('14:30', 12, 0), { hours: 14, minutes: 30 });
    assert.deepStrictEqual(tz.parseClockTime('2:15 PM', 12, 0), { hours: 14, minutes: 15 });
    assert.deepStrictEqual(tz.parseClockTime('12:00 AM', 12, 0), { hours: 0, minutes: 0 });
    assert.deepStrictEqual(tz.parseClockTime(null, 14, 0), { hours: 14, minutes: 0 });
  });
});
