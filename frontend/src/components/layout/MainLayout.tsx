import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface MainLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export function MainLayout({ children, hideNav = false }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0 safe-top">
      {!hideNav && <DesktopSidebar />}

      {/* Mobile Top Bar */}
      {!hideNav && (
        <div className="md:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center justify-between">
          <Link to="/" className="text-xl font-display font-semibold text-foreground">
            ZuruSasa
          </Link>
          <NotificationBell />
        </div>
      )}

      <main className={!hideNav ? "md:ml-64" : ""}>

        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
