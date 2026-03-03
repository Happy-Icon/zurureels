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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_account_id, email, full_name, verification_status')
      .eq('id', user.id)
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
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'KE', // Or let this be dynamic based on user profile
        email: profile.email || user.email,
        business_type: 'individual',
        capabilities: {
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      // Save to profile using service role to bypass RLS if necessary, 
      // but user can update their own profile usually.
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', user.id);
    }

    // Determine the origin URL for return loops
    const reqUrl = new URL(req.url);
    const origin = req.headers.get('origin') || `${reqUrl.protocol}//${reqUrl.host}`;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/host/onboarding/refresh`,
      return_url: `${origin}/host/dashboard?onboarded=true`,
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
