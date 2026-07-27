import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { Skeleton } from '@/components/Skeleton';

interface NotificationSettings {
  channels: { email: boolean; sms: boolean; push: boolean; whatsapp: boolean };
  trips: { bookings: boolean; checkin: boolean; messages: boolean };
  security: { login: boolean; password: boolean };
  marketing: {
    price_drops: boolean;
    recommendations: boolean;
    newsletter: boolean;
    frequency: string;
  };
}

const DEFAULT_SETTINGS: NotificationSettings = {
  channels: { email: true, sms: true, push: true, whatsapp: false },
  trips: { bookings: true, checkin: true, messages: true },
  security: { login: true, password: true },
  marketing: {
    price_drops: false,
    recommendations: true,
    newsletter: true,
    frequency: 'weekly',
  },
};

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

export default function NotificationsPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 100 : insets.bottom + 40;

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('notification_settings')
          .eq('id', user.id)
          .single();
        if (data?.notification_settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...(data.notification_settings as any) });
        }
      } catch (e) {
        console.error('Error loading notifications:', e);
      } finally {
        setPageLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  // Instant Auto-Save Helper
  const autoSaveSettings = async (newSettings: NotificationSettings) => {
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({ notification_settings: newSettings })
        .eq('id', user.id);
    } catch (e) {
      console.error('Auto-save error:', e);
    }
  };

  const updateSetting = (updater: (prev: NotificationSettings) => NotificationSettings) => {
    setSettings((prev) => {
      const next = updater(prev);
      autoSaveSettings(next);
      return next;
    });
  };

  if (pageLoading) {
    return (
      <View style={[styles.fill, { backgroundColor: '#FFFFFF', paddingTop: topPad, paddingHorizontal: 20, gap: 20 }]}>
        <Skeleton style={{ height: 28, width: 180, borderRadius: 6 }} />
        <Skeleton style={{ height: 14, width: 260, borderRadius: 4 }} />
        <Skeleton style={{ height: 16, width: 140, borderRadius: 4, marginTop: 12 }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ gap: 6, flex: 1 }}>
              <Skeleton style={{ height: 16, width: 140, borderRadius: 4 }} />
              <Skeleton style={{ height: 12, width: 220, borderRadius: 4 }} />
            </View>
            <Skeleton style={{ width: 44, height: 24, borderRadius: 12 }} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: '#FFFFFF' }]}>
      {/* 1. Header Bar & Navigation */}
      <View style={[styles.topNavBar, { paddingTop: topPad }]}>
        <Pressable
          testID="notifications-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/profile');
          }}
          style={({ pressed }) => [styles.backIconBtn, { opacity: pressed ? 0.6 : 1 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color="#222222" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Notifications</Text>
          <Text style={styles.pageSub}>
            Choose how you receive travel alerts, updates, and recommendations.
          </Text>
        </View>

        {/* SECTION 1: TRAVEL & BOOKING UPDATES */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Travel & Booking Updates</Text>

          <SettingToggleRow
            title="Booking Status Updates"
            subtext="Receive real-time alerts about your reservations and confirmation status."
            value={settings.trips.bookings}
            onValueChange={(val) =>
              updateSetting((p) => ({ ...p, trips: { ...p.trips, bookings: val } }))
            }
          />

          <SettingToggleRow
            title="Trip Check-in Reminders"
            subtext="Get timely notifications for upcoming trip check-ins and directions."
            value={settings.trips.checkin}
            onValueChange={(val) =>
              updateSetting((p) => ({ ...p, trips: { ...p.trips, checkin: val } }))
            }
          />

          <SettingToggleRow
            title="Host Messages"
            subtext="Alerts when your host sends a message or responds to your inquiries."
            value={settings.trips.messages}
            isLast
            onValueChange={(val) =>
              updateSetting((p) => ({ ...p, trips: { ...p.trips, messages: val } }))
            }
          />
        </View>

        <View style={styles.sectionDivider} />

        {/* SECTION 2: COMMUNICATION CHANNELS */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Notification Channels</Text>

          <SettingToggleRow
            title="Email Notifications"
            subtext="Trip receipts, reservation details, and account summary emails."
            value={settings.channels.email}
            onValueChange={(val) =>
              updateSetting((p) => ({ ...p, channels: { ...p.channels, email: val } }))
            }
          />

          <SettingToggleRow
            title="Push Notifications"
            subtext="Instant alerts directly on your device lock screen."
            value={settings.channels.push}
            onValueChange={(val) =>
              updateSetting((p) => ({ ...p, channels: { ...p.channels, push: val } }))
            }
          />

          <SettingToggleRow
            title="SMS Text Messages"
            subtext="Urgent trip updates sent via SMS."
            value={settings.channels.sms}
            onValueChange={(val) =>
              updateSetting((p) => ({ ...p, channels: { ...p.channels, sms: val } }))
            }
          />

          <SettingToggleRow
            title="WhatsApp Messages"
            subtext="Receive booking vouchers and live concierge assistance on WhatsApp."
            value={settings.channels.whatsapp}
            isLast
            onValueChange={(val) =>
              updateSetting((p) => ({ ...p, channels: { ...p.channels, whatsapp: val } }))
            }
          />
        </View>

        <View style={styles.sectionDivider} />

        {/* SECTION 3: ACCOUNT SECURITY */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Account Security</Text>

          <View style={styles.settingRow}>
            <View style={styles.textColumn}>
              <Text style={styles.rowTitle}>New Device Logins</Text>
              <Text style={styles.rowSubtext}>Security notifications when a new device accesses your account.</Text>
            </View>
            <Text style={styles.requiredLabel}>Required</Text>
          </View>
          <View style={styles.rowDivider} />

          <View style={styles.settingRow}>
            <View style={styles.textColumn}>
              <Text style={styles.rowTitle}>Password & Auth Changes</Text>
              <Text style={styles.rowSubtext}>Alerts whenever your account password or security key is updated.</Text>
            </View>
            <Text style={styles.requiredLabel}>Required</Text>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        {/* SECTION 4: PROMOTIONS & RECOMMENDATIONS */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeading}>Promotions & Recommendations</Text>

          <SettingToggleRow
            title="Price Drops & Coastal Deals"
            subtext="Get notified when stays or experiences on your wishlist go on sale."
            value={settings.marketing.price_drops}
            onValueChange={(val) =>
              updateSetting((p) => ({ ...p, marketing: { ...p.marketing, price_drops: val } }))
            }
          />

          <SettingToggleRow
            title="Personalized Recommendations"
            subtext="Curated stays, tours, and hidden coastal spots tailored to your tastes."
            value={settings.marketing.recommendations}
            onValueChange={(val) =>
              updateSetting((p) => ({ ...p, marketing: { ...p.marketing, recommendations: val } }))
            }
          />

          <SettingToggleRow
            title="ZuruSasa Newsletter"
            subtext="Travel guides, seasonal stories, and news from the Kenyan coast."
            value={settings.marketing.newsletter}
            isLast={!settings.marketing.newsletter}
            onValueChange={(val) =>
              updateSetting((p) => ({ ...p, marketing: { ...p.marketing, newsletter: val } }))
            }
          />

          {/* Email Frequency Native Segmented Control */}
          {settings.marketing.newsletter ? (
            <View style={styles.frequencyWrap}>
              <Text style={styles.frequencyLabel}>Email Digest Frequency</Text>
              <View style={styles.segmentedControlTrack}>
                {FREQUENCIES.map((f) => {
                  const isSelected = settings.marketing.frequency === f.value;
                  return (
                    <Pressable
                      key={f.value}
                      onPress={() =>
                        updateSetting((p) => ({
                          ...p,
                          marketing: { ...p.marketing, frequency: f.value },
                        }))
                      }
                      style={[
                        styles.segmentedTile,
                        isSelected ? styles.segmentedTileActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentedTileText,
                          isSelected ? styles.segmentedTileTextActive : null,
                        ]}
                      >
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function SettingToggleRow({
  title,
  subtext,
  value,
  onValueChange,
  isLast,
}: {
  title: string;
  subtext?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View>
      <View style={styles.settingRow}>
        <View style={styles.textColumn}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtext ? <Text style={styles.rowSubtext}>{subtext}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ true: '#F26522', false: '#EBEBEB' }}
          thumbColor="#FFFFFF"
        />
      </View>
      {!isLast ? <View style={styles.rowDivider} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  topNavBar: {
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    marginTop: 8,
    marginBottom: 24,
    gap: 6,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    letterSpacing: -0.4,
  },
  pageSub: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    lineHeight: 20,
  },
  sectionBlock: {
    gap: 4,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 16,
  },
  textColumn: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: '#222222',
  },
  rowSubtext: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    lineHeight: 18,
  },
  requiredLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#9CA3AF',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#EBEBEB',
    marginVertical: 24,
  },
  frequencyWrap: {
    marginTop: 14,
    gap: 8,
  },
  frequencyLabel: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  segmentedControlTrack: {
    flexDirection: 'row',
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
    padding: 3,
  },
  segmentedTile: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentedTileActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentedTileText: {
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
  segmentedTileTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
  },
});
