import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReelRow } from '@/lib/supabase';

const ORANGE = '#EE7D30';

interface ReelInfoSheetProps {
  reel: ReelRow;
  visible: boolean;
  onClose: () => void;
}

export function ReelInfoSheet({ reel, visible, onClose }: ReelInfoSheetProps) {
  const insets = useSafeAreaInsets();
  const exp = reel.experience;
  const meta = (exp?.metadata ?? {}) as Record<string, unknown>;
  const rating = Number((meta.rating as number | string | undefined) ?? 5);
  const highlights = Array.isArray(meta.highlights)
    ? (meta.highlights as string[]).filter((h) => typeof h === 'string')
    : [];
  const hostName = reel.host?.full_name ?? 'ZuruSasa host';
  const verified = reel.host?.verification_status === 'verified';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.handle} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <Text style={styles.title}>{exp?.title ?? 'Coastal experience'}</Text>

          <View style={styles.hostRow}>
            <View style={styles.hostAvatar}>
              <Text style={styles.hostAvatarText}>
                {hostName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.hostName}>{hostName}</Text>
            {verified ? (
              <View style={styles.agentPill}>
                <MaterialCommunityIcons name="creation" size={11} color="#fff" />
                <Text style={styles.agentPillText}>ZURU AGENT</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <MaterialCommunityIcons name="star" size={16} color="#fbbf24" />
              <Text style={styles.statText}>{rating.toFixed(1)}</Text>
            </View>
            {exp?.current_price != null ? (
              <View style={styles.stat}>
                <Feather name="tag" size={14} color={ORANGE} />
                <Text style={styles.statText}>
                  KES {Number(exp.current_price).toLocaleString()}
                  <Text style={styles.statMuted}>
                    /{exp.price_unit ?? 'person'}
                  </Text>
                </Text>
              </View>
            ) : null}
            {exp?.location ? (
              <View style={styles.stat}>
                <Feather name="map-pin" size={14} color="#a3998f" />
                <Text style={styles.statText}>{exp.location}</Text>
              </View>
            ) : null}
          </View>

          {exp?.description ? (
            <Text style={styles.description}>{exp.description}</Text>
          ) : (
            <Text style={styles.description}>
              Hosted by {hostName} on the Kenyan coast. Book now or enquire to
              get the full details from the host.
            </Text>
          )}

          {highlights.length > 0 ? (
            <View style={styles.highlights}>
              {highlights.map((h) => (
                <View key={h} style={styles.highlightChip}>
                  <Text style={styles.highlightText}>{h}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeButton,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#17140f',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 14,
  },
  content: {
    paddingBottom: 20,
    gap: 14,
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 34,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hostAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostAvatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  hostName: {
    color: '#f4f2f1',
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
  },
  agentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ORANGE,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  agentPillText: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    color: '#f4f2f1',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  statMuted: {
    color: '#a3998f',
    fontSize: 12,
    fontFamily: 'DMSans_400Regular',
  },
  description: {
    color: '#cfc8c0',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'DMSans_400Regular',
  },
  highlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  highlightChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  highlightText: {
    color: '#e8e5e3',
    fontSize: 12,
    fontFamily: 'DMSans_500Medium',
  },
  closeButton: {
    marginTop: 6,
    backgroundColor: ORANGE,
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
});
