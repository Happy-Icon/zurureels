import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Plus, Video, Image, MapPin, DollarSign, Upload, Eye, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AccommodationReelFlow, AccommodationData } from "@/components/host/AccommodationReelFlow";

type AccommodationType = "hotel" | "villa" | "apartment";

const categories = [
  { value: "hotel", label: "Hotels", isAccommodation: true },
  { value: "villa", label: "Villas", isAccommodation: true },
  { value: "apartment", label: "Apartments", isAccommodation: true },
  { value: "boat", label: "Boats", isAccommodation: false },
  { value: "food", label: "Food", isAccommodation: false },
  { value: "drinks", label: "Drinks", isAccommodation: false },
  { value: "rentals", label: "Rentals", isAccommodation: false },
  { value: "adventure", label: "Adventure", isAccommodation: false },
  { value: "camps", label: "Parks & Camps", isAccommodation: false },
  { value: "tour", label: "Tours", isAccommodation: false },
  { value: "event", label: "Events", isAccommodation: false },
];

const locations = [
  "Mombasa", "Diani", "Watamu", "Malindi", "Lamu", "Kilifi", "Nyali", "Bamburi"
];

const mockHostReels = [
  {
    id: "h1",
    title: "Beachfront Paradise Villa",
    location: "Diani Beach",
    category: "villa",
    price: 280,
    views: 1234,
    status: "published",
    thumbnail: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop",
  },
  {
    id: "h2",
    title: "Sunset Dhow Cruise",
    location: "Lamu Old Town",
    category: "boat",
    price: 150,
    views: 856,
    status: "published",
    thumbnail: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop",
  },
  {
    id: "h3",
    title: "Coral Reef Diving Tour",
    location: "Watamu",
    category: "tour",
    price: 95,
    views: 423,
    status: "draft",
    thumbnail: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&h=300&fit=crop",
  },
];

