import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Building2, CreditCard, Landmark, Loader2, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

const KENYAN_BANKS = [
    { code: "011", name: "Co-operative Bank of Kenya" },
    { code: "013", name: "Equity Bank" },
    { code: "015", name: "KCB Bank" },
    { code: "017", name: "Standard Chartered Bank" },
    { code: "020", name: "Barclays Bank (Absa)" },
    { code: "023", name: "NCBA Bank" },
    { code: "024", name: "Stanbic Bank" },
    { code: "025", name: "I&M Bank" },
    { code: "026", name: "Diamond Trust Bank" },
    { code: "027", name: "Family Bank" },
    { code: "028", name: "Sidian Bank" },
    { code: "029", name: "National Bank of Kenya" },
    { code: "744", name: "Safaricom (M-PESA)" },
];

const PayoutSettings = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [existingSubaccount, setExistingSubaccount] = useState<string | null>(null);

    // Form State
    const [bankCode, setBankCode] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [resolvedName, setResolvedName] = useState<string | null>(null);
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        if (!user) return;
        const fetchPayoutInfo = async () => {
            setLoading(true);
            const { data } = await supabase
                .from('profiles')
                .select('metadata, business_name')
                .eq('id', user.id)
                .single();
            
            if (data) {
                const metadata = data.metadata as any;
                if (metadata?.paystack_subaccount_code) {
                    setExistingSubaccount(metadata.paystack_subaccount_code);
                    setAccountNumber(metadata.bank_account_number || "");
                    setBankCode(metadata.bank_code || "");
                    setResolvedName(data.business_name || "");
                }
                setBusinessName(data.business_name || "");
            }
            setLoading(false);
        };
        fetchPayoutInfo();
    }, [user]);

    const handleVerify = async () => {
        if (accountNumber.length < 8 || !bankCode) return;
        if (bankCode === "744") return; // Skip M-Pesa for resolution

        setVerifying(true);
        setResolvedName(null);
        try {
            const { data, error } = await supabase.functions.invoke('resolve-bank-account', {
                body: { account_number: accountNumber, bank_code: bankCode }
            });

            if (error || data?.error) throw new Error(data?.error || "Resolution failed");
            
            setResolvedName(data.account_name);
            setBusinessName(data.account_name); // Auto-fill business name to match bank
            toast.success(`Account Verified: ${data.account_name}`);
        } catch (err: any) {
            console.error("Bank Resolution error:", err);
            toast.error("Could not verify account. Please check the details.");
        } finally {
            setVerifying(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bankCode || !accountNumber || !businessName) {
            toast.error("Please fill in all fields");
            return;
        }

        setSaving(true);
        try {
            // Call Edge Function to create/update Paystack subaccount
            const { data, error } = await supabase.functions.invoke('manage-paystack-subaccount', {
                body: {
                    business_name: businessName,
                    settlement_bank: bankCode,
                    account_number: accountNumber,
                    percentage_charge: 10, // Your 10% platform fee
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            toast.success("Payout settings updated successfully! 💰");
            setExistingSubaccount(data.subaccount_code);
            
            // Redirect back to dashboard after a short delay
            setTimeout(() => navigate("/host"), 2000);

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to update payout settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <MainLayout>
            <div className="pb-20 md:pb-8">
                <div className="p-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                    <div className="flex items-center justify-between">
                        <Link to="/host" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                            <span>Payout Settings</span>
                        </Link>
                    </div>
                </div>

                <div className="p-4 max-w-lg mx-auto space-y-8">
                    <div className="text-center space-y-2">
                        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Landmark className="h-8 w-8 text-primary" />
                        </div>
                        <h1 className="text-2xl font-display font-semibold">Where should we send your money?</h1>
                        <p className="text-muted-foreground">
                            Set up your bank account to receive payments from your bookings automatically.
                        </p>
                    </div>

                    {existingSubaccount && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex gap-3">
                            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-emerald-700">Account Connected</p>
                                <p className="text-xs text-emerald-600/80">
                                    Your account ending in {accountNumber.slice(-4)} is verified and ready for payouts.
                                </p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="space-y-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
                            <div className="space-y-2">
                                <Label htmlFor="businessName">Legal Business Name</Label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="businessName"
                                        placeholder="e.g. John Doe Rentals"
                                        className="pl-9"
                                        value={businessName}
                                        onChange={(e) => setBusinessName(e.target.value)}
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground">This should match your bank account name.</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Settlement Bank</Label>
                                <Select value={bankCode} onValueChange={setBankCode}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select your bank" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {KENYAN_BANKS.map((bank) => (
                                            <SelectItem key={bank.code} value={bank.code}>
                                                {bank.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label htmlFor="accountNumber">Account Number</Label>
                                    {accountNumber.length >= 8 && bankCode && bankCode !== "744" && !resolvedName && (
                                        <button 
                                            type="button"
                                            onClick={handleVerify}
                                            className="text-xs font-bold text-primary hover:underline"
                                            disabled={verifying}
                                        >
                                            {verifying ? "Verifying..." : "Verify Account"}
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="accountNumber"
                                        placeholder={bankCode === "744" ? "Phone number (07XX...)" : "Your bank account number"}
                                        className="pl-9 pr-10"
                                        value={accountNumber}
                                        onChange={(e) => {
                                            setAccountNumber(e.target.value);
                                            setResolvedName(null);
                                        }}
                                        onBlur={() => {
                                            if (!resolvedName && bankCode !== "744") handleVerify();
                                        }}
                                    />
                                    {resolvedName && (
                                        <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                                    )}
                                </div>
                                {resolvedName && (
                                    <p className="text-[10px] text-emerald-600 font-medium">
                                        Verified: <span className="uppercase">{resolvedName}</span>
                                    </p>
                                )}
                                {bankCode === "744" && (
                                    <p className="text-[10px] text-amber-600 font-medium italic">
                                        For M-Pesa, enter your phone number as the account number.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Platform Commission</span>
                                <span className="font-medium">10%</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Payout Schedule</span>
                                <span className="font-medium">After Trip Completion</span>
                            </div>
                        </div>

                        <Button type="submit" className="w-full h-12 text-base font-semibold shadow-lg" disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Connecting Account...
                                </>
                            ) : existingSubaccount ? (
                                "Update Payout Details"
                            ) : (
                                "Confirm Payout Details"
                            )}
                        </Button>
                    </form>
                </div>
            </div>
        </MainLayout>
    );
};

export default PayoutSettings;
