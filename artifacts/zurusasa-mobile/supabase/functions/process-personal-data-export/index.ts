/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { authorizeWorkerOrAdmin } from '../_shared/workerAuth.ts';
import { renderNotificationTemplate } from '../_shared/templates/index.ts';
import { enqueueNotificationEvent } from '../_shared/notificationOrchestrator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function computeSha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function maskIdentifier(val?: string | null): string {
  if (!val) return 'N/A';
  if (val.length <= 4) return '***';
  return `${val.slice(0, 2)}***${val.slice(-2)}`;
}

async function buildPdfSummary(
  userData: Record<string, any>,
  requestId: string,
  userEmail: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const orange = rgb(0.949, 0.396, 0.133); // #F26522
  const darkBg = rgb(0.043, 0.059, 0.098); // #0B0F19
  const textWhite = rgb(1, 1, 1);
  const textGray = rgb(0.61, 0.64, 0.69);
  const cardBg = rgb(0.067, 0.094, 0.153);

  // Page 1: Overview & Profile
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  // Background
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: darkBg,
  });

  // Top Accent Banner
  page.drawRectangle({
    x: 40,
    y: height - 60,
    width: width - 80,
    height: 4,
    color: orange,
  });

  // Header
  page.drawText('ZURUSASA PERSONAL DATA EXPORT', {
    x: 40,
    y: height - 90,
    size: 20,
    font: fontBold,
    color: textWhite,
  });

  page.drawText('Official Personal Data Summary Archive • Kenya DPA 2019 / GDPR Art. 15 & 20', {
    x: 40,
    y: height - 110,
    size: 9,
    font: fontRegular,
    color: textGray,
  });

  // Request Metadata Card
  page.drawRectangle({
    x: 40,
    y: height - 190,
    width: width - 80,
    height: 65,
    color: cardBg,
  });

  const nowStr = new Date().toISOString();
  page.drawText(`Request ID: ${requestId}`, { x: 55, y: height - 145, size: 9, font: fontRegular, color: textWhite });
  page.drawText(`Account Email: ${userEmail}`, { x: 55, y: height - 160, size: 9, font: fontRegular, color: textWhite });
  page.drawText(`Export Generated: ${nowStr}`, { x: 55, y: height - 175, size: 9, font: fontRegular, color: textGray });

  let cursorY = height - 230;

  // Helper drawer
  const drawSection = (title: string, lines: string[]) => {
    page.drawText(title.toUpperCase(), {
      x: 40,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: orange,
    });
    cursorY -= 18;

    lines.forEach((line) => {
      page.drawText(line, {
        x: 45,
        y: cursorY,
        size: 9,
        font: fontRegular,
        color: textWhite,
      });
      cursorY -= 15;
    });
    cursorY -= 12;
  };

  // Profile Section
  const profile = userData.profile || {};
  drawSection('1. Profile & Account Information', [
    `Full Name: ${profile.full_name || 'N/A'}`,
    `Phone: ${maskIdentifier(profile.phone)}`,
    `Role: ${profile.role || 'traveler'}`,
    `Account Verified: ${profile.is_verified ? 'Yes' : 'No'}`,
    `Joined: ${profile.created_at || 'N/A'}`,
  ]);

  // Bookings Section
  const bookings = userData.bookings || [];
  drawSection('2. Stays & Bookings Summary', [
    `Total Reservations: ${bookings.length}`,
    ...bookings.slice(0, 5).map((b: any, i: number) =>
      `• Reservation #${i + 1}: ${b.id.slice(0, 8)}... | Status: ${b.status} | Total: ${b.total_price || 0} ${b.currency || 'KES'} | Dates: ${b.check_in || 'N/A'} to ${b.check_out || 'N/A'}`
    ),
  ]);

  // Payments Section
  const payments = userData.payments || [];
  drawSection('3. Financial & Transaction Summary', [
    `Total Payment Records: ${payments.length}`,
    ...payments.slice(0, 5).map((p: any, i: number) =>
      `• Payment #${i + 1}: ${p.id.slice(0, 8)}... | Status: ${p.status} | Amount: ${p.amount || 0} ${p.currency || 'KES'} | Method: ${p.channel || 'mpesa'}`
    ),
  ]);

  // Social & Reel Activity
  const reels = userData.reel_saves || [];
  const reviews = userData.reviews || [];
  drawSection('4. Activity & User-Generated Content', [
    `Saved Reels: ${reels.length} entries`,
    `Reviews Authored: ${reviews.length} entries`,
    `Notifications Received: ${(userData.notifications || []).length} entries`,
  ]);

  // Footer / Compliance Note
  page.drawRectangle({
    x: 40,
    y: 40,
    width: width - 80,
    height: 50,
    color: cardBg,
  });

  page.drawText('DATA INTEGRITY & RETENTION NOTICE', {
    x: 55,
    y: 72,
    size: 8,
    font: fontBold,
    color: orange,
  });

  page.drawText(
    'This summary export is retained on secure private storage for 7 days. Machine-readable JSON accompanies this document.',
    { x: 55, y: 56, size: 8, font: fontRegular, color: textGray },
  );

  return await doc.save();
}

