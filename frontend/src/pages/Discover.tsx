import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useReels } from "@/hooks/useReels";
import { Search, MapPin, Sparkles, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AskZuruButton } from "@/components/city-pulse/AskZuruButton";
import { AIChatBox } from "@/components/city-pulse/AIChatBox";
import { useCityPulseAI } from "@/hooks/useCityPulseAI";
import { useExperiences } from "@/hooks/useExperiences";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";

const Discover = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showAI, setShowAI] = useState(false);

  const { reels: allReels, loading: reelsLoading } = useReels(selectedCategory, undefined, debouncedSearch);
  const { messages, isLoading: aiLoading, sendMessage, clearMessages } = useCityPulseAI();
  const { experiences } = useExperiences(selectedCategory, undefined, debouncedSearch);
  const { role } = useAuth();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSendMessage = (message: string) => {
    const context = {
      experiences: experiences,
      reels: allReels,
    };
    sendMessage(message, "Discover", context);
  };

  const handleCloseAI = () => {
    setShowAI(false);
    clearMessages();
  };

  const categoryColors: Record<string, string> = {
    hotel: "bg-blue-500/90",
    villa: "bg-emerald-500/90",
    apartment: "bg-purple-500/90",
    boats: "bg-cyan-500/90",
    food: "bg-orange-500/90",
  };

  const categories = [
    { id: "all", label: "All" },
    { id: "hotel", label: "Hotels" },
    { id: "villa", label: "Villas" },
    { id: "apartment", label: "Apartments" },
    { id: "boats", label: "Boats" },
    { id: "food", label: "Food" },
  ];

  return (
    <MainLayout>
      <div className="pb-20 md:pb-8">
        {/* Search Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search villas, hotels, locations..."
                className="pl-9 h-11 rounded-xl bg-secondary/50 border-none focus-visible:ring-primary"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2 overflow-x-auto hide-scrollbar">
            {categories.map((cat) => (
              <Badge
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "secondary"}
                className={cn(
                  "px-4 py-2 rounded-full cursor-pointer whitespace-nowrap text-sm font-medium transition-all",
                  selectedCategory === cat.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Results Grid */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {reelsLoading ? (
              Array(6).fill(0).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-2xl bg-muted animate-pulse" />
              ))
            ) : allReels.length > 0 ? (
              allReels.map((reel) => (
                <div
                  key={reel.id}
                  className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                >
                  <img
                    src={reel.thumbnailUrl || "/placeholder.svg"}
                    alt={reel.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-2">
                    <Badge className={cn("text-[10px] font-bold uppercase", categoryColors[reel.category] || "bg-primary")}>
                      {reel.category}
                    </Badge>
                    {reel.isLive && (
                      <Badge className="bg-red-500 text-white animate-pulse border-0 text-[10px]">
                        LIVE
                      </Badge>
                    )}
                  </div>

                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1">
                    <h3 className="font-semibold text-primary-foreground text-sm line-clamp-2 leading-tight">
                      {reel.title}
                    </h3>
                    <div className="flex items-center gap-1 text-[10px] text-primary-foreground/70">
                      <MapPin className="h-3 w-3" />
                      {reel.location}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm font-semibold text-primary-foreground">
                        KES {reel.price.toLocaleString()}
                        <span className="text-[10px] font-normal text-primary-foreground/70 ml-1">
                          /{reel.priceUnit}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground">
                <Sparkles className="h-12 w-12 mb-2 opacity-20" />
                <p>No experiences found. Try a different search or category.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ask Zuru AI - Guests Only */}
      {role !== 'host' && (
        <>
          <AskZuruButton onClick={() => setShowAI(true)} isOpen={showAI} />
          {showAI && (
            <AIChatBox
              messages={messages}
              isLoading={aiLoading}
              onSendMessage={handleSendMessage}
              onClose={handleCloseAI}
              placeholder="Ask Zuru about these listings..."
            />
          )}
        </>
      )}
    </MainLayout>
  );
};

export default Discover;
