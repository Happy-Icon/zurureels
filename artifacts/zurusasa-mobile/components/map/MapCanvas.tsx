import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import {
  clusterMarkersForZoom,
  type MapCanvasProps,
  type MapCanvasRef,
  type MapEdgePadding,
} from '@/components/map/MapCanvas.types';
import { getNativeMapLibre } from '@/components/map/NativeMapsBridge';
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

function normalizePadding(padding?: number | MapEdgePadding): MapEdgePadding {
  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return padding ?? { top: 64, right: 48, bottom: 180, left: 48 };
}

export const MapCanvas = forwardRef<MapCanvasRef, MapCanvasProps>(function MapCanvas(
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
  const nativeML = useMemo(() => getNativeMapLibre(), []);
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const [currentZoom, setCurrentZoom] = useState(initialZoom);

  const styleUrl = theme === 'dark' ? MAP_STYLE_DARK_URL : MAP_STYLE_LIGHT_URL;

  const flyTo = useCallback(
    (center: LatLng, zoom?: number, durationMs = 450) => {
      const nextZoom = zoom ?? currentZoom;
      setCurrentZoom(nextZoom);
      cameraRef.current?.flyTo?.({
        center: [center.longitude, center.latitude],
        zoom: nextZoom,
        duration: durationMs,
      });
    },
    [currentZoom],
  );

  const zoomIn = useCallback(() => {
    const next = Math.min(currentZoom + 1.2, 18.5);
    setCurrentZoom(next);
    cameraRef.current?.zoomTo?.(next, { duration: 240 });
  }, [currentZoom]);

  const zoomOut = useCallback(() => {
    const next = Math.max(currentZoom - 1.2, 3.5);
    setCurrentZoom(next);
    cameraRef.current?.zoomTo?.(next, { duration: 240 });
  }, [currentZoom]);

  const fitBounds = useCallback(
    (bounds: MapBounds, padding?: number | MapEdgePadding, durationMs = 500) => {
      const pad = normalizePadding(padding);
      // Guard identical min/max coordinates
      const lngSpan = Math.max(Math.abs(bounds.maxLng - bounds.minLng), 0.008);
      const latSpan = Math.max(Math.abs(bounds.maxLat - bounds.minLat), 0.008);
      const midLng = (bounds.minLng + bounds.maxLng) / 2;
      const midLat = (bounds.minLat + bounds.maxLat) / 2;

      cameraRef.current?.fitBounds?.(
        [
          midLng - lngSpan / 2,
          midLat - latSpan / 2,
          midLng + lngSpan / 2,
          midLat + latSpan / 2,
        ],
        { padding: pad, duration: durationMs },
      );
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      flyTo,
      zoomIn,
      zoomOut,
      fitBounds,
    }),
    [flyTo, zoomIn, zoomOut, fitBounds],
  );

  const clusteredItems = useMemo(
    () => clusterMarkersForZoom(priceMarkers, currentZoom, enableClustering),
    [priceMarkers, currentZoom, enableClustering],
  );

  const privacyGeoJSON = useMemo(() => {
    if (!privacyCircle) return null;
    return createGeoJSONCircle(privacyCircle.center, privacyCircle.radiusMeters ?? 450);
  }, [privacyCircle]);

  const routeGeoJSON = useMemo<GeoJsonLineFeature | null>(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: routeCoordinates.map((c) => [c.longitude, c.latitude]),
      },
    };
  }, [routeCoordinates]);

  const handleRegionDidChange = useCallback(
    (event: any) => {
      const payload = event?.nativeEvent;
      if (!payload) return;
      const z = typeof payload.zoom === 'number' ? payload.zoom : currentZoom;
      setCurrentZoom(z);

      if (onViewportChange && Array.isArray(payload.center) && Array.isArray(payload.bounds)) {
        const [west, south, east, north] = payload.bounds;
        onViewportChange({
          center: { latitude: payload.center[1], longitude: payload.center[0] },
          zoom: z,
          bounds: {
            minLat: Math.min(south, north),
            maxLat: Math.max(south, north),
            minLng: Math.min(west, east),
            maxLng: Math.max(west, east),
          },
          userInteraction: Boolean(payload.userInteraction),
        });
      }
    },
    [currentZoom, onViewportChange],
  );

  // Honest diagnostic fallback ONLY when opened inside plain Expo Go without compiled native MapLibre
  if (!nativeML) {
    const isDark = theme === 'dark';
    return (
      <View
        style={[
          styles.expoGoFallback,
          { backgroundColor: isDark ? '#111827' : '#F8FAFC' },
          style,
        ]}
      >
        <View style={styles.expoGoHeader}>
          <View style={styles.expoGoIconBadge}>
            <Feather name="map" size={18} color={ORANGE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.expoGoTitle, isDark && { color: '#F9FAFB' }]}>
              MapLibre Native Ready (Dev Build Required)
            </Text>
            <Text style={[styles.expoGoSub, isDark && { color: '#9CA3AF' }]}>
              Plain Expo Go excludes custom C++ map binaries. Run a development build or Expo Web for interactive vector tiles.
            </Text>
          </View>
        </View>

        {priceMarkers.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.expoGoChipsRow}
          >
            {priceMarkers.map((m) => {
              const isSelected = m.state === 'selected';
              return (
                <Pressable
                  key={m.id}
                  onPress={() => onPressMarker?.(m.id)}
                  style={[
                    styles.markerPill,
                    m.badgeType === 'town_summary'
                      ? styles.townSummaryPill
                      : isSelected
                        ? styles.markerPillSelected
                        : styles.markerPillDefault,
                  ]}
                >
                  {m.badgeType === 'town_summary' && (
                    <Ionicons
                      name="location-outline"
                      size={12}
                      color={isSelected ? '#FFFFFF' : ORANGE}
                    />
                  )}
                  <Text
                    style={[
                      styles.markerPillText,
                      (isSelected || m.badgeType === 'town_summary') && { color: '#FFFFFF' },
                    ]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  }

  const { Map: MLMap, Camera: MLCamera, GeoJSONSource, Layer, Marker } = nativeML;

  return (
    <View style={[styles.root, style]}>
      <MLMap
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapStyle={styleUrl}
        dragPan={interactive}
        touchZoom={interactive}
        doubleTapZoom={interactive}
        doubleTapHoldZoom={interactive}
        touchRotate={interactive}
        touchPitch={false}
        compass={interactive}
        compassHiddenFacingNorth
        logo={false}
        attribution={interactive}
        attributionPosition={{ bottom: 8, right: 8 }}
        onPress={() => onPressMap?.()}
        onRegionDidChange={handleRegionDidChange}
        onDidFinishLoadingMap={() => onMapReady?.()}
      >
        <MLCamera
          ref={cameraRef}
          initialViewState={{
            center: [initialCenter.longitude, initialCenter.latitude],
            zoom: initialZoom,
            pitch: 0,
            bearing: 0,
          }}
          minZoom={3}
          maxZoom={19}
        />

        {/* ~450m Privacy Circle for Approximate Villa Listings */}
        {privacyGeoJSON && (
          <GeoJSONSource id="zuru-privacy-circle-src" data={privacyGeoJSON}>
            <Layer
              id="zuru-privacy-circle-fill"
              type="fill"
              paint={{
                'fill-color': ORANGE,
                'fill-opacity': 0.16,
              }}
            />
            <Layer
              id="zuru-privacy-circle-stroke"
              type="line"
              paint={{
                'line-color': ORANGE,
                'line-width': 2,
                'line-dasharray': [2, 2],
              }}
            />
          </GeoJSONSource>
        )}

        {/* OSRM Driving Route Polyline */}
        {routeGeoJSON && (
          <GeoJSONSource id="zuru-road-route-src" data={routeGeoJSON}>
            <Layer
              id="zuru-road-route-casing"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': 'rgba(37, 99, 235, 0.28)',
                'line-width': 9,
              }}
            />
            <Layer
              id="zuru-road-route-main"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{
                'line-color': routeColor,
                'line-width': 5,
              }}
            />
          </GeoJSONSource>
        )}

        {/* User Live GPS Puck */}
        {userLocation && (
          <Marker
            id="zuru-user-puck"
            lngLat={[userLocation.longitude, userLocation.latitude]}
            anchor="center"
          >
            <View style={styles.userPuckOuter}>
              <View style={styles.userPuckInner} />
            </View>
          </Marker>
        )}

        {/* Single Exact / Destination Pin */}
        {singlePin && (
          <Marker
            id="zuru-single-pin"
            lngLat={[singlePin.coordinate.longitude, singlePin.coordinate.latitude]}
            anchor="bottom"
          >
            <View style={styles.singlePinWrap}>
              <View style={styles.singlePinBubble}>
                <Ionicons name="location" size={18} color="#FFFFFF" />
              </View>
              <View style={styles.singlePinStem} />
            </View>
          </Marker>
        )}

        {/* Clustered & Individual Price / Town Markers */}
        {clusteredItems.map((item) => {
          if (item.type === 'cluster') {
            return (
              <Marker
                key={item.id}
                id={item.id}
                lngLat={[item.coordinate.longitude, item.coordinate.latitude]}
                anchor="center"
                onPress={() => {
                  fitBounds(item.bounds, 72, 420);
                }}
              >
                <Pressable
                  onPress={() => fitBounds(item.bounds, 72, 420)}
                  style={styles.clusterPill}
                >
                  <Text style={styles.clusterPillText}>{item.count}</Text>
                </Pressable>
              </Marker>
            );
          }

          const m = item.marker;
          const isSelected = m.state === 'selected';
          const isVisited = m.state === 'visited';
          const isTownSummary = m.badgeType === 'town_summary';

          return (
            <Marker
              key={m.id}
              id={m.id}
              lngLat={[m.coordinate.longitude, m.coordinate.latitude]}
              anchor="bottom"
              selected={isSelected}
              onPress={() => onPressMarker?.(m.id)}
            >
              <Pressable
                onPress={() => onPressMarker?.(m.id)}
                style={styles.markerTouchWrap}
              >
                <View
                  style={[
                    styles.markerPill,
                    isTownSummary
                      ? isSelected
                        ? styles.markerPillSelected
                        : styles.townSummaryPill
                      : isSelected
                        ? styles.markerPillSelected
                        : isVisited
                          ? styles.markerPillVisited
                          : theme === 'dark'
                            ? styles.markerPillDarkDefault
                            : styles.markerPillDefault,
                  ]}
                >
                  {isTownSummary && (
                    <Ionicons
                      name="compass-outline"
                      size={12}
                      color={isSelected ? '#FFFFFF' : '#FDBA74'}
                    />
                  )}
                  <Text
                    style={[
                      styles.markerPillText,
                      isTownSummary && { color: '#FFFFFF' },
                      !isTownSummary && theme === 'dark' && !isSelected && { color: '#F9FAFB' },
                      isVisited && !isSelected && !isTownSummary && { color: '#6B7280' },
                      isSelected && styles.markerPillTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {m.label}
                  </Text>
                </View>
                <View
                  style={[
                    styles.markerPointer,
                    {
                      borderTopColor: isSelected
                        ? ORANGE
                        : isTownSummary
                          ? '#1F2937'
                          : theme === 'dark'
                            ? '#1F2937'
                            : '#FFFFFF',
                    },
                  ]}
                />
              </Pressable>
            </Marker>
          );
        })}
      </MLMap>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  markerTouchWrap: {
    alignItems: 'center',
  },
  markerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  markerPillDefault: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.1)',
  },
  markerPillDarkDefault: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  markerPillVisited: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  markerPillSelected: {
    backgroundColor: ORANGE,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.08 }],
  },
  townSummaryPill: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: 'rgba(242, 101, 34, 0.55)',
  },
  markerPillText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  markerPillTextSelected: {
    color: '#FFFFFF',
  },
  markerPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  clusterPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ORANGE,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  clusterPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
  },
  userPuckOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(37, 99, 235, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userPuckInner: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#2563EB',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  singlePinWrap: {
    alignItems: 'center',
  },
  singlePinBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ORANGE,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  singlePinStem: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: ORANGE,
    marginTop: -2,
  },
  expoGoFallback: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    gap: 14,
  },
  expoGoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(242, 101, 34, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(242, 101, 34, 0.25)',
    borderRadius: 16,
    padding: 14,
  },
  expoGoIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(242, 101, 34, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expoGoTitle: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
    marginBottom: 2,
  },
  expoGoSub: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#4B5563',
    lineHeight: 17,
  },
  expoGoChipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
});
