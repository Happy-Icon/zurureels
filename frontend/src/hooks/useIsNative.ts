import { Capacitor } from '@capacitor/core';
import { useState, useEffect } from 'react';

export function useIsNative() {
  const [isNative, setIsNative] = useState(false);
  const [platform, setPlatform] = useState('web');

  useEffect(() => {
    const isNativeApp = Capacitor.isNativePlatform();
    setIsNative(isNativeApp);
    setPlatform(Capacitor.getPlatform());
  }, []);

  return { isNative, platform };
}
