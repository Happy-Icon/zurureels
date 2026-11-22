import { resolvePolicy, type NotificationPriority } from '../notificationPolicy.ts';
import { sanitizeSmsText } from '../sms/gsm7.ts';

export interface RenderedTemplate {
  templateKey: string;
  priority: NotificationPriority;
  subject: string;
  html: string;
  text: string;
  pushTitle: string;
  pushBody: string;
  smsBody: string;
  actionType: string;
}

export function escapeHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatKes(minorOrMajor: unknown, isMinorUnits = false): string | null {
  const num = Number(minorOrMajor);
  if (!Number.isFinite(num) || num <= 0) return null;
  const major = isMinorUnits ? Math.round(num / 100) : Math.round(num);
  return `KES ${major.toLocaleString('en-US')}`;
}

function formatShortDate(iso: unknown, timezone = 'Africa/Nairobi'): string | null {
  if (typeof iso !== 'string' || !iso.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone,
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function renderEmailShell(opts: {
  badge?: string;
  headline: string;
  subhead: string;
  bodyParagraphs: string[];
  details?: Array<{ label: string; value: string; highlight?: boolean }>;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}): { html: string; text: string } {
  const badge = opts.badge || 'ZURUSASA COASTAL';
  const detailsHtml =
    opts.details && opts.details.length > 0
      ? `<div style="background-color:#1F2937;border-radius:12px;padding:18px 20px;margin:20px 0;border-left:4px solid #F26522;">
          ${opts.details
            .map(
              (row) =>
                `<div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px;">
                  <span style="color:#9CA3AF;">${escapeHtml(row.label)}</span>
                  <span style="font-weight:600;color:${row.highlight ? '#F26522' : '#FFFFFF'};">${escapeHtml(row.value)}</span>
                </div>`,
            )
            .join('')}
        </div>`
      : '';

  const ctaHtml = opts.ctaLabel
    ? `<div style="text-align:center;margin:28px 0 12px;">
        <a href="${escapeHtml(opts.ctaUrl || 'https://zurusasa.com')}" style="display:inline-block;background-color:#F26522;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px;padding:13px 28px;border-radius:10px;">${escapeHtml(opts.ctaLabel)}</a>
      </div>`
    : '';

  const bodyHtml = opts.bodyParagraphs
    .map((p) => `<p style="font-size:15px;line-height:1.6;color:#E5E7EB;margin:0 0 14px;">${p}</p>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.headline)}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#0B0F19;margin:0;padding:24px 12px;color:#FFFFFF;">
  <div style="max-width:560px;margin:0 auto;background-color:#111827;border-radius:16px;border:1px solid #1F2937;overflow:hidden;">
    <div style="padding:30px 28px 22px;border-bottom:1px solid #1F2937;text-align:center;">
      <div style="font-size:16px;font-weight:800;color:#F26522;letter-spacing:0.6px;margin-bottom:10px;">${escapeHtml(badge)}</div>
      <h1 style="font-size:22px;font-weight:700;color:#FFFFFF;margin:0 0 8px;">${escapeHtml(opts.headline)}</h1>
      <p style="font-size:14px;color:#9CA3AF;margin:0;line-height:1.5;">${escapeHtml(opts.subhead)}</p>
    </div>
    <div style="padding:26px 28px;">
      ${bodyHtml}
      ${detailsHtml}
      ${ctaHtml}
    </div>
    <div style="text-align:center;padding:18px 28px;border-top:1px solid #1F2937;font-size:12px;color:#6B7280;">
      ${escapeHtml(opts.footerNote || 'ZuruSasa Ltd • Kenyan Coastal Escapes')}
    </div>
  </div>
</body>
</html>`;

  const plainBody = opts.bodyParagraphs.map((p) => p.replace(/<[^>]+>/g, '')).join('\n\n');
  const plainDetails =
    opts.details && opts.details.length > 0
      ? '\n\n' + opts.details.map((d) => `${d.label}: ${d.value}`).join('\n')
      : '';
  const plainCta = opts.ctaLabel ? `\n\n${opts.ctaLabel}: ${opts.ctaUrl || 'https://zurusasa.com'}` : '';
  const text = `${opts.headline}\n${opts.subhead}\n\n${plainBody}${plainDetails}${plainCta}\n\n${opts.footerNote || 'ZuruSasa Ltd • Kenyan Coastal Escapes'}`;

  return { html, text };
}

export const ALLOWED_CLIENT_EMAIL_TEMPLATES = new Set<string>([
  'host_application',
  'host_welcome',
  'booking_confirmed',
  'booking_declined',
  'booking_cancelled_guest',
]);

export function renderSmsBody(
  key: string,
  payload: Record<string, unknown>,
  ctx: {
    tripTitle: string;
    bookingRef: string;
    dateRange: string | null;
    amountStr: string | null;
    fallbackText: string;
  },
): string {
  const { tripTitle, bookingRef, dateRange, amountStr, fallbackText } = ctx;
  const shortTitle = tripTitle.length > 36 ? `${tripTitle.slice(0, 33).trimEnd()}...` : tripTitle;
  const refTag = bookingRef ? `Ref #${bookingRef}` : undefined;

  switch (key) {
    case 'payment_success':
    case 'payment_receipt': {
      const isInstant = payload.booking_mode === 'instant' || payload.booking_status === 'confirmed';
      const base = isInstant
        ? `ZuruSasa: Booking CONFIRMED for ${shortTitle}${dateRange ? ` (${dateRange})` : ''}${amountStr ? ` - ${amountStr}` : ''}. Open Trips for check-in PIN.`
        : `ZuruSasa: Payment received${amountStr ? ` (${amountStr})` : ''} for ${shortTitle}. Awaiting host approval. We will alert you once confirmed.`;
      return sanitizeSmsText(base, 160, refTag);
    }
    case 'payment_failed': {
      const base = `ZuruSasa: Payment unsuccessful for ${shortTitle}${amountStr ? ` (${amountStr})` : ''}. No funds were captured. Retry checkout in the app.`;
      const payRef = typeof payload.provider_reference === 'string' && payload.provider_reference
        ? `Ref #${payload.provider_reference.slice(-8).toUpperCase()}`
        : refTag;
      return sanitizeSmsText(base, 160, payRef);
    }
    case 'booking_confirmed': {
      const base = `ZuruSasa: Confirmed! Your booking for ${shortTitle}${dateRange ? ` (${dateRange})` : ''} is approved. Open Trips for directions & check-in PIN.`;
      return sanitizeSmsText(base, 160, refTag);
    }
    case 'booking_request': {
      const isInstant = payload.booking_mode === 'instant' || payload.booking_status === 'confirmed';
      const base = isInstant
        ? `ZuruSasa Host: New instant booking for ${shortTitle}${dateRange ? ` (${dateRange})` : ''}${amountStr ? ` - ${amountStr}` : ''}. Open Host Dashboard.`
        : `ZuruSasa Host: New paid booking request for ${shortTitle}${amountStr ? ` (${amountStr})` : ''}. Open Host Dashboard to confirm or decline.`;
      return sanitizeSmsText(base, 160, refTag);
    }
    case 'booking_declined': {
      const base = `ZuruSasa: Your booking for ${shortTitle} was declined by the host. Any payment made is being refunded automatically.`;
      return sanitizeSmsText(base, 160, refTag);
    }
    case 'booking_cancelled':
    case 'booking_cancelled_host':
    case 'booking_cancelled_guest': {
      const isHostCopy = key === 'booking_cancelled_host';
      const base = isHostCopy
        ? `ZuruSasa Host: Booking for ${shortTitle} was cancelled by the guest. Your calendar dates are reopened.`
        : `ZuruSasa: Your booking for ${shortTitle} has been cancelled.${amountStr ? ` Refund of ${amountStr} initiated.` : ''}`;
      return sanitizeSmsText(base, 160, refTag);
    }
    case 'refund_processed': {
      const base = `ZuruSasa: Refund${amountStr ? ` of ${amountStr}` : ''} for ${shortTitle} has been processed to your original payment account.`;
      return sanitizeSmsText(base, 160, refTag);
    }
    case 'payout_completed': {
      const transferRef = payload.transfer_code
        ? `Ref #${String(payload.transfer_code).slice(-8).toUpperCase()}`
        : refTag;
      const base = `ZuruSasa Host: Payout${amountStr ? ` of ${amountStr}` : ''} settled to your payout account. View Host Wallet for details.`;
      return sanitizeSmsText(base, 160, transferRef);
    }
    case 'payout_failed': {
      const base = `ZuruSasa Host Action Needed: Your payout${amountStr ? ` (${amountStr})` : ''} failed. Update your M-Pesa or bank details in Host Wallet.`;
      return sanitizeSmsText(base, 160, refTag);
    }
    case 'arrival_issue_reported': {
      const base = `ZuruSasa Host Urgent: Guest reported an arrival issue for ${shortTitle}. Payout is paused pending review. Open Inbox now.`;
      return sanitizeSmsText(base, 160, refTag);
    }
    case 'booking_reminder_24h': {
      const isHost = payload.recipient_role === 'host';
      const checkInTime = payload.check_in_time ? ` at ${String(payload.check_in_time)}` : '';
      const base = isHost
        ? `ZuruSasa Host Reminder: Guest arrives tomorrow${checkInTime} for ${shortTitle}. Ensure check-in readiness.`
        : `ZuruSasa Reminder: ${shortTitle} starts tomorrow${checkInTime}. Open Trips for directions & check-in PIN.`;
      return sanitizeSmsText(base, 160, refTag);
    }
    case 'booking_reminder_1h': {
      const isHost = payload.recipient_role === 'host';
      const base = isHost
        ? `ZuruSasa Host Reminder: Your guest for ${shortTitle} arrives in 1 hour. Be ready for check-in.`
        : `ZuruSasa Reminder: ${shortTitle} starts in 1 hour! Open Trips for directions & your 6-digit check-in PIN.`;
      return sanitizeSmsText(base, 160, refTag);
    }
    case 'verification_approved':
      return sanitizeSmsText('ZuruSasa: Identity verified! Your Verified Host badge is now active on your profile and listings.', 160);
    case 'verification_declined':
      return sanitizeSmsText('ZuruSasa: Your identity verification needs attention. Open the app to retry with clear ID photos.', 160);
    default:
      return sanitizeSmsText(`ZuruSasa: ${fallbackText}`, 160, refTag);
  }
}

export function renderNotificationTemplate(
  templateKey: string,
  payload: Record<string, unknown> = {},
): RenderedTemplate {
  const core = renderNotificationTemplateCore(templateKey, payload);
  const key = String(templateKey || 'generic').trim().toLowerCase();
  const tz = typeof payload.timezone === 'string' && payload.timezone.trim() ? payload.timezone.trim() : 'Africa/Nairobi';
  const tripTitle = String(payload.trip_title || payload.title || 'your reservation').trim();
  const bookingId = typeof payload.booking_id === 'string' ? payload.booking_id : typeof payload.action_id === 'string' ? payload.action_id : '';
  const bookingRef = bookingId ? bookingId.slice(0, 8).toUpperCase() : '';
  const checkInStr = formatShortDate(payload.check_in || payload.start_date, tz);
  const checkOutStr = formatShortDate(payload.check_out || payload.end_date, tz);
  const dateRange = checkInStr && checkOutStr && checkInStr !== checkOutStr ? `${checkInStr} - ${checkOutStr}` : checkInStr;
  const amountMajorStr = formatKes(payload.amount, false);
  const amountMinorStr = formatKes(payload.amount_minor ?? payload.refund_amount_minor, true);
  const amountStr = amountMinorStr || amountMajorStr;

  const smsBody = renderSmsBody(key, payload, {
    tripTitle,
    bookingRef,
    dateRange,
    amountStr,
    fallbackText: core.pushBody || core.pushTitle,
  });

  return { ...core, smsBody };
}

function renderNotificationTemplateCore(
  templateKey: string,
  payload: Record<string, unknown> = {},
): Omit<RenderedTemplate, 'smsBody'> {
  const key = String(templateKey || 'generic').trim().toLowerCase();
  const policy = resolvePolicy(key);
  const tz = typeof payload.timezone === 'string' && payload.timezone.trim() ? payload.timezone.trim() : 'Africa/Nairobi';
  const recipientName = String(payload.recipient_name || payload.guest_name || payload.host_name || payload.name || 'Traveler').trim();
  const tripTitle = String(payload.trip_title || payload.title || 'your reservation').trim();
  const bookingId = typeof payload.booking_id === 'string' ? payload.booking_id : typeof payload.action_id === 'string' ? payload.action_id : '';
  const bookingRef = bookingId ? bookingId.slice(0, 8).toUpperCase() : '';
  const checkInStr = formatShortDate(payload.check_in || payload.start_date, tz);
  const checkOutStr = formatShortDate(payload.check_out || payload.end_date, tz);
  const dateRange = checkInStr && checkOutStr && checkInStr !== checkOutStr ? `${checkInStr} – ${checkOutStr}` : checkInStr;
  const amountMajorStr = formatKes(payload.amount, false);
  const amountMinorStr = formatKes(payload.amount_minor ?? payload.refund_amount_minor, true);
  const amountStr = amountMinorStr || amountMajorStr;

  switch (key) {
    case 'host_application':
    case 'host_welcome': {
      const shell = renderEmailShell({
        headline: `Welcome to Hosting, ${recipientName}!`,
        subhead: 'Your ZuruSasa Host Dashboard is now active.',
        bodyParagraphs: [
          'You can now publish video reels, configure availability calendars, complete Persona identity verification, and receive escrow-protected bookings across the Kenyan coast.',
        ],
        ctaLabel: 'Open Host Dashboard',
        ctaUrl: 'https://zurusasa.com/host',
      });
      return {
        templateKey: 'host_welcome',
        priority: policy.priority,
        subject: 'Welcome to ZuruSasa Hosting!',
        html: shell.html,
        text: shell.text,
        pushTitle: 'Welcome to ZuruSasa Hosting!',
        pushBody: 'Your Host Dashboard is active. Start publishing reels and managing bookings.',
        actionType: 'listing',
      };
    }

    case 'payment_success':
    case 'payment_receipt': {
      const isInstant = payload.booking_mode === 'instant' || payload.booking_status === 'confirmed';
      const headline = isInstant ? 'Booking Confirmed & Paid!' : 'Payment Received!';
      const subhead = isInstant
        ? `Your reservation for ${tripTitle} is confirmed and locked in.`
        : `Your payment for ${tripTitle} was received. Awaiting host confirmation.`;
      const details: Array<{ label: string; value: string; highlight?: boolean }> = [
        { label: 'Experience', value: tripTitle },
      ];
      if (bookingRef) details.push({ label: 'Booking Ref', value: `#${bookingRef}` });
      if (dateRange) details.push({ label: 'Dates', value: dateRange });
      if (amountStr) details.push({ label: 'Amount Paid', value: amountStr, highlight: true });

      const shell = renderEmailShell({
        headline,
        subhead,
        bodyParagraphs: [
          `Jambo ${escapeHtml(recipientName)}! ${
            isInstant
              ? `Your payment has been verified and your booking for <strong>${escapeHtml(tripTitle)}</strong> is instantly confirmed.`
              : `We received your payment for <strong>${escapeHtml(tripTitle)}</strong>. Your host has been notified to review and confirm your stay.`
          }`,
        ],
        details,
        ctaLabel: 'View Your Reservation',
        ctaUrl: 'https://zurusasa.com/reservations',
      });

      return {
        templateKey: 'payment_receipt',
        priority: 'critical',
        subject: isInstant ? `Booking Confirmed: ${tripTitle}` : `Payment Receipt: ${tripTitle}`,
        html: shell.html,
        text: shell.text,
        pushTitle: String(payload.title || headline),
        pushBody: String(
          payload.message ||
            (isInstant
              ? `Your booking for "${tripTitle}" is confirmed${amountStr ? ` (${amountStr})` : ''}.`
              : `Payment received${amountStr ? ` (${amountStr})` : ''} for "${tripTitle}". Awaiting host confirmation.`),
        ),
        actionType: 'booking',
      };
    }

    case 'payment_failed': {
      const reason = String(payload.failure_message || payload.reason || 'Your payment could not be completed.').trim();
      const shell = renderEmailShell({
        headline: 'Payment Unsuccessful',
        subhead: `We could not complete payment for ${tripTitle}.`,
        bodyParagraphs: [
          `Hello ${escapeHtml(recipientName)}, your payment attempt for <strong>${escapeHtml(tripTitle)}</strong> was not completed.`,
          `<strong>Details:</strong> ${escapeHtml(reason)}`,
          'No funds were captured for this reservation. You can retry checkout anytime from the ZuruSasa app.',
        ],
        details: amountStr ? [{ label: 'Attempted Amount', value: amountStr }] : undefined,
        ctaLabel: 'Return to ZuruSasa',
        ctaUrl: 'https://zurusasa.com/reservations',
      });
      return {
        templateKey: 'payment_failed',
        priority: 'critical',
        subject: `Payment Failed: ${tripTitle}`,
        html: shell.html,
        text: shell.text,
        pushTitle: 'Payment Unsuccessful',
        pushBody: `Your payment for "${tripTitle}" did not go through. Tap to try again.`,
        actionType: 'booking',
      };
    }

    case 'booking_confirmed': {
      const details: Array<{ label: string; value: string; highlight?: boolean }> = [
        { label: 'Experience', value: tripTitle },
      ];
      if (bookingRef) details.push({ label: 'Booking Ref', value: `#${bookingRef}` });
      if (dateRange) details.push({ label: 'Dates', value: dateRange });
      if (amountStr) details.push({ label: 'Total Paid', value: amountStr, highlight: true });

      const shell = renderEmailShell({
        headline: 'Reservation Confirmed!',
        subhead: `Your booking for ${tripTitle} is confirmed.`,
        bodyParagraphs: [
          `Jambo ${escapeHtml(recipientName)}! Your reservation for <strong>${escapeHtml(tripTitle)}</strong> is confirmed. Your arrival PIN, directions, and host contact details are now available in Trips.`,
        ],
        details,
        ctaLabel: 'View Trip Details',
        ctaUrl: 'https://zurusasa.com/reservations',
      });
      return {
        templateKey: 'booking_confirmed',
        priority: 'critical',
        subject: `Reservation Confirmed: ${tripTitle}`,
        html: shell.html,
        text: shell.text,
        pushTitle: String(payload.title || 'Reservation Confirmed!'),
        pushBody: String(payload.message || `Your reservation for "${tripTitle}" is confirmed.`),
        actionType: 'booking',
      };
    }

    case 'booking_request': {
      const isInstant = payload.booking_mode === 'instant' || payload.booking_status === 'confirmed';
      const headline = isInstant ? 'New Confirmed Booking!' : 'New Booking Request';
      const subhead = isInstant
        ? `A guest just booked "${tripTitle}".`
        : `A guest paid for "${tripTitle}" — please review and confirm.`;
      const details: Array<{ label: string; value: string; highlight?: boolean }> = [
        { label: 'Listing', value: tripTitle },
      ];
      if (bookingRef) details.push({ label: 'Booking Ref', value: `#${bookingRef}` });
      if (dateRange) details.push({ label: 'Dates', value: dateRange });
      if (amountStr) details.push({ label: 'Booking Total', value: amountStr, highlight: true });

      const shell = renderEmailShell({
        headline,
        subhead,
        bodyParagraphs: [
          `Hello ${escapeHtml(recipientName)}, ${
            isInstant
              ? `a new instant booking for <strong>${escapeHtml(tripTitle)}</strong> has been confirmed.`
              : `you have a new paid booking request for <strong>${escapeHtml(tripTitle)}</strong>. Open your Host Dashboard to confirm or decline.`
          }`,
        ],
        details,
        ctaLabel: 'Open Host Reservations',
        ctaUrl: 'https://zurusasa.com/reservations',
      });
      return {
        templateKey: 'booking_request',
        priority: 'critical',
        subject: `${headline}: ${tripTitle}`,
        html: shell.html,
        text: shell.text,
        pushTitle: String(payload.title || headline),
        pushBody: String(payload.message || subhead),
        actionType: 'booking',
      };
    }

    case 'booking_declined': {
      const reason = typeof payload.reason === 'string' && payload.reason.trim() ? payload.reason.trim() : '';
      const details: Array<{ label: string; value: string }> = [{ label: 'Listing', value: tripTitle }];
      if (bookingRef) details.push({ label: 'Booking Ref', value: `#${bookingRef}` });
      if (reason) details.push({ label: 'Host Note', value: reason });

      const shell = renderEmailShell({
        headline: 'Reservation Declined',
        subhead: `Update regarding your reservation for ${tripTitle}.`,
        bodyParagraphs: [
          `Hello ${escapeHtml(recipientName)}, unfortunately the host could not accommodate your booking for <strong>${escapeHtml(tripTitle)}</strong>. Any payment made is automatically being refunded to your original payment method.`,
        ],
        details,
        ctaLabel: 'Explore Alternative Stays',
        ctaUrl: 'https://zurusasa.com/discover',
      });
      return {
        templateKey: 'booking_declined',
        priority: 'critical',
        subject: `Reservation Declined: ${tripTitle}`,
        html: shell.html,
        text: shell.text,
        pushTitle: String(payload.title || 'Reservation Declined'),
        pushBody: String(payload.message || `Your booking for "${tripTitle}" was declined. A refund has been initiated.`),
        actionType: 'booking',
      };
    }

    case 'booking_cancelled':
    case 'booking_cancelled_host':
    case 'booking_cancelled_guest': {
      const isHostCopy = key === 'booking_cancelled_host';
      const reason = typeof payload.reason === 'string' && payload.reason.trim() ? payload.reason.trim() : '';
      const details: Array<{ label: string; value: string; highlight?: boolean }> = [
        { label: 'Listing', value: tripTitle },
      ];
      if (bookingRef) details.push({ label: 'Booking Ref', value: `#${bookingRef}` });
      if (amountMinorStr) details.push({ label: 'Refund Amount', value: amountMinorStr, highlight: true });
      if (reason) details.push({ label: 'Reason', value: reason });

      const shell = renderEmailShell({
        headline: 'Reservation Cancelled',
        subhead: isHostCopy
          ? `A guest cancelled their reservation for ${tripTitle}.`
          : `Your reservation for ${tripTitle} has been cancelled.`,
        bodyParagraphs: [
          isHostCopy
            ? `Hello ${escapeHtml(recipientName)}, the reservation for <strong>${escapeHtml(tripTitle)}</strong> was cancelled by the guest. Your calendar dates have been reopened.`
            : `Hello ${escapeHtml(recipientName)}, your reservation for <strong>${escapeHtml(tripTitle)}</strong> has been cancelled.${
                amountMinorStr ? ` A refund of <strong>${escapeHtml(amountMinorStr)}</strong> has been initiated.` : ''
              }`,
        ],
        details,
        ctaLabel: 'View Reservations',
        ctaUrl: 'https://zurusasa.com/reservations',
      });
      return {
        templateKey: key,
        priority: 'critical',
        subject: `Reservation Cancelled: ${tripTitle}`,
        html: shell.html,
        text: shell.text,
        pushTitle: String(payload.title || 'Reservation Cancelled'),
        pushBody: String(payload.message || `Reservation for "${tripTitle}" was cancelled.`),
        actionType: 'booking',
      };
    }

    case 'refund_processed': {
      const details: Array<{ label: string; value: string; highlight?: boolean }> = [
        { label: 'Reservation', value: tripTitle },
      ];
      if (bookingRef) details.push({ label: 'Booking Ref', value: `#${bookingRef}` });
      if (amountStr) details.push({ label: 'Refunded Amount', value: amountStr, highlight: true });

      const shell = renderEmailShell({
        headline: 'Refund Processed',
        subhead: 'Your refund has been issued to your original payment method.',
        bodyParagraphs: [
          `Hello ${escapeHtml(recipientName)}, your refund${amountStr ? ` of <strong>${escapeHtml(amountStr)}</strong>` : ''} for <strong>${escapeHtml(tripTitle)}</strong> has been processed. Depending on your bank or M-Pesa, funds typically settle shortly.`,
        ],
        details,
        ctaLabel: 'View Booking History',
        ctaUrl: 'https://zurusasa.com/reservations',
      });
      return {
        templateKey: 'refund_processed',
        priority: 'critical',
        subject: `Refund Processed: ${tripTitle}`,
        html: shell.html,
        text: shell.text,
        pushTitle: String(payload.title || 'Refund Processed'),
        pushBody: String(payload.message || `Your refund${amountStr ? ` of ${amountStr}` : ''} has been processed.`),
        actionType: 'booking',
      };
    }

    case 'payout_completed': {
      const details: Array<{ label: string; value: string; highlight?: boolean }> = [];
      if (amountStr) details.push({ label: 'Payout Amount', value: amountStr, highlight: true });
      if (bookingRef) details.push({ label: 'Booking Ref', value: `#${bookingRef}` });
      if (payload.transfer_code) details.push({ label: 'Transfer Reference', value: String(payload.transfer_code) });

      const shell = renderEmailShell({
        headline: 'Host Payout Sent!',
        subhead: 'Funds have been transferred to your payout account.',
        bodyParagraphs: [
          `Hello ${escapeHtml(recipientName)}, your payout${amountStr ? ` of <strong>${escapeHtml(amountStr)}</strong>` : ''} has been dispatched to your registered payout account.`,
        ],
        details,
        ctaLabel: 'Open Host Wallet',
        ctaUrl: 'https://zurusasa.com/host/wallet',
      });
      return {
        templateKey: 'payout_completed',
        priority: 'critical',
        subject: `Payout Sent${amountStr ? `: ${amountStr}` : ''}`,
        html: shell.html,
        text: shell.text,
        pushTitle: String(payload.title || 'Payout Sent!'),
        pushBody: String(payload.message || `${amountStr || 'Your payout'} has been transferred to your payout account.`),
        actionType: 'payout',
      };
    }

    case 'payout_failed': {
      const reason = String(payload.failure_reason || payload.reason || 'Transfer could not be completed').trim();
      const details: Array<{ label: string; value: string }> = [
        { label: 'Reason', value: reason },
      ];
      if (amountStr) details.push({ label: 'Payout Amount', value: amountStr });
      if (bookingRef) details.push({ label: 'Booking Ref', value: `#${bookingRef}` });

      const shell = renderEmailShell({
        headline: 'Action Needed: Payout Failed',
        subhead: 'We could not complete your scheduled host payout.',
        bodyParagraphs: [
          `Hello ${escapeHtml(recipientName)}, after multiple attempts we could not transfer your host payout. Please verify your payout bank or M-Pesa details in your Host Wallet.`,
        ],
        details,
        ctaLabel: 'Update Payout Details',
        ctaUrl: 'https://zurusasa.com/host/wallet',
      });
      return {
        templateKey: 'payout_failed',
        priority: 'critical',
        subject: 'Action Needed: Host Payout Failed',
        html: shell.html,
        text: shell.text,
        pushTitle: 'Payout Action Required',
        pushBody: 'We could not transfer your host payout. Please verify your payout account details.',
        actionType: 'payout',
      };
    }

    case 'verification_approved': {
      const shell = renderEmailShell({
        headline: 'Identity Verified!',
        subhead: 'Your Verified Host badge is now active on ZuruSasa.',
        bodyParagraphs: [
          `Congratulations ${escapeHtml(recipientName)}! Your Persona identity verification has been approved. Your Verified badge now appears across your profile and listings.`,
        ],
        ctaLabel: 'View Your Profile',
        ctaUrl: 'https://zurusasa.com/profile',
      });
      return {
        templateKey: 'verification_approved',
        priority: 'critical',
        subject: 'Your ZuruSasa Identity is Verified',
        html: shell.html,
        text: shell.text,
        pushTitle: 'Identity Verified!',
        pushBody: 'Your ZuruSasa Verified badge is now live on your profile and listings.',
        actionType: 'profile',
      };
    }

    case 'verification_declined': {
      const shell = renderEmailShell({
        headline: 'Identity Verification Needs Attention',
        subhead: 'We could not verify your submitted identity document.',
        bodyParagraphs: [
          `Hello ${escapeHtml(recipientName)}, your recent identity verification could not be approved. Please ensure your government ID and selfie are clear, well-lit, and unobstructed, then try again.`,
        ],
        ctaLabel: 'Retry Verification',
        ctaUrl: 'https://zurusasa.com/host/verification',
      });
      return {
        templateKey: 'verification_declined',
        priority: 'critical',
        subject: 'Identity Verification Update',
        html: shell.html,
        text: shell.text,
        pushTitle: 'Verification Needs Attention',
        pushBody: 'We could not complete your identity verification. Tap to retry.',
        actionType: 'profile',
      };
    }

    case 'arrival_issue_reported': {
      const reason = String(payload.reason || 'Guest reported an arrival issue').trim();
      const shell = renderEmailShell({
        headline: 'Arrival Issue Reported',
        subhead: `Payout paused pending review for ${tripTitle}.`,
        bodyParagraphs: [
          `Hello ${escapeHtml(recipientName)}, your guest reported an arrival issue for <strong>${escapeHtml(tripTitle)}</strong>: "${escapeHtml(reason)}".`,
          'Please contact your guest immediately via Inbox to resolve the issue. Payout release is paused until resolved.',
        ],
        details: bookingRef ? [{ label: 'Booking Ref', value: `#${bookingRef}` }] : undefined,
        ctaLabel: 'Open Reservation',
        ctaUrl: 'https://zurusasa.com/reservations',
      });
      return {
        templateKey: 'arrival_issue_reported',
        priority: 'critical',
        subject: `Urgent: Arrival Issue Reported — ${tripTitle}`,
        html: shell.html,
        text: shell.text,
        pushTitle: String(payload.title || 'Arrival Issue Reported — Payout Paused'),
        pushBody: String(payload.message || `Guest reported an arrival issue for "${tripTitle}".`),
        actionType: 'booking',
      };
    }

    case 'booking_reminder_24h':
    case 'booking_reminder_1h': {
      const isOneHour = key === 'booking_reminder_1h';
      const isHost = payload.recipient_role === 'host';
      const leadLabel = isOneHour ? 'in 1 hour' : 'tomorrow (24 hours)';
      const headline = isOneHour
        ? isHost
          ? `Guest Arriving in 1 Hour`
          : `Your Experience Starts in 1 Hour`
        : isHost
          ? `Guest Arriving Tomorrow`
          : `Reminder: ${tripTitle} is Tomorrow`;
      const bodyText = isHost
        ? `Your guest for "${tripTitle}" is scheduled to arrive ${leadLabel}. Make sure arrival instructions and check-in readiness are set.`
        : `"${tripTitle}" starts ${leadLabel}. Open Trips to view directions, check-in PIN, and arrival details.`;
      const details: Array<{ label: string; value: string }> = [{ label: 'Experience', value: tripTitle }];
      if (bookingRef) details.push({ label: 'Booking Ref', value: `#${bookingRef}` });
      if (dateRange) details.push({ label: 'Schedule', value: dateRange });
      if (payload.check_in_time) details.push({ label: 'Check-In Time', value: String(payload.check_in_time) });

      const shell = renderEmailShell({
        headline,
        subhead: bodyText,
        bodyParagraphs: [`Jambo ${escapeHtml(recipientName)}! ${escapeHtml(bodyText)}`],
        details,
        ctaLabel: 'View Trip Details',
        ctaUrl: 'https://zurusasa.com/reservations',
      });
      return {
        templateKey: key,
        priority: 'normal',
        subject: headline,
        html: shell.html,
        text: shell.text,
        pushTitle: headline,
        pushBody: bodyText,
        actionType: 'booking',
      };
    }

    case 'zuruplan_reminder': {
      const destination = String(payload.destination || 'your coastal trip').trim();
      const bodyText = String(
        payload.message || `Your ZuruPlan itinerary "${tripTitle}" for ${destination} is coming up soon!`,
      );
      const shell = renderEmailShell({
        headline: `Trip Reminder: ${tripTitle}`,
        subhead: destination,
        bodyParagraphs: [`Jambo ${escapeHtml(recipientName)}! ${escapeHtml(bodyText)}`],
        ctaLabel: 'Open ZuruPlan',
        ctaUrl: 'https://zurusasa.com/plan',
      });
      return {
        templateKey: 'zuruplan_reminder',
        priority: 'normal',
        subject: `Trip Reminder: ${tripTitle}`,
        html: shell.html,
        text: shell.text,
        pushTitle: `Trip Reminder: ${tripTitle}`,
        pushBody: bodyText,
        actionType: 'discover',
      };
    }

    case 'data_export_otp': {
      const otp = String(payload.otp || '').trim();
      const shell = renderEmailShell({
        badge: 'ZURUSASA PRIVACY',
        headline: 'Personal Data Access Verification',
        subhead: 'Use this 6-digit code to authorize your data export.',
        bodyParagraphs: [
          'A request to export your personal data was initiated on your ZuruSasa account. Use the verification code below within <strong>10 minutes</strong>:',
          `<div style="background-color:#1F2937;border-radius:8px;padding:18px;text-align:center;margin:18px 0;"><span style="font-size:32px;font-weight:800;letter-spacing:6px;color:#F26522;font-family:monospace;">${escapeHtml(otp)}</span></div>`,
          'If you did not request this export, please secure your account immediately.',
        ],
        footerNote: 'ZuruSasa Privacy & Data Protection Team • Kenya DPA 2019 / GDPR Art. 15',
      });
      return {
        templateKey: 'data_export_otp',
        priority: 'critical',
        subject: `Your ZuruSasa Data Request Verification Code: ${otp}`,
        html: shell.html,
        text: shell.text,
        pushTitle: 'Data Export Verification',
        pushBody: 'Check your email for your 6-digit verification code.',
        actionType: 'profile',
      };
    }

    case 'data_export_ready': {
      const reqId = String(payload.request_id || '').trim();
      const shell = renderEmailShell({
        badge: 'ZURUSASA PRIVACY',
        headline: 'Your Personal Data Export is Ready',
        subhead: 'Available for download for 7 days.',
        bodyParagraphs: [
          'Your requested ZuruSasa personal data archive has been compiled. Download it from the mobile app under <strong>Settings → Privacy & Data → Request My Personal Data</strong>.',
          'In accordance with our retention policy, export files are permanently purged after 7 days.',
        ],
        details: reqId ? [{ label: 'Request ID', value: reqId }] : undefined,
        footerNote: 'ZuruSasa Privacy Team • Kenya DPA 2019 / GDPR Art. 15 & 20',
      });
      return {
        templateKey: 'data_export_ready',
        priority: 'critical',
        subject: 'Your ZuruSasa Personal Data Archive is Ready for Download',
        html: shell.html,
        text: shell.text,
        pushTitle: 'Personal Data Export Ready',
        pushBody: 'Your requested personal data archive is ready to download for 7 days.',
        actionType: 'profile',
      };
    }

    case 'new_message':
    case 'message': {
      const senderName = String(payload.sender_name || 'Someone').trim();
      const preview = String(payload.preview || payload.message || 'Sent you a message').trim();
      const shell = renderEmailShell({
        headline: `New message from ${senderName}`,
        subhead: 'Reply in the ZuruSasa Inbox.',
        bodyParagraphs: [`${escapeHtml(senderName)} sent you a message: "${escapeHtml(preview)}"`],
        ctaLabel: 'Open Inbox',
        ctaUrl: 'https://zurusasa.com/inbox',
      });
      return {
        templateKey: 'new_message',
        priority: 'normal',
        subject: `New message from ${senderName}`,
        html: shell.html,
        text: shell.text,
        pushTitle: String(payload.title || `New message from ${senderName}`),
        pushBody: preview,
        actionType: 'chat',
      };
    }

    case 'promotional_offer':
    case 'promotion': {
      const headline = String(payload.title || 'Exclusive Coastal Offer').trim();
      const bodyMsg = String(payload.message || 'Discover hand-picked coastal stays and deals on ZuruSasa.').trim();
      const shell = renderEmailShell({
        headline,
        subhead: 'Curated coastal deals from ZuruSasa',
        bodyParagraphs: [escapeHtml(bodyMsg)],
        ctaLabel: 'Explore Deals',
        ctaUrl: 'https://zurusasa.com/discover',
        footerNote: 'You are receiving this because you opted in to ZuruSasa offers. Manage preferences anytime in Settings → Notifications.',
      });
      return {
        templateKey: 'promotional_offer',
        priority: 'promotional',
        subject: headline,
        html: shell.html,
        text: shell.text,
        pushTitle: headline,
        pushBody: bodyMsg,
        actionType: 'discover',
      };
    }

    default: {
      const headline = String(payload.title || 'ZuruSasa Notification').trim();
      const bodyMsg = String(payload.message || '').trim();
      const shell = renderEmailShell({
        headline,
        subhead: 'Update from ZuruSasa',
        bodyParagraphs: [escapeHtml(bodyMsg || 'You have a new update in your ZuruSasa account.')],
        ctaLabel: 'Open ZuruSasa',
        ctaUrl: 'https://zurusasa.com',
      });
      return {
        templateKey: key,
        priority: policy.priority,
        subject: headline,
        html: shell.html,
        text: shell.text,
        pushTitle: headline,
        pushBody: bodyMsg || headline,
        actionType: String(payload.action_type || 'booking'),
      };
    }
  }
}
