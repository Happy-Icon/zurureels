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
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/Skeleton';
import { notificationService } from '@/services/notificationService';
import { smsService, formatToE164 } from '@/services/smsService';

// ── Notification Settings Interface ──────────────────────────────────────────
export interface NotificationSettingsState {
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
  guest_travel: {
    booking_requests: boolean;
    booking_confirmations: boolean;
    booking_modifications: boolean;
    checkin_reminder: boolean;
    checkout_reminder: boolean;
    cancellation_updates: boolean;
  };
  host_alerts: {
    reservation_requests: boolean;
    new_booking: boolean;
    guest_arrival: boolean;
    guest_checkout: boolean;
    guest_messages: boolean;
    payment_received: boolean;
    weekly_earnings: boolean;
    review_received: boolean;
    listing_performance: boolean;
    calendar_availability: boolean;
    ai_pricing: boolean;
  };
  messages: {
    host_messages: boolean;
    guest_messages: boolean;
    ai_concierge: boolean;
    support_messages: boolean;
    group_conversations: boolean;
  };
  offers: {
    price_drops: boolean;
    wishlist_alerts: boolean;
    recommendations: boolean;
    nearby_experiences: boolean;
    seasonal_promotions: boolean;
  };
  schedule: {
    quiet_hours_enabled: boolean;
    quiet_hours_start: string;
    quiet_hours_end: string;
    frequency: 'immediate' | 'daily' | 'weekly';
  };
}

const DEFAULT_SETTINGS: NotificationSettingsState = {
  channels: {
    push: true,
    email: true,
    sms: true,
    whatsapp: false,
  },
  guest_travel: {
    booking_requests: true,
    booking_confirmations: true,
    booking_modifications: true,
    checkin_reminder: true,
    checkout_reminder: true,
    cancellation_updates: true,
  },
  host_alerts: {
    reservation_requests: true,
    new_booking: true,
    guest_arrival: true,
    guest_checkout: true,
    guest_messages: true,
    payment_received: true,
    weekly_earnings: true,
    review_received: true,
    listing_performance: false,
    calendar_availability: true,
    ai_pricing: true,
  },
  messages: {
    host_messages: true,
    guest_messages: true,
    ai_concierge: true,
    support_messages: true,
    group_conversations: true,
  },
  offers: {
    price_drops: false,
    wishlist_alerts: true,
    recommendations: true,
    nearby_experiences: true,
    seasonal_promotions: false,
  },
  schedule: {
    quiet_hours_enabled: false,
    quiet_hours_start: '10:00 PM',
    quiet_hours_end: '7:00 AM',
    frequency: 'immediate',
  },
};

