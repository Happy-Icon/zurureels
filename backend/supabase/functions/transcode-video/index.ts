import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

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

        console.log(`Processing video for reel: ${reelId}`)

        // Update status to processing (already set by frontend, but good to ensure)
        await supabase
            .from('reels')
            .update({ processing_status: 'processing' })
            .eq('id', reelId)

        // MOCK TRANSCODING DELAY
        // In a real scenario, this would trigger an external service like Mux
        // or run a serverless FFmpeg task.
        await new Promise(resolve => setTimeout(resolve, 5000))

        // Mark as ready
        // For universal playback, we'd ideally convert to MP4 (H.264)
        // Here we just mark the original as ready for the demo
        const { error: updateError } = await supabase
            .from('reels')
            .update({
                processing_status: 'ready',
                processed_video_url: record.video_url // Use original for now, usually would be transcode.mp4
            })
            .eq('id', reelId)

        if (updateError) throw updateError

        console.log(`✅ Video processing complete for reel: ${reelId}`)

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('Error:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
