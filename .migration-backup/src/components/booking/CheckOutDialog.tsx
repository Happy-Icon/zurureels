import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Ticket } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";

// Initialize Stripe with public key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "pk_test_placeholder");

interface CheckOutDialogProps {
    tripTitle: string;
    amount: number;
    experienceId?: string;
    hostId?: string;
    reelId?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

const CheckoutForm = ({
    clientSecret,
    onSuccess,
    tripTitle,
    amount,
    experienceId,
    checkIn,
    checkOut,
    guests,
}: {
    clientSecret: string;
    onSuccess: () => void;
    tripTitle: string;
    amount: number;
    experienceId?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: number;
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setLoading(true);
        setErrorMessage("");

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: window.location.href, // Redirects are handled, but we also handle success below if redirect='if_required'
            },
            redirect: 'if_required',
        });

        if (error) {
            setErrorMessage(error.message || "An unexpected error occurred.");
            setLoading(false);
            toast.error(error.message || "Payment failed");
        } else if (paymentIntent && paymentIntent.status === "requires_capture") {
            toast.success("Payment authorized! Booking confirmed.");
            onSuccess();
        } else if (paymentIntent && paymentIntent.status === "succeeded") {
            toast.success("Payment successful! Booking confirmed.");
            onSuccess();
        } else {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement />
            {errorMessage && <div className="text-red-500 text-sm mt-2">{errorMessage}</div>}
            <Button type="submit" disabled={!stripe || loading} className="w-full text-lg h-11">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Authorize KES {amount?.toLocaleString()}
            </Button>
        </form>
    );
};

export const CheckOutDialog = ({
    tripTitle,
    amount,
    experienceId,
    hostId,
    reelId,
    checkIn,
    checkOut,
    guests = 1,
    trigger,
    onSuccess,
    open: controlledOpen,
    onOpenChange: setControlledOpen
}: CheckOutDialogProps) => {
    const { user } = useAuth();
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : internalOpen;
    const setIsOpen = isControlled ? setControlledOpen : setInternalOpen;
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [loadingIntent, setLoadingIntent] = useState(false);

    useEffect(() => {
        if (isOpen && user && !clientSecret && hostId) {
            const createIntent = async () => {
                setLoadingIntent(true);
                try {
                    const { data, error } = await supabase.functions.invoke('create-stripe-payment-intent', {
                        body: {
                            amount: amount * 100, // Stripe expects lowest denomination (e.g. kobo/cents)
                            hostId,
                            experienceId,
                            reelId,
                            tripTitle,
                            checkIn,
                            checkOut,
                            guests
                        }
                    });

                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);

                    setClientSecret(data.clientSecret);
                } catch (error: any) {
                    console.error("Failed to initialize payment intent:", error);
                    toast.error(error.message || "Failed to initialize payment");
                    setIsOpen(false);
                } finally {
                    setLoadingIntent(false);
                }
            };
            createIntent();
        }
    }, [isOpen, user, hostId]);

    const handleSuccess = () => {
        setIsOpen(false);
        onSuccess?.();
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || <Button>Book Now</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Confirm Booking</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Summary */}
                    <div className="bg-secondary/20 p-4 rounded-lg space-y-3">
                        <div className="flex items-start gap-3">
                            <Ticket className="h-5 w-5 text-primary mt-0.5" />
                            <div>
                                <h3 className="font-medium">{tripTitle}</h3>
                                <p className="text-2xl font-bold text-primary mt-1">KES {amount?.toLocaleString()}</p>
                            </div>
                        </div>
                        {checkIn && (
                            <div className="text-sm text-muted-foreground flex gap-4 pl-8">
                                <div>
                                    <span className="block text-xs font-semibold">Check-in</span>
                                    {new Date(checkIn).toLocaleDateString()}
                                </div>
                                {checkOut && (
                                    <div>
                                        <span className="block text-xs font-semibold">Check-out</span>
                                        {new Date(checkOut).toLocaleDateString()}
                                    </div>
                                )}
                                <div>
                                    <span className="block text-xs font-semibold">Guests</span>
                                    {guests}
                                </div>
                            </div>
                        )}
                    </div>

                    {loadingIntent ? (
                        <div className="flex flex-col items-center justify-center py-6">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                            <p className="text-sm text-muted-foreground">Initializing secure payment...</p>
                        </div>
                    ) : clientSecret ? (
                        <Elements stripe={stripePromise} options={{ clientSecret }}>
                            <CheckoutForm
                                clientSecret={clientSecret}
                                onSuccess={handleSuccess}
                                tripTitle={tripTitle}
                                amount={amount}
                                experienceId={experienceId}
                                checkIn={checkIn}
                                checkOut={checkOut}
                                guests={guests}
                            />
                        </Elements>
                    ) : (
                        <div className="text-center py-4 text-red-500 text-sm">
                            Requires host to be fully onboarded to receive payments.
                        </div>
                    )}
                </div>

            </DialogContent>
        </Dialog>
    );
};
