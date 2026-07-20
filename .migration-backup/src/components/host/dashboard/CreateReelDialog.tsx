import { useState, useRef } from "react";
import { Plus, Video, Image, DollarSign, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AccommodationReelFlow } from "@/components/host/AccommodationReelFlow";
import { MiniVideoEditor, VideoEditorSubmitData } from "@/components/video-editor";
import { AccommodationType, AccommodationData } from "@/types/host";
import { categories, locations } from "@/data/hostConstants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";



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
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isAccommodationCategory = (cat: string): cat is AccommodationType => {
        return ["hotel", "villa", "apartment"].includes(cat);
    };

    const handleCategoryChange = (value: string) => {
        setSelectedCategory(value);
        if (isAccommodationCategory(value)) {
            setShowAccommodationFlow(true);
        } else {
            setShowAccommodationFlow(false);
        }
    };

    const handleAccommodationComplete = async (data: any) => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            // 1. Create Experience
            // @ts-ignore - experiences table exists
            const { data: exp, error: expError } = await (supabase as any)
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
                .filter((r: any) => r.uploaded && r.videoUrl)
                .map((r: any) => ({
                    user_id: user.id,
                    experience_id: exp.id,
                    category: selectedCategory,
                    video_url: r.videoUrl,
                    thumbnail_url: null,
                    duration: r.maxDuration || 20,
                    lat: r.lat,
                    lng: r.lng,
                    is_live: true, // Accommodation reels are now forced live
                    status: 'active'
                }));

            if (reelsToInsert.length > 0) {
                const { error: reelsError } = await (supabase as any)
                    .from("reels")
                    .insert(reelsToInsert);
                if (reelsError) throw reelsError;
            }

            toast.success("Accommodation and reels published!");
            setShowAccommodationFlow(false);
            onOpenChange(false);
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
        if (!user) return;
        setIsSubmitting(true);
        try {
            // 1. Create (or find) Experience - for non-accommodations we create a simple one
            // @ts-ignore - experiences table exists
            const { data: exp, error: expError } = await (supabase as any)
                .from("experiences")
                .insert({
                    user_id: user.id,
                    category: selectedCategory,
                    entity_name: "My Experience", // Default or add field
                    title: title || "New Experience",
                    location: location || "zanzibar",
                    current_price: parseFloat(price) || 0,
                    description: description
                })
                .select()
                .single();

            if (expError) throw expError;

            // 2. Upload video (if editing was done locally, but usually it's already uploaded in editor?)
            // Assuming data.videoFile is what we upload if it's there
            let finalVideoUrl = "";
            if (data.videoFile) {
                const fileExt = data.videoFile.name.split('.').pop();
                const fileName = `${crypto.randomUUID()}.${fileExt}`;
                const filePath = `reels/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('reels')
                    .upload(filePath, data.videoFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('reels')
                    .getPublicUrl(filePath);

                finalVideoUrl = publicUrl;
            }

            // 3. Create Reel
            // @ts-ignore - reels table exists
            const { error: reelError } = await (supabase as any)
                .from("reels")
                .insert({
                    user_id: user.id,
                    experience_id: exp?.id,
                    category: selectedCategory,
                    video_url: finalVideoUrl,
                    duration: data.duration,
                    lat: data.lat,
                    lng: data.lng,
                    is_live: data.isLive,
                    status: 'active'
                });

            if (reelError) throw reelError;

            toast.success("Reel published successfully!");
            setShowVideoEditor(false);
            onOpenChange(false);
            setSelectedVideoFile(null);
            setSelectedCategory("");
        } catch (error: any) {
            console.error("Publish error:", error);
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
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-display">
                        {showAccommodationFlow
                            ? `${selectedCategory === "hotel" ? "Hotel" : selectedCategory === "villa" ? "Villa" : "Apartment"} Setup`
                            : "Create New Reel"
                        }
                    </DialogTitle>
                </DialogHeader>

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
                                        <p className="font-medium">Record - Live Only</p>
                                        <p className="text-sm text-muted-foreground">Max 20 seconds • Live recording required</p>
                                        <div className="flex gap-2 mt-2">
                                            <Button type="button" variant="default" size="sm" onClick={handleStartRecording}>
                                                <Video className="h-4 w-4 mr-2" />
                                                Start Recording
                                            </Button>
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

                                <div className="flex gap-3 pt-4">
                                    <Button type="button" variant="outline" className="flex-1" onClick={() => handleDialogClose(false)}>
                                        Save as Draft
                                    </Button>
                                    <Button type="button" className="flex-1" onClick={handleStartRecording} disabled={isSubmitting}>
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
