import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { CategoryFilter, Category } from "@/components/ui/CategoryFilter";
import { mockReels } from "@/data/mockReels";
import { Search, MapPin, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AskZuruButton } from "@/components/city-pulse/AskZuruButton";
import { AIChatBox } from "@/components/city-pulse/AIChatBox";
import { useCityPulseAI } from "@/hooks/useCityPulseAI";

const Discover = () => {
  const [selectedCategory, setSelectedCategory] = useState<Category>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAI, setShowAI] = useState(false);
  const { messages, isLoading: aiLoading, sendMessage } = useCityPulseAI();

  const filteredReels = mockReels.filter((reel) => {
    const matchesCategory = selectedCategory === "all" || reel.category === selectedCategory;
    const matchesSearch = reel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reel.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categoryColors: Record<string, string> = {
    hotel: "bg-blue-500/90",
    villa: "bg-emerald-500/90",
    boat: "bg-cyan-500/90",
    tour: "bg-amber-500/90",
    event: "bg-purple-500/90",
    apartment: "bg-indigo-500/90",
    food: "bg-orange-500/90",
    drinks: "bg-pink-500/90",
    rentals: "bg-teal-500/90",
    adventure: "bg-red-500/90",
    camps: "bg-green-600/90",
  };

  return (
    <MainLayout>
      <div className="pb-20 md:pb-8">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-display font-semibold">Discover</h1>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search destinations, experiences..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary border-0"
              />
            </div>

            {/* Quick Filters */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-full">
                <MapPin className="h-4 w-4 mr-1" />
                Location
              </Button>
              <Button variant="outline" size="sm" className="rounded-full">
                <Calendar className="h-4 w-4 mr-1" />
                Dates
              </Button>
            </div>
          </div>

          {/* Category Filter */}
          <CategoryFilter selected={selectedCategory} onChange={setSelectedCategory} />
        </div>

        {/* Results Grid */}
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            {filteredReels.length} experiences found
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredReels.map((reel) => (
              <div
                key={reel.id}
                className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-muted cursor-pointer"
              >
                <img
                  src={reel.thumbnailUrl}
                  alt={reel.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-overlay/80 via-transparent to-transparent" />

                {/* Badge */}
                <Badge
                  className={cn(
                    "absolute top-3 left-3 text-xs capitalize",
                    categoryColors[reel.category]
                  )}
                >
                  {reel.category}
                </Badge>

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1">
                  <h3 className="font-semibold text-primary-foreground text-sm line-clamp-2">
                    {reel.title}
                  </h3>
                  <p className="text-xs text-primary-foreground/80">{reel.location}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-semibold text-primary-foreground">
                      ${reel.price}
                      <span className="text-xs font-normal text-primary-foreground/80">
                        /{reel.priceUnit}
                      </span>
                    </span>
                    <span className="text-xs text-primary-foreground">⭐ {reel.rating}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ask Zuru AI */}
      <AskZuruButton onClick={() => setShowAI(true)} isOpen={showAI} />
      {showAI && (
        <AIChatBox
          messages={messages}
          isLoading={aiLoading}
          onSendMessage={(msg) => sendMessage(msg, "Zanzibar", { category: selectedCategory })}
          onClose={() => setShowAI(false)}
          placeholder="Find the perfect experience..."
        />
      )}
    </MainLayout>
  );
};

export default Discover;
