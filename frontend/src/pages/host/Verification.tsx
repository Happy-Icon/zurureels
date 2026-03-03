import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, UserCheck, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Utility to validate UUID
const isValidUUID = (id: string | undefined | null) =>
    !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

const Verification = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [stripeLoading, setStripeLoading] = useState(false);
    const [status, setStatus] = useState<'none' | 'pending' | 'verified' | 'rejected'>('none');
    const [verificationId, setVerificationId] = useState<string | null>(null);
    const [stripeOnboarded, setStripeOnboarded] = useState<boolean | null>(null);

    const [searchParams] = useSearchParams();
    const isRedirect = searchParams.get('verification_complete') === 'true';
    const [recoveringAuth, setRecoveringAuth] = useState(false);

    // Auth recovery: If returning from Shufti and no user, try to recover session
    useEffect(() => {
        if (isRedirect && !user && !recoveringAuth) {
            console.log("Verification: Attempting auth recovery after Shufti redirect...");
            setRecoveringAuth(true);
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session) {
                    console.log("Verification: Session recovered, reloading...");
                    window.location.reload();
                } else {
                    console.log("Verification: No session found after redirect");
                    setRecoveringAuth(false);
                }
            });
        }
    }, [isRedirect, user, recoveringAuth]);

    // Fetch current status
    useEffect(() => {
        if (user?.id && isValidUUID(user.id)) {
            fetchVerificationStatus();
        } else {
            console.error("Invalid user ID:", user?.id);
        }
    }, [user]);

    // Polling when verification pending
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if ((isRedirect || status === 'pending') && status !== 'verified' && status !== 'rejected') {
            interval = setInterval(fetchVerificationStatus, 2000);
        }
        return () => clearInterval(interval);
    }, [isRedirect, status]);

    // Auto-trigger Stripe onboarding
    useEffect(() => {
        if (status === 'verified' && stripeOnboarded === false) {
            if (isRedirect) toast.success("Identity verified! Setting up your payouts...");
            const timer = setTimeout(handleStripeOnboarding, 1500);
            return () => clearTimeout(timer);
        } else if (status === 'verified' && stripeOnboarded === true) {
            const timer = setTimeout(() => (window.location.href = '/host'), 1500);
            return () => clearTimeout(timer);
        }
    }, [status, stripeOnboarded, isRedirect]);

    const handleStripeOnboarding = async () => {
        try {
            setStripeLoading(true);
            const { data, error } = await supabase.functions.invoke('create-stripe-onboarding', {});
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            if (data?.url) window.location.href = data.url;
        } catch (err: any) {
            toast.error(err.message || "Failed to initiate payout setup");
            setStripeLoading(false);
            setTimeout(() => (window.location.href = '/host'), 3000);
        }
    };

    // ✅ Fetch verification status safely
    const fetchVerificationStatus = async () => {
        if (!user?.id || !isValidUUID(user.id)) return;

        try {
            const { data } = await supabase
                .from('profiles')
                .select('verification_status, verification_id, stripe_onboarded')
                .eq('id', user.id)
                .single();

            if (data) {
                setStatus(data.verification_status as any);
                setVerificationId(data.verification_id);
                setStripeOnboarded(data.stripe_onboarded);
            }
        } catch (err) {
            console.error("Error fetching verification status:", err);
        }
    };

    // ✅ Start verification with safe profile fetch
    const startVerification = async () => {
        if (!user?.id || !isValidUUID(user.id)) {
            toast.error("Invalid user ID");
            return;
        }

        setLoading(true);
        try {
            // Fetch profile info safely
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('full_name, phone')
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;
            if (!profile) throw new Error("Profile not found");

            // Call Shufti-token Edge Function
            const { data, error } = await supabase.functions.invoke('shufti-token', {
                body: {
                    email: user.email,
                    full_name: profile.full_name || ''
                }
            });

            if (error) throw error;
            if (!data?.verification_url) throw new Error("No verification URL returned");

            // Update profile status to pending
            await supabase.from('profiles').update({ verification_status: 'pending' }).eq('id', user.id);

            window.location.href = data.verification_url;
        } catch (err: any) {
            console.error("Verification failed:", err);
            toast.error(err.message || "Verification failed");
            setLoading(false);
        }
    };

    const updateProfileStatus = async (newStatus: string) => {
        if (!user?.id || !isValidUUID(user.id)) return;
        await supabase.from('profiles').update({ verification_status: newStatus }).eq('id', user.id);
        fetchVerificationStatus();
    };

    return (
        <MainLayout>
            <div className="pb-20 md:pb-8 max-w-2xl mx-auto p-4 space-y-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-display font-bold">Identity Verification</h1>
                    <p className="text-muted-foreground">
                        To ensure the safety of our community, all hosts must verify their identity.
                    </p>
                </div>

                {/* Auth recovery loading state */}
                {recoveringAuth && (
                    <Card className="border-blue-500/20 bg-blue-500/5">
                        <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                            <div className="h-16 w-16 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
                                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-blue-700">Restoring your session...</h2>
                                <p className="text-blue-600/80 max-w-sm mx-auto">
                                    Please wait while we reconnect you after verification.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {status === 'verified' ? (
                    <Card className="border-green-500/20 bg-green-500/5">
                        <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                            <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                                {stripeLoading ? (
                                    <Loader2 className="h-8 w-8 text-green-600 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                                )}
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-green-700">You are verified!</h2>
                                <p className="text-green-600/80">
                                    {stripeLoading
                                        ? "Setting up your payout account..."
                                        : stripeOnboarded
                                            ? "Redirecting you to the dashboard..."
                                            : "Preparing Stripe onboarding..."}
                                </p>
                            </div>
                            {!stripeLoading && (
                                <Button
                                    onClick={() => (window.location.href = '/host')}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                    Go to Dashboard
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (status === 'pending' || isRedirect) ? (
                    <Card className="border-yellow-500/20 bg-yellow-500/5">
                        <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                            <div className="h-16 w-16 rounded-full bg-yellow-500/20 flex items-center justify-center animate-pulse">
                                <Loader2 className="h-8 w-8 text-yellow-600 animate-spin" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-yellow-700">
                                    {isRedirect ? "Finalizing Verification..." : "Verification in Progress"}
                                </h2>
                                <p className="text-yellow-600/80 max-w-sm mx-auto">
                                    {isRedirect
                                        ? "We are receiving your results from Shufti Pro. This will just take a moment."
                                        : "We are processing your documents. The system will update you shortly."}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-primary" />
                                Why verify?
                            </CardTitle>
                            <CardDescription>
                                Verification unlocks premium features and higher trust from guests.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="flex gap-3 items-start">
                                    <UserCheck className="h-5 w-5 text-primary mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold">Trust Badge</h4>
                                        <p className="text-sm text-muted-foreground">Get a verified badge on your profile.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3 items-start">
                                    <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold">Secure Payouts</h4>
                                        <p className="text-sm text-muted-foreground">Required for withdrawing earnings.</p>
                                    </div>
                                </div>
                            </div>

                            {status === 'rejected' && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>Verification Failed</AlertTitle>
                                    <AlertDescription>
                                        Your previous attempt was declined. Please ensure your documents are clear and try again.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <Button size="lg" className="w-full" onClick={startVerification} disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Redirecting...
                                    </>
                                ) : status === 'rejected' ? (
                                    'Try Again'
                                ) : (
                                    'Verify Identity Now'
                                )}
                            </Button>

                            <p className="text-xs text-center text-muted-foreground">
                                Powered by Shufti Pro. Your data is processed securely.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </MainLayout>
    );
};

export default Verification;