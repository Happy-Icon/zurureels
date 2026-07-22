import { assetUrl } from "@/lib/assetUrl";
import howBg from "@/assets/bg/how.mp4.asset.json";
import { VideoBackdrop } from "./VideoBackdrop";

const STEPS = [
  { n: "01", title: "Open the feed", desc: "Launch ZuruSasa and dive into a sound-on, vertical reel of the coast — tuned to your location." },
  { n: "02", title: "Save what moves you", desc: "Heart a stay, a boat, a plate. Build your trip without ever leaving the scroll." },
  { n: "03", title: "Ask Zuru Agent", desc: "Tell our AI your dates and vibe. Get a coast-ready itinerary in under a minute." },
  { n: "04", title: "Book in a tap", desc: "Pay in KES with M-Pesa or card. The host gets the request instantly — no DMs needed." },
];

export function HowItWorks() {
  return (
    <section className="relative bg-foreground text-background overflow-hidden">
      <VideoBackdrop
        src={assetUrl(howBg.url)}
        overlayClassName="bg-foreground/60"
      />
      <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="max-w-2xl">
          <div className="text-sm uppercase tracking-[0.2em] text-primary mb-4">How it works</div>
          <h2 className="font-display text-4xl md:text-6xl leading-[1.05] text-balance">
            Four taps from <span className="italic text-primary">curious to coastal.</span>
          </h2>
        </div>

        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 rounded-3xl overflow-hidden border border-white/10">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-foreground/85 backdrop-blur p-8">
              <div className="font-display text-5xl text-primary">{s.n}</div>
              <h3 className="font-display text-2xl mt-6">{s.title}</h3>
              <p className="text-sm opacity-70 mt-2 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
