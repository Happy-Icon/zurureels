// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sendBroadcastEmail } from "../_shared/resend.ts";
import { getBroadcastTemplate, getYachtDropsTemplate } from "../_shared/email-templates.ts";

const AUDIENCE_ID = Deno.env.get("RESEND_AUDIENCE_ID");

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Here you would typically verify the caller is an admin (e.g., via JWT or API key)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error("Missing Authorization header");
        }

        const { subject, html, text, from, useTemplate, templateData, emailType } = await req.json();

        if (!subject) {
            throw new Error("Missing subject");
        }

        let finalHtml = html || "";

        // Option B: Generate premium HTML template if requested
        if (useTemplate) {
            if (emailType === 'summer_yachts') {
                const template = getYachtDropsTemplate();
                finalHtml = template.html;
            } else if (templateData) {
                const template = getBroadcastTemplate(
                    subject,
                    templateData.title || subject,
                    templateData.messageHtml || html || text || "",
                    templateData.heroImageUrl,
                    templateData.ctaText,
                    templateData.ctaUrl
                );
                finalHtml = template.html;
            }
        }

        if (!finalHtml && !text) {
            throw new Error("Missing content (html, text, templateData, or emailType)");
        }

        if (!AUDIENCE_ID) {
            throw new Error("RESEND_AUDIENCE_ID is not set in environment variables");
        }

        const result = await sendBroadcastEmail({
            audienceId: AUDIENCE_ID,
            subject,
            html: finalHtml,
            text,
            from
        });

        if (!result.success) {
            throw result.error;
        }

        return new Response(JSON.stringify({ success: true, message: "Broadcast dispatched successfully", data: result.data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error sending broadcast:", error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
