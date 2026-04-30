import { MapPin, Calendar, Users, Zap } from "lucide-react";
import { ZuruEvent } from "@/types/events";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface HappeningEventCardProps {
    event: ZuruEvent;
    className?: string;
}

/**
 * Card for events that are currently live/happening.
 * Shows a pulsing LIVE badge and event details.
 */
export const HappeningEventCard = ({ event, className }: HappeningEventCardProps) => {
    const navigate = useNavigate();
    const formattedDate = format(new Date(event.event_date), "h:mm a");

    return (
        <div
            className={cn(
                "group relative rounded-2xl overflow-hidden bg-card border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300",
                className
            )}
        >
            {/* Image Header */}
            <div className="relative aspect-[16/9] overflow-hidden bg-secondary">
                {event.image_url ? (
                    <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-500/20 via-orange-500/10 to-secondary flex items-center justify-center">
                        <Zap className="h-12 w-12 text-red-500/30" />
                    </div>
                )}

                {/* LIVE Badge */}
                <div className="absolute top-3 left-3">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white shadow-lg">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                        Live
                    </span>
                </div>

                {/* Category Badge */}
                <div className="absolute top-3 right-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/50 backdrop-blur-md text-white border border-white/10">
                        {event.category}
                    </span>
                </div>

                {/* Price overlay */}
                {event.price && event.price > 0 && (
                    <div className="absolute bottom-3 right-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground shadow-lg">
                            KES {event.price.toLocaleString()}
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-2">
                <h3 className="font-bold text-base leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                    {event.title}
                </h3>

                {/* Host Info */}
                {event.host && (
                    <div 
                        className="flex items-center gap-2 pt-0.5 cursor-pointer group/host w-fit"
                        onClick={() => navigate(`/profile/${event.user_id}`)}
                    >
                        <div className="relative">
                            <img 
                                src={event.host.avatar_url || "/placeholder.svg"} 
                                alt={event.host.full_name} 
                                className="h-5 w-5 rounded-full object-cover border border-border shadow-sm group-hover/host:scale-110 transition-transform"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-muted-foreground group-hover/host:text-primary transition-colors truncate">
                                {event.host.full_name}
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{event.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Started {formattedDate}</span>
                    </div>
                </div>

                {event.attendees && event.attendees > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{event.attendees} attending</span>
                    </div>
                )}

                {event.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {event.description}
                    </p>
                )}
            </div>
        </div>
    );
};
