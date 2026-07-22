import { assetUrl } from "@/lib/assetUrl";
import { ArrowRight, Check } from "lucide-react";
import hostsBg from "@/assets/bg/hosts.mp4.asset.json";
import { VideoBackdrop } from "./VideoBackdrop";

const PERKS = [
  "Upload a vertical reel — get discovered instantly",
  "Set your own price per person, per stay or per trip",
  "Direct enquiries & bookings — zero middlemen",
  "Reach travellers actively searching the Kenyan coast",
];

export function Hosts() {
  return (
    <section id="hosts" className="relative">
      <div className="mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-border bg-card p-8 md:p-16 grid lg:grid-cols-2 gap-12 items-center">
          <VideoBackdrop
            src={assetUrl(hostsBg.url)}
            overlayClassName="bg-gradient-to-r from-card/80 via-card/55 to-card/20"
          />
          <div className="relative">
            <div className="text-sm uppercase tracking-[0.2em] text-primary mb-4">For hosts & operators</div>
            <h2 className="font-display text-4xl md:text-5xl leading-[1.05] text-balance">
              Your villa, boat or kitchen — <span className="italic">starring in the feed.</span>
            </h2>
            <ul className="mt-8 space-y-3">
              {PERKS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <a href="#" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3.5 text-sm font-medium">
              Become a host <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="relative grid grid-cols-2 gap-4">
            <img src="https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&h=800&fit=crop" alt="" className="rounded-2xl aspect-[3/4] object-cover" />
            <img src="https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&h=800&fit=crop" alt="" className="rounded-2xl aspect-[3/4] object-cover mt-10" />
            <img src="https://images.unsplash.com/photo-1601001815853-3835274ddfee?w=600&h=800&fit=crop" alt="" className="rounded-2xl aspect-[3/4] object-cover -mt-6" />
            <img src="https://images.unsplash.com/photo-1540541338287-41700207dee6?w=600&h=800&fit=crop" alt="" className="rounded-2xl aspect-[3/4] object-cover" />
          </div>
        </div>
      </div>
    </section>
  );
}
