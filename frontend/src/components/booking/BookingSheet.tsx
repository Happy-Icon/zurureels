import { useState } from "react";
import { format, addDays, differenceInDays, isBefore, startOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    MapPin, Users, CalendarDays, CreditCard, Loader2,
    ShieldCheck, Star, ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

// ── Stripe Payment Form ───────────────────────────────────────────────────────
function StripePaymentForm({
    amount,
    onSuccess,
    onCancel,
}: {
    amount: number;
    onSuccess: () => void;
    onCancel: () => void;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [paying, setPaying] = useState(false);

    const handlePay = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setPaying(true);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            redirect: "if_required",
        });

        if (error) {
            toast.error(error.message || "Payment failed. Please try again.");
            setPaying(false);
        } else if (
            paymentIntent?.status === "requires_capture" ||
            paymentIntent?.status === "succeeded"
        ) {
            toast.success("Payment authorized! Your booking is confirmed 🎉");
            onSuccess();
        } else {
            toast.error("Unexpected payment status. Please try again.");
            setPaying(false);
        }
    };

    return (
        <form onSubmit={handlePay} className="space-y-5">
            <div className="border rounded-2xl p-4 bg-secondary/5">
                <PaymentElement
                    options={{
                        layout: "tabs",
                        paymentMethodOrder: ["card", "apple_pay", "google_pay"],
                    }}
                />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
                <span>Secured by Stripe. Your payment details are encrypted.</span>
            </div>

            <div className="flex gap-3 pt-1">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    className="flex-1 rounded-xl"
                    disabled={paying}
                >
                    Back
                </Button>
                <Button
                    type="submit"
                    className="flex-1 h-12 font-semibold rounded-xl text-base"
                    disabled={paying}
                >
                    {paying ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
                    ) : (
                        <><CreditCard className="mr-2 h-4 w-4" /> Pay KES {amount.toLocaleString()}</>
                    )}
                </Button>
            </div>
        </form>
    );
}

// ── Main BookingSheet ─────────────────────────────────────────────────────────
export interface BookingSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    experienceId?: string;
    reelId?: string;
    hostId?: string;
    title: string;
    location: string;
    price: number;
    priceUnit: string;
    rating?: number;
    imageUrl?: string;
    category?: string;
    availableDays?: number[];
    onSuccess?: () => void;
}

type Step = "details" | "payment";

