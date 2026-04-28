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
    MapPin,    Users, CalendarDays, Loader2,
    Star, ChevronDown, ChevronUp, CheckCircle2,
    CreditCard, ShieldCheck
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePaystackPayment } from "react-paystack";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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

    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [guests, setGuests] = useState(1);
    const [showCalendar, setShowCalendar] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Paystack Reference
    const [paystackRef] = useState(() => `zuru_${Date.now()}_${Math.random().toString(36).slice(2)}`);

    const today = startOfDay(new Date());
    const nights =
        dateRange?.from && dateRange?.to
            ? Math.max(1, differenceInDays(dateRange.to, dateRange.from))
            : 1;

    const isNightBased = ["hotel", "villa", "apartment"].includes(category || "");
    const units = isNightBased ? nights : guests;
    const total = price * units;

    // Paystack Config
    const config = {
        reference: paystackRef,
        email: user?.email || "",
        amount: Math.round(total * 100), // kobo/cents — must be integer
        publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "",
        currency: "KES",
    };

    const onPaystackSuccess = async (reference: any) => {
        setIsSubmitting(true);
        try {
            const isUUID = (id?: string) =>
                !!id &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

            if (isUUID(experienceId)) {
                const { error: bookingError } = await supabase.from("bookings").insert({
                    user_id: user?.id,
                    experience_id: experienceId,
                    trip_title: title,
                    amount: total,
                    guests,
                    check_in: dateRange?.from?.toISOString() || new Date().toISOString(),
                    check_out: (dateRange?.to || addDays(dateRange?.from || new Date(), 1)).toISOString(),
                    status: "paid",
                    payment_reference: reference.reference,
                });

                if (bookingError) throw bookingError;
                
                toast.success("Booking confirmed! Enjoy your trip 🎉");
                handleClose();
                onSuccess?.();
            } else {
                toast.success("Demo booking successful! (Mock Experience)");
                handleClose();
                onSuccess?.();
            }
        } catch (err: any) {
            console.error("Booking recording error:", err);
            toast.error("Payment successful but failed to record booking. Please contact support.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const onPaystackClose = () => {
        toast.info("Payment cancelled");
        setIsSubmitting(false);
    };

    const initializePayment = usePaystackPayment(config);

    const isDisabled = (date: Date) => {
        if (isBefore(date, today)) return true;
        if (availableDays && availableDays.length > 0) {
            return !availableDays.includes(date.getDay());
        }
        return false;
    };

    const handleConfirmBooking = async () => {
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

        const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
        if (!paystackKey) {
            toast.error("Payment system is being updated. Please try again in a few minutes.");
            return;
        }

        setIsSubmitting(true);
        // @ts-ignore
        initializePayment(onPaystackSuccess, onPaystackClose);
    };

    const handleClose = () => {
        onOpenChange(false);
        setTimeout(() => {
            setDateRange(undefined);
            setGuests(1);
            setShowCalendar(false);
        }, 300);
    };

    return (
        <Sheet open={open} onOpenChange={handleClose} modal={false}>
            <SheetContent
                side={isMobile ? "bottom" : "right"}
                className={cn(
                    "overflow-y-auto p-0 transition-all duration-500",
                    isMobile 
                        ? "h-[92dvh] w-full rounded-t-3xl" 
                        : "h-screen w-[450px] sm:max-w-[450px] border-l border-border"
                )}
            >
                {/* Dismiss Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-[60] h-10 w-10 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md border border-white/20 text-white hover:bg-black/40 active:scale-90 transition-all shadow-lg"
                >
                    <ChevronDown className={cn("h-6 w-6", !isMobile && "rotate-[-90deg]")} />
                </button>

                {imageUrl && (
                    <div className="relative h-44 w-full overflow-hidden flex-shrink-0">
                        <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4">
                            {category && (
                                <Badge className="text-xs capitalize mb-1 bg-primary/80 border-0">
                                    {category}
                                </Badge>
                            )}
                            <h2 className="text-lg font-display font-bold text-white line-clamp-2">{title}</h2>
                            <div className="flex items-center gap-3 text-white/80 text-xs mt-1">
                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{location}</span>
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
                                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{location}</span>
                                {rating && <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />{rating.toFixed(1)}</span>}
                            </div>
                        </SheetHeader>
                    )}

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
                                        {dateRange.to ? ` → ${format(dateRange.to, "MMM d, yyyy")}` : " → End date?"}
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground">Choose your dates</span>
                                )}
                            </div>
                            {showCalendar ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
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
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <p className="font-semibold text-sm">Guests</p>
                        <div className="flex items-center justify-between border rounded-xl p-3.5">
                            <div className="flex items-center gap-2 text-sm">
                                <Users className="h-4 w-4 text-primary" />
                                <span>{guests} Guest{guests > 1 ? "s" : ""}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setGuests(Math.max(1, guests - 1))} className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-secondary disabled:opacity-40" disabled={guests <= 1}>−</button>
                                <span className="w-4 text-center font-semibold">{guests}</span>
                                <button onClick={() => setGuests(Math.min(20, guests + 1))} className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-secondary">+</button>
                            </div>
                        </div>
                    </div>

                    {dateRange?.from && (
                        <div className="bg-secondary/20 rounded-xl p-4 space-y-2 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                                <span>
                                    KES {price.toLocaleString()} × {isNightBased ? `${nights} night${nights > 1 ? "s" : ""}` : `${guests} guest${guests > 1 ? "s" : ""}`}
                                </span>
                                <span>KES {total.toLocaleString()}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-bold text-base">
                                <span>Total</span>
                                <span className="text-primary">KES {total.toLocaleString()}</span>
                            </div>
                        </div>
                    )}

                    {/* Escrow Trust Notice */}
                    <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-4 flex items-start gap-3">
                        <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Zuru Secure Escrow</p>
                            <p className="text-[11px] text-emerald-600/80 leading-relaxed">
                                Your payment is held by ZuruSasa and only released to the host after you confirm receipt of the service. Book here to stay fully protected.
                            </p>
                        </div>
                    </div>

                    <Button
                        onClick={handleConfirmBooking}
                        disabled={!dateRange?.from || isSubmitting}
                        className="w-full h-12 text-base font-semibold rounded-xl"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming...</>
                        ) : (
                            <><CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Booking</>
                        )}
                    </Button>

                    {!user && (
                        <p className="text-center text-xs text-muted-foreground">
                            You'll be asked to sign in to confirm your booking.
                        </p>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
