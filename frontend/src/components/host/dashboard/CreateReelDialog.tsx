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
import { extractVideoThumbnail } from "@/utils/videoThumbnail";



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
        return ["villa", "apartment"].includes(cat);
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
                const { error: reelsError } = await supabase
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
            // Step 1: Create Experience record
            console.log("[Publish] Step 1: Creating experience…");
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
                console.error("[Publish] Experience insert failed:", expError);
                throw new Error(`Experience creation failed: ${expError.message}`);
            }
            console.log("[Publish] Experience created:", exp.id);

            // Step 2: Upload video to storage
            console.log("[Publish] Step 2: Uploading video…");
            const fileExt = data.videoFile.name.split('.').pop() || 'webm';
            const fileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `reels/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('reels')
                .upload(filePath, data.videoFile, {
                    contentType: data.videoFile.type || 'video/webm',
                    upsert: false,
                });

            if (uploadError) {
                console.error("[Publish] Storage upload failed:", uploadError);
                throw new Error(`Video upload failed: ${uploadError.message}`);
            }

            const { data: { publicUrl } } = supabase.storage
                .from('reels')
                .getPublicUrl(filePath);

            if (!publicUrl) {
                throw new Error("Failed to get public URL for uploaded video");
            }
            console.log("[Publish] Video uploaded:", publicUrl);

            // Step 3: Extract + upload thumbnail
            console.log("[Publish] Step 3: Extracting thumbnail…");
            let thumbnailUrl: string | null = null;
            try {
                const thumbBlob = await extractVideoThumbnail(data.videoFile);
                if (thumbBlob) {
                    const thumbName = `thumbnails/${crypto.randomUUID()}.jpg`;
                    const { error: thumbError } = await supabase.storage
                        .from('reels')
                        .upload(thumbName, thumbBlob, {
                            contentType: 'image/jpeg',
                            upsert: false,
                        });
                    if (!thumbError) {
                        const { data: thumbData } = supabase.storage
                            .from('reels')
                            .getPublicUrl(thumbName);
                        thumbnailUrl = thumbData.publicUrl;
                        console.log("[Publish] Thumbnail uploaded:", thumbnailUrl);
                    } else {
                        console.warn("[Publish] Thumbnail upload failed:", thumbError);
                    }
                }
            } catch (thumbErr) {
                console.warn("[Publish] Thumbnail extraction failed, proceeding without:", thumbErr);
            }

            // Step 4: Create Reel record
            console.log("[Publish] Step 4: Creating reel record…");
            const { error: reelError } = await supabase
                .from("reels")
                .insert({
                    user_id: user.id,
                    experience_id: exp.id,
                    category: selectedCategory,
                    video_url: publicUrl,
                    thumbnail_url: thumbnailUrl,
                    duration: data.duration || 20,
                    lat: data.lat,
                    lng: data.lng,
                    is_live: data.isLive ?? false,
                    status: 'active'
                });

            if (reelError) {
                console.error("[Publish] Reel insert failed:", reelError);
                throw new Error(`Reel creation failed: ${reelError.message}`);
            }
            console.log("[Publish] ✅ Reel published successfully!");

            toast.success("Reel published successfully!");
            setShowVideoEditor(false);
            onOpenChange(false);
            setSelectedVideoFile(null);
            setSelectedCategory("");
            setTitle("");
            setDescription("");
            setLocation("");
            setPrice("");
        } catch (error: any) {
            console.error("[Publish] Pipeline error:", error);
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
