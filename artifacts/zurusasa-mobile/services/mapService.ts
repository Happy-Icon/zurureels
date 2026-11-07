import { Linking, Platform } from 'react-native';
import { enrichReelHosts } from '@/lib/queries/reels';
import {
  supabase,
  type ExperienceRow,
  type LocationPrecision,
  type ReelRow,
} from '@/lib/supabase';
import { expandCategoryAliases, type SearchFilters } from '@/services/filterService';

export type { LocationPrecision };

export interface GeoJsonPolygonFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][];
  };
}

export interface GeoJsonLineFeature {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface MapBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface PlaceSuggestion {
  id: string;
  name: string;
  formattedAddress: string;
  city: string;
  region: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}

export interface RoadRouteResult {
  distanceKm: number;
  distanceText: string;
  durationMinutes: number;
  durationText: string;
  coordinates: LatLng[];
  source: 'osrm' | 'geodesic';
}

export interface ResolvedListingLocation {
  /** Exact or deterministic ~380m privacy-offset coordinate when pinned; null when city_only */
  latitude: number | null;
  longitude: number | null;
  /** City/town center fallback for camera framing or town-summary grouping */
  townCenter: LatLng;
  precision: LocationPrecision;
  hasPin: boolean;
  city: string;
  formattedAddress: string;
  countryCode: string;
}

export interface ConfirmedBookingCoordinates {
  booking_id: string;
  experience_id: string;
  title: string | null;
  location: string | null;
  city: string | null;
  formatted_address: string | null;
  location_precision: LocationPrecision;
  latitude: number | null;
  longitude: number | null;
  directions_note: string | null;
}

export const MAP_STYLE_LIGHT_URL =
  (process.env.EXPO_PUBLIC_MAP_STYLE_LIGHT_URL ?? '').trim() ||
  'https://tiles.openfreemap.org/styles/liberty';

export const MAP_STYLE_DARK_URL =
  (process.env.EXPO_PUBLIC_MAP_STYLE_DARK_URL ?? '').trim() ||
  'https://tiles.openfreemap.org/styles/dark';

/**
 * Verified city/region centroids across Kenya & East Africa.
 * Used ONLY for camera framing and honest town-level summary badges — NEVER jittered with Math.random().
 */
export const KENYA_AFRICA_TOWN_COORDS: Record<string, LatLng & { label: string }> = {
  diani: { latitude: -4.2797, longitude: 39.5947, label: 'Diani Beach' },
  diani_beach: { latitude: -4.2797, longitude: 39.5947, label: 'Diani Beach' },
  ukunda: { latitude: -4.2875, longitude: 39.5663, label: 'Ukunda' },
  tiwi: { latitude: -4.2384, longitude: 39.5855, label: 'Tiwi' },
  kwale: { latitude: -4.1737, longitude: 39.4521, label: 'Kwale' },
  mombasa: { latitude: -4.0435, longitude: 39.6682, label: 'Mombasa' },
  nyali: { latitude: -4.0324, longitude: 39.6897, label: 'Nyali' },
  bamburi: { latitude: -4.0044, longitude: 39.7153, label: 'Bamburi' },
  shanzu: { latitude: -3.9723, longitude: 39.7369, label: 'Shanzu' },
  mtwapa: { latitude: -3.9506, longitude: 39.7448, label: 'Mtwapa' },
  kilifi: { latitude: -3.6307, longitude: 39.8499, label: 'Kilifi' },
  watamu: { latitude: -3.3542, longitude: 40.0305, label: 'Watamu' },
  malindi: { latitude: -3.2176, longitude: 40.1169, label: 'Malindi' },
  lamu: { latitude: -2.2717, longitude: 40.902, label: 'Lamu' },
  nairobi: { latitude: -1.2864, longitude: 36.8172, label: 'Nairobi' },
  westlands: { latitude: -1.2648, longitude: 36.8049, label: 'Westlands, Nairobi' },
  karen: { latitude: -1.3191, longitude: 36.7065, label: 'Karen, Nairobi' },
  kilimani: { latitude: -1.2921, longitude: 36.7879, label: 'Kilimani, Nairobi' },
  naivasha: { latitude: -0.7172, longitude: 36.431, label: 'Naivasha' },
  nakuru: { latitude: -0.3031, longitude: 36.08, label: 'Nakuru' },
  nanyuki: { latitude: 0.0167, longitude: 37.0728, label: 'Nanyuki' },
  maasai_mara: { latitude: -1.49, longitude: 35.1439, label: 'Maasai Mara' },
  amboseli: { latitude: -2.6527, longitude: 37.2606, label: 'Amboseli' },
  tsavo: { latitude: -3.3975, longitude: 38.5561, label: 'Tsavo' },
  kisumu: { latitude: -0.0917, longitude: 34.768, label: 'Kisumu' },
  eldoret: { latitude: 0.5143, longitude: 35.2698, label: 'Eldoret' },
  zanzibar: { latitude: -6.1659, longitude: 39.2026, label: 'Zanzibar' },
  arusha: { latitude: -3.3869, longitude: 36.683, label: 'Arusha' },
  dar_es_salaam: { latitude: -6.7924, longitude: 39.2083, label: 'Dar es Salaam' },
  kampala: { latitude: 0.3476, longitude: 32.5825, label: 'Kampala' },
  kigali: { latitude: -1.9441, longitude: 30.0619, label: 'Kigali' },
};

export const DEFAULT_KENYA_COAST_CENTER: LatLng = {
  latitude: -4.16,
  longitude: 39.63,
};

function toFiniteCoord(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

export function lookupKnownTownCenter(rawLocation?: string | null): {
  coords: LatLng;
  label: string;
  matched: boolean;
} {
  const cleaned = String(rawLocation ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (cleaned && KENYA_AFRICA_TOWN_COORDS[cleaned]) {
    const entry = KENYA_AFRICA_TOWN_COORDS[cleaned];
    return { coords: { latitude: entry.latitude, longitude: entry.longitude }, label: entry.label, matched: true };
  }

  for (const [key, entry] of Object.entries(KENYA_AFRICA_TOWN_COORDS)) {
    if (cleaned.includes(key)) {
      return { coords: { latitude: entry.latitude, longitude: entry.longitude }, label: entry.label, matched: true };
    }
  }

  const fallbackLabel = String(rawLocation ?? '')
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    coords: DEFAULT_KENYA_COAST_CENTER,
    label: fallbackLabel || 'Kenya',
    matched: false,
  };
}

/**
 * Resolves listing coordinates from first-class columns OR mirrored metadata JSONB.
 * Never fabricates random coordinates: if unpinned, `hasPin` is false and `precision` is `'city_only'`.
 */
export function resolveExperienceCoords(
  experience?: Partial<ExperienceRow> | null,
  reelFallback?: { lat?: number | null; lng?: number | null } | null,
): ResolvedListingLocation {
  const meta = (experience?.metadata ?? {}) as Record<string, unknown>;

  const lat =
    toFiniteCoord(experience?.display_latitude) ??
    toFiniteCoord(meta.display_latitude) ??
    toFiniteCoord(reelFallback?.lat);

  const lng =
    toFiniteCoord(experience?.display_longitude) ??
    toFiniteCoord(meta.display_longitude) ??
    toFiniteCoord(reelFallback?.lng);

  const rawPrecision = String(
    experience?.location_precision ?? meta.location_precision ?? '',
  ).toLowerCase();

  const validPin =
    lat !== null &&
    lng !== null &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0);

  const precision: LocationPrecision = !validPin
    ? 'city_only'
    : rawPrecision === 'approximate'
      ? 'approximate'
      : 'exact';

  const rawCity = String(
    experience?.city ?? meta.city ?? experience?.location ?? '',
  ).trim();
  const townLookup = lookupKnownTownCenter(rawCity || experience?.location);

  const city =
    rawCity && !rawCity.includes('_')
      ? rawCity.replace(/\b\w/g, (c) => c.toUpperCase())
      : townLookup.label;

  const formattedAddress =
    String(experience?.formatted_address ?? meta.formatted_address ?? '').trim() ||
    `${city}, Kenya`;

  const countryCode = String(
    experience?.country_code ?? meta.country_code ?? 'KE',
  ).toUpperCase();

  return {
    latitude: validPin ? lat : null,
    longitude: validPin ? lng : null,
    townCenter: validPin ? { latitude: lat!, longitude: lng! } : townLookup.coords,
    precision,
    hasPin: validPin,
    city,
    formattedAddress,
    countryCode,
  };
}

/**
 * Builds a GeoJSON Polygon approximating a geodesic circle (e.g., ~450m privacy halo).
 */
export function createGeoJSONCircle(
  center: LatLng,
  radiusMeters = 450,
  points = 64,
): GeoJsonPolygonFeature {
  const coords: [number, number][] = [];
  const distanceX = radiusMeters / (111_320 * Math.cos((center.latitude * Math.PI) / 180));
  const distanceY = radiusMeters / 110_574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([center.longitude + x, center.latitude + y]);
  }
  coords.push(coords[0]);

