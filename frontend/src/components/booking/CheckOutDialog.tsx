
import { useState, useEffect, useMemo } from "react";
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
import { usePaystackPayment } from "react-paystack";
import { toast } from "sonner";
import { CreditCard, Loader2, ShieldCheck, Ticket } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNavigate } from "react-router-dom";

interface CheckOutDialogProps {
    experienceId?: string;
    tripTitle: string;
    amount: number;
    guests?: number;
    checkIn?: string;
    checkOut?: string;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

interface PaymentMethod {
    id: string;
    brand: string;
    last4: string;
    authorization_code: string;
}

export const CheckOutDialog = ({
    experienceId,
    tripTitle,
    amount,
    guests = 1,
    checkIn,
    checkOut,
    trigger,
    onSuccess,
    open: controlledOpen,
    onOpenChange: setControlledOpen
}: CheckOutDialogProps) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : internalOpen;
    const setIsOpen = isControlled
        ? (open: boolean) => { setControlledOpen?.(open); }
        : setInternalOpen;

    const [loading, setLoading] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [selectedMethodId, setSelectedMethodId] = useState<string>("new");
    const [saveCard, setSaveCard] = useState(true);
    const [subaccountCode, setSubaccountCode] = useState<string | null>(null);

    // Fetch Host Subaccount
    useEffect(() => {
        if (!experienceId || !isOpen) return;
        
        const fetchHostSubaccount = async () => {
            const { data: experience } = await supabase
                .from('experiences')
                .select('user_id')
                .eq('id', experienceId)
                .single();
            
            if (experience?.user_id) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('metadata')
                    .eq('id', experience.user_id)
                    .single();
                
                if (profile?.metadata) {
                    const metadata = profile.metadata as any;
                    if (metadata.paystack_subaccount_code) {
                        setSubaccountCode(metadata.paystack_subaccount_code);
                    }
                }
            }
        };
        fetchHostSubaccount();
    }, [experienceId, isOpen]);

    const [paystackRef] = useState(() => `zuru_${Date.now()}_${Math.random().toString(36).slice(2)}`);

    // Paystack Config
    const config = useMemo(() => ({
        reference: paystackRef,
        email: user?.email || "",
        amount: Math.round(amount * 100), // kobo/cents — must be integer
        publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "",
        currency: "KES",
        subaccount: subaccountCode || undefined, // Automatic split if host is onboarded
    }), [paystackRef, user?.email, amount, subaccountCode]);

    const c_onSuccess = async (reference: any) => {
        setLoading(true);

        // Support mock IDs (non-UUIDs)
        const isUUID = (id?: string) => {
            if (!id) return false;
            const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            return regex.test(id);
        };

        try {
            // 1. Create Booking (Only if IDs are valid UUIDs)
            if (isUUID(experienceId)) {
                const { error: bookingError } = await supabase.from('bookings').insert({
                    user_id: user?.id,
                    experience_id: experienceId,
                    trip_title: tripTitle,
                    amount: amount,
                    guests: guests,
                    check_in: checkIn || new Date().toISOString(),
                    check_out: checkOut || new Date(Date.now() + 86400000).toISOString(),
                    status: 'paid',
                    payment_reference: reference.reference
                });

                if (bookingError) throw bookingError;
            } else {
                console.log("Mock booking detected, skipping DB insert.");
            }

            // 2. Save Card (if requested and it's a new card)
            if (selectedMethodId === "new" && saveCard) {
                const auth = reference.authorization || {};

                try {
                    // @ts-ignore
                    const { error: saveError } = await supabase.from('payment_methods').insert({
                        user_id: user?.id,
                        provider: 'paystack',
                        reference: reference.reference,
                        authorization_code: auth.authorization_code || 'demo_auth_code_' + Date.now(),
                        last4: auth.last4 || '0000',
                        brand: auth.brand || 'Card'
                    });

                    if (saveError) {
                        console.error("Supabase Save Error:", saveError);
                        toast.error("Booking successful, but failed to save card: " + saveError.message);
                    } else {
                        toast.success("Card saved for future use!");
                    }
                } catch (innerError: any) {
                    console.error("Save Card Exception:", innerError);
                }
            }

            toast.success("Booking confirmed! Enjoy your trip 🎉");
            setIsOpen(false);
            onSuccess?.();

        } catch (error: any) {
            console.error("Booking Error:", error);
            toast.error("Booking failed: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const onPaystackSuccess = (reference: any) => {
        c_onSuccess(reference);
    };

    const onPaystackClose = () => {
        toast.info("Payment cancelled");
        setLoading(false);
    };

    const initializePayment = usePaystackPayment(config);

    const handlePay = () => {
        if (!user) {
            toast.error("Please sign in to book");
            setIsOpen(false);
            navigate("/auth");
            return;
        }

        const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
        if (!paystackKey) {
            toast.error("Payment is not configured yet. Please contact support.");
            return;
        }

        if (!amount || amount <= 0) {
            toast.error("Invalid booking amount.");
            return;
        }

        setLoading(true);

        if (selectedMethodId === "new") {
            initializePayment({ onSuccess: onPaystackSuccess, onClose: onPaystackClose });
        } else {
            setTimeout(async () => {
                const simulatedRef = { reference: "SIM_" + Date.now() };
                await c_onSuccess(simulatedRef);
            }, 1500);
        }
    };

    // Fetch saved cards
    useEffect(() => {
        if (user && isOpen) {
            const fetchMethods = async () => {
                // @ts-ignore
                const { data } = await supabase.from('payment_methods').select('*').eq('user_id', user.id);
                if (data) setPaymentMethods(data);
            };
            fetchMethods();
        }
    }, [user, isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen} modal={false}>
            {/* Only render DialogTrigger when NOT in controlled mode */}
            {!isControlled && (
                <DialogTrigger asChild>
                    {trigger || <Button>Book Now</Button>}
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Confirm Booking</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Summary */}
                    <div className="bg-secondary/20 p-4 rounded-lg flex items-start gap-3">
                        <Ticket className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                            <h3 className="font-medium">{tripTitle}</h3>
                            <p className="text-2xl font-bold text-primary mt-1">KES {amount.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Guest login prompt */}
                    {!user && (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center space-y-3">
                            <p className="text-sm text-muted-foreground">You need to be signed in to complete this booking.</p>
                            <Button onClick={() => { setIsOpen(false); navigate("/auth"); }} className="w-full">
                                Sign In to Book
                            </Button>
                        </div>
                    )}

                    {/* Payment Selection (only for logged-in users) */}
                    {user && (
                        <>
                            <div className="space-y-3">
                                <Label>Payment Method</Label>
                                <RadioGroup value={selectedMethodId} onValueChange={setSelectedMethodId}>
                                    {/* Saved Cards */}
                                    {paymentMethods.map(method => (
                                        <div key={method.id} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-secondary/10 cursor-pointer">
                                            <RadioGroupItem value={method.id} id={method.id} />
                                            <Label htmlFor={method.id} className="flex-1 flex items-center cursor-pointer">
                                                <CreditCard className="h-4 w-4 mr-2 text-muted-foreground" />
                                                {method.brand} •••• {method.last4}
                                            </Label>
                                        </div>
                                    ))}

                                    {/* New Card */}
                                    <div className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-secondary/10 cursor-pointer">
                                        <RadioGroupItem value="new" id="new" />
                                        <Label htmlFor="new" className="flex-1 cursor-pointer">
                                            New Card / M-Pesa
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {/* Save Card Checkbox (Only if New) */}
                            {selectedMethodId === "new" && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-primary/5 p-3 rounded-lg">
                                    <input
                                        type="checkbox"
                                        id="save-card"
                                        checked={saveCard}
                                        onChange={(e) => setSaveCard(e.target.checked)}
                                        className="rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <label htmlFor="save-card" className="flex items-center gap-1.5 cursor-pointer">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        Securely save for future 1-click booking
                                    </label>
                                </div>
                            )}

                            <Button onClick={handlePay} className="w-full h-11 text-lg" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {selectedMethodId === "new" ? `Pay KES ${amount.toLocaleString()}` : `Pay with Saved Card`}
                            </Button>
                        </>
                    )}
                </div>

            </DialogContent>
        </Dialog>
    );
};
