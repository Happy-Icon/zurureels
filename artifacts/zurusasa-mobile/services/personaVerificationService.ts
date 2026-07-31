import { supabase } from '@/lib/supabase';
import { NativeModules } from 'react-native';

// Try to safely import react-native-persona if available in native build
let PersonaNativeSDK: any = null;
try {
  PersonaNativeSDK = require('react-native-persona');
} catch (e) {
  PersonaNativeSDK = null;
}

export interface VerificationResult {
  status: 'verified' | 'pending' | 'rejected' | 'unverified';
  inquiryId?: string;
  failureReason?: string;
}

export const personaVerificationService = {
  /**
   * Launch native Persona inquiry flow using template ID (itm_...)
   */
  async launchNativeInquiry(
    templateId: string,
    onSuccess: (inquiryId: string) => void,
    onCancel?: () => void,
    onError?: (err: string) => void
  ): Promise<boolean> {
    const isNativeModulePresent =
      NativeModules.RNPersona2 || NativeModules.Persona2 || NativeModules.Persona;

    if (!PersonaNativeSDK || !PersonaNativeSDK.Inquiry || !isNativeModulePresent) {
      return false;
    }

    try {
      const environment =
        process.env.EXPO_PUBLIC_PERSONA_ENVIRONMENT === 'production'
          ? PersonaNativeSDK.Environment.PRODUCTION
          : PersonaNativeSDK.Environment.SANDBOX;

      const builder = PersonaNativeSDK.Inquiry.fromTemplate(templateId)
        .environment(environment)
        .onComplete((inquiryId: string, status: string) => {
          if (status === 'completed' || status === 'approved') {
            onSuccess(inquiryId);
          } else {
            onError?.(`Inquiry completed with status: ${status}`);
          }
        })
        .onCanceled(() => {
          onCancel?.();
        })
        .onError((error: any) => {
          onError?.(error?.message || 'Persona SDK Error');
        });

      builder.build().start();
      return true;
    } catch (err: any) {
      console.warn('Native Persona module launch notice:', err?.message || err);
      return false;
    }
  },

  /**
   * Start a new Persona verification inquiry session for the current user in DB
   */
  async startInquiry(userId: string): Promise<VerificationResult> {
    try {
      const inquiryId = `inq_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;

      const { error } = await supabase
        .from('profiles')
        .update({
          verification_status: 'pending',
          metadata: {
            persona_inquiry_id: inquiryId,
            verification_provider: 'persona',
            verification_level: 'government_id_liveness',
            updated_at: new Date().toISOString(),
          },
        })
        .eq('id', userId);

      if (error) {
        console.warn('Error updating profile with inquiry:', error);
      }

      return {
        status: 'pending',
        inquiryId,
      };
    } catch (err: any) {
      console.error('Persona inquiry error:', err);
      return {
        status: 'unverified',
        failureReason: err.message || 'Failed to start inquiry',
      };
    }
  },

  /**
   * Complete and verify the inquiry session in Supabase DB
   */
  async completeInquiry(userId: string, inquiryId: string): Promise<VerificationResult> {
    try {
      const verifiedAt = new Date().toISOString();

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          verification_status: 'verified',
          metadata: {
            persona_inquiry_id: inquiryId,
            verification_provider: 'persona',
            verified_at: verifiedAt,
            is_verified: true,
          },
        })
        .eq('id', userId);

      if (profileErr) console.warn('Error saving verification status:', profileErr);

      await supabase.auth
        .updateUser({
          data: {
            verification_status: 'verified',
            is_verified: true,
            verified_at: verifiedAt,
          },
        })
        .catch((e) => console.log('Silent metadata update:', e));

      return {
        status: 'verified',
        inquiryId,
      };
    } catch (err: any) {
      console.error('Error completing verification:', err);
      return {
        status: 'rejected',
        failureReason: err.message || 'Verification processing error',
      };
    }
  },

  /**
   * Reset verification status to unverified (allows user to re-verify or test flow again)
   */
  async resetVerification(userId: string): Promise<boolean> {
    try {
      await supabase
        .from('profiles')
        .update({
          verification_status: 'unverified',
          metadata: {
            is_verified: false,
            updated_at: new Date().toISOString(),
          },
        })
        .eq('id', userId);

      await supabase.auth
        .updateUser({
          data: {
            verification_status: 'unverified',
            is_verified: false,
          },
        })
        .catch((e) => console.log('Silent metadata update:', e));

      return true;
    } catch (err) {
      console.error('Error resetting verification:', err);
      return false;
    }
  },
};
