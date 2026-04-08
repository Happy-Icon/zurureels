import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface EventReminder {
    event_id: string;
    user_id: string;
    title: string;
    location: string;
    event_date: string;
    interval_label: string;
}

Deno.serve(async (req) => {
    try {
        console.log("[CRON] Dispatching event reminders...");

        const now = new Date();
        const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        // 1. Fetch upcoming events within the next 48 hours
        const { data: events, error: eventsError } = await supabase
            .from("events")
            .select("id, title, location, event_date, notification_intervals, user_id")
            .filter("status", "eq", "active")
            .filter("event_date", "gt", now.toISOString())
            .filter("event_date", "lte", fortyEightHoursFromNow.toISOString());

        if (eventsError) throw eventsError;

        console.log(`[CRON] Found ${events?.length || 0} upcoming events in the next 48h`);

        let totalNotificationsSent = 0;

        for (const event of (events || [])) {
            const eventDate = new Date(event.event_date);
            const intervals = event.notification_intervals as string[] || [];

            for (const interval of intervals) {
                // Determine if we should send a notification for this interval
                let shouldSend = false;
                const hoursBefore = parseInt(interval);
                
                // For '15min', we handle it specially
                const targetTime = new Date(eventDate.getTime());
                if (interval === "15min") {
                    targetTime.setMinutes(targetTime.getMinutes() - 15);
                } else {
                    targetTime.setHours(targetTime.getHours() - hoursBefore);
                }

                // If targetTime is in the past AND within a reasonable window (e.g., last 30 mins)
                // we should send it if it hasn't been sent yet.
                const windowStart = new Date(now.getTime() - 30 * 60 * 1000);
                if (targetTime <= now && targetTime >= windowStart) {
                    shouldSend = true;
                }

                if (!shouldSend) continue;

                // 2. Get all subscribers for this event
                const { data: subscribers, error: subsError } = await supabase
                    .from("event_subscribers")
                    .select("user_id, channels")
                    .eq("event_id", event.id);

                if (subsError) {
                    console.error(`Error fetching subscribers for event ${event.id}:`, subsError);
                    continue;
                }

                for (const sub of (subscribers || [])) {
                    // 3. For each opted-in channel (currently only focusing on 'in_app' for Phase 4)
                    const channels = sub.channels || ["in_app"];
                    
                    if (channels.includes("in_app")) {
                        // 4. Check if notification already sent
                        const { data: existingLog, error: logError } = await supabase
                            .from("event_notification_log")
                            .select("id")
                            .eq("event_id", event.id)
                            .eq("user_id", sub.user_id)
                            .eq("interval_label", interval)
                            .eq("channel", "in_app")
                            .maybeSingle();

                        if (logError && logError.code !== "PGRST116") {
                            console.error(`Error checking log for user ${sub.user_id}:`, logError);
                            continue;
                        }

                        if (existingLog) continue;

                        // 5. Send In-App Notification
                        const title = getNotificationTitle(interval);
                        const body = `${event.title} at ${event.location} starts in ${interval === "15min" ? "15 minutes" : interval}. Don't miss it!`;

                        const { error: notifError } = await supabase.rpc("create_notification", {
                            p_user_id: sub.user_id,
                            p_title: title,
                            p_body: body,
                            p_type: "event_reminder",
                            p_data: { event_id: event.id, interval }
                        });

                        if (notifError) {
                            console.error(`Error creating notification for user ${sub.user_id}:`, notifError);
                            continue;
                        }

                        // 6. Log success
                        await supabase
                            .from("event_notification_log")
                            .insert({
                                event_id: event.id,
                                user_id: sub.user_id,
                                interval_label: interval,
                                channel: "in_app",
                                status: "sent"
                            });

                        totalNotificationsSent++;
                    }
                }
            }
        }

        console.log(`[CRON] Process complete. Sent ${totalNotificationsSent} notifications.`);
        return new Response(JSON.stringify({ success: true, sent: totalNotificationsSent }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (err: any) {
        console.error("[CRON] Error dispatching reminders:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});

function getNotificationTitle(interval: string): string {
    switch (interval) {
        case "48h": return "2 days to go! 🎉";
        case "24h": return "Tomorrow! 🔥";
        case "1h": return "Starting in 1 hour! ⏰";
        case "15min": return "Almost time! 🚀";
        default: return "Event Reminder! 🎶";
    }
}