export default function NotificationsSettingsCenter() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, role, viewMode } = useAuth();
  const { showAlert } = useCustomAlert();

  const [pageLoading, setPageLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettingsState>(DEFAULT_SETTINGS);

  // Mode adaptation based on active viewMode
  const isHostMode = viewMode === 'host';

  const topPad = Platform.OS === 'web' ? 20 : insets.top + 8;
  const bottomPad = Platform.OS === 'web' ? 110 : insets.bottom + 50;

  // ── Load Settings from Supabase ───────────────────────────────────────────
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
          const loaded = data.notification_settings as Partial<NotificationSettingsState>;
          setSettings({
            channels: { ...DEFAULT_SETTINGS.channels, ...(loaded.channels ?? {}) },
            guest_travel: { ...DEFAULT_SETTINGS.guest_travel, ...(loaded.guest_travel ?? {}) },
            host_alerts: { ...DEFAULT_SETTINGS.host_alerts, ...(loaded.host_alerts ?? {}) },
            messages: { ...DEFAULT_SETTINGS.messages, ...(loaded.messages ?? {}) },
            offers: { ...DEFAULT_SETTINGS.offers, ...(loaded.offers ?? {}) },
            schedule: { ...DEFAULT_SETTINGS.schedule, ...(loaded.schedule ?? {}) },
          });
        }
      } catch (e) {
        console.error('Error fetching notification settings:', e);
      } finally {
        setPageLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  // ── Auto-save updates ──────────────────────────────────────────────────────
  const autoSaveSettings = async (nextSettings: NotificationSettingsState) => {
    if (!user) return;
    try {
      await supabase
        .from('profiles')
        .update({ notification_settings: nextSettings })
        .eq('id', user.id);
    } catch (e) {
      console.error('Auto-save notification settings error:', e);
    }
  };

  const updateSettings = (
    updater: (prev: NotificationSettingsState) => NotificationSettingsState,
  ) => {
    setSettings((prev) => {
      const next = updater(prev);
      autoSaveSettings(next);
      return next;
    });
  };

  // User Contact Details
  const userEmail = user?.email || profile?.email || null;
  const userPhone = profile?.phone || user?.phone || null;

  // Helper mask phone
  const maskPhone = (phoneStr: string) => {
    if (phoneStr.length < 8) return phoneStr;
    const prefix = phoneStr.slice(0, 5);
    const suffix = phoneStr.slice(-2);
    return `${prefix}••••${suffix}`;
  };

  const [testingChannel, setTestingChannel] = useState<string | null>(null);

  // ── Test Notification Handlers ─────────────────────────────────────────────
  const handleTestNotification = async (channel: 'push' | 'email' | 'sms' | 'whatsapp') => {
    if (channel === 'push') {
      if (!settings.channels.push) {
        showAlert({
          title: 'Push Notifications Disabled',
          message: 'Please enable Push notifications under Delivery Channels before sending a test.',
          icon: 'bell-off',
          buttons: [{ text: 'OK' }],
        });
        return;
      }

      setTestingChannel('push');
      try {
        const res = await notificationService.triggerTestPush(user?.id || '');
        if (res.success) {
          showAlert({
            title: '🔔 Test Push Dispatched',
            message: 'Sample travel alert delivered to your device lock screen & notification center.',
            icon: 'bell',
            buttons: [{ text: 'Great!' }],
          });
        } else {
          showAlert({
            title: 'Push Notification Alert',
            message: res.error || 'Failed to dispatch push notification to device.',
            icon: 'alert-circle',
            buttons: [{ text: 'OK' }],
          });
        }
      } catch (err: any) {
        showAlert({
          title: 'Push Dispatch Error',
          message: err?.message || 'Error occurred while scheduling push notification.',
          icon: 'alert-circle',
          buttons: [{ text: 'OK' }],
        });
      } finally {
        setTestingChannel(null);
      }
    } else if (channel === 'email') {
      if (!settings.channels.email) {
        showAlert({
          title: 'Email Notifications Disabled',
          message: 'Please enable Email notifications in Delivery Channels before sending a test.',
          icon: 'mail',
          buttons: [{ text: 'OK' }],
        });
        return;
      }
      if (!userEmail) {
        showAlert({
          title: 'Email Required',
          message: 'Please add a verified email address in Personal Information to test email delivery.',
          icon: 'mail',
          buttons: [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Email', onPress: () => router.push('/profile/info') },
          ],
        });
        return;
      }
      showAlert({
        title: '✉️ Test Email Dispatched',
        message: `A sample booking summary email was sent to ${userEmail}.`,
        icon: 'check-circle',
        buttons: [{ text: 'Done' }],
      });
    } else if (channel === 'sms') {
      // 1. Verify SMS toggle is enabled
      if (!settings.channels.sms) {
        showAlert({
          title: 'SMS Notifications Disabled',
          message: 'Please enable the SMS text messages toggle under Delivery Channels before sending a test SMS.',
          icon: 'message-square',
          buttons: [{ text: 'OK' }],
        });
        return;
      }

      // 2. Verify Phone Number exists
      if (!userPhone) {
        showAlert({
          title: 'Phone Number Required',
          message: 'SMS delivery requires a verified mobile number. Add your number in Profile settings.',
          icon: 'phone',
          buttons: [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Number', onPress: () => router.push('/profile/info') },
          ],
        });
        return;
      }

      // 3. Verify E.164 Format
      const phoneCheck = formatToE164(userPhone);
      if (!phoneCheck.valid) {
        showAlert({
          title: 'Invalid Phone Number Format',
          message: `${phoneCheck.error || 'Invalid phone format.'}\n\nPlease update your mobile number in Profile Info to a standard E.164 format (e.g. +254712345678).`,
          icon: 'alert-circle',
          buttons: [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Fix Phone Number', onPress: () => router.push('/profile/info') },
          ],
        });
        return;
      }

      // 4. Trigger Real SMS Pipeline via Service & Log Every Step
      setTestingChannel('sms');
      try {
        const res = await smsService.sendSMS({
          userId: user?.id || 'guest_user',
          phone: userPhone,
          message: 'ZuruSasa Test SMS: Your booking alert notifications are working correctly! 🌴',
          notificationType: 'test_sms',
        });

        if (res.success) {
          showAlert({
            title: '📱 Test SMS Sent Successfully',
            message: `Sample trip alert delivered to ${res.formattedPhone}.\n\nProvider: ${res.provider}\nLatency: ${res.latencyMs}ms`,
            icon: 'check-circle',
            buttons: [{ text: 'Done' }],
          });
        } else {
          // Display explicit failure reason in UI
          showAlert({
            title: 'SMS Delivery Failed',
            message: `Reason: ${res.error || 'Failed to dispatch SMS'}\n\nError Code: ${res.errorCode || 'UNKNOWN'}\nTarget Phone: ${res.formattedPhone}\nProvider: ${res.provider}`,
            icon: 'alert-circle',
            buttons: [
              { text: 'Dismiss', style: 'cancel' },
              { text: 'Edit Profile Info', onPress: () => router.push('/profile/info') },
            ],
          });
        }
      } catch (err: any) {
        showAlert({
          title: 'SMS Dispatch Exception',
          message: err?.message || 'An unexpected error occurred while executing the SMS notification pipeline.',
          icon: 'alert-circle',
          buttons: [{ text: 'OK' }],
        });
      } finally {
        setTestingChannel(null);
      }
    } else if (channel === 'whatsapp') {
      if (!settings.channels.whatsapp) {
        showAlert({
          title: 'WhatsApp Disabled',
          message: 'Please enable WhatsApp messages in Delivery Channels before sending a test.',
          icon: 'message-circle',
          buttons: [{ text: 'OK' }],
        });
        return;
      }
      if (!userPhone) {
        showAlert({
          title: 'WhatsApp Configuration Needed',
          message: 'WhatsApp notifications require a verified mobile number connected to WhatsApp.',
          icon: 'message-circle',
          buttons: [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Number', onPress: () => router.push('/profile/info') },
          ],
        });
        return;
      }
      showAlert({
        title: '💬 Test WhatsApp Dispatched',
        message: `A sample coastal itinerary voucher was sent to ${maskPhone(userPhone)} on WhatsApp.`,
        icon: 'check-circle',
        buttons: [{ text: 'Awesome' }],
      });
    }
  };

  // ── Skeleton Loader ────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <View
        style={[
          styles.fill,
          { backgroundColor: '#FFFFFF', paddingTop: topPad, paddingHorizontal: 20, gap: 20 },
        ]}
      >
        <Skeleton style={{ height: 36, width: 220, borderRadius: 8 }} />
        <Skeleton style={{ height: 16, width: 300, borderRadius: 4 }} />
        <Skeleton style={{ height: 260, borderRadius: 22, marginTop: 12 }} />
        <Skeleton style={{ height: 220, borderRadius: 22 }} />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {/* Top Header Navigation */}
      <View style={[styles.topNavBar, { paddingTop: topPad }]}>
        <Pressable
          testID="notifications-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/profile');
          }}
          style={({ pressed }) => [styles.backIconBtn, pressed && { opacity: 0.6 }]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color="#0F172A" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: bottomPad,
          gap: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Large Page Header */}
        <View style={styles.headerBlock}>
          <Text style={styles.pageTitle}>Notifications</Text>
          <Text style={styles.pageSubtitle}>
            Choose how you receive updates, booking alerts, travel reminders and account notifications.
          </Text>
        </View>

        {/* ── GUEST EXPERIENCE CARDS ────────────────────────────────────────── */}
        {!isHostMode && (
          <>
            {/* CARD 1 — Travel & Booking Updates */}
            <View style={styles.cardContainer}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
                  <Feather name="calendar" size={18} color="#F26522" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Travel & Booking Updates</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <ToggleRow
                  icon="inbox"
                  title="Booking Requests"
                  description="Notifications when a host receives your booking inquiry."
                  value={settings.guest_travel.booking_requests}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      guest_travel: { ...p.guest_travel, booking_requests: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="check-circle"
                  title="Booking Confirmations"
                  description="Instant confirmation alerts for accepted stays & tours."
                  value={settings.guest_travel.booking_confirmations}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      guest_travel: { ...p.guest_travel, booking_confirmations: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="edit-3"
                  title="Booking Modifications"
                  description="Schedule, date, or guest count change updates."
                  value={settings.guest_travel.booking_modifications}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      guest_travel: { ...p.guest_travel, booking_modifications: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="map-pin"
                  title="Trip Check-in Reminder"
                  description="Directions, keycodes & check-in guidelines prior to arrival."
                  value={settings.guest_travel.checkin_reminder}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      guest_travel: { ...p.guest_travel, checkin_reminder: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="log-out"
                  title="Trip Checkout Reminder"
                  description="Checkout instructions and feedback reminders."
                  value={settings.guest_travel.checkout_reminder}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      guest_travel: { ...p.guest_travel, checkout_reminder: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="alert-circle"
                  title="Cancellation Updates"
                  description="Refund and cancellation status notifications."
                  value={settings.guest_travel.cancellation_updates}
                  isLast
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      guest_travel: { ...p.guest_travel, cancellation_updates: val },
                    }))
                  }
                />
              </View>
            </View>

            {/* CARD 2 — Messages & Communication */}
            <View style={styles.cardContainer}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.iconBox, { backgroundColor: '#F0F9FF' }]}>
                  <Feather name="message-circle" size={18} color="#0284C7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Messages & Communication</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <ToggleRow
                  icon="user-check"
                  title="Host Messages"
                  description="Direct updates from your hosts regarding your stays."
                  value={settings.messages.host_messages}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      messages: { ...p.messages, host_messages: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="cpu"
                  title="AI Concierge"
                  description="Smart coastal recommendations & itinerary tips from Zuru AI."
                  value={settings.messages.ai_concierge}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      messages: { ...p.messages, ai_concierge: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="life-buoy"
                  title="Support Messages"
                  description="Replies from Zuru Concierge 24/7 support assistant."
                  value={settings.messages.support_messages}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      messages: { ...p.messages, support_messages: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="users"
                  title="Group Conversations"
                  description="Chat updates from co-travelers and group bookings."
                  value={settings.messages.group_conversations}
                  isLast
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      messages: { ...p.messages, group_conversations: val },
                    }))
                  }
                />
              </View>
            </View>

            {/* CARD 3 — Offers & Discovery */}
            <View style={styles.cardContainer}>
              <View style={[styles.cardHeaderRow]}>
              <View style={[styles.iconBox, { backgroundColor: '#FDF4FF' }]}>
                <Ionicons name="sparkles" size={18} color="#C084FC" />
              </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Offers & Discovery</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <ToggleRow
                  icon="trending-down"
                  title="Price Drops"
                  description="Alerts when stays on your wishlist drop in price."
                  value={settings.offers.price_drops}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      offers: { ...p.offers, price_drops: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="heart"
                  title="Wishlist Alerts"
                  description="Availability updates for saved coastal villas & experiences."
                  value={settings.offers.wishlist_alerts}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      offers: { ...p.offers, wishlist_alerts: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="compass"
                  title="Personalized Recommendations"
                  description="Curated stays, tours & hidden spots tailored to you."
                  value={settings.offers.recommendations}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      offers: { ...p.offers, recommendations: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="anchor"
                  title="Nearby Experiences"
                  description="Local boat tours, dining & coastal activities near your location."
                  value={settings.offers.nearby_experiences}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      offers: { ...p.offers, nearby_experiences: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="sun"
                  title="Seasonal Promotions"
                  description="Exclusive holiday discounts and early-bird beach offers."
                  value={settings.offers.seasonal_promotions}
                  isLast
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      offers: { ...p.offers, seasonal_promotions: val },
                    }))
                  }
                />
              </View>
            </View>
          </>
        )}

        {/* ── HOST EXPERIENCE CARDS ────────────────────────────────────────── */}
        {isHostMode && (
          <>
            {/* CARD 1 — Hosting Alerts & Activity */}
            <View style={styles.cardContainer}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
                  <Feather name="home" size={18} color="#F26522" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Hosting Alerts & Activity</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <ToggleRow
                  icon="clock"
                  title="Reservation Requests"
                  description="Instant alerts when guests request to book your stay."
                  value={settings.host_alerts.reservation_requests}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      host_alerts: { ...p.host_alerts, reservation_requests: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="check-square"
                  title="New Booking"
                  description="Notifications for confirmed instant bookings."
                  value={settings.host_alerts.new_booking}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      host_alerts: { ...p.host_alerts, new_booking: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="user-check"
                  title="Guest Arrival"
                  description="Alerts when guests are checking in today."
                  value={settings.host_alerts.guest_arrival}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      host_alerts: { ...p.host_alerts, guest_arrival: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="log-out"
                  title="Guest Checkout"
                  description="Reminders when guests complete their stay."
                  value={settings.host_alerts.guest_checkout}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      host_alerts: { ...p.host_alerts, guest_checkout: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="message-square"
                  title="Guest Messages"
                  description="Urgent messages from current or upcoming guests."
                  value={settings.host_alerts.guest_messages}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      host_alerts: { ...p.host_alerts, guest_messages: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="dollar-sign"
                  title="Payment Received"
                  description="Payout confirmations and M-Pesa transaction alerts."
                  value={settings.host_alerts.payment_received}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      host_alerts: { ...p.host_alerts, payment_received: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="bar-chart-2"
                  title="Weekly Earnings"
                  description="Summary of weekly revenue and payout statements."
                  value={settings.host_alerts.weekly_earnings}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      host_alerts: { ...p.host_alerts, weekly_earnings: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="star"
                  title="Review Received"
                  description="Notifications when a guest leaves a new review."
                  value={settings.host_alerts.review_received}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      host_alerts: { ...p.host_alerts, review_received: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="eye"
                  title="Listing Performance"
                  description="Views, wishlist saves, and search ranking insights."
                  value={settings.host_alerts.listing_performance}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      host_alerts: { ...p.host_alerts, listing_performance: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="calendar"
                  title="Calendar Availability"
                  description="Reminders to update your calendar for upcoming holidays."
                  value={settings.host_alerts.calendar_availability}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      host_alerts: { ...p.host_alerts, calendar_availability: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="zap"
                  title="AI Pricing Suggestions"
                  description="Dynamic rate adjustments to maximize your occupancy."
                  value={settings.host_alerts.ai_pricing}
                  isLast
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      host_alerts: { ...p.host_alerts, ai_pricing: val },
                    }))
                  }
                />
              </View>
            </View>

            {/* CARD 2 — Messages & Communication */}
            <View style={styles.cardContainer}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.iconBox, { backgroundColor: '#F0F9FF' }]}>
                  <Feather name="message-circle" size={18} color="#0284C7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Communication</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <ToggleRow
                  icon="user"
                  title="Guest Messages"
                  description="Questions & booking requests from guests."
                  value={settings.messages.guest_messages}
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      messages: { ...p.messages, guest_messages: val },
                    }))
                  }
                />
                <ToggleRow
                  icon="life-buoy"
                  title="Support Messages"
                  description="Replies from Zuru Concierge host support."
                  value={settings.messages.support_messages}
                  isLast
                  onValueChange={(val) =>
                    updateSettings((p) => ({
                      ...p,
                      messages: { ...p.messages, support_messages: val },
                    }))
                  }
                />
              </View>
            </View>
          </>
        )}

        {/* ── CARD 4 — DELIVERY CHANNELS & CONTACT INTEGRATION ───────────────── */}
        <View style={styles.cardContainer}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
              <Feather name="send" size={18} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Delivery Channels</Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            {/* Push Notifications Row */}
            <ChannelRow
              icon="bell"
              title="Push Notifications"
              subInfo="Lock screen alerts"
              statusPill="Enabled"
              statusPillType="success"
              value={settings.channels.push}
              onValueChange={(val) =>
                updateSettings((p) => ({
                  ...p,
                  channels: { ...p.channels, push: val },
                }))
              }
            />

            {/* Email Channel Row */}
            <ChannelRow
              icon="mail"
              title="Email"
              subInfo={userEmail ?? 'Email required'}
              statusPill={userEmail ? 'Verified' : undefined}
              statusPillType="success"
              missingActionLabel={!userEmail ? 'Add Email' : undefined}
              onMissingAction={() => router.push('/profile/info')}
              value={settings.channels.email}
              disabled={!userEmail}
              onValueChange={(val) =>
                updateSettings((p) => ({
                  ...p,
                  channels: { ...p.channels, email: val },
                }))
              }
            />

            {/* SMS Channel Row */}
            <ChannelRow
              icon="phone"
              title="SMS"
              subInfo={userPhone ? maskPhone(userPhone) : 'Not configured'}
              statusPill={userPhone ? 'Verified' : undefined}
              statusPillType="success"
              missingActionLabel={!userPhone ? 'Add' : undefined}
              onMissingAction={() => router.push('/profile/info')}
              value={settings.channels.sms}
              disabled={!userPhone}
              onValueChange={(val) =>
                updateSettings((p) => ({
                  ...p,
                  channels: { ...p.channels, sms: val },
                }))
              }
            />

            {/* WhatsApp Channel Row */}
            <ChannelRow
              icon="message-square"
              title="WhatsApp"
              subInfo={userPhone ? 'Connected' : 'Not configured'}
              statusPill={userPhone ? 'Connected' : undefined}
              statusPillType="success"
              missingActionLabel={!userPhone ? 'Add' : undefined}
              onMissingAction={() => router.push('/profile/info')}
              value={settings.channels.whatsapp}
              disabled={!userPhone}
              isLast
              onValueChange={(val) =>
                updateSettings((p) => ({
                  ...p,
                  channels: { ...p.channels, whatsapp: val },
                }))
              }
            />
          </View>
        </View>

        {/* ── CARD 5 — NOTIFICATION SCHEDULE ────────────────────────────────── */}
        <View style={styles.cardContainer}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
              <Feather name="clock" size={18} color="#475569" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Notification Schedule</Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            {/* Quiet Hours */}
            <View style={styles.rowLayout}>
              <View style={styles.rowIconWrapper}>
                <Feather name="moon" size={18} color="#64748B" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitleText}>Quiet Hours</Text>
                <Text style={styles.rowDescriptionText}>Do not disturb during sleep hours</Text>
              </View>
              <View style={styles.timePill}>
                <Text style={styles.timePillText}>
                  {settings.schedule.quiet_hours_start} – {settings.schedule.quiet_hours_end}
                </Text>
              </View>
            </View>

            <View style={styles.rowDivider} />

            {/* Delivery Frequency */}
            <View style={{ paddingVertical: 14, gap: 10 }}>
              <View style={styles.rowLayoutNoPad}>
                <View style={styles.rowIconWrapper}>
                  <Feather name="layers" size={18} color="#64748B" />
                </View>
                <View style={styles.rowTextCol}>
                  <Text style={styles.rowTitleText}>Delivery Frequency</Text>
                  <Text style={styles.rowDescriptionText}>
                    Choose how often non-urgent digests are delivered
                  </Text>
                </View>
              </View>

              <View style={styles.freqTrack}>
                {(
                  [
                    { id: 'immediate', label: 'Immediate' },
                    { id: 'daily', label: 'Daily Summary' },
                    { id: 'weekly', label: 'Weekly Summary' },
                  ] as const
                ).map((item) => {
                  const isSelected = settings.schedule.frequency === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        updateSettings((p) => ({
                          ...p,
                          schedule: { ...p.schedule, frequency: item.id },
                        }))
                      }
                      style={[styles.freqTile, isSelected && styles.freqTileActive]}
                    >
                      <Text style={[styles.freqTileText, isSelected && styles.freqTileTextActive]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* ── CARD 6 — SECURITY NOTIFICATIONS (MANDATORY) ──────────────────── */}
        <View style={styles.cardContainer}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: '#F1F5F9' }]}>
              <Feather name="shield" size={18} color="#0F172A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Security Notifications</Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <RequiredSecurityRow
              icon="key"
              title="New Device Login"
              description="Instant security alerts when a new device signs in."
            />
            <RequiredSecurityRow
              icon="lock"
              title="Password Changes"
              description="Notifications when your password or passkey is updated."
            />
            <RequiredSecurityRow
              icon="shield"
              title="Security Verification"
              description="Two-factor authentication and identity verification alerts."
              isLast
            />
          </View>
        </View>

        {/* ── TEST NOTIFICATIONS CTA CARD ──────────────────────────────────── */}
        <View style={[styles.cardContainer, styles.testCardContainer]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
              <Feather name="bell" size={18} color="#F26522" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Test Notifications</Text>
            </View>
          </View>

          <Text style={styles.testCardSub}>
            Verify that your notification channels are configured and working correctly on this device.
          </Text>

          <View style={styles.testButtonsGrid}>
            <Pressable
              onPress={() => handleTestNotification('push')}
              disabled={testingChannel === 'push'}
              style={({ pressed }) => [
                styles.testBtn,
                testingChannel === 'push' && { opacity: 0.6 },
                pressed && styles.testBtnActive,
              ]}
            >
              <Feather name="smartphone" size={14} color="#0F172A" />
              <Text style={styles.testBtnText}>
                {testingChannel === 'push' ? 'Sending Push...' : 'Send Test Push'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleTestNotification('email')}
              style={({ pressed }) => [styles.testBtn, pressed && styles.testBtnActive]}
            >
              <Feather name="mail" size={14} color="#0F172A" />
              <Text style={styles.testBtnText}>Send Test Email</Text>
            </Pressable>

            <Pressable
              onPress={() => handleTestNotification('sms')}
              disabled={testingChannel === 'sms'}
              style={({ pressed }) => [
                styles.testBtn,
                testingChannel === 'sms' && { opacity: 0.6 },
                pressed && styles.testBtnActive,
              ]}
            >
              <Feather name="message-square" size={14} color="#0F172A" />
              <Text style={styles.testBtnText}>
                {testingChannel === 'sms' ? 'Sending SMS...' : 'Send Test SMS'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleTestNotification('whatsapp')}
              style={({ pressed }) => [styles.testBtn, pressed && styles.testBtnActive]}
            >
              <Ionicons name="logo-whatsapp" size={14} color="#059669" />
              <Text style={styles.testBtnText}>Send Test WhatsApp</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ── ROW COMPONENTS ──────────────────────────────────────────────────────────

function ToggleRow({
  icon,
  title,
  description,
  value,
  onValueChange,
  isLast,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View>
      <View style={styles.rowLayout}>
        <View style={styles.rowIconWrapper}>
          <Feather name={icon} size={18} color="#64748B" />
        </View>
        <View style={styles.rowTextCol}>
          <Text style={styles.rowTitleText}>{title}</Text>
          <Text style={styles.rowDescriptionText}>{description}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ true: '#F26522', false: '#E2E8F0' }}
          thumbColor="#FFFFFF"
        />
      </View>
      {!isLast && <View style={styles.rowDivider} />}
    </View>
  );
}

