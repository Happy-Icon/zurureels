import { Star } from "lucide-react";

const QUOTES = [
  { name: "Amina K.", role: "Nairobi → Diani", quote: "Booked a villa, a dhow cruise and a skydive — all from the same feed in one evening. ZuruSasa just gets the coast.", img: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop" },
  { name: "Brian O.", role: "Host · Watamu", quote: "I posted one reel of my beachfront cottage and got six bookings the next weekend. It's that immediate.", img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop" },
  { name: "Sofia M.", role: "Berlin → Lamu", quote: "Zuru Agent built my 9-day Lamu itinerary in 40 seconds. Every spot ended up being exactly the vibe I wanted.", img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop" },
];

export function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 md:py-32">
      <div className="max-w-2xl mb-14">
        <div className="text-sm uppercase tracking-[0.2em] text-primary mb-4">Loved on the coast</div>
        <h2 className="font-display text-4xl md:text-6xl leading-[1.05] text-balance">
          Travellers and hosts, <span className="italic">in their own words.</span>
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {QUOTES.map((q) => (
          <figure key={q.name} className="rounded-3xl border border-border bg-card p-7 flex flex-col gap-6">
            <div className="flex gap-1 text-primary">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
            </div>
            <blockquote className="font-display text-xl leading-snug text-balance">"{q.quote}"</blockquote>
            <figcaption className="flex items-center gap-3 mt-auto">
              <img src={q.img} alt="" className="h-10 w-10 rounded-full object-cover" />
              <div>
                <div className="text-sm font-medium">{q.name}</div>
                <div className="text-xs text-muted-foreground">{q.role}</div>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
