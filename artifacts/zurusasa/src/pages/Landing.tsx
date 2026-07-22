import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { Features } from "@/components/site/Features";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Destinations } from "@/components/site/Destinations";
import { Hosts } from "@/components/site/Hosts";
import { AppInAction } from "@/components/site/AppInAction";
import { CTA } from "@/components/site/CTA";
import { Footer } from "@/components/site/Footer";

export function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Destinations />
        <Hosts />
        <AppInAction />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

export default Landing;
