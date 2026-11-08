/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let c = 0;
  for (let i = 0; i < a.length; i++) {
    c |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return c === 0;
}

function generateOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const code = (arr[0] % 900000) + 100000;
  return code.toString();
}

async function sendVerificationEmail(
  toEmail: string,
  otp: string,
  resendApiKey: string,
  emailFrom: string,
) {
  if (!resendApiKey) {
    console.warn('[request-personal-data] RESEND_API_KEY not configured, logging OTP for test:', otp);
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>ZuruSasa Personal Data Verification</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0B0F19; color: #FFFFFF; padding: 24px;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #111827; border: 1px solid #1F2937; border-radius: 12px; padding: 32px;">
    <div style="font-size: 18px; font-weight: 800; color: #F26522; margin-bottom: 16px;">ZURUSASA PRIVACY</div>
    <h2 style="margin: 0 0 12px; color: #FFFFFF;">Personal Data Access Verification</h2>
    <p style="color: #9CA3AF; font-size: 14px; line-height: 1.5;">
      A request to export your personal data was initiated on your ZuruSasa account. Use the 6-digit verification code below to authorize the export:
    </p>
    <div style="background-color: #1F2937; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #F26522; font-family: monospace;">${otp}</span>
    </div>
    <p style="color: #9CA3AF; font-size: 13px; line-height: 1.5;">
      This code is valid for <strong>10 minutes</strong>. If you did not make this request, someone may be attempting to access your account. Please change your password or passkey and contact support immediately.
    </p>
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #1F2937; font-size: 12px; color: #6B7280;">
      ZuruSasa Privacy & Data Protection Team • Kenya DPA 2019 / GDPR Art. 15
    </div>
  </div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom || 'ZuruSasa Privacy <privacy@zurusasa.com>',
      to: [toEmail],
      subject: `Your ZuruSasa Data Request Verification Code: ${otp}`,
      html,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[request-personal-data] Failed to send email via Resend:', errorText);
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Authentication required' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const emailFrom = Deno.env.get('EMAIL_FROM') ?? Deno.env.get('RESEND_FROM_EMAIL') ?? 'ZuruSasa Privacy <privacy@zurusasa.com>';

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  const action = body.action;

  // ── ACTION: initiate ────────────────────────────────────────────────────────
  if (action === 'initiate') {
    // 1. Rate limiting: max 5 initiate attempts per hour per user
    const rateLimit = await checkRateLimit(request, 'pdr_initiate', 5, 3600, user.id);
    if (!rateLimit.allowed) {
      return json({ error: 'Too many data export requests. Please try again later.' }, 429);
    }

    // 2. Check for completed export in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentCompleted } = await serviceClient
      .from('personal_data_requests')
      .select('id, created_at, status')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('created_at', oneDayAgo)
      .limit(1);

    if (recentCompleted && recentCompleted.length > 0) {
      return json(
        { error: 'You have already generated a personal data export in the last 24 hours.' },
        429,
      );
    }

    // 3. Check for existing active pending request
    const { data: activeRequests } = await serviceClient
      .from('personal_data_requests')
      .select('id, status, created_at, otp_expires_at')
      .eq('user_id', user.id)
      .in('status', ['pending_verification', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1);

    let requestId: string;
    const format = body.format === 'json' || body.format === 'pdf' ? body.format : 'both';
    const otp = generateOtp();
    const salt = crypto.randomUUID();
    const hash = await sha256(`${otp}:${salt}`);
    const otpHash = `${salt}:${hash}`;
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    if (activeRequests && activeRequests.length > 0 && activeRequests[0].status === 'pending_verification') {
      requestId = activeRequests[0].id;
      await serviceClient
        .from('personal_data_requests')
        .update({
          format,
          otp_hash: otpHash,
          otp_attempts: 0,
          otp_expires_at: otpExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);
    } else {
      const { data: newReq, error: insertError } = await serviceClient
        .from('personal_data_requests')
        .insert({
          user_id: user.id,
          status: 'pending_verification',
          format,
          otp_hash: otpHash,
          otp_attempts: 0,
          otp_max_attempts: 3,
          otp_expires_at: otpExpiresAt,
        })
        .select('id')
        .single();

      if (insertError || !newReq) {
        console.error('[request-personal-data] Failed to insert request:', insertError);
        return json({ error: 'Failed to initiate data request' }, 500);
      }
      requestId = newReq.id;
    }

    // Audit log
    await serviceClient.from('personal_data_audit_logs').insert({
      request_id: requestId,
      user_id: user.id,
      event_type: 'request_initiated',
      actor_role: 'user',
      ip_address: request.headers.get('x-forwarded-for') || null,
      user_agent: request.headers.get('user-agent') || null,
      details: { format, method: 'email_otp' },
    });

    // Send email
    const recipientEmail = user.email;
    if (recipientEmail) {
      await sendVerificationEmail(recipientEmail, otp, resendApiKey, emailFrom);
    }

    return json({
      success: true,
      request_id: requestId,
      status: 'pending_verification',
      expires_in_seconds: 600,
      recipient_email: recipientEmail ? recipientEmail.replace(/(.{2})(.*)(?=@)/, '$1***') : null,
    });
  }

  // ── ACTION: verify ──────────────────────────────────────────────────────────
  if (action === 'verify') {
    const { request_id: requestId, otp } = body;
    if (!requestId || !otp || typeof otp !== 'string') {
      return json({ error: 'Missing request_id or otp' }, 400);
    }

    const { data: reqRow, error: fetchErr } = await serviceClient
      .from('personal_data_requests')
      .select('*')
      .eq('id', requestId)
      .eq('user_id', user.id)
      .single();

    if (fetchErr || !reqRow) {
      return json({ error: 'Request not found' }, 404);
    }

    if (reqRow.status !== 'pending_verification') {
      return json({ error: `Request cannot be verified in status: ${reqRow.status}` }, 400);
    }

    if (new Date(reqRow.otp_expires_at).getTime() < Date.now()) {
      await serviceClient
        .from('personal_data_requests')
        .update({ status: 'failed', error_message: 'Verification code expired' })
        .eq('id', requestId);

      await serviceClient.from('personal_data_audit_logs').insert({
        request_id: requestId,
        user_id: user.id,
        event_type: 'otp_expired',
        actor_role: 'user',
        details: { attempts: reqRow.otp_attempts },
      });

      return json({ error: 'Verification code has expired. Please initiate a new request.' }, 400);
    }

    if (reqRow.otp_attempts >= reqRow.otp_max_attempts) {
      await serviceClient
        .from('personal_data_requests')
        .update({ status: 'failed', error_message: 'Max verification attempts exceeded' })
        .eq('id', requestId);

      await serviceClient.from('personal_data_audit_logs').insert({
        request_id: requestId,
        user_id: user.id,
        event_type: 'otp_max_attempts_exceeded',
        actor_role: 'user',
        details: { attempts: reqRow.otp_attempts },
      });

      return json({ error: 'Maximum attempts exceeded. Please initiate a new request.' }, 400);
    }

    const [salt, storedHash] = (reqRow.otp_hash || '').split(':');
    const calculatedHash = await sha256(`${otp.trim()}:${salt}`);

    if (!salt || !storedHash || !constantTimeEqual(calculatedHash, storedHash)) {
      const nextAttempts = reqRow.otp_attempts + 1;
      await serviceClient
        .from('personal_data_requests')
        .update({ otp_attempts: nextAttempts })
        .eq('id', requestId);

      await serviceClient.from('personal_data_audit_logs').insert({
        request_id: requestId,
        user_id: user.id,
        event_type: 'otp_verification_failed',
        actor_role: 'user',
        details: { attempt: nextAttempts, max: reqRow.otp_max_attempts },
      });

      return json(
        {
          error: 'Invalid verification code',
          remaining_attempts: Math.max(0, reqRow.otp_max_attempts - nextAttempts),
        },
        400,
      );
    }

    // OTP Verified! Transition to processing
    const verifiedAt = new Date().toISOString();
    await serviceClient
      .from('personal_data_requests')
      .update({
        status: 'processing',
        verified_at: verifiedAt,
        updated_at: verifiedAt,
      })
      .eq('id', requestId);

    await serviceClient.from('personal_data_audit_logs').insert({
      request_id: requestId,
      user_id: user.id,
      event_type: 'identity_verified',
      actor_role: 'user',
      details: { verified_at: verifiedAt },
    });

    // Trigger async processing function in background
    try {
      const workerUrl = `${supabaseUrl}/functions/v1/process-personal-data-export`;
      fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ request_id: requestId, user_id: user.id }),
      }).catch((err) => console.error('[request-personal-data] Async worker trigger caught:', err));
    } catch (e) {
      console.warn('[request-personal-data] Background dispatch error:', e);
    }

    return json({
      success: true,
      request_id: requestId,
      status: 'processing',
      message: 'Identity verified. Your data archive is being compiled.',
    });
  }

  // ── ACTION: get-signed-url ──────────────────────────────────────────────────
  if (action === 'get-signed-url') {
    const { request_id: requestId } = body;
    if (!requestId) {
      return json({ error: 'Missing request_id' }, 400);
    }

    const { data: reqRow, error: fetchErr } = await serviceClient
      .from('personal_data_requests')
      .select('*')
      .eq('id', requestId)
      .eq('user_id', user.id)
      .single();

    if (fetchErr || !reqRow) {
      return json({ error: 'Request not found' }, 404);
    }

    if (reqRow.status !== 'completed') {
      return json({ error: `Export is not ready. Current status: ${reqRow.status}` }, 400);
    }

    if (reqRow.expires_at && new Date(reqRow.expires_at).getTime() < Date.now()) {
      return json({ error: 'This export has expired and is no longer available.' }, 410);
    }

    let jsonUrl: string | null = null;
    let pdfUrl: string | null = null;

    if (reqRow.json_storage_path) {
      const { data: signedData } = await serviceClient.storage
        .from('personal-data-exports')
        .createSignedUrl(reqRow.json_storage_path, 86400);
      jsonUrl = signedData?.signedUrl ?? null;
    }

    if (reqRow.pdf_storage_path) {
      const { data: signedData } = await serviceClient.storage
        .from('personal-data-exports')
        .createSignedUrl(reqRow.pdf_storage_path, 86400);
      pdfUrl = signedData?.signedUrl ?? null;
    }

    await serviceClient
      .from('personal_data_requests')
      .update({
        download_count: (reqRow.download_count || 0) + 1,
        last_downloaded_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    await serviceClient.from('personal_data_audit_logs').insert({
      request_id: requestId,
      user_id: user.id,
      event_type: 'signed_url_generated',
      actor_role: 'user',
      details: { has_json: !!jsonUrl, has_pdf: !!pdfUrl },
    });

    return json({
      success: true,
      json_url: jsonUrl,
      pdf_url: pdfUrl,
      expires_at: reqRow.expires_at,
      checksum_sha256: reqRow.checksum_sha256,
      file_size_bytes: reqRow.file_size_bytes,
    });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