async function sendReadyEmail(
  toEmail: string,
  requestId: string,
  resendApiKey: string,
  emailFrom: string,
) {
  if (!resendApiKey) return;

  const rendered = renderNotificationTemplate('data_export_ready', {
    request_id: requestId,
  });

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom || 'ZuruSasa Privacy <privacy@zurusasa.com>',
      to: [toEmail],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    }),
  }).catch((err) => console.error('[process-personal-data-export] Ready email error:', err));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const emailFrom = Deno.env.get('EMAIL_FROM') ?? Deno.env.get('RESEND_FROM_EMAIL') ?? 'ZuruSasa Privacy <privacy@zurusasa.com>';

  const auth = await authorizeWorkerOrAdmin(request, supabaseUrl, supabaseAnonKey, supabaseServiceKey);
  if (!auth.authorized) {
    return json({ error: auth.error || 'Unauthorized' }, auth.status);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  const { request_id: requestId, user_id: userId } = body;
  if (!requestId || !userId) {
    return json({ error: 'Missing request_id or user_id' }, 400);
  }

  // Fetch request record
  const { data: reqRow, error: reqErr } = await serviceClient
    .from('personal_data_requests')
    .select('*')
    .eq('id', requestId)
    .eq('user_id', userId)
    .single();

  if (reqErr || !reqRow) {
    return json({ error: 'Request not found' }, 404);
  }

  if (reqRow.status !== 'processing') {
    return json({ error: `Request status is not processing (${reqRow.status})` }, 400);
  }

  try {
    // 1. Gather User Records Across Tables
    const [
      profileRes,
      bookingsRes,
      quotesRes,
      paymentsRes,
      payoutsRes,
      reviewsRes,
      reelSavesRes,
      eventsRes,
      reelLikesRes,
      reelCommentsRes,
      notificationsRes,
      userDevicesRes,
    ] = await Promise.all([
      serviceClient.from('profiles').select('*').eq('id', userId).single(),
      serviceClient.from('bookings').select('id, listing_id, check_in, check_out, total_price, currency, status, created_at').eq('user_id', userId),
      serviceClient.from('booking_quotes').select('id, listing_id, total_price, currency, status, created_at').eq('user_id', userId),
      serviceClient.from('payments').select('id, booking_id, amount, currency, status, channel, created_at').eq('user_id', userId),
      serviceClient.from('payouts').select('id, amount, currency, status, created_at').eq('host_id', userId),
      serviceClient.from('reviews').select('id, listing_id, rating, comment, created_at').eq('user_id', userId),
      serviceClient.from('reel_saves').select('id, reel_id, created_at').eq('user_id', userId),
      serviceClient.from('event_subscribers').select('id, event_id, created_at').eq('user_id', userId),
      serviceClient.from('reel_likes').select('id, reel_id, created_at').eq('user_id', userId),
      serviceClient.from('reel_comments').select('id, reel_id, comment, created_at').eq('user_id', userId),
      serviceClient.from('notifications').select('id, type, title, message, created_at').eq('user_id', userId),
      serviceClient.from('user_devices').select('id, device_type, is_active, created_at').eq('user_id', userId),
    ]);

    const profileData = profileRes.data || {};
    const exportData = {
      export_metadata: {
        request_id: requestId,
        user_id: userId,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        regulatory_framework: 'Kenya Data Protection Act 2019 / GDPR Art. 15 & 20',
      },
      profile: {
        id: profileData.id,
        full_name: profileData.full_name,
        role: profileData.role,
        is_verified: profileData.is_verified,
        privacy_settings: profileData.privacy_settings,
        saved_trips: profileData.metadata?.saved_trips ?? [],
        created_at: profileData.created_at,
      },
      bookings: bookingsRes.data || [],
      booking_quotes: quotesRes.data || [],
      payments: (paymentsRes.data || []).map((p: any) => ({
        ...p,
        channel: p.channel || 'mpesa',
      })),
      payouts: payoutsRes.data || [],
      reviews: reviewsRes.data || [],
      reel_saves: reelSavesRes.data || [],
      event_subscriptions: eventsRes.data || [],
      reel_likes: reelLikesRes.data || [],
      reel_comments: reelCommentsRes.data || [],
      notifications: notificationsRes.data || [],
      registered_devices: userDevicesRes.data || [],
    };

    // 2. Generate JSON File
    const jsonStr = JSON.stringify(exportData, null, 2);
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const jsonPath = `${userId}/${requestId}/zurusasa-personal-data.json`;

    // 3. Generate PDF File
    const userEmail = profileData.email || 'user@zurusasa.com';
    const pdfBytes = await buildPdfSummary(exportData, requestId, userEmail);
    const pdfPath = `${userId}/${requestId}/zurusasa-personal-data.pdf`;

    // 4. Compute SHA-256 Checksum
    const checksum = await computeSha256(jsonBytes);
    const totalBytes = jsonBytes.byteLength + pdfBytes.byteLength;

    // 5. Upload to Private Bucket
    await serviceClient.storage
      .from('personal-data-exports')
      .upload(jsonPath, jsonBytes, { contentType: 'application/json', upsert: true });

    await serviceClient.storage
      .from('personal-data-exports')
      .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });

    // 6. Update Request Status to Completed
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await serviceClient
      .from('personal_data_requests')
      .update({
        status: 'completed',
        json_storage_path: jsonPath,
        pdf_storage_path: pdfPath,
        file_size_bytes: totalBytes,
        checksum_sha256: checksum,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    // 7. Audit Log
    await serviceClient.from('personal_data_audit_logs').insert({
      request_id: requestId,
      user_id: userId,
      event_type: 'export_generated_and_ready',
      actor_role: 'system',
      details: {
        file_size_bytes: totalBytes,
        checksum_sha256: checksum,
        expires_at: expiresAt,
      },
    });

    // 8. Send Email Alert via Resend & persist in-app notification
    if (userEmail) {
      await sendReadyEmail(userEmail, requestId, resendApiKey, emailFrom);
    }

    await enqueueNotificationEvent(serviceClient, {
      userId,
      type: 'data_export_ready',
      templateKey: 'data_export_ready',
      title: 'Personal Data Export Ready',
      message: 'Your personal data archive is compiled and available for download for 7 days.',
      dedupeKey: `data_export_ready:${requestId}:${userId}`,
      priority: 'critical',
      channels: ['in_app', 'push'],
      actionType: 'profile',
      actionId: requestId,
      payload: { request_id: requestId },
    });

    return json({
      success: true,
      request_id: requestId,
      status: 'completed',
      file_size_bytes: totalBytes,
      checksum_sha256: checksum,
    });
  } catch (err: any) {
    console.error('[process-personal-data-export] Error processing export:', err);
    await serviceClient
      .from('personal_data_requests')
      .update({
        status: 'failed',
        error_message: err?.message || 'Export processing failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    await serviceClient.from('personal_data_audit_logs').insert({
      request_id: requestId,
      user_id: userId,
      event_type: 'export_processing_failed',
      actor_role: 'system',
      details: { error: err?.message },
    });

    return json({ error: 'Failed to process export archive' }, 500);
  }
});
