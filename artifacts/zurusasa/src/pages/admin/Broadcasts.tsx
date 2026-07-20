import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Broadcasts = () => {
    const [loading, setLoading] = useState(false);
    const [template, setTemplate] = useState("generic");
    const [subject, setSubject] = useState("");
    const [title, setTitle] = useState("");
    const [heroImage, setHeroImage] = useState("");
    const [message, setMessage] = useState("");

    const handleSend = async (testMode: boolean = false) => {
        if (!subject || !title || (template === "generic" && !message)) {
            toast.error("Please fill in all required fields.");
            return;
        }

        setLoading(true);
        const toastId = toast.loading(testMode ? "Sending test email..." : "Dispatching broadcast to all contacts...");

        try {
            const payload: any = {
                emailType: template,
                subject,
                title,
                messageHtml: message ? `<p>${message.replace(/\n/g, '<br/>')}</p>` : "",
                heroImageUrl: heroImage,
            };

            if (testMode) {
                // Find the current admin's email to send the test
                const { data: { user } } = await supabase.auth.getUser();
                if (!user?.email) throw new Error("Could not fetch your email address for testing.");
                payload.testEmailRecipient = user.email;
            }

            const { data, error } = await supabase.functions.invoke('send-broadcast', {
                body: payload
            });

            if (error) throw error;

            if (data?.error) {
                throw new Error(data.error.message || "Failed to send broadcast");
            }

            toast.success(testMode ? "Test email sent successfully!" : "Broadcast dispatched successfully!", { id: toastId });

            if (!testMode) {
                // Clear form after real send
                setSubject("");
                setTitle("");
                setHeroImage("");
                setMessage("");
            }

        } catch (error: any) {
            console.error("Broadcast error:", error);
            toast.error(error.message || "Failed to send email. Check console.", { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="min-h-screen bg-background p-6 md:p-10 pt-24 md:pt-10">
                <div className="max-w-3xl mx-auto space-y-8">

                    <div className="flex items-center gap-4">
                        <Link to="/admin" className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-display font-semibold text-foreground tracking-tight">Email Broadcasts</h1>
                        </div>
                    </div>

                    <div className="glass p-8 rounded-3xl border border-border/50 space-y-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <Sparkles className="h-32 w-32" />
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div className="space-y-2">
                                <Label>Template Type</Label>
                                <Select value={template} onValueChange={setTemplate}>
                                    <SelectTrigger className="w-full h-12">
                                        <SelectValue placeholder="Select a template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="generic">Standard Broadcast (Text/Image)</SelectItem>
                                        <SelectItem value="summer_yachts">ZuruSasa Summer Yacht Drops (High-End)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Subject Line</Label>
                                <Input
                                    placeholder="e.g. Exclusive Early Access: 2026 Yacht Season"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="h-12"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Internal Title / Main Heading</Label>
                                <Input
                                    placeholder="e.g. Your 24-Hour Exclusive Access"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="h-12"
                                />
                            </div>

                            {template === "generic" && (
                                <div className="space-y-2">
                                    <Label>Hero Image URL (Optional)</Label>
                                    <Input
                                        placeholder="https://images.unsplash.com/..."
                                        value={heroImage}
                                        onChange={(e) => setHeroImage(e.target.value)}
                                        className="h-12"
                                    />
                                    <p className="text-xs text-muted-foreground">Provide a direct link to an image to include at the top.</p>
                                </div>
                            )}

                            {template === "generic" && (
                                <div className="space-y-2">
                                    <Label>Message Body</Label>
                                    <Textarea
                                        placeholder="Write your email content here. Basic HTML is supported..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        className="min-h-[200px] resize-y"
                                    />
                                </div>
                            )}

                            {template === "summer_yachts" && (
                                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl mt-4">
                                    <h4 className="font-semibold text-primary text-sm mb-2">Summer Yachts Template Selected</h4>
                                    <p className="text-sm text-foreground/80">
                                        This template uses a highly curated, premium coded layout with preset content blocks, images, and styling. The <strong>Message Body</strong> and <strong>Hero Image</strong> inputs are disabled. Only the Subject Line and Internal Title will be injected dynamically into the template.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="pt-6 border-t border-border flex flex-col sm:flex-row gap-4 justify-end relative z-10">
                            <Button
                                variant="outline"
                                className="h-12 px-6"
                                onClick={() => handleSend(true)}
                                disabled={loading}
                            >
                                Send Test Email
                            </Button>
                            <Button
                                onClick={() => handleSend(false)}
                                className="h-12 px-8 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5"
                                disabled={loading}
                            >
                                <Send className="h-4 w-4" />
                                Dispatch to Audience
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default Broadcasts;
