import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EmailVerificationBanner } from "@/components/EmailVerificationBanner";

interface MainLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
  hideSidebar?: boolean;
  hideMobileUI?: boolean;
}

export function MainLayout({ 
  children, 
  hideNav = false, 
  hideSidebar = false,
  hideMobileUI = false 
}: MainLayoutProps) {
  const shouldHideSidebar = hideNav || hideSidebar;
  const shouldHideTopNav = hideNav || hideSidebar || hideMobileUI;
  const shouldHideBottomNav = hideNav || hideMobileUI;

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0 safe-top">
      <EmailVerificationBanner />
      {!shouldHideSidebar && <DesktopSidebar />}

      {/* Mobile Top Bar */}
      {!shouldHideTopNav && (
        <div className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between">
          <Link to="/" className="text-xl font-display font-semibold text-foreground">
            ZuruSasa
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </div>
      )}

      <main className={!shouldHideSidebar ? "md:ml-64" : "h-full"}>
        {children}
      </main>
      {!shouldHideBottomNav && <BottomNav />}
    </div>
  );
}
