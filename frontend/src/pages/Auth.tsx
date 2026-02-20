import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { X, ChevronLeft, Mail, Apple, MessageSquare, Phone } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const returnTo = searchParams.get("return_to") || location.state?.from?.pathname;

  // Flow State
  const [step, setStep] = useState<"phone" | "otp" | "profile" | "commitment" | "email_sent">("phone");
  const [loading, setLoading] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Form State
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+254"); // Default Kenya
  const [otp, setOtp] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");

  // Centralized Routing Logic
  useEffect(() => {
    const checkRedirect = async () => {
      // If the user is actively filling out the profile, commitment, or viewing the email screen, do not interrupt them.
      if (step === "profile" || step === "commitment" || step === "email_sent") return;

      if (user) {
        const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        const profileData = data as { full_name: string | null } | null;

        // Condition 1: Missing profile name
        if (!profileData?.full_name) {
          setStep("profile");
        }
        // Condition 2: Fully verified profile
        else {
          navigate(returnTo || "/", { replace: true });
        }
      }
    };
    checkRedirect();
  }, [user, navigate, returnTo, step]);

  const fullPhoneNumber = `${countryCode}${phone.replace(/^0+/, "")}`; // remove leading zero if they type 0700...

  // STEP 1: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber,
      });

      if (error) throw error;
      setStep("otp");
      setShowMoreOptions(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async (channel: 'sms' | 'whatsapp') => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber,
        options: {
          channel: channel
        }
      });
      if (error) throw error;
      toast.success(`Code sent via ${channel === 'whatsapp' ? 'WhatsApp' : 'call'}`);
      setShowMoreOptions(false);
      setOtp("");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: fullPhoneNumber,
        token: otp,
        type: "sms",
      });

      if (error) throw error;

      // Check if user is brand new (missing name in profile)
      if (data.user) {
        const { data: profileResponse } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data.user.id)
          .single();

        const pData = profileResponse as { full_name: string | null } | null;

        // Condition 1: Missing profile name
        if (!pData?.full_name) {
          setStep("profile");
        }
        // Condition 2: Has profile
        else {
          toast.success("Welcome back!");
          navigate(returnTo || "/", { replace: true });
        }
      }
    } catch (error: any) {
      toast.error("Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Complete Profile
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !dob || !email) {
      toast.error("Please fill in all fields to continue.");
      return;
    }

    setStep("commitment");
  };

  // STEP 4: Agree to Commitment
  const handleCommitment = async () => {
    setLoading(true);
    try {
      const { error: profileError } = await (supabase.from("profiles").update as any)({
        full_name: `${firstName} ${lastName}`.trim(),
      }).eq("id", user?.id);

      if (profileError) throw profileError;

      // Update email in auth if provided, this triggers a confirmation email
      if (email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
        setStep("email_sent");
      } else {
        toast.success("Welcome to ZuruSasa!");
        navigate(returnTo || "/", { replace: true });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const redirectUrl = returnTo ? `${appUrl}/auth?return_to=${encodeURIComponent(returnTo)}` : `${appUrl}/`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl },
      });

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // --- RENDER HELPERS ---

  return (
    <MainLayout>
      <div className="flex items-start sm:items-center justify-center min-h-[calc(100vh-140px)] sm:min-h-screen sm:p-4 bg-background sm:bg-black/50">
        <div className="bg-background w-full sm:max-w-[568px] sm:rounded-xl sm:shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[85vh] animate-in fade-in duration-300 pt-4 sm:pt-0">

          {/* Header */}
          <div className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 relative shrink-0">
            <div className="absolute left-4">
              {step === "otp" && (
                <button onClick={() => setStep("phone")} className="p-2 hover:bg-secondary rounded-full transition-colors">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {step === "profile" && (
                <button disabled className="p-2 opacity-50"><ChevronLeft className="h-5 w-5" /></button>
              )}
              {step === "commitment" && (
                <button onClick={() => setStep("profile")} className="p-2 hover:bg-secondary rounded-full transition-colors">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="w-full text-center">
              <h2 className="text-[17px] font-semibold tracking-tight">
                {step === "phone" && "Log in or sign up"}
                {step === "otp" && "Confirm your number"}
                {step === "profile" && "Finish signing up"}
                {step === "commitment" && "Community commitment"}
              </h2>
            </div>

            <div className="absolute right-4 text-primary font-bold text-sm tracking-[0.2em]">
              ZURU.
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8">

            {/* STEP 1: PHONE */}
            {step === "phone" && (
              <div className="flex flex-col h-full">
                <h1 className="text-[22px] font-semibold tracking-tight text-[#222] mb-6">Welcome to ZuruSasa</h1>

                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="border border-[#B0B0B0] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#222] focus-within:border-transparent transition-all">
                    <div className="border-b border-[#B0B0B0] px-3 py-2 bg-white relative flex flex-col justify-center">
                      <Label className="text-xs text-[#717171] font-normal mb-1">Country code</Label>
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-[16px] text-[#222] outline-none appearance-none pr-8 cursor-pointer"
                      >
                        <option value="+254">Kenya (+254)</option>
                        <option value="+1">United States (+1)</option>
                        <option value="+44">United Kingdom (+44)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#222]">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </div>
                    </div>
                    <div className="px-3 py-2 bg-white relative">
                      <Label className="text-xs text-[#717171] font-normal mb-1">Phone number</Label>
                      <div className="flex items-center text-[16px]">
                        <span className="text-[#222] mr-2">{countryCode}</span>
                        <Input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="0704447256"
                          className="border-none shadow-none p-0 h-auto focus-visible:ring-0 text-[16px] text-[#222] placeholder:text-[#B0B0B0]"
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-[12px] text-[#222] leading-[1.3] pt-1">
                    We'll call or text you to confirm your number. Standard message and data rates apply. <span className="underline font-semibold cursor-pointer">Privacy Policy</span>
                  </p>

                  <Button
                    type="submit"
                    disabled={loading || phone.length < 8}
                    className="w-full h-[48px] bg-[#EE7D30] hover:bg-[#D96B23] text-white text-[16px] font-semibold rounded-lg mt-2"
                  >
                    {loading ? "Please wait..." : "Continue"}
                  </Button>
                </form>

                <div className="relative py-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#EBEBEB]"></div></div>
                  <div className="relative flex justify-center"><span className="bg-background px-4 text-[12px] text-[#222]">or</span></div>
                </div>

                <div className="space-y-4">
                  <Button variant="outline" onClick={handleGoogleLogin} className="w-full h-[48px] text-[15px] font-medium border-[#222] text-[#222] relative justify-center bg-white hover:bg-gray-50 rounded-lg">
                    <div className="absolute left-5">
                      <svg className="h-[20px] w-[20px]" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                    </div>
                    Continue with Google
                  </Button>
                  <Button variant="outline" className="w-full h-[48px] text-[15px] font-medium border-[#222] text-[#222] relative justify-center bg-white hover:bg-gray-50 rounded-lg">
                    <svg className="absolute left-5 h-[20px] w-[20px]" viewBox="0 0 24 24" fill="currentColor"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.126 3.804 3.07 1.517-.058 2.096-.983 3.931-.983 1.815 0 2.339.983 3.931.956 1.636-.027 2.651-1.492 3.642-2.956 1.144-1.674 1.611-3.296 1.631-3.38-.035-.015-3.176-1.22-3.199-4.851-.019-3.047 2.483-4.512 2.597-4.577-1.428-2.096-3.641-2.385-4.437-2.42-1.928-.152-3.606 1.077-4.498 1.077ZM15.589 3.016A4.545 4.545 0 0 0 16.634.301c-1.554.062-3.328 1.034-4.225 3.001-.844 1.85-.989 3.655-.952 3.654 1.612.124 3.228-1.527 4.132-3.94Z" /></svg>
                    Continue with Apple
                  </Button>
                  <Button variant="outline" className="w-full h-[48px] text-[15px] font-medium border-[#222] text-[#222] relative justify-center bg-white hover:bg-gray-50 rounded-lg">
                    <Mail className="absolute left-5 h-[20px] w-[20px] text-[#222]" /> Continue with email
                  </Button>
                  <Button variant="outline" className="w-full h-[48px] text-[15px] font-medium border-[#222] text-[#222] relative justify-center bg-white hover:bg-gray-50 rounded-lg pb-1">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 pt-1">
                      <svg className="h-[20px] w-[20px] text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                    </div>
                    Continue with Facebook
                  </Button>
                </div>

                <div className="mt-8 text-center pb-8">
                  <button type="button" className="text-[15px] font-semibold underline text-[#222]">Need help?</button>
                </div>
              </div>
            )}

            {/* STEP 2: OTP */}
            {step === "otp" && (
              <div className="space-y-6">
                {!showMoreOptions ? (
                  <>
                    <p className="text-[15px] text-[#222]">
                      Enter the code we sent over SMS to <span className="font-semibold">{fullPhoneNumber}</span>:
                    </p>

                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                      <Input
                        type="text"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                        className="h-[52px] text-xl tracking-[0.5em] font-medium text-center border-input focus-visible:ring-primary rounded-lg"
                        placeholder="------"
                        autoFocus
                      />

                      <p className="text-sm font-medium text-[#222]">
                        Didn't get a code? <button type="button" className="underline cursor-pointer hover:text-black font-semibold" onClick={() => setShowMoreOptions(true)}>More options</button>
                      </p>

                      <Button
                        type="submit"
                        disabled={loading || otp.length < 6}
                        className="w-full h-[52px] bg-[#EE7D30] hover:bg-[#D96B23] text-white text-base font-semibold rounded-lg"
                      >
                        {loading ? "Verifying..." : "Continue"}
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="animate-in fade-in duration-200">
                    <p className="text-[15px] text-[#222] font-semibold mb-6">
                      Choose another way to get a code:
                    </p>
                    <div className="space-y-4">
                      <Button
                        variant="outline"
                        onClick={() => handleResendOtp('whatsapp')}
                        disabled={loading}
                        className="w-full h-[52px] text-[15px] font-medium border-[#B0B0B0] text-[#222] relative justify-start px-5 bg-white hover:bg-gray-50 rounded-lg"
                      >
                        <MessageSquare className="h-[20px] w-[20px] mr-4 text-[#222]" /> Get a code via WhatsApp
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleResendOtp('sms')}
                        disabled={loading}
                        className="w-full h-[52px] text-[15px] font-medium border-[#B0B0B0] text-[#222] relative justify-start px-5 bg-white hover:bg-gray-50 rounded-lg"
                      >
                        <Phone className="h-[20px] w-[20px] mr-4 text-[#222]" /> Get a call instead
                      </Button>
                    </div>
                    <div className="mt-8 pt-4">
                      <button
                        type="button"
                        className="underline font-semibold text-[#222] text-[15px] hover:text-black"
                        onClick={() => setShowMoreOptions(false)}
                        disabled={loading}
                      >
                        Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: PROFILE COMPLETION */}
            {step === "profile" && (
              <div className="space-y-8">
                <form onSubmit={handleCompleteProfile} className="space-y-8">

                  {/* Name section */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg text-[#222]">Legal name</h3>
                    <div className="border border-input rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
                      <div className="border-b border-input px-4 py-2 relative">
                        <Label className="text-xs text-muted-foreground">First name on ID</Label>
                        <Input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="John"
                          className="border-none shadow-none p-0 h-auto mt-1 focus-visible:ring-0 text-base"
                        />
                      </div>
                      <div className="px-4 py-2 relative">
                        <Label className="text-xs text-muted-foreground">Last name on ID</Label>
                        <Input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Doe"
                          className="border-none shadow-none p-0 h-auto mt-1 focus-visible:ring-0 text-base"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-[#717171] leading-relaxed">
                      Make sure this matches the name on your government ID. If you go by another name, you can <span className="underline cursor-pointer font-medium">add a preferred first name</span>.
                    </p>
                  </div>

                  {/* DOB section */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg text-[#222]">Date of birth</h3>
                    <div className="border border-input rounded-xl px-4 py-2 focus-within:ring-2 focus-within:ring-primary">
                      <Label className="text-xs text-muted-foreground">Birthdate</Label>
                      <Input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="border-none shadow-none p-0 h-auto mt-1 focus-visible:ring-0 text-base bg-transparent"
                      />
                    </div>
                    <p className="text-xs text-[#717171] leading-relaxed">
                      To sign up, you need to be at least 18. Your birthday won't be shared with other people who use ZuruSasa.
                    </p>
                  </div>

                  {/* Contact section */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg text-[#222]">Contact info</h3>
                    <div className="border border-input rounded-xl px-4 py-2 focus-within:ring-2 focus-within:ring-primary">
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="hello@example.com"
                        className="border-none shadow-none p-0 h-auto mt-1 focus-visible:ring-0 text-base"
                      />
                    </div>
                    <p className="text-xs text-[#717171] leading-relaxed">
                      We'll email you trip confirmations and receipts.
                    </p>
                  </div>

                  <div className="space-y-4 pt-2">
                    <p className="text-xs text-[#222] leading-relaxed">
                      By selecting <span className="font-bold">Agree and continue</span>, I agree to ZuruSasa's <span className="underline text-primary">Terms of Service</span>, <span className="underline text-primary">Payments Terms of Service</span>, and <span className="underline text-primary">Nondiscrimination Policy</span> and acknowledge the <span className="underline text-primary">Privacy Policy</span>.
                    </p>

                    <Button
                      type="submit"
                      className="w-full h-[52px] bg-[#EE7D30] hover:bg-[#D96B23] text-white text-base font-semibold rounded-lg"
                    >
                      Agree and continue
                    </Button>
                  </div>

                </form>
              </div>
            )}

            {/* STEP 4: COMMITMENT */}
            {step === "commitment" && (
              <div className="space-y-6 pb-6">
                <div className="font-bold tracking-[0.2em] text-sm text-primary mb-2">
                  ZURU.
                </div>
                <h1 className="text-[28px] leading-tight font-semibold text-[#222] tracking-tight">
                  ZuruSasa is a community where anyone can belong
                </h1>

                <div className="space-y-4 mt-6">
                  <p className="text-base text-[#222]">
                    To ensure this, we're asking you to commit to the following:
                  </p>
                  <p className="text-base text-[#222] leading-relaxed">
                    I agree to treat everyone in the ZuruSasa community—regardless of their race, religion, national origin, ethnicity, skin color, disability, sex, gender identity, sexual orientation or age—with respect, and without judgment or bias.
                  </p>
                  <button className="underline font-semibold text-[#222] text-base">Learn more</button>
                </div>

                <div className="pt-8 space-y-4">
                  <Button
                    onClick={handleCommitment}
                    disabled={loading}
                    className="w-full h-[52px] bg-[#EE7D30] hover:bg-[#D96B23] text-white text-base font-semibold rounded-lg"
                  >
                    {loading ? "Saving..." : "Agree and continue"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/")}
                    className="w-full h-[52px] text-[#222] border-border text-base font-semibold rounded-lg"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            )}

            {/* FINAL STEP: EMAIL SENT */}
            {step === "email_sent" && (
              <div className="space-y-6 flex flex-col items-center justify-center text-center pb-6 pt-4 animate-in fade-in duration-300">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
                  <Mail className="w-8 h-8" />
                </div>
                <h1 className="text-[24px] leading-tight font-semibold text-[#222] tracking-tight">
                  Please confirm your email address
                </h1>

                <div className="space-y-2 mt-2 max-w-sm">
                  <p className="text-[15px] text-[#717171]">
                    Welcome to ZuruSasa! In order to get started, you need to confirm your email address.
                  </p>
                  <p className="text-[15px] text-[#222] font-semibold pt-2">
                    {email}
                  </p>
                </div>

                <div className="pt-6 w-full space-y-4">
                  <Button
                    onClick={() => navigate(returnTo || "/", { replace: true })}
                    className="w-full h-[52px] bg-[#EE7D30] hover:bg-[#D96B23] text-white text-base font-semibold rounded-lg"
                  >
                    Go to Dashboard
                  </Button>
                  <p className="text-[13px] text-[#717171]">
                    You can confirm your email at any time from your inbox.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </MainLayout>
  );
}
