import { assetUrl } from "@/lib/assetUrl";
import { useState, useRef } from "react";
import { Mail, ArrowRight, Instagram, Twitter, Video, MapPin, Send } from "lucide-react";
import heroVideo from "@/assets/bg/hero.mp4.asset.json";

export function ComingSoon() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatus("error");
      return;
    }
    setStatus("submitting");
    // Simulate submission — in production this would call a server function
    setTimeout(() => {
      setStatus("success");
      setEmail("");
    }, 1200);
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Ambient background video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src={assetUrl(heroVideo.url)} type="video/mp4" />
      </video>

      {/* Dark gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 py-20 text-center">
        {/* Logo / Brand */}
        <div className="mb-8 flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
            <Video className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">
            ZuruSasa
          </span>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-sm text-white/90 mb-8">
          <MapPin className="w-3.5 h-3.5 text-primary" />
          Kenya's coast, in your pocket
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-[1.1] mb-6 max-w-3xl">
          Coming <span className="text-primary">Soon</span>
        </h1>

        {/* Description */}
        <p className="text-lg md:text-xl text-white/70 max-w-xl mb-10 leading-relaxed">
          The video-first marketplace for stays, tours, boats and food across Diani, Mombasa, Watamu and Lamu. Scroll the coast. Book the moment.
        </p>

        {/* Email signup */}
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md mb-4"
        >
          <div className="relative flex items-center bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-1.5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
            <Mail className="w-5 h-5 text-white/50 ml-4 shrink-0" />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              placeholder="Enter your email for early access"
              className="flex-1 bg-transparent border-none outline-none px-3 py-3 text-white placeholder:text-white/40 text-base"
              disabled={status === "submitting" || status === "success"}
            />
            <button
              type="submit"
              disabled={status === "submitting" || status === "success"}
              className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {status === "submitting" ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : status === "success" ? (
                <Send className="w-4 h-4" />
              ) : (
                <>
                  Notify me <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Status messages */}
        {status === "success" && (
          <p className="text-sm text-emerald-400 mb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
            You're on the list! We'll reach out when ZuruSasa launches.
          </p>
        )}
        {status === "error" && (
          <p className="text-sm text-red-400 mb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
            Please enter a valid email address.
          </p>
        )}
        {status === "idle" && <div className="mb-10" />}

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-16">
          {["Vertical Reels", "Instant Booking", "Local Hosts", "KES Payments"].map((tag) => (
            <span
              key={tag}
              className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Social links */}
        <div className="flex items-center gap-4">
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 transition-all"
          >
            <Instagram className="w-5 h-5" />
          </a>
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 transition-all"
          >
            <Twitter className="w-5 h-5" />
          </a>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center py-6 text-white/30 text-sm">
        ZuruSasa &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
}
