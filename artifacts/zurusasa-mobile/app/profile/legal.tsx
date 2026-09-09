import React, { useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';

export type LegalDocId = 'terms' | 'privacy' | 'cookies' | 'refunds' | 'business' | 'licenses';

interface LegalDoc {
  id: LegalDocId;
  title: string;
  lastUpdated: string;
  sections: { heading: string; body: string }[];
}

const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  terms: {
    id: 'terms',
    title: 'Terms of Service',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: '1. Welcome to ZuruSasa',
        body: 'These Terms of Service ("Terms") govern your access to and use of the ZuruSasa mobile application, website, and related services (collectively, the "Platform"). By creating an account, browsing listings, or confirming a booking, you agree to be bound by these Terms and our policies.',
      },
      {
        heading: '2. The ZuruSasa Marketplace',
        body: 'ZuruSasa provides an online marketplace that enables registered users ("Guests") to discover, reserve, and review short-term stays, coastal villas, excursions, and cultural experiences offered by independent, verified third-party hosts and operators ("Hosts"). ZuruSasa acts solely as an intermediary technology platform.',
      },
      {
        heading: '3. Compliance with Local Tourism & Safety Standards',
        body: 'All accommodation and experience listings are expected to comply with applicable local hospitality standards, safety guidelines, and maritime regulations. Operators of boat trips, dhow cruises, and water activities must maintain proper safety gear, certified crew, and life jackets for all passengers.',
      },
      {
        heading: '4. User Accounts & Security',
        body: 'You are responsible for safeguarding your login credentials, passkeys, and biometric authentication. You agree to provide accurate, truthful information during registration and keep your profile details updated.',
      },
      {
        heading: '5. Bookings & Payments',
        body: 'When you confirm a booking, you agree to pay the total price displayed, including applicable taxes, levies, and service fees. Payments are securely processed through M-Pesa, card networks, and supported payment channels. Host payouts are disbursed after successful guest check-in.',
      },
      {
        heading: '6. Review Integrity',
        body: 'We maintain a strict zero-tolerance policy against fake, incentivized, or retaliatory reviews. Only guests who have completed a verified stay or experience on ZuruSasa are eligible to submit reviews.',
      },
      {
        heading: '7. Community Conduct & Respect',
        body: 'All users agree to treat hosts, guests, neighbors, and coastal communities with dignity and respect. Discrimination, harassment, fraudulent listings, unauthorized events, and harm to local marine environments are strictly prohibited.',
      },
      {
        heading: '8. Limitation of Liability',
        body: 'To the maximum extent permitted by applicable law, ZuruSasa shall not be liable for indirect, incidental, special, or consequential damages arising out of your use of the Platform or participation in any booked experience.',
      },
      {
        heading: '9. Governing Law',
        body: 'These Terms are governed by and construed in accordance with the laws of Kenya, without regard to conflict of law principles.',
      },
    ],
  },
  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: '1. Overview',
        body: 'ZuruSasa Technologies Limited ("we", "us", or "our") respects your personal privacy. This Privacy Policy describes how we collect, use, and protect your information when you use our mobile application and services.',
      },
      {
        heading: '2. Information We Collect',
        body: 'We adhere to data minimization principles and collect only the information necessary to provide our services:\n• Contact & Profile: Full name, phone number, and email address.\n• Verification: Identification details where required for booking security and host compliance.\n• Transaction Data: Payment confirmation references and booking history.\n• Technical Data: Device identifiers, crash diagnostics, and log data to maintain app stability.',
      },
      {
        heading: '3. How We Use Your Information',
        body: 'We use your data to:\n• Process and confirm your reservations.\n• Enable secure messaging between hosts and guests.\n• Facilitate secure M-Pesa and card payments.\n• Protect against fraud and ensure community safety.\n• Provide 24/7 customer support.',
      },
      {
        heading: '4. Passkeys & Biometric Security',
        body: 'When you log in using Passkeys, Face ID, or fingerprint authentication, all biometric processing occurs locally on your device hardware secure enclave. Biometric data is never sent to, accessed by, or stored on ZuruSasa servers.',
      },
      {
        heading: '5. Information Sharing',
        body: 'We do not sell your personal data. We only share essential details with confirmed hosts or guests to facilitate your stay, and with trusted infrastructure partners (payment processors, cloud database hosting) under strict confidentiality agreements.',
      },
      {
        heading: '6. Your Rights & Choices',
        body: 'You have the right to access, update, export, or request the deletion of your personal data at any time through your Profile Settings, or by contacting support@zurusasa.com.',
      },
      {
        heading: '7. Contact Us',
        body: 'If you have questions or concerns regarding our privacy practices, please contact our privacy team at privacy@zurusasa.com or legal@zurusasa.com.',
      },
    ],
  },
  cookies: {
    id: 'cookies',
    title: 'Cookie Policy',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: '1. What Are Cookies and Device Storage?',
        body: 'Cookies and local storage technologies (such as AsyncStorage and secure session tokens) are small data files stored on your device that help keep you signed in, remember your preferences, and maintain app performance.',
      },
      {
        heading: '2. How We Use Storage Technologies',
        body: 'We use storage technologies for the following essential purposes:\n• Authentication & Security: Keeping your account securely authenticated and protecting against unauthorized access.\n• Preferences: Remembering your theme (Dark/Light mode), language, and display settings.\n• Performance: Storing local cache to enable fast page loads and smooth video reel playback.\n• Diagnostics: Anonymous crash reports to help our engineering team fix bugs and improve stability.',
      },
      {
        heading: '3. Third-Party Services',
        body: 'Our application utilizes secure third-party services such as Supabase for database authentication, Cloudinary for optimized image delivery, and Sentry for error logging. These providers only process technical data necessary to deliver their respective services.',
      },
      {
        heading: '4. Managing Preferences',
        body: 'You can clear your local cached data or manage notification and account preferences at any time through your Profile Settings.',
      },
    ],
  },
  refunds: {
    id: 'refunds',
    title: 'Cancellation and Refund Policy',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: '1. Cancellation Tiers',
        body: 'Every listing on ZuruSasa clearly indicates its cancellation policy prior to booking:\n\n• Flexible: Full refund up to 24 hours before check-in time.\n• Moderate: Full refund up to 5 days before check-in; 50% refund thereafter.\n• Strict: Full refund up to 14 days before check-in; 50% refund up to 7 days before check-in.',
      },
      {
        heading: '2. Extenuating Circumstances',
        body: 'ZuruSasa may grant full refunds in verified unforeseen circumstances, including government travel restrictions, declared coastal weather emergencies, or certified medical emergencies.',
      },
      {
        heading: '3. Host Cancellations',
        body: 'If a host cancels a confirmed reservation, the guest is entitled to an immediate 100% refund, along with assistance from our team to find alternative accommodations.',
      },
      {
        heading: '4. Refund Turnaround Times',
        body: 'Approved refunds are automatically returned to the original payment method:\n• M-Pesa: Typically processed within 24 to 48 hours.\n• Debit/Credit Cards: Typically completed within 3 to 7 business days, depending on your bank.',
      },
      {
        heading: '5. Requesting a Refund',
        body: 'To cancel a booking or request a refund, go to Reservations > Manage Reservation > Cancel Booking, or reach out to support@zurusasa.com for assistance.',
      },
    ],
  },
  business: {
    id: 'business',
    title: 'Business Details',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: '1. Company Information',
        body: 'Entity Name: ZuruSasa Technologies Limited\nCompany Registration: CPR/2024/198422\nKRA PIN: P052189422X\nIncorporation: Republic of Kenya',
      },
      {
        heading: '2. Office Locations',
        body: 'Nairobi Office:\nLevel 4, The Promenade, General Mathenge Drive, Westlands, Nairobi, Kenya\n\nMombasa Office:\nNyali Links Arcade, Links Road, Nyali, Mombasa, Kenya',
      },
      {
        heading: '3. Contact Details',
        body: 'Customer Support: support@zurusasa.com\nLegal Inquiries: legal@zurusasa.com\nHelpline: +254 700 000 000 / +254 711 888 999',
      },
    ],
  },
  licenses: {
    id: 'licenses',
    title: 'Open source licences',
    lastUpdated: 'September 2026',
    sections: [
      {
        heading: 'React Native & Expo',
        body: 'MIT License\n\nCopyright (c) Meta Platforms, Inc. and affiliates.\nCopyright (c) 650 Industries, Inc.\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files.',
      },
      {
        heading: 'Supabase Client',
        body: 'MIT License\n\nCopyright (c) 2020 Supabase Inc.\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software to deal in the Software without restriction.',
      },
      {
        heading: 'Icons & Media',
        body: 'MIT License\n\nCopyright (c) Cole Bemis (Feather Icons).\nLifestyle and coastal photography are provided under commercial license agreements and proprietary host uploads.',
      },
    ],
  },
};

