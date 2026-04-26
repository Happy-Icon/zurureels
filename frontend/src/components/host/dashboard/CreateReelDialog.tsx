import { useEffect, useState, useRef } from "react";
import { format } from "date-fns";
import { 
    Plus, Video, Image, DollarSign, FolderOpen, 
    Calendar as CalendarIcon, Clock, Bell, CheckCircle2, 
    Loader2, Sparkles 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { AccommodationReelFlow } from "@/components/host/AccommodationReelFlow";
import { MiniVideoEditor, VideoEditorSubmitData } from "@/components/video-editor";
import { AccommodationType, AccommodationData } from "@/types/host";
import { categories, locations } from "@/data/hostConstants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { uploadToCloudinary } from "@/lib/cloudinaryUpload";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { REMINDER_INTERVAL_OPTIONS, ReminderInterval } from "@/types/events";
import { cn } from "@/lib/utils";

interface CreateReelDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const CreateReelDialog = ({ open, onOpenChange }: CreateReelDialogProps) => {
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [showAccommodationFlow, setShowAccommodationFlow] = useState(false);
    const [showVideoEditor, setShowVideoEditor] = useState(false);
    const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [price, setPrice] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [optimizationProgress, setOptimizationProgress] = useState<number | null>(null);
    
    // Event specific state
    const [eventDate, setEventDate] = useState<Date | undefined>(undefined);
    const [eventTime, setEventTime] = useState("12:00");
    const [reminderIntervals, setReminderIntervals] = useState<ReminderInterval[]>(["24h", "1h"]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { user } = useAuth();

    // Warm up Supabase and Cloudinary
    useEffect(() => {
        if (open) {
            // Lightweight query to "wake up" the Supabase session
            supabase.from("experiences").select("id").limit(1).then(() => {
                console.log("[CreateReelDialog] Supabase connection warmed up");
            });
        }
    }, [open]);

    const isAccommodationCategory = (cat: string): cat is AccommodationType => {
        return ["hotel", "villa", "apartment", "parks_camps"].includes(cat);
    };

    const handleCategoryChange = (value: string) => {
        setSelectedCategory(value);
        if (isAccommodationCategory(value)) {
            setShowAccommodationFlow(true);
        } else {
            setShowAccommodationFlow(false);
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleAccommodationComplete = async (data: any) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            // 1. Create Experience
            const { data: exp, error: expError } = await supabase
                .from("experiences")
                .insert({
                    user_id: user.id,
                    category: selectedCategory,
                    entity_name: data.experienceDetails.entityName,
                    title: data.experienceDetails.title,
                    location: data.experienceDetails.location,
                    current_price: data.experienceDetails.price,
                })
                .select()
                .single();

            if (expError) throw expError;

            // 2. Create Reels
            const reelsToInsert = data.reels
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((r: any) => r.uploaded && r.videoUrl)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((r: any) => {
                    // Generate Cloudinary thumbnail if we have a Cloudinary URL
                    const thumbnailUrl = r.videoUrl?.includes('res.cloudinary.com')
                        ? r.videoUrl.replace(/\.([a-z0-9]+)$/i, '.jpg').replace('/upload/', '/upload/so_0,w_400,h_600,c_fill,q_auto,f_jpg/')
                        : null;
                    return {
                        user_id: user.id,
                        experience_id: exp.id,
                        category: selectedCategory,
                        video_url: r.videoUrl,
                        thumbnail_url: thumbnailUrl,
                        duration: r.maxDuration || 20,
                        status: 'active'
                    };
                });

            if (reelsToInsert.length > 0) {
                const { error: reelsError } = await supabase
                    .from("reels")
                    .insert(reelsToInsert);
                if (reelsError) throw reelsError;
            }

            toast.success("Accommodation and reels published!");
            setShowAccommodationFlow(false);
            onOpenChange(false);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("Save error:", error);
            toast.error(error.message || "Failed to save data");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDialogClose = (newOpen: boolean) => {
        onOpenChange(newOpen);
        if (!newOpen) {
            setSelectedCategory("");
            setShowAccommodationFlow(false);
            setSelectedVideoFile(null);
        }
    };

    const handleStartRecording = () => {
        if (selectedCategory && !isAccommodationCategory(selectedCategory)) {
            setShowVideoEditor(true);
        }
    };

    const handleUploadFromGallery = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith("video/")) {
            setSelectedVideoFile(file);
            setShowVideoEditor(true);
        }
    };

    const handleEditorSubmit = async (data: VideoEditorSubmitData) => {
        if (!user) {
            toast.error("You must be signed in to publish a reel");
            return;
        }
        if (!data.videoFile) {
            toast.error("No video to upload. Please record or select a video.");
            return;
        }
        setIsSubmitting(true);
        try {
            const finalVideoFile = data.videoFile;

            // Step 1: Create Experience record
            const { data: exp, error: expError } = await supabase
                .from("experiences")
                .insert({
                    user_id: user.id,
                    category: selectedCategory,
                    entity_name: "Local Experience",
                    title: title || "New Coastal Activity",
                    location: location || "diani",
                    current_price: parseFloat(price) || 0,
                    description: description
                })
                .select()
                .single();

            if (expError) {
                throw new Error(`Experience creation failed: ${expError.message}`);
            }

            // Step 2: Upload video to Cloudinary
            setOptimizationProgress(0);
            let cloudinaryResult;
            try {
                cloudinaryResult = await uploadToCloudinary(finalVideoFile, {
                    resourceType: "video",
                    folder: "reels",
                    onProgress: (percent) => setOptimizationProgress(percent)
                });
            } catch (err) {
                setOptimizationProgress(null);
                throw new Error("Cloudinary upload failed: " + (err?.message || err));
            }
            setOptimizationProgress(null);

            if (!cloudinaryResult?.secure_url) {
                throw new Error("Failed to upload video to Cloudinary");
            }

            // Step 3: Extract thumbnail (optional, can use Cloudinary transformations)
            let thumbnailUrl: string | null = null;
            try {
                // Use Cloudinary auto-generated thumbnail from the first frame
                thumbnailUrl = cloudinaryResult.secure_url.replace(/\.([a-z0-9]+)$/i, '.jpg').replace("/upload/", "/upload/so_0,w_400,h_600,c_fill,q_auto,f_jpg/");
            } catch (thumbErr) {
                thumbnailUrl = null;
            }

            // Step 4: Create Reel record
            const { error: reelError } = await supabase
                .from("reels")
                .insert({
                    user_id: user.id,
                    experience_id: exp.id,
                    category: selectedCategory,
                    video_url: cloudinaryResult.secure_url,
                    thumbnail_url: thumbnailUrl,
                    duration: data.duration || 20,
                    status: 'active'
                });

            if (reelError) {
                throw new Error(`Reel creation failed: ${reelError.message}`);
            }

            // Step 5: If category is "events", create Event record
            if (selectedCategory === "events" && eventDate) {
                const combinedDateTime = new Date(eventDate);
                const [hours, minutes] = eventTime.split(":");
                combinedDateTime.setHours(parseInt(hours), parseInt(minutes));

                const { error: eventError } = await supabase
                    .from("events")
                    .insert({
                        user_id: user.id,
                        title: title || "New Event",
                        description: description,
                        location: location || "diani",
                        price: parseFloat(price) || 0,
                        event_date: combinedDateTime.toISOString(),
                        category: "events",
                        image_url: thumbnailUrl || cloudinaryResult.secure_url, 
                        notification_intervals: reminderIntervals,
                        status: "active"
                    });

                if (eventError) {
                    console.error("Event creation failed, but reel was published:", eventError);
                    toast.warning("Reel published, but event details could not be saved.");
                }
            }

            toast.success("Reel published successfully!");
            setShowVideoEditor(false);
            onOpenChange(false);
            setSelectedVideoFile(null);
            setSelectedCategory("");
            setTitle("");
            setDescription("");
            setLocation("");
            setPrice("");
            setEventDate(undefined);
            setEventTime("12:00");
            setReminderIntervals(["24h", "1h"]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            toast.error(error.message || "Failed to publish reel");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render Video Editor Fullscreen if active
    if (showVideoEditor && selectedCategory) {
        return (
            <MiniVideoEditor
                category={selectedCategory}
                videoFile={selectedVideoFile}
                onBack={() => {
                    setShowVideoEditor(false);
                    setSelectedVideoFile(null);
                }}
                onSubmit={handleEditorSubmit}
            />
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleDialogClose}>
            <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="font-display">
                        {showAccommodationFlow
                            ? `${selectedCategory === "hotel" ? "Hotel" : selectedCategory === "villa" ? "Villa" : "Apartment"} Setup`
                            : "Create New Reel"
                        }
                    </DialogTitle>
                </DialogHeader>

                {optimizationProgress !== null && (
                    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
                        <div className="bg-card p-10 rounded-[2.5rem] shadow-2xl border border-primary/10 flex flex-col items-center gap-6 max-w-xs w-full text-center">
                            <CircularProgress 
                                value={optimizationProgress} 
                                size={120} 
                                strokeWidth={8} 
                                className="text-primary shadow-sm" 
                            />
                            
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold tracking-tight">
                                    {optimizationProgress < 100 ? "Uploading & Optimizing..." : "Finishing up..."}
                                </h3>
                                <p className="text-sm text-muted-foreground px-2">
                                    We're preparing your reel for high-quality playback on all devices.
                                </p>
                            </div>

                            <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-full text-[10px] font-medium text-primary uppercase tracking-wider">
                                <Sparkles className="h-3 w-3" />
                                <span>Zuru Premium Processing</span>
                            </div>
                        </div>
                    </div>
                )}

                {showAccommodationFlow && isAccommodationCategory(selectedCategory) ? (
                    <AccommodationReelFlow
                        category={selectedCategory}
                        onComplete={handleAccommodationComplete}
                        onBack={() => {
                            setShowAccommodationFlow(false);
                            setSelectedCategory("");
                        }}
                    />
                ) : (
                    <form className="space-y-4 mt-4">
                        {/* Category Selection */}
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent
                                    position="popper"
                                    side="bottom"
                                    align="center"
                                    sideOffset={4}
                                    className="max-h-60 overflow-y-auto"
                                >
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedCategory && isAccommodationCategory(selectedCategory) && (
                                <p className="text-xs text-muted-foreground">
                                    You'll be guided through the accommodation reel setup
                                </p>
                            )}
                        </div>

                        {selectedCategory && !isAccommodationCategory(selectedCategory) && (
                            <>
                                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Video className="h-6 w-6 text-primary" />
                                        </div>
                                        <p className="font-medium">
                                            {selectedCategory === "rentals" ? "Record - Live Only" : "Add Your Reel"}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {selectedCategory === "rentals"
                                                ? "Max 20 seconds • Live recording required"
                                                : "Max 20 seconds • Record live or upload from gallery"}
                                        </p>
                                        <div className="flex flex-wrap justify-center gap-2 mt-2">
                                            <Button type="button" variant="default" size="sm" onClick={handleStartRecording}>
                                                <Video className="h-4 w-4 mr-2" />
                                                Start Recording
                                            </Button>

                                            {selectedCategory !== "rentals" && (
                                                <>
                                                    <input
                                                        type="file"
                                                        accept="video/*"
                                                        className="hidden"
                                                        ref={fileInputRef}
                                                        onChange={handleFileSelect}
                                                    />
                                                    <Button type="button" variant="outline" size="sm" onClick={handleUploadFromGallery}>
                                                        <FolderOpen className="h-4 w-4 mr-2" />
                                                        From Gallery
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Thumbnail</Label>
                                    <div className="flex gap-2">
                                        <div className="h-20 w-32 rounded-lg bg-secondary flex items-center justify-center cursor-pointer hover:bg-secondary/80 transition-colors">
                                            <Image className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                        <p className="text-xs text-muted-foreground self-center">Auto-generated from video</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="title">Title</Label>
                                    <Input
                                        id="title"
                                        placeholder="e.g., Sunset Dhow Cruise"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Describe your listing..."
                                        rows={3}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Location</Label>
                                    <Select value={location} onValueChange={setLocation}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select location" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {locations.map((loc) => (
                                                <SelectItem key={loc} value={loc.toLowerCase()}>
                                                    {loc}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="price">Price (KES)</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="price"
                                            type="number"
                                            placeholder="0"
                                            className="pl-10"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {selectedCategory === "events" && (
                                    <div className="space-y-6 pt-2 pb-2">
                                        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-4">
                                            <div className="flex items-center gap-2 text-primary">
                                                <CalendarIcon className="h-4 w-4" />
                                                <h4 className="text-sm font-bold uppercase tracking-wider">Event Schedule</h4>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Date</Label>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                className={cn(
                                                                    "w-full justify-start text-left font-normal h-10 rounded-xl bg-background",
                                                                    !eventDate && "text-muted-foreground"
                                                                )}
                                                            >
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {eventDate ? format(eventDate, "PPP") : <span>Pick a date</span>}
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
                                                    <Label className="text-xs">Time</Label>
                                                    <div className="relative">
                                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                        <Input
                                                            type="time"
                                                            className="pl-10 h-10 rounded-xl bg-background"
                                                            value={eventTime}
                                                            onChange={(e) => setEventTime(e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3 pt-2">
                                                <div className="flex items-center gap-2 text-primary">
                                                    <Bell className="h-4 w-4" />
                                                    <h4 className="text-sm font-bold uppercase tracking-wider">Reminder Schedule</h4>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">
                                                    Subscribers will be notified at these intervals before the event starts.
                                                </p>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                                    {REMINDER_INTERVAL_OPTIONS.map((option) => (
                                                        <div key={option.value} className="flex items-center space-x-2">
                                                            <Checkbox 
                                                                id={`interval-${option.value}`} 
                                                                checked={reminderIntervals.includes(option.value)}
                                                                onCheckedChange={(checked) => {
                                                                    if (checked) {
                                                                        setReminderIntervals([...reminderIntervals, option.value]);
                                                                    } else {
                                                                        setReminderIntervals(reminderIntervals.filter(i => i !== option.value));
                                                                    }
                                                                }}
                                                            />
                                                            <label
                                                                htmlFor={`interval-${option.value}`}
                                                                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                            >
                                                                {option.label}
                                                            </label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 pt-4">
                                    <Button type="button" variant="outline" className="flex-1" onClick={() => handleDialogClose(false)}>
                                        Save as Draft
                                    </Button>
                                    <Button type="button" className="flex-1" onClick={handleEditorSubmit} disabled={isSubmitting}>
                                        {isSubmitting ? "Publishing..." : "Record & Publish"}
                                    </Button>
                                </div>
                            </>
                        )}

                        {!selectedCategory && (
                            <div className="py-8 text-center text-muted-foreground">
                                <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>Select a category to get started</p>
                            </div>
                        )}
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
};