function ChannelRow({
  icon,
  title,
  subInfo,
  statusPill,
  statusPillType,
  missingActionLabel,
  onMissingAction,
  value,
  onValueChange,
  disabled,
  isLast,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subInfo: string;
  statusPill?: string;
  statusPillType?: 'success' | 'neutral';
  missingActionLabel?: string;
  onMissingAction?: () => void;
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
}) {
  return (
    <View>
      <View style={[styles.rowLayout, disabled && { opacity: 0.7 }]}>
        <View style={styles.rowIconWrapper}>
          <Feather name={icon} size={18} color="#64748B" />
        </View>

        <View style={styles.rowTextCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.rowTitleText}>{title}</Text>
            {statusPill ? (
              <View
                style={[
                  styles.pillBadge,
                  statusPillType === 'success' && styles.pillBadgeSuccess,
                ]}
              >
                <Text
                  style={[
                    styles.pillBadgeText,
                    statusPillType === 'success' && styles.pillBadgeTextSuccess,
                  ]}
                >
                  {statusPill}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.rowDescriptionText}>{subInfo}</Text>
        </View>

        {missingActionLabel ? (
          <Pressable
            onPress={onMissingAction}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.addBtnText}>{missingActionLabel}</Text>
          </Pressable>
        ) : (
          <Switch
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            trackColor={{ true: '#F26522', false: '#E2E8F0' }}
            thumbColor="#FFFFFF"
          />
        )}
      </View>
      {!isLast && <View style={styles.rowDivider} />}
    </View>
  );
}

