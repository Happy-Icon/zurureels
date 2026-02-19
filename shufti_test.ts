// @ts-nocheck
// deno-lint-ignore-file

// THIS IS A TEST FILE
// Deploy this to check if your code is actually updating.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Just return a success message - NO SHUFTI CALL
    return new Response(
        JSON.stringify({
            verification_url: "https://www.google.com", // Dummy URL
            message: "DEPLOYMENT_IS_WORKING"
        }),
        {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        },
    )
})
