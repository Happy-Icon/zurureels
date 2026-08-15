import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAuth } from '@/context/AuthContext';
import { useCustomAlert } from '@/context/CustomAlertContext';

export default function ReferAHostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { showAlert } = useCustomAlert();

  const [currentSubView, setCurrentSubView] = useState<'main' | 'your_referrals'>('main');
  const [selectedReward, setSelectedReward] = useState<'home' | 'experience' | 'service'>('home');

  // Modals
  const [moreOptionsSheet, setMoreOptionsSheet] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [customLinkModal, setCustomLinkModal] = useState(false);
  const [customSlug, setCustomSlug] = useState(user?.id ? user.id.slice(0, 6).toLowerCase() : 'zuru');

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 32;

  const referralUrl = `https://zurusasa.com/r/${customSlug}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Become a host on ZuruSasa and earn extra income from your coastal home, experience, or service in Kenya! Sign up using my referral link: ${referralUrl}`,
      });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     RENDER VIEW 2: YOUR REFERRALS (SCREENSHOT 2)
     ───────────────────────────────────────────────────────────────────────────── */
  if (currentSubView === 'your_referrals') {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.headerRow, { paddingTop: topPad }]}>
          <Pressable
            onPress={() => setCurrentSubView('main')}
            style={styles.circleBtn}
            hitSlop={12}
          >
            <Feather name="x" size={22} color="#111111" />
          </Pressable>

          <Pressable
            onPress={() => setCustomLinkModal(true)}
            style={styles.pillTopBtn}
            hitSlop={8}
          >
            <Text style={styles.pillTopBtnText}>Custom links</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { flexGrow: 1, justifyContent: 'space-between', paddingBottom: bottomPad },
          ]}
        >
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyHeadline}>You haven't referred anyone yet</Text>

            {/* Cozy Sofa Illustration */}
            <View style={styles.sofaIllustrationWrapper}>
              <View style={styles.sofaBadgeBox}>
                <Text style={{ fontSize: 64 }}>🛋️</Text>
              </View>
            </View>
          </View>

          {/* Bottom Action */}
          <View style={styles.bottomBlock}>
            <Pressable
              onPress={() => setCurrentSubView('main')}
              style={styles.blackActionBtn}
            >
              <Text style={styles.blackActionBtnText}>Refer a host</Text>
            </Pressable>

            <Pressable
              onPress={() =>
                showAlert({
                  title: 'Referral Tracking',
                  message:
                    'When a friend signs up using your link and publishes a listing, their progress and completed payouts will appear here automatically.',
                  icon: 'info',
                })
              }
              style={{ alignSelf: 'center', marginTop: 16 }}
            >
              <Text style={styles.cantFindText}>Can't find your referral?</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     RENDER VIEW 1: MAIN REFER A HOST (SCREENSHOT 1)
     ───────────────────────────────────────────────────────────────────────────── */
  return (
    <View style={styles.container}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={[styles.headerRow, { paddingTop: topPad }]}>
        <Pressable
          testID="refer-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/(tabs)/profile');
          }}
          style={styles.circleBtn}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color="#111111" />
        </Pressable>

        <View style={styles.headerRightGroup}>
          <Pressable
            testID="your-referrals-btn"
            onPress={() => setCurrentSubView('your_referrals')}
            style={styles.pillTopBtn}
            hitSlop={8}
          >
            <Text style={styles.pillTopBtnText}>Your referrals</Text>
          </Pressable>

          <Pressable
            testID="refer-more-options-btn"
            onPress={() => setMoreOptionsSheet(true)}
            style={styles.circleBtn}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="dots-horizontal" size={22} color="#111111" />
          </Pressable>
        </View>
      </View>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        {/* Title */}
        <Text style={styles.pageTitleCenter}>Refer a host,{'\n'}earn cash</Text>

        {/* ── REWARD CARD 1: HOME ────────────────────────────────────────────── */}
        <Pressable
          onPress={() => setSelectedReward('home')}
          style={[
            styles.rewardCard,
            selectedReward === 'home' && styles.rewardCardSelected,
          ]}
        >
          <View style={styles.rewardCardTextStack}>
            <Text style={styles.rewardCardTitle}>Home</Text>
            <Text style={styles.rewardCardSubtitle}>
              Reward varies based on listing location.
            </Text>
          </View>
          <View style={styles.rewardCardIllustration}>
            <Text style={{ fontSize: 32 }}>🏡</Text>
          </View>
        </Pressable>

        {/* ── REWARD CARD 2: EXPERIENCE ──────────────────────────────────────── */}
        <Pressable
          onPress={() => setSelectedReward('experience')}
          style={[
            styles.rewardCard,
            selectedReward === 'experience' && styles.rewardCardSelected,
            { marginTop: 14 },
          ]}
        >
          <View style={styles.rewardCardTextStack}>
            <Text style={styles.rewardCardTitle}>Experience</Text>
            <Text style={styles.rewardCardSubtitle}>
              You'll earn <Text style={styles.boldAmount}>KSh 6,462 KES</Text>.
            </Text>
          </View>
          <View style={styles.rewardCardIllustration}>
            <Text style={{ fontSize: 32 }}>🎈</Text>
          </View>
        </Pressable>

        {/* ── REWARD CARD 3: SERVICE ─────────────────────────────────────────── */}
        <Pressable
          onPress={() => setSelectedReward('service')}
          style={[
            styles.rewardCard,
            selectedReward === 'service' && styles.rewardCardSelected,
            { marginTop: 14 },
          ]}
        >
          <View style={styles.rewardCardTextStack}>
            <Text style={styles.rewardCardTitle}>Service</Text>
            <Text style={styles.rewardCardSubtitle}>
              You'll earn <Text style={styles.boldAmount}>KSh 12,923 KES</Text>.
            </Text>
          </View>
          <View style={styles.rewardCardIllustration}>
            <Text style={{ fontSize: 32 }}>🛎️</Text>
          </View>
        </Pressable>

        {/* ── SHARE BUTTON ───────────────────────────────────────────────────── */}
        <Pressable
          testID="share-referral-btn"
          onPress={handleShare}
          style={styles.pinkShareBtn}
        >
          <Text style={styles.pinkShareBtnText}>Share referral link</Text>
        </Pressable>

        {/* Disclaimer */}
        <Text style={styles.disclaimerText}>
          Eligible locations & listing types only. Amounts expire on Oct 14, 2026.{' '}
          <Text
            onPress={() =>
              showAlert({
                title: 'Referral Terms',
                message:
                  'Referrals must result in a completed booking of at least KES 10,000 within 180 days of publishing the listing.',
                icon: 'file-text',
              })
            }
            style={styles.underlineLink}
          >
            Terms apply
          </Text>{' '}
          ·{' '}
          <Text
            onPress={() =>
              showAlert({
                title: 'How Referrals Work',
                message:
                  '1. Send your referral link to friends.\n2. They publish their home, experience, or service.\n3. You receive cash rewards directly to your M-Pesa account when their first reservation is completed.',
                icon: 'gift',
              })
            }
            style={styles.underlineLink}
          >
            How referrals work
          </Text>
        </Text>
      </ScrollView>

      {/* ── MORE WAYS TO SHARE BOTTOM SHEET (SCREENSHOT 3) ───────────────────── */}
      <Modal
        visible={moreOptionsSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreOptionsSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setMoreOptionsSheet(false)} />

          <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>More ways to share</Text>
              <Pressable
                onPress={() => setMoreOptionsSheet(false)}
                style={styles.sheetCloseBtn}
                hitSlop={10}
              >
                <Feather name="x" size={20} color="#111111" />
              </Pressable>
            </View>

            {/* QR Code Option */}
            <Pressable
              onPress={() => {
                setMoreOptionsSheet(false);
                setQrModalVisible(true);
              }}
              style={styles.sheetOptionRow}
            >
              <Ionicons name="qr-code-outline" size={24} color="#111111" style={{ marginRight: 16 }} />
              <Text style={styles.sheetOptionText}>QR code</Text>
            </Pressable>

            {/* Customise Link Option */}
            <Pressable
              onPress={() => {
                setMoreOptionsSheet(false);
                setCustomLinkModal(true);
              }}
              style={styles.sheetOptionRow}
            >
              <Feather name="edit-2" size={22} color="#111111" style={{ marginRight: 16 }} />
              <Text style={styles.sheetOptionText}>Customise link</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── QR CODE MODAL ────────────────────────────────────────────────────── */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <Pressable onPress={() => setQrModalVisible(false)} style={styles.dialogOverlay}>
          <View style={styles.qrDialog}>
            <Text style={styles.qrDialogTitle}>Scan to Host</Text>
            <Text style={styles.qrDialogSub}>Point a phone camera at this QR code to join ZuruSasa as a host.</Text>

            <View style={styles.qrCodeBox}>
              <MaterialCommunityIcons name="qrcode" size={160} color="#111111" />
            </View>

            <Text style={styles.qrCodeLinkText}>{referralUrl}</Text>

            <Pressable onPress={() => setQrModalVisible(false)} style={styles.qrCloseBtn}>
              <Text style={styles.qrCloseBtnText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── CUSTOMISE LINK MODAL ─────────────────────────────────────────────── */}
      <Modal
        visible={customLinkModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCustomLinkModal(false)}
      >
        <View style={[styles.modalSheet, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          <View style={styles.modalSheetHeader}>
            <Pressable onPress={() => setCustomLinkModal(false)} style={styles.circleBtn}>
              <Feather name="x" size={22} color="#111111" />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Customise link</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.modalSheetBody}>
            <Text style={styles.inputLabel}>Your Custom Referral Handle</Text>
            <View style={styles.customSlugInputWrap}>
              <Text style={styles.slugPrefix}>zurusasa.com/r/</Text>
              <TextInput
                value={customSlug}
                onChangeText={(t) => setCustomSlug(t.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="my-name"
                placeholderTextColor="#9E9E9E"
                autoCapitalize="none"
                style={styles.slugInput}
              />
            </View>

            <Pressable
              onPress={() => {
                showAlert({
                  title: 'Link Customised',
                  message: `Your new referral link is: ${referralUrl}`,
                  icon: 'check-circle',
                });
                setCustomLinkModal(false);
              }}
              style={styles.saveLinkBtn}
            >
              <Text style={styles.saveLinkBtnText}>Save custom link</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillTopBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillTopBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  pageTitleCenter: {
    fontSize: 34,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 40,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  rewardCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  rewardCardSelected: {
    borderColor: '#111111',
    borderWidth: 2,
  },
  rewardCardTextStack: {
    flex: 1,
    paddingRight: 16,
  },
  rewardCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  rewardCardSubtitle: {
    fontSize: 14,
    color: '#717171',
    lineHeight: 20,
  },
  boldAmount: {
    fontWeight: '700',
    color: '#111111',
  },
  rewardCardIllustration: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinkShareBtn: {
    backgroundColor: '#E11D48',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  pinkShareBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  disclaimerText: {
    fontSize: 13,
    color: '#717171',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  underlineLink: {
    color: '#111111',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  /* Empty Referrals Screen (Screenshot 2) */
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 24,
  },
  emptyHeadline: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 48,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  sofaIllustrationWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
  },
  sofaBadgeBox: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBlock: {
    width: '100%',
    marginTop: 32,
  },
  blackActionBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blackActionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cantFindText: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  /* More Options Bottom Sheet (Screenshot 3) */
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  sheetOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111111',
  },

  /* Dialogs */
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  qrDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  qrDialogTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  qrDialogSub: {
    fontSize: 13,
    color: '#717171',
    textAlign: 'center',
    marginBottom: 20,
  },
  qrCodeBox: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    marginBottom: 16,
  },
  qrCodeLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E11D48',
    marginBottom: 20,
  },
  qrCloseBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  qrCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* Custom Slug Modal */
  modalSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  modalSheetBody: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 8,
  },
  customSlugInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 24,
  },
  slugPrefix: {
    fontSize: 15,
    color: '#717171',
    fontWeight: '600',
  },
  slugInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  saveLinkBtn: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveLinkBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
