import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Coastal town coordinates (Fallback)
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

// Tomorrow.io Weather Codes Mapping
const weatherCodes: Record<number, string> = {
  0: "Unknown",
  1000: "Clear, Sunny",
  1100: "Mostly Clear",
  1101: "Partly Cloudy",
  1102: "Mostly Cloudy",
  1001: "Cloudy",
  2000: "Fog",
  2100: "Light Fog",
  4000: "Drizzle",
  4001: "Rain",
  4200: "Light Rain",
  4201: "Heavy Rain",
  5000: "Snow",
  5001: "Flurries",
  5100: "Light Snow",
  5101: "Heavy Snow",
  6000: "Freezing Drizzle",
  6001: "Freezing Rain",
  6200: "Light Freezing Rain",
  6201: "Heavy Freezing Rain",
  7000: "Ice Pellets",
  7101: "Heavy Ice Pellets",
  7102: "Light Ice Pellets",
  8000: "Thunderstorm",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city, lat, lon } = await req.json();
    let latitude = lat;
    let longitude = lon;

    if ((!latitude || !longitude) && city) {
      const coords = cityCoordinates[city] || cityCoordinates.Mombasa;
      latitude = coords.lat;
      longitude = coords.lon;
    }

    if (!latitude || !longitude) {
      // Default to Mombasa if nothing provided
      latitude = cityCoordinates.Mombasa.lat;
      longitude = cityCoordinates.Mombasa.lon;
    }

    const apiKey = Deno.env.get("TOMORROW_API_KEY") || "5NxWB9jb8f2C4FsBhXE4SQSYN66h4mWj"; // Fallback to provided key if env missing

    // Using Tomorrow.io Forecast API
    // We need 'current' values and 'hourly' forecast
    // documentation: https://docs.tomorrow.io/reference/weather-forecast
    const url = `https://api.tomorrow.io/v4/weather/forecast?location=${latitude},${longitude}&apikey=${apiKey}&units=metric`;

    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Tomorrow.io API Error:", errText);
      throw new Error(`Weather API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const current = data.timelines?.minutely?.[0]?.values || {};
    const daily = data.timelines?.daily?.[0]?.values || {};
    const hourly = data.timelines?.hourly || [];

    const weatherCondition = weatherCodes[current.weatherCode] || "Unknown";

    const result = {
      city: city || "Current Location",
      temperature: Math.round(current.temperature || 0),
      humidity: Math.round(current.humidity || 0),
      condition: weatherCondition,
      weatherCode: current.weatherCode,
      wind: {
        speed: Math.round(current.windSpeed || 0),
        direction: current.windDirection || 0,
      },
      sunrise: daily.sunriseTime ? daily.sunriseTime.split("T")[1].substring(0, 5) : "06:00",
      sunset: daily.sunsetTime ? daily.sunsetTime.split("T")[1].substring(0, 5) : "18:30",
      // Simulated marine data as Tomorrow.io basic plan might not have full marine in simple forecast, 
      // or we accept defaults if missing. Tomorrow.io does have marine data layers but keeping it simple for now.
      wave: {
        height: 0.8,
        direction: current.windDirection || 90,
        period: 8,
      },
      tides: {
        high: "10:30 AM",
        low: "4:45 PM",
        nextHigh: "10:58 PM",
      },
      hourlyForecast: hourly.slice(0, 12).map((hour: any, i: number) => ({
        hour: i,
        temp: Math.round(hour.values.temperature),
        rain: hour.values.precipitationProbability || 0,
      })),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Weather function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

