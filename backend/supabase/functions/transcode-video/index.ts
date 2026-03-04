import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

/**
 * transcode-video Edge Function
 *
 * Fired by a Postgres DB trigger whenever a new row is inserted into `reels`.
 * Currently just marks the reel as ready.
 * TODO: Implement cloud storage processing (Supabase Storage or other)
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { record } = await req.json()
        const reelId = record.id

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        console.log(`[transcode-video] Processing reel: ${reelId}`)

        // Mark as processing
        await supabase
            .from('reels')
            .update({ processing_status: 'processing' })
            .eq('id', reelId)

        // TODO: Implement video processing/verification logic
        // Mark as ready using the existing video_url
        console.log('[transcode-video] Processing reel with existing video_url')
        await new Promise((resolve) => setTimeout(resolve, 2000))

        await supabase
            .from('reels')
            .update({
                processing_status: 'ready',
                processed_video_url: record.video_url,
            })
            .eq('id', reelId)

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('[transcode-video] Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
