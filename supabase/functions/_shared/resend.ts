
import { Resend } from "https://esm.sh/resend@2.0.0";

const apiKey = Deno.env.get("RESEND_API_KEY");
const resend = apiKey ? new Resend(apiKey) : null;
const defaultFrom = Deno.env.get("EMAIL_FROM") || "noreply@zurusasa.com";

interface SendEmailParams {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    text?: string;
}

export const sendEmail = async ({ to, subject, html, from, text }: SendEmailParams) => {
    if (!resend) {
        console.error("RESEND_API_KEY is not set");
        throw new Error("Email service not configured");
    }

    try {
        const data = await resend.emails.send({
            from: from || defaultFrom,
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
