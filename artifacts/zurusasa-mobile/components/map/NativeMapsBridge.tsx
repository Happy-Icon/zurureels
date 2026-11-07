import { Platform, TurboModuleRegistry } from 'react-native';

const MAPLIBRE_RN_PKG = '@maplibre/' + 'maplibre-react-native';

let cachedMapLibre: any = undefined;

/**
 * Safely loads `@maplibre/maplibre-react-native` v11 only when compiled into the
 * native binary (Expo Dev Client / EAS Build / `expo run:android` / `expo run:ios`).
 * Prevents `TurboModuleRegistry.getEnforcing("MLRNMapViewModule")` from crashing
 * if the JS bundle is opened inside a plain Expo Go client without native MapLibre.
 */
export function getNativeMapLibre(): {
  Map: any;
  Camera: any;
  GeoJSONSource: any;
  Layer: any;
  Marker: any;
  UserLocation: any;
} | null {
  if (Platform.OS === 'web') return null;
  if (cachedMapLibre !== undefined) return cachedMapLibre;

  try {
    const turboMod = TurboModuleRegistry.get('MLRNMapViewModule');
    if (!turboMod) {
      cachedMapLibre = null;
      return null;
    }
    // Dynamic string keeps Metro web bundling isolated from native codegen imports
    const ml = require(MAPLIBRE_RN_PKG);
    if (ml && ml.Map && ml.Camera) {
      cachedMapLibre = {
        Map: ml.Map,
        Camera: ml.Camera,
        GeoJSONSource: ml.GeoJSONSource,
        Layer: ml.Layer,
        Marker: ml.Marker,
        UserLocation: ml.UserLocation,
      };
      return cachedMapLibre;
    }
  } catch (err) {
    console.warn('[MapLibre] Native module unavailable in current binary:', err);
  }

  cachedMapLibre = null;
  return null;
}
