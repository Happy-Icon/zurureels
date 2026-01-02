import { useState } from "react";
import { Video, Check, ChevronRight, ChevronLeft, Clock, Home, Bed, Bath, Sofa, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface AccommodationReelFlowProps {
  category: "hotel" | "villa" | "apartment";
  onComplete: (data: AccommodationData) => void;
  onBack: () => void;
}

export interface AccommodationData {
  bedrooms: number;
  units: number;
  amenities: string[];
  reels: ReelRequirement[];
}

export interface ReelRequirement {
  id: string;
  title: string;
  description: string;
  maxDuration: number;
  icon: React.ReactNode;
  required: boolean;
  uploaded: boolean;
}

const amenitiesList = [
  { id: "pool", label: "Swimming Pool" },
  { id: "gym", label: "Gym / Fitness Center" },
  { id: "beachfront", label: "Beachfront" },
  { id: "beach_proximity", label: "Near Beach (Walking Distance)" },
  { id: "spa", label: "Spa & Wellness" },
  { id: "restaurant", label: "Restaurant" },
  { id: "bar", label: "Bar / Lounge" },
  { id: "wifi", label: "Free WiFi" },
  { id: "parking", label: "Parking" },
  { id: "ac", label: "Air Conditioning" },
  { id: "kitchen", label: "Kitchen" },
  { id: "laundry", label: "Laundry" },
  { id: "garden", label: "Garden" },
  { id: "bbq", label: "BBQ Area" },
  { id: "security", label: "24/7 Security" },
];

export const AccommodationReelFlow = ({ category, onComplete, onBack }: AccommodationReelFlowProps) => {
  const [step, setStep] = useState(1);
  const [bedrooms, setBedrooms] = useState<number>(1);
  const [units, setUnits] = useState<number>(1);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [uploadedReels, setUploadedReels] = useState<Set<string>>(new Set());

  const categoryLabel = category === "hotel" ? "Hotel" : category === "villa" ? "Villa" : "Apartment";

  const generateReelRequirements = (): ReelRequirement[] => {
    const reels: ReelRequirement[] = [
      {
        id: "establishment",
        title: "Establishment Reel",
        description: "Showcase the exterior, entrance, and overall property view",
        maxDuration: 20,
        icon: <Building className="h-5 w-5" />,
        required: true,
        uploaded: uploadedReels.has("establishment"),
      },
      {
        id: "living",
        title: "Living / Sitting Area",
        description: "Highlight the main living space, lounge, or common area",
        maxDuration: 20,
        icon: <Sofa className="h-5 w-5" />,
        required: true,
        uploaded: uploadedReels.has("living"),
      },
    ];

    // Add bedroom reels based on count
    for (let i = 1; i <= bedrooms; i++) {
      reels.push({
        id: `bedroom_${i}`,
        title: `Bedroom ${i}`,
        description: `Showcase bedroom ${i} - bed, storage, and room features`,
        maxDuration: 20,
        icon: <Bed className="h-5 w-5" />,
        required: true,
        uploaded: uploadedReels.has(`bedroom_${i}`),
      });
    }

    // Add bathroom reel
    reels.push({
      id: "bathroom",
      title: "Bathroom",
      description: "Show the bathroom facilities, fixtures, and amenities",
      maxDuration: 20,
      icon: <Bath className="h-5 w-5" />,
      required: true,
      uploaded: uploadedReels.has("bathroom"),
    });

    return reels;
  };

  const reelRequirements = generateReelRequirements();
  const totalReels = reelRequirements.length;
  const uploadedCount = uploadedReels.size;
  const allReelsUploaded = uploadedCount === totalReels;

  const handleAmenityToggle = (amenityId: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenityId)
        ? prev.filter((id) => id !== amenityId)
        : [...prev, amenityId]
    );
  };

  const handleReelUpload = (reelId: string) => {
    // Simulate reel upload - in production this would open camera
    setUploadedReels((prev) => new Set([...prev, reelId]));
  };

  const handleComplete = () => {
    onComplete({
      bedrooms,
      units,
      amenities: selectedAmenities,
      reels: reelRequirements,
    });
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                step >= s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 3 && (
              <div
                className={cn(
                  "w-12 h-0.5 mx-1",
                  step > s ? "bg-primary" : "bg-secondary"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Labels */}
      <div className="flex justify-center text-xs text-muted-foreground">
        <span className={cn("w-20 text-center", step === 1 && "text-primary font-medium")}>
          Property Info
        </span>
        <span className={cn("w-20 text-center", step === 2 && "text-primary font-medium")}>
          Amenities
        </span>
        <span className={cn("w-20 text-center", step === 3 && "text-primary font-medium")}>
          Record Reels
        </span>
      </div>

      {/* Step 1: Property Info */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 text-primary">
              <Home className="h-5 w-5" />
              <span className="font-medium">{categoryLabel} Details</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Number of Bedrooms</Label>
            <Select value={bedrooms.toString()} onValueChange={(v) => setBedrooms(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} {num === 1 ? "Bedroom" : "Bedrooms"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Number of Units Available</Label>
            <Select value={units.toString()} onValueChange={(v) => setUnits(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 100].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} {num === 1 ? "Unit" : "Units"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onBack} className="flex-1">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button onClick={() => setStep(2)} className="flex-1">
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Amenities */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
            <p className="text-sm text-muted-foreground">
              Select all amenities available at your {categoryLabel.toLowerCase()}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
            {amenitiesList.map((amenity) => (
              <label
                key={amenity.id}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                  selectedAmenities.includes(amenity.id)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <Checkbox
                  checked={selectedAmenities.includes(amenity.id)}
                  onCheckedChange={() => handleAmenityToggle(amenity.id)}
                />
                <span className="text-sm">{amenity.label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button onClick={() => setStep(3)} className="flex-1">
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Record Reels */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-400">Important Guidelines</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Each reel must not exceed <strong>20 seconds</strong>. Focus on capturing clear, 
                  well-lit footage that showcases the key features.
                </p>
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {uploadedCount} of {totalReels} reels recorded
          </div>

          <div className="space-y-2">
            {reelRequirements.map((reel, index) => (
              <div
                key={reel.id}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border transition-colors",
                  reel.uploaded
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-border bg-card"
                )}
              >
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center",
                    reel.uploaded
                      ? "bg-green-500/20 text-green-600"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {reel.uploaded ? <Check className="h-5 w-5" /> : reel.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{index + 1}. {reel.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      Max {reel.maxDuration}s
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{reel.description}</p>
                </div>
                <Button
                  size="sm"
                  variant={reel.uploaded ? "outline" : "default"}
                  onClick={() => handleReelUpload(reel.id)}
                  disabled={reel.uploaded}
                >
                  {reel.uploaded ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Done
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4 mr-1" />
                      Record
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              onClick={handleComplete}
              className="flex-1"
              disabled={!allReelsUploaded}
            >
              {allReelsUploaded ? "Complete Setup" : `Record All Reels (${uploadedCount}/${totalReels})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
