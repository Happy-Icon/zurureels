import { Link, useLocation } from "react-router-dom";
import { Zap, Compass, PlusCircle, Calendar, User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/NotificationBell";

const navItems = [
  { icon: Zap, label: "Pulse", path: "/" },
  { icon: Compass, label: "Discover", path: "/discover" },
  { icon: PlusCircle, label: "Host", path: "/host" },
  { icon: Calendar, label: "Bookings", path: "/bookings" },
  { icon: User, label: "Profile", path: "/profile" },
];

import { useAuth } from "@/components/AuthProvider";

export function DesktopSidebar() {
  const location = useLocation();
  const { role } = useAuth();

  const filteredNavItems = navItems.filter((item) => {
    if (item.label === "Host" && role !== "host" && role !== "admin") return false;
    return true;
  });

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 flex-col border-r border-border bg-card z-50">
      {/* Logo & Notifications */}
      <div className="p-6 border-b border-border flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl font-display font-semibold text-foreground">
            ZuruSasa
          </span>
        </Link>
        <NotificationBell />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
