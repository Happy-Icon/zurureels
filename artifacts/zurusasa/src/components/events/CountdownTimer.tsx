import { useCountdown } from "@/hooks/useCountdown";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
    targetDate: string;
    className?: string;
    compact?: boolean;
}

/**
 * Live countdown timer with animated digit blocks.
 * Shows DD:HH:MM:SS until the target date.
 */
export const CountdownTimer = ({ targetDate, className, compact = false }: CountdownTimerProps) => {
    const { days, hours, minutes, seconds, isExpired } = useCountdown(targetDate);

    if (isExpired) {
        return (
            <div className={cn("flex items-center gap-1.5 text-green-500 font-bold", className)}>
                <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                <span className="text-xs uppercase tracking-wider">Happening Now</span>
            </div>
        );
    }

    const blocks = [
        { value: days, label: "days" },
        { value: hours, label: "hrs" },
        { value: minutes, label: "min" },
        { value: seconds, label: "sec" },
    ];

    if (compact) {
        return (
            <div className={cn("flex items-center gap-1 font-mono text-xs font-bold", className)}>
                {days > 0 && <span>{days}d</span>}
                <span>{String(hours).padStart(2, "0")}</span>
                <span className="text-muted-foreground animate-pulse">:</span>
                <span>{String(minutes).padStart(2, "0")}</span>
                <span className="text-muted-foreground animate-pulse">:</span>
                <span>{String(seconds).padStart(2, "0")}</span>
            </div>
        );
    }

    return (
        <div className={cn("flex items-center gap-1.5", className)}>
            {blocks.map((block, idx) => (
                <div key={block.label} className="flex items-center gap-1.5">
                    <div className="flex flex-col items-center">
                        <div className="bg-foreground/10 backdrop-blur-sm rounded-lg px-2.5 py-1.5 min-w-[2.5rem] text-center">
                            <span className="font-mono text-lg font-bold tabular-nums leading-none">
                                {String(block.value).padStart(2, "0")}
                            </span>
                        </div>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">
                            {block.label}
                        </span>
                    </div>
                    {idx < blocks.length - 1 && (
                        <span className="text-muted-foreground font-bold text-lg animate-pulse pb-4">:</span>
                    )}
                </div>
            ))}
        </div>
    );
};
