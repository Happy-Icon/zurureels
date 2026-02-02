import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Loader2, Save, ShieldCheck, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VerificationBadge } from "@/components/profile/VerificationBadge";
import { LanguageSelector } from "@/components/profile/LanguageSelector";
import { Separator } from "@/components/ui/separator";

export const PersonalInfo = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    // Basic Info
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");

    // Digital Identity
    const [languages, setLanguages] = useState<string[]>([]);
    const [emergencyContact, setEmergencyContact] = useState({ name: "", phone: "", relationship: "" });
    const [verificationBadges, setVerificationBadges] = useState({ email: false, phone: false, identity: false });
    const [completeness, setCompleteness] = useState(0);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;

            try {
                // Initialize from Auth Meta
                setFullName(user.user_metadata?.full_name || "");
                setPhone(user.user_metadata?.phone || "");
                setVerificationBadges(prev => ({ ...prev, email: !!user.email_confirmed_at }));

                // Fetch from Profiles Table
                const { data, error } = await (supabase as any)
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('Error fetching profile:', error);
                }

                if (data) {
                    const profileData = data as any;
                    if (profileData.languages) setLanguages(profileData.languages);
                    if (profileData.emergency_contact) setEmergencyContact(profileData.emergency_contact as any);
                    if (profileData.verification_badges) {
                        setVerificationBadges(prev => ({
                            ...prev,
                            ...profileData.verification_badges as any,
                            email: !!user.email_confirmed_at // Always trust auth status for email
                        }));
                    }
                }
            } catch (error) {
                console.error("Error loading profile", error);
            } finally {
                setPageLoading(false);
            }
        };

        fetchProfile();
    }, [user]);

    // Calculate completeness on change
    useEffect(() => {
        let score = 0;
        if (fullName) score += 15;
        if (phone) score += 15;
        if (user?.email) score += 10;
        if (languages.length > 0) score += 10;
        if (emergencyContact.name) score += 15;
        if (verificationBadges.identity) score += 35; // Big weight for ID

        setCompleteness(Math.min(score, 100));
    }, [fullName, phone, languages, emergencyContact, verificationBadges, user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);

        try {
            // 1. Update Auth Metadata (for basic backward compatibility)
            const { error: authError } = await supabase.auth.updateUser({
                data: { full_name: fullName, phone: phone }
            });
            if (authError) throw authError;

            // 2. Update Profiles Table (Extended Data)
            const updates = {
                id: user.id,
                full_name: fullName,
                phone: phone,
                languages: languages,
                emergency_contact: emergencyContact,
                verification_badges: verificationBadges,
                profile_completeness: completeness,
                updated_at: new Date().toISOString(),
            };

            // @ts-ignore - profiles table exists in database
            const { error: profileError } = await (supabase as any)
                .from('profiles')
                .upsert(updates as any);

            if (profileError) throw profileError;

            toast.success("Digital identity updated successfully");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (pageLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center p-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="pb-20 md:pb-8">
                {/* Header */}
                <div className="p-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                    <div className="flex items-center justify-between">
                        <Link to="/profile" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                            <span>Back to Profile</span>
                        </Link>
                        <h1 className="font-semibold text-lg hidden md:block">Digital Identity Center</h1>
                    </div>
                </div>

                <div className="p-4 max-w-2xl mx-auto space-y-8">

                    {/* Progress Section */}
                    <div className="space-y-4 bg-muted/30 p-6 rounded-xl border">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h2 className="font-semibold flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-primary" />
                                    Trust Score
                                </h2>
                                <p className="text-sm text-muted-foreground">Complete your profile to build trust</p>
                            </div>
                            <span className="text-2xl font-bold text-primary">{completeness}%</span>
                        </div>
                        <Progress value={completeness} className="h-2" />
                        {completeness < 100 && (
                            <div className="flex items-start gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-950/30 p-3 rounded-md">
                                <AlertTriangle className="h-4 w-4 mt-0.5" />
                                <p>Add a government ID to reach 100% verified status.</p>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSave} className="space-y-8">

                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h3 className="font-medium text-lg">Basic Information</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fullName">Full Name</Label>
                                    <Input
                                        id="fullName"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Enter your full name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input
                                        id="phone"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+254 7..."
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input value={user?.email || ""} disabled className="bg-muted" />
                            </div>
                        </div>

                        <Separator />

                        {/* Languages */}
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-medium text-lg">Languages Spoken</h3>
                                <p className="text-sm text-muted-foreground">Help hosts and guests understand you better.</p>
                            </div>
                            <LanguageSelector
                                selectedLanguages={languages}
                                onChange={setLanguages}
                            />
                        </div>

                        <Separator />

                        {/* Verification Badges */}
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-medium text-lg">Verifications</h3>
                                <p className="text-sm text-muted-foreground">Verified profiles get 3x more bookings.</p>
                            </div>
                            <div className="grid gap-3">
                                <VerificationBadge
                                    type="email"
                                    status={verificationBadges.email}
                                    label="Email Address"
                                />
                                <VerificationBadge
                                    type="phone"
                                    status={!!phone && phone.length > 5}
                                    label="Phone Number"
                                />
                                <VerificationBadge
                                    type="government_id"
                                    status={verificationBadges.identity}
                                    label="Government ID"
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* Emergency Contact */}
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-medium text-lg">Emergency Contact</h3>
                                <p className="text-sm text-muted-foreground">Trusted contact for safety purposes.</p>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="ecName">Contact Name</Label>
                                    <Input
                                        id="ecName"
                                        value={emergencyContact.name}
                                        onChange={(e) => setEmergencyContact(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ecRel">Relationship</Label>
                                    <Input
                                        id="ecRel"
                                        value={emergencyContact.relationship}
                                        onChange={(e) => setEmergencyContact(prev => ({ ...prev, relationship: e.target.value }))}
                                        placeholder="e.g. Brother, Friend"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="ecPhone">Contact Phone</Label>
                                    <Input
                                        id="ecPhone"
                                        value={emergencyContact.phone}
                                        onChange={(e) => setEmergencyContact(prev => ({ ...prev, phone: e.target.value }))}
                                        placeholder="+254 7..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button type="submit" size="lg" className="w-full md:w-auto min-w-[200px]" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </MainLayout>
    );
};
