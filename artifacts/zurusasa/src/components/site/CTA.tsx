import { assetUrl } from "@/lib/assetUrl";
import { Apple, Play } from "lucide-react";
import ctaBg from "@/assets/bg/cta.mp4.asset.json";
import { VideoBackdrop } from "./VideoBackdrop";

export function CTA() {
  return (
    <section id="download" className="mx-auto max-w-7xl px-6 pb-24 md:pb-32">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-primary text-primary-foreground p-10 md:p-20 text-center">
        <VideoBackdrop
          src={assetUrl(ctaBg.url)}
          overlayClassName="bg-primary/55 mix-blend-multiply"
        />
        <div className="relative">
          <h2 className="font-display text-5xl md:text-7xl leading-[1] text-balance">
            The coast is calling.
            <br /><span className="italic">Zuru Sasa.</span>
          </h2>
          <p className="mt-6 max-w-xl mx-auto opacity-90">
            Download the app and start scrolling Kenya's coastline — stays, tours, food and adventures, in one living feed.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <a href="#" className="inline-flex items-center gap-3 rounded-2xl bg-foreground text-background px-6 py-3.5">
              <Apple className="h-6 w-6" />
              <div className="text-left">
                <div className="text-[10px] opacity-70">Download on the</div>
                <div className="text-sm font-semibold -mt-0.5">App Store</div>
              </div>
            </a>
            <a href="#" className="inline-flex items-center gap-3 rounded-2xl bg-foreground text-background px-6 py-3.5">
              <Play className="h-6 w-6 fill-current" />
              <div className="text-left">
                <div className="text-[10px] opacity-70">Get it on</div>
                <div className="text-sm font-semibold -mt-0.5">Google Play</div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
