import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Returns dynamic dimensions and safe clearance padding for screens
 * rendered under the persistent CustomBottomTabBar.
 */
export function useTabBarInset() {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 6);
  const barHeight = 56 + bottomPad;
  const contentPaddingBottom = barHeight + 16;

  return {
    barHeight,
    bottomPad,
    contentPaddingBottom,
    bottomInset: insets.bottom,
  };
}
