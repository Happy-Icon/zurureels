
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";
import {
    getWelcomeEmail,
    getEmailVerification,
    getPasswordReset,
    getLoginAlert,
    getSecurityNotification,
    getSupportAcknowledgment,
} from "../_shared/email-templates.ts";

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { type, email, data } = await req.json();

        if (!email || !type) {
            throw new Error("Missing email or type");
        }

        let emailContent;

        switch (type) {
            case 'welcome':
                emailContent = getWelcomeEmail(data?.name || 'User');
                break;
            case 'verification':
                if (data?.url) {
                    emailContent = getEmailVerification(data.url);
                } else if (data?.token) {
                    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://zurusasa.supabase.co";
                    const redirectTo = data?.redirect_to ?? Deno.env.get("APP_URL") ?? "https://zurusasa.com";
                    // Construct the magic link manually
                    const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${data.token}&type=signup&redirect_to=${redirectTo}`;
                    emailContent = getEmailVerification(verifyUrl);
                } else {
                    throw new Error("Missing verification URL or token");
                }
                break;
            case 'reset_password':
                if (data?.url) {
                    emailContent = getPasswordReset(data.url);
                } else if (data?.token) {
                    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://rjzgzxxdrltlteeshtuw.supabase.co";
                    const redirectTo = data?.redirect_to ?? Deno.env.get("APP_URL") ? `${Deno.env.get("APP_URL")}/reset-password` : "https://zurusasa.com/reset-password";
                    const resetUrl = `${supabaseUrl}/auth/v1/verify?token=${data.token}&type=recovery&redirect_to=${redirectTo}`;
                    emailContent = getPasswordReset(resetUrl);
                } else {
                    throw new Error("Missing reset URL or token");
                }
                break;
            case 'login_alert':
                emailContent = getLoginAlert(data?.device || 'Unknown Device', data?.location || 'Unknown Location');
                break;
            case 'security':
                emailContent = getSecurityNotification(data?.message || 'Security update');
                break;
            case 'support':
                emailContent = getSupportAcknowledgment(data?.ticketId || 'Pending');
                break;
            default:
                throw new Error("Invalid email type");
        }

        const result = await sendEmail({
            to: email,
            subject: emailContent.subject,
            html: emailContent.html,
        });

        if (!result.success) {
            throw result.error;
        }

        return new Response(JSON.stringify({ success: true, message: `Email sent: ${type}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error sending email:", error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
