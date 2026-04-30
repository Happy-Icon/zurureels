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
            .select('*, experiences(title, user_id)')
            .eq('id', booking_id)
            .single();

        if (fetchError || !booking) throw new Error("Booking not found");
        if (booking.status === 'cancelled') throw new Error("Booking already cancelled");
        if (!booking.payment_reference) throw new Error("No payment found for this booking");

        // Fetch Emails separately for stability
        const { data: guestProfile } = await supabaseClient.from('profiles').select('email, full_name').eq('id', booking.user_id).single();
        const { data: hostProfile } = await supabaseClient.from('profiles').select('email, full_name').eq('id', booking.experiences?.user_id).single();

        // 2. Process Refund via Paystack
        const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
        const refundResponse = await fetch('https://api.paystack.co/refund', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                transaction: booking.payment_reference,
            }),
        });

        const refundResult = await refundResponse.json();

        if (!refundResult.status) {
            throw new Error(refundResult.message || "Refund failed");
        }

        // 3. Update Booking Status
        const { error: updateError } = await supabaseClient
            .from('bookings')
            .update({
                status: 'cancelled',
                refund_id: refundResult.data.id.toString(),
                refunded_at: new Date().toISOString(),
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
                        amount: booking.amount.toLocaleString(),
                        refundId: refundResult.data.id
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

        return new Response(JSON.stringify({ status: 'success', refund: refundResult.data }), {
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
