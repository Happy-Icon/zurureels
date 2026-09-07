/// <reference path="../deno.d.ts" />

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
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY') || Deno.env.get('EXPO_PUBLIC_RESEND_API_KEY');
  if (!resendApiKey) {
    console.error('[SendEmail] RESEND_API_KEY is not set in Supabase Edge Function secrets');
    return json({ error: 'RESEND_API_KEY secret is not configured in Supabase' }, 500);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { to, subject, html, from } = body;

  if (!to || !subject || !html) {
    return json({ error: 'Missing required fields: to, subject, html' }, 400);
  }

  const defaultFrom = Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM') || 'ZuruSasa <onboarding@resend.dev>';
  const fromAddress = from || defaultFrom;
  const toList = Array.isArray(to) ? to : [to];

  console.log(`[SendEmail] Dispatching to ${toList.join(', ')} | Subject: "${subject}" | From: ${fromAddress}`);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: toList,
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[SendEmail] Resend API error:', data);
      return json({ error: data?.message || 'Failed to send email via Resend', details: data }, response.status);
    }

    console.log(`[SendEmail] Successfully dispatched email. Message ID: ${data?.id}`);
    return json({ success: true, id: data?.id });
  } catch (err: any) {
    console.error('[SendEmail] Exception calling Resend API:', err);
    return json({ error: err?.message || 'Internal network error sending email' }, 500);
  }
});
