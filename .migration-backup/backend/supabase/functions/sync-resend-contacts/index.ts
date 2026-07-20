// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { addContact, removeContact } from "../_shared/resend.ts";

const AUDIENCE_ID = Deno.env.get("RESEND_AUDIENCE_ID");

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        if (!AUDIENCE_ID) {
            throw new Error("RESEND_AUDIENCE_ID is not set in environment variables");
        }

        const payload = await req.json();
        const record = payload.record || payload; // Support both webhook format and direct generic invocation
        const oldRecord = payload.old_record;

        if (!record || !record.email) {
            throw new Error("Missing record or email in payload");
        }

        const email = record.email;
        const firstName = record.first_name || record.full_name?.split(' ')[0] || '';
        const lastName = record.last_name || record.full_name?.split(' ').slice(1).join(' ') || '';

        // Check if newsletter preference changed
        const newNewsletter = record.notification_settings?.marketing?.newsletter ?? true; // default to true if not specified
        const oldNewsletter = oldRecord?.notification_settings?.marketing?.newsletter ?? null;

        let actionResult;

        if (oldNewsletter === null || oldNewsletter !== newNewsletter) {
            if (newNewsletter) {
                // Add or update contact
                actionResult = await addContact({ email, firstName, lastName, audienceId: AUDIENCE_ID });
            } else {
                // Remove contact (opt-out)
                actionResult = await removeContact({ email, audienceId: AUDIENCE_ID });
            }
        } else {
            return new Response(JSON.stringify({ success: true, message: "No change in newsletter preference, skipped." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (!actionResult.success) {
            throw actionResult.error;
        }

        return new Response(JSON.stringify({ success: true, message: `Successfully synced contact ${email}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error syncing Resend contact:", error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
