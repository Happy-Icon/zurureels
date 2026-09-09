import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface HostBioProps {
  name: string;
  bio?: string | null;
}

export function HostBio({ name, bio }: HostBioProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const cleanBio = (bio || '').trim();
  const hasBio = cleanBio.length > 0;
  const isLongBio = cleanBio.length > 160;
  const displayBio = expanded || !isLongBio ? cleanBio : `${cleanBio.substring(0, 160)}...`;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeading, { color: colors.text }]}>
        About {name.split(' ')[0]}
      </Text>

      {hasBio ? (
        <Text style={[styles.bioText, { color: colors.text }]}>{displayBio}</Text>
      ) : (
        <Text style={[styles.noBioText, { color: colors.mutedForeground }]}>
          {name.split(' ')[0]} has not added a biography yet.
        </Text>
      )}

      {hasBio && isLongBio ? (
        <Pressable
          onPress={() => setExpanded((prev) => !prev)}
          style={({ pressed }) => [styles.toggleBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={styles.toggleText}>{expanded ? 'Show Less' : 'Read More'}</Text>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#F26522" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
  bioText: {
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
    color: '#484848',
    lineHeight: 22,
  },
  noBioText: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  toggleText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },
});
