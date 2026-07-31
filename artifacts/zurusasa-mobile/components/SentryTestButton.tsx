import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Sentry, sentryLogger } from '@/lib/sentry';

export function ErrorButton() {
  const triggerTestError = () => {
    // 1. Log info before throwing
    sentryLogger.info('User triggered test error', {
      action: 'test_error_button_click',
      timestamp: new Date().toISOString(),
    });

    // 2. Add breadcrumb
    Sentry.addBreadcrumb({
      category: 'test',
      message: 'Test error button pressed by developer',
      level: 'warning',
    });

    // 3. Throw test error
    throw new Error('This is your first error! (Sentry Test)');
  };

  return (
    <Pressable
      onPress={triggerTestError}
      style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.8 : 1 }]}
    >
      <Text style={styles.btnText}>Break the world (Sentry Test)</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  btnText: {
    color: '#FFFFFF',
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
  },
});
