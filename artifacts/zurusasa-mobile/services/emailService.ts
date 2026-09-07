import { supabase } from '@/lib/supabase';

export interface BookingEmailParams {
  userId: string;
  bookingId: string;
  tripTitle: string;
  amount?: number | string;
  startDate?: string;
  endDate?: string;
  hostName?: string;
  reason?: string;
}

export interface SendEmailResult {
  success: boolean;
  recipientEmail?: string;
  provider: string;
  messageId?: string;
  error?: string;
}

function getZuruSasaEmailTemplate({
  headline,
  subhead,
  bodyText,
  tripTitle,
  bookingId,
  amount,
  dates,
  buttonText = 'View in ZuruSasa App',
}: {
  headline: string;
  subhead: string;
  bodyText: string;
  tripTitle: string;
  bookingId: string;
  amount?: string;
  dates?: string;
  buttonText?: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headline}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B0F19; margin: 0; padding: 24px 0; color: #FFFFFF; }
    .container { max-width: 580px; margin: 0 auto; background-color: #111827; border-radius: 16px; border: 1px solid #1F2937; overflow: hidden; }
    .header { background: linear-gradient(135deg, #111827 0%, #1E293B 100%); padding: 32px 32px 24px 32px; border-bottom: 1px solid #1F2937; text-align: center; }
    .logo-badge { display: inline-block; font-size: 20px; font-weight: 800; color: #F26522; letter-spacing: 0.5px; margin-bottom: 12px; }
    .headline { font-size: 24px; font-weight: 700; color: #FFFFFF; margin: 0 0 8px 0; }
    .subhead { font-size: 15px; color: #9CA3AF; margin: 0; line-height: 1.5; }
    .content { padding: 32px; }
    .card { background-color: #1F2937; border-radius: 12px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #F26522; }
    .trip-title { font-size: 18px; font-weight: 600; color: #FFFFFF; margin: 0 0 12px 0; }
    .meta-row { display: flex; justify-content: space-between; font-size: 14px; color: #D1D5DB; margin-bottom: 8px; }
    .meta-label { color: #9CA3AF; }
    .meta-val { font-weight: 500; color: #FFFFFF; }
    .btn-wrap { text-align: center; margin: 32px 0 16px 0; }
    .btn { display: inline-block; background-color: #F26522; color: #FFFFFF !important; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 10px; }
    .footer { text-align: center; padding: 24px 32px; border-top: 1px solid #1F2937; font-size: 12px; color: #6B7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-badge">🌴 ZURUSASA COASTAL</div>
      <h1 class="headline">${headline}</h1>
      <p class="subhead">${subhead}</p>
    </div>
    <div class="content">
      <p style="font-size: 15px; line-height: 1.6; color: #E5E7EB; margin-top: 0;">${bodyText}</p>
      
      <div class="card">
        <div class="trip-title">${tripTitle}</div>
        <div class="meta-row">
          <span class="meta-label">Booking Reference:</span>
          <span class="meta-val">${bookingId.slice(0, 8).toUpperCase()}</span>
        </div>
        ${dates ? `<div class="meta-row"><span class="meta-label">Dates:</span><span class="meta-val">${dates}</span></div>` : ''}
        ${amount ? `<div class="meta-row"><span class="meta-label">Amount Paid:</span><span class="meta-val" style="color: #F26522;">KES ${Number(amount).toLocaleString()}</span></div>` : ''}
      </div>

      <div class="btn-wrap">
        <a href="https://zurusasa.com/reservations" class="btn">${buttonText}</a>
      </div>
    </div>
    <div class="footer">
      ZuruSasa Ltd • Kenyan Coastal Escapes, Diani, Watamu & Lamu<br>
      © ${new Date().getFullYear()} ZuruSasa. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}

export const emailService = {
  /**
   * Helper to dispatch an email via Resend API or webhook
   */
  async dispatchEmail(to: string, subject: string, html: string): Promise<SendEmailResult> {
    const resendApiKey = process.env.EXPO_PUBLIC_RESEND_API_KEY || process.env.RESEND_API_KEY;
    const fromAddress = process.env.EXPO_PUBLIC_EMAIL_FROM || 'ZuruSasa <onboarding@resend.dev>';

    console.log(`[Email] Dispatch requested: to="${to}" subject="${subject}"`);

    // 1. First priority: Invoke Supabase Edge Function 'send-email' (uses RESEND_API_KEY stored securely in Supabase Secrets)
    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('send-email', {
        body: { to, subject, html, from: fromAddress },
      });

      if (!edgeError && edgeData?.success) {
        console.log(`[Email] Supabase Edge Function 'send-email' dispatch SUCCESS: id=${edgeData?.id}`);
        return {
          success: true,
          recipientEmail: to,
          provider: 'Supabase_Resend_EdgeFunction',
          messageId: edgeData?.id,
        };
      } else if (edgeError) {
        console.log(`[Email] Supabase Edge Function note: ${edgeError.message || edgeError}`);
      }
    } catch (edgeCatch) {
      console.log('[Email] Edge Function invoke exception:', edgeCatch);
    }

    // 2. Second priority: Direct Resend API if EXPO_PUBLIC_RESEND_API_KEY is defined in client .env
    if (resendApiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to,
            subject,
            html,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          console.warn('[Email] Direct Resend API error:', data);
          return {
            success: false,
            recipientEmail: to,
            provider: 'Resend_Direct',
            error: data?.message || 'Failed to dispatch email via Resend',
          };
        }

        console.log(`[Email] Direct Resend dispatch SUCCESS: id=${data?.id}`);
        return {
          success: true,
          recipientEmail: to,
          provider: 'Resend_Direct',
          messageId: data?.id,
        };
      } catch (err: any) {
        console.warn('[Email] Resend direct network error:', err);
        return {
          success: false,
          recipientEmail: to,
          provider: 'Resend_Direct',
          error: err?.message || 'Network error',
        };
      }
    }

    // 3. Dev Fallback: If neither Edge Function nor client key responded
    console.log(
      `[Email_SIMULATED] Email to <${to}>: "${subject}". Note: You have RESEND_API_KEY in Supabase. Ensure 'send-email' function is deployed (supabase functions deploy send-email) to dispatch live emails.`,
    );
    return {
      success: true,
      recipientEmail: to,
      provider: 'DevSimulator',
      messageId: `sim_${Date.now()}`,
    };
  },

  /**
   * Sends confirmation email to guest when host confirms their booking
   */
  async sendBookingConfirmedEmail(params: BookingEmailParams): Promise<SendEmailResult> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', params.userId)
        .maybeSingle();

      const recipientEmail = profile?.email;
      if (!recipientEmail) {
        console.log(`[Email] Guest ${params.userId.slice(0, 8)} has no email address on profile.`);
        return { success: false, provider: 'None', error: 'No email found for guest' };
      }

      const guestName = profile.full_name || 'Adventurer';
      const subject = `Reservation Confirmed: ${params.tripTitle} 🎉`;
      const html = getZuruSasaEmailTemplate({
        headline: 'Reservation Confirmed! 🎉',
        subhead: `Your stay has been accepted by the host.`,
        bodyText: `Jambo ${guestName}! Your host has confirmed your booking for <strong>${params.tripTitle}</strong>. Your itinerary and host contact details are now unlocked in your ZuruSasa account.`,
        tripTitle: params.tripTitle,
        bookingId: params.bookingId,
        amount: params.amount ? String(params.amount) : undefined,
        dates: params.startDate && params.endDate ? `${params.startDate} to ${params.endDate}` : undefined,
      });

      return await this.dispatchEmail(recipientEmail, subject, html);
    } catch (err: any) {
      console.warn('[Email] Error in sendBookingConfirmedEmail:', err);
      return { success: false, provider: 'None', error: err?.message };
    }
  },

  /**
   * Sends cancellation / decline notice email
   */
  async sendBookingCancelledEmail(params: BookingEmailParams): Promise<SendEmailResult> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', params.userId)
        .maybeSingle();

      const recipientEmail = profile?.email;
      if (!recipientEmail) {
        return { success: false, provider: 'None', error: 'No email found for recipient' };
      }

      const name = profile.full_name || 'Guest';
      const subject = `Reservation Update: ${params.tripTitle}`;
      const reasonText = params.reason ? `<p><strong>Reason:</strong> ${params.reason}</p>` : '';

      const html = getZuruSasaEmailTemplate({
        headline: 'Reservation Declined / Cancelled',
        subhead: `Update on your reservation for ${params.tripTitle}`,
        bodyText: `Hello ${name}. The reservation for <strong>${params.tripTitle}</strong> could not be accommodated. If payment was made, full refund processing has been initiated to your original payment method.${reasonText}`,
        tripTitle: params.tripTitle,
        bookingId: params.bookingId,
        buttonText: 'Browse Alternative Stays',
      });

      return await this.dispatchEmail(recipientEmail, subject, html);
    } catch (err: any) {
      console.warn('[Email] Error in sendBookingCancelledEmail:', err);
      return { success: false, provider: 'None', error: err?.message };
    }
  },
};
