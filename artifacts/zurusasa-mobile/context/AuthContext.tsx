import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type ProfileRow } from '@/lib/supabase';

import { queryClient } from '@/lib/queryClient';
import { realtimeManager } from '@/lib/realtimeManager';
import { invalidateServerCache } from '@/lib/redis';
import { notificationService } from '@/services/notificationService';
import { extractAvatarFromUser } from '@/lib/avatar';

const VIEW_MODE_STORAGE_KEY = 'viewMode';
const CACHED_PROFILE_STORAGE_KEY = '@zurusasa_cached_profile_v1';

interface CachedProfileSnapshot {
  userId: string;
  profile: ProfileRow;
  hasListings: boolean;
}

interface PreloadedAuthState {
  session: Session | null;
  profile: ProfileRow | null;
  hasListings: boolean;
  viewMode: 'guest' | 'host';
}

function getSupabaseAuthStorageKey(): string | null {
  try {
    const authClient = supabase.auth as unknown as { storageKey?: string };
    if (typeof authClient?.storageKey === 'string' && authClient.storageKey.length > 0) {
      return authClient.storageKey;
    }
  } catch {}
  return null;
}

function parseCachedSupabaseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const candidate = parsed?.currentSession ?? parsed;
    if (
      candidate &&
      typeof candidate === 'object' &&
      typeof candidate.access_token === 'string' &&
      candidate.access_token.length > 0 &&
      typeof candidate.refresh_token === 'string' &&
      candidate.refresh_token.length > 0 &&
      candidate.user &&
      typeof candidate.user.id === 'string' &&
      candidate.user.id.length > 0
    ) {
      return candidate as Session;
    }
  } catch {}
  return null;
}

function parseCachedProfileSnapshot(
  raw: string | null,
  expectedUserId: string | null,
): CachedProfileSnapshot | null {
  if (!raw || !expectedUserId) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CachedProfileSnapshot>;
    if (
      parsed &&
      parsed.userId === expectedUserId &&
      parsed.profile &&
      typeof parsed.profile.id === 'string'
    ) {
      return {
        userId: parsed.userId,
        profile: parsed.profile,
        hasListings: Boolean(parsed.hasListings),
      };
    }
  } catch {}
  return null;
}

let preloadedAuthState: PreloadedAuthState | null = null;
let authPreloadPromise: Promise<PreloadedAuthState> | null = null;

function readInitialAuthCache(): Promise<PreloadedAuthState> {
  if (authPreloadPromise) return authPreloadPromise;

  authPreloadPromise = (async (): Promise<PreloadedAuthState> => {
    const storageKey = getSupabaseAuthStorageKey();
    try {
      let rawSession: string | null = null;
      let rawViewMode: string | null = null;
      let rawProfile: string | null = null;

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          rawSession = storageKey ? window.localStorage.getItem(storageKey) : null;
          rawViewMode = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
          rawProfile = window.localStorage.getItem(CACHED_PROFILE_STORAGE_KEY);
        }
      } else {
        const keys = storageKey
          ? [storageKey, VIEW_MODE_STORAGE_KEY, CACHED_PROFILE_STORAGE_KEY]
          : [VIEW_MODE_STORAGE_KEY, CACHED_PROFILE_STORAGE_KEY];
        const entries = await AsyncStorage.multiGet(keys);
        const map = new Map(entries);
        rawSession = storageKey ? (map.get(storageKey) ?? null) : null;
        rawViewMode = map.get(VIEW_MODE_STORAGE_KEY) ?? null;
        rawProfile = map.get(CACHED_PROFILE_STORAGE_KEY) ?? null;
      }

      const session = parseCachedSupabaseSession(rawSession);
      const cachedProfile = parseCachedProfileSnapshot(rawProfile, session?.user?.id ?? null);
      const viewMode: 'guest' | 'host' = rawViewMode === 'host' ? 'host' : 'guest';

      const result: PreloadedAuthState = {
        session,
        profile: cachedProfile?.profile ?? null,
        hasListings: cachedProfile?.hasListings ?? false,
        viewMode,
      };
      preloadedAuthState = result;
      return result;
    } catch (err) {
      console.warn('[AuthContext] Local cache hydration note:', err);
      const fallback: PreloadedAuthState = {
        session: null,
        profile: null,
        hasListings: false,
        viewMode: 'guest',
      };
      preloadedAuthState = fallback;
      return fallback;
    }
  })();

  return authPreloadPromise;
}

