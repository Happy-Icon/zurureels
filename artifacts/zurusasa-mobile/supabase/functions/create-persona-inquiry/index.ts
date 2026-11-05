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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: 'Authentication is required' }, 401);

  const templateId = (
    Deno.env.get('PERSONA_TEMPLATE_ID') ||
    Deno.env.get('EXPO_PUBLIC_PERSONA_TEMPLATE_ID') ||
    ''
  ).trim();

  if (!templateId) {
    console.error('[CreatePersonaInquiry] PERSONA_TEMPLATE_ID is not configured in Supabase secrets');
    return json({ error: 'Identity verification template is not configured' }, 503);
  }

  const rawEnv =
    Deno.env.get('PERSONA_ENVIRONMENT') ||
    Deno.env.get('EXPO_PUBLIC_PERSONA_ENVIRONMENT') ||
    'sandbox';
  const environment = rawEnv.toLowerCase().trim() === 'production' ? 'production' : 'sandbox';

  const personaApiKey = Deno.env.get('PERSONA_API_KEY')?.trim();
  if (!personaApiKey) {
    console.error('[CreatePersonaInquiry] PERSONA_API_KEY is not configured in Supabase secrets');
    return json({ error: 'Persona API key is not configured' }, 503);
  }

  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, full_name, email, phone, persona_inquiry_id, verification_status')
    .eq('id', user.id)
    .maybeSingle();

  let inquiryId: string | null = null;
  let sessionToken: string | null = null;

  const headers = {
    Authorization: `Bearer ${personaApiKey}`,
    'Persona-Version': '2023-01-05',
    'Content-Type': 'application/json',
    'Key-Inflection': 'camel',
  };

  // Helper function to resume an existing inquiry and extract its session token
  async function tryResumeInquiry(id: string): Promise<string | null> {
    try {
      const resumeRes = await fetch(`https://withpersona.com/api/v1/inquiries/${encodeURIComponent(id)}/resume`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      if (resumeRes.ok) {
        const resumeJson = await resumeRes.json();
        return (
          resumeJson?.meta?.['session-token'] ||
          resumeJson?.meta?.sessionToken ||
          resumeJson?.data?.attributes?.sessionToken ||
          null
        );
      }
      return null;
    } catch {
      return null;
    }
  }

  // 1. Try to resume existing pending inquiry if available
  if (profile?.persona_inquiry_id && profile.persona_inquiry_id.startsWith('inq_')) {
    const existingToken = await tryResumeInquiry(profile.persona_inquiry_id);
    if (existingToken) {
      inquiryId = profile.persona_inquiry_id;
      sessionToken = existingToken;
    }
  }

  // 2. If no existing inquiry could be resumed, create a new inquiry
  if (!inquiryId || !sessionToken) {
    try {
      const fullName = (profile?.full_name || user.user_metadata?.full_name || '').trim();
      const parts = fullName.split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      const email = profile?.email || user.email || '';
      const phone = profile?.phone || user.phone || '';

      const personaPayload: any = {
        data: {
          attributes: {
            'inquiry-template-id': templateId,
            'reference-id': user.id,
          },
        },
      };

      const fields: Record<string, any> = {};
      if (firstName) fields['name-first'] = firstName;
      if (lastName) fields['name-last'] = lastName;
      if (email) fields['email-address'] = email;
      if (phone) fields['phone-number'] = phone;

      if (Object.keys(fields).length > 0) {
        personaPayload.data.attributes.fields = fields;
      }

      const res = await fetch('https://withpersona.com/api/v1/inquiries', {
        method: 'POST',
        headers,
        body: JSON.stringify(personaPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[CreatePersonaInquiry] Persona API creation failed:', res.status, errText);
        return json({
          error: `Persona API inquiry creation failed (${res.status}): ${errText}`,
          statusCode: res.status,
        }, 502);
      }

      const jsonRes = await res.json();
      inquiryId = jsonRes?.data?.id || null;

      // Extract session token from creation response or explicitly resume
      sessionToken =
        jsonRes?.meta?.['session-token'] ||
        jsonRes?.meta?.sessionToken ||
        jsonRes?.data?.attributes?.sessionToken ||
        null;

      if (inquiryId && !sessionToken) {
        sessionToken = await tryResumeInquiry(inquiryId);
      }
    } catch (err: any) {
      console.error('[CreatePersonaInquiry] Unexpected error:', err);
      return json({ error: err?.message || 'Failed to contact Persona service' }, 502);
    }
  }

  if (!inquiryId || !sessionToken) {
    return json({
      error: 'Could not generate a valid Persona verification session token.',
      inquiryId,
    }, 502);
  }

  // Update profile to record pending state with newly verified inquiryId
  await adminClient
    .from('profiles')
    .update({
      verification_status: 'pending',
      persona_inquiry_id: inquiryId,
      verification_updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  return json({
    success: true,
    userId: user.id,
    templateId,
    environment,
    inquiryId,
    sessionToken,
    referenceId: user.id,
  });
});
