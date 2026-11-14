import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { PremiumLoader } from '@/components/PremiumLoader';
import { useColors } from '@/hooks/useColors';
import { fonts } from '@/theme/typography';

export default function PaymentCallbackScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ reference?: string; bookingId?: string }>();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['reservations'] });

    const timer = setTimeout(() => {
      if (params.bookingId) {
        router.replace({
          pathname: '/reservations' as any,
          params: { bookingId: params.bookingId },
        });
      } else {
        router.replace('/reservations' as any);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [params.bookingId, params.reference, queryClient, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <PremiumLoader color="#F26522" size={10} />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        Completing your reservation...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 15,
    textAlign: 'center',
  },
});
