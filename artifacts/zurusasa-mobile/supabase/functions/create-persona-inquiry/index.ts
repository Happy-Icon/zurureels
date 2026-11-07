/// <reference path="../deno.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PERSONA_API_BASE = 'https://api.withpersona.com/api/v1';

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

function extractSessionToken(payload: any): string | null {
  return (
    payload?.meta?.sessionToken ||
    payload?.meta?.['session-token'] ||
    payload?.data?.attributes?.sessionToken ||
    payload?.data?.attributes?.['session-token'] ||
    null
  );
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return json({ error: 'Authentication is required', code: 'UNAUTHENTICATED' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return json({ error: 'Authentication is required', code: 'UNAUTHENTICATED' }, 401);
  }

  const templateId = (
    Deno.env.get('PERSONA_TEMPLATE_ID') ||
    Deno.env.get('EXPO_PUBLIC_PERSONA_TEMPLATE_ID') ||
    ''
  ).trim();

  if (!templateId) {
    console.error('[CreatePersonaInquiry] PERSONA_TEMPLATE_ID is not configured in Supabase secrets');
    return json(
      {
        error: 'Identity verification template is not configured on the server.',
        code: 'MISSING_TEMPLATE_ID',
      },
      503,
    );
  }

  const isTemplateVersion = templateId.startsWith('itmplv_');
  const isTemplate = templateId.startsWith('itmpl_') && !isTemplateVersion;
  if (!isTemplate && !isTemplateVersion) {
    console.error('[CreatePersonaInquiry] Invalid PERSONA_TEMPLATE_ID prefix:', templateId);
    return json(
      {
        error: 'Identity verification template configuration is invalid (expected itmpl_... or itmplv_...).',
        code: 'INVALID_TEMPLATE_ID',
      },
      503,
    );
  }

  const personaApiKey = Deno.env.get('PERSONA_API_KEY')?.trim();
  if (!personaApiKey) {
    console.error('[CreatePersonaInquiry] PERSONA_API_KEY is not configured in Supabase secrets');
    return json(
      {
        error: 'Identity verification service credentials are not configured.',
        code: 'MISSING_API_KEY',
      },
      503,
    );
  }

  const explicitEnv = (
    Deno.env.get('PERSONA_ENVIRONMENT') ||
    Deno.env.get('EXPO_PUBLIC_PERSONA_ENVIRONMENT') ||
    ''
  )
    .toLowerCase()
    .trim();

  const environment: 'production' | 'sandbox' =
    explicitEnv === 'production'
      ? 'production'
      : explicitEnv === 'sandbox'
        ? 'sandbox'
        : personaApiKey.startsWith('persona_production_')
          ? 'production'
          : 'sandbox';

  const personaEnvironmentId = (Deno.env.get('PERSONA_ENVIRONMENT_ID') || '').trim();

  const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, full_name, email, phone, persona_inquiry_id, verification_status')
    .eq('id', user.id)
    .maybeSingle();

  let inquiryId: string | null = null;
  let sessionToken: string | null = null;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${personaApiKey}`,
    Accept: 'application/json',
    'Persona-Version': '2023-01-05',
    'Content-Type': 'application/json',
    'Key-Inflection': 'camel',
  };

  async function resumeInquirySession(id: string): Promise<string | null> {
    try {
      const resumeRes = await fetch(`${PERSONA_API_BASE}/inquiries/${encodeURIComponent(id)}/resume`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      if (!resumeRes.ok) {
        return null;
      }
      const resumeJson = await resumeRes.json();
      return extractSessionToken(resumeJson);
    } catch {
      return null;
    }
  }

  // 1. Only attempt to resume an existing inquiry when status is pending and inquiry matches active template & user
  if (
    profile?.verification_status === 'pending' &&
    profile?.persona_inquiry_id &&
    profile.persona_inquiry_id.startsWith('inq_')
  ) {
    try {
      const checkRes = await fetch(
        `${PERSONA_API_BASE}/inquiries/${encodeURIComponent(profile.persona_inquiry_id)}`,
        { headers },
      );

      if (checkRes.ok) {
        const checkJson = await checkRes.json();
        const attrs = checkJson?.data?.attributes ?? {};
        const ownerRef = String(attrs.referenceId ?? attrs['reference-id'] ?? attrs.reference_id ?? '');
        const existingStatus = String(attrs.status ?? '').toLowerCase().trim();
        const relTemplateId = String(
          checkJson?.data?.relationships?.inquiryTemplate?.data?.id ??
            checkJson?.data?.relationships?.['inquiry-template']?.data?.id ??
            '',
        );

        const isResumableStatus =
          existingStatus === 'created' || existingStatus === 'pending' || existingStatus === 'expired';
        const matchesTemplate = !isTemplate || !relTemplateId || relTemplateId === templateId;

        if (ownerRef === user.id && isResumableStatus && matchesTemplate) {
          const existingToken = await resumeInquirySession(profile.persona_inquiry_id);
          if (existingToken) {
            inquiryId = profile.persona_inquiry_id;
            sessionToken = existingToken;
          }
        }
      }
    } catch (resumeErr) {
      console.warn('[CreatePersonaInquiry] Existing inquiry check failed, creating new inquiry:', resumeErr);
    }
  }

  // 2. Create a fresh Persona inquiry if no resumable session exists
  if (!inquiryId || !sessionToken) {
    try {
      const fullName = (profile?.full_name || user.user_metadata?.full_name || '').trim();
      const parts = fullName.split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      const email = (profile?.email || user.email || '').trim();
      const phone = (profile?.phone || user.phone || '').trim();

      const baseAttributes: Record<string, unknown> = {
        ...(isTemplateVersion
          ? { inquiryTemplateVersionId: templateId }
          : { inquiryTemplateId: templateId }),
        referenceId: user.id,
      };

      if (personaEnvironmentId.startsWith('env_')) {
        baseAttributes.environmentId = personaEnvironmentId;
      }

      const fields: Record<string, string> = {};
      if (firstName) fields['name-first'] = firstName;
      if (lastName) fields['name-last'] = lastName;
      if (email) fields['email-address'] = email;
      if (phone) fields['phone-number'] = phone;

      const hasPrefillFields = Object.keys(fields).length > 0;
      const initialAttributes = hasPrefillFields ? { ...baseAttributes, fields } : baseAttributes;

      let res = await fetch(`${PERSONA_API_BASE}/inquiries`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ data: { attributes: initialAttributes } }),
      });

      // Fallback: if template schema rejects optional prefill fields (400/422), retry cleanly without fields
      if (!res.ok && hasPrefillFields && (res.status === 400 || res.status === 422)) {
        const prefillErrText = await res.text().catch(() => '');
        console.warn(
          '[CreatePersonaInquiry] Retrying inquiry creation without prefill fields after status',
          res.status,
          prefillErrText,
        );
        res = await fetch(`${PERSONA_API_BASE}/inquiries`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ data: { attributes: baseAttributes } }),
        });
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const resolvedEnvId = res.headers.get('persona-environment-id') || null;
        const resolvedOrgId = res.headers.get('persona-organization-id') || null;
        const personaRequestId = res.headers.get('request-id') || null;

        console.error('[CreatePersonaInquiry] Persona API creation failed:', {
          status: res.status,
          templateId,
          environment,
          resolvedEnvId,
          resolvedOrgId,
          personaRequestId,
          body: errText,
        });

        if (res.status === 404) {
          return json(
            {
              error:
                'Verification template was not found or is not published in the active Persona environment. Please ensure the template is published and matches your API key environment.',
              code: 'PERSONA_TEMPLATE_NOT_FOUND',
              personaStatus: 404,
              templateId,
              environmentId: resolvedEnvId,
              requestId: personaRequestId,
            },
            502,
          );
        }

        if (res.status === 401 || res.status === 403) {
          return json(
            {
              error: 'Identity verification credentials are unauthorized for this Persona environment.',
              code: 'PERSONA_AUTH_FAILED',
              personaStatus: res.status,
              environmentId: resolvedEnvId,
              requestId: personaRequestId,
            },
            502,
          );
        }

        return json(
          {
            error: `Could not create identity verification session (Persona status ${res.status}).`,
            code: 'PERSONA_CREATE_FAILED',
            personaStatus: res.status,
            environmentId: resolvedEnvId,
            requestId: personaRequestId,
          },
          502,
        );
      }

      const jsonRes = await res.json();
      inquiryId = jsonRes?.data?.id || null;
      sessionToken = extractSessionToken(jsonRes);

      if (inquiryId && !sessionToken) {
        sessionToken = await resumeInquirySession(inquiryId);
      }
    } catch (err: any) {
      console.error('[CreatePersonaInquiry] Unexpected error:', err);
      return json(
        {
          error: err?.message || 'Failed to contact Persona verification service.',
          code: 'PERSONA_NETWORK_ERROR',
        },
        502,
      );
    }
  }

  if (!inquiryId || !sessionToken) {
    return json(
      {
        error: 'Could not generate a valid Persona verification session token.',
        code: 'MISSING_SESSION_TOKEN',
        inquiryId,
      },
      502,
    );
  }

  // Record pending state with verified inquiryId
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
