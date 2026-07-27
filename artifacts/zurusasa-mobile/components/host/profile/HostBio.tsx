import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface HostBioProps {
  name: string;
  bio: string;
}

export function HostBio({ name, bio }: HostBioProps) {
  const [expanded, setExpanded] = useState(false);

  const isLongBio = bio.length > 140;
  const displayBio = expanded || !isLongBio ? bio : `${bio.substring(0, 140)}...`;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeading}>About {name.split(' ')[0]}</Text>
      <Text style={styles.bioText}>{displayBio}</Text>

      {isLongBio ? (
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
