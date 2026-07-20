import { cn } from "@/lib/utils";
import { Radio, Clock } from "lucide-react";
import { EventTimeFilter } from "@/types/events";

interface EventTimeToggleProps {
    selected: EventTimeFilter;
    onChange: (filter: EventTimeFilter) => void;
    className?: string;
}

/**
 * Toggle between "Happening Now" and "Upcoming" event views.
 * Rendered as a compact segmented control inside the Events sub-filter area.
 */
export const EventTimeToggle = ({ selected, onChange, className }: EventTimeToggleProps) => {
    const options: { value: EventTimeFilter; label: string; icon: typeof Radio }[] = [
        { value: "happening", label: "Happening Now", icon: Radio },
        { value: "upcoming", label: "Upcoming", icon: Clock },
    ];

    return (
        <div className={cn("bg-secondary/40 p-0.5 rounded-xl flex items-center gap-0.5 w-full", className)}>
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-[0.6rem] text-xs font-semibold transition-all duration-200",
                        selected === option.value
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    )}
                >
                    {option.value === "happening" && selected === "happening" && (
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                    )}
                    {(option.value !== "happening" || selected !== "happening") && (
                        <option.icon className="h-3.5 w-3.5" />
                    )}
                    <span>{option.label}</span>
                </button>
            ))}
        </div>
    );
};
