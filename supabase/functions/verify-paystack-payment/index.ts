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
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        const { reference, booking_id } = await req.json();

        if (!reference) throw new Error("Missing transaction reference");

        const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
        if (!PAYSTACK_SECRET_KEY) throw new Error("Server configuration error");

        // 1. Verify with Paystack
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
        });

        const result = await response.json();

        if (!result.status || result.data.status !== 'success') {
            throw new Error(result.message || "Payment verification failed");
        }

        const txData = result.data;
        const totalAmount = txData.amount / 100;
        
        // 2. Calculate Platform Fee (10% Commission)
        const platformFee = totalAmount * 0.10;
        const hostAmount = totalAmount - platformFee;
        
        // 3. Update Booking
        const updateData: any = {
            status: 'paid',
            payment_reference: reference,
            platform_fee: platformFee,
            host_amount: hostAmount,
        };

        if (booking_id) {
            // 3. Update Booking Status
            const { data: booking, error: updateError } = await supabaseClient
                .from('bookings')
                .update(updateData)
                .eq('id', booking_id)
                .select('*, experiences(title, user_id)')
                .single();

            if (updateError) {
                console.error("Update Error:", updateError);
                throw updateError;
            }

            // 4. Trigger Emails (Background)
            if (booking) {
                try {
                    const guestId = booking.user_id;
                    const hostId = booking.experiences?.user_id;
                    const tripTitle = booking.experiences?.title || booking.trip_title;

                    // Fetch Emails separately for stability
                    const { data: guestProfile } = await supabaseClient.from('profiles').select('email, full_name').eq('id', guestId).single();
                    const { data: hostProfile } = await supabaseClient.from('profiles').select('email, full_name').eq('id', hostId).single();

                    const guestEmail = guestProfile?.email;
                    const hostEmail = hostProfile?.email;
                    const guestName = guestProfile?.full_name || 'Guest';
                    const hostName = hostProfile?.full_name || 'Host';
                    const dates = `${new Date(booking.check_in).toLocaleDateString()} - ${new Date(booking.check_out).toLocaleDateString()}`;

                    // Send Receipt to Guest
                    if (guestEmail) {
                        supabaseClient.functions.invoke('send-email', {
                            body: {
                                type: 'booking_receipt',
                                email: guestEmail,
                                data: { guestName, title: tripTitle, reference: booking.payment_reference, dates, guests: booking.guests, amount: booking.amount.toLocaleString() }
                            }
                        }).catch(e => console.error("Guest email failed", e));
                    }

                    // Send Notification to Host
                    if (hostEmail) {
                        supabaseClient.functions.invoke('send-email', {
                            body: {
                                type: 'booking_notification',
                                email: hostEmail,
                                data: { hostName, guestName, title: tripTitle, dates, guests: booking.guests, payoutAmount: booking.host_amount.toLocaleString() }
                            }
                        }).catch(e => console.error("Host email failed", e));
                    }
                } catch (emailErr) {
                    console.error("Email preparation error:", emailErr);
                }
            }
        }

        return new Response(
            JSON.stringify({ status: 'success', data: txData }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("Verification error:", error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
});
