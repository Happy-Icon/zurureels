import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading, role } = useAuth();
    const location = useLocation();

    useEffect(() => {
        if (!loading && user && role !== 'admin') {
            toast.error("Unauthorized. You must be an admin to access this page.");
        }
    }, [loading, user, role]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to={`/auth?return_to=${encodeURIComponent(location.pathname)}`} replace />;
    }

    if (role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};
