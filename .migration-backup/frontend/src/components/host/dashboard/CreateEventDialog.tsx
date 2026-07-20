import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { uploadToCloudinary } from "@/lib/cloudinaryUpload";
import { format } from "date-fns";
import { CalendarIcon, Clock, Bell, Loader2, Image as ImageIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ReminderInterval, REMINDER_INTERVAL_OPTIONS } from "@/types/events";

interface CreateEventDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export const CreateEventDialog = ({ open, onOpenChange, onSuccess }: CreateEventDialogProps) => {
    const { user } = useAuth();
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("events");
    const [location, setLocation] = useState("");
    const [price, setPrice] = useState("");
    const [eventDate, setEventDate] = useState<Date | undefined>(undefined);
    const [eventTime, setEventTime] = useState("18:00");
    const [durationHours, setDurationHours] = useState("3");
    
    // Reminders selection
    const [reminderIntervals, setReminderIntervals] = useState<ReminderInterval[]>(["24h", "1h"]);
    
    // Cover Image states
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState("");
    const [uploadPercent, setUploadPercent] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    
    // Submit states
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setImageFile(file);
        setIsUploading(true);
        setUploadPercent(0);
        
        try {
            const result = await uploadToCloudinary(file, {
                resourceType: "image",
                folder: "zuru_event_banners",
                onProgress: (percent) => setUploadPercent(percent)
            });
            
            if (result.secure_url) {
                setImageUrl(result.secure_url);
                toast.success("Banner image uploaded successfully!");
            }
        } catch (error: any) {
            console.error("Banner upload failed:", error);
            toast.error(error.message || "Failed to upload banner image");
        } finally {
            setIsUploading(false);
        }
    };

    const toggleReminder = (val: ReminderInterval) => {
        if (reminderIntervals.includes(val)) {
            setReminderIntervals(reminderIntervals.filter(i => i !== val));
        } else {
            setReminderIntervals([...reminderIntervals, val]);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!user) {
            toast.error("You must be logged in to schedule an event");
            return;
        }

        if (!title.trim() || !location.trim() || !eventDate) {
            toast.error("Please fill in all required fields (Title, Location, Date)");
            return;
        }

        setIsSubmitting(true);

        try {
            // Combine Date and Time
            const combinedDateTime = new Date(eventDate);
            const [hours, minutes] = eventTime.split(":");
            combinedDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            // Calculate End Date based on duration
            const durationMs = parseInt(durationHours) * 60 * 60 * 1000;
            const endDateTime = new Date(combinedDateTime.getTime() + durationMs);

            // Cover Image logic: use uploaded image URL, or a dynamic premium Unsplash banner
            const finalImageUrl = imageUrl || `https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=800&auto=format&fit=crop`;

            const { error: eventError } = await supabase
                .from("events")
                .insert({
                    user_id: user.id,
                    title: title.trim(),
                    description: description.trim(),
                    location: location.trim(),
                    price: parseFloat(price) || 0,
                    event_date: combinedDateTime.toISOString(),
                    end_date: endDateTime.toISOString(),
                    category: category,
                    image_url: finalImageUrl,
                    notification_intervals: reminderIntervals,
                    status: "active",
                    is_live: false,
                    viewer_count: 0
                });

            if (eventError) throw eventError;

            toast.success("Event scheduled successfully!");
            
            // Reset state
            setTitle("");
            setDescription("");
            setCategory("events");
            setLocation("");
            setPrice("");
            setEventDate(undefined);
            setEventTime("18:00");
            setDurationHours("3");
            setImageFile(null);
            setImageUrl("");
            
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error("Failed to schedule event:", error);
            toast.error(error.message || "Failed to schedule event");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90vh] rounded-3xl bg-background/95 backdrop-blur-xl border border-white/10 shadow-2xl p-6">
                <DialogHeader className="pb-4 border-b border-white/10">
                    <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Schedule New Event
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSave} className="space-y-5 py-4">
                    {/* Event Title */}
                    <div className="space-y-2">
                        <Label htmlFor="event-title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event Title *</Label>
                        <Input
                            id="event-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Beach Party Sunset Session"
                            className="h-10 rounded-xl bg-muted/40 border-white/10 focus:border-primary focus:ring-1 focus:ring-primary"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="event-desc" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</Label>
                        <Textarea
                            id="event-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What makes this event special? Mention DJs, special packages, or vibe details."
                            className="min-h-20 rounded-xl bg-muted/40 border-white/10 resize-none focus:border-primary"
                        />
                    </div>

                    {/* Category & Price */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="event-cat" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</Label>
                            <select
                                id="event-cat"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full h-10 px-3 rounded-xl bg-muted/40 border border-white/10 text-sm text-foreground focus:border-primary outline-none"
                            >
                                <option value="events" className="bg-background">Events</option>
                                <option value="food" className="bg-background">Food & Dining</option>
                                <option value="drinks" className="bg-background">Drinks & Clubs</option>
                                <option value="adventure" className="bg-background">Adventure</option>
                                <option value="tours" className="bg-background">Tours</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="event-price" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price (KES)</Label>
                            <Input
                                id="event-price"
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="Free (0)"
                                className="h-10 rounded-xl bg-muted/40 border-white/10 focus:border-primary"
                            />
                        </div>
                    </div>

                    {/* Location */}
                    <div className="space-y-2">
                        <Label htmlFor="event-loc" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Location *</Label>
                        <Input
                            id="event-loc"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g. Nyali Beach, Mombasa"
                            className="h-10 rounded-xl bg-muted/40 border-white/10 focus:border-primary"
                            required
                        />
                    </div>

                    {/* Date & Time & Duration */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2 col-span-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date *</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className={cn(
                                            "w-full justify-start text-left font-normal h-10 rounded-xl bg-muted/40 border-white/10",
                                            !eventDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-primary" />
                                        {eventDate ? format(eventDate, "MMM d, yyyy") : <span>Pick date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={eventDate}
                                        onSelect={setEventDate}
                                        initialFocus
                                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary shrink-0" />
                                <Input
                                    type="time"
                                    className="pl-9 h-10 rounded-xl bg-muted/40 border-white/10 focus:border-primary"
                                    value={eventTime}
                                    onChange={(e) => setEventTime(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hours</Label>
                            <Input
                                type="number"
                                min="1"
                                className="h-10 rounded-xl bg-muted/40 border-white/10 focus:border-primary"
                                value={durationHours}
                                onChange={(e) => setDurationHours(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Reminder Intervals */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <Bell className="h-3.5 w-3.5 text-primary" />
                            Reminder Notifications
                        </Label>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            {REMINDER_INTERVAL_OPTIONS.map((opt) => {
                                const active = reminderIntervals.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => toggleReminder(opt.value)}
                                        className={cn(
                                            "flex items-center justify-center h-8 rounded-lg text-xs font-semibold transition-all border",
                                            active
                                                ? "bg-primary/20 text-primary border-primary"
                                                : "bg-muted/30 border-white/5 text-muted-foreground hover:bg-muted/50"
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Banner Image Upload */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                            <ImageIcon className="h-3.5 w-3.5 text-primary" />
                            Event Cover Banner
                        </Label>
                        
                        <div className="relative border border-dashed border-white/10 rounded-xl p-4 bg-muted/20 flex flex-col items-center justify-center text-center hover:bg-muted/30 transition-colors">
                            {imageUrl ? (
                                <div className="relative w-full aspect-[21/9] rounded-lg overflow-hidden">
                                    <img src={imageUrl} alt="Event cover preview" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => setImageUrl("")}
                                        className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md text-[9px] bg-red-500 hover:bg-red-600 text-white font-bold"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ) : (
                                <label className="cursor-pointer flex flex-col items-center justify-center py-2 w-full">
                                    <ImageIcon className="h-8 w-8 text-muted-foreground/60 mb-2" />
                                    <span className="text-xs font-bold text-primary">Upload Banner Image</span>
                                    <span className="text-[10px] text-muted-foreground mt-1">PNG, JPG up to 10MB (Unsplash default if empty)</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                        disabled={isUploading}
                                    />
                                </label>
                            )}

                            {isUploading && (
                                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl p-4">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                                    <span className="text-xs font-bold">Uploading to Cloudinary...</span>
                                    <div className="w-3/4 bg-muted h-1 rounded-full overflow-hidden mt-2 border border-white/5">
                                        <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadPercent}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting || isUploading}
                            className="rounded-xl border-white/10 hover:bg-muted/50"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || isUploading}
                            className="rounded-xl bg-primary hover:bg-primary/90 text-white font-bold px-6 shadow-lg shadow-primary/20"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Scheduling...
                                </>
                            ) : (
                                "Schedule Event"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
