// @ts-nocheck
// deno-lint-ignore-file

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

// --------------------------------------------------------------------------
// SHARED: CORS
// --------------------------------------------------------------------------
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --------------------------------------------------------------------------
// SHARED: RESEND
// --------------------------------------------------------------------------
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

const sendEmail = async ({ to, subject, html, from, text }: SendEmailParams) => {
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

// --------------------------------------------------------------------------
// SHARED: EMAIL TEMPLATES
// --------------------------------------------------------------------------
const styles = {
    container: `
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    color: #333333;
    line-height: 1.6;
  `,
    header: `
    padding: 32px 0;
    text-align: center;
    border-bottom: 1px solid #f0f0f0;
  `,
    logo: `
    font-size: 24px;
    font-weight: 700;
    color: #111111;
    text-decoration: none;
    letter-spacing: -0.5px;
  `,
    content: `
    padding: 40px 24px;
  `,
    h1: `
    margin: 0 0 24px;
    font-size: 24px;
    font-weight: 600;
    color: #111111;
    letter-spacing: -0.5px;
  `,
    p: `
    margin: 0 0 24px;
    font-size: 16px;
    color: #4b5563;
  `,
    button: `
    display: inline-block;
    padding: 12px 32px;
    background-color: #000000;
    color: #ffffff;
    text-decoration: none;
    font-weight: 500;
    border-radius: 6px;
    font-size: 16px;
    margin: 8px 0 32px;
    text-align: center;
  `,
    footer: `
    padding: 32px 24px;
    background-color: #f9fafb;
    border-top: 1px solid #f0f0f0;
    text-align: center;
    font-size: 12px;
    color: #6b7280;
  `,
    link: `
    color: #6b7280;
    text-decoration: underline;
  `
};

const appUrl = Deno.env.get("APP_URL") || "https://zurusasa.com";

const layouts = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zurusasa</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb;">
  <div style="${styles.container}">
    <div style="${styles.header}">
      <a href="${appUrl}" style="${styles.logo}">Zurusasa</a>
    </div>
    
    <div style="${styles.content}">
      ${content}
    </div>

    <div style="${styles.footer}">
      <p style="margin: 0 0 8px;">© ${new Date().getFullYear()} Zurusasa. All rights reserved.</p>
      <p style="margin: 0;">
        <a href="mailto:support@zurusasa.com" style="${styles.link}">support@zurusasa.com</a>
      </p>
    </div>
  </div>
</body>
</html>
`;

// PREMIUM WELCOME EMAIL
const getWelcomeEmail = (name: string) => {
    // Premium Styles for Welcome Email
    const pStyles = {
        container: "background-color: #000000; color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 0px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.3);",
        header: "background-color: #000000; padding: 40px 0; text-align: center; border-bottom: 1px solid #222222;",
        logo: "color: #ffffff; font-size: 26px; font-weight: 800; text-decoration: none; letter-spacing: 3px; text-transform: uppercase;",
        content: "padding: 60px 40px; background-color: #0a0a0a; text-align: center;",
        h1: "color: #ffffff; font-size: 36px; font-weight: 200; margin-bottom: 20px; letter-spacing: -0.5px; line-height: 1.2;",
        p: "color: #888888; font-size: 16px; line-height: 1.8; margin-bottom: 30px; max-width: 400px; margin-left: auto; margin-right: auto;",
        highlight: "color: #D4AF37;", // Gold
        button: "display: inline-block; background-color: #D4AF37; color: #000000; padding: 18px 48px; border-radius: 0px; font-weight: 600; text-decoration: none; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin-top: 10px;",
        footer: "background-color: #050505; padding: 40px; text-align: center; color: #444444; font-size: 12px; border-top: 1px solid #111111;"
    };

    const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #000000;">
      <div style="padding: 40px 20px;">
        <div style="${pStyles.container}">
          
          <!-- Header -->
          <div style="${pStyles.header}">
             <a href="${appUrl}" style="${pStyles.logo}">ZURU<span style="${pStyles.highlight}">.</span></a>
          </div>
          
          <!-- Main Content -->
          <div style="${pStyles.content}">
             <h1 style="${pStyles.h1}">Welcome to the <br/><span style="${pStyles.highlight}">Inner Circle</span></h1>
             
             <p style="${pStyles.p}">Hello ${name},</p>
             
             <p style="${pStyles.p}">Your account is verified. You have officially unlocked the ultimate coastal lifestyle experience.</p>
             
             <div style="text-align: left; max-width: 400px; margin: 30px auto; color: #bbbbbb; font-size: 15px; line-height: 1.6;">
                <p style="margin-bottom: 15px;">✨ <strong style="color: #fff;">Discover</strong> hidden villas and luxury stays tailored to your taste.</p>
                <p style="margin-bottom: 15px;">🚤 <strong style="color: #fff;">Book</strong> exclusive yacht charters and curated local adventures.</p>
                <p style="margin-bottom: 15px;">🌍 <strong style="color: #fff;">Connect</strong> with a vibrant community of explorers and hosts.</p>
             </div>
             
             <p style="${pStyles.p}">The coast is calling. How will you answer?</p>
             
             <div style="margin-top: 40px;">
               <a href="${appUrl}/discover" style="${pStyles.button}">Start Exploring</a>
             </div>
          </div>
          
          <!-- Footer -->
          <div style="${pStyles.footer}">
             <p style="margin: 0 0 20px; letter-spacing: 1px; color: #666666;">ZURU REELS</p>
             
             <!-- Social Icons -->
             <div style="margin-bottom: 30px;">
                <!-- Instagram -->
                <a href="https://instagram.com" style="margin: 0 12px; text-decoration: none; display: inline-block;">
                    <img src="https://cdn-icons-png.flaticon.com/512/3955/3955024.png" width="24" height="24" alt="Instagram" style="opacity: 0.5; filter: invert(1);">
                </a>
                <!-- Twitter/X -->
                <a href="https://twitter.com" style="margin: 0 12px; text-decoration: none; display: inline-block;">
                    <img src="https://cdn-icons-png.flaticon.com/512/3670/3670151.png" width="24" height="24" alt="Twitter" style="opacity: 0.5; filter: invert(1);">
                </a>
                <!-- Facebook -->
                <a href="https://facebook.com" style="margin: 0 12px; text-decoration: none; display: inline-block;">
                    <img src="https://cdn-icons-png.flaticon.com/512/3670/3670124.png" width="24" height="24" alt="Facebook" style="opacity: 0.5; filter: invert(1);">
                </a>
             </div>

             <p style="margin: 0; color: #444;">&copy; ${new Date().getFullYear()} All rights reserved.</p>
          </div>
          
        </div>
      </div>
    </body>
    </html>
    `;

    return {
        subject: "Your Zuru Access is Ready",
        html: content
    };
};

