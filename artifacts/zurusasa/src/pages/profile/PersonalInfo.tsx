import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Loader2, Save, ShieldCheck, AlertTriangle, Upload, FileText, CheckCircle2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon } from "lucide-react";

export const PersonalInfo = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    // Basic Info
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [bio, setBio] = useState("");

    // Digital Identity
    const [languages, setLanguages] = useState<string[]>([]);
    const [emergencyContact, setEmergencyContact] = useState({ name: "", phone: "", relationship: "" });
    const [verificationBadges, setVerificationBadges] = useState({ email: false, phone: false, identity: false });
    const [completeness, setCompleteness] = useState(0);

    const [uploading, setUploading] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [idUrl, setIdUrl] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;

            try {
                // Initialize from Auth Meta
                setFullName(user.user_metadata?.full_name || "");
                setPhone(user.user_metadata?.phone || "");
                setVerificationBadges(prev => ({ ...prev, email: !!user.email_confirmed_at }));

                // Fetch from Profiles Table
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (data) {
                    if (data.languages) setLanguages(data.languages);
                    if (data.emergency_contact) setEmergencyContact(data.emergency_contact as any);
                    if (data.verification_badges) {
                        const badges = data.verification_badges as any;
                        setVerificationBadges(prev => ({
                            ...prev,
                            ...badges,
                            email: !!user.email_confirmed_at 
                        }));
                        if (badges.id_url) setIdUrl(badges.id_url);
                    }
                    if (data.metadata) {
                        const meta = data.metadata as any;
                        if (meta.avatar_url) setAvatarUrl(meta.avatar_url);
                        if (meta.bio) setBio(meta.bio);
                    }
                    // If bio exists at top level (from master migration)
                    if (data.bio) setBio(data.bio);
                }
            } catch (error) {
                console.error("Error loading profile", error);
            } finally {
                setPageLoading(false);
            }
        };

        fetchProfile();
    }, [user]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setAvatarUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const filePath = `${user.id}/avatar_${Math.random()}.${fileExt}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    upsert: true
                });

            if (uploadError) {
                if (uploadError.message.includes("bucket not found")) {
                    throw new Error("The 'avatars' storage bucket was not found. Please go to Supabase Dashboard -> Storage -> New Bucket and create a PUBLIC bucket named 'avatars'.");
                }
                throw uploadError;
            }

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            setAvatarUrl(publicUrl);
            
            // Update profile metadata immediately
            const { data: profile } = await supabase
                .from('profiles')
                .select('metadata')
                .eq('id', user.id)
                .single();

            const newMetadata = {
                ...(profile?.metadata as any || {}),
                avatar_url: publicUrl
            };

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ metadata: newMetadata })
                .eq('id', user.id);

            if (updateError) throw updateError;
            toast.success("Profile picture updated!");
        } catch (error: any) {
            toast.error("Upload failed: " + error.message);
        } finally {
            setAvatarUploading(false);
        }
    };

    const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const filePath = `${user.id}/id_${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('identity-documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const newIdUrl = filePath;
            setIdUrl(newIdUrl);
            
            // Update profile with pending ID status
            const newBadges = {
                ...verificationBadges,
                id_url: newIdUrl,
                id_status: 'pending'
            };

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ verification_badges: newBadges })
                .eq('id', user.id);

            if (updateError) throw updateError;
            setVerificationBadges(newBadges);
            toast.success("ID document uploaded! It is now pending review.");
        } catch (error: any) {
            toast.error("Upload failed: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    // Calculate completeness on change
    useEffect(() => {
        let score = 0;
        if (fullName) score += 15;
        if (phone) score += 15;
        if (bio) score += 10;
        if (user?.email) score += 10;
        if (languages.length > 0) score += 10;
        if (emergencyContact.name) score += 10;
        if (verificationBadges.identity) score += 30; // Big weight for ID

        setCompleteness(Math.min(score, 100));
    }, [fullName, phone, languages, emergencyContact, verificationBadges, user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);

        try {
            // 1. Update Auth Metadata
            const { error: authError } = await supabase.auth.updateUser({
                data: { full_name: fullName, phone: phone }
            });
            if (authError) throw authError;

            // 2. Update Profiles Table
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName,
                    phone: phone,
                    bio: bio,
                    languages: languages,
                    emergency_contact: emergencyContact,
                    verification_badges: verificationBadges,
                    profile_completeness: completeness,
                    metadata: {
                        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
                        bio: bio
                    },
                    updated_at: new Date().toISOString(),
                })
                .eq('id', user.id);

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

                    {/* Profile Picture Section */}
                    <div className="flex flex-col items-center gap-4 p-6 bg-card border rounded-xl shadow-sm">
                        <div className="relative group">
                            <Avatar className="h-24 w-24 border-2 border-primary/20">
                                <AvatarImage src={avatarUrl || ""} />
                                <AvatarFallback className="bg-primary/5">
                                    <UserIcon className="h-10 w-10 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                            <label 
                                htmlFor="avatar-upload" 
                                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            >
                                {avatarUploading ? (
                                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                                ) : (
                                    <Upload className="h-6 w-6 text-white" />
                                )}
                                <input 
                                    id="avatar-upload" 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={handleAvatarUpload}
                                    disabled={avatarUploading}
                                />
                            </label>
                        </div>
                        <div className="text-center">
                            <h3 className="font-medium">Profile Picture</h3>
                            <p className="text-xs text-muted-foreground mt-1">Upload a clear photo for your profile</p>
                        </div>
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
                            <div className="space-y-2">
                                <Label htmlFor="bio">Your Bio</Label>
                                <textarea
                                    id="bio"
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    placeholder="Tell the community about yourself..."
                                    className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                <p className="text-[10px] text-muted-foreground">Share your background, interests, and why you love ZuruSasa.</p>
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
                                
                                <div className="p-4 border rounded-xl bg-card space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-8 w-8 rounded-full flex items-center justify-center",
                                                verificationBadges.identity ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"
                                            )}>
                                                <FileText className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">Government ID</p>
                                                <p className="text-xs text-muted-foreground">Passport, ID Card or Driving License</p>
                                            </div>
                                        </div>
                                        {verificationBadges.identity ? (
                                            <Badge className="bg-emerald-500 text-white border-none gap-1">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Verified
                                            </Badge>
                                        ) : idUrl ? (
                                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 gap-1">
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                Pending Review
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="text-muted-foreground font-normal">
                                                Not Provided
                                            </Badge>
                                        )}
                                    </div>

                                    {!verificationBadges.identity && !idUrl && (
                                        <div className="pt-2">
                                            <Label 
                                                htmlFor="id-upload" 
                                                className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-muted-foreground/20 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    {uploading ? (
                                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                    ) : (
                                                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                                    )}
                                                    <p className="text-sm text-muted-foreground">Click to upload ID (PDF, JPG, PNG)</p>
                                                    <p className="text-[10px] text-muted-foreground/60 mt-1">Max file size: 5MB</p>
                                                </div>
                                                <Input 
                                                    id="id-upload" 
                                                    type="file" 
                                                    className="hidden" 
                                                    accept="image/*,.pdf"
                                                    onChange={handleIdUpload}
                                                    disabled={uploading}
                                                />
                                            </Label>
                                        </div>
                                    )}
                                </div>
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
