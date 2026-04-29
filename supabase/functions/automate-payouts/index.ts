import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

Deno.serve(async (req) => {
    // This function can be triggered by a Cron Job (pg_cron)
    console.log("Starting automated payout processing...");

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Find all paid bookings that have ended but not yet been paid out
        const now = new Date().toISOString();
        const { data: bookings, error: fetchError } = await supabaseAdmin
            .from('bookings')
            .select(`
                *,
                experiences (
                    user_id
                )
            `)
            .eq('status', 'paid')
            .lt('check_out', now);

        if (fetchError) throw fetchError;
        if (!bookings || bookings.length === 0) {
            return new Response(JSON.stringify({ message: "No pending payouts found" }), { status: 200 });
        }

        console.log(`Processing ${bookings.length} payouts...`);

        const results = [];

        for (const booking of bookings) {
            try {
                const hostId = booking.experiences?.user_id;
                if (!hostId) {
                    console.error(`No host found for booking ${booking.id}`);
                    continue;
                }

                // 2. Get Host's Paystack Recipient Code
                const { data: hostProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('metadata')
                    .eq('id', hostId)
                    .single();

                const recipientCode = (hostProfile?.metadata as any)?.paystack_recipient_code;

                if (!recipientCode) {
                    console.error(`Host ${hostId} has no payout recipient code configured.`);
                    continue;
                }

                // 3. Initiate Paystack Transfer (90% of amount)
                const hostAmount = booking.host_amount || (booking.amount * 0.9);
                
                console.log(`Transferring KES ${hostAmount} to host ${hostId} for booking ${booking.id}`);

                const transferResponse = await fetch('https://api.paystack.co/transfer', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        source: "balance",
                        amount: Math.round(hostAmount * 100),
                        recipient: recipientCode,
                        reason: `Payout for Zuru Booking: ${booking.trip_title}`,
                        reference: `payout_${booking.id}_${Date.now()}`
                    }),
                });

                const transferResult = await transferResponse.json();

                if (!transferResult.status) {
                    throw new Error(transferResult.message || "Transfer initiation failed");
                }

                // 4. Update Booking Status
                await supabaseAdmin
                    .from('bookings')
                    .update({ status: 'disbursed' })
                    .eq('id', booking.id);

                results.push({ booking_id: booking.id, status: 'success', transfer_code: transferResult.data.transfer_code });

            } catch (err: any) {
                console.error(`Failed to process payout for booking ${booking.id}:`, err.message);
                results.push({ booking_id: booking.id, status: 'failed', error: err.message });
            }
        }

        return new Response(JSON.stringify({ results }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error: any) {
        console.error("Automated payout error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
