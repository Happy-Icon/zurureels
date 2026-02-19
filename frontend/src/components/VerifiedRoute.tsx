import { Navigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const VerifiedRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();
    const [isVerified, setIsVerified] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkVerification = async () => {
            if (!user) return;
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('verification_status')
                    .eq('id', user.id)
                    .single();

                // Allow 'verified' OR 'pending' (so they can see the dashboard but maybe with limited access? 
                // actually user asked "cannot be taken to host dashboard before being verified")
                // So strict check: ONLY 'verified'
                // BUT usually we want to let them see "Pending" status on the verification page.

                // Logic:
                // If verified -> Access
                // If not -> Redirect to /host/verification

                if (data?.verification_status === 'verified') {
                    setIsVerified(true);
                } else {
                    setIsVerified(false);
                }
            } catch (error) {
                console.error("Verification check failed", error);
                setIsVerified(false);
            } finally {
                setChecking(false);
            }
        };

        if (!loading && user) {
            checkVerification();
        } else if (!loading && !user) {
            setChecking(false);
        }
    }, [user, loading]);

    if (loading || checking) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    if (isVerified === false) {
        return <Navigate to={`/host/verification${location.search}`} replace />;
    }

    return <>{children}</>;
};
