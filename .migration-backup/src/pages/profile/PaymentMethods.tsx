import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, CreditCard, Plus, Smartphone, Trash2, ShieldCheck, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePaystackPayment } from "react-paystack";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

interface PaymentMethod {
    id: string;
    type: "paystack";
    title: string;
    subtitle: string;
    isDefault?: boolean;
}

export const PaymentMethods = () => {
    const { user } = useAuth();
    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [amount, setAmount] = useState<number>(1); // 1 KES verify charge
    const [email, setEmail] = useState(user?.email || "");

    // Fetch Methods on Load
    useEffect(() => {
        if (!user) return;
        const fetchMethods = async () => {
            try {
                const { data, error } = await (supabase as any)
                    .from('payment_methods')
                    .select('*')
                    .eq('user_id', user.id);

                if (error) throw error;

                const formattedMethods: PaymentMethod[] = (data || []).map((m: any) => ({
                    id: m.id,
                    type: "paystack",
                    title: m.brand ? `Card ending in ${m.last4}` : "Payment Method",
                    subtitle: `Ref: ${m.reference?.slice(-8) || "******"}`,
                }));
                setMethods(formattedMethods);
            } catch (error) {
                console.error("Error fetching methods:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMethods();
    }, [user]);

    const config = {
        reference: (new Date()).getTime().toString(),
        email: email,
        amount: amount * 100, // Amount is in kobo/cents
        publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '',
        currency: 'KES',
    };

    const c_onSuccess = async (reference: any) => {
        toast.success("Payment method verified!");

        // In a real app, you would save the 'authorization' code from reference
        // to charge this user later without interaction.
        console.log("Paystack Reference:", reference);

        // Save to DB
        if (user) {
            try {
                // @ts-ignore - payment_methods table exists in database
                const { data, error } = await supabase.from('payment_methods').insert({
                    user_id: user.id,
                    provider: 'paystack',
                    reference: reference.reference,
                    authorization_code: reference.authorization?.authorization_code, // Save if available
                    last4: reference.authorization?.last4,
                    brand: reference.authorization?.brand
                } as any).select().single();

                if (error) throw error;

                const paymentData = data as any;
                const newMethod: PaymentMethod = {
                    id: paymentData.id,
                    type: "paystack",
                    title: paymentData.brand ? `Card ending in ${paymentData.last4}` : "Verified Method",
                    subtitle: `Ref: ${paymentData.reference.slice(-8)}`,
                };

                setMethods([...methods, newMethod]);
            } catch (error: any) {
                toast.error("Failed to save method: " + error.message);
            }
        }

        setIsAdding(false);
    };

    const onSuccess = (reference: any) => {
        // Implementation wrapper to avoid type issues if needed
        c_onSuccess(reference);
    };

    const onClose = () => {
        toast.info("Verification cancelled");
    };

    const initializePayment = usePaystackPayment(config);

    const removeMethod = async (id: string) => {
        try {
            const { error } = await (supabase as any).from('payment_methods').delete().eq('id', id);
            if (error) throw error;

            setMethods(methods.filter(m => m.id !== id));
            toast.success("Payment method removed");
        } catch (error: any) {
            toast.error("Error removing method: " + error.message);
        }
    };

    return (
        <MainLayout>
            <div className="pb-20 md:pb-8">
                <div className="p-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                    <div className="flex items-center justify-between">
                        <Link to="/profile" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                            <span>Payment Methods</span>
                        </Link>
                    </div>
                </div>

                <div className="p-4 max-w-md mx-auto space-y-6">
                    {/* Disclaimer */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3">
                        <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                        <p className="text-sm text-muted-foreground">
                            We use Paystack to securely process payments. To add a payment method, we'll verify it by initializing a small transaction (KES 1).
                        </p>
                    </div>

                    {/* Existing Methods */}
                    <div className="space-y-3">
                        {loading && <div className="text-center p-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>}
                        {!loading && methods.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                No payment methods added yet.
                            </div>
                        )}
                        {methods.map((method) => (
                            <div key={method.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 bg-secondary rounded-full flex items-center justify-center">
                                        <CreditCard className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium">{method.title}</p>
                                            {method.isDefault && (
                                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{method.subtitle}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeMethod(method.id)}
                                    className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add New Button */}
                    <Dialog open={isAdding} onOpenChange={setIsAdding}>
                        <DialogTrigger asChild>
                            <Button className="w-full" variant="outline">
                                <Plus className="mr-2 h-4 w-4" /> Add Payment Method
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Payment Method</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Email required for verification</Label>
                                    <Input
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter verification email"
                                    />
                                </div>

                                <p className="text-sm text-muted-foreground">
                                    Clicking "Verify with Paystack" will open a secure window to link your Card or M-Pesa account.
                                    A small charge (KES 1) will be initiated.
                                </p>

                                <Button
                                    onClick={() => {
                                        if (!email) {
                                            toast.error("Please enter an email address");
                                            return;
                                        }
                                        // @ts-ignore
                                        initializePayment(onSuccess, onClose);
                                    }}
                                    className="w-full mt-4 bg-[#0AA5DB] hover:bg-[#0AA5DB]/90 text-white"
                                >
                                    Verify with Paystack
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </MainLayout>
    );
};
