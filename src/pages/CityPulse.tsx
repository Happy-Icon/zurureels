import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { mockEvents } from "@/data/mockReels";
import { MapPin, ChevronDown, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const eventCategories = ["All", "Nightlife", "Food", "Culture", "Wellness", "Sports"];

const CityPulse = () => {
  const [selectedCity, setSelectedCity] = useState("New York");
  const [selectedCategory, setSelectedCategory] = useState("All");

  return (
    <MainLayout>
      <div className="pb-20 md:pb-8">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-display font-semibold">City Pulse</h1>
                <p className="text-sm text-muted-foreground">What's happening around you</p>
              </div>
            </div>

            {/* City Selector */}
            <Button variant="outline" className="w-full justify-between rounded-xl">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{selectedCity}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>

            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar py-1">
              {eventCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Featured Event */}
          <div>
            <h2 className="text-lg font-display font-semibold mb-3">Featured Tonight</h2>
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden">
              <img
                src={mockEvents[0].imageUrl}
                alt={mockEvents[0].title}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-overlay/90 via-overlay/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                  {mockEvents[0].category}
                </span>
                <h3 className="text-xl font-display font-semibold text-primary-foreground">
                  {mockEvents[0].title}
                </h3>
                <div className="flex items-center gap-4 text-sm text-primary-foreground/80">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {mockEvents[0].date}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {mockEvents[0].location}
                  </span>
                </div>
                <Button className="mt-2">Get Tickets</Button>
              </div>
            </div>
          </div>

          {/* Upcoming Events */}
          <div>
            <h2 className="text-lg font-display font-semibold mb-3">This Week</h2>
            <div className="space-y-3">
              {mockEvents.slice(1).map((event) => (
                <div
                  key={event.id}
                  className="flex gap-4 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-primary">{event.category}</span>
                    <h3 className="font-semibold truncate">{event.title}</h3>
                    <p className="text-sm text-muted-foreground">{event.date}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{event.location}</span>
                      <Users className="h-3 w-3 ml-2" />
                      <span>{event.attendees} going</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default CityPulse;
