import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export function Nav() {
  const [open, setOpen] = useState(false);
  const items = [
    { label: "Discover", href: "#discover" },
    { label: "Reels", href: "#reels" },
    { label: "Destinations", href: "#destinations" },
    { label: "Hosts", href: "#hosts" },
  ];

  return (
    <header className="sticky top-4 z-50 w-full max-w-6xl mx-auto px-4 md:px-6">
      <div className="rounded-full border border-border/60 bg-background/80 backdrop-blur-xl shadow-lg shadow-black/5 px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src="/logo.png" alt="ZuruSasa" className="h-10 md:h-11 w-auto object-contain" />
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground font-medium">
          {items.map((i) => (
            <a
              key={i.href}
              href={i.href}
              className="hover:text-foreground transition-colors"
            >
              {i.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            to={import.meta.env.VITE_APP_URL ? `${import.meta.env.VITE_APP_URL}/auth` : "/auth"}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors px-4 py-2 rounded-full border border-primary/20 hover:border-primary/40 bg-primary/5"
          >
            Log in
          </Link>
          <Link
            to={import.meta.env.VITE_APP_URL ? `${import.meta.env.VITE_APP_URL}/app` : "/app"}
            className="inline-flex items-center rounded-full bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Explore App
          </Link>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 rounded-full hover:bg-muted/50 transition-colors"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden mt-2 rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl px-6 py-4 space-y-3 shadow-xl">
          {items.map((i) => (
            <a
              key={i.href}
              href={i.href}
              onClick={() => setOpen(false)}
              className="block text-sm font-medium hover:text-primary transition-colors"
            >
              {i.label}
            </a>
          ))}
          <div className="pt-2 border-t border-border/40 flex flex-col gap-2">
            <Link
              to={import.meta.env.VITE_APP_URL ? `${import.meta.env.VITE_APP_URL}/auth` : "/auth"}
              onClick={() => setOpen(false)}
              className="block text-center text-sm font-medium text-primary bg-primary/10 py-2 rounded-full"
            >
              Log in
            </Link>
            <Link
              to={import.meta.env.VITE_APP_URL ? `${import.meta.env.VITE_APP_URL}/app` : "/app"}
              onClick={() => setOpen(false)}
              className="block rounded-full bg-foreground text-background text-center px-4 py-2 text-sm font-medium"
            >
              Explore App
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
