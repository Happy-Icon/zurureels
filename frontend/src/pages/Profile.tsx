import { MainLayout } from "@/components/layout/MainLayout";
import {
  User,
  Settings,
  Bell,
  CreditCard,
  HelpCircle,
  Shield,
  LogOut,
  ChevronRight,
  Camera,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/AuthProvider";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const menuItems = [
  { icon: ShieldCheck, label: "Digital Identity Center", path: "/profile/info" },
  { icon: Bell, label: "Notifications", path: "/profile/notifications" },
  { icon: CreditCard, label: "Payment Methods", path: "/profile/payments" },
  { icon: Shield, label: "Privacy & Security", path: "/profile/security" },
  { icon: HelpCircle, label: "Help & Support", path: "/profile/support" },
  { icon: Settings, label: "Settings", path: "/profile/settings" },
];

const Profile = () => {
  const { user, signOut, switchViewMode, viewMode } = useAuth();
  const navigate = useNavigate();
  const [completeness, setCompleteness] = useState(0);
  const [role, setRole] = useState<string>('guest');
  const [verificationStatus, setVerificationStatus] = useState<string>('none');
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setLoadingProfile(false);
        return;
      }

      console.log("Fetching profile for:", user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('profile_completeness, role, verification_status')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
      } else {
        console.log("Profile Data Fetched:", data);
      }

      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profileData = data as any;
        setCompleteness(profileData.profile_completeness || 20);
        setRole(profileData.role || 'guest');
        setVerificationStatus(profileData.verification_status || 'none');
      }
      setLoadingProfile(false);
    };
    fetchProfile();
  }, [user]);

  return (
    <MainLayout>
      <div className="pb-20 md:pb-8">
        {/* Header */}
        <div className="bg-gradient-to-b from-primary/10 to-background p-6 pt-8">
          {/* Avatar */}
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center overflow-hidden border-4 border-background shadow-lg">
                <User className="h-12 w-12 text-muted-foreground" />
              </div>
              <button className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-md">
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <h1 className="mt-4 text-xl font-display font-semibold">
              {user?.user_metadata?.full_name || user?.email || "Guest User"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user ? user.email : "Welcome to ZuruSasa"}
            </p>

            {!user ? (
              <Link to="/auth">
                <Button className="mt-4">Sign In / Sign Up</Button>
              </Link>
            ) : (
              /* Progress Bar */
              <div className="w-full max-w-xs mt-4 space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span>Profile Completeness</span>
                  <span>{completeness}%</span>
                </div>
                <Progress value={completeness} className="h-2" />
              </div>
            )}
          </div>

          {/* Stats */}
          {/* Stats */}
          {/* Stats - Only for Hosts */}
          {user && role === 'host' && (
            <div className="flex justify-center gap-8 mt-6 pt-6 border-t border-border">
              <div className="text-center">
                <p className="text-2xl font-semibold">0</p>
                <p className="text-sm text-muted-foreground">Trips</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold">0</p>
                <p className="text-sm text-muted-foreground">Reviews</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold">2</p>
                <p className="text-sm text-muted-foreground">Saved</p>
              </div>
            </div>
          )}
        </div>

        {/* Menu */}
        <div className="p-4">
          <div className="space-y-1">
            {user && menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center justify-between p-4 rounded-xl hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{item.label}</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            ))}
          </div>

          {/* Sign Out */}
          {user && (
            <button
              onClick={() => signOut()}
              className="flex items-center gap-3 p-4 w-full rounded-xl hover:bg-destructive/10 transition-colors mt-4 text-destructive"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          )}

          {/* Switch Mode Floating Button */}
          {user && (
            <div className="fixed bottom-24 right-6 z-50">
              {viewMode === 'host' ? (
                <Button
                  onClick={() => {
                    switchViewMode('guest');
                    navigate('/');
                  }}
                  className="shadow-lg rounded-full px-6 py-3 h-auto text-sm font-semibold bg-secondary text-primary hover:bg-secondary/90 transition-all hover:scale-105 border border-primary/20"
                >
                  Switch to Guest
                </Button>
              ) : loadingProfile ? (
                <Button disabled className="shadow-lg rounded-full px-6 py-3 h-auto text-sm font-semibold bg-secondary text-primary border border-primary/20">
                  Loading...
                </Button>
              ) : (user.user_metadata?.role === 'host' || role === 'host') ? (
                verificationStatus === 'verified' ? (
                  <Button
                    onClick={() => {
                      switchViewMode('host');
                      navigate('/host');
                    }}
                    className="shadow-lg rounded-full px-6 py-3 h-auto text-sm font-semibold bg-primary hover:bg-primary/90 transition-all hover:scale-105"
                  >
                    Switch to Hosting
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      navigate('/host/verification');
                    }}
                    className="shadow-lg rounded-full px-6 py-3 h-auto text-sm font-semibold bg-yellow-500 hover:bg-yellow-600 text-black transition-all hover:scale-105"
                  >
                    Complete Verification
                  </Button>
                )
              ) : (
                <Link to="/become-host">
                  <Button className="shadow-lg rounded-full px-6 py-3 h-auto text-sm font-semibold bg-primary hover:bg-primary/90 transition-all hover:scale-105">
                    Become a Host
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground">ZuruSasa v1.0.0</p>
        </div>
      </div>
    </MainLayout>
  );
};

export default Profile;