  return {
    type: 'Feature',
    properties: { radiusMeters },
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
}

export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sinLng *
      sinLng;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10;
}

function formatDurationMinutes(mins: number): string {
  if (mins < 1) return '1 min';
  if (mins < 60) return `${Math.round(mins)} mins`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h} hr ${m} mins` : `${h} hr`;
}

export function formatShortKesPrice(price?: number | null): string {
  const amount = Number(price ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'KES —';
  if (amount >= 1_000_000) {
    return `KES ${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (amount >= 10_000) {
    return `KES ${Math.round(amount / 1000)}K`;
  }
  return `KES ${amount.toLocaleString()}`;
}

export const mapService = {
  /**
   * Place search / autocomplete via Supabase `maps-proxy` (Photon + Nominatim cached in Redis),
   * with direct Photon fallback if the Edge Function is unreachable.
   */
  async searchPlaces(
    query: string,
    bias?: LatLng,
    limit = 6,
  ): Promise<PlaceSuggestion[]> {
    const q = query.trim();
    if (q.length < 2) return [];

    try {
      const { data, error } = await supabase.functions.invoke('maps-proxy', {
        body: {
          action: 'autocomplete',
          query: q,
          biasLat: bias?.latitude ?? -3.5,
          biasLng: bias?.longitude ?? 38.8,
          limit,
        },
      });
      if (!error && Array.isArray(data?.results)) {
        return data.results as PlaceSuggestion[];
      }
    } catch {
      // Direct fallback below
    }

    try {
      const url = new URL('https://photon.komoot.io/api/');
      url.searchParams.set('q', q);
      url.searchParams.set('lat', String(bias?.latitude ?? -3.5));
      url.searchParams.set('lon', String(bias?.longitude ?? 38.8));
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('lang', 'en');

      const res = await fetch(url.toString());
      if (!res.ok) return [];
      const payload = await res.json();
      const features = Array.isArray(payload?.features) ? payload.features : [];
      return features
        .map((f: any, i: number): PlaceSuggestion | null => {
          const coords = f?.geometry?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) return null;
          const p = f.properties ?? {};
          const city = String(p.city || p.town || p.village || p.county || p.state || '').trim();
          const name = String(p.name || p.street || city || 'Location').trim();
          const parts = [p.name, p.street, city && city !== p.name ? city : null, p.country || 'Kenya'].filter(Boolean);
          return {
            id: `direct_${p.osm_id ?? i}`,
            name,
            formattedAddress: parts.join(', '),
            city: city || name,
            region: String(p.state || p.county || ''),
            countryCode: String(p.countrycode || 'KE').toUpperCase(),
            latitude: Number(Number(coords[1]).toFixed(6)),
            longitude: Number(Number(coords[0]).toFixed(6)),
          };
        })
        .filter((x: PlaceSuggestion | null): x is PlaceSuggestion => Boolean(x));
    } catch {
      return [];
    }
  },

  /**
   * Reverse geocode a dropped pin coordinate into address + city + countryCode.
   */
  async reverseGeocode(coords: LatLng): Promise<PlaceSuggestion | null> {
    try {
      const { data, error } = await supabase.functions.invoke('maps-proxy', {
        body: {
          action: 'reverse_geocode',
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
      });
      if (!error && data?.place) {
        return data.place as PlaceSuggestion;
      }
    } catch {
      // Direct fallback below
    }

    try {
      const res = await fetch(
        `https://photon.komoot.io/reverse?lat=${coords.latitude}&lon=${coords.longitude}&lang=en`,
      );
      if (res.ok) {
        const payload = await res.json();
        const first = payload?.features?.[0];
        if (first) {
          const p = first.properties ?? {};
          const city = String(p.city || p.town || p.village || p.county || p.state || '').trim();
          const name = String(p.name || p.street || city || 'Pinned Location').trim();
          const parts = [p.name, p.street, city && city !== p.name ? city : null, p.country || 'Kenya'].filter(Boolean);
          return {
            id: `rev_${p.osm_id ?? '0'}`,
            name,
            formattedAddress: parts.join(', ') || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
            city: city || name,
            region: String(p.state || p.county || ''),
            countryCode: String(p.countrycode || 'KE').toUpperCase(),
            latitude: Number(coords.latitude.toFixed(6)),
            longitude: Number(coords.longitude.toFixed(6)),
          };
        }
      }
    } catch {
      // ignore
    }

    return null;
  },

  /**
   * Fetches real driving road geometry and ETA via `maps-proxy` (OSRM cached in Redis),
   * with direct OSRM fallback and geodesic calculation if offline.
   */
  async fetchRoadRoute(origin: LatLng, destination: LatLng): Promise<RoadRouteResult> {
    try {
      const { data, error } = await supabase.functions.invoke('maps-proxy', {
        body: {
          action: 'route',
          originLat: origin.latitude,
          originLng: origin.longitude,
          destLat: destination.latitude,
          destLng: destination.longitude,
        },
      });
      if (!error && data?.route && Array.isArray(data.route.coordinates)) {
        return data.route as RoadRouteResult;
      }
    } catch {
      // Direct fallback below
    }

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=false`;
      const res = await fetch(osrmUrl);
      if (res.ok) {
        const payload = await res.json();
        const r = payload?.routes?.[0];
        if (r?.geometry?.coordinates?.length) {
          const distanceKm = Number((Number(r.distance || 0) / 1000).toFixed(1));
          const durationMinutes = Math.max(1, Math.round(Number(r.duration || 0) / 60));
          return {
            distanceKm,
            distanceText: distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm} km`,
            durationMinutes,
            durationText: formatDurationMinutes(durationMinutes),
            coordinates: r.geometry.coordinates.map((c: [number, number]) => ({
              latitude: Number(c[1]),
              longitude: Number(c[0]),
            })),
            source: 'osrm',
          };
        }
      }
    } catch {
      // Geodesic fallback below
    }

    const distanceKm = haversineDistanceKm(origin, destination);
    const durationMinutes = Math.max(2, Math.round(distanceKm * 1.45));
    return {
      distanceKm,
      distanceText: `${distanceKm} km`,
      durationMinutes,
      durationText: formatDurationMinutes(durationMinutes),
      coordinates: [origin, destination],
      source: 'geodesic',
    };
  },

  /**
   * Queries Supabase PostGIS `search_reels_in_bounds` RPC for "Search this area" viewport updates.
   */
  async fetchReelsInBounds(
    bounds: MapBounds,
    filters?: SearchFilters,
    activeCategories?: readonly string[],
  ): Promise<ReelRow[]> {
    const rawCats: string[] = [];
    if (filters?.category) rawCats.push(filters.category);
    if (activeCategories && !activeCategories.includes('all')) {
      rawCats.push(...activeCategories);
    }
    const expandedCats = rawCats.length > 0 ? expandCategoryAliases(rawCats) : null;

    const { data, error } = await supabase.rpc('search_reels_in_bounds', {
      p_min_lat: bounds.minLat,
      p_min_lng: bounds.minLng,
      p_max_lat: bounds.maxLat,
      p_max_lng: bounds.maxLng,
      p_categories: expandedCats && expandedCats.length > 0 ? expandedCats : null,
      p_min_price: filters?.minPrice ?? 0,
      p_max_price: filters?.maxPrice ?? 1_500_000,
      p_limit: 120,
    });

    if (error) {
      throw new Error(error.message);
    }

    const rows = Array.isArray(data) ? (data as unknown as ReelRow[]) : [];
    return enrichReelHosts(rows);
  },

  /**
   * Fetches exact destination coordinates for a confirmed booking via SECURITY DEFINER RPC.
   */
  async fetchConfirmedBookingCoords(
    bookingId: string,
  ): Promise<ConfirmedBookingCoordinates | null> {
    if (!bookingId) return null;
    const { data, error } = await supabase.rpc('get_confirmed_booking_coordinates', {
      p_booking_id: bookingId,
    });
    if (error || !data) return null;
    return data as ConfirmedBookingCoordinates;
  },

  /**
   * 1-tap turn-by-turn navigation handoff to native Google Maps, Apple Maps, or Waze (zero API key / billing).
   */
  async openExternalNavigation(
    destination: LatLng,
    label?: string,
    preferredApp?: 'google' | 'apple' | 'waze',
  ): Promise<void> {
    const lat = destination.latitude;
    const lng = destination.longitude;
    const encodedLabel = encodeURIComponent(label || 'Destination');

    if (preferredApp === 'waze') {
      const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
      await Linking.openURL(wazeUrl);
      return;
    }

    if (preferredApp === 'apple' || (!preferredApp && Platform.OS === 'ios')) {
      const appleUrl = `http://maps.apple.com/?daddr=${lat},${lng}&q=${encodedLabel}&dirflg=d`;
      const supported = await Linking.canOpenURL(appleUrl).catch(() => false);
      if (supported) {
        await Linking.openURL(appleUrl);
        return;
      }
    }

    const googleWebOrAppUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    await Linking.openURL(googleWebOrAppUrl);
  },
};