const getEmailVerification = (url: string) => {
    const content = `
    <h1 style="${styles.h1}">Verify your email address</h1>
    <p style="${styles.p}">Thanks for signing up for Zurusasa. We want to make sure it's really you.</p>
    <p style="${styles.p}">Please click the button below to verify your account.</p>
    <a href="${url}" style="${styles.button}">Verify Email</a>
    <p style="${styles.p}">If you didn't create an account, you can safely ignore this email.</p>
  `;
    return {
        subject: "Verify your email - Zurusasa",
        html: layouts(content)
    };
};

const getPasswordReset = (url: string) => {
    const content = `
    <h1 style="${styles.h1}">Reset your password</h1>
    <p style="${styles.p}">We received a request to reset your password. If you didn't make this request, you can ignore this email.</p>
    <p style="${styles.p}">To rest your password, click the button below:</p>
    <a href="${url}" style="${styles.button}">Reset Password</a>
    <p style="${styles.p}">This link will expire in 1 hour for your security.</p>
  `;
    return {
        subject: "Reset your password - Zurusasa",
        html: layouts(content)
    };
};

const getLoginAlert = (device: string, location: string) => {
    const content = `
    <h1 style="${styles.h1}">New login detected</h1>
    <p style="${styles.p}">We noticed a new login to your Zurusasa account.</p>
    <ul style="margin: 0 0 24px; padding-left: 20px; color: #4b5563;">
      <li style="margin-bottom: 8px;">Device: ${device}</li>
      <li style="margin-bottom: 8px;">Location: ${location}</li>
      <li>Time: ${new Date().toLocaleString()}</li>
    </ul>
    <p style="${styles.p}">If this was you, no action is needed.</p>
    <p style="${styles.p}">If you don't recognize this activity, please change your password immediately.</p>
    <a href="${appUrl}/profile/security" style="${styles.button}">Check Security Settings</a>
  `;
    return {
        subject: "New login detected - Zurusasa",
        html: layouts(content)
    };
};

const getSecurityNotification = (message: string) => {
    const content = `
    <h1 style="${styles.h1}">Security Alert</h1>
    <p style="${styles.p}">We detected a potential security issue with your account:</p>
    <p style="${styles.p}"><strong>${message}</strong></p>
    <p style="${styles.p}">Please review your account settings to ensure your data is safe.</p>
    <a href="${appUrl}/profile/security" style="${styles.button}">Review Account</a>
  `;
    return {
        subject: "Security Notification - Zurusasa",
        html: layouts(content)
    };
};

const getSupportAcknowledgment = (ticketId: string) => {
    const content = `
    <h1 style="${styles.h1}">We received your message</h1>
    <p style="${styles.p}">Thanks for reaching out! This email confirms that we've received your support request.</p>
    <p style="${styles.p}">Ticket ID: <strong>#${ticketId}</strong></p>
    <p style="${styles.p}">Our team will review your message and get back to you as soon as possible.</p>
  `;
    return {
        subject: `Support Request Received (#${ticketId})`,
        html: layouts(content)
    };
};

// --------------------------------------------------------------------------
// MAIN SERVER HANDLER
// --------------------------------------------------------------------------
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
