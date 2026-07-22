import { assetUrl } from "@/lib/assetUrl";
import { Heart, MessageCircle, PlayCircle, Send, Volume2 } from "lucide-react";
import appBg from "@/assets/bg/app.mp4.asset.json";
import { VideoBackdrop } from "./VideoBackdrop";

const PILLS = [
  { title: "Vertical reels", desc: "Sound-on, one-tap-to-book." },
  { title: "Real listings only", desc: "Every place is verified by ZuruSasa." },
  { title: "Instant enquire", desc: "Chat the host without leaving the feed." },
];

export function AppInAction() {
  return (
    <section id="reels" className="relative">
      <VideoBackdrop
        src={assetUrl(appBg.url)}
        overlayClassName="bg-gradient-to-b from-background via-background/80 to-background"
      />
      <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-8">
            <div className="text-sm uppercase tracking-[0.2em] text-primary">ZuruFlow in motion</div>
            <h2 className="font-display text-4xl md:text-6xl leading-[1.05] text-balance">
              The whole coast,
              <br /><span className="italic">one swipe at a time.</span>
            </h2>
            <p className="max-w-md text-muted-foreground">
              Every reel inside ZuruSasa is a bookable moment — an apartment in Diani, a dhow
              from Lamu, a plate of viazi karai in Mombasa. Scroll, save, book.
            </p>
            <ul className="space-y-3">
              {PILLS.map((p) => (
                <li key={p.title} className="flex items-start gap-4 rounded-2xl border border-border bg-card/80 backdrop-blur p-4">
                  <PlayCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-sm">{p.title}</div>
                    <div className="text-muted-foreground text-sm">{p.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-6 flex justify-center">
            <div className="relative w-[280px] md:w-[340px] aspect-[9/19] rounded-[2.5rem] bg-foreground p-2 shadow-[var(--shadow-glow)]">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 h-6 w-32 rounded-b-2xl bg-foreground z-10" />
              <div className="h-full w-full rounded-[2rem] overflow-hidden relative">
                <video autoPlay muted loop playsInline preload="metadata" src={assetUrl(appBg.url)} className="absolute inset-0 h-full w-full object-cover bg-foreground" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />

                <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white text-[11px]">
                  <span className="rounded-full bg-white/15 backdrop-blur px-2.5 py-1">ZuruFlow</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur px-2.5 py-1">
                    <Volume2 className="h-3 w-3" /> Sound on
                  </span>
                </div>

                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 text-white">
                  {[Heart, MessageCircle, Send].map((Icon, k) => (
                    <div key={k} className="flex flex-col items-center gap-0.5">
                      <span className="h-9 w-9 grid place-items-center rounded-full bg-white/15 backdrop-blur">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-[10px]">{[128, 42, 18][k]}</span>
                    </div>
                  ))}
                </div>

                <div className="absolute bottom-5 left-4 right-4 text-white">
                  <div className="text-[10px] uppercase tracking-widest opacity-80">Boats · Lamu</div>
                  <div className="font-display text-xl mt-1">Sunset Dhow Cruise</div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs opacity-90">KES 2,200 / person</span>
                    <button className="rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold">Book</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
