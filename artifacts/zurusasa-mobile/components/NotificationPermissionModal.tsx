import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { notificationService } from '@/services/notificationService';

interface NotificationPermissionModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationPermissionModal({
  visible,
  onClose,
}: NotificationPermissionModalProps) {
  const { user } = useAuth();

  const handleAllow = async () => {
    if (user) {
      await notificationService.registerPushToken(user.id);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.iconCircle}>
            <Feather name="bell" size={32} color="#F26522" />
          </View>

          <Text style={styles.title}>Enable Notifications</Text>
          <Text style={styles.subtitle}>
            Receive booking updates, messages, payments, and travel reminders instantly.
          </Text>

          <Pressable
            onPress={handleAllow}
            style={({ pressed }) => [
              styles.allowBtn,
              { opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={styles.allowBtnText}>Allow Notifications</Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.skipBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={styles.skipBtnText}>Skip for Now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(242, 101, 34, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: 'DMSans_700Bold',
    color: '#222222',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#717171',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  allowBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F26522',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F26522',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  allowBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'DMSans_700Bold',
  },
  skipBtn: {
    paddingVertical: 10,
  },
  skipBtnText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#717171',
  },
});
