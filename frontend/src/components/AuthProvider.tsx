import { useEffect, useState, createContext, useContext } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  role: "guest" | "host" | "admin" | null;
  viewMode: "guest" | "host";
  switchViewMode: (mode: "guest" | "host") => void;
  hasPass: boolean;
  profile: any | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const [viewMode, setViewMode] = useState<"guest" | "host">(() => {
    return (localStorage.getItem("viewMode") as "guest" | "host") || "guest";
  });

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase.from("profiles").select("*").eq("id", session.user.id).single()
          .then(({ data }) => {
            setProfile(data);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        supabase.from("profiles").select("*").eq("id", session.user.id).single()
          .then(({ data }) => setProfile(data))
          .finally(() => setLoading(false));
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const role = user
    ? (profile?.role === 'host' || user.user_metadata?.role === 'host' ? 'host' : profile?.role || user.user_metadata?.role || 'guest')
    : null;

  const hasPass = profile?.metadata?.has_pass === true;

  useEffect(() => {
    if ((role === "guest" || role === null) && viewMode === "host") {
      setViewMode("guest");
    }
  }, [role, viewMode]);

  const switchViewMode = (mode: "guest" | "host") => {
    setViewMode(mode);
    localStorage.setItem("viewMode", mode);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut, role, viewMode, switchViewMode, hasPass, profile }}>
      {children}
    </AuthContext.Provider>
  );
};
