import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Receipt, ShieldCheck, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export const PaymentMethods = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(true);

    // Fetch Transactions on load
    useEffect(() => {
        if (!user) return;
        const fetchTransactions = async () => {
            setLoadingTransactions(true);
            try {
                const { data, error } = await supabase
                    .from('bookings')
                    .select('id, trip_title, amount, status, created_at, payment_reference, refund_amount')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setTransactions(data || []);
            } catch (error) {
                console.error("Error fetching transactions:", error);
            } finally {
                setLoadingTransactions(false);
            }
        };
        fetchTransactions();
    }, [user]);

    return (
        <MainLayout>
            <div className="pb-20 md:pb-8">
                <div className="p-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                    <div className="flex items-center justify-between">
                        <Link to="/profile" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                            <span>Transactions & Receipts</span>
                        </Link>
                    </div>
                </div>

                <div className="p-4 max-w-md mx-auto space-y-6">
                    {/* Header Details */}
                    <div className="space-y-1">
                        <h1 className="text-xl font-display font-semibold flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-primary" />
                            Transaction Ledger
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            View receipts and refund records for all your bookings on ZuruSasa.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {loadingTransactions ? (
                            <div className="text-center p-8">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-2xl p-6 bg-card">
                                <ShieldCheck className="h-10 w-10 text-muted-foreground/45 mx-auto mb-2" />
                                <p className="text-sm">No transaction records found.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {transactions.map((tx) => (
                                    <div key={tx.id} className="p-4 bg-card border border-border rounded-xl space-y-2 shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold text-sm line-clamp-1 text-foreground">{tx.trip_title}</p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    {tx.created_at ? format(new Date(tx.created_at), "MMM d, yyyy 'at' h:mm a") : ""}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-sm text-foreground">
                                                    KES {tx.amount?.toLocaleString()}
                                                </p>
                                                <span className={cn(
                                                    "inline-block text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide mt-1",
                                                    tx.status === "paid" && "bg-emerald-500/10 text-emerald-600",
                                                    tx.status === "pending" && "bg-amber-500/10 text-amber-600",
                                                    tx.status === "refunded" && "bg-blue-500/10 text-blue-600",
                                                    tx.status === "cancelled" && "bg-destructive/10 text-destructive"
                                                )}>
                                                    {tx.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1.5 border-t border-border/60">
                                            <span className="font-mono">Ref: {tx.payment_reference || "N/A"}</span>
                                            {tx.refund_amount > 0 && (
                                                <span className="text-blue-600 font-semibold">Refunded: KES {tx.refund_amount.toLocaleString()}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};
