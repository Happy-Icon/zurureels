import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';
import { Skeleton } from '@/components/Skeleton';

export default function NotificationsSettingsCenter() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [pageLoading, setPageLoading] = useState(true);
  const [settings, setSettings] = useState({
    booking_requests: true,
    booking_confirmations: true,
    trip_reminders: true,
    messages: true,
    price_drops: false,
    recommendations: true,
    newsletter: false,
  });

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 12;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 50;

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) {
        setPageLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('profiles')
          .select('notification_settings')
          .eq('id', user.id)
          .single();

        if (data?.notification_settings) {
          const loaded = data.notification_settings as any;
          setSettings((prev) => ({ ...prev, ...(loaded ?? {}) }));
        }
      } catch (e) {
        console.error('Error fetching notification settings:', e);
      } finally {
        setPageLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  const toggleSetting = async (key: keyof typeof settings, val: boolean) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({ notification_settings: next })
        .eq('id', user.id);
    } catch (e) {
      console.error('Save notification settings error:', e);
    }
  };

  if (pageLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPad, paddingHorizontal: 24, gap: 16 }]}>
        <Skeleton style={{ height: 40, width: 40, borderRadius: 20 }} />
        <Skeleton style={{ height: 32, width: 220, borderRadius: 8 }} />
        <Skeleton style={{ height: 160, borderRadius: 16 }} />
        <Skeleton style={{ height: 140, borderRadius: 16 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable
          testID="notifications-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/profile');
          }}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnActive]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={20} color="#000000" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Notifications</Text>
        </View>

        {/* ── SECTION 1: TRAVEL & BOOKINGS ─────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Travel & booking updates</Text>

          <View style={styles.toggleRow}>
            <View style={styles.menuTextStack}>
              <Text style={styles.menuRowTitle}>Booking requests</Text>
              <Text style={styles.menuRowSub}>Notifications when a host receives your booking inquiry</Text>
            </View>
            <Switch
              value={settings.booking_requests}
              onValueChange={(v) => toggleSetting('booking_requests', v)}
              trackColor={{ false: '#E5E7EB', true: '#000000' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.menuTextStack}>
              <Text style={styles.menuRowTitle}>Booking confirmations</Text>
              <Text style={styles.menuRowSub}>Instant confirmation alerts for accepted stays & experiences</Text>
            </View>
            <Switch
              value={settings.booking_confirmations}
              onValueChange={(v) => toggleSetting('booking_confirmations', v)}
              trackColor={{ false: '#E5E7EB', true: '#000000' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.menuTextStack}>
              <Text style={styles.menuRowTitle}>Trip reminders</Text>
              <Text style={styles.menuRowSub}>Directions, keycodes & check-in guidelines prior to arrival</Text>
            </View>
            <Switch
              value={settings.trip_reminders}
              onValueChange={(v) => toggleSetting('trip_reminders', v)}
              trackColor={{ false: '#E5E7EB', true: '#000000' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ── SECTION 2: MESSAGES ───────────────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Messages & communication</Text>

          <View style={styles.toggleRow}>
            <View style={styles.menuTextStack}>
              <Text style={styles.menuRowTitle}>Host & guest messages</Text>
              <Text style={styles.menuRowSub}>Direct chat messages regarding your reservations</Text>
            </View>
            <Switch
              value={settings.messages}
              onValueChange={(v) => toggleSetting('messages', v)}
              trackColor={{ false: '#E5E7EB', true: '#000000' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ── SECTION 3: OFFERS & DISCOVERY ─────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Offers & recommendations</Text>

          <View style={styles.toggleRow}>
            <View style={styles.menuTextStack}>
              <Text style={styles.menuRowTitle}>Price drops</Text>
              <Text style={styles.menuRowSub}>Alerts when stays on your wishlist drop in price</Text>
            </View>
            <Switch
              value={settings.price_drops}
              onValueChange={(v) => toggleSetting('price_drops', v)}
              trackColor={{ false: '#E5E7EB', true: '#000000' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.menuTextStack}>
              <Text style={styles.menuRowTitle}>Personalized recommendations</Text>
              <Text style={styles.menuRowSub}>Curated stays and experiences tailored to your travel history</Text>
            </View>
            <Switch
              value={settings.recommendations}
              onValueChange={(v) => toggleSetting('recommendations', v)}
              trackColor={{ false: '#E5E7EB', true: '#000000' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ── SECTION 4: TEST PUSH NOTIFICATION ─────────────────────────── */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Device push test</Text>
          <Text style={[styles.menuRowSub, { marginBottom: 12 }]}>
            Verify that your device token is registered in Supabase and native alerts are working.
          </Text>
          <Pressable
            testID="send-test-push-btn"
            onPress={async () => {
              if (!user) return;
              try {
                await notificationService.registerPushToken(user.id);
                const res = await notificationService.triggerTestPush(user.id);
                if (res.success) {
                  alert(res.error || 'Test notification sent! Check your notification center and device banner.');
                } else {
                  alert(res.error || 'Failed to send test push.');
                }
              } catch (err: any) {
                alert('Test push error: ' + (err?.message || err));
              }
            }}
            style={({ pressed }) => [
              styles.testPushBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Feather name="bell" size={16} color="#FFFFFF" />
            <Text style={styles.testPushBtnText}>Send Test Push Notification</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnActive: {
    backgroundColor: '#E5E7EB',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  titleSection: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.8,
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  menuTextStack: {
    flex: 1,
    paddingRight: 12,
  },
  menuRowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  menuRowSub: {
    fontSize: 13,
    color: '#717171',
    marginTop: 2,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 2,
  },
  testPushBtn: {
    backgroundColor: '#F26522',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  testPushBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
