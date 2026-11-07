import React, { useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { MapCanvas } from '@/components/map/MapCanvas';
import type { MapCanvasRef } from '@/components/map/MapCanvas.types';
import { useTheme } from '@/context/ThemeContext';
import type { ExperienceRow } from '@/lib/supabase';
import {
  mapService,
  resolveExperienceCoords,
  type LatLng,
} from '@/services/mapService';

const ORANGE = '#F26522';

export interface ListingLocationMapCardProps {
  experience?: Partial<ExperienceRow> | null;
  reelCoords?: { lat?: number | null; lng?: number | null } | null;
  themeOverride?: 'light' | 'dark';
}

export function ListingLocationMapCard({
  experience,
  reelCoords,
  themeOverride,
}: ListingLocationMapCardProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const fullScreenMapRef = useRef<MapCanvasRef>(null);
  const [expanded, setExpanded] = useState(false);

  const mapTheme = themeOverride ?? (isDark ? 'dark' : 'light');

  const resolved = useMemo(
    () => resolveExperienceCoords(experience, reelCoords),
    [experience, reelCoords],
  );

  const center = useMemo<LatLng>(() => {
    if (resolved.hasPin && resolved.latitude !== null && resolved.longitude !== null) {
      return { latitude: resolved.latitude, longitude: resolved.longitude };
    }
    return resolved.townCenter;
  }, [resolved]);

  const initialZoom =
    resolved.precision === 'exact'
      ? 14.5
      : resolved.precision === 'approximate'
        ? 13.6
        : 11.8;

  const singlePin =
    resolved.precision === 'exact'
      ? { coordinate: center, title: experience?.title ?? resolved.city }
      : null;

  const privacyCircle =
    resolved.precision === 'approximate'
      ? { center, radiusMeters: 450 }
      : null;

  const badgeLabel =
    resolved.precision === 'exact'
      ? 'Exact location'
      : resolved.precision === 'approximate'
        ? 'Exact location provided after booking'
        : `${resolved.city} area · Host has not dropped exact street pin yet`;

  return (
    <>
      <View style={styles.wrapper}>
        <Text style={styles.addressSubtitle}>
          {resolved.hasPin ? resolved.formattedAddress : `${resolved.city}, Kenya`}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Expand neighborhood map"
          onPress={() => setExpanded(true)}
          style={styles.cardContainer}
        >
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <MapCanvas
              initialCenter={center}
              initialZoom={initialZoom}
              theme={mapTheme}
              interactive={false}
              singlePin={singlePin}
              privacyCircle={privacyCircle}
              enableClustering={false}
            />
          </View>

          {/* Bottom-left Precision / Privacy Badge */}
          <View style={styles.precisionBadge}>
            <Ionicons
              name={
                resolved.precision === 'approximate'
                  ? 'shield-checkmark-outline'
                  : 'location-outline'
              }
              size={13}
              color={ORANGE}
            />
            <Text style={styles.precisionText} numberOfLines={1}>
              {badgeLabel}
            </Text>
          </View>

          {/* Top-right Expand Button */}
          <View style={styles.expandChip}>
            <Feather name="maximize-2" size={13} color="#111827" />
            <Text style={styles.expandChipText}>Explore map</Text>
          </View>
        </Pressable>
      </View>

      {/* Full-Screen Interactive Neighborhood Map Modal */}
      <Modal
        visible={expanded}
        animationType="slide"
        onRequestClose={() => setExpanded(false)}
      >
        <View style={styles.modalRoot}>
          <MapCanvas
            ref={fullScreenMapRef}
            style={StyleSheet.absoluteFill}
            initialCenter={center}
            initialZoom={initialZoom + 0.6}
            theme={mapTheme}
            interactive
            singlePin={singlePin}
            privacyCircle={privacyCircle}
            enableClustering={false}
          />

          {/* Top Header Overlay */}
          <View
            style={[
              styles.modalTopBar,
              { paddingTop: (Platform.OS === 'web' ? 16 : insets.top) + 8 },
            ]}
          >
            <Pressable
              onPress={() => setExpanded(false)}
              style={styles.modalCloseBtn}
            >
              <Feather name="x" size={20} color="#111827" />
            </Pressable>

            <View style={styles.modalTitleCard}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {experience?.title || resolved.city}
              </Text>
              <Text style={styles.modalSub} numberOfLines={1}>
                {badgeLabel}
              </Text>
            </View>
          </View>

          {/* Right Zoom Controls */}
          <View style={[styles.modalZoomCol, { bottom: insets.bottom + 104 }]}>
            <Pressable
              onPress={() => fullScreenMapRef.current?.zoomIn()}
              style={styles.modalZoomBtn}
            >
              <Feather name="plus" size={18} color="#111827" />
            </Pressable>
            <View style={styles.modalZoomDivider} />
            <Pressable
              onPress={() => fullScreenMapRef.current?.zoomOut()}
              style={styles.modalZoomBtn}
            >
              <Feather name="minus" size={18} color="#111827" />
            </Pressable>
          </View>

          {/* Bottom Action Bar */}
          <View
            style={[
              styles.modalBottomBar,
              { paddingBottom: (Platform.OS === 'web' ? 18 : insets.bottom) + 12 },
            ]}
          >
            <Pressable
              onPress={() => fullScreenMapRef.current?.flyTo(center, initialZoom + 0.8, 420)}
              style={styles.recenterBtn}
            >
              <Ionicons name="locate" size={16} color="#111827" />
              <Text style={styles.recenterBtnText}>Re-center</Text>
            </Pressable>

            {resolved.precision === 'exact' && (
              <Pressable
                onPress={() =>
                  mapService.openExternalNavigation(
                    center,
                    experience?.title ?? resolved.city,
                  )
                }
                style={styles.openMapsBtn}
              >
                <Ionicons name="navigate" size={15} color="#FFFFFF" />
                <Text style={styles.openMapsBtnText}>Directions in Maps</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  addressSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  cardContainer: {
    width: '100%',
    height: 210,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  precisionBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    right: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  precisionText: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#1F2937',
  },
  expandChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  expandChipText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#111827',
  },
  modalTopBar: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
  },
  modalCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  modalTitleCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  modalTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  modalSub: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
    marginTop: 1,
  },
  modalZoomCol: {
    position: 'absolute',
    right: 16,
    width: 42,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
    zIndex: 20,
  },
  modalZoomBtn: {
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalZoomDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  modalBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    zIndex: 20,
  },
  recenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  recenterBtnText: {
    fontSize: 13,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  openMapsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: ORANGE,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    shadowColor: ORANGE,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  openMapsBtnText: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: '#FFFFFF',
  },
});
