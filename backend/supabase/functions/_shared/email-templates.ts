// @ts-nocheck
// deno-lint-ignore-file

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

export const getBroadcastTemplate = (subject: string, title: string, messageHtml: string, heroImageUrl?: string, ctaText?: string, ctaUrl?: string) => {
  // Premium Styles for Broadcast/Newsletter Email
  const pStyles = {
    container: "background-color: #000000; color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 0px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.3);",
    header: "background-color: #000000; padding: 30px 0; text-align: center; border-bottom: 1px solid #222222;",
    logo: "color: #ffffff; font-size: 22px; font-weight: 800; text-decoration: none; letter-spacing: 3px; text-transform: uppercase;",
    heroImage: "width: 100%; height: auto; max-height: 400px; object-fit: cover; display: block;",
    content: "padding: 50px 40px; background-color: #0a0a0a; text-align: left;",
    h1: "color: #ffffff; font-size: 32px; font-weight: 200; margin-top: 0; margin-bottom: 25px; letter-spacing: -0.5px; line-height: 1.2;",
    messageContainer: "color: #cccccc; font-size: 16px; line-height: 1.8; margin-bottom: 30px;",
    highlight: "color: #D4AF37;", // Gold
    button: "display: inline-block; background-color: #D4AF37; color: #000000; padding: 18px 48px; border-radius: 0px; font-weight: 600; text-decoration: none; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin-top: 20px; text-align: center;",
    footer: "background-color: #050505; padding: 40px; text-align: center; color: #444444; font-size: 12px; border-top: 1px solid #111111;"
  };

  const heroSection = heroImageUrl
    ? `<img src="${heroImageUrl}" alt="Featured Image" style="${pStyles.heroImage}" />`
    : '';

  const ctaSection = (ctaText && ctaUrl)
    ? `<div style="text-align: center; margin-top: 40px;">
         <a href="${ctaUrl}" style="${pStyles.button}">${ctaText}</a>
       </div>`
    : '';

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
          
          <!-- Hero Image (Optional) -->
          ${heroSection}
          
          <!-- Main Content -->
          <div style="${pStyles.content}">
             <h1 style="${pStyles.h1}">${title}</h1>
             
             <div style="${pStyles.messageContainer}">
                ${messageHtml}
             </div>
             
             ${ctaSection}
          </div>
          
          <!-- Footer -->
          <div style="${pStyles.footer}">
             <p style="margin: 0 0 20px; letter-spacing: 1px; color: #666666;">ZURU REELS</p>
             
             <!-- Social Icons -->
             <div style="margin-bottom: 30px;">
                <a href="#" style="margin: 0 12px; text-decoration: none; display: inline-block;">
                    <img src="https://cdn-icons-png.flaticon.com/512/3955/3955024.png" width="24" height="24" alt="Instagram" style="opacity: 0.5; filter: invert(1);">
                </a>
                <a href="#" style="margin: 0 12px; text-decoration: none; display: inline-block;">
                    <img src="https://cdn-icons-png.flaticon.com/512/3670/3670151.png" width="24" height="24" alt="Twitter" style="opacity: 0.5; filter: invert(1);">
                </a>
             </div>

             <p style="margin: 0; color: #444;">&copy; ${new Date().getFullYear()} All rights reserved.</p>
             <p style="margin: 15px 0 0; font-size: 11px; color: #333;">You are receiving this email because you are subscribed to ZuruSasa updates.</p>
          </div>
          
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    subject,
    html: content
  };
};

