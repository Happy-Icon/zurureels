import { Platform } from 'react-native';
import { Passkey } from 'react-native-passkey';
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

function parsePasskeyError(err: any): {
  message: string;
  code: 'cancelled' | 'not_found' | 'unsupported' | 'invalid' | 'unknown';
  isCancelled: boolean;
} {
  const rawMsg = (
    err?.message ||
    err?.error_description ||
    err?.error ||
    err?.errorMessage ||
    String(err || '')
  ).toLowerCase();
  const name = (err?.name || err?.error || err?.code || '').toLowerCase();

  // 1. User Cancellation
  if (
    name.includes('notallowederror') ||
    name.includes('aborterror') ||
    name.includes('usercancelled') ||
    name.includes('user_cancelled') ||
    rawMsg.includes('cancelled') ||
    rawMsg.includes('canceled') ||
    rawMsg.includes('abort') ||
    rawMsg.includes('user denied') ||
    rawMsg.includes('user closed') ||
    rawMsg.includes('user_cancelled') ||
    rawMsg.includes('timed out or was not allowed') ||
    rawMsg.includes('the user cancelled the request')
  ) {
    return {
      message: 'Passkey setup was cancelled.',
      code: 'cancelled',
      isCancelled: true,
    };
  }

  // 2. Passkey Already Exists
  if (
    name.includes('credentialalreadyexists') ||
    name.includes('invalidstateerror') ||
    rawMsg.includes('already exists') ||
    rawMsg.includes('credential already exists')
  ) {
    return {
      message: 'A passkey for this account is already registered on this device.',
      code: 'invalid',
      isCancelled: false,
    };
  }

  // 3. No Create Option / Unsupported Device / No Provider / Missing native module
  if (
    name.includes('nocreateoption') ||
    name.includes('notsupported') ||
    name.includes('notsupportederror') ||
    name.includes('notconfigured') ||
    rawMsg.includes('does not support webauthn') ||
    rawMsg.includes('no credential provider') ||
    rawMsg.includes('no create option') ||
    rawMsg.includes('not supported') ||
    rawMsg.includes('not available') ||
    rawMsg.includes("doesn't seem to be linked")
  ) {
    return {
      message:
        'Passkey setup requires a screen lock (PIN, fingerprint, or Face unlock) and Google Password Manager enabled on your device.',
      code: 'unsupported',
      isCancelled: false,
    };
  }

  // 4. Passkey Not Found
  if (
    rawMsg.includes('no passkeys found') ||
    rawMsg.includes('passkey not found') ||
    rawMsg.includes('not found') ||
    rawMsg.includes('not registered') ||
    rawMsg.includes('no credentials') ||
    name.includes('nocredentials') ||
    name.includes('notfounderror')
  ) {
    return {
      message: 'Passkey not set up yet. Set up a passkey from Settings to sign in faster and securely.',
      code: 'not_found',
      isCancelled: false,
    };
  }

  // 5. Invalid Credential / Configuration / Server Error
  if (
    name.includes('badconfiguration') ||
    name.includes('requestfailed') ||
    name.includes('securityerror') ||
    rawMsg.includes('invalid') ||
    rawMsg.includes('expired') ||
    rawMsg.includes('verification failed') ||
    rawMsg.includes('challenge')
  ) {
    return {
      message: 'Could not complete passkey verification. Please ensure your device screen lock is set up and try again.',
      code: 'invalid',
      isCancelled: false,
    };
  }

  // 6. Generic Error
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
      if (typeof Passkey?.isSupported === 'function') {
        return Passkey.isSupported();
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
      // 1. Web Flow
      if (Platform.OS === 'web') {
        const { data, error } = await (supabase.auth as any).signInWithPasskey();
        if (error) {
          const parsed = parsePasskeyError(error);
          return parsed.isCancelled
            ? { success: false, cancelled: true }
            : { success: false, error: parsed.message, code: parsed.code };
        }
        return { success: true, user: data?.user, session: data?.session };
      }

      // 2. Native Mobile Flow (Android & iOS)
      console.log('[Passkey][Auth 1/4] Starting passkey authentication with Supabase...');
      const res = await (supabase.auth as any).passkey.startAuthentication();
      if (res?.error || !res?.data) {
        console.error('[Passkey][Auth 1/4] Failed to get authentication options:', res?.error);
        return {
          success: false,
          error: res?.error?.message || 'Could not connect to passkey authentication server.',
        };
      }

      const authOptions = res.data;
      const rawOptions = authOptions.options || authOptions;
      let rpId = rawOptions.rpId || rawOptions.rp?.id;
      if (rpId && typeof rpId === 'string') {
        rpId = rpId.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      }

      const nativeOptions = {
        ...rawOptions,
        ...(rpId ? { rpId } : {}),
        userVerification: 'required',
      };

      console.log('[Passkey][Auth 2/4] Calling Credential Manager getCredential...', {
        rpId,
        userVerification: nativeOptions.userVerification,
      });

      let credentialResponse: any = null;
      try {
        if (typeof Passkey.getPlatformKey === 'function') {
          credentialResponse = await Passkey.getPlatformKey(nativeOptions);
        } else if (typeof Passkey.get === 'function') {
          credentialResponse = await Passkey.get(nativeOptions);
        } else {
          throw new Error('Native passkey module is not available on this build.');
        }
      } catch (nativeErr: any) {
        console.warn('[Passkey][Auth 2/4] Native get error:', nativeErr);
        const parsed = parsePasskeyError(nativeErr);
        if (parsed.isCancelled) return { success: false, cancelled: true };
        return { success: false, error: parsed.message, code: parsed.code };
      }

      if (!credentialResponse) {
        console.error('[Passkey][Auth 3/4] No credential returned from device.');
        return { success: false, error: 'No credential returned from device.' };
      }

      const parsedCredential =
        typeof credentialResponse === 'string'
          ? JSON.parse(credentialResponse)
          : credentialResponse;

      console.log('[Passkey][Auth 3/4] Received native credential assertion:', {
        id: parsedCredential?.id,
        type: parsedCredential?.type,
      });

      // 3. Verify signed credential with Supabase server
      const challengeId = authOptions.challenge_id || authOptions.challengeId || authOptions.id;
      console.log('[Passkey][Auth 4/4] Verifying authentication with Supabase...', { challengeId });
      const { data: verifyData, error: verifyError } = await (supabase.auth as any).passkey.verifyAuthentication({
        challengeId,
        credential: parsedCredential,
      });

      if (verifyError || !verifyData?.session) {
        console.error('[Passkey][Auth 4/4] Supabase verifyAuthentication failed:', verifyError);
        return { success: false, error: verifyError?.message || 'Passkey verification failed on server.' };
      }

      // 4. Establish Supabase session
      await supabase.auth.setSession(verifyData.session);
      console.log('[Passkey][Auth 4/4] Session established for user:', verifyData.user?.id);

      return {
        success: true,
        user: verifyData.user,
        session: verifyData.session,
      };
    } catch (err: any) {
      console.error('[Passkey][Auth Error]:', err);
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

      // 1. Web Flow
      if (Platform.OS === 'web') {
        const { data, error } = await (supabase.auth as any).registerPasskey();
        if (error) {
          const parsed = parsePasskeyError(error);
          return parsed.isCancelled ? { success: false, cancelled: true } : { success: false, error: parsed.message };
        }
        return { success: true, credential: data };
      }

      // 2. Native Mobile Flow (Android & iOS)
      console.log('[Passkey][1/5] Requesting registration challenge from Supabase for user:', userData.user.id);
      const res = await (supabase.auth as any).passkey.startRegistration();
      if (res?.error || !res?.data) {
        console.error('[Passkey][1/5] startRegistration error from Supabase:', res?.error);
        return {
          success: false,
          error: res?.error?.message || 'Could not connect to passkey registration server.',
        };
      }

      const regOptions = res.data;
      const baseOptions = regOptions.options || regOptions;
      const challengeId = regOptions.challenge_id || regOptions.challengeId || regOptions.id;

      if (!challengeId) {
        console.error('[Passkey][1/5] Missing challengeId in Supabase response:', regOptions);
        return { success: false, error: 'Missing challenge ID from registration server.' };
      }

      console.log('[Passkey][1/5] Supabase challenge response received:', {
        challengeId,
        hasOptions: !!(regOptions?.options || regOptions),
      });

      let credentialResponse: any = null;

      // 3. ENFORCE PLATFORM/DEVICE AUTHENTICATOR (THIS PHONE)
      let rpId = baseOptions.rp?.id || baseOptions.rpId;
      if (rpId && typeof rpId === 'string') {
        rpId = rpId.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      }

      const baseUser = baseOptions.user || {};
      const platformDeviceOptions = {
        ...baseOptions,
        rp: {
          name: baseOptions.rp?.name || 'ZuruSasa',
          ...(baseOptions.rp?.id ? { id: baseOptions.rp.id } : rpId ? { id: rpId } : {}),
        },
        user: {
          id: baseUser.id || userData.user.id,
          name: baseUser.name || userData.user.email || 'user',
          displayName:
            baseUser.displayName ||
            userData.user.user_metadata?.full_name ||
            userData.user.email ||
            'User',
        },
        pubKeyCredParams:
          Array.isArray(baseOptions.pubKeyCredParams) && baseOptions.pubKeyCredParams.length > 0
            ? baseOptions.pubKeyCredParams
            : [
                { type: 'public-key', alg: -7 }, // ES256 (ECDSA with SHA-256)
                { type: 'public-key', alg: -257 }, // RS256 (RSA with SHA-256)
              ],
        authenticatorSelection: {
          ...(baseOptions.authenticatorSelection || {}),
          authenticatorAttachment: 'platform', // Forces Google Password Manager / Biometrics ON THIS DEVICE
          residentKey: 'required', // Stored discoverable credential on device
          requireResidentKey: true,
          userVerification: 'required', // Triggers Fingerprint / Face unlock / Device PIN
        },
        attestation: baseOptions.attestation || 'none',
        timeout: baseOptions.timeout || 60000,
        excludeCredentials: baseOptions.excludeCredentials || [],
      };

      console.log('[Passkey][2/5] Triggering Android Credential Manager createCredential...', {
        rp: platformDeviceOptions.rp,
        user: { name: platformDeviceOptions.user.name, hasId: !!platformDeviceOptions.user.id },
        authenticatorSelection: platformDeviceOptions.authenticatorSelection,
      });

      try {
        if (typeof Passkey.createPlatformKey === 'function') {
          credentialResponse = await Passkey.createPlatformKey(platformDeviceOptions);
        } else if (typeof Passkey.create === 'function') {
          credentialResponse = await Passkey.create(platformDeviceOptions);
        } else {
          throw new Error('Native passkey module is not available on this build.');
        }
      } catch (nativeErr: any) {
        console.warn('[Passkey][2/5] Native create error:', nativeErr);
        const parsed = parsePasskeyError(nativeErr);
        if (parsed.isCancelled) return { success: false, cancelled: true };
        return { success: false, error: parsed.message };
      }

      if (!credentialResponse) {
        console.error('[Passkey][3/5] Passkey creation returned empty response from device.');
        return { success: false, error: 'Passkey creation was not completed on device.' };
      }

      const parsedCredential =
        typeof credentialResponse === 'string'
          ? JSON.parse(credentialResponse)
          : credentialResponse;

      console.log('[Passkey][3/5] Received native credential response from Android:', {
        id: parsedCredential?.id,
        type: parsedCredential?.type,
        hasResponse: !!parsedCredential?.response,
        hasAttestation: !!parsedCredential?.response?.attestationObject,
        hasClientData: !!parsedCredential?.response?.clientDataJSON,
      });

      // 4. Verify and persist new credential on Supabase server
      console.log('[Passkey][4/5] Verifying passkey registration with Supabase...', { challengeId });
      const { data: verifyData, error: verifyError } = await (supabase.auth as any).passkey.verifyRegistration({
        challengeId,
        credential: parsedCredential,
      });

      if (verifyError) {
        console.error('[Passkey][4/5] Supabase verifyRegistration error:', verifyError);
        return { success: false, error: verifyError.message || 'Passkey verification failed on server.' };
      }

      console.log('[Passkey][5/5] Passkey successfully registered and stored on Supabase:', verifyData);
      return { success: true, credential: verifyData };
    } catch (err: any) {
      console.error('[Passkey][Registration Error]:', err);
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