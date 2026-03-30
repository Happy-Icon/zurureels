import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useReels } from "@/hooks/useReels";
import { Search, MapPin, Sparkles, Filter, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AskZuruButton } from "@/components/city-pulse/AskZuruButton";
import { AIChatBox } from "@/components/city-pulse/AIChatBox";
import { useCityPulseAI } from "@/hooks/useCityPulseAI";
import { useExperiences } from "@/hooks/useExperiences";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";
import { ReelData } from "@/hooks/useReels";
import { BookingSheet } from "@/components/booking/BookingSheet";
import { ReelGridCard } from "@/components/reels/ReelGridCard";
import { ReelCard } from "@/components/reels/ReelCard";
import { useIsMobile } from "@/hooks/use-mobile";

const Discover = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showAI, setShowAI] = useState(false);
  const [bookingReel, setBookingReel] = useState<ReelData | null>(null);
  const [selectedReelIndex, setSelectedReelIndex] = useState<number | null>(null);
  const isMobile = useIsMobile();

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
    drinks: "bg-pink-500/90",
    rentals: "bg-teal-500/90",
    adventure: "bg-red-500/90",
    parks_camps: "bg-green-600/90",
    tours: "bg-amber-500/90",
    events: "bg-indigo-500/90",
  };

  // All categories matching hostConstants.ts
  const categories = [
    { id: "all", label: "All" },
    { id: "hotel", label: "Hotels" },
    { id: "villa", label: "Villas" },
    { id: "apartment", label: "Apartments" },
    { id: "boats", label: "Boats" },
    { id: "food", label: "Food" },
    { id: "drinks", label: "Drinks" },
    { id: "rentals", label: "Rentals" },
    { id: "adventure", label: "Adventure" },
    { id: "parks_camps", label: "Parks & Camps" },
    { id: "tours", label: "Tours" },
    { id: "events", label: "Events" },
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

          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {categories.map((cat) => (
              <Badge
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "secondary"}
                className={cn(
                  "px-4 py-2 rounded-full cursor-pointer whitespace-nowrap text-sm font-medium transition-all shrink-0",
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
          {/* Reels count */}
          {!reelsLoading && allReels.length > 0 && (
            <p className="text-sm text-muted-foreground mb-3">
              {allReels.length} reel{allReels.length !== 1 ? "s" : ""} found
              {selectedCategory !== "all" && ` in ${categories.find(c => c.id === selectedCategory)?.label || selectedCategory}`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {reelsLoading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-2xl bg-muted animate-pulse" />
              ))
            ) : allReels.length > 0 ? (
              (isMobile ? allReels.slice(0, 4) : allReels).map((reel, index) => (
                <ReelGridCard
                  key={reel.id}
                  reel={reel}
                  onBook={setBookingReel}
                  onSelect={() => setSelectedReelIndex(index)}
                />
              ))
            ) : (
              <div className="col-span-full py-16 flex flex-col items-center justify-center text-muted-foreground">
                <Sparkles className="h-12 w-12 mb-3 opacity-20" />
                <p className="font-medium">No reels found</p>
                <p className="text-sm mt-1">Try a different search or category</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Screen Reel View - Overlay */}
      {selectedReelIndex !== null && allReels[selectedReelIndex] && (
        <div className="fixed inset-0 z-[60] bg-black">
          {/* Back Button */}
          <button 
            onClick={() => setSelectedReelIndex(null)}
            className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 z-[70] p-2 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/10 active:scale-95 transition-transform"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          
          <div className="h-full w-full">
            <ReelCard 
              reel={allReels[selectedReelIndex]}
              isActive={true}
              onBook={(id) => setBookingReel(allReels.find(r => r.id === id) || null)}
            />
          </div>
        </div>
      )}

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

      {bookingReel && (
        <BookingSheet
          open={!!bookingReel}
          onOpenChange={(o) => { if (!o) { setBookingReel(null); } }}
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
    </MainLayout>
  );
};

export default Discover;
