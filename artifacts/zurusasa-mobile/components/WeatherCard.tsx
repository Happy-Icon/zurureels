import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { Skeleton } from '@/components/Skeleton';
import type { WeatherData } from '@/lib/weather';

// RN port of the web WeatherWidget (gradient card, 4 stat tiles, tides row).

interface WeatherCardProps {
  weather: WeatherData | null | undefined;
  loading: boolean;
  city: string;
}

function WeatherIcon({ code, color }: { code: number; color: string }) {
  if (code === 0) return <Feather name="sun" size={44} color={color} />;
  if (code <= 2)
    return (
      <MaterialCommunityIcons
        name="weather-partly-cloudy"
        size={46}
        color={color}
      />
    );
  if (code <= 3) return <Feather name="cloud" size={44} color={color} />;
  if (code >= 51 && code <= 82)
    return <Feather name="cloud-rain" size={44} color={color} />;
  return <Feather name="cloud" size={44} color={color} />;
}

export function WeatherCard({ weather, loading, city }: WeatherCardProps) {
  const colors = useColors();

  const gradient = [
    `${colors.primary}33`,
    `${colors.primary}1A`,
    `${colors.primary}00`,
  ] as const;

  if (loading) {
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <Skeleton style={{ height: 20, width: 110 }} />
        <Skeleton style={{ height: 44, width: 90 }} />
        <View style={styles.statsRow}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ flex: 1, height: 64 }} />
          ))}
        </View>
      </LinearGradient>
    );
  }

  if (!weather) {
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { alignItems: 'center' }]}
      >
        <Text style={[styles.unavailable, { color: colors.mutedForeground }]}>
          Weather unavailable
        </Text>
      </LinearGradient>
    );
  }

  const tileBg = `${colors.background}80`;

  return (
    <LinearGradient
      testID="weather-card"
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Current conditions */}
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.city, { color: colors.mutedForeground }]}>
            {city}
          </Text>
          <View style={styles.tempRow}>
            <Text style={[styles.temp, { color: colors.foreground }]}>
              {weather.temperature}°
            </Text>
            <Text style={[styles.tempUnit, { color: colors.mutedForeground }]}>
              C
            </Text>
          </View>
          <Text style={[styles.condition, { color: colors.foreground }]}>
            {weather.condition}
          </Text>
        </View>
        <WeatherIcon code={weather.weatherCode} color={colors.primary} />
      </View>

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <View style={[styles.tile, { backgroundColor: tileBg }]}>
          <Feather name="wind" size={16} color={colors.mutedForeground} />
          <Text style={[styles.tileValue, { color: colors.foreground }]}>
            {weather.wind.speed} km/h
          </Text>
          <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>
            Wind
          </Text>
        </View>
        <View style={[styles.tile, { backgroundColor: tileBg }]}>
          <Feather name="droplet" size={16} color={colors.mutedForeground} />
          <Text style={[styles.tileValue, { color: colors.foreground }]}>
            {weather.humidity}%
          </Text>
          <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>
            Humidity
          </Text>
        </View>
        <View style={[styles.tile, { backgroundColor: tileBg }]}>
          <MaterialCommunityIcons
            name="waves"
            size={16}
            color={colors.mutedForeground}
          />
          <Text style={[styles.tileValue, { color: colors.foreground }]}>
            {weather.wave.height}m
          </Text>
          <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>
            Waves
          </Text>
        </View>
        <View style={[styles.tile, { backgroundColor: tileBg }]}>
          <MaterialCommunityIcons
            name="weather-sunset-up"
            size={16}
            color={colors.mutedForeground}
          />
          <Text style={[styles.tileValue, { color: colors.foreground }]}>
            {weather.sunrise}
          </Text>
          <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>
            Sunrise
          </Text>
        </View>
      </View>

      {/* Tides */}
      <View style={[styles.tidesRow, { backgroundColor: tileBg }]}>
        <View style={styles.tidesLeft}>
          <MaterialCommunityIcons name="waves" size={16} color={colors.primary} />
          <Text style={[styles.tidesTitle, { color: colors.foreground }]}>
            Tides
          </Text>
        </View>
        <View style={styles.tidesRight}>
          <Text style={[styles.tidesValue, { color: colors.foreground }]}>
            High: {weather.tides.high}
          </Text>
          <Text style={[styles.tidesValue, { color: colors.foreground }]}>
            Low: {weather.tides.low}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  city: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  temp: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  tempUnit: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },
  condition: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tile: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 3,
  },
  tileValue: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    textAlign: 'center',
  },
  tileLabel: {
    fontSize: 11,
    fontFamily: 'DMSans_400Regular',
  },
  tidesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 12,
  },
  tidesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tidesTitle: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
  },
  tidesRight: {
    flexDirection: 'row',
    gap: 16,
  },
  tidesValue: {
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  unavailable: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
  },
});