// Kick off local storage hydration immediately at module import (in parallel with font loading)
void readInitialAuthCache();

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  loading: boolean;
  isBootReady: boolean;
  role: 'guest' | 'host' | 'admin' | null;
  viewMode: 'guest' | 'host';
  switchViewMode: (mode: 'guest' | 'host') => void;
  hasPass: boolean;
  sendOtp: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => preloadedAuthState?.session ?? null);
  const [profile, setProfile] = useState<ProfileRow | null>(() => preloadedAuthState?.profile ?? null);
  const [hasListings, setHasListings] = useState<boolean>(() => preloadedAuthState?.hasListings ?? false);
  const [viewMode, setViewModeState] = useState<'guest' | 'host'>(() => preloadedAuthState?.viewMode ?? 'guest');
  const [localHydrated, setLocalHydrated] = useState<boolean>(() => preloadedAuthState !== null);
  const [loading, setLoading] = useState<boolean>(() => preloadedAuthState === null);
  const [profileResolved, setProfileResolved] = useState<boolean>(
    () => preloadedAuthState !== null && (!preloadedAuthState.session || preloadedAuthState.profile !== null),
  );
  const [bootTimedOut, setBootTimedOut] = useState<boolean>(false);

  // Instant cold-start hydration from AsyncStorage (completes in ~5-20ms without waiting for network token refresh)
  useEffect(() => {
    let isMounted = true;
    const safetyBootTimer = setTimeout(() => {
      if (isMounted) {
        setBootTimedOut(true);
        setLoading(false);
      }
    }, 2500);

    readInitialAuthCache()
      .then((cached) => {
        if (!isMounted) return;
        setSession((prev) => prev ?? cached.session);
        if (cached.profile) {
          setProfile((prev) => prev ?? cached.profile);
          setHasListings((prev) => prev || cached.hasListings);
          setProfileResolved(true);
        } else if (!cached.session) {
          setProfileResolved(true);
        }
        setViewModeState(cached.viewMode);
        setLocalHydrated(true);
        setLoading(false);
      })
      .finally(() => {
        clearTimeout(safetyBootTimer);
      });

    return () => {
      isMounted = false;
      clearTimeout(safetyBootTimer);
    };
  }, []);

  const isBootReady = bootTimedOut || localHydrated;

  const persistProfileCache = useCallback((userId: string, nextProfile: ProfileRow, listingsFlag: boolean) => {
    const payload: CachedProfileSnapshot = {
      userId,
      profile: nextProfile,
      hasListings: listingsFlag,
    };
    if (preloadedAuthState && preloadedAuthState.session?.user?.id === userId) {
      preloadedAuthState = {
        ...preloadedAuthState,
        profile: nextProfile,
        hasListings: listingsFlag,
      };
    }
    const serialized = JSON.stringify(payload);
    if (Platform.OS === 'web') {
      try {
        window.localStorage?.setItem(CACHED_PROFILE_STORAGE_KEY, serialized);
      } catch {}
    } else {
      AsyncStorage.setItem(CACHED_PROFILE_STORAGE_KEY, serialized).catch(() => {});
    }
  }, []);

  const clearProfileCache = useCallback(() => {
    authPreloadPromise = null;
    preloadedAuthState = {
      session: null,
      profile: null,
      hasListings: false,
      viewMode: 'guest',
    };
    if (Platform.OS === 'web') {
      try {
        window.localStorage?.removeItem(CACHED_PROFILE_STORAGE_KEY);
      } catch {}
    } else {
      AsyncStorage.removeItem(CACHED_PROFILE_STORAGE_KEY).catch(() => {});
    }
  }, []);

  const loadProfile = useCallback(async (userId: string, authUser?: User | null) => {
    try {
      let resolvedUser = authUser;
      if (!resolvedUser) {
        const { data: authData } = await supabase.auth.getUser();
        resolvedUser = authData?.user ?? null;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const userAvatar = extractAvatarFromUser(resolvedUser);
      let resolvedProfile: ProfileRow | null = null;

      if (data) {
        // Auto-sync Google / Auth user avatar to profiles.metadata if not yet saved in DB
        const meta = ((data as any).metadata ?? {}) as Record<string, any>;
        let activeProfile = data as ProfileRow;

        if (
          userAvatar &&
          (!meta.avatar_url || meta.avatar_url !== userAvatar || !meta.picture)
        ) {
          const updatedMeta = {
            ...meta,
            avatar_url: userAvatar,
            picture: userAvatar,
          };

          activeProfile = {
            ...data,
            metadata: updatedMeta,
          } as ProfileRow;

          (supabase.from('profiles').update as any)({
            metadata: updatedMeta,
          })
            .eq('id', userId)
            .then(
              ({ error: updateErr }: any) => {
                if (!updateErr) {
                  queryClient.invalidateQueries({ queryKey: ['reels'] });
                  queryClient.invalidateQueries({ queryKey: ['host-profile', userId] });
                  invalidateServerCache('invalidate_reels_feed').catch(() => {});
                }
              },
              (e: unknown) => console.warn('Avatar auto-sync note:', e)
            );
        }

        resolvedProfile = activeProfile;
        setProfile(activeProfile);
      } else if (resolvedUser) {
        // Create initial profile if missing in profiles table for any newly signed-in user
        const uMeta = (resolvedUser.user_metadata ?? {}) as Record<string, any>;
        const fullName =
          uMeta.full_name ||
          uMeta.name ||
          resolvedUser.email?.split('@')[0] ||
          'Traveler';

        const initialMeta: Record<string, any> = {};
        if (userAvatar) {
          initialMeta.avatar_url = userAvatar;
          initialMeta.picture = userAvatar;
        }

        const newProfile: any = {
          id: userId,
          full_name: fullName,
          email: resolvedUser.email || null,
          role: 'guest',
          metadata: initialMeta,
        };

        const { data: inserted, error: insertErr } = await (supabase
          .from('profiles')
          .insert as any)([newProfile])
          .select()
          .maybeSingle();

        if (!insertErr && inserted) {
          resolvedProfile = inserted as ProfileRow;
          setProfile(resolvedProfile);
        } else {
          resolvedProfile = newProfile as ProfileRow;
          setProfile(resolvedProfile);
        }
      }

      // Register Expo push token into user_devices canonical store
      notificationService.registerPushToken(userId).catch((err) => {
        console.warn('Push token registration note:', err);
      });

      // Also check if user has created any listings
      const { count } = await supabase
        .from('experiences')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      const nextHasListings = (count ?? 0) > 0;
      setHasListings(nextHasListings);

      if (resolvedProfile) {
        persistProfileCache(userId, resolvedProfile, nextHasListings);
      }
      setProfileResolved(true);
    } catch (err) {
      console.warn('[AuthContext] loadProfile note (offline or network failure):', err);
    }
  }, [persistProfileCache]);

  useEffect(() => {
    let isMounted = true;
    // Authoritative background verification & token refresh via Supabase Auth
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (data?.session) {
          setSession(data.session);
          loadProfile(data.session.user.id, data.session.user).catch(() => {});
        } else if (!error) {
          // Confirmed signed-out state (no transient network error)
          setSession(null);
          setProfile(null);
          setHasListings(false);
          setProfileResolved(true);
          clearProfileCache();
        }
      })
      .catch((err) => {
        console.warn('[AuthContext] getSession error (offline):', err);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;
      if (event === 'INITIAL_SESSION' && !newSession) {
        // Avoid overwriting locally hydrated session on offline cold start; getSession/SIGNED_OUT handle real logouts
        return;
      }

      setSession(newSession);
      if (newSession?.user) {
        loadProfile(newSession.user.id, newSession.user).catch(() => {});
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setHasListings(false);
        setProfileResolved(true);
        clearProfileCache();
      }
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, clearProfileCache]);

  const user = session?.user ?? null;
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const profRecord = (profile as Record<string, any>) ?? {};

  const role: 'guest' | 'host' | 'admin' | null = user
    ? (profRecord.role === 'host' ||
       profRecord.host_role === 'host' ||
       meta.role === 'host' ||
       meta.host_role === 'host' ||
       hasListings
        ? 'host'
        : (profRecord.role as any) || (meta.role as any) || 'guest')
    : null;

  const hasPass = (profile?.metadata as { has_pass?: boolean } | null)?.has_pass === true;

  useEffect(() => {
    // Never reset host viewMode before profile/listings have resolved for an authenticated user
    if (loading || (user && !profileResolved)) return;
    if ((role === 'guest' || role === null) && viewMode === 'host') {
      setViewModeState('guest');
      AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, 'guest').catch(() => {});
    }
  }, [role, viewMode, loading, user, profileResolved]);

  const switchViewMode = useCallback((mode: 'guest' | 'host') => {
    setViewModeState(mode);
    if (preloadedAuthState) {
      preloadedAuthState = { ...preloadedAuthState, viewMode: mode };
    }
    AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, mode).catch(() => {});
  }, []);

  const sendOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    return { error: error ? error.message : null };
  }, []);

  const verifyOtp = useCallback(async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    return { error: error ? error.message : null };
  }, []);

  const signOut = useCallback(async () => {
    if (session?.user?.id) {
      try {
        await notificationService.deactivatePushToken(session.user.id);
      } catch (e) {
        console.warn('Deactivate token on logout note:', e);
      }
    }
    clearProfileCache();
    await realtimeManager.teardownAll();
    await supabase.auth.signOut();
  }, [session, clearProfileCache]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id, session.user);
  }, [session, loadProfile]);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      loading,
      isBootReady,
      role,
      viewMode,
      switchViewMode,
      hasPass,
      sendOtp,
      verifyOtp,
      signOut,
      refreshProfile,
    }),
    [
      session,
      user,
      profile,
      loading,
      isBootReady,
      role,
      viewMode,
      switchViewMode,
      hasPass,
      sendOtp,
      verifyOtp,
      signOut,
      refreshProfile,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
