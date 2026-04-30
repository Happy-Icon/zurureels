// Event types for the upcoming events feature

export interface ZuruEvent {
    id: string;
    title: string;
    description: string | null;
    category: string;
    location: string;
    event_date: string;
    end_date: string | null;
    price: number | null;
    image_url: string | null;
    attendees: number | null;
    status: string | null;
    user_id: string | null;
    notification_intervals: string[] | null;
    created_at: string | null;
    updated_at: string | null;
    host?: {
        full_name: string;
        username: string;
        avatar_url?: string;
    };
}

export interface EventSubscription {
    id: string;
    event_id: string;
    user_id: string;
    channels: string[];
    created_at: string;
}

export type EventTimeFilter = "happening" | "upcoming";

export type ReminderInterval = "48h" | "24h" | "1h" | "15min";

export const REMINDER_INTERVAL_OPTIONS: { value: ReminderInterval; label: string }[] = [
    { value: "48h", label: "48 hours before" },
    { value: "24h", label: "24 hours before" },
    { value: "1h", label: "1 hour before" },
    { value: "15min", label: "15 minutes before" },
];

export const DEFAULT_REMINDER_INTERVALS: ReminderInterval[] = ["24h", "1h"];
