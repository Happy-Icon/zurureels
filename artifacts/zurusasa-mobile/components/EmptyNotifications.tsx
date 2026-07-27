import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export function EmptyNotifications() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Feather name="bell" size={32} color="#F26522" />
      </View>

      <Text style={styles.headline}>No notifications yet</Text>
      <Text style={styles.subtitle}>
        When bookings, messages, and updates arrive, you'll find them here.
      </Text>

      <Pressable
        onPress={() => router.push('/discover')}
        style={({ pressed }) => [
          styles.ctaBtn,
          { opacity: pressed ? 0.88 : 1 },
        ]}
      >
        <Text style={styles.ctaBtnText}>Explore Experiences</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(242, 101, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  headline: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 290,
    marginBottom: 8,
  },
  ctaBtn: {
    height: 48,
    paddingHorizontal: 32,
    borderRadius: 24,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F26522',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
