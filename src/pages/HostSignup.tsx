import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft, Building2, Phone, CheckCircle, LogOut } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const phoneSchema = z.string().min(10, "Valid phone number required");

const HostSignup = () => {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [idNumber, setIdNumber] = useState("");

    const [checkEmail, setCheckEmail] = useState(false);

    // Redirect if already logged in as host
    useEffect(() => {
        if (user?.user_metadata?.role === "host") {
            navigate("/host");
        }
    }, [user, navigate]);

    // If logged in as guest, show prompts to sign out or go to dashboard
    if (user && user.user_metadata?.role !== "host") {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
                <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-6">
                    <CheckCircle className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-2xl font-display font-semibold mb-2">You are logged in</h1>
                <p className="text-muted-foreground mb-8">
                    You are currently logged in as <strong>{user.email}</strong> (Guest).<br />
                    To create a Host account, please sign out first.
                </p>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={() => navigate("/")}>
                        Go to Dashboard
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={async () => {
                            await signOut();
                            // form will show after sign out
                        }}
                    >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                    </Button>
                </div>
            </div>
        );
    }

    const validateForm = () => {
        const emailResult = emailSchema.safeParse(email);
        if (!emailResult.success) {
            toast.error(emailResult.error.errors[0].message);
            return false;
        }

        const passwordResult = passwordSchema.safeParse(password);
        if (!passwordResult.success) {
            toast.error(passwordResult.error.errors[0].message);
            return false;
        }

        if (!fullName.trim()) {
            toast.error("Please enter your full name");
            return false;
        }

        if (!phoneSchema.safeParse(phone).success) {
            toast.error("Please enter a valid phone number");
            return false;
        }

        if (!businessName.trim()) {
            toast.error("Business/Property name is required for hosts");
            return false;
        }

        if (!idNumber.trim()) {
            toast.error("National ID or Passport number is required for verification");
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);

        try {
            const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
            const redirectUrl = `${appUrl}/host`;

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: redirectUrl,
                    data: {
                        full_name: fullName,
                        phone: phone,
                        business_name: businessName,
                        id_number: idNumber,
                        role: "host", // Explicitly setting host role
                        verification_status: "pending"
                    },
                },
            });

            if (error) {
                if (error.message.includes("User already registered")) {
                    toast.error("This email is already registered. Try signing in.");
                } else {
                    toast.error(error.message);
                }
                return;
            }

            if (data.session) {
                toast.success("Host account created successfully!");
                return;
            }

            toast.success("Verification email sent! Please check your inbox.");
            setCheckEmail(true);

        } catch (error) {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (checkEmail) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <CheckCircle className="h-10 w-10 text-primary" />
                </div>
                <h1 className="text-3xl font-display font-semibold mb-4">Verify your Host Account</h1>
                <p className="text-muted-foreground mb-8 max-w-md">
                    We've sent a verification link to <strong>{email}</strong>.
                    Once verified, you can access the Host Dashboard and start listing your properties.
                </p>
                <Button onClick={() => navigate("/auth")} variant="outline">
                    Back to Login
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <div className="p-4 flex justify-between items-center">
                <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-5 w-5" />
                    <span>Back</span>
                </Link>
                <span className="text-sm font-semibold text-primary">Host Registration</span>
            </div>

            <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-lg mx-auto w-full">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-display font-semibold text-foreground">Become a Host</h1>
                    <p className="text-muted-foreground mt-2">
                        Start earning by sharing your space or experiences.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input
                                id="fullName"
                                placeholder="John Doe"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="phone"
                                    placeholder="+254 7..."
                                    className="pl-9"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="businessName">Business or Property Name</Label>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="businessName"
                                placeholder="e.g. Sunny Villa Diani"
                                className="pl-9"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="idNumber">ID / Passport Number</Label>
                        <Input
                            id="idNumber"
                            placeholder="For identity verification"
                            value={idNumber}
                            onChange={(e) => setIdNumber(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="host@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Create a strong password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pr-12"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    <Button type="submit" className="w-full h-12 text-base mt-2" disabled={loading}>
                        {loading ? "Creating Host Account..." : "Create Host Account"}
                    </Button>
                </form>

                <p className="text-center mt-6 text-muted-foreground text-sm">
                    Already a host?{" "}
                    <Link to="/auth" className="text-primary font-semibold hover:underline">
                        Sign In here
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default HostSignup;
