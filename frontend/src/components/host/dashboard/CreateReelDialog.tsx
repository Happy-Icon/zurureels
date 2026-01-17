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



interface CreateReelDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const CreateReelDialog = ({ open, onOpenChange }: CreateReelDialogProps) => {
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [showAccommodationFlow, setShowAccommodationFlow] = useState(false);
    const [showVideoEditor, setShowVideoEditor] = useState(false);
    const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
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

    const handleAccommodationComplete = (data: AccommodationData) => {
        console.log("Accommodation data:", data);
        setShowAccommodationFlow(false);
        onOpenChange(false);
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

    const handleEditorSubmit = (data: VideoEditorSubmitData) => {
        console.log("Video editor submit:", data);
        setShowVideoEditor(false);
        onOpenChange(false);
        setSelectedVideoFile(null);
        setSelectedCategory("");
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
                                        <p className="font-medium">Create your reel</p>
                                        <p className="text-sm text-muted-foreground">Max 20 seconds • Get guided editing</p>
                                        <div className="flex gap-2 mt-2">
                                            <Button type="button" variant="default" size="sm" onClick={handleStartRecording}>
                                                <Video className="h-4 w-4 mr-2" />
                                                Record
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" onClick={handleUploadFromGallery}>
                                                <FolderOpen className="h-4 w-4 mr-2" />
                                                Upload
                                            </Button>
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="video/*"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
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
                                    <Input id="title" placeholder="e.g., Sunset Dhow Cruise" />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea id="description" placeholder="Describe your listing..." rows={3} />
                                </div>

                                <div className="space-y-2">
                                    <Label>Location</Label>
                                    <Select>
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
                                        <Input id="price" type="number" placeholder="0" className="pl-10" />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <Button type="button" variant="outline" className="flex-1" onClick={() => handleDialogClose(false)}>
                                        Save as Draft
                                    </Button>
                                    <Button type="submit" className="flex-1">
                                        Publish Reel
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
