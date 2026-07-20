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

        const { bookingId } = await req.json();

        if (!bookingId) {
            throw new Error("Missing bookingId");
        }

        // Get the booking
        const { data: booking } = await supabaseAdmin
            .from('bookings')
            .select('*, experiences!inner(user_id)')
            .eq('id', bookingId)
            .single();

        if (!booking) {
            throw new Error("Booking not found");
        }

        // Ensure the user trying to capture is either the guest (checking in) or the host (service complete)
        const isGuest = booking.user_id === user.id;
        const isHost = booking.experiences.user_id === user.id;

        if (!isGuest && !isHost) {
            throw new Error("You are not authorized to release this payment.");
        }

        if (!booking.stripe_payment_intent_id) {
            throw new Error("No Stripe Payment Intent attached to this booking.");
        }

        if (booking.status === 'captured') {
            return new Response(JSON.stringify({ success: true, message: "Already captured" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        });

        const intent = await stripe.paymentIntents.capture(booking.stripe_payment_intent_id);

        // Update booking status
        await supabaseAdmin
            .from('bookings')
            .update({ status: 'captured' })
            .eq('id', bookingId);

        return new Response(
            JSON.stringify({ success: true, intent }),
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
