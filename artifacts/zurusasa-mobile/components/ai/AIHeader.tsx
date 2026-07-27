import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AI_COLORS, AI_FONTS, AI_SHADOW } from './tokens';

interface AIHeaderProps {
  title?: string;
  subtitle?: string;
  showBeta?: boolean;
}

export function AIHeader({ title = 'Zuru AI', subtitle, showBeta = true }: AIHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.inner}>
        {/* Brand mark */}
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoEmoji}>✦</Text>
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{title}</Text>
              {showBeta ? (
                <View style={styles.betaBadge}>
                  <Text style={styles.betaText}>BETA</Text>
                </View>
              ) : null}
            </View>
            {subtitle ? (
              <Text style={styles.subtitle}>{subtitle}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: AI_COLORS.border,
    ...AI_SHADOW.subtle,
  },
  inner: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: AI_COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
    ...AI_SHADOW.orange,
  },
  logoEmoji: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 18,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.textPrimary,
  },
  betaBadge: {
    backgroundColor: AI_COLORS.orangeSoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  betaText: {
    fontSize: 9,
    fontFamily: AI_FONTS.bold,
    color: AI_COLORS.orange,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: AI_FONTS.regular,
    color: AI_COLORS.textTertiary,
    marginTop: 1,
  },
});
