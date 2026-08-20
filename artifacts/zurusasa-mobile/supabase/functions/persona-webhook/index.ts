/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, persona-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;

  let payload: any = {};
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  const eventName = payload?.data?.attributes?.name;
  const inquiryData = payload?.data?.attributes?.payload?.data;
  const inquiryId = inquiryData?.id;
  const inquiryAttributes = inquiryData?.attributes || {};
  const status = inquiryAttributes?.status;
  const referenceId = inquiryAttributes?.referenceId;

  if (!inquiryId || !referenceId) {
    return json({ error: 'Missing inquiryId or referenceId in webhook payload' }, 400);
  }

  const adminClient = createClient(url, serviceRoleKey);

  const normalized = (status || '').toLowerCase().trim();
  let finalStatus: 'verified' | 'failed' | 'pending' | 'canceled' = 'pending';
  let isVerified = false;

  if (normalized === 'completed' || normalized === 'approved' || normalized === 'verified') {
    finalStatus = 'verified';
    isVerified = true;
  } else if (normalized === 'declined' || normalized === 'failed' || normalized === 'rejected') {
    finalStatus = 'failed';
    isVerified = false;
  } else if (normalized === 'canceled' || normalized === 'cancelled') {
    finalStatus = 'canceled';
    isVerified = false;
  } else {
    finalStatus = 'pending';
    isVerified = false;
  }

  const now = new Date().toISOString();

  await adminClient
    .from('profiles')
    .update({
      persona_inquiry_id: inquiryId,
      verification_status: finalStatus,
      identity_verification_status: isVerified ? 'Verified' : finalStatus.charAt(0).toUpperCase() + finalStatus.slice(1),
      is_verified: isVerified,
      verified_at: isVerified ? now : undefined,
      verification_updated_at: now,
      verification_details: {
        inquiry_id: inquiryId,
        event_name: eventName,
        status: status,
        final_status: finalStatus,
        updated_at: now,
      },
    })
    .eq('id', referenceId);

  return json({ received: true, inquiryId, userId: referenceId, status: finalStatus });
});
