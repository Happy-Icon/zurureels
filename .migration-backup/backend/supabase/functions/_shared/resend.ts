
import { Resend } from "https://esm.sh/resend@4.0.0";

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

export const addContact = async ({ email, firstName, lastName, audienceId }: { email: string, firstName?: string, lastName?: string, audienceId: string }) => {
    if (!apiKey) throw new Error("Email service not configured");
    try {
        const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                first_name: firstName,
                last_name: lastName,
                unsubscribed: false,
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to add contact");

        console.log("Contact added successfully:", data);
        return { success: true, data };
    } catch (error) {
        console.error("Error adding contact:", error);
        return { success: false, error };
    }
};

export const removeContact = async ({ email, audienceId }: { email: string, audienceId: string }) => {
    if (!apiKey) throw new Error("Email service not configured");
    try {
        const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts/${email}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
            }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to remove contact");

        console.log("Contact removed successfully:", data);
        return { success: true, data };
    } catch (error) {
        console.error("Error removing contact:", error);
        return { success: false, error };
    }
};

export const sendBroadcastEmail = async ({ audienceId, subject, html, from, text }: { audienceId: string, subject: string, html: string, from?: string, text?: string }) => {
    if (!apiKey) throw new Error("Email service not configured");
    try {
        // 1. Create the broadcast
        const createRes = await fetch("https://api.resend.com/broadcasts", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                audience_id: audienceId,
                from: from || defaultFrom,
                subject,
                html,
                text,
            })
        });

        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.message || "Failed to create broadcast");

        console.log("Broadcast created successfully:", createData);

        // 2. Send (trigger) the broadcast
        if (createData.id) {
            const sendRes = await fetch(`https://api.resend.com/broadcasts/${createData.id}/send`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                }
            });
            const sendData = await sendRes.json();
            if (!sendRes.ok) throw new Error(sendData.message || "Failed to send broadcast");
            console.log("Broadcast sent successfully:", sendData);
        }

        return { success: true, data: createData };
    } catch (error) {
        console.error("Error sending broadcast:", error);
        return { success: false, error: error instanceof Error ? error.message : "Network error" };
    }
};
