import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { status: 200 });
    }

    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
        return new Response('No signature', { status: 401 });
    }

    const body = await req.text();
    
    // Verify Signature
    // For simplicity in this environment, I'll use a standard crypto check if possible,
    // but Paystack uses HMAC SHA512.
    // In Deno, we can use the 'crypto' module.
    
    // Skip signature check for now if testing, but in production this is MUST.
    // Let's implement it properly.
    
    const hmac = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(PAYSTACK_SECRET_KEY),
        { name: "HMAC", hash: "SHA-512" },
        false,
        ["sign"]
    );
    const signed = await crypto.subtle.sign(
        "HMAC",
        hmac,
        new TextEncoder().encode(body)
    );
    const expectedSignature = Array.from(new Uint8Array(signed))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    if (signature !== expectedSignature) {
        console.error("Invalid signature");
        return new Response('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(body);
    console.log(`Paystack Webhook Received: ${event.event}`);

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (event.event === 'charge.success') {
        const data = event.data;
        const reference = data.reference;
        const amount = data.amount / 100;
        const fees = data.fees / 100; // This includes our split if subaccount was used correctly
        
        // Find booking by reference
        const { data: booking } = await supabaseAdmin
            .from('bookings')
            .select('*')
            .eq('payment_reference', reference)
            .maybeSingle();

        if (booking) {
            const totalAmount = amount;
            const platformFee = totalAmount * 0.10;
            const hostAmount = totalAmount - platformFee;

            // 1. Update Booking
            const { data: updatedBooking, error: updateError } = await supabaseAdmin
                .from('bookings')
                .update({ 
                    status: 'paid',
                    platform_fee: platformFee,
                    host_amount: hostAmount
                })
                .eq('id', booking.id)
                .select(`
                    *,
                    guest:profiles!bookings_user_id_fkey (email, full_name),
                    experience:experiences (
                        title,
                        host:profiles (email, full_name)
                    )
                `)
                .single();

            if (updateError) {
                console.error("Webhook update error:", updateError);
            }

            // 2. Trigger Emails
            if (updatedBooking) {
                const guestEmail = updatedBooking.guest?.email;
                const hostEmail = updatedBooking.experience?.host?.email;
                const guestName = updatedBooking.guest?.full_name || 'Guest';
                const hostName = updatedBooking.experience?.host?.full_name || 'Host';
                const tripTitle = updatedBooking.experience?.title || updatedBooking.trip_title;
                const dates = `${new Date(updatedBooking.check_in).toLocaleDateString()} - ${new Date(updatedBooking.check_out).toLocaleDateString()}`;

                // Send Receipt to Guest
                if (guestEmail) {
                    await supabaseAdmin.functions.invoke('send-email', {
                        body: {
                            type: 'booking_receipt',
                            email: guestEmail,
                            data: { guestName, title: tripTitle, reference: updatedBooking.payment_reference, dates, guests: updatedBooking.guests, amount: updatedBooking.amount.toLocaleString() }
                        }
                    }).catch(e => console.error("Guest email failed", e));
                }

                // Send Notification to Host
                if (hostEmail) {
                    await supabaseAdmin.functions.invoke('send-email', {
                        body: {
                            type: 'booking_notification',
                            email: hostEmail,
                            data: { hostName, guestName, title: tripTitle, dates, guests: updatedBooking.guests, payoutAmount: updatedBooking.host_amount.toLocaleString() }
                        }
                    }).catch(e => console.error("Host email failed", e));
                }
            }
        }
    }

    return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
});
