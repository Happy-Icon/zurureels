import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { MapCanvas } from '@/components/map/MapCanvas';
import type { MapCanvasRef, MapViewportEvent } from '@/components/map/MapCanvas.types';
import { useTheme } from '@/context/ThemeContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import {
  lookupKnownTownCenter,
  mapService,
  type LatLng,
  type PlaceSuggestion,
} from '@/services/mapService';

const ORANGE = '#F26522';

export interface PickedHostLocation {
  latitude: number;
  longitude: number;
  precision: 'exact' | 'approximate';
  city: string;
  formattedAddress: string;
  countryCode: string;
}

export interface HostLocationPickerModalProps {
  visible: boolean;
  initialLocationText?: string;
  initialCoordinates?: LatLng | null;
  initialPrecision?: 'exact' | 'approximate';
  onClose: () => void;
  onConfirm: (picked: PickedHostLocation) => void;
}

export function HostLocationPickerModal({
  visible,
  initialLocationText = 'Diani',
  initialCoordinates,
  initialPrecision = 'exact',
  onClose,
  onConfirm,
}: HostLocationPickerModalProps) {
  const { isDark } = useTheme();
  const { showAlert } = useCustomAlert();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapCanvasRef>(null);

  const fallbackTown = lookupKnownTownCenter(initialLocationText);
  const startCenter = initialCoordinates ?? fallbackTown.coords;

  const [pinCenter, setPinCenter] = useState<LatLng>(startCenter);
  const [precision, setPrecision] = useState<'exact' | 'approximate'>(initialPrecision);
  const [city, setCity] = useState<string>(fallbackTown.label);
  const [formattedAddress, setFormattedAddress] = useState<string>(
    `${fallbackTown.label}, Kenya`,
  );
  const [countryCode, setCountryCode] = useState<string>('KE');

  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);

  const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync initial props when modal opens
  useEffect(() => {
    if (!visible) return;
    const town = lookupKnownTownCenter(initialLocationText);
    const nextCenter = initialCoordinates ?? town.coords;
    setPinCenter(nextCenter);
    setPrecision(initialPrecision);
    setCity(town.label);
    setFormattedAddress(`${town.label}, Kenya`);
    setSuggestions([]);
    setSearchText('');

    if (initialCoordinates) {
      mapService.reverseGeocode(initialCoordinates).then((place) => {
        if (place) {
          setCity(place.city || town.label);
          setFormattedAddress(place.formattedAddress);
          setCountryCode(place.countryCode || 'KE');
        }
      });
    }
  }, [visible, initialLocationText, initialCoordinates, initialPrecision]);

  // Debounced place autocomplete
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchText(text);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

      if (text.trim().length < 2) {
        setSuggestions([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      searchTimerRef.current = setTimeout(async () => {
        const res = await mapService.searchPlaces(text, pinCenter, 6);
        setSuggestions(res);
        setSearching(false);
      }, 320);
    },
    [pinCenter],
  );

  const triggerReverseGeocode = useCallback((coords: LatLng) => {
    if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
    setReverseLoading(true);
    reverseTimerRef.current = setTimeout(async () => {
      const place = await mapService.reverseGeocode(coords);
      if (place) {
        setCity(place.city || 'Kenya');
        setFormattedAddress(place.formattedAddress);
        setCountryCode(place.countryCode || 'KE');
      } else {
        setFormattedAddress(
          `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
        );
      }
      setReverseLoading(false);
    }, 350);
  }, []);

  const handleViewportChange = useCallback(
    (ev: MapViewportEvent) => {
      setPinCenter(ev.center);
      if (ev.userInteraction) {
        triggerReverseGeocode(ev.center);
      }
    },
    [triggerReverseGeocode],
  );

  const handleSelectSuggestion = useCallback((s: PlaceSuggestion) => {
    Keyboard.dismiss();
    const target = { latitude: s.latitude, longitude: s.longitude };
    setPinCenter(target);
    setCity(s.city || s.name);
    setFormattedAddress(s.formattedAddress);
    setCountryCode(s.countryCode || 'KE');
    setSearchText(s.name);
    setSuggestions([]);
    mapRef.current?.flyTo(target, 15.2, 480);
  }, []);

  const handleUseCurrentGps = useCallback(async () => {
    Keyboard.dismiss();
    setLocatingGps(true);
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') {
        showAlert({
          title: 'Location Permission Required',
          message: 'Grant foreground location access to drop a pin at your current GPS position.',
          variant: 'warning',
          icon: 'map-pin',
        });
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: Number(pos.coords.latitude.toFixed(6)),
        longitude: Number(pos.coords.longitude.toFixed(6)),
      };
      setPinCenter(coords);
      mapRef.current?.flyTo(coords, 16, 500);
      triggerReverseGeocode(coords);
    } catch {
      showAlert({
        title: 'GPS Unavailable',
        message: 'Could not read your device location.',
        variant: 'error',
        icon: 'navigation',
      });
    } finally {
      setLocatingGps(false);
    }
  }, [triggerReverseGeocode, showAlert]);

  const handleConfirm = useCallback(() => {
    onConfirm({
      latitude: Number(pinCenter.latitude.toFixed(6)),
      longitude: Number(pinCenter.longitude.toFixed(6)),
      precision,
      city: city.trim() || 'Kenya',
      formattedAddress:
        formattedAddress.trim() ||
        `${pinCenter.latitude.toFixed(5)}, ${pinCenter.longitude.toFixed(5)}`,
      countryCode: countryCode || 'KE',
    });
  }, [pinCenter, precision, city, formattedAddress, countryCode, onConfirm]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <MapCanvas
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialCenter={startCenter}
          initialZoom={initialCoordinates ? 15 : 13}
          theme={isDark ? 'dark' : 'light'}
          interactive
          enableClustering={false}
          privacyCircle={
            precision === 'approximate'
              ? { center: pinCenter, radiusMeters: 450 }
              : null
          }
          onViewportChange={handleViewportChange}
        />

        {/* Center Crosshair Pin Overlay */}
        <View pointerEvents="none" style={styles.centerCrosshairWrap}>
          <View style={styles.crosshairPin}>
            <Ionicons
              name={precision === 'approximate' ? 'shield-checkmark' : 'location'}
              size={20}
              color="#FFFFFF"
            />
          </View>
          <View style={styles.crosshairStem} />
          <View style={styles.crosshairShadow} />
        </View>

        {/* Top Search & Autocomplete Bar */}
        <View
          style={[
            styles.topOverlay,
            { paddingTop: (Platform.OS === 'web' ? 16 : insets.top) + 8 },
          ]}
        >
          <View style={styles.searchRow}>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="arrow-left" size={20} color="#111827" />
            </Pressable>

            <View style={styles.searchBox}>
              <Feather name="search" size={16} color="#6B7280" />
              <TextInput
                placeholder="Search beach, street, hotel, or town in Kenya & Africa…"
                placeholderTextColor="#9CA3AF"
                value={searchText}
                onChangeText={handleSearchChange}
                style={styles.searchInput}
                returnKeyType="search"
              />
              {searching ? (
                <ActivityIndicator size="small" color={ORANGE} />
              ) : searchText.length > 0 ? (
                <Pressable
                  onPress={() => {
                    setSearchText('');
                    setSuggestions([]);
                  }}
                  hitSlop={8}
                >
                  <Feather name="x-circle" size={16} color="#9CA3AF" />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Suggestions Dropdown */}
          {suggestions.length > 0 && (
            <View style={styles.suggestionsCard}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 220 }}
              >
                {suggestions.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => handleSelectSuggestion(s)}
                    style={styles.suggestionRow}
                  >
                    <Ionicons name="location-outline" size={17} color={ORANGE} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suggestionName} numberOfLines={1}>
                        {s.name}
                      </Text>
                      <Text style={styles.suggestionAddr} numberOfLines={1}>
                        {s.formattedAddress}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Right Zoom + Use My GPS Controls */}
        <View style={[styles.rightControls, { bottom: insets.bottom + 245 }]}>
          <Pressable onPress={handleUseCurrentGps} style={styles.gpsFab}>
            {locatingGps ? (
              <ActivityIndicator size="small" color={ORANGE} />
            ) : (
              <Ionicons name="locate" size={20} color={ORANGE} />
            )}
          </Pressable>

          <View style={styles.zoomBox}>
            <Pressable
              onPress={() => mapRef.current?.zoomIn()}
              style={styles.zoomBtn}
            >
              <Feather name="plus" size={18} color="#111827" />
            </Pressable>
            <View style={styles.zoomDiv} />
            <Pressable
              onPress={() => mapRef.current?.zoomOut()}
              style={styles.zoomBtn}
            >
              <Feather name="minus" size={18} color="#111827" />
            </Pressable>
          </View>
        </View>

        {/* Bottom Confirmation & Privacy Precision Sheet */}
        <View
          style={[
            styles.bottomSheet,
            {
              backgroundColor: isDark ? '#18181B' : '#FFFFFF',
              paddingBottom: (Platform.OS === 'web' ? 18 : insets.bottom) + 14,
            },
          ]}
        >
          <View style={styles.resolvedHeader}>
            <View style={styles.pinIconBadge}>
              <Feather name="map-pin" size={16} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.resolvedCity,
                  { color: isDark ? '#F9FAFB' : '#111827' },
                ]}
                numberOfLines={1}
              >
                {reverseLoading ? 'Updating pin address…' : city}
              </Text>
              <Text
                style={[
                  styles.resolvedAddress,
                  { color: isDark ? '#9CA3AF' : '#6B7280' },
                ]}
                numberOfLines={2}
              >
                {formattedAddress}
              </Text>
            </View>
          </View>

          {/* Exact vs ~500m Privacy Toggle */}
          <View style={styles.precisionToggleRow}>
            <Pressable
              onPress={() => setPrecision('exact')}
              style={[
                styles.precisionOption,
                {
                  borderColor:
                    precision === 'exact'
                      ? ORANGE
                      : isDark
                        ? '#27272A'
                        : '#E5E7EB',
                  backgroundColor:
                    precision === 'exact'
                      ? 'rgba(242,101,34,0.1)'
                      : 'transparent',
                },
              ]}
            >
              <Ionicons
                name="location"
                size={15}
                color={precision === 'exact' ? ORANGE : '#9CA3AF'}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.precisionOptionTitle,
                    { color: isDark ? '#F9FAFB' : '#111827' },
                  ]}
                >
                  Exact Pin
                </Text>
                <Text style={styles.precisionOptionSub}>
                  Hotels, tours & dining
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setPrecision('approximate')}
              style={[
                styles.precisionOption,
                {
                  borderColor:
                    precision === 'approximate'
                      ? ORANGE
                      : isDark
                        ? '#27272A'
                        : '#E5E7EB',
                  backgroundColor:
                    precision === 'approximate'
                      ? 'rgba(242,101,34,0.1)'
                      : 'transparent',
                },
              ]}
            >
              <Ionicons
                name="shield-checkmark"
                size={15}
                color={precision === 'approximate' ? ORANGE : '#9CA3AF'}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.precisionOptionTitle,
                    { color: isDark ? '#F9FAFB' : '#111827' },
                  ]}
                >
                  ~500m Circle
                </Text>
                <Text style={styles.precisionOptionSub}>
                  Private stays until booked
                </Text>
              </View>
            </Pressable>
          </View>

          <Pressable onPress={handleConfirm} style={styles.confirmBtn}>
            <Feather name="check" size={17} color="#FFFFFF" />
            <Text style={styles.confirmBtnText}>Confirm Map Location</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111827',
  },
  centerCrosshairWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -21,
    marginTop: -48,
    alignItems: 'center',
    zIndex: 15,
  },
  crosshairPin: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ORANGE,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  crosshairStem: {
    width: 3,
    height: 10,
    backgroundColor: ORANGE,
    marginTop: -1,
  },
  crosshairShadow: {
    width: 10,
    height: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: 1,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    gap: 8,
    zIndex: 30,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  searchBox: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontFamily: 'DMSans_500Medium',
    color: '#111827',
  },
  suggestionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  suggestionName: {
    fontSize: 13.5,
    fontFamily: 'DMSans_700Bold',
    color: '#111827',
  },
  suggestionAddr: {
    fontSize: 11.5,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  rightControls: {
    position: 'absolute',
    right: 14,
    alignItems: 'center',
    gap: 10,
    zIndex: 25,
  },
  gpsFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  zoomBox: {
    width: 42,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  zoomBtn: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDiv: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
    zIndex: 30,
  },
  resolvedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pinIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(242,101,34,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolvedCity: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  resolvedAddress: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    marginTop: 1,
  },
  precisionToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  precisionOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  precisionOptionTitle: {
    fontSize: 12.5,
    fontFamily: 'DMSans_700Bold',
  },
  precisionOptionSub: {
    fontSize: 10.5,
    fontFamily: 'DMSans_400Regular',
    color: '#6B7280',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ORANGE,
    paddingVertical: 14,
    borderRadius: 14,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
  },
});
