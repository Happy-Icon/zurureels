import { Star, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface QuickListingCardProps {
  title: string;
  subtitle: string;
  location: string;
  price: number;
  originalPrice?: number;
  priceUnit?: string;
  imageUrl: string;
  badge?: string;
  rating?: number;
  available?: boolean | number;
  onClick?: () => void;
}

export function QuickListingCard({
  title,
  subtitle,
  location,
  price,
  originalPrice,
  priceUnit,
  imageUrl,
  badge,
  rating,
  available,
  onClick
}: QuickListingCardProps) {
  return (
    <div
      onClick={onClick}
      className="flex gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer active:scale-95 duration-200"
    >
      <div className="relative h-20 w-20 flex-shrink-0">
        <img
          src={imageUrl}
          alt={title}
          className="h-full w-full rounded-lg object-cover"
        />
        {badge && (
          <Badge className="absolute -top-1 -right-1 text-xs px-1.5 py-0.5">
            {badge}
          </Badge>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-sm truncate">{title}</h3>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <MapPin className="h-3 w-3" />
          <span>{location}</span>
          {rating && (
            <>
              <Star className="h-3 w-3 ml-2 text-yellow-500 fill-current" />
              <span>{rating}</span>
            </>
          )}
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-baseline gap-1">
            {originalPrice && (
              <span className="text-xs text-muted-foreground line-through">
                KES {originalPrice.toLocaleString()}
              </span>
            )}
            <span className="text-sm font-semibold text-primary">
              KES {price.toLocaleString()}
            </span>
            {priceUnit && (
              <span className="text-xs text-muted-foreground">/{priceUnit}</span>
            )}
          </div>
          {available !== undefined && (
            <span className="text-xs text-muted-foreground">
              {typeof available === "boolean"
                ? available
                  ? "Available"
                  : "Booked"
                : `${available} left`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
