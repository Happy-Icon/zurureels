import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { MainLayout } from "@/components/layout/MainLayout";
import { CheckOutDialog } from "@/components/booking/CheckOutDialog"; // Import CheckOutDialog
import { WeatherWidget } from "@/components/city-pulse/WeatherWidget";
import { AIChatBox } from "@/components/city-pulse/AIChatBox";
import { AskZuruButton } from "@/components/city-pulse/AskZuruButton";
import { QuickListingCard } from "@/components/city-pulse/QuickListingCard";
import { useWeather } from "@/hooks/useWeather";
import { useReels } from "@/hooks/useReels";
import { useCityPulseAI } from "@/hooks/useCityPulseAI";
import { useExperiences } from "@/hooks/useExperiences";
import {
  coastalCities,
} from "@/data/mockCityPulse";
import { mockEvents } from "@/data/mockReels";
import { ReelCard, ReelData } from "@/components/reels/ReelCard";
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

const CityPulse = () => {
  const [selectedCity, setSelectedCity] = useState("Mombasa");
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAI, setShowAI] = useState(false);
  const [bookingReel, setBookingReel] = useState<ReelData | null>(null);
  const { role } = useAuth();

  // Determine the location to pass to useWeather
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
          setCoordinates({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          setSelectedCity("Current Location");
          if (showToast) {
            toast.success("Location updated");
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          // Don't toast error on auto-init to avoid spamming the user if they deny
        }
      );
    }
  }, []);

  // Auto-sync location on mount
  useEffect(() => {
    handleUseLocation(false);
  }, [handleUseLocation]);

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setCoordinates(null); // Reset coordinates when selecting a specific city
  };

  const handleSendMessage = (message: string) => {
    const context = {
      experiences: experiences,
      reels: liveReels,
      events: mockEvents,
    };
    sendMessage(message, selectedCity, context);
  };

  const handleCloseAI = () => {
    setShowAI(false);
    clearMessages();
  };

  const [activeReelId, setActiveReelId] = useState<string | null>(null);

  // Intersection Observer for Trending Reels
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveReelId(entry.target.getAttribute("data-reel-id"));
          }
        });
      },
      {
        threshold: 0.6, // Reel must be 60% visible to be considered active
        rootMargin: "0px",
      }
    );

    const reelElements = document.querySelectorAll(".reel-item");
    reelElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [liveReels]);

  const filteredBoats = experiences.filter((e) => e.category === "boats");
  const filteredFood = experiences.filter((e) => e.category === "food");
  const filteredNightlife = experiences.filter((e) => e.category === "nightlife");
  const filteredBikes = experiences.filter((e) => e.category === "bikes");
  const filteredDrinks = experiences.filter((e) => e.category === "drinks");
  const filteredActivities = experiences.filter((e) => e.category === "activities" || (selectedCategory === "all" && e.category === "activities"));

  return (
    <MainLayout>
      <div className="pb-20 md:pb-8">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-display font-semibold">Zuru Pulse</h1>
                <p className="text-sm text-muted-foreground">What's happening today</p>
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
                  <DropdownMenuItem
                    key={city}
                    onClick={() => handleCitySelect(city)}
                    className={cn(selectedCity === city && "bg-primary/10")}
                  >
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

        {/* Floating Ask Zuru Button & Chat */}
        {role !== 'host' && (
          <>
            <AskZuruButton onClick={() => setShowAI(true)} isOpen={showAI} />
            {showAI && (
              <AIChatBox
                messages={messages}
                isLoading={aiLoading}
                onSendMessage={handleSendMessage}
                onClose={handleCloseAI}
                placeholder={`What should I do in ${selectedCity} today?`}
              />
            )}
          </>
        )}

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Weather Widget */}
          <WeatherWidget weather={weather} loading={weatherLoading} city={selectedCity} />

          {/* Trending Reels */}
          {(selectedCategory === "all" || selectedCategory === "boats" || selectedCategory === "adventure") && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-lg font-display font-semibold">Trending Reels</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-4 px-4 snap-x">
                {reelsLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="min-w-[280px] h-[500px] rounded-2xl bg-muted animate-pulse" />
                  ))
                ) : liveReels.length > 0 ? (
                  liveReels.map((reel) => (
                    <div
                      key={reel.id}
                      data-reel-id={reel.id}
                      className="reel-item min-w-[280px] h-[500px] snap-center rounded-2xl overflow-hidden shadow-lg border border-border/50"
                    >
                      <ReelCard
                        reel={reel}
                        isActive={activeReelId === reel.id}
                        onBook={(id) => setBookingReel(liveReels.find(r => r.id === id) || null)}
                      />
                    </div>
                  ))
                ) : (
                  <div className="w-full py-12 flex flex-col items-center justify-center text-muted-foreground">
                    <Sparkles className="h-12 w-12 mb-2 opacity-20" />
                    <p>No live reels for this category yet.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Drinks of the Day */}
          {(selectedCategory === "all" || selectedCategory === "drinks") && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Wine className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-display font-semibold">Drinks of the Day</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                {filteredDrinks.map((drink) => (
                  <div
                    key={drink.id}
                    className="min-w-[160px] bg-card border border-border rounded-xl overflow-hidden"
                  >
                    <img
                      src={drink.image_url || "/placeholder.svg"}
                      alt={drink.title}
                      className="h-24 w-full object-cover"
                    />
                    <div className="p-2">
                      <p className="font-medium text-sm truncate">{drink.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{drink.entity_name}</p>
                      <div className="flex items-baseline gap-1 mt-1">
                        {drink.base_price && (
                          <span className="text-xs line-through text-muted-foreground">
                            {drink.base_price}
                          </span>
                        )}
                        <span className="text-sm font-semibold text-primary">
                          KES {drink.current_price}
                        </span>
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
                  <CheckOutDialog
                    key={boat.id}
                    experienceId={boat.id}
                    tripTitle={boat.title}
                    amount={boat.current_price}
                    trigger={
                      <div className="w-full">
                        <QuickListingCard
                          title={boat.title}
                          subtitle={boat.metadata?.type || boat.entity_name}
                          location={boat.location}
                          price={boat.current_price}
                          priceUnit={boat.price_unit}
                          imageUrl={boat.image_url || "/placeholder.svg"}
                          rating={boat.metadata?.rating}
                          available={boat.availability_status === "available"}
                        />
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
                {filteredFood.filter(f => !f.metadata?.chef).map((rest) => (
                  <QuickListingCard
                    key={rest.id}
                    title={rest.title}
                    subtitle={rest.entity_name}
                    location={rest.location}
                    price={rest.current_price}
                    originalPrice={rest.base_price || undefined}
                    imageUrl={rest.image_url || "/placeholder.svg"}
                    badge={rest.metadata?.valid_until}
                  />
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
                {filteredFood.filter(f => f.metadata?.chef).map((chef) => (
                  <QuickListingCard
                    key={chef.id}
                    title={chef.title}
                    subtitle={`by ${chef.metadata?.chef} at ${chef.entity_name}`}
                    location={chef.location}
                    price={chef.current_price}
                    imageUrl={chef.image_url || "/placeholder.svg"}
                  />
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
                  <QuickListingCard
                    key={club.id}
                    title={club.title}
                    subtitle={`${club.entity_name} • ${club.metadata?.time || ""}`}
                    location={club.location}
                    price={club.current_price}
                    priceUnit="entry"
                    imageUrl={club.image_url || "/placeholder.svg"}
                    badge={club.metadata?.dj}
                  />
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
                  <QuickListingCard
                    key={bike.id}
                    title={bike.metadata?.type || bike.title}
                    subtitle={bike.entity_name}
                    location={bike.location}
                    price={bike.current_price}
                    priceUnit="day"
                    imageUrl={bike.image_url || "/placeholder.svg"}
                    available={bike.metadata?.available_count}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Global Booking Dialog for Reels */}
      {
        bookingReel && (
          <CheckOutDialog
            experienceId={bookingReel.id}
            tripTitle={bookingReel.title}
            amount={bookingReel.price}
            open={!!bookingReel}
            onOpenChange={(open) => !open && setBookingReel(null)}
            trigger={<></>} // controlled mode doesn't need trigger but prop is required
          />
        )
      }
    </MainLayout >
  );
};

export default CityPulse;
