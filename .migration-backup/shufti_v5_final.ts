// @ts-nocheck
// deno-lint-ignore-file

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    console.log("SHUFTI FUNCTION V5 - FINAL ATTEMPT");

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

        const { email } = await req.json()
        const verificationReference = `VERIFY_${user.id}_${Date.now()}`
        const clientId = Deno.env.get('SHUFTI_CLIENT_ID')
        const secretKey = Deno.env.get('SHUFTI_SECRET_KEY')

        if (!clientId || !secretKey) throw new Error('Shufti credentials not configured')

        const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173';

        // PAYLOAD V5: ABSOLUTE MINIMUM
        // Removed 'name' object entirely (Shufti will ask for it)
        // Removed 'fetch_enhanced_data'
        const payload = {
            reference: verificationReference,
            callback_url: `${appUrl}/api/shufti-webhook`,
            redirect_url: `${appUrl}/host?verification_complete=true`,
            email: email,
            language: "EN",
            verification_mode: "any",
            // Allow user to choose any document type
            document: {
                supported_types: ["id_card", "driving_license", "passport"],
                allow_offline: "1",
                allow_online: "1"
            },
            // Simple face check
            face: {}
        };

        console.log("Sending payload to Shufti:", JSON.stringify(payload));

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
            throw new Error(`Shufti API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();

        if (!data.verification_url) {
            console.error('Shufti Invalid Response:', data);
            throw new Error('No verification_url returned from Shufti. Check credentials or balance.');
        }

        return new Response(
            JSON.stringify({
                verification_url: data.verification_url,
                reference: verificationReference,
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
