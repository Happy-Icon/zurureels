import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { DesktopSidebar } from "./DesktopSidebar";

interface MainLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export function MainLayout({ children, hideNav = false }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {!hideNav && <DesktopSidebar />}
      <main className={!hideNav ? "md:ml-64" : ""}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
