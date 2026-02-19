
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const AuthRedirectHandler = () => {
    // This component is currently disabled/passive because AuthProvider now handles the redirect.
    // We keep it as a placeholder or secondary safety if needed, but logging only for now to avoid race conditions.
    const navigate = useNavigate();

    useEffect(() => {
        const hash = window.location.hash;
        if (hash && hash.includes("type=recovery")) {
            console.log("Global Handler: Recovery hash detected. Allowing AuthProvider to handle.");
            // Do NOT navigate here, as it strips the hash before Supabase sees it.
        }
    }, [navigate]);

    return null;
};
