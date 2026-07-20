import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

Deno.serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 });
    }

    try {
        // 2. Initialize Supabase
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        // 3. Authenticate User
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
        if (authError || !user) {
            console.error("Auth error:", authError);
            throw new Error("Unauthorized");
        }

        // 4. Parse Request Payload
        const { phone, amount, experience_id, trip_title, guests, check_in, check_out } = await req.json();

        if (!phone) throw new Error("M-Pesa phone number is required");
        if (!amount) throw new Error("Amount is required");
        if (!experience_id) throw new Error("Experience ID is required");

        const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
        if (!PAYSTACK_SECRET_KEY) {
            console.error("Server configuration error: PAYSTACK_SECRET_KEY missing");
            throw new Error("Server configuration error");
        }

        // Clean phone number (remove spaces, resolve country code, format as +254XXXXXXXXX)
        let formattedPhone = phone.replace(/[\s]/g, '');
        if (formattedPhone.startsWith('+0')) {
            formattedPhone = '+254' + formattedPhone.substring(2);
        } else if (formattedPhone.startsWith('0')) {
            formattedPhone = '+254' + formattedPhone.substring(1);
        } else if (formattedPhone.startsWith('+254')) {
            // Already correct format
        } else if (formattedPhone.startsWith('254')) {
            formattedPhone = '+' + formattedPhone;
        } else {
            formattedPhone = '+254' + formattedPhone;
        }

        console.log(`Initiating M-Pesa STK Push via Paystack for ${user.email} - Phone: ${formattedPhone} - Amount: KES ${amount}`);

        // 5. Query Host's Subaccount
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

        // 6. Request Paystack Mobile Money Charge
        const response = await fetch('https://api.paystack.co/charge', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: user.email,
                amount: Math.round(amount * 100), // convert to cents/kobo
                currency: "KES",
                mobile_money: {
                    phone: formattedPhone,
                    provider: "mpesa"
                },
                subaccount: subaccount,
                metadata: {
                    experience_id,
                    guest_id: user.id
                }
            }),
        });

        const result = await response.json();
        console.log("Paystack Charge Response:", JSON.stringify(result));

        if (!result.status) {
            throw new Error(result.message || "Failed to initiate mobile money charge");
        }

        // 7. Calculate platform fee & host payout split
        const platformFee = amount * 0.10;
        const hostAmount = amount - platformFee;

        // 8. Create a pending Booking Record
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
                status: 'pending', // Will be set to 'paid' when webhook triggers success
                payment_reference: result.data.reference
            })
            .select()
            .single();

        if (bookingError) {
            console.error("Failed to insert booking record:", bookingError);
            throw bookingError;
        }

        return new Response(
            JSON.stringify({ status: 'success', booking, paystack: result.data }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("STK Charge Error:", error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
});
