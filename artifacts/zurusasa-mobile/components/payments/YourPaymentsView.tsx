import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { paymentsStyles as styles } from './paymentsStyles';

export interface YourPaymentsViewProps {
  userBookings: any[];
  onBack: () => void;
  topPad: number;
  bottomPad: number;
}

export function YourPaymentsView({
  userBookings,
  onBack,
  topPad,
  bottomPad,
}: YourPaymentsViewProps) {
  const colors = useColors();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerRow, { paddingTop: topPad }]}>
        <Pressable
          onPress={onBack}
          style={styles.circleBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to payments hub"
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { flexGrow: 1, justifyContent: 'space-between', paddingBottom: bottomPad },
        ]}
      >
        <View>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Your payments</Text>
          <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
            Once you have a reservation, this is where you can come to track your payments and refunds.
          </Text>

          {userBookings.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={[styles.sectionHeader, { color: colors.text }]}>Recent Bookings</Text>
              {userBookings.map((b) => (
                <View key={b.id} style={[styles.bookingPaymentRow, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bookingRowTitle, { color: colors.text }]}>{b.trip_title || 'Coastal Getaway'}</Text>
                    <Text style={[styles.bookingRowSub, { color: colors.mutedForeground }]}>
                      Ref: {b.payment_reference || b.id.slice(0, 8)} · {b.status?.toUpperCase() || 'PAID'}
                    </Text>
                  </View>
                  <Text style={[styles.bookingRowAmount, { color: colors.text }]}>
                    KES {Number(b.amount ?? 0).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={[styles.helpFooter, { borderTopColor: colors.border }]}>
          <Text style={[styles.helpFooterText, { color: colors.mutedForeground }]}>
            To find another payment, try our{' '}
            <Text
              onPress={() => router.push('/profile/support')}
              style={[styles.underlineLinkBold, { color: colors.text }]}
              accessibilityRole="link"
            >
              Help Centre
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
