/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Authentication is required' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || anonKey;

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: 'Authentication is required' }, 401);

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { inquiryId, status: reportedStatus, fields } = body;
  if (!inquiryId) return json({ error: 'inquiryId is required' }, 400);

  const personaApiKey = Deno.env.get('PERSONA_API_KEY');
  let verifiedStatus = reportedStatus || 'pending';

  // If server API key exists, double-check directly with Persona API for maximum security
  if (personaApiKey && inquiryId.startsWith('inq_')) {
    try {
      const res = await fetch(`https://withpersona.com/api/v1/inquiries/${inquiryId}`, {
        headers: {
          'Authorization': `Bearer ${personaApiKey}`,
          'Persona-Version': '2023-01-05',
          'Key-Inflection': 'camel',
        },
      });

      if (res.ok) {
        const jsonRes = await res.json();
        const serverInquiryStatus = jsonRes?.data?.attributes?.status;
        const serverRefId = jsonRes?.data?.attributes?.referenceId;

        // Ensure inquiry was created for this exact user
        if (serverRefId && serverRefId !== user.id) {
          return json({ error: 'Inquiry does not belong to the current authenticated user' }, 403);
        }

        if (serverInquiryStatus) {
          verifiedStatus = serverInquiryStatus;
        }
      }
    } catch (err) {
      console.warn('Error verifying inquiry with Persona API:', err);
    }
  }

  const adminClient = createClient(url, serviceRoleKey);

  // Map Persona status
  const normalized = (verifiedStatus || '').toLowerCase().trim();
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

  // Update profile
  const { error: updateErr } = await adminClient
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
        reported_status: reportedStatus,
        verified_status: verifiedStatus,
        final_status: finalStatus,
        fields: fields || {},
        updated_at: now,
      },
    })
    .eq('id', user.id);

  if (updateErr) {
    console.error('Error updating profile with verification result:', updateErr);
  }

  return json({
    success: true,
    userId: user.id,
    inquiryId,
    verificationStatus: finalStatus,
    isVerified,
    verifiedAt: isVerified ? now : null,
  });
});
