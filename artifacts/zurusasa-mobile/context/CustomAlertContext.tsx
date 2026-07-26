import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AlertOptions {
  title: string;
  message?: string;
  icon?: string;
  buttons?: AlertButton[];
}

interface CustomAlertContextValue {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
}

const CustomAlertContext = createContext<CustomAlertContextValue | undefined>(undefined);

export function CustomAlertProvider({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertOptions | null>(null);

  const showAlert = useCallback((options: AlertOptions) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAlertConfig(options);
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  const handlePress = (button?: AlertButton) => {
    hideAlert();
    if (button?.onPress) {
      button.onPress();
    }
  };

  const buttons = alertConfig?.buttons?.length
    ? alertConfig.buttons
    : [{ text: 'OK', style: 'default' as const }];

  return (
    <CustomAlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={hideAlert}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={hideAlert} />

          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {alertConfig?.icon ? (
              <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
                <Feather name={alertConfig.icon as any} size={28} color={colors.primary} />
              </View>
            ) : null}

            <Text style={[styles.title, { color: colors.foreground }]}>
              {alertConfig?.title}
            </Text>

            {alertConfig?.message ? (
              <Text style={[styles.message, { color: colors.mutedForeground }]}>
                {alertConfig.message}
              </Text>
            ) : null}

            <View style={styles.buttonRow}>
              {buttons.map((btn, idx) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                const isPrimary = !isDestructive && !isCancel;

                return (
                  <Pressable
                    key={idx}
                    onPress={() => handlePress(btn)}
                    style={({ pressed }) => [
                      styles.btn,
                      isPrimary && { backgroundColor: colors.primary },
                      isCancel && { backgroundColor: colors.secondary },
                      isDestructive && { backgroundColor: `${colors.destructive}18`, borderWidth: 1, borderColor: colors.destructive },
                      { opacity: pressed ? 0.85 : 1, flex: buttons.length > 1 ? 1 : undefined },
                    ]}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        isPrimary && { color: '#ffffff' },
                        isCancel && { color: colors.foreground },
                        isDestructive && { color: colors.destructive },
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: 'DMSans_700Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
});
