import { Link, useLocation } from "react-router-dom";
import { Zap, Compass, Heart, Calendar, User, LayoutDashboard, ListVideo, MessageSquare, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAuth } from "@/components/AuthProvider";

const unauthGuestNavItems = [
  { icon: Zap, label: "Pulse", path: "/" },
  { icon: Compass, label: "Discover", path: "/discover" },
  { icon: User, label: "Log In", path: "/auth" },
];

const authGuestNavItems = [
  { icon: Zap, label: "Pulse", path: "/" },
  { icon: Compass, label: "Discover", path: "/discover" },
  { icon: Heart, label: "Saved", path: "/saved" },
  { icon: Calendar, label: "Trips", path: "/bookings" },
  { icon: User, label: "Profile", path: "/profile" },
];

const hostNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/host" },
  { icon: ListVideo, label: "Listings", path: "/host/listings" },
  { icon: Calendar, label: "Reservations", path: "/host/bookings" },
  { icon: MessageSquare, label: "Inbox", path: "/profile/messages" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function DesktopSidebar() {
  const location = useLocation();
  const { viewMode, user } = useAuth();

  const navItems = viewMode === "host"
    ? hostNavItems
    : user
      ? authGuestNavItems
      : unauthGuestNavItems;

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
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.label}
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

      </div>
    </aside>
  );
}
