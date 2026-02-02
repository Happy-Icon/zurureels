import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Bell, Mail, Smartphone, MessageCircle, Globe, Shield, Tag, Calendar, Save, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

export const Notifications = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    const [settings, setSettings] = useState({
        channels: { email: true, sms: true, push: true, whatsapp: false },
        trips: { bookings: true, checkin: true, messages: true },
        security: { login: true, password: true },
        marketing: { price_drops: false, recommendations: true, newsletter: true, frequency: "weekly" }
    });

    useEffect(() => {
        const fetchSettings = async () => {
            if (!user) return;
            try {
                // @ts-ignore - profiles table exists in database
                const { data } = await (supabase as any)
                    .from('profiles')
                    .select('notification_settings')
                    .eq('id', user.id)
                    .single();

                if (data && (data as any).notification_settings) {
                    setSettings((data as any).notification_settings as any);
                }
            } catch (error) {
                console.error("Error loading notifications:", error);
            } finally {
                setPageLoading(false);
            }
        };
        fetchSettings();
    }, [user]);

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // @ts-ignore - profiles table exists in database
            const { error } = await (supabase as any)
                .from('profiles')
                .update({ notification_settings: settings })
                .eq('id', user.id);

            if (error) throw error;
            toast.success("Notification preferences saved");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const updateChannel = (key: keyof typeof settings.channels, value: boolean) => {
        setSettings(prev => ({
            ...prev,
            channels: { ...prev.channels, [key]: value }
        }));
    };

    const updateMarketing = (key: keyof typeof settings.marketing, value: any) => {
        setSettings(prev => ({
            ...prev,
            marketing: { ...prev.marketing, [key]: value }
        }));
    };

    const updateTrips = (key: keyof typeof settings.trips, value: boolean) => {
        setSettings(prev => ({
            ...prev,
            trips: { ...prev.trips, [key]: value }
        }));
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
                        <h1 className="font-semibold text-lg hidden md:block">Notifications</h1>
                    </div>
                </div>

                <div className="p-4 max-w-2xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex items-start gap-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Bell className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg">Communication Preferences</h2>
                            <p className="text-sm text-muted-foreground">Choose how and when we contact you.</p>
                        </div>
                    </div>

                    {/* Channel Control */}
                    <div className="space-y-6">
                        <h3 className="font-medium text-lg">Communication Channels</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="flex items-center justify-between p-4 border rounded-xl">
                                <div className="flex items-center gap-3">
                                    <Mail className="h-5 w-5 text-muted-foreground" />
                                    <span>Email</span>
                                </div>
                                <Switch checked={settings.channels.email} onCheckedChange={(v) => updateChannel('email', v)} />
                            </div>
                            <div className="flex items-center justify-between p-4 border rounded-xl">
                                <div className="flex items-center gap-3">
                                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                                    <span>SMS Messages</span>
                                </div>
                                <Switch checked={settings.channels.sms} onCheckedChange={(v) => updateChannel('sms', v)} />
                            </div>
                            <div className="flex items-center justify-between p-4 border rounded-xl">
                                <div className="flex items-center gap-3">
                                    <Globe className="h-5 w-5 text-muted-foreground" />
                                    <span>Browser Push</span>
                                </div>
                                <Switch checked={settings.channels.push} onCheckedChange={(v) => updateChannel('push', v)} />
                            </div>
                            <div className="flex items-center justify-between p-4 border rounded-xl">
                                <div className="flex items-center gap-3">
                                    <MessageCircle className="h-5 w-5 text-[#25D366]" />
                                    <span>WhatsApp</span>
                                </div>
                                <Switch
                                    checked={settings.channels.whatsapp}
                                    onCheckedChange={(v) => updateChannel('whatsapp', v)}
                                    className="data-[state=checked]:bg-[#25D366]"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Trips & Hosting */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-lg font-medium">
                            <Calendar className="h-5 w-5 text-primary" />
                            <h3>Trips & Hosting</h3>
                        </div>
                        <div className="space-y-4 pl-7">
                            <div className="flex items-center justify-between">
                                <Label>Booking Requests</Label>
                                <Switch checked={settings.trips.bookings} onCheckedChange={(v) => updateTrips('bookings', v)} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>Check-in Reminders</Label>
                                <Switch checked={settings.trips.checkin} onCheckedChange={(v) => updateTrips('checkin', v)} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>Guest Messages</Label>
                                <Switch checked={settings.trips.messages} onCheckedChange={(v) => updateTrips('messages', v)} />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Account & Security */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-lg font-medium">
                            <Shield className="h-5 w-5 text-primary" />
                            <h3>Account & Security</h3>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg space-y-4 border">
                            <div className="flex items-center justify-between opacity-70">
                                <div className="space-y-0.5">
                                    <Label>New Device Login</Label>
                                    <p className="text-xs text-muted-foreground">Always on for your security</p>
                                </div>
                                <Switch checked={true} disabled />
                            </div>
                            <div className="flex items-center justify-between opacity-70">
                                <div className="space-y-0.5">
                                    <Label>Password Changes</Label>
                                    <p className="text-xs text-muted-foreground">Always on for your security</p>
                                </div>
                                <Switch checked={true} disabled />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Marketing & Tips */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-lg font-medium">
                            <Tag className="h-5 w-5 text-primary" />
                            <h3>Marketing & Tips</h3>
                        </div>
                        {!settings.channels.email && (
                            <div className="p-3 bg-orange-50 text-orange-700 text-sm rounded-lg flex gap-2">
                                <Mail className="h-4 w-4" />
                                Email notifications are turned off globally. Enable Email above to customize these.
                            </div>
                        )}
                        <div className={`space-y-4 pl-7 ${!settings.channels.email ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="flex items-center justify-between">
                                <Label>Price Drops & Deals</Label>
                                <Switch checked={settings.marketing.price_drops} onCheckedChange={(v) => updateMarketing('price_drops', v)} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>Personalized Recommendations</Label>
                                <Switch checked={settings.marketing.recommendations} onCheckedChange={(v) => updateMarketing('recommendations', v)} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>ZuruSasa Newsletter</Label>
                                <Switch checked={settings.marketing.newsletter} onCheckedChange={(v) => updateMarketing('newsletter', v)} />
                            </div>

                            {/* Frequency */}
                            <div className="pt-2">
                                <Label className="block mb-2 text-sm text-muted-foreground">Email Frequency</Label>
                                <Select
                                    value={settings.marketing.frequency}
                                    onValueChange={(v) => updateMarketing('frequency', v)}
                                    disabled={!settings.marketing.newsletter}
                                >
                                    <SelectTrigger className="w-full md:w-[240px]">
                                        <SelectValue placeholder="Select frequency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="daily">Daily Digest</SelectItem>
                                        <SelectItem value="weekly">Weekly Summary</SelectItem>
                                        <SelectItem value="monthly">Monthly Newsletter</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-6">
                        <Button onClick={handleSave} className="w-full md:w-auto min-w-[200px]" size="lg" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Preferences
                        </Button>
                    </div>

                </div>
            </div>
        </MainLayout>
    );
};
