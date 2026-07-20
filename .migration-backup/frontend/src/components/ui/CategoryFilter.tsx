import { cn } from "@/lib/utils";
import { 
  Sparkles, 
  Building, 
  Home, 
  Building2, 
  Ship, 
  Utensils, 
  GlassWater, 
  Bike, 
  Compass, 
  Tent, 
  Map, 
  PartyPopper,
  LucideIcon
} from "lucide-react";

export type Category =
  | "all"
  | "hotel"
  | "villa"
  | "boats"
  | "tours"
  | "events"
  | "apartment"
  | "food"
  | "drinks"
  | "rentals"
  | "adventure"
  | "parks_camps";

interface CategoryFilterProps {
  selected: Category;
  onChange: (category: Category) => void;
}

const categories: { value: Category; label: string; icon: LucideIcon }[] = [
  { value: "all", label: "All", icon: Sparkles },
  { value: "hotel", label: "Hotels", icon: Building },
  { value: "villa", label: "Villas", icon: Home },
  { value: "apartment", label: "Apartments", icon: Building2 },
  { value: "boats", label: "Boats", icon: Ship },
  { value: "food", label: "Food", icon: Utensils },
  { value: "drinks", label: "Drinks", icon: GlassWater },
  { value: "rentals", label: "Rentals", icon: Bike },
  { value: "adventure", label: "Adventure", icon: Compass },
  { value: "parks_camps", label: "Parks & Camps", icon: Tent },
  { value: "tours", label: "Tours", icon: Map },
  { value: "events", label: "Events", icon: PartyPopper },
];

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto hide-scrollbar py-2 px-4">
      {categories.map((category) => (
        <button
          key={category.value}
          onClick={() => onChange(category.value)}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all duration-200",
            selected === category.value
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          <category.icon className="h-4 w-4" />
          <span>{category.label}</span>
        </button>
      ))}
    </div>
  );
}
