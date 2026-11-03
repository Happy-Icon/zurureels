import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import type { TripDay } from '@/types/zuruPlan';
import { ItineraryItemRow } from './ItineraryItemRow';

export interface ItineraryDayCardProps {
  day: TripDay;
  onBookExperience: (experienceId: string) => void;
  onRegenerateDay: (dayNumber: number) => void;
  onReorderItem: (dayNumber: number, fromIndex: number, toIndex: number) => void;
  isRegenerating?: boolean;
}

export function ItineraryDayCard({
  day,
  onBookExperience,
  onRegenerateDay,
  onReorderItem,
  isRegenerating = false,
}: ItineraryDayCardProps) {
  const colors = useColors();
  const { isDark } = useTheme();

  return (
    <View style={styles.dayBlock}>
      {/* Day Header */}
      <View style={styles.dayHeaderRow}>
        <View style={styles.dayTitleBox}>
          <View style={styles.dayNumberPill}>
            <Text style={styles.dayNumberText}>DAY {day.dayNumber}</Text>
          </View>
          <Text style={[styles.dayThemeText, { color: colors.text }]} numberOfLines={1}>
            {day.theme}
          </Text>
        </View>

        {/* Regenerate Action */}
        <Pressable
          onPress={() => onRegenerateDay(day.dayNumber)}
          disabled={isRegenerating}
          style={[styles.regenBtn, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Regenerate Day ${day.dayNumber} activities`}
        >
          {isRegenerating ? (
            <ActivityIndicator size="small" color="#F26522" />
          ) : (
            <>
              <Feather name="refresh-cw" size={13} color="#F26522" />
              <Text style={styles.regenBtnText}>Regenerate</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Items for this day */}
      <View style={styles.itemsList}>
        {day.items.map((item, index) => (
          <ItineraryItemRow
            key={item.id}
            item={item}
            onBookExperience={onBookExperience}
            canMoveUp={index > 0}
            canMoveDown={index < day.items.length - 1}
            onMoveUp={() => onReorderItem(day.dayNumber, index, index - 1)}
            onMoveDown={() => onReorderItem(day.dayNumber, index, index + 1)}
          />
        ))}
      </View>

      {/* Notes / Tips Card */}
      {day.notes ? (
        <View style={[styles.notesBox, { backgroundColor: isDark ? '#1C1917' : '#FFFBEB', borderColor: isDark ? '#78350F' : '#FEF3C7' }]}>
          <Feather name="info" size={13} color="#D97706" style={{ marginTop: 2 }} />
          <Text style={[styles.notesText, { color: isDark ? '#FDE68A' : '#92400E' }]}>
            {day.notes}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dayBlock: {
    gap: 12,
    marginBottom: 20,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  dayTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  dayNumberPill: {
    backgroundColor: '#F26522',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dayNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.4,
  },
  dayThemeText: {
    fontSize: 16,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.2,
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  regenBtnText: {
    fontSize: 11.5,
    fontFamily: 'DMSans_600SemiBold',
    color: '#F26522',
  },
  itemsList: {
    gap: 2,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
    lineHeight: 17,
  },
});
