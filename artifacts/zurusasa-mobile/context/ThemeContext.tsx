import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, useColorScheme as useRNColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import colors, { type ThemeColors } from '@/constants/colors';

export type AppearanceMode = 'system' | 'light' | 'dark';
export type ColorSchemeName = 'light' | 'dark';

const STORAGE_KEY = '@zurusasa_appearance_mode';

export interface ThemeContextValue {
  appearanceMode: AppearanceMode;
  setAppearanceMode: (mode: AppearanceMode) => Promise<void>;
  colorScheme: ColorSchemeName;
  isDark: boolean;
  colors: ThemeColors & { radius: number };
  theme: {
    colors: ThemeColors & { radius: number };
    isDark: boolean;
    colorScheme: ColorSchemeName;
  };
  isReady: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const rnColorScheme = useRNColorScheme();
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(() => {
    const initial = Appearance.getColorScheme();
    return initial === 'dark' || initial === 'light' ? initial : (rnColorScheme === 'dark' ? 'dark' : 'light');
  });
  const [appearanceMode, setAppearanceModeState] = useState<AppearanceMode>('system');
  const [isReady, setIsReady] = useState(false);

  // Active listener for OS appearance mode changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme === 'dark' || colorScheme === 'light') {
        setSystemScheme(colorScheme);
      }
    });

    if (rnColorScheme === 'dark' || rnColorScheme === 'light') {
      setSystemScheme(rnColorScheme);
    }

    return () => {
      subscription.remove();
    };
  }, [rnColorScheme]);

  // Load persisted theme preference on app start
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const savedMode = await AsyncStorage.getItem(STORAGE_KEY);
        if (isMounted && savedMode && (savedMode === 'system' || savedMode === 'light' || savedMode === 'dark')) {
          setAppearanceModeState(savedMode as AppearanceMode);
        }
      } catch (err) {
        console.warn('[ThemeContext] Failed to load appearance preference:', err);
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update and persist appearance mode
  const setAppearanceMode = useCallback(async (mode: AppearanceMode) => {
    try {
      setAppearanceModeState(mode);
      await AsyncStorage.setItem(STORAGE_KEY, mode);
    } catch (err) {
      console.warn('[ThemeContext] Failed to persist appearance preference:', err);
    }
  }, []);

  // Resolve active color scheme: system follows device, explicit overrides
  const activeColorScheme: ColorSchemeName = useMemo(() => {
    if (appearanceMode === 'light') return 'light';
    if (appearanceMode === 'dark') return 'dark';
    return systemScheme === 'dark' ? 'dark' : 'light';
  }, [appearanceMode, systemScheme]);

  const isDark = activeColorScheme === 'dark';

  const themeColors = useMemo(() => {
    const palette = isDark ? colors.dark : colors.light;
    return {
      ...palette,
      radius: colors.radius,
    };
  }, [isDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      appearanceMode,
      setAppearanceMode,
      colorScheme: activeColorScheme,
      isDark,
      colors: themeColors,
      theme: {
        colors: themeColors,
        isDark,
        colorScheme: activeColorScheme,
      },
      isReady,
    }),
    [appearanceMode, setAppearanceMode, activeColorScheme, isDark, themeColors, isReady]
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={themeColors.background} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    // Fallback if rendered outside ThemeProvider
    const system = useRNColorScheme() === 'dark' ? 'dark' : 'light';
    const palette = system === 'dark' ? colors.dark : colors.light;
    const themeColors = { ...palette, radius: colors.radius };
    return {
      appearanceMode: 'system',
      setAppearanceMode: async () => {},
      colorScheme: system,
      isDark: system === 'dark',
      colors: themeColors,
      theme: {
        colors: themeColors,
        isDark: system === 'dark',
        colorScheme: system,
      },
      isReady: true,
    };
  }
  return context;
}
