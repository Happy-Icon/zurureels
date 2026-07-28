/**
 * Native Maps Bridge — uses fully dynamic require() to prevent Metro
 * from eagerly evaluating react-native-maps at bundle time.
 *
 * The path string is built dynamically so Metro cannot statically resolve it.
 */

const RN_MAPS_PKG = 'react-native' + '-maps';
const CLUSTERING_PKG = 'react-native' + '-map-clustering';

export function getNativeMaps() {
  // Dynamic string prevents Metro static analysis from resolving the module
  const maps = require(RN_MAPS_PKG);

  let ClusteredMap: any = null;
  try {
    ClusteredMap = require(CLUSTERING_PKG).default;
  } catch {
    // Not available
  }

  return {
    MapView: maps.default,
    NativeMapView: maps.default,
    Marker: maps.Marker,
    NativeMarker: maps.Marker,
    Polyline: maps.Polyline,
    NativePolyline: maps.Polyline,
    PROVIDER_GOOGLE: maps.PROVIDER_GOOGLE,
    NativeProviderGoogle: maps.PROVIDER_GOOGLE,
    ClusteredMapView: ClusteredMap || maps.default,
  };
}