export const getYachtDropsTemplate = () => {
  // Premium Styles for the Summer Yacht Drops Newsletter
  const pStyles = {
    container: "background-color: #000000; color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 0px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.3);",
    header: "background-image: linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.8)), url('https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=800'); background-size: cover; background-position: center; padding: 60px 20px; text-align: center; border-bottom: 2px solid #D4AF37;",
    logo: "color: #ffffff; font-size: 32px; font-weight: 800; text-decoration: none; letter-spacing: 4px; text-transform: uppercase; text-shadow: 0 2px 10px rgba(0,0,0,0.5);",
    content: "padding: 50px 40px; background-color: #0a0a0a; text-align: left;",
    h1: "color: #ffffff; font-size: 36px; font-weight: 200; margin-top: 0; margin-bottom: 10px; letter-spacing: -0.5px; line-height: 1.1;",
    subh1: "color: #D4AF37; font-size: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 30px; display: block;",
    p: "color: #cccccc; font-size: 16px; line-height: 1.8; margin-bottom: 25px;",
    list: "color: #cccccc; font-size: 15px; line-height: 1.8; padding-left: 20px; margin-bottom: 35px;",
    li: "margin-bottom: 12px;",
    highlight: "color: #D4AF37; font-weight: 600;", // Gold text
    buttonPrimary: "display: block; background-color: #D4AF37; color: #000000; padding: 18px 0; border-radius: 0px; font-weight: 600; text-decoration: none; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin: 40px 0 20px; text-align: center; width: 100%;",
    buttonSecondary: "display: block; background-color: transparent; border: 1px solid #D4AF37; color: #D4AF37; padding: 16px 0; border-radius: 0px; font-weight: 600; text-decoration: none; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 40px; text-align: center; width: 100%;",
    gridContainer: "margin: 40px 0;",
    gridItem: "margin-bottom: 30px; text-align: center;",
    gridImage: "width: 100%; height: 200px; object-fit: cover; margin-bottom: 15px; border: 1px solid #222;",
    gridTitle: "color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 5px; letter-spacing: 1px; text-transform: uppercase;",
    gridDesc: "color: #888888; font-size: 14px; margin: 0; line-height: 1.6;",
    footer: "background-color: #050505; padding: 50px 40px; text-align: center; color: #444444; font-size: 12px; border-top: 1px solid #111111;"
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
          
          <!-- Hero Header -->
          <div style="${pStyles.header}">
             <a href="${appUrl}" style="${pStyles.logo}">ZURU<span style="color: #D4AF37;">.</span></a>
             <div style="margin-top: 40px;">
               <h2 style="color: #fff; font-size: 42px; font-weight: 200; margin: 0; line-height: 1.1; letter-spacing: -1px;">Seize the Summer.</h2>
             </div>
          </div>
          
          <!-- Main Content -->
          <div style="${pStyles.content}">
             <span style="${pStyles.subh1}">The Ocean is Calling: Summer 2026</span>
             <h1 style="${pStyles.h1}">Your 24-Hour Exclusive Access</h1>
             
             <p style="${pStyles.p}">
               The wait is over. We've spent months scouting the most breathtaking coastlines to bring you an exclusive fleet of luxury yachts for the upcoming season.
             </p>
             <p style="${pStyles.p}">
               Because you are part of the ZuruSasa inner circle, you aren't just invited—you're first in line. We are giving you 24 hours of early access to browse and book these charters before they go live to the general public.
             </p>

             <div style="margin: 40px 0; padding: 30px; background-color: #111111; border-left: 3px solid #D4AF37;">
               <h3 style="color: #fff; font-size: 18px; font-weight: 600; margin-top: 0; margin-bottom: 20px; letter-spacing: 1px; text-transform: uppercase;">Exclusive Subscriber Benefits</h3>
               <ul style="${pStyles.list}">
                 <li style="${pStyles.li}"><span style="${pStyles.highlight}">Priority Booking:</span> Secure the most sought-after vessels and popular dates immediately.</li>
                 <li style="${pStyles.li}"><span style="${pStyles.highlight}">The Zuru Perk:</span> Enjoy a complimentary champagne welcome or a custom excursion on your first charter.</li>
                 <li style="${pStyles.li}"><span style="${pStyles.highlight}">Concierge Support:</span> Dedicated 1:1 assistance from our coastal experts to plan your flawless itinerary.</li>
               </ul>
             </div>

             <h3 style="color: #fff; font-size: 20px; font-weight: 200; margin: 50px 0 20px; text-align: center; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid #222; padding-bottom: 15px;">What's Waiting For You</h3>

             <!-- Featured Grids -->
             <div style="${pStyles.gridContainer}">
               
               <div style="${pStyles.gridItem}">
                 <img src="https://images.unsplash.com/photo-1559564278-df033e5ed0c1?auto=format&fit=crop&q=80&w=600" alt="Private Catamarans" style="${pStyles.gridImage}">
                 <h4 style="${pStyles.gridTitle}">Private Catamarans</h4>
                 <p style="${pStyles.gridDesc}">Perfect for sunset cruises, intimate gatherings, and weekend escapes along the Swahili coast.</p>
               </div>

               <div style="${pStyles.gridItem}">
                 <img src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=600" alt="Luxury Motor Yachts" style="${pStyles.gridImage}">
                 <h4 style="${pStyles.gridTitle}">Luxury Motor Yachts</h4>
                 <p style="${pStyles.gridDesc}">Full-service professional crews ready to cater to your every need. Ultimate opulence on the water.</p>
               </div>

               <div style="${pStyles.gridItem}">
                 <img src="https://images.unsplash.com/photo-1537162998323-3d3675e0e87c?auto=format&fit=crop&q=80&w=600" alt="Curated Itineraries" style="${pStyles.gridImage}">
                 <h4 style="${pStyles.gridTitle}">Curated Itineraries</h4>
                 <p style="${pStyles.gridDesc}">From the hidden coves of the Lamu Archipelago to vibrant island parties off the coast of Diani.</p>
               </div>

             </div>

             <p style="${pStyles.p} text-align: center; font-size: 18px; margin-top: 50px;">
               Don't wait—the most popular dates always go first. <br/><strong>Your summer story starts here.</strong>
             </p>
             
             <!-- Dual CTAs -->
             <a href="${appUrl}/discover" style="${pStyles.buttonPrimary}">Explore The Collection</a>
             <a href="mailto:concierge@zurusasa.com" style="${pStyles.buttonSecondary}">Plan Your Custom Trip</a>
          </div>
          
          <!-- Footer -->
          <div style="${pStyles.footer}">
             <p style="margin: 0 0 20px; letter-spacing: 2px; color: #888888; text-transform: uppercase;">Zuru Reels &bull; Inner Circle</p>
             
             <!-- Social Icons -->
             <div style="margin-bottom: 30px;">
                <a href="#" style="margin: 0 15px; text-decoration: none; display: inline-block;">
                    <img src="https://cdn-icons-png.flaticon.com/512/3955/3955024.png" width="20" height="20" alt="Instagram" style="opacity: 0.5; filter: invert(1);">
                </a>
                <a href="#" style="margin: 0 15px; text-decoration: none; display: inline-block;">
                    <img src="https://cdn-icons-png.flaticon.com/512/3670/3670151.png" width="20" height="20" alt="Twitter" style="opacity: 0.5; filter: invert(1);">
                </a>
             </div>

             <p style="margin: 0; color: #555555;">&copy; ${new Date().getFullYear()} Zurusasa. All rights reserved.</p>
             <p style="margin: 15px 0 0; font-size: 10px; color: #333333; line-height: 1.5;">You are receiving this exclusive drop because you are an active subscriber to ZuruSasa premium updates.</p>
          </div>
          
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    subject: "⚓ Your 24-Hour Exclusive Access: Zuru Summer Yacht Drops",
    html: content
  };
};
