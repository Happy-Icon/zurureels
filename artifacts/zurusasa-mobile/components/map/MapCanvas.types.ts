import type { StyleProp, ViewStyle } from 'react-native';
import type { LatLng, MapBounds } from '@/services/mapService';

export type MarkerVisualState = 'default' | 'selected' | 'visited';

export interface MapPriceMarker {
  id: string;
  coordinate: LatLng;
  label: string;
  state: MarkerVisualState;
  /** 'price' for pinned exact/approximate listings, 'town_summary' for honest city-level groups */
  badgeType?: 'price' | 'town_summary';
  subtitle?: string;
}

export interface MapViewportEvent {
  center: LatLng;
  zoom: number;
  bounds: MapBounds;
  userInteraction: boolean;
}

export interface MapEdgePadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MapCanvasRef {
  flyTo: (center: LatLng, zoom?: number, durationMs?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitBounds: (
    bounds: MapBounds,
    padding?: number | MapEdgePadding,
    durationMs?: number,
  ) => void;
}

export interface MapCanvasProps {
  style?: StyleProp<ViewStyle>;
  initialCenter: LatLng;
  initialZoom?: number;
  theme?: 'light' | 'dark';
  interactive?: boolean;
  userLocation?: LatLng | null;
  priceMarkers?: MapPriceMarker[];
  enableClustering?: boolean;
  singlePin?: {
    coordinate: LatLng;
    title?: string;
    variant?: 'exact' | 'destination';
  } | null;
  privacyCircle?: {
    center: LatLng;
    radiusMeters?: number;
  } | null;
  routeCoordinates?: LatLng[] | null;
  routeColor?: string;
  onPressMarker?: (id: string) => void;
  onPressMap?: () => void;
  onViewportChange?: (event: MapViewportEvent) => void;
  onMapReady?: () => void;
}

export interface ComputedClusterItem {
  type: 'cluster';
  id: string;
  coordinate: LatLng;
  count: number;
  bounds: MapBounds;
  memberIds: string[];
  hasSelected: boolean;
}

export interface ComputedSingleItem {
  type: 'marker';
  marker: MapPriceMarker;
}

export type ClusteredMapItem = ComputedClusterItem | ComputedSingleItem;

/**
 * Deterministic zoom-aware spatial clustering for pinned price markers.
 * Never clusters 'town_summary' badges with street-level pins.
 */
export function clusterMarkersForZoom(
  markers: MapPriceMarker[],
  zoom: number,
  enableClustering = true,
): ClusteredMapItem[] {
  if (!enableClustering || zoom >= 14.2 || markers.length <= 1) {
    return markers.map((marker) => ({ type: 'marker', marker }));
  }

  const townBadges: ClusteredMapItem[] = [];
  const pinMarkers: MapPriceMarker[] = [];

  for (const m of markers) {
    if (m.badgeType === 'town_summary') {
      townBadges.push({ type: 'marker', marker: m });
    } else {
      pinMarkers.push(m);
    }
  }

  if (pinMarkers.length <= 1) {
    return [...townBadges, ...pinMarkers.map((marker) => ({ type: 'marker' as const, marker }))];
  }

  // Approximate ~56px cell size in degrees at given zoom level
  const cellDeg = 56 * (360 / (256 * Math.pow(2, Math.max(zoom, 3))));
  const buckets = new Map<string, MapPriceMarker[]>();

  for (const m of pinMarkers) {
    // Always keep the actively selected marker unclustered so its callout stays clear
    if (m.state === 'selected') {
      buckets.set(`__sel_${m.id}`, [m]);
      continue;
    }
    const gx = Math.floor(m.coordinate.longitude / cellDeg);
    const gy = Math.floor(m.coordinate.latitude / cellDeg);
    const key = `${gx}:${gy}`;
    const arr = buckets.get(key);
    if (arr) arr.push(m);
    else buckets.set(key, [m]);
  }

  const output: ClusteredMapItem[] = [...townBadges];

  for (const [key, group] of buckets.entries()) {
    if (group.length === 1) {
      output.push({ type: 'marker', marker: group[0] });
    } else {
      let sumLat = 0;
      let sumLng = 0;
      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;
      let hasSelected = false;

      for (const item of group) {
        sumLat += item.coordinate.latitude;
        sumLng += item.coordinate.longitude;
        if (item.coordinate.latitude < minLat) minLat = item.coordinate.latitude;
        if (item.coordinate.latitude > maxLat) maxLat = item.coordinate.latitude;
        if (item.coordinate.longitude < minLng) minLng = item.coordinate.longitude;
        if (item.coordinate.longitude > maxLng) maxLng = item.coordinate.longitude;
        if (item.state === 'selected') hasSelected = true;
      }

      output.push({
        type: 'cluster',
        id: `cluster_${key}_${group.length}`,
        coordinate: {
          latitude: sumLat / group.length,
          longitude: sumLng / group.length,
        },
        count: group.length,
        bounds: { minLat, minLng, maxLat, maxLng },
        memberIds: group.map((g) => g.id),
        hasSelected,
      });
    }
  }

  return output;
}
