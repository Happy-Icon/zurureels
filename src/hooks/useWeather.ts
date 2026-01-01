import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WeatherData {
  city: string;
  temperature: number;
  humidity: number;
  condition: string;
  weatherCode: number;
  wind: {
    speed: number;
    direction: number;
  };
  sunrise: string;
  sunset: string;
  wave: {
    height: number;
    direction: number;
    period: number;
  };
  tides: {
    high: string;
    low: string;
    nextHigh: string;
  };
  hourlyForecast: Array<{
    hour: number;
    temp: number;
    rain: number;
  }>;
}

export function useWeather(city: string) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke("weather", {
          body: { city },
        });

        if (fnError) throw fnError;
        setWeather(data);
      } catch (err) {
        console.error("Weather fetch error:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch weather");
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [city]);

  return { weather, loading, error };
}
