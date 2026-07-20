// RUN THIS SCRIPT LOCALLY TO SYNC ALL EXISTING USERS TO YOUR RESEND AUDIENCE
// Usage: deno run --allow-net --allow-env backend/sync_existing_users_to_resend.ts <SUPABASE_URL> <SUPABASE_SERVICE_ROLE_KEY> <RESEND_API_KEY> <AUDIENCE_ID>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3.2.0";

const SUPABASE_URL = Deno.args[0];
const SUPABASE_KEY = Deno.args[1];
const RESEND_API_KEY = Deno.args[2];
const AUDIENCE_ID = Deno.args[3];

if (!SUPABASE_URL || !SUPABASE_KEY || !RESEND_API_KEY || !AUDIENCE_ID) {
    console.log("Usage: deno run --allow-net --allow-env sync_existing_users_to_resend.ts <SUPABASE_URL> <SUPABASE_SERVICE_ROLE_KEY> <RESEND_API_KEY> <AUDIENCE_ID>");
    Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const resend = new Resend(RESEND_API_KEY);

async function syncUsers() {
    console.log("Fetching profiles from Supabase...");
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, notification_settings');

    if (error) {
        console.error("Error fetching profiles:", error);
        return;
    }

    console.log(`Found ${profiles?.length || 0} profiles`);

    let syncedCount = 0;
    for (const profile of profiles || []) {
        if (!profile.email) continue;

        // Check if newsletter preference is true or undefined (default true)
        const wantsNewsletter = profile.notification_settings?.marketing?.newsletter ?? true;

        if (wantsNewsletter) {
            const firstName = profile.full_name?.split(' ')[0] || '';
            const lastName = profile.full_name?.split(' ').slice(1).join(' ') || '';

            try {
                await resend.contacts.create({
                    email: profile.email,
                    firstName,
                    lastName,
                    audienceId: AUDIENCE_ID,
                    unsubscribed: false,
                });
                console.log(`✅ Synced ${profile.email}`);
                syncedCount++;
            } catch (err: any) {
                // If contact exists, Resend API might throw an error or handle it gracefully depending on version.
                // We just log and continue.
                console.log(`⚠️ Failed to sync ${profile.email}: ${err.message}`);
            }
        }
    }

    console.log(`\nDone! Synced ${syncedCount} users to Resend Audience.`);
}

syncUsers();
