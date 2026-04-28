import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Plus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HostAnalytics } from "@/components/host/dashboard/HostAnalytics";
import { CreateReelDialog } from "@/components/host/dashboard/CreateReelDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

export const Host = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { user } = useAuth();
  const [setupLoading, setSetupLoading] = useState(false);
  const [profile, setProfile] = useState<{ verification_status: string, stripe_onboarded: boolean, stripe_account_id: string, metadata: any } | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [payoutBannerDismissed, setPayoutBannerDismissed] = useState(() => {
    return localStorage.getItem('payout_banner_dismissed') === 'true';
  });
  const navigate = useNavigate();

  // Fetch profile for Stripe onboarding check
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles')
      .select('verification_status, stripe_onboarded, stripe_account_id, metadata')
      .eq('id', user.id)
      .single();
    setProfile(data as any);
    return data;
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Check if user just returned from Stripe onboarding
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const onboarded = urlParams.get('onboarded');

    if (onboarded === 'true' && profile?.stripe_account_id && !profile?.stripe_onboarded) {
      // Poll for onboarding completion
      setCheckingOnboarding(true);
      let attempts = 0;
      const maxAttempts = 10;

      const checkStatus = async () => {
        attempts++;
        const data = await fetchProfile();

        if (data?.stripe_onboarded) {
          toast.success("Stripe onboarding completed successfully!");
          setCheckingOnboarding(false);
          // Remove query param
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 2000); // Check every 2 seconds
        } else {
          setCheckingOnboarding(false);
          toast.info("Please refresh the page to check onboarding status");
        }
      };

      checkStatus();
    }
  }, [profile, fetchProfile]);

  const handleSetupPayouts = () => {
    navigate("/host/payouts");
  };

  // Refetch when dialog closes (new reel might have been created)
  const handleDialogChange = (open: boolean) => {
    setIsCreateOpen(open);
  };

  return (
    <MainLayout>
      <div className="pb-20 md:pb-8">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-display font-semibold">Host Dashboard</h1>
                <p className="text-sm text-muted-foreground">Welcome back! Here's your overview.</p>
              </div>

              <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create Listing</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-8">
          {/* Payout Settings Banner */}
          {profile?.verification_status === 'verified' && !profile?.metadata?.paystack_subaccount_code && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-amber-700">
                  Set Up Payouts
                </h3>
                <p className="text-sm text-foreground/80 mt-1">
                  Connect your bank account or M-Pesa to receive earnings from your bookings.
                </p>
              </div>
              <Button onClick={handleSetupPayouts} className="shrink-0">
                Connect Payout Method
              </Button>
            </div>
          )}

          {/* Success Message */}
          {profile?.metadata?.paystack_subaccount_code && !payoutBannerDismissed && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative">
              <div>
                <h3 className="font-semibold text-emerald-700">✓ Payouts Active</h3>
                <p className="text-sm text-foreground/80 mt-1">
                  Your settlement account is connected. Earnings will be automatically split.
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={handleSetupPayouts} className="flex-1 sm:flex-none">
                  Update Settings
                </Button>
                <button 
                  onClick={() => {
                    setPayoutBannerDismissed(true);
                    localStorage.setItem('payout_banner_dismissed', 'true');
                  }}
                  className="p-1 hover:bg-emerald-500/20 rounded-full transition-colors text-emerald-700"
                >
                  <Plus className="h-4 w-4 rotate-45" />
                </button>
              </div>
            </div>
          )}

          <HostAnalytics />
        </div>

        <CreateReelDialog open={isCreateOpen} onOpenChange={handleDialogChange} />
      </div>
    </MainLayout>
  );
};

export default Host;
