import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zurureels.app',
  appName: 'Zuru Reels',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: []
  }
};

export default config;
