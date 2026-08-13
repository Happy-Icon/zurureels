import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export interface PasskeyCredential {
  id: string;
  name?: string;
  created_at?: string;
  last_used_at?: string;
}

export interface PasskeyAuthResult {
  success: boolean;
  cancelled?: boolean;
  user?: any;
  session?: any;
  error?: string;
  code?: 'cancelled' | 'not_found' | 'unsupported' | 'invalid' | 'unknown';
}

export interface PasskeyRegisterResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  credential?: any;
}

/**
 * Normalizes and categorizes passkey/WebAuthn error messages into user-friendly strings
 */
function parsePasskeyError(err: any): { message: string; code: 'cancelled' | 'not_found' | 'unsupported' | 'invalid' | 'unknown'; isCancelled: boolean } {
  const rawMsg = (err?.message || err?.error_description || String(err || '')).toLowerCase();
  const name = (err?.name || '').toLowerCase();

  // 1. User Cancellation
  if (
    name.includes('notallowederror') ||
    name.includes('aborterror') ||
    rawMsg.includes('cancelled') ||
    rawMsg.includes('canceled') ||
    rawMsg.includes('abort') ||
    rawMsg.includes('user denied') ||
    rawMsg.includes('user closed') ||
    rawMsg.includes('timed out or was not allowed')
  ) {
    return {
      message: 'Passkey sign-in was cancelled.',
      code: 'cancelled',
      isCancelled: true,
    };
  }

  // 2. Unsupported Device / Browser
  if (
    rawMsg.includes('does not support webauthn') ||
    rawMsg.includes('notsupportederror') ||
    rawMsg.includes('unsupported') ||
    rawMsg.includes('not available')
  ) {
    return {
      message: 'Passkey authentication is not supported on this device or browser. Please sign in with Email or Google.',
      code: 'unsupported',
      isCancelled: false,
    };
  }

  // 3. Passkey Not Found / Not Registered
  if (
    rawMsg.includes('no passkeys found') ||
    rawMsg.includes('passkey not found') ||
    rawMsg.includes('not found') ||
    rawMsg.includes('not registered') ||
    rawMsg.includes('no credentials') ||
    name.includes('notfounderror')
  ) {
    return {
      message: 'Passkey not set up yet. Set up a passkey from Settings to sign in faster and securely.',
      code: 'not_found',
      isCancelled: false,
    };
  }

  // 4. Invalid / Expired Credential
  if (
    rawMsg.includes('invalid') ||
    rawMsg.includes('expired') ||
    rawMsg.includes('verification failed') ||
    rawMsg.includes('challenge')
  ) {
    return {
      message: 'Your passkey could not be verified. Please try again or use another login method.',
      code: 'invalid',
      isCancelled: false,
    };
  }

  // 5. Generic Error
  return {
    message: err?.message || 'Failed to authenticate with passkey. Please try again.',
    code: 'unknown',
    isCancelled: false,
  };
}

