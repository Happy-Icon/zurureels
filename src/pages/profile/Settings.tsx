import { MainLayout } from "@/components/layout/MainLayout";
import { ArrowLeft, Globe, Zap, Accessibility, Trash2, Smartphone, Moon, Wifi } from "lucide-react";
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
import { useState } from "react";

const Settings = () => {
    const [dataSaver, setDataSaver] = useState(false);
    const [highContrast, setHighContrast] = useState(false);
    const [textSize, setTextSize] = useState([16]);

    const handleClearCache = () => {
        toast.info("Clearing app cache...", { duration: 1000 });
        setTimeout(() => {
            toast.success("Cache cleared successfully. App is optimized.");
        }, 1500);
    };

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
                                <Select defaultValue="en">
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
                                <Select defaultValue="kes">
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
