/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHostWelcomeHtml(hostName: string): string {
  const safeName = escapeHtml(hostName || 'Zuru Host');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ZuruSasa Hosting</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B0F19; margin: 0; padding: 24px 12px; color: #FFFFFF;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #111827; border-radius: 16px; border: 1px solid #1F2937; overflow: hidden;">
    <div style="padding: 32px 28px 24px; border-bottom: 1px solid #1F2937; text-align: center;">
      <div style="font-size: 18px; font-weight: 800; color: #F26522; letter-spacing: 0.5px; margin-bottom: 10px;">ZURUSASA COASTAL</div>
      <h1 style="font-size: 23px; font-weight: 700; color: #FFFFFF; margin: 0 0 8px;">Welcome to Hosting, ${safeName}!</h1>
      <p style="font-size: 14px; color: #9CA3AF; margin: 0;">Your ZuruSasa Host Dashboard is now active.</p>
    </div>
    <div style="padding: 28px;">
      <p style="font-size: 15px; line-height: 1.6; color: #E5E7EB; margin-top: 0;">
        You can now publish video reels, configure availability calendars, complete identity verification, and receive escrow-protected bookings across the Kenyan coast.
      </p>
    </div>
    <div style="text-align: center; padding: 20px 28px; border-top: 1px solid #1F2937; font-size: 12px; color: #6B7280;">
      ZuruSasa Ltd • Kenyan Coastal Escapes
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return json({ error: 'Authentication is required' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return json({ error: 'Authentication is required' }, 401);
  }

  // Enforce server-side rate limit: max 10 email requests per 60 seconds per user
  const rl = await checkRateLimit(request, 'send_email', 10, 60, user.id);
  if (!rl.allowed) {
    return json({ error: 'Too many email requests. Please wait before trying again.' }, 429);
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('[SendEmail] RESEND_API_KEY is not set in Supabase Edge Function secrets');
    return json({ error: 'Email service is not configured' }, 503);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ error: 'Invalid JSON body' }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // Never trust client-supplied 'from' address — enforce authoritative server sender
  const fromAddress =
    Deno.env.get('RESEND_FROM_EMAIL') ||
    Deno.env.get('EMAIL_FROM') ||
    'ZuruSasa <onboarding@resend.dev>';

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role, email, full_name')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = callerProfile?.role === 'admin';

  let targetUserId = '';
  let subject = '';
  let html = '';

  if (body.type === 'host_application') {
    targetUserId = user.id;
    const dataObj =
      body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : {};
    const hostName =
      (typeof dataObj.name === 'string' && dataObj.name.trim()) ||
      callerProfile?.full_name ||
      'Zuru Host';
    subject = 'Welcome to ZuruSasa Hosting!';
    html = buildHostWelcomeHtml(hostName);
  } else {
    const recipientUserId =
      typeof body.recipientUserId === 'string' ? body.recipientUserId.trim() : '';
    const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';
    subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 250) : '';
    html = typeof body.html === 'string' ? body.html.trim() : '';

    if (!subject || !html) {
      return json({ error: 'Missing required fields: subject and html' }, 400);
    }

    if (recipientUserId) {
      if (!UUID_RE.test(recipientUserId)) {
        return json({ error: 'Invalid recipientUserId UUID' }, 400);
      }

      if (recipientUserId !== user.id && !isAdmin) {
        if (!UUID_RE.test(bookingId)) {
          return json({ error: 'bookingId is required for cross-user transactional emails' }, 403);
        }

        const { data: bookingRow } = await admin
          .from('bookings')
          .select('id, user_id, experience:experiences!inner(user_id)')
          .eq('id', bookingId)
          .maybeSingle();

        if (!bookingRow) {
          return json({ error: 'Associated booking not found' }, 404);
        }

        const exp = Array.isArray(bookingRow.experience)
          ? bookingRow.experience[0]
          : bookingRow.experience;
        const guestId = String(bookingRow.user_id ?? '');
        const hostId = String((exp as any)?.user_id ?? '');

        const validCounterparty =
          (user.id === hostId && recipientUserId === guestId) ||
          (user.id === guestId && recipientUserId === hostId);

        if (!validCounterparty) {
          return json({ error: 'Not authorized to email this booking participant' }, 403);
        }
      }

      targetUserId = recipientUserId;
    } else if (typeof body.to === 'string' && body.to.trim()) {
      // Strictly disallow sending to arbitrary external addresses unless matching caller's own verified email
      const requestedTo = body.to.trim().toLowerCase();
      const callerEmail = (user.email || callerProfile?.email || '').trim().toLowerCase();
      if (!isAdmin && (!callerEmail || requestedTo !== callerEmail)) {
        return json({ error: 'Arbitrary external email recipients are not permitted' }, 403);
      }
      targetUserId = user.id;
    } else {
      return json({ error: 'recipientUserId is required' }, 400);
    }
  }

  // Resolve authoritative recipient email & preferences on the server
  const { data: recipientProfile } = await admin
    .from('profiles')
    .select('email, metadata, notification_settings')
    .eq('id', targetUserId)
    .maybeSingle();

  const notifMeta = ((recipientProfile?.metadata ?? {}) as Record<string, unknown>);
  const notifSettings = ((recipientProfile?.notification_settings ?? {}) as Record<
    string,
    { email?: boolean }
  >);

  if (
    notifMeta.notifications_enabled === false ||
    notifSettings.account_activity?.email === false
  ) {
    return json({
      success: true,
      skipped: true,
      reason: 'Recipient disabled email notifications',
    });
  }

  let resolvedEmail =
    typeof recipientProfile?.email === 'string' && recipientProfile.email.includes('@')
      ? recipientProfile.email.trim()
      : '';

  if (!resolvedEmail) {
    if (targetUserId === user.id && user.email && user.email.includes('@')) {
      resolvedEmail = user.email.trim();
    } else {
      const { data: authTarget } = await admin.auth.admin.getUserById(targetUserId);
      if (authTarget?.user?.email && authTarget.user.email.includes('@')) {
        resolvedEmail = authTarget.user.email.trim();
      }
    }
  }

  if (!resolvedEmail) {
    return json({ error: 'Recipient does not have a deliverable email address on file' }, 422);
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [resolvedEmail],
        subject,
        html,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('[SendEmail] Resend API error:', data);
      return json(
        { error: data?.message || 'Failed to send email via Resend' },
        response.status,
      );
    }

    console.log(`[SendEmail] Successfully dispatched email. Message ID: ${data?.id}`);
    return json({ success: true, id: data?.id });
  } catch (err: any) {
    console.error('[SendEmail] Exception calling Resend API:', err);
    return json({ error: err?.message || 'Internal network error sending email' }, 500);
  }
});
