import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { X, Mail, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";

export function EmailVerificationBanner() {
    const { user } = useAuth();
    const [isVisible, setIsVisible] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        // Check both standard email (unverified) and new_email (pending change/addition)
        const hasUnverifiedEmail = (user?.email && !user?.email_confirmed_at) || user?.new_email;

        if (user && hasUnverifiedEmail) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [user]);

    const handleResend = async () => {
        const targetEmail = user?.new_email || user?.email;
        if (!targetEmail) return;

        setSending(true);
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: targetEmail,
                options: {
                    emailRedirectTo: window.location.origin,
                }
            });

            if (error) throw error;
            toast.success("Verification email sent! Check your inbox.");
            setIsVisible(false); // Hide after sending to prevent spamming
        } catch (error: any) {
            toast.error(error.message || "Failed to resend email.");
        } finally {
            setSending(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="bg-[#EE7D30]/10 border-b border-[#EE7D30]/20 px-4 py-3 flex items-start sm:items-center justify-between gap-4 w-full z-50">
            <div className="flex items-start sm:items-center gap-3">
                <div className="bg-[#EE7D30]/20 p-1.5 rounded-full shrink-0 mt-0.5 sm:mt-0">
                    <AlertCircle className="w-4 h-4 text-[#EE7D30]" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <p className="text-sm text-[#222] font-medium">
                        Please verify your email address.
                    </p>
                    <p className="text-[13px] text-[#717171]">
                        We sent a link to <span className="font-semibold text-[#222]">{user?.new_email || user?.email}</span>
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResend}
                    disabled={sending}
                    className="h-8 text-xs border-[#EE7D30] text-[#EE7D30] hover:bg-[#EE7D30]/10 shrink-0"
                >
                    {sending ? "Sending..." : "Resend email"}
                </Button>
                <button
                    onClick={() => setIsVisible(false)}
                    className="p-1 hover:bg-black/5 rounded-full transition-colors text-[#717171]"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
