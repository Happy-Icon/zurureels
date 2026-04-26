import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Loader2 } from "lucide-react";
import { locations } from "@/data/hostConstants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ReelData } from "@/types/host";

interface EditReelDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    reel: ReelData | null;
    onSuccess: () => void;
}

export const EditReelDialog = ({ open, onOpenChange, reel, onSuccess }: EditReelDialogProps) => {
    const [title, setTitle] = useState("");
    const [location, setLocation] = useState("");
    const [price, setPrice] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (reel && open) {
            setTitle(reel.title);
            setLocation(reel.location);
            setPrice(reel.price.toString());
        }
    }, [reel, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reel || !reel.experienceId) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from("experiences")
                .update({
                    title,
                    location,
                    current_price: parseFloat(price) || 0
                })
                .eq("id", reel.experienceId);

            if (error) throw error;

            toast.success("Listing updated successfully!");
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error("Update error:", error);
            toast.error(error.message || "Failed to update listing");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!reel) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="font-display text-xl">Edit Listing Details</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Luxury Oceanfront Villa"
                            required
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
                                className="pl-10"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="0"
                                required
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" className="flex-1" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};
