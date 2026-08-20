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

  const adminClient = createClient(url, serviceRoleKey);

  // Retrieve user profile
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, full_name, email, phone, persona_inquiry_id, verification_status')
    .eq('id', user.id)
    .maybeSingle();

  const templateId =
    Deno.env.get('PERSONA_TEMPLATE_ID') ||
    Deno.env.get('EXPO_PUBLIC_PERSONA_TEMPLATE_ID') ||
    'itmpl_AJxvLiJ8gyboBkPzg2AWNLZrUAik5z';

  const rawEnv =
    Deno.env.get('PERSONA_ENVIRONMENT') ||
    Deno.env.get('EXPO_PUBLIC_PERSONA_ENVIRONMENT') ||
    'sandbox';
  const environment = rawEnv.toLowerCase().trim() === 'production' ? 'production' : 'sandbox';

  const personaApiKey = Deno.env.get('PERSONA_API_KEY');

  let inquiryId: string | null = null;
  let sessionToken: string | null = null;

  // If server-side Persona API key is configured, create or resume inquiry via Persona REST API
  if (personaApiKey) {
    try {
      const fullName = (profile?.full_name || user.user_metadata?.full_name || '').trim();
      const parts = fullName.split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      const email = profile?.email || user.email || '';
      const phone = profile?.phone || user.phone || '';

      const personaEndpoint = 'https://withpersona.com/api/v1/inquiries';
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

      const res = await fetch(personaEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${personaApiKey}`,
          'Persona-Version': '2023-01-05',
          'Content-Type': 'application/json',
          'Key-Inflection': 'camel',
        },
        body: JSON.stringify(personaPayload),
      });

      if (res.ok) {
        const jsonRes = await res.json();
        inquiryId = jsonRes?.data?.id || null;
        sessionToken = jsonRes?.data?.attributes?.sessionToken || null;
      } else {
        const errText = await res.text();
        console.warn('Persona API inquiry creation notice:', errText);
      }
    } catch (err) {
      console.warn('Persona REST call error:', err);
    }
  }

  // Update profile with pending status
  await adminClient
    .from('profiles')
    .update({
      verification_status: 'pending',
      persona_inquiry_id: inquiryId || profile?.persona_inquiry_id || null,
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
