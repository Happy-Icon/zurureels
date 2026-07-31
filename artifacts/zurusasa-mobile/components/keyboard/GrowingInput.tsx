import React, { useState } from 'react';
import {
  NativeSyntheticEvent,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputContentSizeChangeEventData,
  TextInputProps,
  TextStyle,
} from 'react-native';

export interface GrowingInputProps extends TextInputProps {
  minHeight?: number;
  maxHeight?: number;
  style?: StyleProp<TextStyle>;
}

export function GrowingInput({
  minHeight = 44,
  maxHeight = 160,
  style,
  onContentSizeChange,
  multiline = true,
  ...props
}: GrowingInputProps) {
  const [height, setHeight] = useState(minHeight);

  const handleContentSizeChange = (
    e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
  ) => {
    const contentHeight = e.nativeEvent.contentSize.height;
    if (contentHeight > 0) {
      const newHeight = Math.min(Math.max(minHeight, contentHeight), maxHeight);
      setHeight(newHeight);
    }
    onContentSizeChange?.(e);
  };

  return (
    <TextInput
      multiline={multiline}
      onContentSizeChange={handleContentSizeChange}
      style={[
        styles.defaultInput,
        style,
        multiline ? { height: Math.min(Math.max(minHeight, height), maxHeight) } : undefined,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  defaultInput: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    textAlignVertical: 'top',
  },
});
