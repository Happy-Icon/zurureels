import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { MainLayout } from "@/components/layout/MainLayout";
import { BookingSheet } from "@/components/booking/BookingSheet";
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
import { SkeletonLoader } from "@/components/reels/ReelsFeed";
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
import { useIsMobile } from "@/hooks/use-mobile";

const categories = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "boats", label: "Boats", icon: Ship },
  { id: "food", label: "Food", icon: UtensilsCrossed },
  { id: "nightlife", label: "Nightlife", icon: Music },
  { id: "bikes", label: "Bikes", icon: Bike },
  { id: "drinks", label: "Drinks", icon: Wine },
];

/**
 * TikTokFeed sub-component for full-screen immersive reel scrolling.
 */
function TikTokFeed({
  reels,
  loading,
  onBook,
  onInteraction,
}: {
  reels: ReelData[];
  loading: boolean;
  onBook: (id: string) => void;
  onInteraction?: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

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
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <SkeletonLoader />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-black text-white px-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 rounded-full bg-white/10 blur-[1px]">
            <Sparkles className="h-12 w-12 opacity-40 text-primary animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold">No coastal reels found</h3>
            <p className="text-sm text-white/50">Try choosing a different category or city!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full relative overflow-y-scroll snap-y snap-mandatory hide-scrollbar bg-black"
      style={{ height: "100dvh", scrollbarWidth: "none", msOverflowStyle: "none" }}
      onClick={onInteraction}
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

const CityPulse = () => {
  const [selectedCity, setSelectedCity] = useState("Mombasa");
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAI, setShowAI] = useState(false);
  const [bookingReel, setBookingReel] = useState<ReelData | null>(null);
  const [bookingExperience, setBookingExperience] = useState<any | null>(null);
  const [tab, setTab] = useState<"feed" | "explore">("feed");
  const { role, hasPass, viewMode } = useAuth();
  const isMobile = useIsMobile();
  const [showMobileUI, setShowMobileUI] = useState(true);
  const uiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInteraction = useCallback(() => {
    if (!isMobile || tab !== "feed") return;
    
    setShowMobileUI(true);
    if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    
    uiTimeoutRef.current = setTimeout(() => {
      setShowMobileUI(false);
    }, 4000);
  }, [isMobile, tab]);

  useEffect(() => {
    if (isMobile && tab === "feed") {
      handleInteraction();
    } else {
      setShowMobileUI(true);
    }
    return () => {
      if (uiTimeoutRef.current) clearTimeout(uiTimeoutRef.current);
    };
  }, [isMobile, tab, handleInteraction]);

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
    <MainLayout hideMobileUI={isMobile && tab === "feed" && !showMobileUI}>
      {tab === "feed" ? (
        <div className="fixed inset-0 z-30 bg-black md:pl-64 overflow-hidden">
          {/* Top bar overlaid on video */}
          <div className="absolute top-[env(safe-area-inset-top,0.5rem)] md:top-3 left-0 right-0 z-50 px-4 pb-4">
            <div className="flex items-center justify-center w-full">
              {/* Tab switcher - Centered words style */}
              <div className="pointer-events-auto flex items-center gap-8 px-6 py-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setTab("feed"); }}
                  className={cn(
                    "text-base font-extrabold transition-all duration-300 relative",
                    tab === "feed" 
                      ? "text-[#EE7D30] scale-110" 
                      : "text-white/70 hover:text-[#EE7D30]"
                  )}
                >
                  ZuruFlow
                  {tab === "feed" && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#EE7D30]" />
                  )}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setTab("explore"); }}
                  className={cn(
                    "text-base font-extrabold transition-all duration-300 relative",
                    tab === "explore" 
                      ? "text-[#EE7D30] scale-110" 
                      : "text-white/70 hover:text-[#EE7D30]"
                  )}
                >
                  Explore
                  {tab === "explore" && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#EE7D30]" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <TikTokFeed
            reels={liveReels}
            loading={reelsLoading}
            onBook={(id) => setBookingReel(liveReels.find((r) => r.id === id) || null)}
            onInteraction={handleInteraction}
          />
        </div>
      ) : (
        <div className="relative pb-20 md:pb-8 min-h-screen">
          <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border p-4 pt-[calc(0.25rem+env(safe-area-inset-top,0rem))] space-y-4">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 p-1 bg-secondary rounded-full border border-border">
                  <button
                    onClick={() => setTab("feed")}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-bold transition-all",
                      tab === "feed" ? "bg-[#EE7D30] text-white shadow-md" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    ZuruFlow
                  </button>
                  <button
                    onClick={() => setTab("explore")}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-sm font-bold transition-all",
                      tab === "explore" ? "bg-[#EE7D30] text-white shadow-md" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Explore
                  </button>
                </div>

                <div className="flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1.5 text-foreground text-sm font-semibold bg-secondary px-3 py-2 rounded-full max-w-[140px]">
                        <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="truncate">{selectedCity}</span>
                        <ChevronDown className="h-3.5 w-3.5 opacity-70 flex-shrink-0" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
              </div>

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
                          ? "bg-[#EE7D30] text-white"
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

            <div className="p-4 space-y-6">
              <WeatherWidget weather={weather} loading={weatherLoading} city={selectedCity} />

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

              {selectedCategory === "all" && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-display font-semibold">Today's Activities</h2>
                  </div>
                  <div className="space-y-2">
                    {filteredActivities.slice(0, 3).map((activity) => (
                      <div key={activity.id} className="w-full cursor-pointer" onClick={() => setBookingExperience(activity)}>
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
                    ))}
                  </div>
                </section>
              )}

              {(selectedCategory === "all" || selectedCategory === "boats") && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Ship className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-display font-semibold">Boat Rentals</h2>
                  </div>
                  <div className="space-y-2">
                    {filteredBoats.map((boat) => (
                      <div key={boat.id} className="w-full cursor-pointer" onClick={() => setBookingExperience(boat)}>
                        <QuickListingCard title={boat.title} subtitle={boat.metadata?.type || boat.entity_name}
                          location={boat.location} price={boat.current_price} priceUnit={boat.price_unit}
                          imageUrl={boat.image_url || "/placeholder.svg"} rating={boat.metadata?.rating}
                          available={boat.availability_status === "available"} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

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

      {bookingReel && (
        <BookingSheet
          open={!!bookingReel}
          onOpenChange={(o) => !o && setBookingReel(null)}
          experienceId={bookingReel.experienceId || bookingReel.id}
          reelId={bookingReel.id}
          hostId={bookingReel.hostUserId}
          title={bookingReel.title}
          location={bookingReel.location}
          price={bookingReel.price}
          priceUnit={bookingReel.priceUnit}
          rating={bookingReel.rating}
          imageUrl={bookingReel.thumbnailUrl}
          category={bookingReel.category}
          onSuccess={() => setBookingReel(null)}
        />
      )}

      {bookingExperience && (
        <BookingSheet
          open={!!bookingExperience}
          onOpenChange={(o) => !o && setBookingExperience(null)}
          experienceId={bookingExperience.id}
          hostId={bookingExperience.user_id}
          title={bookingExperience.title}
          location={bookingExperience.location}
          price={bookingExperience.current_price}
          priceUnit={bookingExperience.price_unit}
          imageUrl={bookingExperience.image_url}
          category={bookingExperience.category}
          onSuccess={() => setBookingExperience(null)}
        />
      )}
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
    </MainLayout>
  );
};

export default CityPulse;
