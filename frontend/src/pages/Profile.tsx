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

  // GUEST VIEW
  if (!user) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-[#EBEBEB] relative flex flex-col items-center justify-center p-6 overflow-hidden pt-16">
          {/* Decorative Sparkle at bottom right */}
          <div className="absolute bottom-8 right-8 text-[#C4C4C4] hidden md:block">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles opacity-50"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" /></svg>
          </div>

          {/* Main Title */}
          <h1 className="text-[2.2rem] md:text-5xl lg:text-6xl font-display font-medium text-[#111] mb-8 md:mb-12 text-center tracking-tight leading-tight pt-10">
            Your Journey Begins Here
          </h1>

          {/* Floating Card */}
          <div className="w-full max-w-[650px] bg-white rounded-[32px] p-8 md:px-16 md:py-14 shadow-[0_20px_60px_rgba(0,0,0,0.06)] text-center flex flex-col items-center relative z-10">

            {/* Logo */}
            <div className="font-bold tracking-[0.2em] text-sm text-[#111] mb-6 md:mb-8">
              ZURU.
            </div>

            {/* Subtitle */}
            <h2 className="text-2xl md:text-[2.5rem] leading-tight font-display font-medium text-[#111] mb-4 md:mb-5">
              Elevate Your Summer
            </h2>

            {/* Description */}
            <p className="text-[#555] text-[15px] md:text-[17px] max-w-sm mb-8 md:mb-10 leading-relaxed font-sans">
              Join the ZuruSasa community to unlock exclusive early access to our 2026 Yacht Charter collection
            </p>

            {/* CTA Button */}
            <Link to="/auth" className="w-full max-w-[380px]">
              <Button
                className="w-full h-14 bg-[#EE7D30] hover:bg-[#D96B23] text-white font-medium text-[16px] md:text-[17px] rounded-full shadow-[0_8px_25px_rgba(238,125,48,0.35)] transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Sign In / Sign Up
              </Button>
            </Link>

            {/* Icons Row */}
            <div className="grid grid-cols-3 gap-4 md:gap-8 w-full mt-10 md:mt-14 pt-8 md:pt-10 border-t border-gray-100">
              <div className="flex flex-col items-center gap-2 md:gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-ship text-[#222]"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" /><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" /><path d="M12 10v4" /><path d="M12 2v3" /></svg>
                <span className="text-[11px] md:text-[13px] text-[#555] font-medium leading-tight px-1">Curated Collections</span>
              </div>
              <div className="flex flex-col items-center gap-2 md:gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-calendar-check text-[#222]"><path d="M8 2v4" /><path d="M16 2v4" /><path d="rect x=3 y=4 width=18 height=18 rx=2" /><path d="M3 10h18" /><path d="M9 16l2 2 4-4" /></svg>
                <span className="text-[11px] md:text-[13px] text-[#555] font-medium leading-tight px-1">Seamless Booking</span>
              </div>
              <div className="flex flex-col items-center gap-2 md:gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star text-[#222]"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                <span className="text-[11px] md:text-[13px] text-[#555] font-medium leading-tight px-1">Exclusive Events</span>
              </div>
            </div>
          </div>

          {/* Footer Text */}
          <div className="mt-8 md:mt-12 text-center flex flex-col items-center gap-3 md:gap-4 relative z-10 pb-20 md:pb-0">
            <p className="text-[#777] text-[13px] md:text-sm max-w-[320px] md:max-w-md leading-relaxed px-4">
              By joining, you agree to receive updates on the Zuru Summer Event and exclusive yacht drops.
            </p>
            <p className="text-[#777] text-[13px] md:text-sm font-medium">
              ZuruSasa v1.0.0
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // AUTHENTICATED VIEW
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
              {user?.user_metadata?.full_name || user?.email}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user.email}
            </p>

            {/* Progress Bar */}
            <div className="w-full max-w-xs mt-4 space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>Profile Completeness</span>
                <span>{completeness}%</span>
              </div>
              <Progress value={completeness} className="h-2" />
            </div>
          </div>

          {/* Stats - Only for Hosts */}
          {role === 'host' && (
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
            {menuItems.map((item) => (
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
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 p-4 w-full rounded-xl hover:bg-destructive/10 transition-colors mt-4 text-destructive"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Sign Out</span>
          </button>

          {/* Switch Mode Floating Button */}
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
