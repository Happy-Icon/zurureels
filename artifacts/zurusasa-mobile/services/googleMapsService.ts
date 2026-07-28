/**
 * Google Maps Platform Integration Service
 * Handles Geocoding, Directions/Routes API, Polyline decoding, and distance calculations.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  durationText: string;
  distanceText: string;
  polylineCoords: LatLng[];
  trafficCondition: 'Light' | 'Moderate' | 'Heavy';
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/**
 * Known coastal Kenya fallback coordinates for key towns
 */
export const COASTAL_TOWN_COORDS: Record<string, LatLng> = {
  mombasa: { latitude: -4.0435, longitude: 39.6682 },
  diani: { latitude: -4.2797, longitude: 39.5947 },
  diani_beach: { latitude: -4.2797, longitude: 39.5947 },
  watamu: { latitude: -3.3542, longitude: 40.0305 },
  malindi: { latitude: -3.2176, longitude: 40.1169 },
  lamu: { latitude: -2.2717, longitude: 40.902 },
  kilifi: { latitude: -3.6307, longitude: 39.8499 },
  kwale: { latitude: -4.1737, longitude: 39.4521 },
  nyali: { latitude: -4.0324, longitude: 39.6897 },
  bamburi: { latitude: -4.0044, longitude: 39.7153 },
  tiwi: { latitude: -4.2384, longitude: 39.5855 },
  shanzu: { latitude: -3.9723, longitude: 39.7369 },
};

/**
 * Decodes Google Polyline string into array of LatLng
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}

export const googleMapsService = {
  /**
   * Geocodes a text location string to LatLng using Google Geocoding API
   */
  async geocodeLocation(locationName: string): Promise<LatLng> {
    const cleanKey = locationName.toLowerCase().replace(/[^a-z_]/g, '');
    for (const [k, coords] of Object.entries(COASTAL_TOWN_COORDS)) {
      if (cleanKey.includes(k)) return coords;
    }

    if (GOOGLE_MAPS_API_KEY) {
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            locationName + ', Kenya',
          )}&key=${GOOGLE_MAPS_API_KEY}`,
        );
        const data = await res.json();
        if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
          const loc = data.results[0].geometry.location;
          return { latitude: loc.lat, longitude: loc.lng };
        }
      } catch {
        // Fallback
      }
    }

    return COASTAL_TOWN_COORDS.mombasa;
  },

  /**
   * Fetches real directions route from Google Directions API
   */
  async fetchRoute(origin: LatLng, destination: LatLng): Promise<RouteResult> {
    if (GOOGLE_MAPS_API_KEY) {
      try {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&departure_time=now&key=${GOOGLE_MAPS_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status === 'OK' && data.routes?.[0]?.legs?.[0]) {
          const leg = data.routes[0].legs[0];
          const overviewPolyline = data.routes[0].overview_polyline?.points;
          const polylineCoords = overviewPolyline ? decodePolyline(overviewPolyline) : [origin, destination];

          const distMeters = leg.distance?.value ?? 35000;
          const durationSec = leg.duration_in_traffic?.value ?? leg.duration?.value ?? 2500;

          const distanceKm = Math.round((distMeters / 1000) * 10) / 10;
          const durationMin = Math.round(durationSec / 60);

          let traffic: 'Light' | 'Moderate' | 'Heavy' = 'Light';
          if (leg.duration_in_traffic && leg.duration) {
            const ratio = leg.duration_in_traffic.value / leg.duration.value;
            if (ratio > 1.3) traffic = 'Heavy';
            else if (ratio > 1.1) traffic = 'Moderate';
          }

          return {
            distanceKm,
            durationMin,
            distanceText: leg.distance?.text ?? `${distanceKm} km`,
            durationText: leg.duration?.text ?? `${durationMin} mins`,
            polylineCoords,
            trafficCondition: traffic,
          };
        }
      } catch {
        // Fallback to straight line polyline
      }
    }

    // Straight-line distance calculation fallback
    const R = 6371;
    const dLat = ((destination.latitude - origin.latitude) * Math.PI) / 180;
    const dLon = ((destination.longitude - origin.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((origin.latitude * Math.PI) / 180) *
        Math.cos((destination.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = Math.round(R * c * 10) / 10;
    const durationMin = Math.round(distanceKm * 1.5);

    return {
      distanceKm: distanceKm || 32,
      durationMin: durationMin || 40,
      distanceText: `${distanceKm || 32} km`,
      durationText: `${durationMin || 40} mins`,
      polylineCoords: [origin, destination],
      trafficCondition: 'Light',
    };
  },
};
