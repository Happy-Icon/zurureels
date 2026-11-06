const Platform = { OS: 'ios', select: (objs) => objs.ios || objs.default };
const Dimensions = { get: () => ({ width: 375, height: 812 }) };
const StyleSheet = { create: (s) => s, hairlineWidth: 1 };
const AppState = { addEventListener: () => ({ remove: () => {} }), currentState: 'active' };
const Alert = { alert: () => {} };
const View = () => null;
const Text = () => null;
const Pressable = () => null;
const FlatList = () => null;
const Feather = () => null;
const Ionicons = () => null;
const MaterialCommunityIcons = () => null;
const FadeIn = { duration: () => ({}) };
const Image = () => null;
const BottomSheetScrollView = () => null;
const useSafeAreaInsets = () => ({ top: 44, bottom: 34, left: 0, right: 0 });
const getForegroundPermissionsAsync = async () => ({ status: 'granted' });
const requestForegroundPermissionsAsync = async () => ({ status: 'granted' });
const getCurrentPositionAsync = async () => ({ coords: { latitude: -4.0435, longitude: 39.6682 } });
const reverseGeocodeAsync = async () => [{ city: 'Diani' }];
const defaultExport = () => null;

module.exports = {
  Platform,
  Dimensions,
  StyleSheet,
  AppState,
  Alert,
  View,
  Text,
  Pressable,
  FlatList,
  Feather,
  Ionicons,
  MaterialCommunityIcons,
  FadeIn,
  Image,
  BottomSheetScrollView,
  useSafeAreaInsets,
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync,
  getCurrentPositionAsync,
  reverseGeocodeAsync,
  default: defaultExport,
};

exports.Platform = Platform;
exports.Dimensions = Dimensions;
exports.StyleSheet = StyleSheet;
exports.AppState = AppState;
exports.Alert = Alert;
exports.View = View;
exports.Text = Text;
exports.Pressable = Pressable;
exports.FlatList = FlatList;
exports.Feather = Feather;
exports.Ionicons = Ionicons;
exports.MaterialCommunityIcons = MaterialCommunityIcons;
exports.FadeIn = FadeIn;
exports.Image = Image;
exports.BottomSheetScrollView = BottomSheetScrollView;
exports.useSafeAreaInsets = useSafeAreaInsets;
exports.getForegroundPermissionsAsync = getForegroundPermissionsAsync;
exports.requestForegroundPermissionsAsync = requestForegroundPermissionsAsync;
exports.getCurrentPositionAsync = getCurrentPositionAsync;
exports.reverseGeocodeAsync = reverseGeocodeAsync;
