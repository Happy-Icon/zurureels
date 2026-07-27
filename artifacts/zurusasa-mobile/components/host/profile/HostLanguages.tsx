import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface HostLanguagesProps {
  languages?: string[];
}

export function HostLanguages({ languages }: HostLanguagesProps) {
  const list = languages && languages.length > 0 ? languages : ['English', 'Kiswahili'];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeading}>Spoken Languages</Text>
      <View style={styles.pillContainer}>
        {list.map((lang, idx) => (
          <View key={idx} style={styles.langPill}>
            <Feather name="globe" size={13} color="#F26522" />
            <Text style={styles.langText}>{lang}</Text>
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
