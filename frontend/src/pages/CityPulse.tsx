import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { MainLayout } from "@/components/layout/MainLayout";
import { CheckOutDialog } from "@/components/booking/CheckOutDialog";
import { WeatherWidget } from "@/components/city-pulse/WeatherWidget";
import { AIChatBox } from "@/components/city-pulse/AIChatBox";
import { AskZuruButton } from "@/components/city-pulse/AskZuruButton";
import { QuickListingCard } from "@/components/city-pulse/QuickListingCard";
import { useWeather } from "@/hooks/useWeather";
import { useReels, ReelData } from "@/hooks/useReels";
import { useCityPulseAI } from "@/hooks/useCityPulseAI";
import { useExperiences } from "@/hooks/useExperiences";
import { coastalCities } from "@/data/mockCityPulse";
import { ReelCard } from "@/components/reels/ReelCard";
import {
  MapPin,
  ChevronDown,
  Ship,
  UtensilsCrossed,
  Music,
  Bike,
  Calendar,
  Wine,
  ChefHat,
  Navigation,
  Check,
  Play,
  Sparkles as SparklesIcon,
  LayoutList,
  Clapperboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

const categories = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "boats", label: "Boats", icon: Ship },
  { id: "food", label: "Food", icon: UtensilsCrossed },
  { id: "nightlife", label: "Nightlife", icon: Music },
  { id: "bikes", label: "Bikes", icon: Bike },
  { id: "drinks", label: "Drinks", icon: Wine },
];