const Host = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"published" | "drafts">("published");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showAccommodationFlow, setShowAccommodationFlow] = useState(false);

  const publishedReels = mockHostReels.filter(r => r.status === "published");
  const draftReels = mockHostReels.filter(r => r.status === "draft");

  const isAccommodationCategory = (cat: string): cat is AccommodationType => {
    return ["hotel", "villa", "apartment"].includes(cat);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    if (isAccommodationCategory(value)) {
      setShowAccommodationFlow(true);
    } else {
      setShowAccommodationFlow(false);
    }
  };

  const handleAccommodationComplete = (data: AccommodationData) => {
    console.log("Accommodation data:", data);
    // In production, this would save the data and proceed to listing details
    setShowAccommodationFlow(false);
    setIsCreateOpen(false);
  };

  const handleDialogClose = (open: boolean) => {
    setIsCreateOpen(open);
    if (!open) {
      setSelectedCategory("");
      setShowAccommodationFlow(false);
    }
  };

  return (
    <MainLayout>
      <div className="pb-20 md:pb-8">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-display font-semibold">Host Dashboard</h1>
                <p className="text-sm text-muted-foreground">Manage your listings and reels</p>
              </div>
              <Dialog open={isCreateOpen} onOpenChange={handleDialogClose}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Reel</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="font-display">
                      {showAccommodationFlow 
                        ? `${selectedCategory === "hotel" ? "Hotel" : selectedCategory === "villa" ? "Villa" : "Apartment"} Setup`
                        : "Create New Reel"
                      }
                    </DialogTitle>
                  </DialogHeader>

                  {showAccommodationFlow && isAccommodationCategory(selectedCategory) ? (
                    <AccommodationReelFlow
                      category={selectedCategory}
                      onComplete={handleAccommodationComplete}
                      onBack={() => {
                        setShowAccommodationFlow(false);
                        setSelectedCategory("");
                      }}
                    />
                  ) : (
                    <form className="space-y-4 mt-4">
                      {/* Category Selection First */}
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent 
                            position="popper" 
                            side="bottom" 
                            align="center"
                            sideOffset={4}
                            className="max-h-60 overflow-y-auto"
                          >
                            {categories.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedCategory && isAccommodationCategory(selectedCategory) && (
                          <p className="text-xs text-muted-foreground">
                            You'll be guided through the accommodation reel setup
                          </p>
                        )}
                      </div>

                      {/* Only show rest of form for non-accommodation categories */}
                      {selectedCategory && !isAccommodationCategory(selectedCategory) && (
                        <>
                          {/* Upload Area */}
                          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                            <div className="flex flex-col items-center gap-2">
                              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <Video className="h-6 w-6 text-primary" />
                              </div>
                              <p className="font-medium">Record your reel</p>
                              <p className="text-sm text-muted-foreground">Max 20 seconds • Real-time only</p>
                              <Button type="button" variant="outline" size="sm" className="mt-2">
                                <Video className="h-4 w-4 mr-2" />
                                Start Recording
                              </Button>
                            </div>
                          </div>

                          {/* Thumbnail */}
                          <div className="space-y-2">
                            <Label>Thumbnail</Label>
                            <div className="flex gap-2">
                              <div className="h-20 w-32 rounded-lg bg-secondary flex items-center justify-center cursor-pointer hover:bg-secondary/80 transition-colors">
                                <Image className="h-6 w-6 text-muted-foreground" />
                              </div>
                              <p className="text-xs text-muted-foreground self-center">Auto-generated from video</p>
                            </div>
                          </div>

                          {/* Title */}
                          <div className="space-y-2">
                            <Label htmlFor="title">Title</Label>
                            <Input id="title" placeholder="e.g., Sunset Dhow Cruise" />
                          </div>

                          {/* Description */}
                          <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" placeholder="Describe your listing..." rows={3} />
                          </div>

                          {/* Location */}
                          <div className="space-y-2">
                            <Label>Location</Label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                              <SelectContent>
                                {locations.map((loc) => (
                                  <SelectItem key={loc} value={loc.toLowerCase()}>
                                    {loc}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Price */}
                          <div className="space-y-2">
                            <Label htmlFor="price">Price (KES)</Label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input id="price" type="number" placeholder="0" className="pl-10" />
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-3 pt-4">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => handleDialogClose(false)}>
                              Save as Draft
                            </Button>
                            <Button type="submit" className="flex-1">
                              Publish Reel
                            </Button>
                          </div>
                        </>
                      )}

                      {/* Prompt to select category */}
                      {!selectedCategory && (
                        <div className="py-8 text-center text-muted-foreground">
                          <Video className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>Select a category to get started</p>
                        </div>
                      )}
                    </form>
                  )}
                </DialogContent>
              </Dialog>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mt-4">
              <button
                onClick={() => setActiveTab("published")}
                className={cn(
                  "pb-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === "published"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Published ({publishedReels.length})
              </button>
              <button
                onClick={() => setActiveTab("drafts")}
                className={cn(
                  "pb-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === "drafts"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Drafts ({draftReels.length})
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <p className="text-2xl font-display font-semibold">3</p>
              <p className="text-xs text-muted-foreground">Total Reels</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <p className="text-2xl font-display font-semibold">2.5K</p>
              <p className="text-xs text-muted-foreground">Total Views</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <p className="text-2xl font-display font-semibold">12</p>
              <p className="text-xs text-muted-foreground">Bookings</p>
            </div>
          </div>

          {/* Reels List */}
          <div className="space-y-3">
            {(activeTab === "published" ? publishedReels : draftReels).map((reel) => (
              <div
                key={reel.id}
                className="flex gap-4 p-3 rounded-xl bg-card border border-border"
              >
                <img
                  src={reel.thumbnail}
                  alt={reel.title}
                  className="h-20 w-32 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold truncate">{reel.title}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{reel.location}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                      {reel.category}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Eye className="h-3 w-3" />
                      {reel.views}
                    </span>
                    <span className="font-medium text-foreground">
                      KES {reel.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(activeTab === "published" ? publishedReels : draftReels).length === 0 && (
            <div className="text-center py-12">
              <Video className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                No {activeTab === "drafts" ? "drafts" : "published reels"} yet
              </p>
              <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Reel
              </Button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Host;
