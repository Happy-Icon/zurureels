import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Skeleton } from '@/components/Skeleton';
import type { WeatherData } from '@/lib/weather';

import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

interface WeatherCardProps {
  weather: WeatherData | null | undefined;
  loading: boolean;
  city: string;
}

function WeatherIconSmall({ code }: { code: number }) {
  if (code === 0) return <Feather name="sun" size={16} color="#F26522" />;
  if (code <= 2)
    return <MaterialCommunityIcons name="weather-partly-cloudy" size={18} color="#F26522" />;
  if (code <= 3) return <Feather name="cloud" size={16} color="#F26522" />;
  if (code >= 51 && code <= 82)
    return <Feather name="cloud-rain" size={16} color="#F26522" />;
  return <Feather name="cloud" size={16} color="#F26522" />;
}

export function WeatherCard({ weather, loading, city }: WeatherCardProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);

  const tileBg = isDark ? '#27272A' : '#F7F7F7';

  if (loading) {
    return (
      <View style={[styles.compactStrip, { backgroundColor: tileBg }]}>
        <Skeleton style={{ height: 18, width: 140, borderRadius: 6 }} />
        <Skeleton style={{ height: 18, width: 120, borderRadius: 6 }} />
      </View>
    );
  }

  if (!weather) {
    return (
      <View style={[styles.compactStrip, { backgroundColor: tileBg }]}>
        <Text style={[styles.unavailableText, { color: colors.mutedForeground }]}>Coastal weather update unavailable</Text>
      </View>
    );
  }

  const handleOpenDetails = () => {
    setModalOpen(true);
  };

  return (
    <View>
      {/* Compact Single-Row Horizontal Contextual Strip */}
      <Pressable
        testID="weather-card"
        onPress={handleOpenDetails}
        style={({ pressed }) => [
          styles.compactStrip,
          { backgroundColor: tileBg, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <View style={styles.stripLeft}>
          <WeatherIconSmall code={weather.weatherCode} />
          <Text style={[styles.stripTempText, { color: colors.text }]}>
            {weather.temperature}°C {weather.condition} · <Text style={[styles.stripCityText, { color: colors.mutedForeground }]}>{city}</Text>
          </Text>
        </View>

        <View style={styles.stripRight}>
          <Text style={[styles.stripMetricText, { color: colors.text }]}>🌊 {weather.wave.height}m</Text>
          <Text style={[styles.stripDivider, { color: colors.mutedForeground }]}>·</Text>
          <Text style={[styles.stripMetricText, { color: colors.text }]}>⌛ High {weather.tides.high}</Text>
          <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ marginLeft: 2 }} />
        </View>
      </Pressable>

      {/* Expanded Weather Modal Sheet */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <View style={{ gap: 2 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Coastal Weather & Marine</Text>
                <Text style={[styles.modalCitySub, { color: colors.mutedForeground }]}>{city} · Live Conditions</Text>
              </View>
              <Pressable
                onPress={() => setModalOpen(false)}
                style={[styles.modalCloseBtn, { backgroundColor: tileBg }]}
                hitSlop={8}
              >
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            <View style={[styles.modalHeroRow, { backgroundColor: tileBg }]}>
              <WeatherIconSmall code={weather.weatherCode} />
              <Text style={[styles.modalTempText, { color: colors.text }]}>{weather.temperature}°C</Text>
              <Text style={[styles.modalCondText, { color: colors.mutedForeground }]}>{weather.condition}</Text>
            </View>

            <View style={styles.modalGrid}>
              <View style={[styles.modalTile, { backgroundColor: tileBg }]}>
                <Feather name="wind" size={16} color="#F26522" />
                <Text style={[styles.modalTileVal, { color: colors.text }]}>{weather.wind.speed} km/h</Text>
                <Text style={[styles.modalTileLabel, { color: colors.mutedForeground }]}>Wind Speed</Text>
              </View>
              <View style={[styles.modalTile, { backgroundColor: tileBg }]}>
                <Feather name="droplet" size={16} color="#F26522" />
                <Text style={[styles.modalTileVal, { color: colors.text }]}>{weather.humidity}%</Text>
                <Text style={[styles.modalTileLabel, { color: colors.mutedForeground }]}>Humidity</Text>
              </View>
              <View style={[styles.modalTile, { backgroundColor: tileBg }]}>
                <MaterialCommunityIcons name="waves" size={16} color="#F26522" />
                <Text style={[styles.modalTileVal, { color: colors.text }]}>{weather.wave.height}m</Text>
                <Text style={[styles.modalTileLabel, { color: colors.mutedForeground }]}>Wave Height</Text>
              </View>
              <View style={[styles.modalTile, { backgroundColor: tileBg }]}>
                <MaterialCommunityIcons name="weather-sunset-up" size={16} color="#F26522" />
                <Text style={[styles.modalTileVal, { color: colors.text }]}>{weather.sunrise}</Text>
                <Text style={[styles.modalTileLabel, { color: colors.mutedForeground }]}>Sunrise</Text>
              </View>
            </View>

            <View style={[styles.tidesBox, { backgroundColor: tileBg }]}>
              <Text style={[styles.tidesBoxTitle, { color: colors.text }]}>Tide Timings</Text>
              <View style={styles.tidesBoxRow}>
                <Text style={[styles.tideText, { color: colors.text }]}>High Tide: <Text style={{ fontFamily: 'DMSans_700Bold' }}>{weather.tides.high}</Text></Text>
                <Text style={[styles.tideText, { color: colors.text }]}>Low Tide: <Text style={{ fontFamily: 'DMSans_700Bold' }}>{weather.tides.low}</Text></Text>
              </View>
            </View>

            <Pressable
              onPress={() => setModalOpen(false)}
              style={[styles.modalDoneBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  compactStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  stripLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  stripTempText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#222222',
  },
  stripCityText: {
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  stripRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stripMetricText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  stripDivider: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  unavailableText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  modalCitySub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F7F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 16,
  },
  modalTempText: {
    fontSize: 26,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  modalCondText: {
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
    marginLeft: 'auto',
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalTile: {
    width: '48%',
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  modalTileVal: {
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  modalTileLabel: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
  },
  tidesBox: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  tidesBoxTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  tidesBoxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tideText: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#222222',
  },
  modalDoneBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  modalDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
