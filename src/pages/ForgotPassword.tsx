
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Mail, Loader2 } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const emailResult = emailSchema.safeParse(email);
        if (!emailResult.success) {
            toast.error(emailResult.error.errors[0].message);
            return;
        }

        setLoading(true);

        try {
            // Use current origin to ensure link works for both localhost and prod
            const appUrl = window.location.origin;
            const redirectTo = `${appUrl}/reset-password`;

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo,
            });

            if (error) throw error;

            setSuccess(true);
            toast.success("Password reset email sent!");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-background flex flex-col">
                <div className="p-4">
                    <Link to="/auth" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                        <span>Back to Sign In</span>
                    </Link>
                </div>
                <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full text-center">
                    <div className="mb-8 flex justify-center">
                        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                            <Mail className="h-10 w-10 text-primary" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-display font-semibold text-foreground mb-4">Check your email</h1>
                    <p className="text-muted-foreground mb-8">
                        We've sent a password reset link to <span className="font-medium text-foreground">{email}</span>.
                        Click the link in the email to set a new password.
                    </p>
                    <Button
                        onClick={() => setSuccess(false)}
                        variant="outline"
                        className="w-full h-12"
                    >
                        Try another email
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <div className="p-4">
                <Link to="/auth" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                    <span>Back</span>
                </Link>
            </div>

            <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-display font-semibold text-foreground">Forgot Password</h1>
                    <p className="text-muted-foreground mt-2">
                        Enter your email address and we'll send you a link to reset your password.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="hello@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-12"
                            disabled={loading}
                            autoFocus
                        />
                    </div>

                    <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending Link...
                            </>
                        ) : (
                            "Send Reset Link"
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default ForgotPassword;
