import {
  Sun,
  Cloud,
  CloudRain,
  CloudSun,
  Wind,
  Waves,
  Sunrise,
  Sunset,
  Droplets,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface WeatherData {
  temperature: number;
  humidity: number;
  condition: string;
  weatherCode: number;
  wind: { speed: number };
  sunrise: string;
  sunset: string;
  wave: { height: number };
  tides: { high: string; low: string };
}

interface WeatherWidgetProps {
  weather: WeatherData | null;
  loading: boolean;
  city: string;
}

const getWeatherIcon = (code: number) => {
  if (code === 0) return Sun;
  if (code <= 2) return CloudSun;
  if (code <= 3) return Cloud;
  if (code >= 51 && code <= 82) return CloudRain;
  return Cloud;
};

export function WeatherWidget({ weather, loading, city }: WeatherWidgetProps) {
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-4 space-y-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-12 w-20" />
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-4 text-center">
        <p className="text-muted-foreground">Weather unavailable</p>
      </div>
    );
  }

  const WeatherIcon = getWeatherIcon(weather.weatherCode);

  return (
    <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-2xl p-4 space-y-3">
      {/* Current conditions */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{city}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-display font-bold">{weather.temperature}°</span>
            <span className="text-sm text-muted-foreground">C</span>
          </div>
          <p className="text-sm">{weather.condition}</p>
        </div>
        <WeatherIcon className="h-12 w-12 text-primary" />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-background/50 rounded-xl p-2 text-center">
          <Wind className="h-4 w-4 mx-auto text-muted-foreground" />
          <p className="text-xs mt-1 font-medium">{weather.wind.speed} km/h</p>
          <p className="text-xs text-muted-foreground">Wind</p>
        </div>
        <div className="bg-background/50 rounded-xl p-2 text-center">
          <Droplets className="h-4 w-4 mx-auto text-muted-foreground" />
          <p className="text-xs mt-1 font-medium">{weather.humidity}%</p>
          <p className="text-xs text-muted-foreground">Humidity</p>
        </div>
        <div className="bg-background/50 rounded-xl p-2 text-center">
          <Waves className="h-4 w-4 mx-auto text-muted-foreground" />
          <p className="text-xs mt-1 font-medium">{weather.wave.height}m</p>
          <p className="text-xs text-muted-foreground">Waves</p>
        </div>
        <div className="bg-background/50 rounded-xl p-2 text-center">
          <Sunrise className="h-4 w-4 mx-auto text-muted-foreground" />
          <p className="text-xs mt-1 font-medium">{weather.sunrise}</p>
          <p className="text-xs text-muted-foreground">Sunrise</p>
        </div>
      </div>

      {/* Tides */}
      <div className="flex justify-between items-center bg-background/50 rounded-xl p-3">
        <div className="flex items-center gap-2">
          <Waves className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Tides</span>
        </div>
        <div className="flex gap-4 text-xs">
          <span>High: {weather.tides.high}</span>
          <span>Low: {weather.tides.low}</span>
        </div>
      </div>
    </div>
  );
}
