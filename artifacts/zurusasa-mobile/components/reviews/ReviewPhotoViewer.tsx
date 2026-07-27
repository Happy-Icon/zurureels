import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';

interface ReviewPhotoViewerProps {
  visible: boolean;
  photoUrl: string | null;
  onClose: () => void;
}

export function ReviewPhotoViewer({
  visible,
  photoUrl,
  onClose,
}: ReviewPhotoViewerProps) {
  if (!photoUrl) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
          <Feather name="x" size={24} color="#FFFFFF" />
        </Pressable>

        <Image
          source={{ uri: photoUrl }}
          style={styles.fullImage}
          contentFit="contain"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '80%',
  },
});
