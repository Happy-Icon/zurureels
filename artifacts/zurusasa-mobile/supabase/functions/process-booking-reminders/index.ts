/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeWorkerOrAdmin } from '../_shared/workerAuth.ts';
import {
  enqueueNotificationEvent,
  kickNotificationQueueAsync,
} from '../_shared/notificationOrchestrator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Classifies whether a booking start timestamp falls into the 24h or 1h reminder window.
 * Windows have generous width so 5-minute cron ticks never miss an event; atomic dedupe_key
 * guarantees each reminder is enqueued at most once per (booking, window, recipient).
 */
export function resolveReminderWindow(
  startAtMs: number,
  nowMs: number,
): '24h' | '1h' | null {
  const diffMs = startAtMs - nowMs;
  if (diffMs <= 0) return null;
  const diffMins = diffMs / 60_000;
  // 1-hour window: between 15m and 90m before start
  if (diffMins >= 15 && diffMins <= 90) {
    return '1h';
  }
  // 24-hour window: between 22h and 25h before start
  if (diffMins >= 22 * 60 && diffMins <= 25 * 60) {
    return '24h';
  }
  return null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!url || !serviceRoleKey) {
    return json({ error: 'Database service is not configured' }, 503);
  }

  const auth = await authorizeWorkerOrAdmin(request, url, anonKey, serviceRoleKey);
  if (!auth.authorized) {
    return json({ error: auth.error || 'Unauthorized' }, auth.status);
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const windowUpperIso = new Date(nowMs + 26 * 3_600_000).toISOString();

  // 1. Scan confirmed, un-checked-in bookings starting within the next 26 hours (ordered earliest-first to prevent 1h starvation)
  const { data: upcomingBookings, error: bookingErr } = await admin
    .from('bookings')
    .select(
      'id, user_id, trip_title, check_in, check_out, terms_snapshot, quote:booking_quotes(host_id), experience:experiences(user_id, title, check_in_time, timezone)',
    )
    .eq('status', 'confirmed')
    .is('checked_in_at', null)
    .gt('check_in', nowIso)
    .lte('check_in', windowUpperIso)
    .order('check_in', { ascending: true })
    .limit(200);

  if (bookingErr) {
    console.error('[process-booking-reminders] Failed to query upcoming bookings:', bookingErr.message);
    return json({ error: 'Failed to query upcoming bookings' }, 500);
  }

  let bookingRemindersQueued = 0;

  for (const booking of (upcomingBookings ?? []) as any[]) {
    const startMs = new Date(booking.check_in).getTime();
    if (Number.isNaN(startMs)) continue;

    const window = resolveReminderWindow(startMs, nowMs);
    if (!window) continue;

    const exp = Array.isArray(booking.experience) ? booking.experience[0] : booking.experience;
    const quote = Array.isArray(booking.quote) ? booking.quote[0] : booking.quote;
    const tripTitle = booking.trip_title || exp?.title || 'Your Experience';
    const checkInTime =
      booking.terms_snapshot?.check_in_time || exp?.check_in_time || '14:00';
    const timezone =
      booking.terms_snapshot?.timezone || exp?.timezone || 'Africa/Nairobi';
    const templateKey = window === '1h' ? 'booking_reminder_1h' : 'booking_reminder_24h';
    const channels: ('in_app' | 'push' | 'email' | 'sms')[] =
      window === '24h' ? ['in_app', 'push', 'email', 'sms'] : ['in_app', 'push', 'sms'];

    // Guest reminder
    if (booking.user_id) {
      await enqueueNotificationEvent(admin, {
        userId: booking.user_id,
        type: templateKey,
        templateKey,
        title:
          window === '1h'
            ? 'Your Experience Starts in 1 Hour'
            : `Reminder: ${tripTitle} is Tomorrow`,
        message:
          window === '1h'
            ? `"${tripTitle}" starts in 1 hour. Open Trips for directions and your check-in PIN.`
            : `"${tripTitle}" starts tomorrow (${checkInTime}). Open Trips to review arrival instructions.`,
        dedupeKey: `${templateKey}:${booking.id}:${booking.user_id}`,
        priority: 'normal',
        channels,
        actionType: 'booking',
        actionId: booking.id,
        payload: {
          booking_id: booking.id,
          trip_title: tripTitle,
          check_in: booking.check_in,
          check_out: booking.check_out,
          check_in_time: checkInTime,
          timezone,
          recipient_role: 'guest',
        },
      });
      bookingRemindersQueued++;
    }

    // Host reminder (respecting booking_quotes.host_id fallback)
    const hostId = quote?.host_id || exp?.user_id;
    if (hostId && hostId !== booking.user_id) {
      await enqueueNotificationEvent(admin, {
        userId: hostId,
        type: templateKey,
        templateKey,
        title:
          window === '1h'
            ? 'Guest Arriving in 1 Hour'
            : 'Guest Arriving Tomorrow',
        message:
          window === '1h'
            ? `Your guest for "${tripTitle}" is scheduled to arrive in 1 hour.`
            : `Your guest for "${tripTitle}" arrives tomorrow (${checkInTime}). Ensure check-in readiness.`,
        dedupeKey: `${templateKey}:${booking.id}:${hostId}`,
        priority: 'normal',
        channels,
        actionType: 'booking',
        actionId: booking.id,
        payload: {
          booking_id: booking.id,
          trip_title: tripTitle,
          check_in: booking.check_in,
          check_out: booking.check_out,
          check_in_time: checkInTime,
          timezone,
          recipient_role: 'host',
        },
      });
      bookingRemindersQueued++;
    }
  }

  // 2. Scan due ZuruPlan trip_reminders (ordered earliest-first)
  let tripRemindersQueued = 0;
  try {
    const { data: dueTrips } = await admin
      .from('trip_reminders')
      .select('id, user_id, trip_id, title, destination, window_type, remind_at')
      .is('sent_at', null)
      .is('cancelled_at', null)
      .lte('remind_at', nowIso)
      .order('remind_at', { ascending: true })
      .limit(100);

    for (const tr of (dueTrips ?? []) as any[]) {
      const leadText =
        tr.window_type === '1h'
          ? 'starts in 1 hour'
          : tr.window_type === '24h'
            ? 'starts tomorrow'
            : 'is coming up soon';

      await enqueueNotificationEvent(admin, {
        userId: tr.user_id,
        type: 'zuruplan_reminder',
        templateKey: 'zuruplan_reminder',
        title: `Trip Reminder: ${tr.title}`,
        message: `Your ZuruPlan itinerary "${tr.title}"${tr.destination ? ` (${tr.destination})` : ''} ${leadText}.`,
        dedupeKey: `zuruplan_reminder:${tr.trip_id}:${tr.window_type}:${tr.user_id}`,
        priority: 'normal',
        channels: tr.window_type === '24h' ? ['in_app', 'push', 'email'] : ['in_app', 'push'],
        actionType: 'discover',
        actionId: tr.trip_id,
        payload: {
          trip_id: tr.trip_id,
          trip_title: tr.title,
          destination: tr.destination,
          window_type: tr.window_type,
        },
      });

      await admin
        .from('trip_reminders')
        .update({ sent_at: nowIso, updated_at: nowIso })
        .eq('id', tr.id);

      tripRemindersQueued++;
    }
  } catch (tripErr) {
    console.warn('[process-booking-reminders] trip_reminders note:', tripErr);
  }

  if (bookingRemindersQueued > 0 || tripRemindersQueued > 0) {
    kickNotificationQueueAsync();
  }

  return json({
    success: true,
    bookingRemindersQueued,
    tripRemindersQueued,
  });
});
