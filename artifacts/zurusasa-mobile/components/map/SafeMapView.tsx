import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { MapCanvas } from '@/components/map/MapCanvas';
import type { MapCanvasRef } from '@/components/map/MapCanvas.types';
import { useTheme } from '@/context/ThemeContext';
import type { LatLng, LocationPrecision, RoadRouteResult } from '@/services/mapService';

export { DiscoverMapView } from '@/components/map/DiscoverMapView';

export interface SafeRouteMapViewProps {
  userLocation: LatLng | null;
  destLocation: LatLng;
  destPrecision?: LocationPrecision;
  routeInfo: RoadRouteResult | null;
  propertyTitle: string;
  isTracking?: boolean;
  onMapReady?: () => void;
}

export function SafeRouteMapView({
  userLocation,
  destLocation,
  destPrecision = 'exact',
  routeInfo,
  propertyTitle,
  isTracking = false,
  onMapReady,
}: SafeRouteMapViewProps) {
  const { isDark } = useTheme();
  const mapRef = useRef<MapCanvasRef>(null);

  const routeCoordinates = routeInfo?.coordinates ?? null;

  const initialCenter = useMemo<LatLng>(() => {
    if (!userLocation) return destLocation;
    return {
      latitude: (userLocation.latitude + destLocation.latitude) / 2,
      longitude: (userLocation.longitude + destLocation.longitude) / 2,
    };
  }, [userLocation, destLocation]);

  // Fit bounds to show entire road route (or origin + destination) when overview loads
  useEffect(() => {
    if (isTracking) return;
    const pts =
      routeCoordinates && routeCoordinates.length >= 2
        ? routeCoordinates
        : userLocation
          ? [userLocation, destLocation]
          : [destLocation];

    if (pts.length < 2) {
      mapRef.current?.flyTo(destLocation, 13.5, 450);
      return;
    }

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const p of pts) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLng) minLng = p.longitude;
      if (p.longitude > maxLng) maxLng = p.longitude;
    }

    const timer = setTimeout(() => {
      mapRef.current?.fitBounds(
        { minLat, minLng, maxLat, maxLng },
        { top: 96, right: 52, bottom: 290, left: 52 },
        550,
      );
    }, 180);

    return () => clearTimeout(timer);
  }, [routeCoordinates, userLocation, destLocation, isTracking]);

  // Follow user live GPS puck during active navigation
  useEffect(() => {
    if (isTracking && userLocation) {
      mapRef.current?.flyTo(userLocation, 15.8, 450);
    }
  }, [isTracking, userLocation]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapCanvas
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialCenter={initialCenter}
        initialZoom={11}
        theme={isDark ? 'dark' : 'light'}
        interactive
        enableClustering={false}
        userLocation={userLocation}
        routeCoordinates={routeCoordinates}
        singlePin={
          destPrecision === 'approximate'
            ? null
            : {
                coordinate: destLocation,
                title: propertyTitle,
                variant: 'destination',
              }
        }
        privacyCircle={
          destPrecision === 'approximate'
            ? { center: destLocation, radiusMeters: 450 }
            : null
        }
        onMapReady={onMapReady}
      />
    </View>
  );
}
