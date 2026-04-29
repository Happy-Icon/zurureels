
import { Resend } from "https://esm.sh/resend@2.0.0";

const apiKey = Deno.env.get("RESEND_API_KEY");
const resend = apiKey ? new Resend(apiKey) : null;
const defaultFrom = Deno.env.get("EMAIL_FROM") || "onboarding@resend.dev";

interface SendEmailParams {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    text?: string;
}

export const sendEmail = async ({ to, subject, html, from, text }: SendEmailParams) => {
    if (!resend) {
        console.error("RESEND_API_KEY is not set. Please run: supabase secrets set RESEND_API_KEY=your_key");
        return { success: false, error: "RESEND_API_KEY is missing" };
    }

    // If using the test key, we MUST send to ourselves or use onboarding@resend.dev
    const fromEmail = from || defaultFrom;
    
    try {
        const data = await resend.emails.send({
            from: fromEmail,
            to,
            subject,
            html,
            text,
        });

        console.log("Email sent successfully:", data);
        return { success: true, data };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, error };
    }
};
