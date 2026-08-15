import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

let NativePasskey: any = null;
if (Platform.OS !== 'web') {
  try {
    const mod = require('react-native-passkey');
    NativePasskey = mod.Passkey || mod.default || mod;
  } catch (e) {
    console.warn('[Passkey] react-native-passkey load note:', e);
  }
}

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
    rawMsg.includes('user_cancelled') ||
    rawMsg.includes('timed out or was not allowed')
  ) {
    return {
      message: 'Passkey setup was cancelled.',
      code: 'cancelled',
      isCancelled: true,
    };
  }

  // 2. Unsupported Device
  if (
    rawMsg.includes('does not support webauthn') ||
    rawMsg.includes('notsupportederror') ||
    rawMsg.includes('unsupported') ||
    rawMsg.includes('not available')
  ) {
    return {
      message: 'Passkey authentication is not supported on this device. Please sign in with Google or Email.',
      code: 'unsupported',
      isCancelled: false,
    };
  }

  // 3. Passkey Not Found
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

  // 4. Invalid Credential
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
    message: err?.message || 'Failed to complete passkey setup. Please try again.',
    code: 'unknown',
    isCancelled: false,
  };
}

export const passkeyService = {
  /**
   * Checks whether passkeys are supported on the platform
   */
  async isSupported(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return (
        typeof window !== 'undefined' &&
        typeof window.navigator !== 'undefined' &&
        typeof window.navigator.credentials !== 'undefined' &&
        typeof window.navigator.credentials.get === 'function'
      );
    }
    try {
      if (NativePasskey?.isSupported) {
        return await NativePasskey.isSupported();
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Native Sign-In using Android Credential Manager on THIS DEVICE
   */
  async signIn(): Promise<PasskeyAuthResult> {
    try {
      // 1. Get authentication challenge options from Supabase
      let authOptions: any = null;
      try {
        if ((supabase.auth as any).passkey?.startAuthentication) {
          const res = await (supabase.auth as any).passkey.startAuthentication();
          if (res?.data) authOptions = res.data;
          else if (res?.error) throw res.error;
        }
      } catch (optErr) {
        console.warn('[Passkey] startAuthentication error:', optErr);
      }

      if (!authOptions && Platform.OS === 'web') {
        const { data, error } = await (supabase.auth as any).signInWithPasskey();
        if (error) {
          const parsed = parsePasskeyError(error);
          return parsed.isCancelled ? { success: false, cancelled: true } : { success: false, error: parsed.message, code: parsed.code };
        }
        return { success: true, user: data?.user, session: data?.session };
      }

      if (!authOptions) {
        return { success: false, error: 'Could not connect to passkey authentication server.' };
      }

      let credentialResponse: any = null;

      // 2. Enforce on-device verification
      const rawOptions = authOptions.options || authOptions;
      const nativeOptions = {
        ...rawOptions,
        userVerification: 'required',
      };

      if (Platform.OS === 'web') {
        const { data, error } = await (supabase.auth as any).signInWithPasskey();
        if (error) throw error;
        return { success: true, user: data?.user, session: data?.session };
      } else if (NativePasskey?.get) {
        try {
          credentialResponse = await NativePasskey.get(nativeOptions);
        } catch (nativeErr: any) {
          const parsed = parsePasskeyError(nativeErr);
          if (parsed.isCancelled) return { success: false, cancelled: true };
          return { success: false, error: parsed.message, code: parsed.code };
        }
      } else {
        const { data, error } = await (supabase.auth as any).signInWithPasskey();
        if (error) {
          const parsed = parsePasskeyError(error);
          return parsed.isCancelled ? { success: false, cancelled: true } : { success: false, error: parsed.message, code: parsed.code };
        }
        return { success: true, user: data?.user, session: data?.session };
      }

      if (!credentialResponse) {
        return { success: false, error: 'No credential returned from device.' };
      }

      // 3. Verify signed credential with Supabase server
      const { data: verifyData, error: verifyError } = await (supabase.auth as any).passkey.verifyAuthentication({
        challengeId: authOptions.challenge_id,
        credential: credentialResponse,
      });

      if (verifyError || !verifyData?.session) {
        return { success: false, error: verifyError?.message || 'Passkey verification failed on server.' };
      }

      // 4. Establish Supabase session
      await supabase.auth.setSession(verifyData.session);

      return {
        success: true,
        user: verifyData.user,
        session: verifyData.session,
      };
    } catch (err: any) {
      const parsed = parsePasskeyError(err);
      if (parsed.isCancelled) {
        return { success: false, cancelled: true };
      }
      return {
        success: false,
        error: parsed.message,
        code: parsed.code,
      };
    }
  },

  /**
   * Native Passkey Registration — Enforcing THIS PHONE (Platform Authenticator)
   */
  async register(friendlyName?: string): Promise<PasskeyRegisterResult> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        return { success: false, error: 'You must be logged in to register a passkey.' };
      }

      // 1. Get creation challenge options from Supabase
      let regOptions: any = null;
      try {
        if ((supabase.auth as any).passkey?.startRegistration) {
          const res = await (supabase.auth as any).passkey.startRegistration();
          if (res?.data) regOptions = res.data;
          else if (res?.error) throw res.error;
        }
      } catch (optErr) {
        console.warn('[Passkey] startRegistration error:', optErr);
      }

      if (!regOptions && Platform.OS === 'web') {
        const { data, error } = await (supabase.auth as any).registerPasskey();
        if (error) {
          const parsed = parsePasskeyError(error);
          return parsed.isCancelled ? { success: false, cancelled: true } : { success: false, error: parsed.message };
        }
        return { success: true, credential: data };
      }

      if (!regOptions) {
        return { success: false, error: 'Could not connect to passkey registration server.' };
      }

      let credentialResponse: any = null;

      // 2. ENFORCE PLATFORM/DEVICE AUTHENTICATOR (THIS PHONE)
      const baseOptions = regOptions.options || regOptions;
      const platformDeviceOptions = {
        ...baseOptions,
        authenticatorSelection: {
          ...(baseOptions.authenticatorSelection || {}),
          authenticatorAttachment: 'platform', // Forces Google Password Manager / Biometrics ON THIS DEVICE
          residentKey: 'required',             // Stored discoverable credential on device
          requireResidentKey: true,
          userVerification: 'required',        // Triggers Fingerprint / Face unlock / Device PIN
        },
      };

      if (Platform.OS === 'web') {
        const { data, error } = await (supabase.auth as any).registerPasskey();
        if (error) throw error;
        return { success: true, credential: data };
      } else if (NativePasskey?.create) {
        try {
          credentialResponse = await NativePasskey.create(platformDeviceOptions);
        } catch (nativeErr: any) {
          const parsed = parsePasskeyError(nativeErr);
          if (parsed.isCancelled) return { success: false, cancelled: true };
          return { success: false, error: parsed.message };
        }
      } else {
        const { data, error } = await (supabase.auth as any).registerPasskey();
        if (error) {
          const parsed = parsePasskeyError(error);
          return parsed.isCancelled ? { success: false, cancelled: true } : { success: false, error: parsed.message };
        }
        return { success: true, credential: data };
      }

      if (!credentialResponse) {
        return { success: false, error: 'Passkey creation was not completed on device.' };
      }

      // 3. Verify and persist new credential on Supabase server
      const { data: verifyData, error: verifyError } = await (supabase.auth as any).passkey.verifyRegistration({
        challengeId: regOptions.challenge_id,
        credential: credentialResponse,
      });

      if (verifyError) {
        return { success: false, error: verifyError.message };
      }

      return { success: true, credential: verifyData };
    } catch (err: any) {
      const parsed = parsePasskeyError(err);
      if (parsed.isCancelled) {
        return { success: false, cancelled: true };
      }
      return { success: false, error: parsed.message };
    }
  },

  /**
   * Queries registered passkeys on Supabase server
   */
  async listPasskeys(): Promise<{ passkeys: PasskeyCredential[]; hasPasskey: boolean }> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return { passkeys: [], hasPasskey: false };

      if ((supabase.auth as any).passkey?.list) {
        const { data, error } = await (supabase.auth as any).passkey.list();
        if (!error && Array.isArray(data)) {
          if (data.length > 0) {
            return {
              passkeys: data.map((d: any) => ({
                id: d.id,
                name: d.friendly_name || d.name || 'Device Passkey',
                created_at: d.created_at,
                last_used_at: d.last_used_at,
              })),
              hasPasskey: true,
            };
          } else {
            return { passkeys: [], hasPasskey: false };
          }
        }
      }

      return { passkeys: [], hasPasskey: false };
    } catch {
      return { passkeys: [], hasPasskey: false };
    }
  },

  /**
   * Removes a passkey credential from Supabase server
   */
  async removePasskey(passkeyId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return { success: false, error: 'Not authenticated' };

      if ((supabase.auth as any).passkey?.delete) {
        const { data: serverPasskeys } = await (supabase.auth as any).passkey.list();
        if (Array.isArray(serverPasskeys) && serverPasskeys.length > 0) {
          for (const p of serverPasskeys) {
            const targetId = p.id || p.credential_id;
            if (targetId && (targetId === passkeyId || !passkeyId)) {
              await (supabase.auth as any).passkey.delete({ passkeyId: targetId });
            }
          }
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to remove passkey.' };
    }
  },
};