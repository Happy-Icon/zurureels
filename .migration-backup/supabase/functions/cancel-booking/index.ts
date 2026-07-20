import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { booking_id } = await req.json();

        // 1. Get Booking details
        const { data: booking, error: fetchError } = await supabaseClient
            .from('bookings')
            .select('*, experiences(title, user_id, metadata)')
            .eq('id', booking_id)
            .single();

        if (fetchError || !booking) throw new Error("Booking not found");
        if (booking.status === 'cancelled') throw new Error("Booking already cancelled");
        if (!booking.payment_reference) throw new Error("No payment found for this booking");

        // Fetch Emails separately for stability
        const { data: guestProfile } = await supabaseClient.from('profiles').select('email, full_name').eq('id', booking.user_id).single();
        const { data: hostProfile } = await supabaseClient.from('profiles').select('email, full_name').eq('id', booking.experiences?.user_id).single();

        // Calculate Refund Percentage based on time to check-in
        const now = new Date();
        const checkIn = new Date(booking.check_in);
        const hoursToCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);

        let refundPercentage = 1.0; // Default 100% refund
        let policyName = "Flexible (Full Refund > 24h)";

        // Read policy from metadata if present
        const policy = booking.experiences?.metadata?.cancellation_policy || 'flexible';

        if (policy === 'strict') {
            policyName = "Strict (No refund < 7 days)";
            if (hoursToCheckIn < 168) { // 7 days
                refundPercentage = 0.0; // 0% refund
            }
        } else if (policy === 'moderate') {
            policyName = "Moderate (50% refund < 5 days)";
            if (hoursToCheckIn < 120) { // 5 days
                refundPercentage = 0.5;
            }
        } else {
            // Flexible policy (default)
            if (hoursToCheckIn < 24) {
                refundPercentage = 0.5; // 50% refund if cancelled late
            }
        }

        const refundAmount = booking.amount * refundPercentage;
        console.log(`Cancelling booking ${booking_id}. Hours to check-in: ${hoursToCheckIn.toFixed(1)}. Policy: ${policyName}. Refund: KES ${refundAmount} (${refundPercentage * 100}%)`);

        let refundResult = null;
        if (refundAmount > 0) {
            // Process Refund via Paystack
            const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
            const refundResponse = await fetch('https://api.paystack.co/refund', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transaction: booking.payment_reference,
                    amount: Math.round(refundAmount * 100), // in cents/kobo
                }),
            });

            refundResult = await refundResponse.json();

            if (!refundResult.status) {
                throw new Error(refundResult.message || "Refund failed");
            }
        }

        // Calculate updated host split & platform commission for the remaining balance
        const remainingBalance = booking.amount - refundAmount;
        const platformFee = remainingBalance * 0.10;
        const hostAmount = remainingBalance - platformFee;

        // 3. Update Booking Status & Financial Splits
        const { error: updateError } = await supabaseClient
            .from('bookings')
            .update({
                status: 'cancelled',
                refund_id: refundResult ? refundResult.data.id.toString() : 'no_refund',
                refunded_at: new Date().toISOString(),
                refund_amount: refundAmount,
                platform_fee: platformFee,
                host_amount: hostAmount
            })
            .eq('id', booking_id);

        if (updateError) throw updateError;

        // 4. Send Emails
        const guestEmail = guestProfile?.email;
        const hostEmail = hostProfile?.email;
        const tripTitle = booking.experiences?.title || booking.trip_title;
        const dates = `${new Date(booking.check_in).toLocaleDateString()} - ${new Date(booking.check_out).toLocaleDateString()}`;

        if (guestEmail) {
            await supabaseClient.functions.invoke('send-email', {
                body: {
                    type: 'refund_confirmation',
                    email: guestEmail,
                    data: {
                        guestName: guestProfile?.full_name || 'Guest',
                        title: tripTitle,
                        amount: refundAmount.toLocaleString(),
                        refundId: refundResult ? refundResult.data.id : 'N/A'
                    }
                }
            }).catch(e => console.error("Guest cancel email failed", e));
        }

        if (hostEmail) {
            await supabaseClient.functions.invoke('send-email', {
                body: {
                    type: 'cancellation_notification',
                    email: hostEmail,
                    data: {
                        hostName: hostProfile?.full_name || 'Host',
                        guestName: guestProfile?.full_name || 'Guest',
                        title: tripTitle,
                        dates
                    }
                }
            }).catch(e => console.error("Host cancel email failed", e));
        }

        return new Response(JSON.stringify({ status: 'success', refund: refundResult ? refundResult.data : null }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
