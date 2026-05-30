import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, AlertTriangle, ShieldCheck, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

interface RatingModalProps {
    isOpen: boolean;
    onClose: () => void;
    hostId: string;
    hostName: string;
    onSuccess?: () => void;
}

export const RatingModal = ({ isOpen, onClose, hostId, hostName, onSuccess }: RatingModalProps) => {
    const { user } = useAuth();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [hoveredRating, setHoveredRating] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showTerms, setShowTerms] = useState(true);

    const handleSubmit = async () => {
        if (!user) {
            toast.error("Please login to rate");
            return;
        }
        if (rating === 0) {
            toast.error("Please select a star rating");
            return;
        }
        if (!comment.trim()) {
            toast.error("Please leave a short comment about your experience");
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from("host_reviews")
                .upsert({
                    host_id: hostId,
                    reviewer_id: user.id,
                    rating,
                    comment: comment.trim(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'host_id,reviewer_id'
                });

            if (error) throw error;

            toast.success(`Thank you for rating ${hostName}!`);
            onSuccess?.();
            onClose();
        } catch (error: any) {
            console.error("Error submitting rating:", error);
            toast.error("Failed to submit rating. You might have already rated this host.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
                {showTerms ? (
                    <div className="p-8 space-y-6">
                        <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                            <ShieldCheck className="h-8 w-8 text-primary" />
                        </div>
                        <div className="text-center space-y-2">
                            <DialogTitle className="text-2xl font-display font-bold">Community Trust & Honesty</DialogTitle>
                            <DialogDescription className="text-base text-muted-foreground">
                                Before you rate <span className="font-bold text-foreground">{hostName}</span>, please read our commitment to truth.
                            </DialogDescription>
                        </div>

                        <div className="space-y-4 bg-muted/30 p-5 rounded-2xl border border-border/50">
                            <div className="flex gap-3">
                                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
                                <p className="text-sm leading-relaxed">
                                    <strong>No Coercion:</strong> Never rate based on pressure from a host or any external influence.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Heart className="h-5 w-5 text-red-500 shrink-0" />
                                <p className="text-sm leading-relaxed">
                                    <strong>No Hatred:</strong> Personal bias or unrelated grievances should not affect your score.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Star className="h-5 w-5 text-yellow-500 shrink-0" />
                                <p className="text-sm leading-relaxed">
                                    <strong>Be True:</strong> Your honest feedback helps others stay safe and find the best experiences.
                                </p>
                            </div>
                        </div>

                        <Button 
                            className="w-full h-14 rounded-2xl font-bold text-lg"
                            onClick={() => setShowTerms(false)}
                        >
                            I Understand & Promise Honesty
                        </Button>
                    </div>
                ) : (
                    <div className="p-8 space-y-6">
                        <DialogHeader className="text-center">
                            <DialogTitle className="text-2xl font-display font-bold">Rate {hostName}</DialogTitle>
                            <DialogDescription>
                                How was your experience with this host?
                            </DialogDescription>
                        </DialogHeader>

                        {/* Star Rating */}
                        <div className="flex justify-center gap-3">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onMouseEnter={() => setHoveredRating(star)}
                                    onMouseLeave={() => setHoveredRating(0)}
                                    onClick={() => setRating(star)}
                                    className="transition-transform active:scale-90"
                                >
                                    <Star 
                                        className={cn(
                                            "h-10 w-10 transition-colors duration-200",
                                            (hoveredRating || rating) >= star 
                                                ? "fill-yellow-400 text-yellow-400" 
                                                : "text-muted-foreground/30"
                                        )} 
                                    />
                                </button>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest text-center">
                                {rating === 5 ? "Exceptional" : 
                                 rating === 4 ? "Very Good" : 
                                 rating === 3 ? "Average" : 
                                 rating === 2 ? "Poor" : 
                                 rating === 1 ? "Very Poor" : "Select Rating"}
                            </p>
                            <Textarea 
                                placeholder="Share details of your experience (cleanliness, communication, reliability)..."
                                className="min-h-[120px] rounded-2xl p-4 bg-muted/30 border-border/50 focus:ring-primary"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button variant="ghost" className="flex-1 rounded-xl h-12" onClick={onClose}>Cancel</Button>
                            <Button 
                                className="flex-[2] rounded-xl h-12 font-bold" 
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Submitting..." : "Submit Rating"}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
