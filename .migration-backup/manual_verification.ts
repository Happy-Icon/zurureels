// @ts-nocheck
// deno-lint-ignore-file

// THIS IS A "PLAN B" FUNCTION
// It bypasses Shufti Pro entirely.
// Use this if we want to confirm the User works without paying for Shufti yet.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    console.log("MANUAL VERIFICATION FUNCTION");

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const { data: { user } } = await supabaseClient.auth.getUser()
        if (!user) throw new Error('User not found')

        // 1. Mark user as 'pending' immediately
        const { error } = await supabaseClient
            .from('profiles')
            .update({
                verification_status: 'pending',
                verification_id: `MANUAL_${Date.now()}`
            })
            .eq('id', user.id);

        if (error) throw error;

        // 2. Return a "Fake" verification URL
        // In this case, we just redirect them back to the host page
        // But with a URL query param that says "success"
        const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173';

        return new Response(
            JSON.stringify({
                // Instead of a Shufti URL, we send them to our own "Success" page (or dashboard)
                verification_url: `${appUrl}/host?verification_submitted=true`,
                reference: "MANUAL_BYPASS",
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        )
    } catch (error) {
        console.error("Function Error:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Unknown error occurred" }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            },
        )
    }
})
