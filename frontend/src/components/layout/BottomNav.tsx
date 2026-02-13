import { Home, Compass, Calendar, Heart, User, Zap, PlusCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Zap, label: "Pulse", path: "/" },
  { icon: Compass, label: "Discover", path: "/discover" },
  { icon: PlusCircle, label: "Host", path: "/host" },
  { icon: Calendar, label: "Bookings", path: "/bookings" },
  { icon: User, label: "Profile", path: "/profile" },
];

import { useAuth } from "@/components/AuthProvider";

export function BottomNav() {
  const location = useLocation();
  const { role } = useAuth();

  const filteredNavItems = navItems.filter((item) => {
    if (item.label === "Host" && role !== "host" && role !== "admin") return false;
    return true;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/50 md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around py-1 px-2">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 active:scale-95",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-6 w-6 transition-transform duration-200",
                  isActive && "scale-110"
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
