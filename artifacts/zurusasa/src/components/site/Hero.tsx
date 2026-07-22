import { assetUrl } from "@/lib/assetUrl";
import { ArrowRight, MapPin, Play, Sparkles, Star } from "lucide-react";
import { Link } from "react-router-dom";
import heroBg from "@/assets/bg/hero.mp4.asset.json";
import appBg from "@/assets/bg/app.mp4.asset.json";
import { VideoBackdrop } from "./VideoBackdrop";

const HERO_PEEK = "https://res.cloudinary.com/dbhlo4u75/video/upload/so_0,w_400,h_600,c_fill,q_auto,f_jpg/v1777360910/reels/accommodation/ycww9dfyrvphhmfgctwe.jpg";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <VideoBackdrop
        src={assetUrl(heroBg.url)}
        eager
        overlayClassName="bg-gradient-to-b from-background/30 via-background/15 to-background/70"
      />
      <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-24 md:pt-24 md:pb-32 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 space-y-8">
          

          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] text-balance">
            Scroll the coast
            <br />
            <span className="italic text-primary">Book the moment.</span>
          </h1>

          <p className="max-w-xl text-lg text-muted-foreground text-balance">
            ZuruSasa turns Diani, Mombasa, Watamu and Lamu into a living feed of stays, tours,
            boats, food and adventures — discovered through video, booked in a tap.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link to="/app" className="group inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3.5 text-sm font-medium shadow-[var(--shadow-glow)] hover:translate-y-[-1px] transition">
              Start exploring <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition" />
            </Link>
            <a href="#discover" className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 backdrop-blur px-6 py-3.5 text-sm font-medium hover:bg-card">
              <Play className="h-4 w-4 fill-current" /> See how it works
            </a>
          </div>

          <div className="flex items-center gap-6 pt-4">
            <div className="flex -space-x-2">
              {[
                "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop",
                "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=80&h=80&fit=crop",
                "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop",
                "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=80&h=80&fit=crop",
              ].map((s) => (
                <img key={s} src={s} alt="" className="h-9 w-9 rounded-full border-2 border-background object-cover" />
              ))}
            </div>
            <div className="text-sm">
              <div className="flex items-center gap-1 text-foreground font-medium">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                4.9 from 2,300+ travellers
              </div>
              <div className="text-muted-foreground text-xs">Loved across Kenya's coast</div>
            </div>
          </div>
        </div>

        {/* <div className="lg:col-span-5 relative">
          <div className="absolute -top-10 -right-6 hidden md:flex items-center gap-2 rounded-full bg-card border border-border px-3 py-2 shadow-[var(--shadow-card)] animate-float z-10">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium">Diani Beach · 5.0 ★</span>
          </div>

          <div className="relative mx-auto w-[300px] md:w-[340px] aspect-[9/19] rounded-[2.5rem] bg-foreground p-2 shadow-[var(--shadow-glow)]">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 h-6 w-32 rounded-b-2xl bg-foreground z-10" />
            <div className="h-full w-full rounded-[2rem] overflow-hidden relative">
              <video
                autoPlay muted loop playsInline
                preload="metadata"
                poster={HERO_PEEK}
                className="absolute inset-0 h-full w-full object-cover"
                src={assetUrl(appBg.url)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white text-xs">
                <span className="rounded-full bg-white/15 backdrop-blur px-2.5 py-1">ZuruFlow</span>
                <span className="rounded-full bg-white/15 backdrop-blur px-2.5 py-1">Discover</span>
              </div>
              <div className="absolute bottom-5 left-4 right-4 text-white">
                <div className="text-[10px] uppercase tracking-widest opacity-80">Apartment · Diani</div>
                <div className="font-display text-2xl mt-1">Lamar Echoes</div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm font-medium">KES 3,500 <span className="opacity-70">/ person</span></span>
                  <button className="rounded-full bg-primary text-primary-foreground px-3.5 py-1.5 text-xs font-semibold">Book Now</button>
                </div>
              </div>
            </div>
          </div>
        </div> */}
      </div>
    </section>
  );
}
