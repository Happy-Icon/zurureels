import { NativeModules, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Safely import Persona SDK v2
let PersonaSDK: typeof import('react-native-persona') | null = null;
try {
  PersonaSDK = require('react-native-persona');
} catch (err) {
  console.warn('Could not load react-native-persona module:', err);
  PersonaSDK = null;
}

export interface VerificationLaunchOptions {
  userId: string;
  templateId?: string;
  onSuccess: (result: { inquiryId: string; status: string; isVerified: boolean }) => void;
  onCanceled?: () => void;
  onError?: (errorMessage: string) => void;
}

export interface VerificationStatusResult {
  status: 'verified' | 'pending' | 'failed' | 'canceled' | 'unverified';
  inquiryId?: string;
  isVerified: boolean;
  verifiedAt?: string;
  failureReason?: string;
}

export const personaVerificationService = {
  /**
   * Check if Persona native module is available in the current environment
   */
  isPersonaAvailable(): boolean {
    if (Platform.OS === 'web') return false;
    const hasNativeBridge = Boolean(
      NativeModules.PersonaInquiry2 ||
      NativeModules.PersonaInquiry ||
      NativeModules.RNPersona2 ||
      NativeModules.Persona2 ||
      NativeModules.Persona ||
      Boolean(PersonaSDK?.Inquiry)
    );
    return Boolean(PersonaSDK?.Inquiry && hasNativeBridge);
  },

  /**
   * Launch the real native Persona identity verification inquiry flow
   */
  async launchVerification({
    userId,
    templateId: customTemplateId,
    onSuccess,
    onCanceled,
    onError,
  }: VerificationLaunchOptions): Promise<void> {
    if (!userId) {
      onError?.('User ID is required to start identity verification.');
      return;
    }

    const isAvailable = this.isPersonaAvailable();
    if (!isAvailable || !PersonaSDK?.Inquiry) {
      const err =
        Platform.OS === 'web'
          ? 'Persona Identity Verification is available on iOS and Android mobile devices.'
          : 'Persona native identity verification module is not linked in this build. Please run with an Expo development build.';
      console.error(err);
      onError?.(err);
      return;
    }

    try {
      // 1. Initiate verification session via Supabase Edge Function
      let serverInquiryId: string | null = null;
      let sessionToken: string | null = null;
      let templateId = (
        customTemplateId ||
        process.env.EXPO_PUBLIC_PERSONA_TEMPLATE_ID ||
        ''
      ).trim();

      const envString = (process.env.EXPO_PUBLIC_PERSONA_ENVIRONMENT || 'sandbox').toLowerCase().trim();
      let environment =
        envString === 'production'
          ? PersonaSDK.Environment.PRODUCTION
          : PersonaSDK.Environment.SANDBOX;

      try {
        const { data, error } = await supabase.functions.invoke('create-persona-inquiry', {
          body: { userId },
        });

        if (!error && data) {
          if (data.inquiryId) serverInquiryId = data.inquiryId;
          if (data.sessionToken) sessionToken = data.sessionToken;
          if (data.templateId) templateId = data.templateId;
          if (data.environment === 'production') {
            environment = PersonaSDK.Environment.PRODUCTION;
          }
        }
      } catch (fnErr) {
        console.warn('Notice from create-persona-inquiry function:', fnErr);
      }

      // 2. Build Persona Inquiry using SDK v2
      let inquiryBuilder: any = null;

      if (serverInquiryId && sessionToken && serverInquiryId.startsWith('inq_')) {
        inquiryBuilder = PersonaSDK.Inquiry.fromInquiry(serverInquiryId)
          .sessionToken(sessionToken);
      } else {
        if (!templateId || !templateId.startsWith('itmpl_')) {
          const cfgErr = 'Identity verification template is not configured.';
          console.error('[Persona]', cfgErr);
          onError?.(cfgErr);
          return;
        }
        inquiryBuilder = PersonaSDK.Inquiry.fromTemplate(templateId)
          .environment(environment)
          .referenceId(userId);
      }

      // 3. Attach Persona callbacks (fail-closed server verification)
      inquiryBuilder
        .onComplete(async (inquiryId: string, status: string, fields: any) => {
          try {
            // Record pending state immediately while server verifies against Persona REST API
            try {
              await supabase.rpc('submit_persona_inquiry_result', {
                p_inquiry_id: inquiryId,
                p_status: 'pending',
                p_fields: fields || {},
              });
            } catch {
              // Non-fatal: verify-persona-inquiry updates profile directly via service_role
            }

            const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
              'verify-persona-inquiry',
              {
                body: { inquiryId, status, fields },
              },
            );

            if (verifyErr || !verifyData?.success) {
              const errMsg =
                verifyData?.error ||
                verifyErr?.message ||
                'Could not confirm identity verification with server. Your submission is queued for webhook review.';
              onError?.(errMsg);
              return;
            }

            const serverStatus = String(verifyData.verificationStatus || 'pending').toLowerCase();
            const serverVerified = Boolean(verifyData.isVerified);

            if (serverVerified) {
              onSuccess({
                inquiryId,
                status: serverStatus,
                isVerified: true,
              });
            } else if (serverStatus === 'failed' || serverStatus === 'declined') {
              onError?.(
                `Identity verification was not approved (Status: ${serverStatus}). Please try again.`,
              );
            } else {
              onError?.(`Identity verification is under review (Status: ${serverStatus}).`);
            }
          } catch (err: any) {
            console.error('Error processing Persona completion:', err);
            onError?.(err?.message || 'Failed to finalize verification result.');
          }
        })
        .onCanceled((_inquiryId?: string) => {
          void supabase
            .from('profiles')
            .update({
              verification_status: 'canceled',
              verification_updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          onCanceled?.();
        })
        .onError((error: any) => {
          const message = error?.message || 'An error occurred during identity verification.';
          console.error('Persona SDK runtime error:', error);
          onError?.(message);
        });

      // 4. Start the native Inquiry flow
      const inquiry = inquiryBuilder.build();
      inquiry.start();
    } catch (launchErr: any) {
      console.error('Failed to initialize Persona Inquiry flow:', launchErr);
      onError?.(launchErr?.message || 'Could not start identity verification.');
    }
  },

  /**
   * Reset verification status to unverified in database for testing/re-entry
   */
  async resetVerification(userId: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('profiles')
        .update({
          verification_status: 'unverified',
          identity_verification_status: 'Not started',
          is_verified: false,
          verified_at: null,
          verification_updated_at: now,
          persona_inquiry_id: null,
          verification_details: {},
        })
        .eq('id', userId);

      if (error) {
        console.error('Error resetting verification in profiles:', error);
        return false;
      }

      await supabase.auth
        .updateUser({
          data: {
            verification_status: 'unverified',
            is_verified: false,
            verified_at: null,
          },
        })
        .catch(() => {});

      return true;
    } catch (err) {
      console.error('Error resetting verification:', err);
      return false;
    }
  },
};
