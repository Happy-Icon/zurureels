
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

export const getWelcomeEmail = (name: string) => {
    const content = `
    <h1 style="${styles.h1}">Welcome to Zurusasa, ${name}!</h1>
    <p style="${styles.p}">We're thrilled to have you on board. Zurusasa is your new home for discovering and sharing amazing experiences.</p>
    <p style="${styles.p}">To get started, explore the dashboard and setup your profile.</p>
    <a href="${appUrl}/dashboard" style="${styles.button}">Go to Dashboard</a>
    <p style="${styles.p}">If you have any questions, our support team is always here to help.</p>
  `;
    return {
        subject: "Welcome to Zurusasa",
        html: layouts(content)
    };
};

export const getEmailVerification = (url: string) => {
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

export const getPasswordReset = (url: string) => {
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

export const getLoginAlert = (device: string, location: string) => {
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

export const getSecurityNotification = (message: string) => {
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

export const getSupportAcknowledgment = (ticketId: string) => {
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
