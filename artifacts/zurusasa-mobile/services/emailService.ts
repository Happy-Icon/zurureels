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

export interface DispatchEmailParams {
  recipientUserId: string;
  bookingId?: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  success: boolean;
  provider: string;
  messageId?: string;
  skipped?: boolean;
  error?: string;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  const safeTripTitle = escapeHtml(tripTitle);
  const safeDates = dates ? escapeHtml(dates) : undefined;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(headline)}</title>
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
      <h1 class="headline">${escapeHtml(headline)}</h1>
      <p class="subhead">${escapeHtml(subhead)}</p>
    </div>
    <div class="content">
      <p style="font-size: 15px; line-height: 1.6; color: #E5E7EB; margin-top: 0;">${bodyText}</p>
      
      <div class="card">
        <div class="trip-title">${safeTripTitle}</div>
        <div class="meta-row">
          <span class="meta-label">Booking Reference:</span>
          <span class="meta-val">${escapeHtml(bookingId.slice(0, 8).toUpperCase())}</span>
        </div>
        ${safeDates ? `<div class="meta-row"><span class="meta-label">Dates:</span><span class="meta-val">${safeDates}</span></div>` : ''}
        ${amount ? `<div class="meta-row"><span class="meta-label">Amount Paid:</span><span class="meta-val" style="color: #F26522;">KES ${Number(amount).toLocaleString()}</span></div>` : ''}
      </div>

      <div class="btn-wrap">
        <a href="https://zurusasa.com/reservations" class="btn">${escapeHtml(buttonText)}</a>
      </div>
    </div>
    <div class="footer">
      ZuruSasa Ltd • Kenyan Coastal Escapes, Diani, Watamu &amp; Lamu<br>
      &copy; ${new Date().getFullYear()} ZuruSasa. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}

export const emailService = {
  /**
   * Dispatch a transactional email strictly via the authenticated 'send-email'
   * Supabase Edge Function (server resolves recipient email & owns RESEND_API_KEY).
   */
  async dispatchEmail(params: DispatchEmailParams): Promise<SendEmailResult> {
    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('send-email', {
        body: {
          recipientUserId: params.recipientUserId,
          bookingId: params.bookingId,
          subject: params.subject,
          html: params.html,
        },
      });

      if (edgeError || !edgeData?.success) {
        const errMsg = edgeData?.error || edgeError?.message || 'Failed to dispatch email';
        console.warn('[Email] send-email Edge Function error:', errMsg);
        return {
          success: false,
          provider: 'Supabase_Resend_EdgeFunction',
          error: errMsg,
        };
      }

      return {
        success: true,
        provider: 'Supabase_Resend_EdgeFunction',
        messageId: edgeData?.id,
        skipped: Boolean(edgeData?.skipped),
      };
    } catch (err: any) {
      console.warn('[Email] Edge Function invoke exception:', err);
      return {
        success: false,
        provider: 'Supabase_Resend_EdgeFunction',
        error: err?.message || 'Network error invoking send-email',
      };
    }
  },

  /**
   * Sends confirmation email to guest when host confirms their booking
   */
  async sendBookingConfirmedEmail(params: BookingEmailParams): Promise<SendEmailResult> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', params.userId)
        .maybeSingle();

      const guestName = escapeHtml(profile?.full_name || 'Adventurer');
      const safeTripTitle = escapeHtml(params.tripTitle);
      const subject = `Reservation Confirmed: ${params.tripTitle} 🎉`;
      const html = getZuruSasaEmailTemplate({
        headline: 'Reservation Confirmed!',
        subhead: 'Your stay has been accepted by the host.',
        bodyText: `Jambo ${guestName}! Your host has confirmed your booking for <strong>${safeTripTitle}</strong>. Your itinerary and host contact details are now unlocked in your ZuruSasa account.`,
        tripTitle: params.tripTitle,
        bookingId: params.bookingId,
        amount: params.amount ? String(params.amount) : undefined,
        dates: params.startDate && params.endDate ? `${params.startDate} to ${params.endDate}` : undefined,
      });

      return await this.dispatchEmail({
        recipientUserId: params.userId,
        bookingId: params.bookingId,
        subject,
        html,
      });
    } catch (err: any) {
      console.warn('[Email] Error in sendBookingConfirmedEmail:', err);
      return { success: false, provider: 'Supabase_Resend_EdgeFunction', error: err?.message };
    }
  },

  /**
   * Sends cancellation / decline notice email
   */
  async sendBookingCancelledEmail(params: BookingEmailParams): Promise<SendEmailResult> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', params.userId)
        .maybeSingle();

      const name = escapeHtml(profile?.full_name || 'Guest');
      const safeTripTitle = escapeHtml(params.tripTitle);
      const subject = `Reservation Update: ${params.tripTitle}`;
      const reasonText = params.reason
        ? `<p><strong>Reason:</strong> ${escapeHtml(params.reason)}</p>`
        : '';

      const html = getZuruSasaEmailTemplate({
        headline: 'Reservation Declined / Cancelled',
        subhead: `Update on your reservation for ${params.tripTitle}`,
        bodyText: `Hello ${name}. The reservation for <strong>${safeTripTitle}</strong> could not be accommodated. If payment was made, refund processing has been initiated to your original payment method.${reasonText}`,
        tripTitle: params.tripTitle,
        bookingId: params.bookingId,
        buttonText: 'Browse Alternative Stays',
      });

      return await this.dispatchEmail({
        recipientUserId: params.userId,
        bookingId: params.bookingId,
        subject,
        html,
      });
    } catch (err: any) {
      console.warn('[Email] Error in sendBookingCancelledEmail:', err);
      return { success: false, provider: 'Supabase_Resend_EdgeFunction', error: err?.message };
    }
  },
};
