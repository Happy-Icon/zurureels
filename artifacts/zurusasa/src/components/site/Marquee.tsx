export function Marquee() {
  const items = ["Diani", "Mombasa", "Watamu", "Lamu", "Kilifi", "Malindi", "Tiwi", "Shela", "Wasini"];
  const row = [...items, ...items, ...items];
  return (
    <div className="border-y border-border/60 bg-card/40 py-5 overflow-hidden">
      <div className="flex gap-12 whitespace-nowrap animate-marquee">
        {row.map((t, i) => (
          <span key={i} className="font-display text-2xl md:text-3xl text-muted-foreground/70">
            {t} <span className="text-primary">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
