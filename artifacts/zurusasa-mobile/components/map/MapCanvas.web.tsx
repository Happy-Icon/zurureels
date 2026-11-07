import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import * as maplibregl from 'maplibre-gl';
import {
  clusterMarkersForZoom,
  type MapCanvasProps,
  type MapCanvasRef,
  type MapEdgePadding,
} from '@/components/map/MapCanvas.types';
import {
  createGeoJSONCircle,
  MAP_STYLE_DARK_URL,
  MAP_STYLE_LIGHT_URL,
  type GeoJsonLineFeature,
  type LatLng,
  type MapBounds,
} from '@/services/mapService';

const ORANGE = '#F26522';
const ROUTE_BLUE = '#2563EB';
const MAPLIBRE_CSS_ID = 'zurusasa-maplibre-gl-css';

function ensureMapLibreCssInjected() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(MAPLIBRE_CSS_ID)) return;
  const link = document.createElement('link');
  link.id = MAPLIBRE_CSS_ID;
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.css';
  document.head.appendChild(link);
}

function normalizePadding(padding?: number | MapEdgePadding): MapEdgePadding {
  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return padding ?? { top: 64, right: 48, bottom: 180, left: 48 };
}

export const MapCanvas = forwardRef<MapCanvasRef, MapCanvasProps>(function MapCanvasWeb(
  {
    style,
    initialCenter,
    initialZoom = 11,
    theme = 'light',
    interactive = true,
    userLocation,
    priceMarkers = [],
    enableClustering = true,
    singlePin,
    privacyCircle,
    routeCoordinates,
    routeColor = ROUTE_BLUE,
    onPressMarker,
    onPressMap,
    onViewportChange,
    onMapReady,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const domMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(initialZoom);

  const onPressMapRef = useRef(onPressMap);
  onPressMapRef.current = onPressMap;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const onPressMarkerRef = useRef(onPressMarker);
  onPressMarkerRef.current = onPressMarker;
  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;

  const styleUrl = theme === 'dark' ? MAP_STYLE_DARK_URL : MAP_STYLE_LIGHT_URL;

  const fitBounds = useCallback(
    (bounds: MapBounds, padding?: number | MapEdgePadding, durationMs = 500) => {
      const map = mapInstanceRef.current;
      if (!map) return;
      const pad = normalizePadding(padding);
      const lngSpan = Math.max(Math.abs(bounds.maxLng - bounds.minLng), 0.008);
      const latSpan = Math.max(Math.abs(bounds.maxLat - bounds.minLat), 0.008);
      const midLng = (bounds.minLng + bounds.maxLng) / 2;
      const midLat = (bounds.minLat + bounds.maxLat) / 2;

      map.fitBounds(
        [
          [midLng - lngSpan / 2, midLat - latSpan / 2],
          [midLng + lngSpan / 2, midLat + latSpan / 2],
        ],
        { padding: pad, duration: durationMs },
      );
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (center: LatLng, zoom?: number, durationMs = 450) => {
        const map = mapInstanceRef.current;
        if (!map) return;
        const targetZoom = zoom ?? map.getZoom();
        setCurrentZoom(targetZoom);
        map.flyTo({
          center: [center.longitude, center.latitude],
          zoom: targetZoom,
          duration: durationMs,
        });
      },
      zoomIn: () => {
        const map = mapInstanceRef.current;
        if (!map) return;
        map.zoomIn({ duration: 240 });
      },
      zoomOut: () => {
        const map = mapInstanceRef.current;
        if (!map) return;
        map.zoomOut({ duration: 240 });
      },
      fitBounds,
    }),
    [fitBounds],
  );

  // Initialize WebGL MapLibre instance
  useEffect(() => {
    ensureMapLibreCssInjected();
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [initialCenter.longitude, initialCenter.latitude],
      zoom: initialZoom,
      interactive,
      attributionControl: interactive ? { compact: true } : false,
    });

    mapInstanceRef.current = map;

    map.on('load', () => {
      setStyleLoaded(true);
      onMapReadyRef.current?.();
    });

    map.on('click', () => {
      onPressMapRef.current?.();
    });

    map.on('moveend', (e: any) => {
      const z = map.getZoom();
      setCurrentZoom(z);
      const c = map.getCenter();
      const b = map.getBounds();
      onViewportChangeRef.current?.({
        center: { latitude: c.lat, longitude: c.lng },
        zoom: z,
        bounds: {
          minLat: b.getSouth(),
          maxLat: b.getNorth(),
          minLng: b.getWest(),
          maxLng: b.getEast(),
        },
        userInteraction: Boolean(e?.originalEvent),
      });
    });

    return () => {
      domMarkersRef.current.forEach((m) => m.remove());
      domMarkersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
      setStyleLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl, interactive]);

  // Sync Privacy Circle GeoJSON Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !styleLoaded) return;

    const srcId = 'zuru-web-privacy-src';
    const fillId = 'zuru-web-privacy-fill';
    const lineId = 'zuru-web-privacy-line';

    if (!privacyCircle) {
      if (map.getLayer(fillId)) map.removeLayer(fillId);
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getSource(srcId)) map.removeSource(srcId);
      return;
    }

    const data = createGeoJSONCircle(privacyCircle.center, privacyCircle.radiusMeters ?? 450);
    const existing = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(srcId, { type: 'geojson', data });
      map.addLayer({
        id: fillId,
        type: 'fill',
        source: srcId,
        paint: { 'fill-color': ORANGE, 'fill-opacity': 0.16 },
      });
      map.addLayer({
        id: lineId,
        type: 'line',
        source: srcId,
        paint: { 'line-color': ORANGE, 'line-width': 2, 'line-dasharray': [2, 2] },
      });
    }
  }, [privacyCircle, styleLoaded]);

  // Sync Road Route GeoJSON Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !styleLoaded) return;

    const srcId = 'zuru-web-route-src';
    const casingId = 'zuru-web-route-casing';
    const mainId = 'zuru-web-route-main';

    if (!routeCoordinates || routeCoordinates.length < 2) {
      if (map.getLayer(mainId)) map.removeLayer(mainId);
      if (map.getLayer(casingId)) map.removeLayer(casingId);
      if (map.getSource(srcId)) map.removeSource(srcId);
      return;
    }

    const data: GeoJsonLineFeature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: routeCoordinates.map((c) => [c.longitude, c.latitude]),
      },
    };

    const existing = map.getSource(srcId) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(srcId, { type: 'geojson', data });
      map.addLayer({
        id: casingId,
        type: 'line',
        source: srcId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': 'rgba(37,99,235,0.28)', 'line-width': 9 },
      });
      map.addLayer({
        id: mainId,
        type: 'line',
        source: srcId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': routeColor, 'line-width': 5 },
      });
    }
  }, [routeCoordinates, routeColor, styleLoaded]);

  const clusteredItems = useMemo(
    () => clusterMarkersForZoom(priceMarkers, currentZoom, enableClustering),
    [priceMarkers, currentZoom, enableClustering],
  );

  // Sync DOM Markers (Clusters, Price Pills, Town Badges, Single Pin, User Puck)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    domMarkersRef.current.forEach((m) => m.remove());
    domMarkersRef.current = [];

    if (userLocation) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:24px;height:24px;border-radius:12px;background:rgba(37,99,235,0.24);display:flex;align-items:center;justify-content:center;';
      const dot = document.createElement('div');
      dot.style.cssText =
        'width:12px;height:12px;border-radius:6px;background:#2563EB;border:2.5px solid #fff;';
      el.appendChild(dot);
      const mk = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map);
      domMarkersRef.current.push(mk);
    }

    if (singlePin) {
      const el = document.createElement('div');
      el.style.cssText =
        'width:36px;height:36px;border-radius:18px;background:#F26522;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.25);color:#fff;font-size:16px;';
      el.textContent = '●';
      const mk = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([singlePin.coordinate.longitude, singlePin.coordinate.latitude])
        .addTo(map);
      domMarkersRef.current.push(mk);
    }

    for (const item of clusteredItems) {
      if (item.type === 'cluster') {
        const el = document.createElement('button');
        el.type = 'button';
        el.textContent = String(item.count);
        el.style.cssText =
          'width:38px;height:38px;border-radius:19px;background:#F26522;border:2.5px solid #fff;color:#fff;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.25);';
        el.onclick = (ev) => {
          ev.stopPropagation();
          fitBounds(item.bounds, 72, 420);
        };
        const mk = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([item.coordinate.longitude, item.coordinate.latitude])
          .addTo(map);
        domMarkersRef.current.push(mk);
        continue;
      }

      const m = item.marker;
      const isSelected = m.state === 'selected';
      const isTown = m.badgeType === 'town_summary';
      const bg = isSelected
        ? ORANGE
        : isTown
          ? '#1F2937'
          : theme === 'dark'
            ? '#1F2937'
            : '#FFFFFF';
      const fg = isSelected || isTown || theme === 'dark' ? '#FFFFFF' : '#111827';
      const border = isSelected
        ? '1.5px solid #FFFFFF'
        : isTown
          ? '1px solid rgba(242,101,34,0.6)'
          : '1px solid rgba(17,24,39,0.12)';

      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = m.label;
      el.style.cssText = `padding:6px 11px;border-radius:999px;background:${bg};color:${fg};border:${border};font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 3px 8px rgba(0,0,0,0.18);white-space:nowrap;transform:${isSelected ? 'scale(1.08)' : 'scale(1)'};z-index:${isSelected ? 50 : 5};`;
      el.onclick = (ev) => {
        ev.stopPropagation();
        onPressMarkerRef.current?.(m.id);
      };

      const mk = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([m.coordinate.longitude, m.coordinate.latitude])
        .addTo(map);
      domMarkersRef.current.push(mk);
    }
  }, [clusteredItems, singlePin, userLocation, theme, fitBounds]);

  return (
    <View style={[styles.root, style]}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
});
