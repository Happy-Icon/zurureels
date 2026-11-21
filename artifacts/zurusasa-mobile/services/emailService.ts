import { supabase } from '@/lib/supabase';

export type ServerEmailTemplateKey =
  | 'host_application'
  | 'host_welcome'
  | 'booking_confirmed'
  | 'booking_declined'
  | 'booking_cancelled_guest';

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

export interface DispatchTemplateEmailParams {
  templateKey: ServerEmailTemplateKey;
  recipientUserId?: string;
  bookingId?: string;
  data?: Record<string, unknown>;
}

export interface SendEmailResult {
  success: boolean;
  provider: string;
  messageId?: string;
  skipped?: boolean;
  error?: string;
}

export const emailService = {
  /**
   * Dispatches a server-rendered transactional email strictly via the authenticated
   * 'send-email' Supabase Edge Function (zero raw HTML from client).
   */
  async dispatchTemplateEmail(params: DispatchTemplateEmailParams): Promise<SendEmailResult> {
    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke('send-email', {
        body: {
          templateKey: params.templateKey,
          recipientUserId: params.recipientUserId,
          bookingId: params.bookingId,
          data: params.data ?? {},
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

  async sendHostWelcomeEmail(hostName?: string): Promise<SendEmailResult> {
    return this.dispatchTemplateEmail({
      templateKey: 'host_application',
      data: { name: hostName },
    });
  },

  async sendBookingConfirmedEmail(params: BookingEmailParams): Promise<SendEmailResult> {
    return this.dispatchTemplateEmail({
      templateKey: 'booking_confirmed',
      recipientUserId: params.userId,
      bookingId: params.bookingId,
      data: {
        booking_id: params.bookingId,
        trip_title: params.tripTitle,
        amount: params.amount,
        check_in: params.startDate,
        check_out: params.endDate,
      },
    });
  },

  async sendBookingCancelledEmail(params: BookingEmailParams): Promise<SendEmailResult> {
    return this.dispatchTemplateEmail({
      templateKey: 'booking_declined',
      recipientUserId: params.userId,
      bookingId: params.bookingId,
      data: {
        booking_id: params.bookingId,
        trip_title: params.tripTitle,
        reason: params.reason,
      },
    });
  },
};
