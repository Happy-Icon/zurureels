// @ts-nocheck
// deno-lint-ignore-file

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    console.log("SHUFTI FUNCTION V8 - PRODUCTION URLS");

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const {
            data: { user },
        } = await supabaseClient.auth.getUser()

        if (!user) {
            throw new Error('User not found')
        }

        const { email } = await req.json()
        const verificationReference = `VERIFY_${user.id}_${Date.now()}`

        // Shufti Pro details
        const clientId = Deno.env.get('SHUFTI_CLIENT_ID')
        const secretKey = Deno.env.get('SHUFTI_SECRET_KEY')

        if (!clientId || !secretKey) {
            throw new Error('Shufti credentials not configured')
        }

        // Documentation: https://api.shuftipro.com/api/documentation

        // Ensure we have a valid URL for redirects
        // PRODUCTION NOTE: You can set 'APP_URL' in Supabase Secrets, OR rely on the browser request origin/referer.
        // We default to 'zurusasa.com' for production reliability if headers are stripped.
        const origin = req.headers.get("origin");
        const referer = req.headers.get("referer");
        const appUrl = Deno.env.get('APP_URL') ?? origin ?? (referer ? new URL(referer).origin : null) ?? 'https://zurusasa.com';
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

        // Revert to full URL as the user whitelist seems slightly better now
        // And CRUCIALLY, restore the 'document' and 'face' services so Shufti knows what to do.

        // PAYLOAD V8: Correct logic for Redirect vs Callback
        const payload = {
            reference: verificationReference,
            email: email,
            callback_url: `${supabaseUrl}/functions/v1/shufti-webhook`,
            redirect_url: `${appUrl}/host?verification_complete=true`,
            language: "EN",
            verification_mode: "any",
            document: {
                supported_types: ["id_card", "passport", "driving_license"],
                allow_offline: "1",
                allow_online: "1",
            },
            face: {}
        };

        console.log("Sending payload to Shufti:", JSON.stringify(payload));

        // Call Shufti API to get Verification URL
        const response = await fetch('https://api.shuftipro.com/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic ' + btoa(`${clientId}:${secretKey}`)
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Shufti API Error:', errorText);

            // Helpful Debugging: Tell the user exactly what URL failed whitelist
            const debugInfo = `(Sent redirect_url: ${payload.redirect_url}, callback_url: ${payload.callback_url})`;
            throw new Error(`Shufti API Error: ${response.status} ${response.statusText} - ${errorText} ${debugInfo}`);
        }

        const data = await response.json();

        // Validate response
        if (!data.verification_url) {
            console.error('Shufti Invalid Response:', data);
            throw new Error('No verification_url returned from Shufti. Check credentials or balance.');
        }

        return new Response(
            JSON.stringify({
                verification_url: data.verification_url,
                reference: verificationReference,
                event: data.event
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
