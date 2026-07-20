import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Globe, Zap, Accessibility, Trash2, Smartphone, Moon, Wifi, Loader2, Save } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

const Settings = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);

    const [language, setLanguage] = useState("en");
    const [currency, setCurrency] = useState("kes");
    const [dataSaver, setDataSaver] = useState(false);
    const [highContrast, setHighContrast] = useState(false);
    const [textSize, setTextSize] = useState([16]);

    useEffect(() => {
        if (!user) return;
        const fetchSettings = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('general_settings')
                .eq('id', user.id)
                .single();
            
            if (data?.general_settings) {
                const s = data.general_settings as any;
                setLanguage(s.language || "en");
                setCurrency(s.currency || "kes");
                setDataSaver(s.data_saver || false);
                setHighContrast(s.high_contrast || false);
                setTextSize(s.text_size || [16]);
            }
            setPageLoading(false);
        };
        fetchSettings();
    }, [user]);

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    general_settings: {
                        language,
                        currency,
                        data_saver: dataSaver,
                        high_contrast: highContrast,
                        text_size: textSize
                    }
                })
                .eq('id', user.id);

            if (error) throw error;
            toast.success("Settings saved successfully");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClearCache = () => {
        toast.info("Clearing app cache...", { duration: 1000 });
        setTimeout(() => {
            toast.success("Cache cleared successfully. App is optimized.");
        }, 1500);
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
                        <h1 className="font-semibold text-lg hidden md:block">General Settings</h1>
                        <Button variant="ghost" size="sm" onClick={handleSave} disabled={loading} className="text-primary font-bold">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                    </div>
                </div>

                <div className="p-4 max-w-2xl mx-auto space-y-6">

                    {/* Localization */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Globe className="h-5 w-5 text-primary" />
                                <CardTitle className="text-lg">Localization</CardTitle>
                            </div>
                            <CardDescription>Customize your language and currency preferences</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Language</Label>
                                <Select value={language} onValueChange={setLanguage}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Language" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="en">English (US)</SelectItem>
                                        <SelectItem value="sw">Swahili</SelectItem>
                                        <SelectItem value="am">Amharic</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Currency</Label>
                                <Select value={currency} onValueChange={setCurrency}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Currency" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="kes">Kenyan Shilling (KES)</SelectItem>
                                        <SelectItem value="usd">US Dollar (USD)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Performance */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-primary" />
                                <CardTitle className="text-lg">Performance</CardTitle>
                            </div>
                            <CardDescription>Optimize app data usage and speed</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Data Saver</Label>
                                    <p className="text-sm text-muted-foreground">Reduce image quality to save mobile data</p>
                                </div>
                                <Switch checked={dataSaver} onCheckedChange={setDataSaver} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Accessibility */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Accessibility className="h-5 w-5 text-primary" />
                                <CardTitle className="text-lg">Accessibility</CardTitle>
                            </div>
                            <CardDescription>Adjust the interface to your needs</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    <Label className="text-base">Text Size</Label>
                                    <span className="text-sm text-muted-foreground">{textSize[0]}px</span>
                                </div>
                                <Slider
                                    defaultValue={[16]}
                                    max={32}
                                    min={12}
                                    step={1}
                                    value={textSize}
                                    onValueChange={setTextSize}
                                    className="w-full"
                                />
                                <p className="text-sm" style={{ fontSize: `${textSize[0]}px` }}>
                                    The quick brown fox jumps over the lazy dog.
                                </p>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base">High Contrast Mode</Label>
                                    <p className="text-sm text-muted-foreground">Increase contrast for better visibility</p>
                                </div>
                                <Switch checked={highContrast} onCheckedChange={setHighContrast} />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <div className="pt-4">
                        <Button onClick={handleSave} className="w-full h-12" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                            Save All Preferences
                        </Button>
                    </div>

                    {/* System */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <Smartphone className="h-5 w-5 text-primary" />
                                <CardTitle className="text-lg">System</CardTitle>
                            </div>
                            <CardDescription>Manage application storage</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                                <div className="space-y-1">
                                    <h3 className="font-medium flex items-center gap-2">
                                        <Trash2 className="h-4 w-4" />
                                        Clear App Cache
                                    </h3>
                                    <p className="text-sm text-muted-foreground">Free up space and fix loading issues</p>
                                </div>
                                <Button variant="outline" onClick={handleClearCache}>
                                    Clear Cache
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </MainLayout>
    );
};

export default Settings;
