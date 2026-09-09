import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type ProfileRow } from '@/lib/supabase';

import { queryClient } from '@/lib/queryClient';
import { invalidateServerCache } from '@/lib/redis';
import { notificationService } from '@/services/notificationService';
import { extractAvatarFromUser } from '@/lib/avatar';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  loading: boolean;
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
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewModeState] = useState<'guest' | 'host'>('guest');

  useEffect(() => {
    AsyncStorage.getItem('viewMode').then((stored) => {
      if (stored === 'host' || stored === 'guest') {
        setViewModeState(stored);
      }
    });
  }, []);

  const [hasListings, setHasListings] = useState<boolean>(false);

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
          setProfile(inserted as ProfileRow);
        } else {
          setProfile(newProfile as ProfileRow);
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

      setHasListings((count ?? 0) > 0);
    } catch (err) {
      console.warn('[AuthContext] loadProfile note (offline or network failure):', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    // 6s fallback timer ensures app never gets stuck on auth loading if device is offline
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 6000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data?.session ?? null);
        if (data?.session?.user) {
          loadProfile(data.session.user.id, data.session.user).catch(() => {});
        }
      })
      .catch((err) => {
        console.warn('[AuthContext] getSession error (offline):', err);
      })
      .finally(() => {
        if (isMounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      if (newSession?.user) {
        loadProfile(newSession.user.id, newSession.user).catch(() => {});
      } else {
        setProfile(null);
        setHasListings(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

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
    if (loading) return;
    if ((role === 'guest' || role === null) && viewMode === 'host') {
      setViewModeState('guest');
      AsyncStorage.setItem('viewMode', 'guest');
    }
  }, [role, viewMode, loading]);

  const switchViewMode = useCallback((mode: 'guest' | 'host') => {
    setViewModeState(mode);
    AsyncStorage.setItem('viewMode', mode);
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
    await supabase.auth.signOut();
  }, [session]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id, session.user);
  }, [session, loadProfile]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        role,
        viewMode,
        switchViewMode,
        hasPass,
        sendOtp,
        verifyOtp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
