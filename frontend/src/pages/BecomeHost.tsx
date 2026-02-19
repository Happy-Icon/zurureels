import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Phone, ArrowLeft } from "lucide-react";
import { z } from "zod";

const phoneSchema = z.string().min(10, "Valid phone number required");

const BecomeHost = () => {
    const navigate = useNavigate();
    const { user } = useAuth(); // Assuming refreshSession is available or we reload
    const [loading, setLoading] = useState(false);

    // Form State
    const [phone, setPhone] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [idNumber, setIdNumber] = useState("");

    // Redirect if not logged in
    useEffect(() => {
        if (!user) {
            toast.error("Please sign in to become a host");
            navigate("/auth");
        }
        if (user?.user_metadata?.role === "host") {
            navigate("/host");
        }
    }, [user, navigate]);

    const validateForm = () => {
        if (!phoneSchema.safeParse(phone).success) {
            toast.error("Please enter a valid phone number");
            return false;
        }

        if (!businessName.trim()) {
            toast.error("Business/Property name is required");
            return false;
        }

        if (!idNumber.trim()) {
            toast.error("National ID or Passport number is required");
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm() || !user) return;

        setLoading(true);

        try {
            // 1. Update Profile in Validation Table (profiles)
            const { error: profileError } = await supabase
                .from('profiles')
                // @ts-ignore
                .update({
                    phone: phone,
                    business_name: businessName,
                    id_number: idNumber,
                    verification_status: 'none',
                    // We don't change 'role' column in profiles if it doesn't exist or is separate, 
                    // but we update metadata below.
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // 2. Update User Metadata to 'host'
            const { error: authError } = await supabase.auth.updateUser({
                data: {
                    role: 'host',
                    phone: phone,
                    business_name: businessName,
                    id_number: idNumber,
                    verification_status: 'none'
                }
            });

            if (authError) throw authError;

            // 3. Send Email
            console.log("Attempting to send host application email...");
            const { error: emailError } = await supabase.functions.invoke('send-email', {
                body: {
                    type: 'host_application',
                    email: user.email,
                    data: {
                        name: user.user_metadata?.full_name || user.email?.split('@')[0]
                    }
                }
            });

            if (emailError) console.error("Email function error:", emailError);
            else console.log("Email function invoked successfully");

            // 4. Success
            toast.success("Application received! Check your email for verification instructions.");

            // Redirect to City Pulse
            navigate("/");
            window.location.reload();

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to upgrade account");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <div className="p-4 flex justify-between items-center">
                <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-5 w-5" />
                    <span>Back</span>
                </Link>
                <span className="text-sm font-semibold text-primary">Host Application</span>
            </div>

            <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-lg mx-auto w-full">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-display font-semibold text-foreground">Become a Host</h1>
                    <p className="text-muted-foreground mt-2">
                        Complete your profile to start listing your properties or experiences.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

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

                    <Button type="submit" className="w-full h-12 text-base mt-4" disabled={loading}>
                        {loading ? "Submitting..." : "Submit Application"}
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default BecomeHost;
