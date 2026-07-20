import { MapPin, MoreVertical, Heart, Clock, AlertTriangle, RefreshCcw, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReelData } from "@/types/host";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Edit, Trash2, Eye, EyeOff } from "lucide-react";

interface HostReelsListProps {
    reels: ReelData[];
    type: "published" | "drafts";
    onDelete?: (id: string) => void;
    onToggleStatus?: (id: string, currentStatus: string) => void;
    onEdit?: (reel: ReelData) => void;
    onToggleAvailability?: (experienceId: string, currentStatus: string | undefined) => void;
}

export const HostReelsList = ({ reels, type, onDelete, onToggleStatus, onEdit, onToggleAvailability }: HostReelsListProps) => {
    if (reels.length === 0) {
        return (
            <div className="text-center py-12">
                <Film className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">
                    No {type} yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                    {type === "published"
                        ? "Create your first listing to get started"
                        : "Saved drafts will appear here"}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {reels.map((reel) => {
                const daysRemaining = reel.expiresAt
                    ? differenceInDays(parseISO(reel.expiresAt), new Date())
                    : 90; // Default or fallback
                const isExpired = daysRemaining <= 0;
                const isExpiringSoon = daysRemaining <= 7;

                return (
                    <div
                        key={reel.id}
                        className="flex gap-4 p-3 rounded-xl bg-card border border-border"
                    >
                        <div className="relative">
                            {reel.thumbnail ? (
                                <img
                                    src={reel.thumbnail}
                                    alt={reel.title}
                                    className={cn(
                                        "h-24 w-32 rounded-lg object-cover",
                                        isExpired && "opacity-50 grayscale"
                                    )}
                                />
                            ) : (
                                <div className={cn(
                                    "h-24 w-32 rounded-lg bg-muted flex items-center justify-center",
                                    isExpired && "opacity-50 grayscale"
                                )}>
                                    <Film className="h-8 w-8 text-muted-foreground/50" />
                                </div>
                            )}
                            {isExpired && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                                    <span className="text-xs font-bold text-white bg-destructive px-2 py-1 rounded-md">EXPIRED</span>
                                </div>
                            )}
                            {!isExpired && reel.availabilityStatus === 'booked_out' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                                    <span className="text-[10px] font-bold text-white bg-orange-500/90 px-2 py-1 rounded-md tracking-wider">FULLY BOOKED</span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className={cn("font-semibold truncate", isExpired && "text-muted-foreground")}>{reel.title}</h3>
                                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <MapPin className="h-3 w-3" />
                                        <span className="capitalize">{reel.location}</span>
                                    </div>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => onEdit?.(reel)}>
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit Details
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onToggleStatus?.(reel.id, reel.status)}>
                                            {reel.status === 'published' ? (
                                                <><EyeOff className="h-4 w-4 mr-2" /> Unpublish (Draft)</>
                                            ) : (
                                                <><Eye className="h-4 w-4 mr-2" /> Publish Now</>
                                            )}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onToggleAvailability?.(reel.experienceId, reel.availabilityStatus)}>
                                            {reel.availabilityStatus === 'booked_out' ? (
                                                <><RefreshCcw className="h-4 w-4 mr-2 text-emerald-500" /> Mark as Available</>
                                            ) : (
                                                <><AlertTriangle className="h-4 w-4 mr-2 text-orange-500" /> Mark Fully Booked</>
                                            )}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => onDelete?.(reel.id)}>
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete Listing
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Status / Expiry Row */}
                            {!isExpired && isExpiringSoon && (
                                <div className="flex items-center gap-2 mt-2 px-2 py-1 bg-amber-500/10 text-amber-600 rounded-md w-fit text-xs font-medium">
                                    <AlertTriangle className="h-3 w-3" />
                                    Expires in {daysRemaining} days
                                </div>
                            )}

                            {isExpired && (
                                <div className="mt-2">
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/50 hover:bg-destructive/10">
                                        <RefreshCcw className="h-3 w-3" />
                                        Re-record Now
                                    </Button>
                                </div>
                            )}

                            {!isExpired && (
                                <div className="flex items-center gap-4 mt-2 text-xs">
                                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                                        {reel.category}
                                    </span>
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                        <Heart className="h-3 w-3" />
                                        {reel.views} {reel.views === 1 ? "like" : "likes"}
                                    </span>
                                    <span className="font-medium text-foreground">
                                        KES {reel.price.toLocaleString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    );
};
