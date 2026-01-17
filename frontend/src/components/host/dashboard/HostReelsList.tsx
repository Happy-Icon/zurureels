import { MapPin, MoreVertical, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReelData } from "@/types/host";

interface HostReelsListProps {
    reels: ReelData[];
    type: "published" | "drafts";
}

export const HostReelsList = ({ reels, type }: HostReelsListProps) => {
    if (reels.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="mt-4 text-muted-foreground">
                    No {type} yet
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {reels.map((reel) => (
                <div
                    key={reel.id}
                    className="flex gap-4 p-3 rounded-xl bg-card border border-border"
                >
                    <img
                        src={reel.thumbnail}
                        alt={reel.title}
                        className="h-20 w-32 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-semibold truncate">{reel.title}</h3>
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span>{reel.location}</span>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                                {reel.category}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <Eye className="h-3 w-3" />
                                {reel.views}
                            </span>
                            <span className="font-medium text-foreground">
                                KES {reel.price.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
