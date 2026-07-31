import React from 'react';
import { Platform, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';

export interface KeyboardScreenProps extends KeyboardAwareScrollViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  stickyFooter?: React.ReactNode;
  extraScrollHeight?: number;
}

export function KeyboardScreen({
  children,
  style,
  contentContainerStyle,
  stickyFooter,
  extraScrollHeight = 32,
  keyboardShouldPersistTaps = 'handled',
  showsVerticalScrollIndicator = false,
  ...props
}: KeyboardScreenProps) {
  if (Platform.OS === 'web') {
    return (
      <View style={[{ flex: 1 }, style]}>
        <ScrollView
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          contentContainerStyle={contentContainerStyle}
        >
          {children}
        </ScrollView>
        {stickyFooter ? <View>{stickyFooter}</View> : null}
      </View>
    );
  }

  return (
    <View style={[{ flex: 1 }, style]}>
      <KeyboardAwareScrollView
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        extraKeyboardSpace={extraScrollHeight}
        bottomOffset={extraScrollHeight}
        contentContainerStyle={contentContainerStyle}
        {...props}
      >
        {children}
      </KeyboardAwareScrollView>
      {stickyFooter ? <View>{stickyFooter}</View> : null}
    </View>
  );
}
