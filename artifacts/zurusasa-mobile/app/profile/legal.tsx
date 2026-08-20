import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

interface LegalDoc {
  id: 'terms' | 'privacy' | 'licenses';
  title: string;
  lastUpdated: string;
  sections: { heading: string; body: string }[];
}

const LEGAL_DOCS: Record<'terms' | 'privacy' | 'licenses', LegalDoc> = {
  terms: {
    id: 'terms',
    title: 'Terms of Service',
    lastUpdated: 'August 2026',
    sections: [
      {
        heading: '1. Welcome to ZuruSasa',
        body: 'These Terms of Service ("Terms") govern your access to and use of the ZuruSasa mobile application, website, and related services (collectively, the "Platform"). By accessing or using ZuruSasa, you agree to be bound by these Terms and our Privacy Policy.',
      },
      {
        heading: '2. The ZuruSasa Marketplace',
        body: 'ZuruSasa provides an online marketplace that enables registered users ("Guests") to discover, book, and review stays, coastal excursions, yacht experiences, and local tours offered by third-party hosts and verified operators ("Hosts"). ZuruSasa is not a real estate broker, tour operator, or travel agency.',
      },
      {
        heading: '3. User Accounts & Security',
        body: 'You must create an account to access certain features of the Platform. You are responsible for safeguarding your login credentials, passkeys, and biometric authentication. You agree to provide accurate, current, and complete information during registration and keep your profile updated.',
      },
      {
        heading: '4. Bookings & Financial Terms',
        body: 'When you confirm a booking for a stay or coastal experience, you agree to pay the total amount shown, including applicable taxes, service fees, and security deposits. Payments are securely processed via M-Pesa, card networks, or supported bank channels. Hosts receive payouts in accordance with our Payout Terms.',
      },
      {
        heading: '5. Cancellations & Refunds',
        body: 'Cancellations and refunds are governed by the specific cancellation policy selected by the Host (e.g., Flexible, Moderate, or Strict) as displayed at the time of booking. ZuruSasa reserves the right to override host cancellation policies in cases of extenuating circumstances or severe safety hazards.',
      },
      {
        heading: '6. Community Conduct & Safety',
        body: 'All users agree to treat hosts, guests, and coastal communities with respect and dignity. Discrimination, harassment, fraudulent listings, unauthorized filming, and violation of local environmental and marine protection regulations are strictly prohibited and may result in immediate account termination.',
      },
      {
        heading: '7. Limitation of Liability',
        body: 'To the maximum extent permitted by applicable law, ZuruSasa shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Platform or attendance at any booked experience.',
      },
      {
        heading: '8. Governing Law',
        body: 'These Terms are governed by and construed in accordance with the laws of the Republic of Kenya, without regard to its conflict of law principles.',
      },
    ],
  },
  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    lastUpdated: 'August 2026',
    sections: [
      {
        heading: '1. Information We Collect',
        body: 'We collect information you provide directly to us (such as your name, email, phone number, Kenyan ID / passport verification, and payment details) as well as data collected automatically when you browse reels, search coastal stays, and message hosts.',
      },
      {
        heading: '2. How We Use Your Information',
        body: 'We use your information to operate, improve, and personalize ZuruSasa, process secure M-Pesa and card transactions, verify host identities, send booking confirmations and trip itineraries, and ensure community safety.',
      },
      {
        heading: '3. Data Sharing & Third Parties',
        body: 'We share your information with confirmed hosts or guests only to the extent necessary to facilitate your booking (e.g., guest name, contact number, check-in instructions). We do not sell your personal information to third parties.',
      },
      {
        heading: '4. Biometrics & Passkeys',
        body: 'When you register a Passkey, your biometric data (fingerprint, Face ID) remains stored strictly on your physical device secure enclave and is never transmitted to or stored on ZuruSasa servers.',
      },
      {
        heading: '5. Your Rights & Data Requests',
        body: 'You have the right to access, correct, download, or delete your personal data at any time via Profile > Privacy > Data privacy.',
      },
    ],
  },
  licenses: {
    id: 'licenses',
    title: 'Open Source Licences',
    lastUpdated: 'August 2026',
    sections: [
      {
        heading: 'React Native & Expo',
        body: 'MIT License\n\nCopyright (c) Meta Platforms, Inc. and affiliates.\nCopyright (c) 650 Industries, Inc.\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction.',
      },
      {
        heading: 'Supabase Client',
        body: 'MIT License\n\nCopyright (c) 2020 Supabase Inc.\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software to deal in the Software without restriction.',
      },
      {
        heading: 'Expo Vector Icons & Lucide/Feather',
        body: 'MIT License\n\nCopyright (c) Cole Bemis\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software without restriction.',
      },
    ],
  },
};

export default function LegalScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeDoc, setActiveDoc] = useState<LegalDoc | null>(null);

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 24;

  const legalItems = [
    {
      id: 'terms' as const,
      title: 'Terms of Service',
    },
    {
      id: 'privacy' as const,
      title: 'Privacy Policy',
    },
    {
      id: 'licenses' as const,
      title: 'Open source licences',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          testID="legal-back-btn"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/(tabs)/profile');
          }}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnActive]}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* ── CONTENT ──────────────────────────────────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      >
        {/* Title */}
        <Text style={[styles.pageTitle, { color: colors.text }]}>Legal</Text>

        {/* List Rows */}
        <View style={styles.listBlock}>
          {legalItems.map((item) => (
            <Pressable
              key={item.id}
              testID={`legal-item-${item.id}`}
              onPress={() => setActiveDoc(LEGAL_DOCS[item.id])}
              style={({ pressed }) => [
                styles.rowItem,
                { borderBottomColor: colors.border },
                pressed && styles.rowItemPressed,
              ]}
            >
              {/* Left Icon (Open Book Outline) */}
              <View style={styles.iconWrapper}>
                <Feather name="book-open" size={22} color={colors.text} />
              </View>

              {/* Title */}
              <Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>

              {/* Right Chevron */}
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} style={styles.chevron} />
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* ── DOCUMENT VIEWER MODAL ────────────────────────────────────────────── */}
      <Modal
        visible={!!activeDoc}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveDoc(null)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.card, paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 16 }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={() => setActiveDoc(null)}
              style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
              hitSlop={10}
            >
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]} numberOfLines={1}>
              {activeDoc?.title}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Modal Body */}
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={[styles.modalScrollContent, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.docHeadline, { color: colors.text }]}>{activeDoc?.title}</Text>
            <Text style={[styles.docLastUpdated, { color: colors.mutedForeground }]}>Last updated: {activeDoc?.lastUpdated}</Text>

            {activeDoc?.sections.map((section, idx) => (
              <View key={idx} style={styles.docSection}>
                <Text style={[styles.sectionHeading, { color: colors.text }]}>{section.heading}</Text>
                <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 32,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  listBlock: {
    gap: 8,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  rowItemPressed: {
    backgroundColor: '#F8F8F8',
  },
  iconWrapper: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 16,
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#1E1E1E',
    letterSpacing: -0.2,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_500Medium',
      default: 'sans-serif',
    }),
  },
  chevron: {
    marginLeft: 12,
  },

  /* Modal Styles */
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    maxWidth: '70%',
    textAlign: 'center',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  docHeadline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  docLastUpdated: {
    fontSize: 13,
    color: '#717171',
    marginBottom: 28,
  },
  docSection: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1E1E1E',
    marginBottom: 8,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  sectionBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#484848',
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_400Regular',
      default: 'sans-serif',
    }),
  },
});
