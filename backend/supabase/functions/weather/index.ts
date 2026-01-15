import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Coastal town coordinates
const cityCoordinates: Record<string, { lat: number; lon: number }> = {
  Mombasa: { lat: -4.0435, lon: 39.6682 },
  Diani: { lat: -4.2756, lon: 39.5833 },
  Lamu: { lat: -2.2717, lon: 40.9020 },
  Watamu: { lat: -3.3540, lon: 40.0249 },
  Malindi: { lat: -3.2138, lon: 40.1169 },
  Kilifi: { lat: -3.6305, lon: 39.8499 },
  Nyali: { lat: -4.0266, lon: 39.7131 },
  Bamburi: { lat: -3.9862, lon: 39.7278 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city } = await req.json();
    const coords = cityCoordinates[city] || cityCoordinates.Mombasa;

    // Using Open-Meteo (free, no API key required)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability&daily=sunrise,sunset&timezone=Africa%2FNairobi`;

    const weatherResponse = await fetch(weatherUrl);
    const weatherData = await weatherResponse.json();

    // Using Open-Meteo Marine API for tides/wave data
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${coords.lat}&longitude=${coords.lon}&current=wave_height,wave_direction,wave_period&hourly=wave_height&timezone=Africa%2FNairobi`;

    const marineResponse = await fetch(marineUrl);
    const marineData = await marineResponse.json();

    // Weather code to description mapping
    const weatherCodes: Record<number, string> = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Foggy",
      48: "Depositing rime fog",
      51: "Light drizzle",
      53: "Moderate drizzle",
      55: "Dense drizzle",
      61: "Slight rain",
      63: "Moderate rain",
      65: "Heavy rain",
      80: "Slight showers",
      81: "Moderate showers",
      82: "Violent showers",
      95: "Thunderstorm",
    };

    const current = weatherData.current;
    const marine = marineData.current || {};

    const response = {
      city,
      temperature: Math.round(current.temperature_2m),
      humidity: current.relative_humidity_2m,
      condition: weatherCodes[current.weather_code] || "Unknown",
      weatherCode: current.weather_code,
      wind: {
        speed: Math.round(current.wind_speed_10m),
        direction: current.wind_direction_10m,
      },
      sunrise: weatherData.daily?.sunrise?.[0]?.split("T")[1] || "06:00",
      sunset: weatherData.daily?.sunset?.[0]?.split("T")[1] || "18:00",
      wave: {
        height: marine.wave_height || 0.5,
        direction: marine.wave_direction || 90,
        period: marine.wave_period || 8,
      },
      // Simulated tide data (Open-Meteo doesn't have tide data)
      tides: {
        high: "10:30 AM",
        low: "4:45 PM",
        nextHigh: "10:58 PM",
      },
      hourlyForecast: weatherData.hourly?.temperature_2m?.slice(0, 12).map((temp: number, i: number) => ({
        hour: i,
        temp: Math.round(temp),
        rain: weatherData.hourly.precipitation_probability?.[i] || 0,
      })),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Weather API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
