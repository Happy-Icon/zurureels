import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.16.0?target=deno";

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
    const signature = req.headers.get('Stripe-Signature');

    if (!signature) {
        return new Response("No signature provided", { status: 400 });
    }

    const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!endpointSecret) {
        console.error("No STRIPE_WEBHOOK_SECRET set");
        return new Response("Webhook secret not configured", { status: 500 });
    }

    const body = await req.text();
    let event;

    try {
        event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            endpointSecret,
            undefined,
            cryptoProvider
        );
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                console.log(`PaymentIntent for ${paymentIntent.amount} was successful, awaiting capture!`);

                // Setup initial booking variables
                const guestId = paymentIntent.metadata?.guestId;
                const hostId = paymentIntent.metadata?.hostId;
                const experienceId = paymentIntent.metadata?.experienceId;
                const reelId = paymentIntent.metadata?.reelId;
                const tripTitle = paymentIntent.metadata?.tripTitle || 'Booking';
                const amount = paymentIntent.amount;
                // In reality, platform fee is application_fee_amount
                const platformFee = paymentIntent.application_fee_amount || 0;
                const hostAmount = amount - platformFee;

                if (guestId && experienceId) {
                    // Check if booking already exists (in case UI inserted it first)
                    const { data: existingBooking } = await supabaseAdmin
                        .from('bookings')
                        .select('id')
                        .eq('stripe_payment_intent_id', paymentIntent.id)
                        .maybeSingle();

                    if (existingBooking) {
                        // Update existing
                        await supabaseAdmin
                            .from('bookings')
                            .update({ status: 'authorized' })
                            .eq('id', existingBooking.id);
                    } else {
                        // Create new uncaptured (authorized) booking
                        await supabaseAdmin
                            .from('bookings')
                            .insert({
                                user_id: guestId,
                                experience_id: experienceId,
                                reel_id: reelId || null,
                                trip_title: tripTitle,
                                amount: amount / 100, // Assuming amount was calculated in kobo/cents initially
                                platform_fee: platformFee / 100,
                                host_amount: hostAmount / 100,
                                stripe_payment_intent_id: paymentIntent.id,
                                status: 'authorized',
                                // To do: add check_in logic to webhook if required, but ideally 
                                // the frontend inserts the row with status 'pending_payment' and 
                                // the webhook just updates it to 'authorized'. Look at CheckOutDialog.
                            });
                    }
                }
                break;
            }

            case 'payment_intent.canceled': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                await supabaseAdmin
                    .from('bookings')
                    .update({ status: 'canceled' })
                    .eq('stripe_payment_intent_id', paymentIntent.id);
                break;
            }

            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                await supabaseAdmin
                    .from('bookings')
                    .update({ status: 'failed' })
                    .eq('stripe_payment_intent_id', paymentIntent.id);
                break;
            }

            case 'charge.refunded': {
                const charge = event.data.object as Stripe.Charge;
                if (charge.payment_intent) {
                    await supabaseAdmin
                        .from('bookings')
                        .update({ status: 'refunded' })
                        .eq('stripe_payment_intent_id', charge.payment_intent);
                }
                break;
            }

            case 'account.updated': {
                const account = event.data.object as Stripe.Account;
                if (account.details_submitted && account.charges_enabled) {
                    await supabaseAdmin
                        .from('profiles')
                        .update({ stripe_onboarded: true })
                        .eq('stripe_account_id', account.id);
                }
                break;
            }

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (err: any) {
        console.error(`Error processing webhook: ${err.message}`);
        return new Response(`Error processing webhook: ${err.message}`, { status: 500 });
    }
});
