export function Footer() {
  const cols = [
    { title: "Explore", links: ["Diani", "Mombasa", "Watamu", "Lamu", "Kilifi"] },
    { title: "Product", links: ["ZuruFlow", "Zuru Agent", "Discover", "Saved", "Pricing"] },
    { title: "Hosts", links: ["Become a host", "Host dashboard", "Resources", "Support"] },
    { title: "Company", links: ["About", "Careers", "Press", "Contact"] },
  ];
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="mx-auto max-w-7xl px-6 py-16 grid md:grid-cols-6 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center">
            <img src="/logo.png" alt="ZuruSasa" className="h-12 md:h-14 w-auto object-contain" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground max-w-sm">
            The video-first marketplace for Kenya's coast. Built in Mombasa, made for the Indian Ocean.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="text-xs uppercase tracking-[0.2em] text-foreground font-medium mb-4">{c.title}</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {c.links.map((l) => <li key={l}><a href="#" className="hover:text-foreground">{l}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} ZuruSasa. All rights reserved.</div>
          <div className="flex gap-5"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Cookies</a></div>
        </div>
      </div>
    </footer>
  );
}
