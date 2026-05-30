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
import { 
  coastalCities, 
  mockBoatRentals, 
  mockRestaurantSpecials, 
  mockClubEvents, 
  mockChefSpecials, 
  mockBikeRentals, 
  mockDailyActivities, 
  mockDrinksOfTheDay 
} from "@/data/mockCityPulse";
import { ReelCard } from "@/components/reels/ReelCard";
import { SkeletonLoader } from "@/components/reels/ReelsFeed";
import { DiscoverContent } from "@/components/city-pulse/DiscoverContent";
import { 
  Search, 
  MapPin, 
  ChevronDown, 
  Navigation, 
  Wine, 
  Utensils, 
  Music, 
  Waves, 
  Ship, 
  Palmtree, 
  Sparkles, 
  Filter, 
  SlidersHorizontal,
  UtensilsCrossed,
  Bike,
  Check,
  Play,
  ChefHat,
  Calendar
} from "lucide-react";
import { UnifiedSearch } from "@/components/UnifiedSearch";
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
  topOverlay,
}: {
  reels: ReelData[];
  loading: boolean;
  onBook: (id: string) => void;
  onInteraction?: () => void;
  topOverlay?: React.ReactNode;
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
        threshold: 0.5,
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
            preloadNext={activeIndex === i - 1}
            onBook={onBook}
            topOverlay={topOverlay}
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
  const { experiences: dbExperiences, loading: experiencesLoading } = useExperiences(selectedCategory, selectedCity);
  const { reels: liveReels, loading: reelsLoading } = useReels(selectedCategory);

  // Fallback to mock data if DB is empty for the city explorer
  const experiences = useMemo(() => {
    if (dbExperiences && dbExperiences.length > 0) return dbExperiences;
    
    // Convert mock data to Experience interface shape
    const mockData: any[] = [
      ...mockBoatRentals.map(b => ({ id: b.id, category: 'boats', title: b.name, entity_name: 'Rental', location: b.location, current_price: b.price, image_url: b.imageUrl, metadata: { rating: b.rating } })),
      ...mockRestaurantSpecials.map(r => ({ id: r.id, category: 'food', title: r.special, entity_name: r.restaurant, location: r.location, current_price: r.discountPrice, base_price: r.originalPrice, image_url: r.imageUrl, metadata: { valid_until: r.validUntil } })),
      ...mockClubEvents.map(c => ({ id: c.id, category: 'nightlife', title: c.event, entity_name: c.venue, location: c.location, current_price: c.entryFee, image_url: c.imageUrl, metadata: { time: c.time, dj: c.dj } })),
      ...mockChefSpecials.map(s => ({ id: s.id, category: 'food', title: s.dish, entity_name: s.restaurant, location: s.location, current_price: s.price, image_url: s.imageUrl, metadata: { chef: s.chef } })),
      ...mockBikeRentals.map(b => ({ id: b.id, category: 'bikes', title: b.type, entity_name: b.provider, location: b.location, current_price: b.pricePerDay, image_url: b.imageUrl, metadata: { available_count: b.available } })),
      ...mockDailyActivities.map(a => ({ id: a.id, category: 'activities', title: a.name, entity_name: 'Activity', location: a.location, current_price: a.price, image_url: a.imageUrl, metadata: { time: a.time, duration: a.duration, spots_left: a.spotsLeft, type: a.type } })),
      ...mockDrinksOfTheDay.map(d => ({ id: d.id, category: 'drinks', title: d.name, entity_name: d.bar, location: d.location, current_price: d.specialPrice, base_price: d.originalPrice, image_url: d.imageUrl }))
    ];

    const filtered = mockData.filter(item => 
      (selectedCategory === 'all' || item.category === selectedCategory) &&
      (selectedCity === 'Current Location' || item.location.toLowerCase().includes(selectedCity.toLowerCase()))
    );

    // If no results for city, show everything in that category across the coast
    if (filtered.length === 0) {
      return mockData.filter(item => selectedCategory === 'all' || item.category === selectedCategory);
    }
    
    return filtered;
  }, [dbExperiences, selectedCategory, selectedCity]);

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
    <MainLayout hideMobileUI={isMobile && (tab === "feed" || !showMobileUI)}>
      {tab === "feed" ? (
        <div className="fixed inset-0 z-30 bg-black md:pl-64 overflow-hidden">
          <TikTokFeed
            reels={liveReels}
            loading={reelsLoading}
            onBook={(id) => setBookingReel(liveReels.find((r) => r.id === id) || null)}
            onInteraction={handleInteraction}
            topOverlay={
              <div className="flex items-center justify-center w-full p-4 pt-[env(safe-area-inset-top,0.5rem)] md:pt-3">
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
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#EE7D30]" />
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
                    Discover
                    {tab === "explore" && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#EE7D30]" />
                    )}
                  </button>
                </div>
                
                {/* Floating Search in Immersive Feed - Mobile Only */}
                <div className="absolute top-0 right-4 h-full flex items-center pointer-events-auto md:hidden">
                  <UnifiedSearch variant="icon" />
                </div>
              </div>
            }
          />
        </div>
      ) : (
        <DiscoverContent
          showWeather={true}
          weather={weather}
          weatherLoading={weatherLoading}
          selectedCity={selectedCity}
          headerContent={
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
                  Discover
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
          }
        />
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
      {viewMode === "guest" && tab === "feed" && (
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
