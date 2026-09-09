import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors, useTheme } from '@/hooks/useColors';

interface HostLanguagesProps {
  languages?: string[];
}

export function HostLanguages({ languages }: HostLanguagesProps) {
  const colors = useColors();
  const { isDark } = useTheme();

  // If host has not configured any spoken languages, do NOT render mock languages
  if (!languages || languages.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeading, { color: colors.text }]}>Spoken Languages</Text>
      <View style={styles.pillContainer}>
        {languages.map((lang, idx) => (
          <View
            key={idx}
            style={[
              styles.langPill,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="globe" size={13} color="#F26522" />
            <Text style={[styles.langText, { color: colors.text }]}>{lang}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#EBEBEB',
  },
  langText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
});
