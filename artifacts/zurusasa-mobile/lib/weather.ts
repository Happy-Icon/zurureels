import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Mirrors the web app's useWeather hook — same Supabase edge function ("weather").

export interface WeatherData {
  city: string;
  temperature: number;
  humidity: number;
  condition: string;
  weatherCode: number;
  wind: { speed: number; direction: number };
  sunrise: string;
  sunset: string;
  wave: { height: number; direction: number; period: number };
  tides: { high: string; low: string; nextHigh: string };
}

export interface Coordinates {
  lat: number;
  lon: number;
}

export function useWeather(city: string, coords: Coordinates | null) {
  return useQuery<WeatherData | null>({
    queryKey: ['weather', city, coords?.lat ?? null, coords?.lon ?? null],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const body =
        city === 'Current Location' && coords
          ? { city, lat: coords.lat, lon: coords.lon }
          : { city };
      const { data, error } = await supabase.functions.invoke('weather', {
        body,
      });
      if (error) throw new Error(error.message);
      return (data as WeatherData) ?? null;
    },
  });
}
