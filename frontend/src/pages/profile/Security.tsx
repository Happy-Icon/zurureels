import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Shield, Smartphone, Laptop, MapPin, Loader2, Save, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail } from "lucide-react";

export const Security = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    // Settings
    const [twoFactor, setTwoFactor] = useState(false);
    const [loginAlerts, setLoginAlerts] = useState(true);

    // Mock Sessions Data
    const sessions = [
        {
            id: 1,
            device: "Windows PC - Chrome",
            location: "Nairobi, Kenya",
            ip: "102.135.24.12",
            current: true,
            icon: Laptop,
            lastActive: "Now"
        },
        {
            id: 2,
            device: "iPhone 14 Pro",
            location: "Mombasa, Kenya",
            ip: "197.234.12.55",
            current: false,
            icon: Smartphone,
            lastActive: "2 days ago"
        }
    ];

    useEffect(() => {
        const fetchSettings = async () => {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('security_settings')
                    .eq('id', user.id)
                    .single();

                if (data && data.security_settings) {
                    const settings = data.security_settings as any;
                    setTwoFactor(settings.two_factor || false);
                    setLoginAlerts(settings.login_alerts !== undefined ? settings.login_alerts : true);
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setPageLoading(false);
            }
        };

        fetchSettings();
    }, [user]);

    const handleTestEmail = async () => {
        if (!user?.email) return;
        try {
            toast.loading("Sending test email...");
            const { error } = await supabase.functions.invoke('send-email', {
                body: {
                    type: 'security',
                    email: user.email,
                    data: {
                        message: "This is a test security alert triggered from your security settings."
                    }
                }
            });

            if (error) throw error;
            toast.dismiss();
            toast.success("Test email sent! Check your inbox.");
        } catch (error: any) {
            toast.dismiss();
            toast.error("Failed to send test email: " + error.message);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    security_settings: {
                        two_factor: twoFactor,
                        login_alerts: loginAlerts,
                        sms_notifications: false
                    }
                })
                .eq('id', user.id);

            if (error) throw error;
            toast.success("Security settings updated");
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
                        <h1 className="font-semibold text-lg hidden md:block">Security Center</h1>
                    </div>
                </div>

                <div className="p-4 max-w-2xl mx-auto space-y-8">

                    {/* Header Section */}
                    <div className="flex items-start gap-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Shield className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg">Account Security</h2>
                            <p className="text-sm text-muted-foreground">Manage how you sign in and secure your account.</p>
                        </div>
                    </div>

                    {/* Active Sessions */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-lg flex items-center gap-2">
                            Where you are logged in
                        </h3>
                        <div className="grid gap-3">
                            {sessions.map((session) => (
                                <div key={session.id} className="flex items-start justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                                    <div className="flex gap-4">
                                        <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
                                            <session.icon className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium">{session.device}</p>
                                                {session.current && <Badge variant="secondary" className="text-xs">Current Device</Badge>}
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {session.location}
                                                </span>
                                                <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                                                <span>{session.ip}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Active: {session.lastActive}
                                            </p>
                                        </div>
                                    </div>
                                    {!session.current && (
                                        <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* 2FA Section */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Two-Factor Authentication (2FA)</Label>
                                <p className="text-sm text-muted-foreground max-w-sm">
                                    Add an extra layer of security. We'll verify your identity via SMS or Authenticator App when logging in.
                                </p>
                            </div>
                            <Switch
                                checked={twoFactor}
                                onCheckedChange={(checked) => {
                                    setTwoFactor(checked);
                                    // Auto-save on toggle for better UX, or wait for save button
                                }}
                            />
                        </div>

                        {twoFactor && (
                            <div className="p-4 border rounded-lg bg-muted/30 space-y-4 animate-in fade-in slide-in-from-top-4">
                                <h4 className="font-medium text-sm">Preferred Method</h4>
                                <div className="flex gap-4">
                                    <Button variant="outline" className="flex-1 border-primary text-primary bg-primary/5">
                                        Authenticator App
                                    </Button>
                                    <Button variant="outline" className="flex-1">
                                        SMS Message
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Login Alerts */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">Login Alerts</Label>
                            <p className="text-sm text-muted-foreground max-w-sm">
                                Get notified via email if someone logs into your account from an unrecognized device.
                            </p>
                        </div>
                        <Switch
                            checked={loginAlerts}
                            onCheckedChange={setLoginAlerts}
                        />
                    </div>

                    <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={handleTestEmail} className="gap-2">
                            <Mail className="h-4 w-4" />
                            Send Test Alert
                        </Button>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-6">
                        <Button onClick={handleSave} className="w-full md:w-auto min-w-[200px]" size="lg" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Security Settings
                        </Button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};
