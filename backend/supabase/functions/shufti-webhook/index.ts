// @ts-nocheck
// deno-lint-ignore-file

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json();
        console.log("SHUFTI WEBHOOK RECEIVED:", JSON.stringify(body));

        // Shufti sends 'event' in the body
        // Common events: verification.accepted, verification.declined, request.deleted
        const event = body.event;
        const reference = body.reference; // e.g. VERIFY_USERID_TIMESTAMP

        if (!reference) {
            throw new Error("No reference found in webhook body");
        }

        // Extract User ID from Reference (Format: VERIFY_{userId}_{timestamp})
        const parts = reference.split('_');
        if (parts.length < 3) {
            console.error("Invalid reference format:", reference);
            throw new Error("Invalid reference format");
        }
        const userId = parts[1];

        // Initialize Supabase Admin Client (Service Role Key required for updates without user session)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        let statusToUpdate = null;

        if (event === 'verification.accepted') {
            statusToUpdate = 'verified';
        } else if (event === 'verification.declined') {
            statusToUpdate = 'rejected';
            console.log("Verification DECLINED for User:", userId, "Reason:", body.declined_reason || "Unknown");
        } else {
            console.log("Unhandled Shufti Event:", event);
            return new Response(JSON.stringify({ message: "Event ignored" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        if (statusToUpdate) {
            const { error } = await supabaseAdmin
                .from('profiles')
                .update({
                    verification_status: statusToUpdate,
                    verification_id: reference // Store the latest reference ID
                })
                .eq('id', userId);

            if (error) {
                console.error("Database Update Error:", error);
                throw error;
            }
            console.log(`Successfully updated User ${userId} status to ${statusToUpdate}`);
        }

        return new Response(JSON.stringify({ message: "Webhook processed successfully" }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error("Webhook Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            },
        )
    }
})
