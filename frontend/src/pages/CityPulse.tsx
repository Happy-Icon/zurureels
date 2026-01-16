import { useState, useMemo, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { CheckOutDialog } from "@/components/booking/CheckOutDialog"; // Import CheckOutDialog
import { WeatherWidget } from "@/components/city-pulse/WeatherWidget";
import { AIChatBox } from "@/components/city-pulse/AIChatBox";
import { AskZuruButton } from "@/components/city-pulse/AskZuruButton";
import { QuickListingCard } from "@/components/city-pulse/QuickListingCard";
import { useWeather } from "@/hooks/useWeather";
import { useCityPulseAI } from "@/hooks/useCityPulseAI";
import {
  mockBoatRentals,
  mockRestaurantSpecials,
  mockClubEvents,
  mockChefSpecials,
  mockBikeRentals,
  mockDailyActivities,
  mockDrinksOfTheDay,
  coastalCities,
} from "@/data/mockCityPulse";
import { mockEvents } from "@/data/mockReels";
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

  // Determine the location to pass to useWeather
  const weatherLocation = useMemo(() => {
    if (selectedCity === "Current Location" && coordinates) {
      return { city: "Current Location", ...coordinates };
    }
    return selectedCity;
  }, [selectedCity, coordinates]);

  const { weather, loading: weatherLoading } = useWeather(weatherLocation);
  const { messages, isLoading: aiLoading, sendMessage, clearMessages } = useCityPulseAI();

  const handleUseLocation = useCallback(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoordinates({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          setSelectedCity("Current Location");
          toast.success("Location updated");
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
    handleUseLocation();
  }, [handleUseLocation]);

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setCoordinates(null); // Reset coordinates when selecting a specific city
  };

  const handleSendMessage = (message: string) => {
    const context = {
      boats: mockBoatRentals.filter((b) => b.location.includes(selectedCity) || selectedCity === "Mombasa"),
      restaurants: mockRestaurantSpecials,
      clubs: mockClubEvents,
      chefs: mockChefSpecials,
      bikes: mockBikeRentals,
      activities: mockDailyActivities,
      drinks: mockDrinksOfTheDay,
      events: mockEvents,
    };
    sendMessage(message, selectedCity, context);
  };

  const handleCloseAI = () => {
    setShowAI(false);
    clearMessages();
  };

  const filteredBoats = mockBoatRentals.filter(
    (b) => selectedCategory === "all" || selectedCategory === "boats"
  );
  const filteredFood = [...mockRestaurantSpecials, ...mockChefSpecials].filter(
    () => selectedCategory === "all" || selectedCategory === "food"
  );
  const filteredNightlife = mockClubEvents.filter(
    () => selectedCategory === "all" || selectedCategory === "nightlife"
  );
  const filteredBikes = mockBikeRentals.filter(
    () => selectedCategory === "all" || selectedCategory === "bikes"
  );
  const filteredDrinks = mockDrinksOfTheDay.filter(
    () => selectedCategory === "all" || selectedCategory === "drinks"
  );

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
                <DropdownMenuItem onClick={handleUseLocation} className="gap-2 cursor-pointer">
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

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Weather Widget */}
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
                  <div
                    key={drink.id}
                    className="min-w-[160px] bg-card border border-border rounded-xl overflow-hidden"
                  >
                    <img
                      src={drink.imageUrl}
                      alt={drink.name}
                      className="h-24 w-full object-cover"
                    />
                    <div className="p-2">
                      <p className="font-medium text-sm truncate">{drink.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{drink.bar}</p>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xs line-through text-muted-foreground">
                          {drink.originalPrice}
                        </span>
                        <span className="text-sm font-semibold text-primary">
                          KES {drink.specialPrice}
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
                {mockDailyActivities.slice(0, 3).map((activity) => (
                  <CheckOutDialog
                    key={activity.id}
                    tripTitle={activity.name}
                    amount={activity.price}
                    trigger={
                      <div className="w-full">
                        <QuickListingCard
                          title={activity.name}
                          subtitle={`${activity.time} • ${activity.duration}`}
                          location={activity.location}
                          price={activity.price}
                          priceUnit="person"
                          imageUrl={activity.imageUrl}
                          badge={activity.type}
                          available={activity.spotsLeft}
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
                    tripTitle={boat.name}
                    amount={boat.price}
                    trigger={
                      <div className="w-full">
                        <QuickListingCard
                          title={boat.name}
                          subtitle={boat.type}
                          location={boat.location}
                          price={boat.price}
                          priceUnit={boat.priceUnit}
                          imageUrl={boat.imageUrl}
                          rating={boat.rating}
                          available={boat.available}
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
                {mockRestaurantSpecials.map((rest) => (
                  <QuickListingCard
                    key={rest.id}
                    title={rest.special}
                    subtitle={rest.restaurant}
                    location={rest.location}
                    price={rest.discountPrice}
                    originalPrice={rest.originalPrice}
                    imageUrl={rest.imageUrl}
                    badge={rest.validUntil}
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
                {mockChefSpecials.map((chef) => (
                  <QuickListingCard
                    key={chef.id}
                    title={chef.dish}
                    subtitle={`by ${chef.chef} at ${chef.restaurant}`}
                    location={chef.location}
                    price={chef.price}
                    imageUrl={chef.imageUrl}
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
                    title={club.event}
                    subtitle={`${club.venue} • ${club.time}`}
                    location={club.location}
                    price={club.entryFee}
                    priceUnit="entry"
                    imageUrl={club.imageUrl}
                    badge={club.dj}
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
                    title={bike.type}
                    subtitle={bike.provider}
                    location={bike.location}
                    price={bike.pricePerDay}
                    priceUnit="day"
                    imageUrl={bike.imageUrl}
                    available={bike.available}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default CityPulse;
