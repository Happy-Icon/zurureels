import { cn } from "@/lib/utils";

export type Category = "all" | "hotel" | "villa" | "boat" | "tour" | "event";

interface CategoryFilterProps {
  selected: Category;
  onChange: (category: Category) => void;
}

const categories: { value: Category; label: string; emoji: string }[] = [
  { value: "all", label: "All", emoji: "✨" },
  { value: "hotel", label: "Hotels", emoji: "🏨" },
  { value: "villa", label: "Villas", emoji: "🏡" },
  { value: "boat", label: "Boats", emoji: "⛵" },
  { value: "tour", label: "Tours", emoji: "🎒" },
  { value: "event", label: "Events", emoji: "🎉" },
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
          <span>{category.emoji}</span>
          <span>{category.label}</span>
        </button>
      ))}
    </div>
  );
}
