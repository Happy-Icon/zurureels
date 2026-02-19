
import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  role?: "guest" | "host" | "admin";
  viewMode: "guest" | "host";
  switchViewMode: (mode: "guest" | "host") => void;
  hasPass?: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => { },
  viewMode: "guest",
  switchViewMode: () => { },
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
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
    // Initialize from localStorage if available, otherwise default to "guest"
    return (localStorage.getItem("viewMode") as "guest" | "host") || "guest";
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const role = (user?.user_metadata?.role as "guest" | "host" | "admin") ||
    (profile?.role as "guest" | "host" | "admin") || "guest";

  const hasPass = profile?.metadata?.has_pass === true;

  // Effect to sync viewMode with Role. 
  // If user is a Guest, they cannot be in Host viewMode.
  useEffect(() => {
    if (role === "guest" && viewMode === "host") {
      setViewMode("guest");
    }
  }, [role, viewMode]);

  const switchViewMode = (mode: "guest" | "host") => {
    setViewMode(mode);
    localStorage.setItem("viewMode", mode);
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut, role, viewMode, switchViewMode, hasPass }}>
      {children}
    </AuthContext.Provider>
  );
};