export function BookingSheet({
    open,
    onOpenChange,
    experienceId,
    reelId,
    hostId,
    title,
    location,
    price,
    priceUnit,
    rating,
    imageUrl,
    category,
    availableDays,
    onSuccess,
}: BookingSheetProps) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    const [step, setStep] = useState<Step>("details");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [guests, setGuests] = useState(1);
    const [showCalendar, setShowCalendar] = useState(false);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
    const [creatingIntent, setCreatingIntent] = useState(false);

    const today = startOfDay(new Date());
    const nights =
        dateRange?.from && dateRange?.to
            ? Math.max(1, differenceInDays(dateRange.to, dateRange.from))
            : 1;

    const isNightBased = ["hotel", "villa", "apartment"].includes(category || "");
    const units = isNightBased ? nights : guests;
    const total = price * units;

    const isDisabled = (date: Date) => {
        if (isBefore(date, today)) return true;
        if (availableDays && availableDays.length > 0) {
            return !availableDays.includes(date.getDay());
        }
        return false;
    };

    const handleProceedToPayment = async () => {
        if (!user) {
            toast.error("Please sign in to book");
            onOpenChange(false);
            navigate("/auth");
            return;
        }

        if (!dateRange?.from) {
            toast.error("Please select your dates first");
            return;
        }

        if (!hostId) {
            toast.error("This listing doesn't have a host configured yet.");
            return;
        }

        setCreatingIntent(true);
        try {
            const { data, error } = await supabase.functions.invoke(
                "create-stripe-payment-intent",
                {
                    body: {
                        amount: Math.round(total * 100),
                        experienceId,
                        hostId,
                        reelId,
                        tripTitle: title,
                        checkIn: dateRange.from.toISOString(),
                        checkOut: (dateRange.to || addDays(dateRange.from, 1)).toISOString(),
                        guests,
                    },
                }
            );

            if (error) throw new Error(error.message || "Failed to create payment.");
            if (!data?.clientSecret) throw new Error("No client secret returned from server.");

            setClientSecret(data.clientSecret);
            setPaymentIntentId(data.paymentIntentId);
            setStep("payment");

        } catch (err: any) {
            toast.error(err.message || "Could not initialize payment. Try again.");
        } finally {
            setCreatingIntent(false);
        }
    };

    const handlePaymentSuccess = async () => {
        try {
            const isUUID = (id?: string) =>
                !!id &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

            if (isUUID(experienceId)) {
                await supabase.from("bookings").insert({
                    user_id: user?.id,
                    experience_id: experienceId,
                    trip_title: title,
                    amount: total,
                    guests,
                    check_in: dateRange?.from?.toISOString() || new Date().toISOString(),
                    check_out: (
                        dateRange?.to || addDays(dateRange?.from || new Date(), 1)
                    ).toISOString(),
                    status: "authorized",
                    stripe_payment_intent_id: paymentIntentId,
                });
            }
        } catch (err) {
            console.error("Booking record error:", err);
        }

        handleClose();
        onSuccess?.();
    };

    const handleClose = () => {
        onOpenChange(false);
        setTimeout(() => {
            setStep("details");
            setDateRange(undefined);
            setClientSecret(null);
            setPaymentIntentId(null);
        }, 300);
    };

    return (
        <Sheet open={open} onOpenChange={handleClose}>
            <SheetContent
                side={isMobile ? "bottom" : "right"}
                className={cn(
                    "overflow-y-auto p-0 transition-all duration-500",
                    isMobile 
                        ? "h-[92dvh] w-full rounded-t-3xl" 
                        : "h-screen w-[450px] sm:max-w-[450px] border-l border-border"
                )}
            >
                {imageUrl && (
                    <div className="relative h-44 w-full overflow-hidden flex-shrink-0">
                        <img
                            src={imageUrl}
                            alt={title}
                            className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4">
                            {category && (
                                <Badge className="text-xs capitalize mb-1 bg-primary/80 border-0">
                                    {category}
                                </Badge>
                            )}
                            <h2 className="text-lg font-display font-bold text-white line-clamp-2">
                                {title}
                            </h2>
                            <div className="flex items-center gap-3 text-white/80 text-xs mt-1">
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {location}
                                </span>
                                {rating && (
                                    <span className="flex items-center gap-1">
                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                        {rating.toFixed(1)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-5 space-y-5">
                    {!imageUrl && (
                        <SheetHeader>
                            <SheetTitle className="text-xl font-display">{title}</SheetTitle>
                            <div className="flex items-center gap-3 text-muted-foreground text-sm">
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {location}
                                </span>
                                {rating && (
                                    <span className="flex items-center gap-1">
                                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                        {rating.toFixed(1)}
                                    </span>
                                )}
                            </div>
                        </SheetHeader>
                    )}

                    {step === "details" && (
                        <>
                            <div className="space-y-2">
                                <p className="font-semibold text-sm">Select Dates</p>
                                <button
                                    onClick={() => setShowCalendar(!showCalendar)}
                                    className="w-full flex items-center justify-between border rounded-xl p-3.5 hover:bg-secondary/20 transition-colors"
                                >
                                    <div className="flex items-center gap-2 text-sm">
                                        <CalendarDays className="h-4 w-4 text-primary" />
                                        {dateRange?.from ? (
                                            <span>
                                                {format(dateRange.from, "MMM d")}
                                                {dateRange.to
                                                    ? ` → ${format(dateRange.to, "MMM d, yyyy")}`
                                                    : " → End date?"}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                Choose your dates
                                            </span>
                                        )}
                                    </div>
                                    {showCalendar ? (
                                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </button>

                                {showCalendar && (
                                    <div className="border rounded-xl overflow-hidden">
                                        <Calendar
                                            mode="range"
                                            selected={dateRange}
                                            onSelect={(range) => {
                                                setDateRange(range);
                                                if (range?.from && range?.to) setShowCalendar(false);
                                            }}
                                            disabled={isDisabled}
                                            fromDate={today}
                                            toDate={addDays(today, 365)}
                                            numberOfMonths={1}
                                            className="mx-auto"
                                        />
                                        {availableDays && availableDays.length > 0 && (
                                            <p className="text-xs text-center text-muted-foreground py-2 border-t">
                                                Available:{" "}
                                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
                                                    .filter((_, i) => availableDays.includes(i))
                                                    .join(", ")}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <p className="font-semibold text-sm">Guests</p>
                                <div className="flex items-center justify-between border rounded-xl p-3.5">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Users className="h-4 w-4 text-primary" />
                                        <span>
                                            {guests} Guest{guests > 1 ? "s" : ""}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setGuests(Math.max(1, guests - 1))}
                                            className="h-8 w-8 rounded-full border flex items-center justify-center text-lg font-medium hover:bg-secondary transition-colors disabled:opacity-40"
                                            disabled={guests <= 1}
                                        >
                                            −
                                        </button>
                                        <span className="w-4 text-center font-semibold">
                                            {guests}
                                        </span>
                                        <button
                                            onClick={() => setGuests(Math.min(20, guests + 1))}
                                            className="h-8 w-8 rounded-full border flex items-center justify-center text-lg font-medium hover:bg-secondary transition-colors"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {dateRange?.from && (
                                <div className="bg-secondary/20 rounded-xl p-4 space-y-2 text-sm">
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>
                                            KES {price.toLocaleString()} ×{" "}
                                            {isNightBased
                                                ? `${nights} night${nights > 1 ? "s" : ""}`
                                                : `${guests} guest${guests > 1 ? "s" : ""}`}
                                        </span>
                                        <span>KES {total.toLocaleString()}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between font-bold text-base">
                                        <span>Total</span>
                                        <span className="text-primary">
                                            KES {total.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <Button
                                onClick={handleProceedToPayment}
                                disabled={!dateRange?.from || creatingIntent}
                                className="w-full h-12 text-base font-semibold rounded-xl"
                            >
                                {creatingIntent ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Setting up payment…
                                    </>
                                ) : (
                                    <>
                                        <ArrowRight className="mr-2 h-4 w-4" />
                                        Continue to Payment
                                    </>
                                )}
                            </Button>

                            {!user && (
                                <p className="text-center text-xs text-muted-foreground">
                                    You'll be asked to sign in before payment.
                                </p>
                            )}
                        </>
                    )}

                    {step === "payment" && clientSecret && (
                        <>
                            <div className="bg-secondary/20 rounded-xl p-4 text-sm space-y-1">
                                <p className="font-semibold">{title}</p>
                                <p className="text-muted-foreground text-xs">
                                    {dateRange?.from && format(dateRange.from, "MMM d")}
                                    {dateRange?.to &&
                                        ` → ${format(dateRange.to, "MMM d, yyyy")}`}
                                    {" · "}
                                    {guests} guest{guests > 1 ? "s" : ""}
                                </p>
                                <p className="text-2xl font-bold text-primary mt-1">
                                    KES {total.toLocaleString()}
                                </p>
                            </div>

                            <Elements
                                stripe={stripePromise}
                                options={{
                                    clientSecret,
                                    appearance: {
                                        theme: "stripe",
                                        variables: {
                                            borderRadius: "12px",
                                            fontFamily: "inherit",
                                        },
                                    },
                                }}
                            >
                                <StripePaymentForm
                                    amount={total}
                                    onSuccess={handlePaymentSuccess}
                                    onCancel={() => setStep("details")}
                                />
                            </Elements>
                        </>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
