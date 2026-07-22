import { assetUrl } from "@/lib/assetUrl";
import destBg from "@/assets/bg/destinations.mp4.asset.json";
import { VideoBackdrop } from "./VideoBackdrop";

const DESTINATIONS = [
  { name: "Diani", tag: "White sand & kitesurf", img: "https://images.unsplash.com/photo-1589197331516-4d84b72ebde3?w=900&h=1200&fit=crop", count: "240+ stays" },
  { name: "Mombasa", tag: "Old town & spice routes", img: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=900&h=1200&fit=crop", count: "180+ stays" },
  { name: "Watamu", tag: "Marine park & turtles", img: "https://images.unsplash.com/photo-1559521783-1d1599583485?w=900&h=1200&fit=crop", count: "95+ stays" },
  { name: "Lamu", tag: "Dhows & swahili nights", img: "https://images.unsplash.com/photo-1535941339077-2dd1c7963098?w=900&h=1200&fit=crop", count: "60+ stays" },
];

export function Destinations() {
  return (
    <section id="destinations" className="relative">
      <VideoBackdrop
        src={assetUrl(destBg.url)}
        overlayClassName="bg-background/75"
      />
      <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
          <div className="max-w-2xl">
            <div className="text-sm uppercase tracking-[0.2em] text-primary mb-4">Destinations</div>
            <h2 className="font-display text-4xl md:text-6xl leading-[1.05] text-balance">
              From Lamu to Diani.
              <br /><span className="italic">All in one feed.</span>
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {DESTINATIONS.map((d) => (
            <a key={d.name} href="#" className="group relative overflow-hidden rounded-3xl bg-card border border-border">
              <div className="relative aspect-[3/4]">
                <img src={d.img} alt={d.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute inset-0 p-5 md:p-6 flex flex-col justify-end text-white">
                  <div className="text-[10px] uppercase tracking-[0.2em] opacity-80">{d.count}</div>
                  <h3 className="font-display text-3xl md:text-4xl mt-1">{d.name}</h3>
                  <p className="text-sm opacity-90">{d.tag}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
