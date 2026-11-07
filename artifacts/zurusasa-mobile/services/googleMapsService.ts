/**
 * Legacy compatibility wrapper delegating to zero-billing `mapService`.
 * Preserved so any legacy imports resolve cleanly without Google Cloud billing or Math.random().
 */

import {
  KENYA_AFRICA_TOWN_COORDS,
  lookupKnownTownCenter,
  mapService,
  type LatLng,
} from '@/services/mapService';

export type { LatLng };

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  durationText: string;
  distanceText: string;
  polylineCoords: LatLng[];
  trafficCondition: 'Light' | 'Moderate' | 'Heavy';
}

export const COASTAL_TOWN_COORDS: Record<string, LatLng> = Object.fromEntries(
  Object.entries(KENYA_AFRICA_TOWN_COORDS).map(([k, v]) => [
    k,
    { latitude: v.latitude, longitude: v.longitude },
  ]),
);

export const googleMapsService = {
  async geocodeLocation(locationName: string): Promise<LatLng> {
    const known = lookupKnownTownCenter(locationName);
    if (known.matched) return known.coords;

    const results = await mapService.searchPlaces(locationName, undefined, 1);
    if (results.length > 0) {
      return { latitude: results[0].latitude, longitude: results[0].longitude };
    }
    return known.coords;
  },

  async fetchRoute(origin: LatLng, destination: LatLng): Promise<RouteResult> {
    const route = await mapService.fetchRoadRoute(origin, destination);
    return {
      distanceKm: route.distanceKm,
      durationMin: route.durationMinutes,
      durationText: route.durationText,
      distanceText: route.distanceText,
      polylineCoords: route.coordinates,
      trafficCondition: 'Light',
    };
  },
};
