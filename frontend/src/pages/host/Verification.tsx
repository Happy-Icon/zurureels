import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, UserCheck, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const Verification = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'none' | 'pending' | 'verified' | 'rejected'>('none');
    const [verificationId, setVerificationId] = useState<string | null>(null);

    // Fetch current status
    useEffect(() => {
        if (user) {
            fetchVerificationStatus();
        }
    }, [user]);

    const fetchVerificationStatus = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('verification_status, verification_id')
                .eq('id', user?.id)
                .single();

            if (data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const profile = data as any;
                setStatus(profile.verification_status as any);
                setVerificationId(profile.verification_id);
            }
        } catch (error) {
            console.error("Error fetching status:", error);
        }
    };

    const startVerification = async () => {
        setLoading(true);
        try {
            // 1. Get Verification URL from Edge Function
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shufti-token`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: user?.email })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Verification Init Error:", errorData);
                throw new Error(errorData.error || 'Failed to initialize verification');
            }

            const { verification_url } = await response.json();

            if (verification_url) {
                console.log("Redirecting to:", verification_url);
                // Optimistically update status (optional, depends on preference)
                await updateProfileStatus('pending');

                // Redirect user to Shufti Hosted Page
                window.location.href = verification_url;
            } else {
                throw new Error("No verification URL received from server.");
            }

        } catch (error: any) {
            toast.error(error.message || "An error occurred");
            setLoading(false);
        }
    };

    const updateProfileStatus = async (newStatus: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // @ts-ignore
        await supabase.from('profiles').update({ verification_status: newStatus }).eq('id', user?.id);
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

                {status === 'verified' ? (
                    <Card className="border-green-500/20 bg-green-500/5">
                        <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                            <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-green-700">You are verified!</h2>
                                <p className="text-green-600/80">Thank you for helping us keep Zuru safe.</p>
                            </div>
                            <Button onClick={() => window.location.href = '/host'} className="bg-green-600 hover:bg-green-700 text-white">
                                Go to Dashboard
                            </Button>
                        </CardContent>
                    </Card>
                ) : status === 'pending' ? (
                    <Card className="border-yellow-500/20 bg-yellow-500/5">
                        <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
                            <div className="h-16 w-16 rounded-full bg-yellow-500/20 flex items-center justify-center animate-pulse">
                                <Loader2 className="h-8 w-8 text-yellow-600 animate-spin" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-yellow-700">Verification in Progress</h2>
                                <p className="text-yellow-600/80 max-w-sm mx-auto">
                                    We are processing your documents. The system will update you shortly.
                                    You can refresh this page to check your status.
                                </p>
                            </div>
                            <Button variant="outline" onClick={fetchVerificationStatus} className="mt-4">
                                Check Status
                            </Button>
                        </CardContent>
                    </Card>
                ) : ( // This covers 'unverified' and 'rejected'
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

                            <Button
                                size="lg"
                                className="w-full"
                                onClick={startVerification}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Redirecting...
                                    </>
                                ) : status === 'rejected' ? 'Try Again' : 'Verify Identity Now'}
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
