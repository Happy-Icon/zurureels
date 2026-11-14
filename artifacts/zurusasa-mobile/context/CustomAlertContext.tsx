import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, useTheme } from '@/hooks/useColors';

export type AlertVariant = 'success' | 'error' | 'warning' | 'destructive' | 'info';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AlertOptions {
  title: string;
  message?: string;
  icon?: string;
  variant?: AlertVariant;
  buttons?: AlertButton[];
}

interface CustomAlertContextValue {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

interface AlertVisuals {
  variant: AlertVariant;
  iconName: string;
  badgeBg: string;
  haloBg: string;
  haloBorder: string;
  pillBg: string;
  pillText: string;
  pillLabel: string;
}

const SUCCESS_TITLE_RE =
  /\b(success|published|confirmed|saved|verified|updated|added|claimed|unblocked|sent|copied|complete|completed|scheduled|terminated|removed|activated|live|ready|shared|enabled|attached|submitted)\b|🎉|✨/i;
const DESTRUCTIVE_TITLE_RE =
  /\b(delete|remove|cancel\s+reservation|cancel\s+booking|cancel\s+request|deactivate|sign\s*out|log\s*out|clear\s+history|clear\s+all|clear\s+conversation)\b/i;
const ERROR_TITLE_RE =
  /\b(error|failed|failure|declined|unable|could\s+not|expired)\b/i;
const WARNING_TITLE_RE =
  /\b(invalid|required|missing|select|unavailable|mismatch|incomplete|limit|warning|notice|wait|longer|permission|needed)\b/i;
const WARNING_FROM_ALERT_CIRCLE_RE =
  /notice|required|invalid|missing|select|unavailable|permission|verify|wait|longer/i;

function inferAlertVariant(options: AlertOptions): AlertVariant {
  if (options.variant) return options.variant;

  const hasDestructiveButton = options.buttons?.some((b) => b.style === 'destructive');
  if (hasDestructiveButton || options.icon === 'trash-2' || options.icon === 'log-out') {
    return 'destructive';
  }

  if (options.icon && ['check-circle', 'check', 'smile', 'unlock'].includes(options.icon)) {
    return 'success';
  }

  if (options.icon === 'alert-triangle') {
    return 'warning';
  }

  if (options.icon === 'alert-circle') {
    return WARNING_FROM_ALERT_CIRCLE_RE.test(options.title) ? 'warning' : 'error';
  }

  if (DESTRUCTIVE_TITLE_RE.test(options.title)) return 'destructive';
  if (ERROR_TITLE_RE.test(options.title)) return 'error';
  if (SUCCESS_TITLE_RE.test(options.title)) return 'success';
  if (WARNING_TITLE_RE.test(options.title)) return 'warning';

  return 'info';
}

function resolveAlertVisuals(options: AlertOptions, isDark: boolean): AlertVisuals {
  const variant = inferAlertVariant(options);

  let iconName = options.icon;
  if (iconName === 'check-circle') {
    iconName = 'check';
  } else if (!iconName) {
    switch (variant) {
      case 'success':
        iconName = 'check';
        break;
      case 'error':
        iconName = 'alert-circle';
        break;
      case 'warning':
        iconName = 'alert-triangle';
        break;
      case 'destructive':
        iconName = 'trash-2';
        break;
      default:
        iconName = 'info';
        break;
    }
  }

  switch (variant) {
    case 'success':
      return {
        variant,
        iconName,
        badgeBg: '#059669',
        haloBg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
        haloBorder: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
        pillBg: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5',
        pillText: isDark ? '#34D399' : '#047857',
        pillLabel: 'CONFIRMED',
      };
    case 'error':
      return {
        variant,
        iconName,
        badgeBg: '#DC2626',
        haloBg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
        haloBorder: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
        pillBg: isDark ? 'rgba(239, 68, 68, 0.14)' : '#FEF2F2',
        pillText: isDark ? '#F87171' : '#B91C1C',
        pillLabel: 'ACTION FAILED',
      };
    case 'warning':
      return {
        variant,
        iconName,
        badgeBg: '#D97706',
        haloBg: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FFFBEB',
        haloBorder: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
        pillBg: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FFFBEB',
        pillText: isDark ? '#FBBF24' : '#B45309',
        pillLabel: 'ATTENTION',
      };
    case 'destructive':
      return {
        variant,
        iconName,
        badgeBg: '#DC2626',
        haloBg: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
        haloBorder: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
        pillBg: isDark ? 'rgba(239, 68, 68, 0.14)' : '#FEF2F2',
        pillText: isDark ? '#F87171' : '#B91C1C',
        pillLabel: 'CONFIRM ACTION',
      };
    default:
      return {
        variant: 'info',
        iconName,
        badgeBg: '#F26522',
        haloBg: isDark ? 'rgba(242, 101, 34, 0.16)' : '#FFF7ED',
        haloBorder: isDark ? 'rgba(242, 101, 34, 0.3)' : '#FED7AA',
        pillBg: isDark ? 'rgba(242, 101, 34, 0.14)' : '#FFF7ED',
        pillText: isDark ? '#FB923C' : '#C2410C',
        pillLabel: 'NOTICE',
      };
  }
}

const CustomAlertContext = createContext<CustomAlertContextValue | undefined>(undefined);

export function CustomAlertProvider({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const { isDark } = useTheme();

  const [visible, setVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertOptions | null>(null);
  const [sessionId, setSessionId] = useState(0);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.92)).current;
  const cardTranslateY = useRef(new Animated.Value(14)).current;
  const badgeScale = useRef(new Animated.Value(0.55)).current;

  const alertSessionRef = useRef(0);
  const isDismissingRef = useRef(false);

  useEffect(() => {
    if (!visible || !alertConfig) return;

    backdropOpacity.setValue(0);
    cardScale.setValue(0.92);
    cardTranslateY.setValue(14);
    badgeScale.setValue(0.55);

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        damping: 18,
        stiffness: 260,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0,
        damping: 18,
        stiffness: 260,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.spring(badgeScale, {
        toValue: 1,
        damping: 12,
        stiffness: 220,
        mass: 0.7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, sessionId, alertConfig, backdropOpacity, cardScale, cardTranslateY, badgeScale]);

  const showAlert = useCallback((options: AlertOptions) => {
    alertSessionRef.current += 1;
    isDismissingRef.current = false;

    const variant = inferAlertVariant(options);
    if (variant === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (variant === 'warning' || variant === 'destructive') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else if (variant === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    setAlertConfig(options);
    setSessionId(alertSessionRef.current);
    setVisible(true);
  }, []);

  const dismissWithCallback = useCallback(
    (afterClose?: () => void) => {
      if (isDismissingRef.current) return;
      isDismissingRef.current = true;
      const sessionAtClose = alertSessionRef.current;

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 130,
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 0.95,
          duration: 130,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 8,
          duration: 130,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isDismissingRef.current = false;
        if (alertSessionRef.current === sessionAtClose) {
          setVisible(false);
        }
        afterClose?.();
      });
    },
    [backdropOpacity, cardScale, cardTranslateY],
  );

  const hideAlert = useCallback(() => {
    dismissWithCallback();
  }, [dismissWithCallback]);

  const handlePress = (button?: AlertButton) => {
    dismissWithCallback(button?.onPress);
  };

  const rawButtons = alertConfig?.buttons?.length
    ? alertConfig.buttons
    : [{ text: 'OK', style: 'default' as const }];

  const stackVertical =
    rawButtons.length > 2 ||
    (rawButtons.length === 2 &&
      (rawButtons[0].text.length > 15 || rawButtons[1].text.length > 15));

  const orderedButtons = React.useMemo(() => {
    if (rawButtons.length !== 2) return rawButtons;
    const cancelIdx = rawButtons.findIndex((b) => b.style === 'cancel');
    if (cancelIdx === -1) return rawButtons;
    const cancelBtn = rawButtons[cancelIdx];
    const otherBtn = rawButtons[cancelIdx === 0 ? 1 : 0];
    // Horizontal: cancel left, primary/destructive right; Vertical: primary/destructive top, cancel bottom
    return stackVertical ? [otherBtn, cancelBtn] : [cancelBtn, otherBtn];
  }, [rawButtons, stackVertical]);

  const visuals = alertConfig ? resolveAlertVisuals(alertConfig, isDark) : null;

  return (
    <CustomAlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}

      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={hideAlert}
      >
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.backdropFill,
              {
                backgroundColor: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.56)',
                opacity: backdropOpacity,
              },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={hideAlert} />
          </Animated.View>

          {alertConfig && visuals ? (
            <Animated.View
              style={[
                styles.modalCard,
                {
                  backgroundColor: colors.card,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
                  shadowOpacity: isDark ? 0.45 : 0.18,
                  opacity: backdropOpacity,
                  transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
                },
              ]}
            >
              {/* Concentric Double-Halo Icon Badge */}
              <Animated.View
                style={[
                  styles.haloRing,
                  {
                    backgroundColor: visuals.haloBg,
                    borderColor: visuals.haloBorder,
                    transform: [{ scale: badgeScale }],
                  },
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: visuals.badgeBg }]}>
                  <Feather name={visuals.iconName as any} size={26} color="#FFFFFF" />
                </View>
              </Animated.View>

              {/* Status Eyebrow Pill */}
              <View style={[styles.statusPill, { backgroundColor: visuals.pillBg }]}>
                <Text style={[styles.statusPillText, { color: visuals.pillText }]}>
                  {visuals.pillLabel}
                </Text>
              </View>

              {/* Title & Message */}
              <Text style={[styles.title, { color: colors.foreground }]}>
                {alertConfig.title}
              </Text>

              {alertConfig.message ? (
                <Text style={[styles.message, { color: colors.mutedForeground }]}>
                  {alertConfig.message}
                </Text>
              ) : null}

              {/* Action Buttons */}
              <View
                style={[
                  styles.buttonContainer,
                  stackVertical ? styles.buttonColumn : styles.buttonRow,
                ]}
              >
                {orderedButtons.map((btn, idx) => {
                  const isDestructive = btn.style === 'destructive';
                  const isCancel = btn.style === 'cancel';
                  const isPrimary = !isDestructive && !isCancel;
                  const isSingle = orderedButtons.length === 1;

                  return (
                    <Pressable
                      key={`${btn.text}-${idx}`}
                      onPress={() => handlePress(btn)}
                      style={({ pressed }) => [
                        styles.btn,
                        isSingle
                          ? styles.singleBtn
                          : stackVertical
                          ? styles.stackedBtn
                          : styles.rowBtn,
                        isPrimary && styles.primaryBtn,
                        isDestructive && styles.destructiveBtn,
                        isCancel && {
                          backgroundColor: isDark ? '#27272A' : '#F3F4F6',
                          borderWidth: 1,
                          borderColor: colors.border,
                        },
                        {
                          opacity: pressed ? 0.88 : 1,
                          transform: [{ scale: pressed ? 0.985 : 1 }],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.btnText,
                          isSingle && styles.singleBtnText,
                          (isPrimary || isDestructive) && styles.lightBtnText,
                          isCancel && [styles.cancelBtnText, { color: colors.foreground }],
                        ]}
                        numberOfLines={1}
                      >
                        {btn.text}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </CustomAlertContext.Provider>
  );
}

export function useCustomAlert(): CustomAlertContextValue {
  const ctx = useContext(CustomAlertContext);
  if (!ctx) throw new Error('useCustomAlert must be used within CustomAlertProvider');
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  backdropFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: 372,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  haloRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  statusPillText: {
    fontSize: 10.5,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 20,
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonColumn: {
    flexDirection: 'column',
  },
  btn: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  singleBtn: {
    width: '100%',
    height: 50,
  },
  rowBtn: {
    flex: 1,
    height: 48,
  },
  stackedBtn: {
    width: '100%',
    height: 48,
  },
  primaryBtn: {
    backgroundColor: '#F26522',
    shadowColor: '#F26522',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  destructiveBtn: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  btnText: {
    fontSize: 14.5,
    fontFamily: 'DMSans_700Bold',
  },
  singleBtnText: {
    fontSize: 15,
  },
  lightBtnText: {
    color: '#FFFFFF',
  },
  cancelBtnText: {
    fontFamily: 'DMSans_600SemiBold',
  },
});