export const passkeyService = {
  /**
   * Checks whether passkeys/WebAuthn are supported in the current environment
   */
  isSupported(): boolean {
    if (Platform.OS === 'web') {
      return (
        typeof window !== 'undefined' &&
        typeof window.navigator !== 'undefined' &&
        typeof window.navigator.credentials !== 'undefined' &&
        typeof window.navigator.credentials.get === 'function'
      );
    }
    // On native platforms (Android / iOS), return true if browser or platform authenticator is supported
    return true;
  },

  /**
   * Signs in a user using their registered passkey via Supabase Auth
   */
  async signIn(): Promise<PasskeyAuthResult> {
    try {
      // 1. Invoke Supabase experimental Passkey signIn
      const { data, error } = await (supabase.auth as any).signInWithPasskey();

      if (error) {
        const parsed = parsePasskeyError(error);
        if (parsed.isCancelled) {
          return { success: false, cancelled: true, code: 'cancelled' };
        }
        return {
          success: false,
          error: parsed.message,
          code: parsed.code,
        };
      }

      if (data?.session && data?.user) {
        return {
          success: true,
          user: data.user,
          session: data.session,
        };
      }

      // If no session directly returned, verify current Supabase session
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        return {
          success: true,
          user: sessionData.session.user,
          session: sessionData.session,
        };
      }

      return {
        success: false,
        error: 'Passkey verification was completed, but no active session was established.',
        code: 'unknown',
      };
    } catch (err: any) {
      const parsed = parsePasskeyError(err);
      if (parsed.isCancelled) {
        return { success: false, cancelled: true, code: 'cancelled' };
      }
      return {
        success: false,
        error: parsed.message,
        code: parsed.code,
      };
    }
  },

  /**
   * Registers a new passkey for the currently authenticated user
   */
  async register(friendlyName?: string): Promise<PasskeyRegisterResult> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        return {
          success: false,
          error: 'You must be logged in to register a passkey.',
        };
      }

      // 1. Trigger Supabase WebAuthn passkey registration ceremony
      const { data, error } = await (supabase.auth as any).registerPasskey();

      if (error) {
        const parsed = parsePasskeyError(error);
        if (parsed.isCancelled) {
          return { success: false, cancelled: true };
        }
        return { success: false, error: parsed.message };
      }

      // 2. Persist passkey_enabled flag in profile security settings
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('security_settings')
          .eq('id', userData.user.id)
          .maybeSingle();

        const currentSec = (profile?.security_settings ?? {}) as Record<string, unknown>;
        await supabase
          .from('profiles')
          .update({
            security_settings: {
              ...currentSec,
              passkey_enabled: true,
              passkey_registered_at: new Date().toISOString(),
              passkey_name: friendlyName || `${Platform.OS === 'ios' ? 'Apple' : Platform.OS === 'android' ? 'Android' : 'Web'} Passkey`,
            },
          } as any)
          .eq('id', userData.user.id);
      } catch (saveErr) {
        console.warn('[Passkey] Note updating profile security settings:', saveErr);
      }

      return { success: true, credential: data };
    } catch (err: any) {
      const parsed = parsePasskeyError(err);
      if (parsed.isCancelled) {
        return { success: false, cancelled: true };
      }
      return { success: false, error: parsed.message };
    }
  },

  /**
   * Lists registered passkey credentials for the current user
   */
  async listPasskeys(): Promise<{ passkeys: PasskeyCredential[]; hasPasskey: boolean }> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return { passkeys: [], hasPasskey: false };

      // 1. Try listing from Supabase passkey API if supported
      try {
        if ((supabase.auth as any).passkey?.list) {
          const { data, error } = await (supabase.auth as any).passkey.list();
          if (!error && Array.isArray(data) && data.length > 0) {
            return {
              passkeys: data.map((d: any) => ({
                id: d.id,
                name: d.friendly_name || d.name || 'Device Passkey',
                created_at: d.created_at,
                last_used_at: d.last_used_at,
              })),
              hasPasskey: true,
            };
          }
        }
      } catch (listErr) {
        console.warn('[Passkey] passkey.list API note:', listErr);
      }

      // 2. Check profile security_settings fallback
      const { data: profile } = await supabase
        .from('profiles')
        .select('security_settings')
        .eq('id', userData.user.id)
        .maybeSingle();

      const sec = (profile?.security_settings ?? {}) as Record<string, unknown>;
      const isEnabled = sec?.passkey_enabled === true;

      if (isEnabled) {
        return {
          passkeys: [
            {
              id: 'primary-passkey',
              name: (sec?.passkey_name as string) || `${Platform.OS === 'ios' ? 'iCloud Keychain' : Platform.OS === 'android' ? 'Google Password Manager' : 'Browser'} Passkey`,
              created_at: sec?.passkey_registered_at as string,
            },
          ],
          hasPasskey: true,
        };
      }

      return { passkeys: [], hasPasskey: false };
    } catch (err) {
      console.warn('[Passkey] Error checking passkeys:', err);
      return { passkeys: [], hasPasskey: false };
    }
  },

  /**
   * Deletes / removes a registered passkey credential
   */
  async removePasskey(passkeyId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return { success: false, error: 'Not authenticated' };

      // 1. Delete from Supabase passkey API if real ID is available
      if (passkeyId && passkeyId !== 'primary-passkey') {
        try {
          if ((supabase.auth as any).passkey?.delete) {
            await (supabase.auth as any).passkey.delete(passkeyId);
          }
        } catch (delErr) {
          console.warn('[Passkey] passkey.delete note:', delErr);
        }
      }

      // 2. Clear security settings flag in profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('security_settings')
        .eq('id', userData.user.id)
        .maybeSingle();

      const currentSec = (profile?.security_settings ?? {}) as Record<string, unknown>;
      await supabase
        .from('profiles')
        .update({
          security_settings: {
            ...currentSec,
            passkey_enabled: false,
            passkey_registered_at: null,
            passkey_name: null,
          },
        } as any)
        .eq('id', userData.user.id);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to remove passkey' };
    }
  },
};
