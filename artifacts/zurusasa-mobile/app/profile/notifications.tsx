import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ScreenHeader } from '@/components/profile/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';

const WHATSAPP_GREEN = '#25D366';

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
  { value: 'daily', label: 'Daily Digest' },
  { value: 'weekly', label: 'Weekly Summary' },
  { value: 'monthly', label: 'Monthly Newsletter' },
];

export default function NotificationsScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

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

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notification_settings: settings })
        .eq('id', user.id);
      if (error) throw error;
      Alert.alert('Saved', 'Notification preferences saved');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const updateChannel = (key: keyof NotificationSettings['channels'], value: boolean) =>
    setSettings((p) => ({ ...p, channels: { ...p.channels, [key]: value } }));
  const updateTrips = (key: keyof NotificationSettings['trips'], value: boolean) =>
    setSettings((p) => ({ ...p, trips: { ...p.trips, [key]: value } }));
  const updateMarketing = (key: keyof NotificationSettings['marketing'], value: any) =>
    setSettings((p) => ({ ...p, marketing: { ...p.marketing, [key]: value } }));

  if (pageLoading) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
        <ScreenHeader />
        <View style={[styles.fill, styles.centered]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  const emailOff = !settings.channels.email;

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: `${colors.primary}0D`, borderColor: `${colors.primary}33` },
          ]}
        >
          <View style={[styles.heroIcon, { backgroundColor: `${colors.primary}1A` }]}>
            <Feather name="bell" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              Communication Preferences
            </Text>
            <Text style={[styles.mutedSmall, { color: colors.mutedForeground }]}>
              Choose how and when we contact you.
            </Text>
          </View>
        </View>

        {/* Channels */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Communication Channels
        </Text>
        <ChannelRow
          icon={<Feather name="mail" size={19} color={colors.mutedForeground} />}
          label="Email"
          value={settings.channels.email}
          onChange={(v) => updateChannel('email', v)}
          colors={colors}
        />
        <ChannelRow
          icon={<Feather name="smartphone" size={19} color={colors.mutedForeground} />}
          label="SMS Messages"
          value={settings.channels.sms}
          onChange={(v) => updateChannel('sms', v)}
          colors={colors}
        />
        <ChannelRow
          icon={<Feather name="globe" size={19} color={colors.mutedForeground} />}
          label="Push Notifications"
          value={settings.channels.push}
          onChange={(v) => updateChannel('push', v)}
          colors={colors}
        />
        <ChannelRow
          icon={<MaterialCommunityIcons name="whatsapp" size={20} color={WHATSAPP_GREEN} />}
          label="WhatsApp"
          value={settings.channels.whatsapp}
          onChange={(v) => updateChannel('whatsapp', v)}
          colors={colors}
          activeColor={WHATSAPP_GREEN}
        />

        {/* Trips */}
        <View style={[styles.sectionHeader]}>
          <Feather name="calendar" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitleInline, { color: colors.foreground }]}>
            Trip Notifications
          </Text>
        </View>
        <ToggleLine
          label="Booking Status Updates"
          value={settings.trips.bookings}
          onChange={(v) => updateTrips('bookings', v)}
          colors={colors}
        />
        <ToggleLine
          label="Trip Check-in Reminders"
          value={settings.trips.checkin}
          onChange={(v) => updateTrips('checkin', v)}
          colors={colors}
        />
        <ToggleLine
          label="Host Messages"
          value={settings.trips.messages}
          onChange={(v) => updateTrips('messages', v)}
          colors={colors}
        />

        {/* Security */}
        <View style={[styles.sectionHeader]}>
          <Feather name="shield" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitleInline, { color: colors.foreground }]}>
            Account & Security
          </Text>
        </View>
        <View
          style={[
            styles.securityBox,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <ToggleLine
            label="New Device Login"
            sub="Always on for your security"
            value
            disabled
            onChange={() => {}}
            colors={colors}
          />
          <ToggleLine
            label="Password Changes"
            sub="Always on for your security"
            value
            disabled
            onChange={() => {}}
            colors={colors}
          />
        </View>

        {/* Marketing */}
        <View style={[styles.sectionHeader]}>
          <Feather name="tag" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitleInline, { color: colors.foreground }]}>
            Marketing & Tips
          </Text>
        </View>
        {emailOff ? (
          <View style={styles.warningBox}>
            <Feather name="mail" size={15} color="#c2410c" />
            <Text style={styles.warningText}>
              Email notifications are turned off globally. Enable Email above to customize
              these.
            </Text>
          </View>
        ) : null}
        <View style={{ opacity: emailOff ? 0.5 : 1 }} pointerEvents={emailOff ? 'none' : 'auto'}>
          <ToggleLine
            label="Price Drops & Deals"
            value={settings.marketing.price_drops}
            onChange={(v) => updateMarketing('price_drops', v)}
            colors={colors}
          />
          <ToggleLine
            label="Personalized Recommendations"
            value={settings.marketing.recommendations}
            onChange={(v) => updateMarketing('recommendations', v)}
            colors={colors}
          />
          <ToggleLine
            label="ZuruSasa Newsletter"
            value={settings.marketing.newsletter}
            onChange={(v) => updateMarketing('newsletter', v)}
            colors={colors}
          />

          <Text style={[styles.mutedSmall, { color: colors.mutedForeground, marginTop: 10 }]}>
            Email Frequency
          </Text>
          <View style={[styles.pillsRow, { opacity: settings.marketing.newsletter ? 1 : 0.5 }]}>
            {FREQUENCIES.map((f) => {
              const selected = settings.marketing.frequency === f.value;
              return (
                <Pressable
                  key={f.value}
                  disabled={!settings.marketing.newsletter}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateMarketing('frequency', f.value);
                  }}
                  style={[
                    styles.pill,
                    selected
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: 'transparent', borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: selected ? '#ffffff' : colors.mutedForeground },
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Save */}
        <Pressable
          testID="save-notifications"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: colors.primary, opacity: pressed || saving ? 0.85 : 1 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Feather name="save" size={16} color="#ffffff" />
          )}
          <Text style={styles.saveButtonText}>Save Preferences</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function ChannelRow({
  icon,
  label,
  value,
  onChange,
  colors,
  activeColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: ReturnType<typeof useColors>;
  activeColor?: string;
}) {
  return (
    <View
      style={[
        styles.channelRow,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.row}>
        {icon}
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: activeColor ?? colors.primary, false: colors.border }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

function ToggleLine({
  label,
  sub,
  value,
  onChange,
  colors,
  disabled,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: ReturnType<typeof useColors>;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.toggleLine, { opacity: disabled ? 0.7 : 1 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
        {sub ? (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>{sub}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 48 },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 16, fontFamily: 'DMSans_600SemiBold' },
  mutedSmall: { fontSize: 13, fontFamily: 'DMSans_400Regular' },
  hint: { fontSize: 11, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_600SemiBold',
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 8,
  },
  sectionTitleInline: { fontSize: 17, fontFamily: 'DMSans_600SemiBold' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { fontSize: 14, fontFamily: 'DMSans_500Medium' },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  toggleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 12,
  },
  securityBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#c2410c',
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: { fontSize: 13, fontFamily: 'DMSans_500Medium' },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 14,
    marginTop: 28,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
