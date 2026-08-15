import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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

interface ChannelPrefs {
  email: boolean;
  push: boolean;
  sms: boolean;
  phone_calls: boolean;
}

interface NotificationItemConfig {
  id: string;
  title: string;
  description: string;
  defaultPrefs?: ChannelPrefs;
}

function getChannelsSummary(prefs?: ChannelPrefs): string {
  if (!prefs) return 'Off';
  const active: string[] = [];
  if (prefs.email) active.push('Email');
  if (prefs.push) active.push('Push');
  if (prefs.sms) active.push('SMS');
  if (prefs.phone_calls) active.push('Phone calls');

  if (active.length === 0) return 'Off';
  if (active.length === 1) return `On: ${active[0]}`;
  if (active.length === 2) return `On: ${active[0]} and ${active[1]}`;
  if (active.length === 3) return `On: ${active[0]}, ${active[1]}, and ${active[2]}`;
  return `On: ${active[0]}, ${active[1]}, ${active[2]}, and ${active[3]}`;
}

const DEFAULT_OFF: ChannelPrefs = {
  email: false,
  push: false,
  sms: false,
  phone_calls: false,
};

const DEFAULT_ACCOUNT_ON: ChannelPrefs = {
  email: true,
  push: true,
  sms: false,
  phone_calls: false,
};