// ─── TikTok-style full-screen reel feed ────────────────────────────────────
function TikTokFeed({
  reels,
  loading,
  onBook,
}: {
  reels: ReelData[];
  loading: boolean;
  onBook: (id: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use IntersectionObserver to track which reel is in view
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-index"));
            setActiveIndex(idx);
          }
        });
      },
      {
        root: container,
        threshold: 0.6,
      }
    );

    const items = container.querySelectorAll(".tiktok-reel-item");
    items.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [reels]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 animate-pulse flex items-center justify-center">
            <Play className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm">Loading reels…</p>
        </div>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="h-12 w-12 opacity-20" />
          <p>No reels yet. Be the first to post!</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-y-scroll snap-y snap-mandatory"
      style={{ height: "100dvh", scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {reels.map((reel, i) => (
        <div
          key={reel.id}
          data-index={i}
          className="tiktok-reel-item w-full snap-start snap-always flex-shrink-0"
          style={{ height: "100dvh" }}
        >
          <ReelCard
            reel={reel}
            isActive={activeIndex === i}
            onBook={onBook}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Main CityPulse page ────────────────────────────────────────────────────
const CityPulse = () => {
  const [selectedCity, setSelectedCity] = useState("Mombasa");
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAI, setShowAI] = useState(false);
  const [bookingReel, setBookingReel] = useState<ReelData | null>(null);
  // "feed" = TikTok reel view | "explore" = normal listings view
  const [tab, setTab] = useState<"feed" | "explore">("feed");
  const { role, hasPass, viewMode } = useAuth();

  const weatherLocation = useMemo(() => {
    if (selectedCity === "Current Location" && coordinates) {
      return { city: "Current Location", ...coordinates };
    }
    return selectedCity;
  }, [selectedCity, coordinates]);

  const { weather, loading: weatherLoading } = useWeather(weatherLocation);
  const { messages, isLoading: aiLoading, sendMessage, clearMessages } = useCityPulseAI();
  const { experiences, loading: experiencesLoading } = useExperiences(selectedCategory, selectedCity);
  const { reels: liveReels, loading: reelsLoading } = useReels(selectedCategory);

  const handleUseLocation = useCallback((showToast = true) => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoordinates({ lat: position.coords.latitude, lon: position.coords.longitude });
          setSelectedCity("Current Location");
          if (showToast) toast.success("Location updated");
        },
        (error) => console.error("Error getting location:", error)
      );
    }
  }, []);

  useEffect(() => { handleUseLocation(false); }, [handleUseLocation]);

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setCoordinates(null);
  };

  const handleSendMessage = (message: string) => {
    sendMessage(message, selectedCity, { experiences, reels: liveReels });
  };

  const filteredBoats = experiences.filter((e) => e.category === "boats");
  const filteredFood = experiences.filter((e) => e.category === "food");
  const filteredNightlife = experiences.filter((e) => e.category === "nightlife");
  const filteredBikes = experiences.filter((e) => e.category === "bikes");
  const filteredDrinks = experiences.filter((e) => e.category === "drinks");
  const filteredActivities = experiences.filter(
    (e) => e.category === "activities" || (selectedCategory === "all" && e.category === "activities")
  );

  return (
    <MainLayout>
      {/* ── When in feed mode: completely full-screen, nothing else visible ── */}
      {tab === "feed" ? (
        <div className="fixed inset-0 z-30 bg-black">
          {/* Top bar overlaid on video */}
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pt-4 pb-2 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
            <div className="pointer-events-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 text-white text-sm font-semibold">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>{selectedCity}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleUseLocation(true)} className="gap-2 cursor-pointer">
                    <Navigation className="h-4 w-4 text-primary" />
                    <span>Use My Location</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {coastalCities.map((city) => (
                    <DropdownMenuItem key={city} onClick={() => handleCitySelect(city)}>
                      {city}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Tab switcher */}
            <div className="pointer-events-auto flex items-center bg-black/40 backdrop-blur-sm rounded-full p-1 gap-1">
              <button
                onClick={() => setTab("feed")}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary text-white"
              >
                <Clapperboard className="h-3.5 w-3.5" />
                Reels
              </button>
              <button
                onClick={() => setTab("explore")}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white/80 hover:text-white"
              >
                <LayoutList className="h-3.5 w-3.5" />
                Explore
              </button>
            </div>
          </div>

          {/* Full-screen reel feed — fills the whole fixed container */}
          <TikTokFeed
            reels={liveReels}
            loading={reelsLoading}
            onBook={(id) => setBookingReel(liveReels.find((r) => r.id === id) || null)}
          />
        </div>
      ) : (
        /* ── Explore (normal listings) mode ─────────────────────────────── */
        <div className="relative pb-20 md:pb-8 min-h-screen">
          {/* Sticky header */}
          <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-display font-semibold">Zuru Pulse</h1>
                  <p className="text-sm text-muted-foreground">What's happening today</p>
                </div>

                {/* Tab switcher */}
                <div className="flex items-center bg-muted rounded-full p-1 gap-1">
                  <button
                    onClick={() => setTab("feed")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <Clapperboard className="h-3.5 w-3.5" />
                    Reels
                  </button>
                  <button
                    onClick={() => setTab("explore")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-background shadow text-foreground"
                  >
                    <LayoutList className="h-3.5 w-3.5" />
                    Explore
                  </button>
                </div>
              </div>

              {/* City Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between rounded-xl">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>{selectedCity}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full min-w-[200px]">
                  <DropdownMenuItem onClick={() => handleUseLocation(true)} className="gap-2 cursor-pointer">
                    <Navigation className="h-4 w-4 text-primary" />
                    <span>Use My Location</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {coastalCities.map((city) => (
                    <DropdownMenuItem key={city} onClick={() => handleCitySelect(city)}>
                      {city}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Category Pills */}
              <div className="flex gap-2 overflow-x-auto hide-scrollbar py-1">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                        selectedCategory === cat.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Floating Ask Zuru Button */}
          {viewMode === "guest" && (
            <>
              <AskZuruButton onClick={() => setShowAI(true)} isOpen={showAI} />
              {showAI && (
                <AIChatBox
                  messages={messages}
                  isLoading={aiLoading}
                  onSendMessage={handleSendMessage}
                  onClose={() => { setShowAI(false); clearMessages(); }}
                  placeholder={`What should I do in ${selectedCity} today?`}
                />
              )}
            </>
          )}

          {/* Content */}
          <div className="p-4 space-y-6">
            <WeatherWidget weather={weather} loading={weatherLoading} city={selectedCity} />

            {/* Drinks of the Day */}
            {(selectedCategory === "all" || selectedCategory === "drinks") && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Wine className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-display font-semibold">Drinks of the Day</h2>
                </div>
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                  {filteredDrinks.map((drink) => (
                    <div key={drink.id} className="min-w-[160px] bg-card border border-border rounded-xl overflow-hidden">
                      <img src={drink.image_url || "/placeholder.svg"} alt={drink.title} className="h-24 w-full object-cover" />
                      <div className="p-2">
                        <p className="font-medium text-sm truncate">{drink.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{drink.entity_name}</p>
                        <div className="flex items-baseline gap-1 mt-1">
                          {drink.base_price && <span className="text-xs line-through text-muted-foreground">{drink.base_price}</span>}
                          <span className="text-sm font-semibold text-primary">KES {drink.current_price}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Today's Activities */}
            {selectedCategory === "all" && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-display font-semibold">Today's Activities</h2>
                </div>
                <div className="space-y-2">
                  {filteredActivities.slice(0, 3).map((activity) => (
                    <CheckOutDialog
                      key={activity.id}
                      experienceId={activity.id}
                      tripTitle={activity.title}
                      amount={activity.current_price}
                      trigger={
                        <div className="w-full">
                          <QuickListingCard
                            title={activity.title}
                            subtitle={`${activity.metadata?.time || ""} • ${activity.metadata?.duration || ""}`}
                            location={activity.location}
                            price={activity.current_price}
                            priceUnit="person"
                            imageUrl={activity.image_url || "/placeholder.svg"}
                            badge={activity.metadata?.type}
                            available={activity.metadata?.spots_left}
                          />
                        </div>
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Boat Rentals */}
            {(selectedCategory === "all" || selectedCategory === "boats") && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Ship className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-display font-semibold">Boat Rentals</h2>
                </div>
                <div className="space-y-2">
                  {filteredBoats.map((boat) => (
                    <CheckOutDialog key={boat.id} experienceId={boat.id} tripTitle={boat.title} amount={boat.current_price}
                      trigger={
                        <div className="w-full">
                          <QuickListingCard title={boat.title} subtitle={boat.metadata?.type || boat.entity_name}
                            location={boat.location} price={boat.current_price} priceUnit={boat.price_unit}
                            imageUrl={boat.image_url || "/placeholder.svg"} rating={boat.metadata?.rating}
                            available={boat.availability_status === "available"} />
                        </div>
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Restaurant Specials */}
            {(selectedCategory === "all" || selectedCategory === "food") && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-display font-semibold">Restaurant Specials</h2>
                </div>
                <div className="space-y-2">
                  {filteredFood.filter((f) => !f.metadata?.chef).map((rest) => (
                    <QuickListingCard key={rest.id} title={rest.title} subtitle={rest.entity_name}
                      location={rest.location} price={rest.current_price} originalPrice={rest.base_price || undefined}
                      imageUrl={rest.image_url || "/placeholder.svg"} badge={rest.metadata?.valid_until} />
                  ))}
                </div>
              </section>
            )}

            {/* Chef Specials */}
            {(selectedCategory === "all" || selectedCategory === "food") && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <ChefHat className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-display font-semibold">Chef's Specials</h2>
                </div>
                <div className="space-y-2">
                  {filteredFood.filter((f) => f.metadata?.chef).map((chef) => (
                    <QuickListingCard key={chef.id} title={chef.title}
                      subtitle={`by ${chef.metadata?.chef} at ${chef.entity_name}`}
                      location={chef.location} price={chef.current_price}
                      imageUrl={chef.image_url || "/placeholder.svg"} />
                  ))}
                </div>
              </section>
            )}

            {/* Nightlife */}
            {(selectedCategory === "all" || selectedCategory === "nightlife") && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Music className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-display font-semibold">Tonight's Events</h2>
                </div>
                <div className="space-y-2">
                  {filteredNightlife.map((club) => (
                    <QuickListingCard key={club.id} title={club.title}
                      subtitle={`${club.entity_name} • ${club.metadata?.time || ""}`}
                      location={club.location} price={club.current_price} priceUnit="entry"
                      imageUrl={club.image_url || "/placeholder.svg"} badge={club.metadata?.dj} />
                  ))}
                </div>
              </section>
            )}

            {/* Bike Rentals */}
            {(selectedCategory === "all" || selectedCategory === "bikes") && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Bike className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-display font-semibold">Bike Rentals</h2>
                </div>
                <div className="space-y-2">
                  {filteredBikes.map((bike) => (
                    <QuickListingCard key={bike.id} title={bike.metadata?.type || bike.title}
                      subtitle={bike.entity_name} location={bike.location} price={bike.current_price}
                      priceUnit="day" imageUrl={bike.image_url || "/placeholder.svg"}
                      available={bike.metadata?.available_count} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {/* Global Booking Dialog for Reels */}
      {bookingReel && (
        <CheckOutDialog
          experienceId={bookingReel.experienceId || bookingReel.id}
          tripTitle={bookingReel.title}
          amount={bookingReel.price}
          open={!!bookingReel}
          onOpenChange={(open) => !open && setBookingReel(null)}
          trigger={<></>}
        />
      )}
    </MainLayout>
  );
};

export default CityPulse;
