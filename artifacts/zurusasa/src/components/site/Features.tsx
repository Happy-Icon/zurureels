import { assetUrl } from "@/lib/assetUrl";
import { Compass, Sparkles, Video, Wallet, MapPin, MessageSquare } from "lucide-react";
import featuresBg from "@/assets/bg/features.mp4.asset.json";
import { VideoBackdrop } from "./VideoBackdrop";

const features = [
  { icon: Video, title: "ZuruFlow Reels", desc: "A vertical, sound-on feed of real places — stays, food, boats, skydives — all along the coast." },
  { icon: Sparkles, title: "Zuru Agent (AI)", desc: "Ask in plain English. Get tailored stays, tours and itineraries from local hosts in seconds." },
  { icon: MapPin, title: "Hyper-local", desc: "Built for Diani, Mombasa, Watamu, Kilifi & Lamu. Every listing is verified by the ZuruSasa team." },
  { icon: Wallet, title: "Pay in KES", desc: "Transparent pricing per person, per stay or per jump. M-Pesa, card and bank transfer supported." },
  { icon: MessageSquare, title: "Chat the host", desc: "Skip the back-and-forth on WhatsApp. Enquire and confirm — all inside the app." },
  { icon: Compass, title: "Discover daily", desc: "New activities are surfaced each day. Limited offers expire — so the feed always feels alive." },
];

export function Features() {
  return (
    <section id="discover" className="relative">
      <VideoBackdrop
        src={assetUrl(featuresBg.url)}
        overlayClassName="bg-background/70"
      />
      <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="max-w-2xl">
          <div className="text-sm uppercase tracking-[0.2em] text-primary mb-4">Why ZuruSasa</div>
          <h2 className="font-display text-4xl md:text-6xl leading-[1.05] text-balance">
            A coastline you can <span className="italic">scroll, save and book.</span>
          </h2>
        </div>
        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-3xl overflow-hidden border border-border">
          {features.map((f) => (
            <div key={f.title} className="bg-card/95 backdrop-blur p-8 group hover:bg-accent/60 transition-colors">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-2xl mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
