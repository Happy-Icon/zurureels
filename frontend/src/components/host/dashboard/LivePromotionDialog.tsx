import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { Zap, Crown, Sparkles, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LivePromotionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    eventId: string;
    eventTitle: string;
    onSuccess: (promotionType: "free" | "boosted" | "pinned") => void;
}

export const LivePromotionDialog = ({
    open,
    onOpenChange,
    eventId,
    eventTitle,
    onSuccess
}: LivePromotionDialogProps) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [selectedTier, setSelectedTier] = useState<"free" | "boosted" | "pinned">("free");

    const triggerPaystack = (amount: number, promotionType: "boosted" | "pinned") => {
        try {
            // @ts-ignore
            if (typeof window.PaystackPop === "undefined") {
                toast.error("Paystack script failed to load. Please check your internet connection.");
                return;
            }

            setLoading(true);
            
            // Override Radix scroll-lock / pointer-events blocking
            const originalBodyPointerEvents = document.body.style.pointerEvents;
            document.body.style.pointerEvents = "auto";

            const originalToString = Object.prototype.toString;
            Object.prototype.toString = function () {
                if (typeof this === "function") {
                    return "[object Function]";
                }
                return originalToString.call(this);
            };

            let handler;
            try {
                // @ts-ignore
                handler = window.PaystackPop.setup({
                    key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_c54e72eef2073538fdb43b2e1b8e793527820445",
                    email: user?.email || "host@zurureels.com",
                    amount: amount * 100, // amount in KES cents
                    currency: "KES",
                    metadata: {
                        custom_fields: [
                            {
                                display_name: "Event ID",
                                variable_name: "event_id",
                                value: eventId
                            },
                            {
                                display_name: "Promotion Type",
                                variable_name: "promotion_type",
                                value: promotionType
                            }
                        ]
                    },
                    callback: function (transaction: any) {
                        document.body.style.pointerEvents = originalBodyPointerEvents;
                        setLoading(true);
                        supabase
                            .from("events")
                            .update({
                                promotion_type: promotionType,
                                is_paid: true,
                                paystack_reference: transaction.reference
                            })
                            .eq("id", eventId)
                            .then(({ error }) => {
                                if (error) throw error;
                                toast.success(`Awesome! Your stream is now promoted to ${promotionType}.`);
                                onSuccess(promotionType);
                            })
                            .catch((err: any) => {
                                console.error("Failed to update event promotions:", err);
                                toast.error("Payment received, but failed to activate promo in DB. Contact support.");
                            })
                            .finally(() => {
                                setLoading(false);
                            });
                    },
                    onClose: function () {
                        document.body.style.pointerEvents = originalBodyPointerEvents;
                        toast.info("Payment cancelled.");
                        setLoading(false);
                    }
                });
            } finally {
                Object.prototype.toString = originalToString;
            }

            if (handler) {
                handler.openIframe();
            }
        } catch (err) {
            console.error("Paystack invocation failed:", err);
            toast.error("Failed to open Paystack billing portal.");
            setLoading(false);
        }
    };

    const handleSelectFree = async () => {
        setLoading(true);
        try {
            // Free hosting is updated in Supabase to 'free' promotion
            const { error } = await supabase
                .from("events")
                .update({
                    promotion_type: "free",
                    is_paid: false
                })
                .eq("id", eventId);

            if (error) throw error;
            toast.success("Going live with standard reach.");
            onSuccess("free");
        } catch (err: any) {
            console.error("Failed to set free event:", err);
            toast.error("Failed to start event. Try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (selectedTier === "free") {
            handleSelectFree();
        } else if (selectedTier === "boosted") {
            triggerPaystack(200, "boosted"); // 200 KES
        } else if (selectedTier === "pinned") {
            triggerPaystack(500, "pinned"); // 500 KES
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!loading) onOpenChange(val); }}>
            <DialogContent className="sm:max-w-3xl rounded-3xl bg-zinc-950 text-white border-white/10 shadow-2xl p-6 overflow-hidden">
                <DialogHeader className="space-y-1.5 text-center">
                    <DialogTitle className="text-xl font-bold flex items-center justify-center gap-1.5">
                        <Sparkles className="text-primary h-5 w-5 animate-pulse" />
                        Boost Your Event Stream
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400 text-xs max-w-lg mx-auto">
                        Promote "{eventTitle}" to maximize your viewer reach and increase bookings in real-time. Choose a promotion level to go live.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6">
                    {/* Free Card */}
                    <div 
                        onClick={() => !loading && setSelectedTier("free")}
                        className={cn(
                            "relative rounded-2xl border bg-zinc-900/40 p-5 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:scale-[1.02]",
                            selectedTier === "free" 
                                ? "border-zinc-500 bg-zinc-900 ring-1 ring-zinc-500/20" 
                                : "border-white/5 hover:border-white/10"
                        )}
                    >
                        <div className="space-y-3">
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold text-sm text-zinc-300">Standard</h3>
                                <span className="text-[10px] uppercase font-bold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-md">Free</span>
                            </div>
                            <div className="text-2xl font-black">0 KES</div>
                            <ul className="space-y-2 text-[10px] text-zinc-400 pt-2 border-t border-white/5">
                                <li className="flex items-center gap-1.5">
                                    <Check size={12} className="text-zinc-500" /> Standard feed listings
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <Check size={12} className="text-zinc-500" /> Real-time chat & hearts
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <Check size={12} className="text-zinc-500" /> Standard booking button
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Boosted Card */}
                    <div 
                        onClick={() => !loading && setSelectedTier("boosted")}
                        className={cn(
                            "relative rounded-2xl border p-5 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:scale-[1.02]",
                            selectedTier === "boosted"
                                ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                                : "border-white/5 bg-zinc-900/40 hover:border-white/10"
                        )}
                    >
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-md">
                            Popular Choice
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold text-sm text-primary flex items-center gap-1">
                                    <Zap size={13} className="fill-current" />
                                    Boosted
                                </h3>
                                <span className="text-[10px] uppercase font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-md">Ranked</span>
                            </div>
                            <div className="text-2xl font-black text-primary">200 KES</div>
                            <ul className="space-y-2 text-[10px] text-zinc-300 pt-2 border-t border-white/5">
                                <li className="flex items-center gap-1.5">
                                    <Check size={12} className="text-primary" /> Listed above free events
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <Check size={12} className="text-primary" /> Highlighted live badge
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <Check size={12} className="text-primary" /> 2x increased guest reach
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Pinned Card */}
                    <div 
                        onClick={() => !loading && setSelectedTier("pinned")}
                        className={cn(
                            "relative rounded-2xl border p-5 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:scale-[1.02]",
                            selectedTier === "pinned"
                                ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/20"
                                : "border-white/5 bg-zinc-900/40 hover:border-white/10"
                        )}
                    >
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-zinc-950 text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-md">
                            Max Reach
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold text-sm text-amber-400 flex items-center gap-1">
                                    <Crown size={13} className="fill-current text-amber-500" />
                                    Pinned
                                </h3>
                                <span className="text-[10px] uppercase font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md">Elite</span>
                            </div>
                            <div className="text-2xl font-black text-amber-400">500 KES</div>
                            <ul className="space-y-2 text-[10px] text-zinc-300 pt-2 border-t border-white/5">
                                <li className="flex items-center gap-1.5">
                                    <Check size={12} className="text-amber-500" /> Pinned at top of carousels
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <Check size={12} className="text-amber-500" /> Animated glowing border card
                                </li>
                                <li className="flex items-center gap-1.5">
                                    <Check size={12} className="text-amber-500" /> 5x maximum guest bookings
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
                    <Button 
                        variant="ghost" 
                        disabled={loading} 
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl text-zinc-400 hover:text-white"
                    >
                        Cancel
                    </Button>
                    <Button 
                        disabled={loading} 
                        onClick={handleConfirm}
                        className={cn(
                            "rounded-xl font-bold px-6 shadow-md transition-all",
                            selectedTier === "pinned" 
                                ? "bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-amber-500/10" 
                                : selectedTier === "boosted"
                                ? "bg-primary hover:bg-primary/95 text-white shadow-primary/10"
                                : "bg-zinc-800 hover:bg-zinc-700 text-white"
                        )}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={16} className="animate-spin mr-1.5" />
                                Processing...
                            </>
                        ) : selectedTier === "free" ? (
                            "Go Live (Free)"
                        ) : (
                            `Pay with Paystack`
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
