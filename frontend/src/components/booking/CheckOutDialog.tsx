
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
import { usePaystackPayment } from "react-paystack";
import { toast } from "sonner";
import { CreditCard, Loader2, ShieldCheck, Ticket } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Import Shadcn Radio

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
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : internalOpen;
    const setIsOpen = isControlled ? setControlledOpen : setInternalOpen;
    const [loading, setLoading] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [selectedMethodId, setSelectedMethodId] = useState<string>("new");
    const [saveCard, setSaveCard] = useState(true);

    // Paystack Config
    const config = {
        reference: (new Date()).getTime().toString(),
        email: user?.email || "",
        amount: amount * 100, // kobo
        publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "",
        currency: "KES",
    };

    const c_onSuccess = async (reference: any) => {
        setLoading(true);
        try {
            // 1. Create Booking
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

            // 2. Save Card (if requested and it's a new card)
            if (selectedMethodId === "new" && saveCard) {
                console.log("Attempting to save card...");
                console.log("Auth Data:", reference.authorization);

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
                        console.log("Card saved successfully!");
                        toast.success("Card saved for future use!");
                    }
                } catch (innerError: any) {
                    console.error("Save Card Exception:", innerError);
                    toast.error("Failed to save card logic: " + innerError.message);
                }
            } else {
                // Card not saved (either existing card or save card unchecked)
            }

            toast.success("Booking confirmed! enjoy your trip.");
            setIsOpen(false);
            onSuccess?.();

        } catch (error: any) {
            console.error("Booking Error:", error);
            toast.error("Booking failed: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Wrapper for Paystack types
    const onPaystackSuccess = (reference: any) => {
        c_onSuccess(reference);
    }

    const onPaystackClose = () => {
        toast.info("Payment cancelled");
        setLoading(false);
    };

    const initializePayment = usePaystackPayment(config);

    const handlePay = () => {
        if (!user) {
            toast.error("Please sign in to book");
            return;
        }

        setLoading(true);

        if (selectedMethodId === "new") {
            // @ts-ignore
            initializePayment(onPaystackSuccess, onPaystackClose);
        } else {
            // Charge Saved Card (Backend Logic Simulation)
            // Since we don't have a backend function to charge auth_code, 
            // we will just Simulate Success for the demo.
            // In production, this would call supabase.functions.invoke('charge-card', ...)

            setTimeout(async () => {
                const method = paymentMethods.find(m => m.id === selectedMethodId);
                // Simulate "Reference" object from Paystack
                const simulatedRef = {
                    reference: "SIM_" + Date.now(),
                    // No auth needed to save again
                };
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
                    <div className="bg-secondary/20 p-4 rounded-lg flex items-start gap-3">
                        <Ticket className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                            <h3 className="font-medium">{tripTitle}</h3>
                            <p className="text-2xl font-bold text-primary mt-1">KES {amount.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Payment Selection */}
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
                </div>

            </DialogContent>
        </Dialog>
    );
};
