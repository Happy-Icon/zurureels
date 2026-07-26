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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, verification_status, metadata')
      .eq('id', userId)
      .maybeSingle();
    setProfile((data as ProfileRow | null) ?? null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const user = session?.user ?? null;
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const role: 'guest' | 'host' | 'admin' | null = user
    ? (profile?.role === 'host' || meta.role === 'host' ? 'host' : (profile?.role as any) || (meta.role as any) || 'guest')
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
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
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
