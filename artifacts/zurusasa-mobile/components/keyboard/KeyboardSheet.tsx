import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

export interface KeyboardSheetProps {
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  extraScrollHeight?: number;
}

export function KeyboardSheet({
  children,
  containerStyle,
  contentStyle,
  extraScrollHeight = 24,
}: KeyboardSheetProps) {
  return (
    <View style={[styles.sheetContainer, containerStyle]}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    width: '100%',
    maxHeight: '85%',
  },
  scrollFlex: {
    width: '100%',
  },
});
