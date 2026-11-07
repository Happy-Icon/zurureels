/// <reference path="../deno.d.ts" />
import { checkRateLimit } from '../_shared/rateLimiter.ts';

/**
 * Zero-Billing Geospatial Proxy Edge Function (`maps-proxy`)
 * - Place Autocomplete & Forward Geocoding via Photon (Komoot) + Nominatim fallback
 * - Reverse Geocoding via Photon + Nominatim fallback
 * - Driving Road Geometry & ETA via OSRM
 * - Server-side caching in Upstash Redis + per-IP rate limiting
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USER_AGENT = 'ZuruSasa-Mobile/1.0 (https://zurusasa.com; support@zurusasa.com)';

interface PlaceSuggestion {
  id: string;
  name: string;
  formattedAddress: string;
  city: string;
  region: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function redisRestCommand(url: string, token: string, command: (string | number)[]) {
  if (!url || !token) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch {
    return null;
  }
}

function normalizePhotonFeature(f: any, idx: number): PlaceSuggestion | null {
  const coords = f?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const p = f.properties ?? {};
  const city = String(p.city || p.town || p.village || p.district || p.county || p.state || '').trim();
  const region = String(p.state || p.county || '').trim();
  const country = String(p.country || 'Kenya').trim();
  const countryCode = String(p.countrycode || 'KE').toUpperCase();
  const name = String(p.name || p.street || city || 'Selected Location').trim();

  const addressParts = [
    p.name,
    p.street ? (p.housenumber ? `${p.housenumber} ${p.street}` : p.street) : null,
    p.district && p.district !== p.name ? p.district : null,
    city && city !== p.name ? city : null,
    region && region !== city ? region : null,
    country,
  ].filter(Boolean);

  return {
    id: `photon_${p.osm_id ?? idx}_${lat.toFixed(5)}_${lng.toFixed(5)}`,
    name,
    formattedAddress: addressParts.join(', ') || name,
    city: city || name,
    region,
    countryCode,
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
  };
}

function normalizeNominatimItem(item: any, idx: number): PlaceSuggestion | null {
  const lat = Number(item?.lat);
  const lng = Number(item?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const addr = item?.address ?? {};
  const city = String(
    addr.city || addr.town || addr.village || addr.suburb || addr.municipality || addr.county || '',
  ).trim();
  const region = String(addr.state || addr.county || '').trim();
  const countryCode = String(addr.country_code || 'ke').toUpperCase();
  const displayName = String(item?.display_name || '').trim();
  const name = String(item?.name || displayName.split(',')[0] || city || 'Selected Location').trim();

  return {
    id: `nom_${item?.place_id ?? idx}_${lat.toFixed(5)}_${lng.toFixed(5)}`,
    name,
    formattedAddress: displayName || name,
    city: city || name,
    region,
    countryCode,
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
  };
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '1 min';
  if (minutes < 60) return `${Math.round(minutes)} mins`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hrs} hr ${mins} mins` : `${hrs} hr`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const action = String(body.action || '').trim();
  const rl = await checkRateLimit(request, `maps_${action || 'default'}`, 45, 60);
  if (!rl.allowed) {
    return json({ error: 'Rate limit exceeded. Please try again shortly.' }, 429);
  }

  const redisUrl = (Deno.env.get('UPSTASH_REDIS_REST_URL') ?? '').trim();
  const redisToken = (Deno.env.get('UPSTASH_REDIS_REST_TOKEN') ?? '').trim();

  // 1. Place Autocomplete / Forward Geocoding
  if (action === 'autocomplete' || action === 'geocode') {
    const query = String(body.query || '').trim();
    if (query.length < 2) {
      return json({ results: [] });
    }

    const biasLat = Number.isFinite(Number(body.biasLat)) ? Number(body.biasLat) : -3.5;
    const biasLng = Number.isFinite(Number(body.biasLng)) ? Number(body.biasLng) : 38.8;
    const limit = Math.min(Math.max(Number(body.limit) || 6, 1), 12);
    const cacheKey = `maps:ac:v1:${query.toLowerCase()}:${biasLat.toFixed(1)}:${biasLng.toFixed(1)}:${limit}`;

    const cached = await redisRestCommand(redisUrl, redisToken, ['GET', cacheKey]);
    if (cached) {
      try {
        return json({ results: JSON.parse(cached), cached: true });
      } catch {
        // continue
      }
    }

    let results: PlaceSuggestion[] = [];

    // Primary: Photon (Komoot OpenStreetMap search)
    try {
      const url = new URL('https://photon.komoot.io/api/');
      url.searchParams.set('q', query);
      url.searchParams.set('lat', String(biasLat));
      url.searchParams.set('lon', String(biasLng));
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('lang', 'en');

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const features = Array.isArray(data?.features) ? data.features : [];
        results = features
          .map((f: any, i: number) => normalizePhotonFeature(f, i))
          .filter((item: PlaceSuggestion | null): item is PlaceSuggestion => Boolean(item));
      }
    } catch (err) {
      console.warn('[maps-proxy] Photon search failed, falling back to Nominatim:', err);
    }

    // Fallback: Nominatim
    if (results.length === 0) {
      try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('addressdetails', '1');
        url.searchParams.set('limit', String(limit));

        const res = await fetch(url.toString(), {
          headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            results = data
              .map((item: any, i: number) => normalizeNominatimItem(item, i))
              .filter((item: PlaceSuggestion | null): item is PlaceSuggestion => Boolean(item));
          }
        }
      } catch (err) {
        console.error('[maps-proxy] Nominatim search failed:', err);
      }
    }

    if (results.length > 0) {
      redisRestCommand(redisUrl, redisToken, ['SETEX', cacheKey, 86_400, JSON.stringify(results)]).catch(
        () => null,
      );
    }

    return json({ results, cached: false });
  }

  // 2. Reverse Geocoding
  if (action === 'reverse_geocode') {
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return json({ error: 'Valid latitude and longitude are required' }, 400);
    }

    const cacheKey = `maps:rev:v1:${lat.toFixed(4)}:${lng.toFixed(4)}`;
    const cached = await redisRestCommand(redisUrl, redisToken, ['GET', cacheKey]);
    if (cached) {
      try {
        return json({ place: JSON.parse(cached), cached: true });
      } catch {
        // continue
      }
    }

    let place: PlaceSuggestion | null = null;

    try {
      const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        const first = data?.features?.[0];
        if (first) {
          place = normalizePhotonFeature(first, 0);
          if (place) {
            place.latitude = Number(lat.toFixed(6));
            place.longitude = Number(lng.toFixed(6));
          }
        }
      }
    } catch {
      // fallback to Nominatim
    }

    if (!place) {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
        const res = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
        });
        if (res.ok) {
          const data = await res.json();
          place = normalizeNominatimItem(data, 0);
          if (place) {
            place.latitude = Number(lat.toFixed(6));
            place.longitude = Number(lng.toFixed(6));
          }
        }
      } catch (err) {
        console.error('[maps-proxy] Reverse geocode failed:', err);
      }
    }

    if (place) {
      redisRestCommand(redisUrl, redisToken, ['SETEX', cacheKey, 86_400, JSON.stringify(place)]).catch(
        () => null,
      );
    }

    return json({ place, cached: false });
  }

  // 3. Road Routing via OSRM
  if (action === 'route') {
    const originLat = Number(body.originLat);
    const originLng = Number(body.originLng);
    const destLat = Number(body.destLat);
    const destLng = Number(body.destLng);

    if (
      !Number.isFinite(originLat) ||
      !Number.isFinite(originLng) ||
      !Number.isFinite(destLat) ||
      !Number.isFinite(destLng)
    ) {
      return json({ error: 'Valid origin and destination coordinates are required' }, 400);
    }

    const cacheKey = `maps:route:v1:${originLat.toFixed(3)},${originLng.toFixed(3)}:${destLat.toFixed(3)},${destLng.toFixed(3)}`;
    const cached = await redisRestCommand(redisUrl, redisToken, ['GET', cacheKey]);
    if (cached) {
      try {
        return json({ route: JSON.parse(cached), cached: true });
      } catch {
        // continue
      }
    }

    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=false`;
      const res = await fetch(osrmUrl, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        const routeObj = data?.routes?.[0];
        if (routeObj && Array.isArray(routeObj.geometry?.coordinates)) {
          const distanceKm = Number((Number(routeObj.distance || 0) / 1000).toFixed(1));
          const durationMinutes = Math.max(1, Math.round(Number(routeObj.duration || 0) / 60));
          const coordinates = routeObj.geometry.coordinates.map((pair: [number, number]) => ({
            latitude: Number(pair[1]),
            longitude: Number(pair[0]),
          }));

          const payload = {
            distanceKm,
            distanceText: distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm} km`,
            durationMinutes,
            durationText: formatDuration(durationMinutes),
            coordinates,
            source: 'osrm',
          };

          redisRestCommand(redisUrl, redisToken, ['SETEX', cacheKey, 1800, JSON.stringify(payload)]).catch(
            () => null,
          );
          return json({ route: payload, cached: false });
        }
      }
    } catch (err) {
      console.error('[maps-proxy] OSRM routing failed:', err);
    }

    return json({ route: null, error: 'Unable to compute driving route' }, 200);
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
