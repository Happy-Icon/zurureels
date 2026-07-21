import { Platform } from 'react-native';

/**
 * Native Google Sign-In (Android): opens the system Google account picker via
 * Google Play services instead of a browser tab. The resulting ID token is
 * minted for our *web* OAuth client (`webClientId`), which is what Supabase
 * validates in `signInWithIdToken` — so the existing web client keeps working
 * for both platforms.
 *
 * Google Cloud requirements (same project as the existing web client):
 * - An **Android** OAuth client with package `com.zurureels.app` and the
 *   signing certificate's SHA-1 (see credentials/android/). Nothing from that
 *   client is embedded in the app — it just has to exist so Google can verify
 *   this APK's signature.
 * - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` set to the existing **web** client ID.
 *
 * The native module only exists in real builds (`eas build` /
 * `expo run:android`) — on web and in Expo Go callers get `unavailable` and
 * should fall back to the browser-based flow.
 */
export type NativeGoogleResult =
  | { status: 'success'; idToken: string }
  | { status: 'cancelled' }
  | { status: 'unavailable'; configError: boolean; reason: string };

export async function signInWithGoogleNatively(): Promise<NativeGoogleResult> {
  if (Platform.OS === 'web') {
    return { status: 'unavailable', configError: false, reason: 'web platform' };
  }

  let lib: typeof import('@react-native-google-signin/google-signin');
  try {
    // Lazy require: a static import would evaluate the native TurboModule at
    // startup and crash the web / Expo Go bundle where it doesn't exist.
    lib = require('@react-native-google-signin/google-signin');
  } catch {
    return {
      status: 'unavailable',
      configError: false,
      reason: 'native module not in this build',
    };
  }

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    return {
      status: 'unavailable',
      configError: true,
      reason:
        'Google Sign-In is not configured yet: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing from this build.',
    };
  }

  const { GoogleSignin, statusCodes, isSuccessResponse, isErrorWithCode } = lib;

  try {
    GoogleSignin.configure({ webClientId });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Always show the account picker — without this, a previously used
    // account is silently reused.
    await GoogleSignin.signOut().catch(() => {});

    const response = await GoogleSignin.signIn();
    if (isSuccessResponse(response)) {
      const idToken = response.data.idToken;
      if (!idToken) {
        throw new Error(
          'Google did not return an ID token. Make sure EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is the WEB client ID (not the Android one).',
        );
      }
      return { status: 'success', idToken };
    }
    // response.type === 'cancelled'
    return { status: 'cancelled' };
  } catch (e: unknown) {
    if (isErrorWithCode(e)) {
      if (
        e.code === statusCodes.SIGN_IN_CANCELLED ||
        e.code === statusCodes.IN_PROGRESS
      ) {
        return { status: 'cancelled' };
      }
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error(
          'Google Play services is unavailable or outdated on this device.',
        );
      }
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (/DEVELOPER_ERROR|\b10\b/.test(msg)) {
      // Classic signature mismatch: the APK isn't signed with a certificate
      // registered on an Android OAuth client in the Google Cloud project.
      throw new Error(
        'Google rejected this app build (DEVELOPER_ERROR). Check that the Android OAuth client uses package com.zurureels.app and the SHA-1 of the keystore that signed this APK.',
      );
    }
    throw e;
  }
}
