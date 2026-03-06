import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

/**
 * transcode-video Edge Function
 *
 * Fired by a Postgres DB trigger whenever a new row is inserted into `reels`.
 * Triggers an eager transformation on Cloudinary to prevent "Video Processing" overlays
 * from showing on the frontend when `q_auto,f_auto` is requested.
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { record } = await req.json()
        const reelId = record.id
        const videoUrl = record.video_url

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

        if (!videoUrl || !videoUrl.includes('cloudinary.com')) {
            // Not a cloudinary video, just mark ready immediately
            await supabase
                .from('reels')
                .update({
                    processing_status: 'ready',
                    processed_video_url: videoUrl,
                })
                .eq('id', reelId)
            return new Response(JSON.stringify({ success: true, message: 'Not a cloudinary URL' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // Extract public ID from cloudinary URL
        // Example: https://res.cloudinary.com/cloud_name/video/upload/v1234567/public_id.mp4
        const parts = videoUrl.split('/upload/')
        if (parts.length < 2) throw new Error("Invalid Cloudinary URL structure")

        // Remove versioning (e.g. v1234567/) if it exists, and the extension
        let publicIdWithVersion = parts[1]
        // Splitting by "/" allows us to skip the version folder if it's there
        const pathSegments = publicIdWithVersion.split('/')
        const fileSegment = pathSegments.length > 1 ? pathSegments.slice(1).join('/') : pathSegments[0]

        // Remove the file extension (e.g., .mp4, .mov)
        const publicId = fileSegment.substring(0, fileSegment.lastIndexOf('.')) || fileSegment

        // Send eager transformation request to Cloudinary API
        const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
        const apiKey = Deno.env.get('CLOUDINARY_API_KEY')
        const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')

        if (cloudName && apiKey && apiSecret) {
            console.log(`[transcode-video] Triggering eager transform for public_id: ${publicId}`)

            // Cloudinary requires basic auth: apikey:apisecret
            const authStr = btoa(`${apiKey}:${apiSecret}`)

            const cloudinaryFormData = new URLSearchParams()
            cloudinaryFormData.append('public_id', publicId)
            cloudinaryFormData.append('resource_type', 'video')
            cloudinaryFormData.append('type', 'upload')
            cloudinaryFormData.append('eager', 'q_auto,f_auto')
            cloudinaryFormData.append('eager_async', 'true') // Process in background!

            const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/explicit`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${authStr}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: cloudinaryFormData
            })

            const cloudinaryData = await cloudinaryRes.json()
            console.log('[transcode-video] Cloudinary explicit response:', cloudinaryData)

            if (!cloudinaryRes.ok) {
                console.error('[transcode-video] Cloudinary transform request failed:', cloudinaryData)
            }
        } else {
            console.warn('[transcode-video] Cloudinary credentials missing in Edge env. Skipping eager transform.')
        }

        // Generate the optimized URL locally while Cloudinary processes it
        const optimizedUrl = videoUrl.replace('/upload/', '/upload/q_auto,f_auto/')

        // Mark as ready using the optimized URL
        // Cloudinary will serve the "Video Processing" spinner for a few seconds until the eager transform finishes
        await supabase
            .from('reels')
            .update({
                processing_status: 'ready',
                processed_video_url: optimizedUrl,
            })
            .eq('id', reelId)

        return new Response(JSON.stringify({ success: true, processedUrl: optimizedUrl }), {
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
