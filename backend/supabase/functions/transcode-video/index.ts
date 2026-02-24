import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

/**
 * transcode-video Edge Function (Cloudinary implementation)
 *
 * Fired by a Postgres DB trigger whenever a new row is inserted into `reels`.
 * If the reel was uploaded via Cloudinary (has cloudinary_public_id), we verify
 * the asset is accessible through the Cloudinary REST API and mark it ready.
 * For legacy Supabase-Storage uploads (no cloudinary_public_id), we mark ready
 * immediately as before.
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { record } = await req.json()
        const reelId = record.id
        const cloudinaryPublicId: string | null = record.cloudinary_public_id ?? null

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME') ?? ''
        const apiKey = Deno.env.get('CLOUDINARY_API_KEY') ?? ''
        const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET') ?? ''

        console.log(`[transcode-video] Processing reel: ${reelId}`)
        console.log(`[transcode-video] Cloudinary public ID: ${cloudinaryPublicId ?? 'none (Supabase Storage fallback)'}`)

        // Mark as processing
        await supabase
            .from('reels')
            .update({ processing_status: 'processing' })
            .eq('id', reelId)

        if (cloudinaryPublicId && cloudName && apiKey && apiSecret) {
            // ──────────────────────────────────────────────────────────
            // Cloudinary path: verify the asset exists via the Admin API
            // ──────────────────────────────────────────────────────────
            const encodedId = encodeURIComponent(cloudinaryPublicId)
            const cloudinaryApiUrl =
                `https://api.cloudinary.com/v1_1/${cloudName}/resources/video/upload/${encodedId}`

            // Basic auth: api_key:api_secret
            const credentials = btoa(`${apiKey}:${apiSecret}`)

            let attempts = 0
            const maxAttempts = 6
            const delayMs = 5000 // 5 s between polls — Cloudinary is usually fast

            while (attempts < maxAttempts) {
                attempts++
                console.log(`[transcode-video] Polling Cloudinary (attempt ${attempts}/${maxAttempts})…`)

                const res = await fetch(cloudinaryApiUrl, {
                    headers: { Authorization: `Basic ${credentials}` }
                })

                if (res.ok) {
                    const asset = await res.json()
                    const secureUrl: string = asset.secure_url

                    await supabase
                        .from('reels')
                        .update({
                            processing_status: 'ready',
                            processed_video_url: secureUrl,
                            cloudinary_secure_url: secureUrl,
                        })
                        .eq('id', reelId)

                    console.log(`[transcode-video] ✅ Ready. URL: ${secureUrl}`)
                    break
                }

                if (attempts === maxAttempts) {
                    throw new Error(`Cloudinary asset not found after ${maxAttempts} attempts: ${cloudinaryPublicId}`)
                }

                // Wait before next poll
                await new Promise((resolve) => setTimeout(resolve, delayMs))
            }
        } else {
            // ──────────────────────────────────────────────────────────
            // Legacy path: no Cloudinary credentials or no public ID —
            // just mark ready using the existing video_url
            // ──────────────────────────────────────────────────────────
            console.log('[transcode-video] No Cloudinary credentials or public ID — using Supabase Storage URL as-is')
            await new Promise((resolve) => setTimeout(resolve, 2000))

            await supabase
                .from('reels')
                .update({
                    processing_status: 'ready',
                    processed_video_url: record.video_url,
                })
                .eq('id', reelId)
        }

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
