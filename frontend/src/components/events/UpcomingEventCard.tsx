import { Bell, BellOff, MapPin, Calendar, Users } from "lucide-react";
import { CountdownTimer } from "./CountdownTimer";
import { useEventSubscription } from "@/hooks/useEventSubscription";
import { ZuruEvent } from "@/types/events";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface UpcomingEventCardProps {
    event: ZuruEvent;
    className?: string;
}

/**
 * A premium card for upcoming events displaying:
 * - Event image + category badge
 * - Title, location, date
 * - Live countdown timer
 * - Notify Me toggle button with subscriber count
 */
export const UpcomingEventCard = ({ event, className }: UpcomingEventCardProps) => {
    const { isSubscribed, subscriberCount, toggle, toggling, loading } = useEventSubscription(event.id);

    const eventDate = new Date(event.event_date);
    const formattedDate = format(eventDate, "EEE, MMM d · h:mm a");

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
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary flex items-center justify-center">
                        <Calendar className="h-12 w-12 text-primary/30" />
                    </div>
                )}

                {/* Category Badge */}
                <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/50 backdrop-blur-md text-white border border-white/10">
                        {event.category}
                    </span>
                </div>

                {/* Price Badge */}
                {event.price && event.price > 0 && (
                    <div className="absolute top-3 right-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground shadow-lg">
                            KES {event.price.toLocaleString()}
                        </span>
                    </div>
                )}

                {/* Countdown Overlay */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-10">
                    <CountdownTimer targetDate={event.event_date} />
                </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Title & Location */}
                <div>
                    <h3 className="font-bold text-base leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                        {event.title}
                    </h3>
                    <div className="flex items-center gap-1 text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="text-xs truncate">{event.location}</span>
                    </div>
                </div>

                {/* Date */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{formattedDate}</span>
                </div>

                {/* Description */}
                {event.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {event.description}
                    </p>
                )}

                {/* Actions Row */}
                <div className="flex items-center gap-2 pt-1">
                    {/* Notify Me Button */}
                    <Button
                        variant={isSubscribed ? "default" : "outline"}
                        size="sm"
                        onClick={toggle}
                        disabled={toggling || loading}
                        className={cn(
                            "flex-1 gap-1.5 rounded-xl text-xs font-semibold transition-all",
                            isSubscribed && "bg-primary hover:bg-primary/90"
                        )}
                    >
                        {isSubscribed ? (
                            <>
                                <Bell className="h-3.5 w-3.5 fill-current" />
                                <span>Subscribed</span>
                            </>
                        ) : (
                            <>
                                <BellOff className="h-3.5 w-3.5" />
                                <span>Notify Me</span>
                            </>
                        )}
                    </Button>

                    {/* Subscriber Count */}
                    {subscriberCount > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/60 px-2.5 py-1.5 rounded-xl">
                            <Users className="h-3 w-3" />
                            <span className="font-semibold">{subscriberCount}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