const DEFAULT_ACCOUNT_WITH_SMS: ChannelPrefs = {
  email: true,
  push: true,
  sms: true,
  phone_calls: false,
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'offers' | 'account'>('offers');
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<NotificationItemConfig | null>(null);

  // Preference map keyed by item id
  const [prefsMap, setPrefsMap] = useState<Record<string, ChannelPrefs>>({
    // Offers tab
    recognition: { ...DEFAULT_OFF },
    insights: { ...DEFAULT_OFF },
    pricing: { ...DEFAULT_OFF },
    hosting_perks: { ...DEFAULT_OFF },
    news_updates: { ...DEFAULT_OFF },
    local_laws: { ...DEFAULT_OFF },
    inspiration: { ...DEFAULT_OFF },
    trip_planning: { ...DEFAULT_OFF },
    zurusasa_news: { ...DEFAULT_OFF },
    feedback: { ...DEFAULT_OFF },
    travel_regulations: { ...DEFAULT_OFF },
    all_offers: { ...DEFAULT_OFF },

    // Account tab
    account_activity: { ...DEFAULT_ACCOUNT_ON },
    listing_activity: { ...DEFAULT_ACCOUNT_WITH_SMS },
    guest_policies: { ...DEFAULT_ACCOUNT_ON },
    host_policies: { ...DEFAULT_ACCOUNT_ON },
    reminders: { ...DEFAULT_ACCOUNT_ON },
    messages: { ...DEFAULT_ACCOUNT_WITH_SMS },
  });

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 32;

  useEffect(() => {
    const loadNotificationPrefs = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from('profiles')
          .select('notification_settings')
          .eq('id', user.id)
          .single();

        if (data?.notification_settings) {
          const loaded = data.notification_settings as Record<string, ChannelPrefs>;
          setPrefsMap((prev) => ({ ...prev, ...loaded }));
        }
      } catch (e) {
        console.warn('Note loading notification settings:', e);
      } finally {
        setLoading(false);
      }
    };
    loadNotificationPrefs();
  }, [user]);

  const updateChannelPref = async (itemId: string, channel: keyof ChannelPrefs, val: boolean) => {
    const current = prefsMap[itemId] || { ...DEFAULT_OFF };
    const updatedItem = { ...current, [channel]: val };
    const updatedMap = { ...prefsMap, [itemId]: updatedItem };
    setPrefsMap(updatedMap);

    if (user?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ notification_settings: updatedMap })
          .eq('id', user.id);
      } catch (e) {
        console.warn('Error saving notification pref:', e);
      }
    }
  };

  const currentActivePrefs = activeItem ? (prefsMap[activeItem.id] || DEFAULT_OFF) : DEFAULT_OFF;

  return (
    <View style={styles.container}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          testID="notifications-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/profile/settings');
          }}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnActive]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color="#111111" />
        </Pressable>
      </View>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        {/* Title */}
        <Text style={styles.pageTitle}>Notifications</Text>

        {/* Tab Bar */}
        <View style={styles.tabContainer}>
          <Pressable
            testID="tab-offers"
            onPress={() => setActiveTab('offers')}
            style={[styles.tabBtn, activeTab === 'offers' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === 'offers' && styles.tabTextActive]}>
              Offers and updates
            </Text>
          </Pressable>

          <Pressable
            testID="tab-account"
            onPress={() => setActiveTab('account')}
            style={[styles.tabBtn, activeTab === 'account' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, activeTab === 'account' && styles.tabTextActive]}>
              Account
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#111111" style={{ marginTop: 40 }} />
        ) : activeTab === 'offers' ? (
          /* ── TAB 1: OFFERS AND UPDATES ───────────────────────────────────── */
          <View style={styles.tabContentBlock}>
            {/* Section 1: Hosting insights and rewards */}
            <Text style={styles.sectionHeader}>Hosting insights and rewards</Text>
            <Text style={styles.sectionSubtitle}>
              Learn about best hosting practices, and get access to exclusive hosting perks.
            </Text>

            <NotificationRow
              title="Recognition and achievements"
              description="Get recognized for reaching hosting milestones and Superhost status."
              summary={getChannelsSummary(prefsMap.recognition)}
              onEdit={() =>
                setActiveItem({
                  id: 'recognition',
                  title: 'Recognition and achievements',
                  description: 'Get recognized for reaching hosting milestones and Superhost status.',
                })
              }
            />

            <NotificationRow
              title="Insights and tips"
              description="Learn tips and best practices to improve your coastal listing visibility and guest ratings."
              summary={getChannelsSummary(prefsMap.insights)}
              onEdit={() =>
                setActiveItem({
                  id: 'insights',
                  title: 'Insights and tips',
                  description: 'Learn tips and best practices to improve your coastal listing visibility and guest ratings.',
                })
              }
            />

            <NotificationRow
              title="Pricing trends and suggestions"
              description="Stay informed about coastal peak season demand in Diani, Mombasa, Watamu, and Lamu."
              summary={getChannelsSummary(prefsMap.pricing)}
              onEdit={() =>
                setActiveItem({
                  id: 'pricing',
                  title: 'Pricing trends and suggestions',
                  description: 'Stay informed about coastal peak season demand in Diani, Mombasa, Watamu, and Lamu.',
                })
              }
            />

            <NotificationRow
              title="Hosting perks"
              description="Access exclusive coastal host discounts, partner perks, and event invites."
              summary={getChannelsSummary(prefsMap.hosting_perks)}
              onEdit={() =>
                setActiveItem({
                  id: 'hosting_perks',
                  title: 'Hosting perks',
                  description: 'Access exclusive coastal host discounts, partner perks, and event invites.',
                })
              }
            />

            <View style={styles.dividerLine} />

            {/* Section 2: Hosting updates */}
            <Text style={styles.sectionHeader}>Hosting updates</Text>
            <Text style={styles.sectionSubtitle}>
              Get updates about programs, features, and regulations.
            </Text>

            <NotificationRow
              title="News and updates"
              description="Updates on host tools, calendar syncing, and reservation management."
              summary={getChannelsSummary(prefsMap.news_updates)}
              onEdit={() =>
                setActiveItem({
                  id: 'news_updates',
                  title: 'News and updates',
                  description: 'Updates on host tools, calendar syncing, and reservation management.',
                })
              }
            />

            <NotificationRow
              title="Local laws and regulations"
              description="Important legal requirements and tax guidance for hosting on the Kenyan Coast."
              summary={getChannelsSummary(prefsMap.local_laws)}
              onEdit={() =>
                setActiveItem({
                  id: 'local_laws',
                  title: 'Local laws and regulations',
                  description: 'Important legal requirements and tax guidance for hosting on the Kenyan Coast.',
                })
              }
            />

            <View style={styles.dividerLine} />

            {/* Section 3: Travel tips and offers */}
            <Text style={styles.sectionHeader}>Travel tips and offers</Text>
            <Text style={styles.sectionSubtitle}>
              Inspire your next trip with personalized recommendations and special offers.
            </Text>

            <NotificationRow
              title="Inspiration and offers"
              description="Inspire your next coastal trip with personalized recommendations and special offers."
              summary={getChannelsSummary(prefsMap.inspiration)}
              onEdit={() =>
                setActiveItem({
                  id: 'inspiration',
                  title: 'Inspiration and offers',
                  description: 'Inspire your next coastal trip with personalized recommendations and special offers.',
                })
              }
            />

            <NotificationRow
              title="Trip planning"
              description="Checklists, packing guides, and seasonal weather alerts for coastal getaways."
              summary={getChannelsSummary(prefsMap.trip_planning)}
              onEdit={() =>
                setActiveItem({
                  id: 'trip_planning',
                  title: 'Trip planning',
                  description: 'Checklists, packing guides, and seasonal weather alerts for coastal getaways.',
                })
              }
            />

            <View style={styles.dividerLine} />

            {/* Section 4: ZuruSasa updates */}
            <Text style={styles.sectionHeader}>ZuruSasa updates</Text>
            <Text style={styles.sectionSubtitle}>
              Stay up to date on the latest news from ZuruSasa, and let us know how we can improve.
            </Text>

            <NotificationRow
              title="News and programs"
              description="Stay up to date on the latest features, reels improvements, and community programs."
              summary={getChannelsSummary(prefsMap.zurusasa_news)}
              onEdit={() =>
                setActiveItem({
                  id: 'zurusasa_news',
                  title: 'News and programs',
                  description: 'Stay up to date on the latest features, reels improvements, and community programs.',
                })
              }
            />

            <NotificationRow
              title="Feedback"
              description="Share your feedback to help us build a better coastal marketplace."
              summary={getChannelsSummary(prefsMap.feedback)}
              onEdit={() =>
                setActiveItem({
                  id: 'feedback',
                  title: 'Feedback',
                  description: 'Share your feedback to help us build a better coastal marketplace.',
                })
              }
            />

            <NotificationRow
              title="Travel regulations"
              description="Updates on Kenyan travel advisories, marine park rules, and coastal transit."
              summary={getChannelsSummary(prefsMap.travel_regulations)}
              onEdit={() =>
                setActiveItem({
                  id: 'travel_regulations',
                  title: 'Travel regulations',
                  description: 'Updates on Kenyan travel advisories, marine park rules, and coastal transit.',
                })
              }
            />

            <View style={styles.dividerLine} />

            {/* Section 5: Unsubscribe */}
            <Text style={styles.sectionHeader}>Unsubscribe from all offers and updates</Text>
            <Text style={styles.sectionSubtitle}>
              You'll continue to get notifications about your account activity.
            </Text>

            <NotificationRow
              title="All offers and updates"
              description="Turn off all marketing offers across email, push, and SMS."
              summary={getChannelsSummary(prefsMap.all_offers) === 'Off' ? 'All off' : getChannelsSummary(prefsMap.all_offers)}
              onEdit={() =>
                setActiveItem({
                  id: 'all_offers',
                  title: 'All offers and updates',
                  description: 'Turn off marketing and promotional notifications while continuing to receive critical account activity alerts.',
                })
              }
            />
          </View>
        ) : (
          /* ── TAB 2: ACCOUNT ──────────────────────────────────────────────── */
          <View style={styles.tabContentBlock}>
            {/* Section 1: Account activity and policies */}
            <Text style={styles.sectionHeader}>Account activity and policies</Text>
            <Text style={styles.sectionSubtitle}>
              Confirm your booking and account activity, and learn about important ZuruSasa policies.
            </Text>

            <NotificationRow
              title="Account activity"
              description="Login alerts, security updates, password changes, and passkey registrations."
              summary={getChannelsSummary(prefsMap.account_activity)}
              onEdit={() =>
                setActiveItem({
                  id: 'account_activity',
                  title: 'Account activity',
                  description: 'Confirm your booking and account activity, and learn about important ZuruSasa policies.',
                })
              }
            />

            <NotificationRow
              title="Listing activity"
              description="Instant booking requests, guest inquiries, check-in updates, and review notifications."
              summary={getChannelsSummary(prefsMap.listing_activity)}
              onEdit={() =>
                setActiveItem({
                  id: 'listing_activity',
                  title: 'Listing activity',
                  description: 'Receive real-time alerts for booking requests, guest check-ins, and guest reviews.',
                })
              }
            />

            <NotificationRow
              title="Guest policies"
              description="Important policy updates, cancellation terms, and trust & safety guidelines for guests."
              summary={getChannelsSummary(prefsMap.guest_policies)}
              onEdit={() =>
                setActiveItem({
                  id: 'guest_policies',
                  title: 'Guest policies',
                  description: 'Important policy updates, cancellation terms, and trust & safety guidelines for guests.',
                })
              }
            />

            <NotificationRow
              title="Host policies"
              description="Host payout policies, damage protection terms, and hosting standards."
              summary={getChannelsSummary(prefsMap.host_policies)}
              onEdit={() =>
                setActiveItem({
                  id: 'host_policies',
                  title: 'Host policies',
                  description: 'Host payout policies, damage protection terms, and hosting standards.',
                })
              }
            />

            <View style={styles.dividerLine} />

            {/* Section 2: Reminders */}
            <Text style={styles.sectionHeader}>Reminders</Text>
            <Text style={styles.sectionSubtitle}>
              Get important reminders about your reservations, listings, and account activity.
            </Text>

            <NotificationRow
              title="Reminders"
              description="Upcoming check-in instructions, checkout reminders, and host preparation steps."
              summary={getChannelsSummary(prefsMap.reminders)}
              onEdit={() =>
                setActiveItem({
                  id: 'reminders',
                  title: 'Reminders',
                  description: 'Get important reminders about your reservations, listings, and account activity.',
                })
              }
            />

            <NotificationRow
              title="Guest and host messages"
              description="Real-time messages from confirmed guests and hosts regarding stays and excursions."
              summary={getChannelsSummary(prefsMap.messages)}
              onEdit={() =>
                setActiveItem({
                  id: 'messages',
                  title: 'Guest and host messages',
                  description: 'Real-time chat alerts from guests and verified coastal hosts.',
                })
              }
            />
          </View>
        )}
      </ScrollView>

      {/* ── CHANNEL EDIT BOTTOM SHEET MODAL (SCREENSHOT 5) ───────────────────── */}
      <Modal
        visible={!!activeItem}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveItem(null)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <Pressable
              onPress={() => setActiveItem(null)}
              style={styles.closeBtn}
              hitSlop={10}
            >
              <Feather name="x" size={22} color="#111111" />
            </Pressable>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={[styles.modalContent, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Title & Description */}
            <Text style={styles.modalTitle}>{activeItem?.title}</Text>
            <Text style={styles.modalDescription}>{activeItem?.description}</Text>

            {/* Channel 1: Email */}
            <View style={styles.channelRow}>
              <Text style={styles.channelLabel}>Email</Text>
              <Switch
                value={currentActivePrefs.email}
                onValueChange={(val) => {
                  if (activeItem) updateChannelPref(activeItem.id, 'email', val);
                }}
                trackColor={{ false: '#E2E8F0', true: '#111111' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Channel 2: Push notifications */}
            <View style={styles.channelRow}>
              <Text style={styles.channelLabel}>Push notifications</Text>
              <Switch
                value={currentActivePrefs.push}
                onValueChange={(val) => {
                  if (activeItem) updateChannelPref(activeItem.id, 'push', val);
                }}
                trackColor={{ false: '#E2E8F0', true: '#111111' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Channel 3: SMS */}
            <View style={styles.channelRow}>
              <Text style={styles.channelLabel}>SMS</Text>
              <Switch
                value={currentActivePrefs.sms}
                onValueChange={(val) => {
                  if (activeItem) updateChannelPref(activeItem.id, 'sms', val);
                }}
                trackColor={{ false: '#E2E8F0', true: '#111111' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Channel 4: Phone calls */}
            <View style={styles.channelRow}>
              <Text style={styles.channelLabel}>Phone calls</Text>
              <Switch
                value={currentActivePrefs.phone_calls}
                onValueChange={(val) => {
                  if (activeItem) updateChannelPref(activeItem.id, 'phone_calls', val);
                }}
                trackColor={{ false: '#E2E8F0', true: '#111111' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function NotificationRow({
  title,
  summary,
  onEdit,
}: {
  title: string;
  description: string;
  summary: string;
  onEdit: () => void;
}) {
  return (
    <View style={styles.notificationRow}>
      <View style={styles.rowLeft}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemSummary}>{summary}</Text>
      </View>
      <Pressable onPress={onEdit} hitSlop={8}>
        <Text style={styles.editActionText}>Edit</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  backBtnActive: {
    backgroundColor: '#F5F5F5',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.5,
    marginBottom: 20,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 28,
  },
  tabBtn: {
    paddingBottom: 12,
    marginRight: 24,
  },
  tabBtnActive: {
    borderBottomWidth: 2.5,
    borderBottomColor: '#111111',
  },
  tabText: {
    fontSize: 16,
    color: '#717171',
    fontWeight: '500',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
  tabTextActive: {
    color: '#111111',
    fontWeight: '700',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  tabContentBlock: {
    width: '100%',
  },
  sectionHeader: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 6,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    marginBottom: 16,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rowLeft: {
    flex: 1,
    paddingRight: 16,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1E1E1E',
    marginBottom: 4,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
  itemSummary: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
  },
  editActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    textDecorationLine: 'underline',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 20,
  },

  /* Bottom Sheet Modal Styles */
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  modalDescription: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
    marginBottom: 28,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  channelLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#1E1E1E',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
});
