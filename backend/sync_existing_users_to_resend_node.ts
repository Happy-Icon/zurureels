// RUN THIS SCRIPT LOCALLY TO SYNC ALL EXISTING USERS TO YOUR RESEND AUDIENCE
// Usage: npx tsx backend/sync_existing_users_to_resend_node.ts <SUPABASE_URL> <SUPABASE_SERVICE_ROLE_KEY> <RESEND_API_KEY> <AUDIENCE_ID>

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const SUPABASE_URL = process.argv[2];
const SUPABASE_KEY = process.argv[3];
const RESEND_API_KEY = process.argv[4];
const AUDIENCE_ID = process.argv[5];

if (!SUPABASE_URL || !SUPABASE_KEY || !RESEND_API_KEY || !AUDIENCE_ID) {
    console.log("Usage: npx tsx backend/sync_existing_users_to_resend_node.ts <SUPABASE_URL> <SUPABASE_SERVICE_ROLE_KEY> <RESEND_API_KEY> <AUDIENCE_ID>");
    process.exit(1);
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
                console.log(`⚠️ Failed to sync ${profile.email}: ${err.message}`);
            }
        }
    }

    console.log(`\nDone! Synced ${syncedCount} users to Resend Audience.`);
}

syncUsers();
