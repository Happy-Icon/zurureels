import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) throw new Error("Unauthorized");

        const { method_id, amount, experience_id, trip_title, guests, check_in, check_out } = await req.json();

        // 1. Get Authorization Code
        const { data: method, error: methodError } = await supabaseClient
            .from('payment_methods')
            .select('*')
            .eq('id', method_id)
            .single();

        if (methodError || !method) throw new Error("Payment method not found");

        // 2. Get Host Subaccount
        const { data: experience } = await supabaseClient
            .from('experiences')
            .select('user_id')
            .eq('id', experience_id)
            .single();
        
        let subaccount = undefined;
        if (experience?.user_id) {
            const { data: hostProfile } = await supabaseClient
                .from('profiles')
                .select('metadata')
                .eq('id', experience.user_id)
                .single();
            subaccount = (hostProfile?.metadata as any)?.paystack_subaccount_code;
        }

        const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
        if (!PAYSTACK_SECRET_KEY) throw new Error("Server configuration error");

        // 3. Charge Paystack
        const response = await fetch('https://api.paystack.co/transaction/charge_authorization', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: user.email,
                amount: Math.round(amount * 100),
                authorization_code: method.authorization_code,
                subaccount: subaccount,
                metadata: {
                    experience_id,
                    guest_id: user.id
                }
            }),
        });

        const result = await response.json();

        if (!result.status) {
            throw new Error(result.message || "Charge failed");
        }

        // 4. Create Booking
        const platformFee = amount * 0.10;
        const hostAmount = amount - platformFee;

        const { data: booking, error: bookingError } = await supabaseClient
            .from('bookings')
            .insert({
                user_id: user.id,
                experience_id: experience_id,
                trip_title: trip_title,
                amount: amount,
                platform_fee: platformFee,
                host_amount: hostAmount,
                guests: guests,
                check_in: check_in,
                check_out: check_out,
                status: result.data.status === 'success' ? 'paid' : 'pending',
                payment_reference: result.data.reference
            })
            .select()
            .single();

        if (bookingError) throw bookingError;

        return new Response(
            JSON.stringify({ status: 'success', booking, paystack: result.data }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("Charge error:", error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
});
