import { supabase, PersonalDataRequestRow, PersonalDataExportFormat } from '@/lib/supabase';

export interface InitiateDataRequestResult {
  success: boolean;
  request_id?: string;
  status?: string;
  recipient_email?: string | null;
  expires_in_seconds?: number;
  error?: string;
}

export interface VerifyDataRequestResult {
  success: boolean;
  request_id?: string;
  status?: string;
  message?: string;
  error?: string;
  remaining_attempts?: number;
}

export interface DownloadUrlsResult {
  success: boolean;
  json_url?: string | null;
  pdf_url?: string | null;
  expires_at?: string | null;
  checksum_sha256?: string | null;
  file_size_bytes?: number | null;
  error?: string;
}

export const dataRequestService = {
  /**
   * Fetch the most recent or active personal data request for the authenticated user.
   */
  async getActiveDataRequest(userId: string): Promise<PersonalDataRequestRow | null> {
    try {
      const { data, error } = await supabase
        .from('personal_data_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[dataRequestService] getActiveDataRequest error:', error.message);
        return null;
      }
      return data as PersonalDataRequestRow | null;
    } catch (e) {
      console.warn('[dataRequestService] getActiveDataRequest exception:', e);
      return null;
    }
  },

  /**
   * Initiate a new personal data access request and send a 6-digit OTP to the user's verified email.
   */
  async initiateDataRequest(format: PersonalDataExportFormat = 'both'): Promise<InitiateDataRequestResult> {
    try {
      const { data, error } = await supabase.functions.invoke('request-personal-data', {
        body: { action: 'initiate', format },
      });

      if (error) {
        return { success: false, error: error.message || 'Failed to initiate request' };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      return {
        success: true,
        request_id: data?.request_id,
        status: data?.status,
        recipient_email: data?.recipient_email,
        expires_in_seconds: data?.expires_in_seconds,
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error occurred' };
    }
  },

  /**
   * Verify the 6-digit OTP code to authorize data compilation.
   */
  async verifyDataRequestOtp(requestId: string, otp: string): Promise<VerifyDataRequestResult> {
    try {
      const { data, error } = await supabase.functions.invoke('request-personal-data', {
        body: { action: 'verify', request_id: requestId, otp: otp.trim() },
      });

      if (error) {
        return { success: false, error: error.message || 'Verification failed' };
      }

      if (data?.error) {
        return {
          success: false,
          error: data.error,
          remaining_attempts: data.remaining_attempts,
        };
      }

      return {
        success: true,
        request_id: data?.request_id,
        status: data?.status,
        message: data?.message,
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error occurred' };
    }
  },

  /**
   * Generate secure 24-hour expiring signed download URLs for a completed export.
   */
  async getDownloadSignedUrls(requestId: string): Promise<DownloadUrlsResult> {
    try {
      const { data, error } = await supabase.functions.invoke('request-personal-data', {
        body: { action: 'get-signed-url', request_id: requestId },
      });

      if (error) {
        return { success: false, error: error.message || 'Failed to generate download URL' };
      }

      if (data?.error) {
        return { success: false, error: data.error };
      }

      return {
        success: true,
        json_url: data?.json_url,
        pdf_url: data?.pdf_url,
        expires_at: data?.expires_at,
        checksum_sha256: data?.checksum_sha256,
        file_size_bytes: data?.file_size_bytes,
      };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error occurred' };
    }
  },

  /**
   * Cancel an active or pending request.
   */
  async cancelDataRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('cancel_personal_data_request', {
        p_request_id: requestId,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error occurred' };
    }
  },
};
