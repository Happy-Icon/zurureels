import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  ModalProps,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

export interface KeyboardModalProps extends ModalProps {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  extraScrollHeight?: number;
}

export function KeyboardModal({
  children,
  visible,
  animationType = 'slide',
  transparent = true,
  onRequestClose,
  contentStyle,
  containerStyle,
  extraScrollHeight = 24,
  ...props
}: KeyboardModalProps) {
  return (
    <Modal
      visible={visible}
      animationType={animationType}
      transparent={transparent}
      onRequestClose={onRequestClose}
      {...props}
    >
      <View style={[styles.overlay, containerStyle]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoid}
          pointerEvents="box-none"
        >
          <KeyboardAwareScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            extraKeyboardSpace={extraScrollHeight}
            bottomOffset={extraScrollHeight}
            contentContainerStyle={contentStyle}
            style={styles.scrollFlex}
          >
            {children}
          </KeyboardAwareScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    width: '100%',
    maxHeight: '92%',
    justifyContent: 'flex-end',
  },
  scrollFlex: {
    width: '100%',
  },
});