export default function LegalScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ doc?: string }>();

  const [activeDoc, setActiveDoc] = useState<LegalDoc | null>(null);

  useEffect(() => {
    if (params.doc && params.doc in LEGAL_DOCS) {
      setActiveDoc(LEGAL_DOCS[params.doc as LegalDocId]);
    }
  }, [params.doc]);

  const topPad = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPad = Platform.OS === 'web' ? 40 : insets.bottom + 24;

  const legalItems: { id: LegalDocId; title: string; icon: any }[] = [
    {
      id: 'terms',
      title: 'Terms of Service',
      icon: 'file-text',
    },
    {
      id: 'privacy',
      title: 'Privacy Policy',
      icon: 'shield',
    },
    {
      id: 'cookies',
      title: 'Cookie Policy',
      icon: 'disc',
    },
    {
      id: 'refunds',
      title: 'Cancellation and Refund Policy',
      icon: 'refresh-cw',
    },
    {
      id: 'business',
      title: 'Business Details',
      icon: 'briefcase',
    },
    {
      id: 'licenses',
      title: 'Open source licences',
      icon: 'book-open',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          testID="legal-back-btn"
          accessibilityRole="button"
          accessibilityLabel="Go back"
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
              accessibilityRole="button"
              accessibilityLabel={item.title}
              onPress={() => setActiveDoc(LEGAL_DOCS[item.id])}
              style={({ pressed }) => [
                styles.rowItem,
                { borderBottomColor: colors.border },
                pressed && styles.rowItemPressed,
              ]}
            >
              {/* Left Icon */}
              <View style={styles.iconWrapper}>
                <Feather name={item.icon} size={20} color={colors.text} />
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
              accessibilityRole="button"
              accessibilityLabel="Close document"
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
            <Text style={[styles.docLastUpdated, { color: colors.mutedForeground }]}>
              Last updated: {activeDoc?.lastUpdated}
            </Text>

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
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 28,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  listBlock: {
    gap: 4,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowItemPressed: {
    opacity: 0.7,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(128,128,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 6,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  docLastUpdated: {
    fontSize: 13,
    marginBottom: 24,
  },
  docSection: {
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_700Bold',
      default: 'sans-serif',
    }),
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'DMSans_400Regular',
      default: 'sans-serif',
    }),
  },
});
