import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("Function started");

    // Get user from JWT payload - edge runtime already validated it
    const authHeader = req.headers.get('Authorization');
    console.log("Auth header:", authHeader ? "present" : "missing");

    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Decode JWT payload (base64)
    const token = authHeader.replace('Bearer ', '');
    console.log("Token parts:", token.split('.').length);

    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log("Payload:", JSON.stringify(payload));

    const userId = payload.sub;
    console.log("User ID:", userId);

    if (!userId) {
      throw new Error('No user ID in token');
    }

    // Use service role for database queries
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, email, full_name, verification_status')
      .eq('id', userId)
      .single();

    if (profile?.verification_status !== 'verified') {
      throw new Error("You must complete identity verification before setting up payouts.");
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    let accountId = profile.stripe_account_id;

    if (!accountId) {
      // Create a Connect account
      // For Kenya (KE), we need recipient service agreement for cross-border transfers
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'KE',
        email: profile.email,
        business_type: 'individual',
        capabilities: {
          transfers: { requested: true },
        },
        tos_acceptance: {
          service_agreement: 'recipient',
        },
      });
      accountId = account.id;

      // Save to profile
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', userId);
    }

    // Determine the origin URL for return loops
    const reqUrl = new URL(req.url);
    const origin = req.headers.get('origin') || `${reqUrl.protocol}//${reqUrl.host}`;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/host`,
      return_url: `${origin}/host?onboarded=true`,
      type: 'account_onboarding',
    });

    return new Response(
      JSON.stringify({ url: accountLink.url }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