function RequiredSecurityRow({
  icon,
  title,
  description,
  isLast,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  isLast?: boolean;
}) {
  return (
    <View>
      <View style={styles.rowLayout}>
        <View style={styles.rowIconWrapper}>
          <Feather name={icon} size={18} color="#0F172A" />
        </View>

        <View style={styles.rowTextCol}>
          <Text style={styles.rowTitleText}>{title}</Text>
          <Text style={styles.rowDescriptionText}>{description}</Text>
        </View>

        <View style={styles.requiredBadge}>
          <Feather name="shield" size={11} color="#475569" style={{ marginRight: 3 }} />
          <Text style={styles.requiredBadgeText}>Required</Text>
        </View>
      </View>
      {!isLast && <View style={styles.rowDivider} />}
    </View>
  );
}

// ── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Clean white background
  },
  topNavBar: {
    paddingHorizontal: 20,
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  headerBlock: {
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 32, // Large page title
    fontFamily: 'DMSans_700Bold',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#64748B',
    lineHeight: 20,
  },

  // Role Tab Switcher
  roleTabTrack: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 8,
  },
  roleTabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  roleTabPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  roleTabText: {
    fontSize: 13,
    fontFamily: 'DMSans_600SemiBold',
    color: '#64748B',
  },
  roleTabTextActive: {
    color: '#F26522',
  },

  // Premium Cards (22px radius, elevated surface)
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  testCardContainer: {
    borderColor: '#FFEDD5',
    backgroundColor: '#FFFBF7',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  cardBody: {
    gap: 0,
  },

  // Row Layouts
  rowLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  rowLayoutNoPad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowIconWrapper: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextCol: {
    flex: 1,
    gap: 2,
  },
  rowTitleText: {
    fontSize: 15,
    fontFamily: 'DMSans_600SemiBold',
    color: '#0F172A',
  },
  rowDescriptionText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_400Regular',
    color: '#64748B',
    lineHeight: 17,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F8FAFC',
    marginLeft: 38,
  },

  // Pill Badges
  pillBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pillBadgeSuccess: {
    backgroundColor: '#ECFDF5',
  },
  pillBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: '#64748B',
  },
  pillBadgeTextSuccess: {
    color: '#047857',
  },

  // Small Action Add Button
  addBtn: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addBtnText: {
    fontSize: 12,
    fontFamily: 'DMSans_700Bold',
    color: '#F26522',
  },

  // Security Required Badge
  requiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  requiredBadgeText: {
    fontSize: 11,
    fontFamily: 'DMSans_600SemiBold',
    color: '#475569',
  },

  // Schedule Card Styles
  timePill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  timePillText: {
    fontSize: 12,
    fontFamily: 'DMSans_600SemiBold',
    color: '#0F172A',
  },
  freqTrack: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 4,
  },
  freqTile: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  freqTileActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  freqTileText: {
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
    color: '#64748B',
  },
  freqTileTextActive: {
    fontFamily: 'DMSans_700Bold',
    color: '#0F172A',
  },

  // Test Card Styles
  testCardSub: {
    fontSize: 13,
    fontFamily: 'DMSans_400Regular',
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  testButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexGrow: 1,
    justifyContent: 'center',
  },
  testBtnActive: {
    backgroundColor: '#F8FAFC',
  },
  testBtnText: {
    fontSize: 12.5,
    fontFamily: 'DMSans_600SemiBold',
    color: '#0F172A',
  },
});
