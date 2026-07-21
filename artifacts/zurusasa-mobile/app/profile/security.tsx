import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ScreenHeader } from '@/components/profile/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/hooks/useColors';

export default function SecurityScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const [twoFactor, setTwoFactor] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<'app' | 'sms'>('app');
  const [loginAlerts, setLoginAlerts] = useState(true);

  const deviceLabel =
    Platform.OS === 'ios'
      ? 'iPhone - ZuruSasa App'
      : Platform.OS === 'android'
        ? 'Android Phone - ZuruSasa App'
        : 'Web Browser - ZuruSasa';

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('security_settings')
          .eq('id', user.id)
          .single();
        if (data?.security_settings) {
          const s = data.security_settings as any;
          setTwoFactor(s.two_factor || false);
          setLoginAlerts(s.login_alerts !== undefined ? s.login_alerts : true);
        }
      } catch (e) {
        console.error('Error fetching settings:', e);
      } finally {
        setPageLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  const handleTestEmail = async () => {
    if (!user?.email) return;
    setSendingTest(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'security',
          email: user.email,
          data: {
            message: 'This is a test security alert triggered from your security settings.',
          },
        },
      });
      if (error) throw error;
      Alert.alert('Sent', 'Test email sent! Check your inbox.');
    } catch (e: any) {
      Alert.alert('Error', 'Failed to send test email: ' + (e.message ?? 'unknown error'));
    } finally {
      setSendingTest(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          security_settings: {
            two_factor: twoFactor,
            login_alerts: loginAlerts,
            sms_notifications: false,
          },
        })
        .eq('id', user.id);
      if (error) throw error;
      Alert.alert('Saved', 'Security settings updated');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

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
            <Feather name="shield" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              Account Security
            </Text>
            <Text style={[styles.mutedSmall, { color: colors.mutedForeground }]}>
              Manage how you sign in and secure your account.
            </Text>
          </View>
        </View>

        {/* Sessions */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Where you are logged in
        </Text>
        <View
          style={[
            styles.sessionCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.sessionIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="smartphone" size={19} color={colors.mutedForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.sessionTitleRow}>
              <Text style={[styles.sessionDevice, { color: colors.foreground }]}>
                {deviceLabel}
              </Text>
              <View style={[styles.currentPill, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.currentPillText, { color: colors.secondaryForeground }]}>
                  Current Device
                </Text>
              </View>
            </View>
            <View style={styles.sessionMeta}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={[styles.sessionMetaText, { color: colors.mutedForeground }]}>
                Current Location
              </Text>
            </View>
            <Text style={[styles.sessionMetaText, { color: colors.mutedForeground }]}>
              Active: Now
            </Text>
          </View>
        </View>

        {/* 2FA */}
        <View style={styles.toggleBlock}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: colors.foreground }]}>
              Two-Factor Authentication (2FA)
            </Text>
            <Text style={[styles.mutedSmall, { color: colors.mutedForeground }]}>
              Add an extra layer of security. We'll verify your identity via SMS or
              Authenticator App when logging in.
            </Text>
          </View>
          <Switch
            value={twoFactor}
            onValueChange={setTwoFactor}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#ffffff"
          />
        </View>

        {twoFactor ? (
          <View
            style={[
              styles.methodBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.methodTitle, { color: colors.foreground }]}>
              Preferred Method
            </Text>
            <View style={styles.methodRow}>
              {(
                [
                  { key: 'app', label: 'Authenticator App' },
                  { key: 'sms', label: 'SMS Message' },
                ] as const
              ).map((m) => {
                const selected = twoFactorMethod === m.key;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTwoFactorMethod(m.key);
                    }}
                    style={[
                      styles.methodButton,
                      selected
                        ? {
                            borderColor: colors.primary,
                            backgroundColor: `${colors.primary}0D`,
                          }
                        : { borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodButtonText,
                        { color: selected ? colors.primary : colors.foreground },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Login alerts */}
        <View style={styles.toggleBlock}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: colors.foreground }]}>Login Alerts</Text>
            <Text style={[styles.mutedSmall, { color: colors.mutedForeground }]}>
              Get notified via email if someone logs into your account from an unrecognized
              device.
            </Text>
          </View>
          <Switch
            value={loginAlerts}
            onValueChange={setLoginAlerts}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#ffffff"
          />
        </View>

        <Pressable
          testID="send-test-alert"
          onPress={handleTestEmail}
          disabled={sendingTest}
          style={({ pressed }) => [
            styles.outlineButton,
            { borderColor: colors.border, opacity: pressed || sendingTest ? 0.7 : 1 },
          ]}
        >
          {sendingTest ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <Feather name="mail" size={15} color={colors.foreground} />
          )}
          <Text style={[styles.outlineButtonText, { color: colors.foreground }]}>
            Send Test Alert
          </Text>
        </Pressable>

        {/* Save */}
        <Pressable
          testID="save-security"
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
          <Text style={styles.saveButtonText}>Save Security Settings</Text>
        </Pressable>
      </ScrollView>
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
  mutedSmall: { fontSize: 13, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'DMSans_600SemiBold',
    marginBottom: 10,
  },
  sessionCard: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sessionDevice: { fontSize: 14, fontFamily: 'DMSans_500Medium' },
  currentPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  currentPillText: { fontSize: 10, fontFamily: 'DMSans_500Medium' },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  sessionMetaText: { fontSize: 12, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  toggleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  toggleTitle: { fontSize: 15, fontFamily: 'DMSans_600SemiBold' },
  methodBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 8,
  },
  methodTitle: { fontSize: 13, fontFamily: 'DMSans_600SemiBold' },
  methodRow: { flexDirection: 'row', gap: 10 },
  methodButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
  },
  methodButtonText: { fontSize: 13, fontFamily: 'DMSans_500Medium' },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 11,
    marginTop: 8,
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
  },
  outlineButtonText: { fontSize: 13, fontFamily: 'DMSans_500Medium' },
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
