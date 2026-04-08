import { useState, useEffect, useRef } from "react";

interface CountdownResult {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
    totalSeconds: number;
}

/**
 * Live countdown hook. Ticks every second and returns
 * days/hours/minutes/seconds until the target date.
 */
export const useCountdown = (targetDate: string | Date): CountdownResult => {
    const calculateTimeLeft = (): CountdownResult => {
        const target = new Date(targetDate).getTime();
        const now = Date.now();
        const diff = target - now;

        if (diff <= 0) {
            return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, totalSeconds: 0 };
        }

        const totalSeconds = Math.floor(diff / 1000);
        return {
            days: Math.floor(diff / (1000 * 60 * 60 * 24)),
            hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((diff / (1000 * 60)) % 60),
            seconds: Math.floor((diff / 1000) % 60),
            isExpired: false,
            totalSeconds,
        };
    };

    const [timeLeft, setTimeLeft] = useState<CountdownResult>(calculateTimeLeft);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        // Update immediately
        setTimeLeft(calculateTimeLeft());

        // Tick every second
        intervalRef.current = setInterval(() => {
            const result = calculateTimeLeft();
            setTimeLeft(result);

            // Stop ticking when expired
            if (result.isExpired && intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [targetDate]);

    return timeLeft;
};
