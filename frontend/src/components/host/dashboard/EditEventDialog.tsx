import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ZuruEvent } from "@/types/events";

interface EditEventDialogProps {
    event: ZuruEvent | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export const EditEventDialog = ({ event, open, onOpenChange, onSuccess }: EditEventDialogProps) => {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [price, setPrice] = useState("");
    const [location, setLocation] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (event) {
            setTitle(event.title || "");
            setDescription(event.description || "");
            setPrice(event.price?.toString() || "0");
            setLocation(event.location || "");
        }
    }, [event]);

    const handleSave = async () => {
        if (!event) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from("events")
                .update({
                    title,
                    description,
                    price: parseFloat(price) || 0,
                    location,
                })
                .eq("id", event.id);

            if (error) throw error;

            toast.success("Event updated successfully!");
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to update event");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Event</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Event Title"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Event Description"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="location">Location</Label>
                        <Input
                            id="location"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Event Location"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="price">Price (KES)</Label>
                        <Input
                            id="price"
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="0"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
