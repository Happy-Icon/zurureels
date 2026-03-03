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

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const {
            data: { user },
        } = await supabaseClient.auth.getUser();

        if (!user) throw new Error("Unauthorized");

        const reqData = await req.json();
        const { amount, experienceId, hostId, reelId, tripTitle, checkIn, checkOut, guests } = reqData;

        if (!amount || !hostId) {
            throw new Error("Missing amount or hostId");
        }

        // Get host's stripe account ID
        const { data: hostProfile } = await supabaseAdmin
            .from('profiles')
            .select('stripe_account_id, stripe_onboarded')
            .eq('id', hostId)
            .single();

        if (!hostProfile?.stripe_account_id) {
            throw new Error("Host is not fully onboarded to receive payments.");
        }

        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        });

        // Assume amounts are passed in integer subunits (e.g., kobo for KES, cents for USD)
        // Application fee logic: e.g., 10% platform commission
        const applicationFeeAmount = Math.floor(amount * 0.10);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'kes', // Configure your currency
            capture_method: 'manual', // ESCROW FLOW: Authorize now, capture later
            application_fee_amount: applicationFeeAmount,
            transfer_data: {
                destination: hostProfile.stripe_account_id, // Transfer remainder to Host
            },
            metadata: {
                guestId: user.id,
                hostId,
                experienceId,
                reelId: reelId || '',
                tripTitle,
            },
        });

        return new Response(
            JSON.stringify({
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id
            }),
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
