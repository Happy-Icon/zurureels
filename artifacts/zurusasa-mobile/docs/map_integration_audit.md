# ZuruSasa Mobile — Map Integration Audit & Premium Map Experience Blueprint

**Project**: ZuruSasa Mobile (`artifacts/zurusasa-mobile`)  
**Audit Date**: November 7, 2026  
**Runtime Stack**: Expo SDK 57 (`~57.0.20`), React Native `0.86.3` (`newArchEnabled: true`), React `19.2.3`, Supabase PostgreSQL  
**Audit Mode**: Strictly Read-Only Static Analysis, Prebuild Mod Inspection, Live Database Schema Probing & Service Execution (Zero Application Code Modifications)  
**Target Deliverable**: `docs/map_integration_audit.md`

---

## Table of Contents

1. [Current Map Architecture & Provider](#1-current-map-architecture--provider)
2. [Exact Files & Components Involved](#2-exact-files--components-involved)
3. [Current Functionality & Test Evidence](#3-current-functionality--test-evidence)
4. [Genuine Interactivity & Visual Experience Verdict](#4-genuine-interactivity--visual-experience-verdict)
5. [Missing & Broken Features Catalog](#5-missing--broken-features-catalog)
6. [API Key, Config Plugin & Billing Findings](#6-api-key-config-plugin--billing-findings)
7. [Performance & UX Bottlenecks](#7-performance--ux-bottlenecks)
8. [Provider Comparison & Migration Justification](#8-provider-comparison--migration-justification)
9. [Recommended Premium Map Experience for ZuruSasa](#9-recommended-premium-map-experience-for-zurusasa)
10. [Phased Implementation Plan (Phases 1–4)](#10-phased-implementation-plan-phases-14)
11. [Exact Files Requiring Modification](#11-exact-files-requiring-modification)
12. [Risks, Costs & Testing Requirements](#12-risks-costs--testing-requirements)

---

## Executive Summary

ZuruSasa's map integration was designed around **`react-native-maps` (`1.27.2`)** with **Google Maps (`PROVIDER_GOOGLE`)**, **`react-native-map-clustering` (`4.0.0`)**, and **`expo-location` (`~57.0.16`)**. However, an end-to-end audit across the screen layer, native config-plugin pipeline, `.env` configuration, and live Supabase PostgreSQL database proves that **the map experience is currently non-functional in production and partially simulated**:

| Audit Dimension | Score | Status | Summary Finding |
| :--- | :---: | :---: | :--- |
| **Discover Map Reachability** | **0 / 10** | **UNREACHABLE** | `app/(tabs)/discover.tsx` declares `discoverViewMode` (`'grid' \| 'map'`) and styles `mapToggleFab`, **but renders zero UI controls that call `setDiscoverViewMode`**. Users cannot open the Discover map. |
| **Native Provider & Key Config** | **1 / 10** | **CRITICAL FAIL** | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is missing from `.env`; static `app.json` cannot interpolate `"$(EXPO_PUBLIC_...)"`; bare `"react-native-maps"` in `plugins` strips `com.google.android.geo.API_KEY` on Android and omits the Google Maps pod & `GMSServices` init on iOS while components hardcode `PROVIDER_GOOGLE`. Google Cloud billing is also inactive. |
| **Listing Coordinate Grounding** | **1 / 10** | **FABRICATED JITTER** | Live Supabase `experiences` (`180` rows) has **zero coordinate columns** and **zero metadata coordinates** (only 6 town strings). `reels` (`49` rows) has `lat`/`lng` all `NULL`. `SafeMapView.tsx` maps town centroids and adds `Math.random()` jitter (`±0.0125°`, ~1.4 km), scattering beachfront pins into the Indian Ocean. |
| **Listing & Booking Detail Map** | **0 / 10** | **DECORATIVE MOCK** | Both `ReelInfoSheet.tsx` and `BookingDetailsStep.tsx` render `<View style={styles.mapCardMock}>` containing the **listing's cover photo (`heroImage`)** overlaid with a map-pin icon under *"Where you'll be"*. |
| **Web / JS Runtime Fallback** | **1 / 10** | **STATIC SVG** | When native `react-native-maps` is unavailable, `SafeMapView.tsx` renders a **hardcoded non-interactive `<Svg>` illustration** with modulo screen-percentage pin placement and a colored `"Google"` text watermark. |
| **Post-Booking Route Map** | **4 / 10** | **DEGRADED** | Reachable from Trips (`Get Directions`), uses `SafeRouteMapView`, and supports external Google/Apple Maps deep-linking — **but** lacks `watchPositionAsync` during *"Navigate in ZuruSasa"*, falls back to a 2-point straight crow-flies line without an API key, and breaks on native builds due to missing manifest/plist keys. |

**Strategic Recommendation**: Because Google Cloud billing is inactive — and standard Mapbox accounts similarly enforce credit-card verification to unlock SDK download tokens (`sk.*` with `DOWNLOADS:READ`) — **migrating to MapLibre Native (`@maplibre/maplibre-react-native` v11, built natively for React Native New Architecture / Fabric) paired with OpenFreeMap vector tiles, Supabase PostGIS coordinates, and a server-cached `maps-proxy` Edge Function (Photon/Nominatim + OSRM)** is objectively justified and eliminates all credit-card and billing blockers at **\$0 baseline cost**.

---

## 1. Current Map Architecture & Provider

### 1.1 Installed Libraries & Versions
Inspected from `package.json` (`lines 31–68`) and `node_modules`:

| Package | Installed Version | Role in Current Codebase |
| :--- | :--- | :--- |
| `expo` | `~57.0.20` | Managed/CNG workflow (no committed `android/` or `ios/` folders); `newArchEnabled: true` |
| `react-native` | `0.86.3` | Fabric + TurboModules enabled |
| `react-native-maps` | `1.27.2` | Core native map wrapper (`MapView`, `Marker`, `Polyline`, `PROVIDER_GOOGLE`) with Fabric codegen specs (`RNMapsSpecs`) |
| `react-native-map-clustering` | `4.0.0` (caret `^4.0.0`) | JS `supercluster` (`^8.0.0`) + `@mapbox/geo-viewport` wrapper around `react-native-maps` |
| `expo-location` | `~57.0.16` | Foreground GPS permission & one-shot `getCurrentPositionAsync` |
| `react-native-svg` | `15.15.4` | Used to draw static fallback map illustrations when native maps fail to load |
| `@gorhom/bottom-sheet` | `^5.2.14` | Draggable 3-snap-point sheet overlaid on `JourneyCompanionSheet` |

### 1.2 End-to-End Architecture Trace

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           SCREEN & MODAL ENTRY POINTS                            │
│                                                                                  │
│  1. app/(tabs)/discover.tsx                                                      │
│     • State: discoverViewMode ('grid' | 'map') initialized to 'grid'             │
│     • DEAD PATH: setDiscoverViewMode is NEVER called anywhere in JSX             │
│                                                                                  │
│  2. Reservations -> JourneyCompanionSheet (ONLY live map entry point in UI)      │
│     • FeaturedNextTripCard.tsx / TripCard.tsx / BookingDetailModal.tsx           │
│       -> GuestTripsView.tsx (setJourneyBooking) -> JourneyCompanionSheet.tsx     │
│                                                                                  │
│  3. ReelInfoSheet.tsx & BookingDetailsStep.tsx ("Where you'll be")               │
│     • Renders <View style={styles.mapCardMock}> + heroImage + Feather map-pin    │
│       (No map SDK invoked at all)                                                │
└───────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     DYNAMIC MODULE BRIDGE & COMPONENT LAYER                      │
│                                                                                  │
│  components/map/DiscoverMapView.tsx  ──re-exports──►  components/map/SafeMapView │
│                                                                                  │
│  SafeMapView.tsx -> loadNativeMapsModule() -> NativeMapsBridge.tsx               │
│  • Obfuscates package string ('react-native' + '-maps') to bypass Metro static   │
│    bundling errors on Web / JS-only runtimes.                                    │
│  • Branch A (hasNativeMaps === true, iOS/Android native dev/prod binary):        │
│      Renders ClusteredMapView / NativeMapView with provider={PROVIDER_GOOGLE}    │
│  • Branch B (hasNativeMaps === false, Web or missing native module):             │
│      Renders GoogleMapsTemplateView / SafeRouteMapView SVG (static vector art)   │
└───────────────────────────────────────┬──────────────────────────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        GEOSPATIAL SERVICE & DATA LAYER                           │
│                                                                                  │
│  services/googleMapsService.ts                                                   │
│  • Reads process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (currently '' / undefined)  │
│  • geocodeLocation(locationName):                                                │
│      1. Substring-matches 12 hardcoded Kenyan coastal towns (COASTAL_TOWN_COORDS)│
│      2. If unmatched & key set: fetches maps.googleapis.com/maps/api/geocode     │
│      3. Fallback: returns central Mombasa (-4.0435, 39.6682) for ANY unknown loc │
│  • fetchRoute(origin, dest):                                                     │
│      1. If key set: fetches maps.googleapis.com/maps/api/directions              │
│      2. Fallback: Haversine crow-flies distance + 2-point straight line          │
│                                                                                  │
│  Supabase PostgreSQL (public.experiences: 180 rows | public.reels: 49 rows)      │
│  • experiences has NO latitude/longitude columns; only coarse text `location`    │
│  • reels has `lat` and `lng` columns in DB, but 49/49 rows are NULL              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Exact Files & Components Involved

| File Path | Lines | Role & Audit Status |
| :--- | :--- | :--- |
| `package.json` | `42, 58–59, 65` | Declares `expo-location` (`~57.0.16`), `react-native-map-clustering` (`^4.0.0`), `react-native-maps` (`1.27.2`), and `react-native-svg` (`15.15.4`). |
| `app.json` | `21–30, 48–60, 95–102` | Declares location permission strings, broken `ios.config.googleMaps.apiKey` / `android.config.googleMaps.apiKey` with uninterpolated `"$(EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)"`, and bare `"react-native-maps"` plugin without options. |
| `.env.example` / `.env` | `.env.example:14` | Template lists `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, **but `.env` omits it completely**. |
| `google-services.json` | `1–45` | Firebase/Google Services Android config for `com.zurureels.app` (GCP project `fair-kingdom-471717-a8`, billing inactive). |
| `components/map/NativeMapsBridge.tsx` | `1–33` | Dynamic `require('react-native' + '-maps')` and `require('react-native' + '-map-clustering')` bridge to prevent Metro static resolution failures on Web. |
| `components/map/DiscoverMapView.tsx` | `1–2` | Barrel re-export of `DiscoverMapView` and `SafeRouteMapView` from `./SafeMapView`. |
| `components/map/SafeMapView.tsx` | `1–978` | Contains `DiscoverMapView` (`61–326`), `SafeRouteMapView` (`339–483`), and `GoogleMapsTemplateView` (`493–606`) plus hardcoded SVG fallbacks. |
| `services/googleMapsService.ts` | `1–176` | `COASTAL_TOWN_COORDS` lookup table, `decodePolyline`, client-side Google Geocoding & Directions REST calls, and Mombasa / straight-line fallbacks. |
| `app/(tabs)/discover.tsx` | `24, 50–51, 76–80, 130–160, 331–340, 416–423, 592–614` | Mounts `DiscoverMapView` when `discoverViewMode === 'map'`, **but never renders any toggle button calling `setDiscoverViewMode`**. |
| `components/journey/JourneyCompanionSheet.tsx` | `1–749` | Post-booking route modal mounting `SafeRouteMapView`, ETA metrics, *"Navigate in ZuruSasa"* mode, and external Google/Apple Maps deep-link launcher (`162–171`). |
| `components/reservations/GuestTripsView.tsx` | `23, 540–544, 577–589` | Live host container that mounts `JourneyCompanionSheet` when `journeyBooking` is set. |
| `components/reservations/FeaturedNextTripCard.tsx` | `135–146` | Upcoming trip hero card navigation icon button (`onDirections`). |
| `components/reservations/TripCard.tsx` | `109–119` | Upcoming reservation list card *"Directions"* button (`onDirections`). |
| `components/reservations/BookingDetailModal.tsx` | `317–325` | Reservation detail sheet *"Get Directions"* button (`onDirections`). |
| `components/ReelInfoSheet.tsx` | `490–505, 986–1005` | Listing info sheet *"Where you'll be"* section rendering `mapCardMock` (listing cover photo + map-pin icon, not a map). |
| `components/booking/BookingDetailsStep.tsx` | `316–327` | Checkout step 1 *"Where you'll be"* section rendering `mapCardMock` (`heroImage` + map-pin icon). |
| `components/booking/bookingStyles.ts` | `515–536` | Styles for `mapCardMock`, `mapCardImage`, and `mapPinCircle`. |
| `hooks/useCreateReelForm.ts` | `22, 251–320` | Host listing creation logic; saves lowercase town string (`location.toLowerCase()`) into `experiences` and **never captures or writes coordinates**. |
| `components/host/create-reel/MediaAndBasicsSection.tsx` | `124–146` | Host location UI restricting input to 6 static horizontal chips (`LOCATIONS`). |
| `components/host/create-reel/createReelConstants.ts` | `10` | Hardcodes `LOCATIONS = ['Diani', 'Watamu', 'Lamu', 'Mombasa', 'Malindi', 'Kilifi']`. |
| `lib/supabase.ts` | `125–149, 226–264` | TypeScript row definitions (`ExperienceRow`, `ReelRow`); neither exposes `latitude`/`longitude` or `reels.lat`/`reels.lng`. |
| `lib/queries/reels.ts` | `40–58, 80–95, 134–145` | PostgREST queries for `reels` and `experiences`; selects text `location` only. |
| `services/filterService.ts` | `145–180, 246–253` | Server/client filtering using substring `location.ilike.%city%`; zero bounding-box or radius geospatial queries. |
| `app/ai/chat.tsx` & `supabase/functions/zuru-ai/index.ts` | `chat.tsx:114–138`, `zuru-ai:1365–1366` | Captures user GPS coordinates via `expo-location` and passes them as prompt text to Zuru Agent AI (text context only, no spatial SQL query). |

---

## 3. Current Functionality & Test Evidence

### 3.1 Testing Environment & Methodology Disclosure
To strictly separate verified runtime facts from static code analysis:

1. **What Was Executed Live During This Audit**:
   - **Live Supabase PostgREST Probing** against ZuruSasa's linked production/staging database (`experiences`, `reels`, `events` schemas and all `180` experience rows + `49` reel rows).
   - **Live Expo Prebuild Pipeline Evaluation** via `@expo/prebuild-config` (`getPrebuildConfigAsync`) and `npx expo config --type prebuild` on SDK `57.0.20`.
   - **Live Execution of `services/googleMapsService.ts`** in Node (`v26.13.0`) against coastal, Nairobi, and unknown Kenyan locations plus Mombasa-to-Diani routing.
   - **Static TypeScript Compilation** (`npx tsc -p tsconfig.json --noEmit` -> exited `0`).
   - **EAS Cloud Simulator Check** (`npx eas-cli@latest simulator:availability --json`) for project owner `okelo0121`.
2. **What Could Not Be Executed on Touch Hardware (And Why)**:
   - **Local Android Emulator**: This Windows workstation does not have Android Studio, Android SDK (`AppData\Local\Android\Sdk`), `adb`, `emulator`, or `java` installed (`ANDROID_HOME` and `ANDROID_SDK_ROOT` are unset; filesystem search confirmed `adb.exe` is absent).
   - **Local iOS Simulator**: Host OS is Windows (Xcode/CoreSimulator requires macOS).
   - **EAS Cloud Simulator**: Checked via `eas simulator:availability`; returned `{"available": false, "accountName": "okelo0121"}` (feature waitlisted on account).
   - **Expo Go Limitation**: Project includes custom native modules (`react-native-persona`, `react-native-passkey`, `@react-native-google-signin/google-signin`) requiring a custom `expo-dev-client` binary.

### 3.2 Empirical Live Test Evidence

#### Test 1 — Live Supabase Geospatial Schema & Data Audit
Executed read-only REST queries against `experiences`, `reels`, and `events`:
```text
=== TABLE: experiences (Total rows: 180) ===
Columns: [
  'id', 'user_id', 'category', 'entity_name', 'title', 'description',
  'location', 'image_url', 'base_price', 'current_price', 'price_unit',
  'availability_status', 'metadata', 'created_at', 'updated_at',
  'max_guests', 'min_stay_nights', 'max_stay_nights', 'check_in_time',
  'check_out_time', 'booking_mode', 'cancellation_policy', 'house_rules',
  'arrival_instructions', 'checkout_instructions', 'amenities'
]
Distinct `location` values across all 180 rows:
  [ 'diani', 'watamu', 'mombasa', 'malindi', 'kilifi', 'nyali' ]
Experiences with coordinates in `metadata`: 0 / 180

=== TABLE: reels (Total rows: 49) ===
Coordinate columns present: `lat`, `lng`
Reels with non-null `lat` or `lng`: 0 / 49

=== TABLE: events ===
Coordinate columns present: NONE (text `location` only, e.g. 'Diani Beach', 'Mambo')
```

#### Test 2 — Live `googleMapsService.ts` Execution
Executed `googleMapsService.geocodeLocation()` and `googleMapsService.fetchRoute()` against current environment configuration:
```text
geocodeLocation("diani")                  => { latitude: -4.2797, longitude: 39.5947 }
geocodeLocation("watamu")                 => { latitude: -3.3542, longitude: 40.0305 }
geocodeLocation("Nairobi Karen")          => { latitude: -4.0435, longitude: 39.6682 }  <-- TELEPORTED TO MOMBASA
geocodeLocation("Unknown Boutique Villa") => { latitude: -4.0435, longitude: 39.6682 }  <-- TELEPORTED TO MOMBASA

fetchRoute(Mombasa -> Diani) => {
  distanceKm: 27.5,
  durationMin: 41,
  polylinePointsCount: 2,        <-- 2-point crow-flies straight line across Likoni Creek
  trafficCondition: 'Light'
}
```

#### Test 3 — Live `@expo/prebuild-config` Evaluation
Executed `getPrebuildConfigAsync(process.cwd(), { platforms: ['android', 'ios'] })`:
```text
Prebuild ios.infoPlist.GMSApiKey: undefined
Prebuild ios.config: {"googleMaps":{"apiKey":"$(EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)"}}
Prebuild android.config: {"googleMaps":{"apiKey":"$(EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)"}}
```

### 3.3 Interaction-by-Interaction Evaluation Matrix (Prompt Section 2)

| # | Required Map Interaction | Discover Map (`DiscoverMapView`) | Journey Map (`SafeRouteMapView`) | Web / Fallback (`GoogleMapsTemplateView`) | Evidence Type & Root Cause |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Pinch-to-zoom (two fingers)** | **Blocked** (screen unreachable + native API key crash) | **Blocked** by native API key crash (supported by `RNMapsMapView` once key/provider works) | **No** (`<Svg>` has zero gesture handlers) | *Source-Verified + Prebuild-Tested* (`SafeMapView.tsx:209, 376, 503`) |
| **2** | **Smooth zooming in and out** | **Blocked** (unreachable + missing API key) | **Blocked** by missing API key | **No** (completely static) | *Source-Verified + Prebuild-Tested* |
| **3** | **Dragging & panning in every direction** | **Blocked** (unreachable + missing API key) | **Blocked** by missing API key | **No** (completely static) | *Source-Verified + Prebuild-Tested* |
| **4** | **Zoom-in and zoom-out (`+` / `-`) controls** | **Missing** (no custom buttons; `zoomControlEnabled` not enabled) | **Missing** (no custom zoom buttons) | **Missing** | *Source-Verified* (`SafeMapView.tsx:209–229, 376–391`) |
| **5** | **Smooth movement without lag** | **Degraded** (sequential geocoding loop on `reels` change; custom view markers) | **Acceptable** once rendered (only 1 marker + 2 polylines) | **N/A** (static image) | *Source-Verified* (`SafeMapView.tsx:83–103`) |
| **6** | **Interactive location markers** | **Partial** (`onPress` wired, **but** `tracksViewChanges={false}` freezes visual selected state on native) | **Static destination pin only** (no `onPress` behavior) | **Yes** (`Pressable` pills at fake `%` offsets) | *Source-Verified* (`SafeMapView.tsx:181–203, 564–592`) |
| **7** | **Tapping a marker reveals listing** | **Code-complete** (animates bottom preview card + `View` CTA opens `ReelCard` modal), **unreachable** | **N/A** (single booking context) | **Code-complete** (unreachable from `discover.tsx`) | *Source-Verified* (`SafeMapView.tsx:138–162, 248–323`) |
| **8** | **Correct positioning using lat/lng** | **FAIL** (`0` DB coords; town centroid + `Math.random()` jitter drops pins in ocean; non-coastal -> Mombasa) | **FAIL** (town centroid destination; defaults user origin to Mombasa if permission not pre-granted) | **FAIL** (`top: 18 + ((idx * 17) % 55)%` modulo arithmetic) | *Live DB + Service Tested* (`SafeMapView.tsx:89–95, 560–561`) |
| **9** | **Re-centering on user location** | **Missing** (`showsMyLocationButton={false}` on line `215` and **no custom re-center button**) | **Missing** (`showsMyLocationButton={false}` on line `387`, no re-center button; never prompts permission if undetermined) | **Missing** | *Source-Verified* (`SafeMapView.tsx:214–215, 386–387`; `JourneyCompanionSheet.tsx:131`) |
| **10** | **Displaying multiple nearby stays & experiences** | **Code-wired** (`filteredReels` passed to `DiscoverMapView`), **but unreachable & scattered randomly** | **N/A** (single destination) | **Fake modulo layout** | *Source-Verified* (`discover.tsx:334–338`) |
| **11** | **Updating visible listings when map viewport changes** | **Missing** (`onRegionChangeComplete` not wired in `DiscoverMapView`; no bounding-box SQL query) | **N/A** | **Missing** | *Source-Verified* (`SafeMapView.tsx:209–229`; `filterService.ts`) |

---

## 4. Genuine Interactivity & Visual Experience Verdict

### 4.1 Surface-by-Surface Interactivity Truth Table

| App Surface | Component | Genuine Interactive Map? | Actual Runtime Behavior Today |
| :--- | :--- | :---: | :--- |
| **Discover Tab Map** | `app/(tabs)/discover.tsx` -> `DiscoverMapView` | **No (Dead Code in UI)** | Uses real `react-native-maps` in code, **but** no button toggles `discoverViewMode` to `'map'`. Even if toggled, Android crashes on missing `com.google.android.geo.API_KEY`, iOS fails on missing `GoogleMaps` pod, and Web renders a static `<Svg>`. |
| **Post-Booking Directions** | `JourneyCompanionSheet` -> `SafeRouteMapView` | **Intended Native / Broken Config** | Only reachable map in the app. Attempts to mount native `MapView` (`PROVIDER_GOOGLE`), which crashes/fails on native builds without valid manifest/plist keys + billing, and renders a static `<Svg>` on Web. |
| **Listing Info Sheet (*"Where you'll be"*)** | `components/ReelInfoSheet.tsx:495–504` | **No (Decorative Photo Mock)** | Renders `<Image source={{ uri: heroImage }} />` (the listing's own cover photo!) blurred/cropped inside `mapCardMock` with a centered `<Feather name="map-pin" />` badge. |
| **Booking Checkout (*"Where you'll be"*)** | `components/booking/BookingDetailsStep.tsx:321–326` | **No (Decorative Photo Mock)** | Identical cover-photo mock (`heroImage` + pin icon). Zero geography, roads, or neighborhood context. |

### 4.2 Visual & Premium Travel UX Assessment (Prompt Section 3)
Evaluated against top-tier travel marketplaces (Airbnb, Booking.com, Plum Guide):

1. **Geographic Legibility**: Neither the cover-photo mocks (`mapCardMock`) nor the hardcoded SVG fallback (`GoogleMapsTemplateView` — 6 white lines, 3 yellow Bézier curves, and 5 static text labels) provide real streets, beaches, coastal access roads, or landmarks.
2. **Marker Craftsmanship**:
   - The native pill design in `SafeMapView.tsx` (`KES 15.0k` white rounded capsule turning `#F26522` Zuru orange on selection) has good visual intent, **but fails on device** because `tracksViewChanges={false}` prevents native bitmap updates when `selectedReel` changes, and `transform: [{ scale: 1.12 }]` + `shadowRadius: 12` clip against the tight Android `<Marker>` bitmap canvas.
   - There is no *"visited/viewed"* muted pill state to help travelers track which stays they already inspected.
3. **Preview Card Data Integrity**:
   - `SafeMapView.tsx:290` hardcodes `<Text style={styles.ratingText}>4.9</Text>` on **every** listing preview card regardless of actual review scores.
   - `SafeMapView.tsx:305` hardcodes `/night` even for boat charters, dhow cruises, food experiences, and events (`selectedExp?.price_unit` is ignored).
   - Only a single static card renders rather than a horizontal swipeable carousel synced to nearby pins.
4. **Theme & Chrome Clutter**:
   - `app.json` configures `"userInterfaceStyle": "dark"`, and `discover.tsx` adapts to `useTheme()`, **but `SafeMapView.tsx` and `JourneyCompanionSheet.tsx` hardcode light-only colors (`#FFFFFF`, `#F4F3F0`)** with no dark map style.
   - In `discover.tsx:406–412`, `AIFloatingButton` (*"Ask Zuru Agent"*) remains mounted at `bottom: 90, right: 20` on top of map mode, colliding directly with `DiscoverMapView`'s `previewCardWrap` (`bottom: 100`).

---

## 5. Missing & Broken Features Catalog

### P0 — Critical Blockers (Prevent Map From Functioning)
1. **Unreachable Discover Map Mode (`app/(tabs)/discover.tsx:79, 331, 592–614`)**: `discoverViewMode` is initialized to `'grid'`, `styles.mapToggleFab` is defined in `StyleSheet.create`, **but no `<Pressable>` in `discover.tsx` ever calls `setDiscoverViewMode`**.
2. **Broken Native Google Maps Plugin Config (`app.json:21–25, 48–52, 101`)**: Bare `"react-native-maps"` plugin strips `com.google.android.geo.API_KEY` from `AndroidManifest.xml` and skips `pod 'react-native-maps/Google'` + `GMSServices.provideAPIKey(...)` on iOS, causing native runtime crashes when `provider={PROVIDER_GOOGLE}` mounts.
3. **Missing API Key & Inactive Google Cloud Billing (`.env`, `services/googleMapsService.ts:20`)**: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is absent from `.env`, and Google Cloud billing is inactive on the project.
4. **Zero Listing Coordinates in Database (`public.experiences`, `hooks/useCreateReelForm.ts:251–296`)**: `experiences` lacks `latitude`/`longitude` columns (`0/180` rows have coordinates); `reels.lat`/`reels.lng` are `NULL` across all `49/49` rows; host creation flow only captures 1 of 6 town strings.
5. **Random Pin Jitter Dropping Listings Into the Ocean (`components/map/SafeMapView.tsx:91–94`)**: `(Math.random() - 0.5) * 0.025` shifts pins up to `~1.4 km` randomly on every render — pushing beachfront Diani, Nyali, Bamburi, Watamu, and Malindi stays eastward into the Indian Ocean and moving pins each time filters change.
6. **Silent Mombasa Teleportation (`services/googleMapsService.ts:85–109`)**: Any location outside the 12 hardcoded coastal strings (e.g., Nairobi, Naivasha, Maasai Mara, Nanyuki) silently resolves to central Mombasa (`-4.0435, 39.6682`) when geocoding is unconfigured or fails.

### P1 — Major Functional & Brand Defects
7. **Frozen Selected Marker State on Native (`components/map/SafeMapView.tsx:186`)**: `<NativeMarker tracksViewChanges={false}>` permanently locks the initial unselected white pill bitmap on Android/iOS; tapping a pin never turns it orange (`#F26522`) or fades unselected pins.
8. **Fake *"Live In-App Guidance"* (`components/journey/JourneyCompanionSheet.tsx:130–140, 155–160, 328–336`)**: Choosing *"Navigate in ZuruSasa"* displays `"NAVIGATING — X min remaining"`, **but never calls `Location.watchPositionAsync`**. User coordinates are read once on modal open (and silently default to Mombasa if permission was not already granted because `requestForegroundPermissionsAsync` is never called in `JourneyCompanionSheet`).
9. **Cover Photo Masquerading as Location Map (`ReelInfoSheet.tsx:495–504`, `BookingDetailsStep.tsx:321–326`)**: *"Where you'll be"* renders the listing's cover image (`heroImage`) inside `mapCardMock` instead of a geographical map.
10. **Spoofed Google Logo Watermark on Custom SVG (`components/map/SafeMapView.tsx:454–463, 543–552`)**: Renders multicolor `"Google"` text over a hand-drawn non-Google `<Svg>`, misleading users and violating brand attribution guidelines.
11. **Dead `onOpenDirections` Prop (`app/(tabs)/discover.tsx:337`, `components/map/SafeMapView.tsx:53, 64`)**: `discover.tsx` passes `onOpenDirections={(reel) => setJourneyBooking(reel as any)}` (also an unsafe type cast from `ReelRow` to `BookingRow`), and `DiscoverMapView` never renders a button for it.

### P2 — UX & Polish Gaps
12. **Missing Map Controls**: Zero zoom `+`/`-` buttons, zero *"Locate Me"* re-center button, and zero *"Search this area"* viewport query button.
13. **Hardcoded Preview Metadata (`SafeMapView.tsx:290, 305`)**: Hardcodes `4.9` star rating and `/night` price unit on all map preview cards.
14. **`ClusteredMapView` Prop Mismatch (`SafeMapView.tsx:224–225`)**: Passes `minZoomLevel={5}` and `maxZoomLevel={18}` (`MapView` camera props) while omitting `minZoom` and `maxZoom` expected by `react-native-map-clustering`'s `SuperCluster` instance (`ClusteredMapView.js:25–26`).

---

## 6. API Key, Config Plugin & Billing Findings

### 6.1 Exact Expo SDK 57 + `react-native-maps@1.27.2` Prebuild Failure Chain
Inspection of `node_modules/@expo/prebuild-config/build/plugins/unversioned/react-native-maps.js` (`lines 43–46`) and `node_modules/react-native-maps/plugin/build/{android,ios}.js` reveals four compounding configuration bugs in `app.json`:

1. **Legacy `app.json` `config.googleMaps` Blocks Are Completely Ignored**:
   - `@expo/prebuild-config` wraps `react-native-maps` with `createLegacyPlugin({ packageName: 'react-native-maps', fallback: [withGoogleMapsApiKey, withMaps, ...] })`.
   - Because `react-native-maps@1.27.2` ships its own `app.plugin.js` (`./plugin/build`), **Expo skips the legacy fallback entirely**. Both `android.config.googleMaps.apiKey` (`app.json:49–51`) and `ios.config.googleMaps.apiKey` (`app.json:22–24` — which also used the wrong schema shape instead of `ios.config.googleMapsApiKey`) are dead config.
2. **Bare `"react-native-maps"` Plugin Strips Android Manifest Key**:
   - `app.json:101` registers `"react-native-maps"` with `props = undefined`.
   - `node_modules/react-native-maps/plugin/build/android.js:47–52` executes:
     ```js
     if (props?.androidGoogleMapsApiKey) {
       addMetaDataItemToMainApplication(mainApplication, 'com.google.android.geo.API_KEY', props.androidGoogleMapsApiKey);
     } else {
       removeMetaDataItemFromMainApplication(mainApplication, 'com.google.android.geo.API_KEY');
     }
     ```
   - Result: `com.google.android.geo.API_KEY` is actively removed from `AndroidManifest.xml`, causing `GoogleMap` initialization on Android to throw `RuntimeException: API key not found`.
3. **Missing Google Maps Pod & `GMSServices` Init on iOS**:
   - `node_modules/react-native-maps/plugin/build/ios.js:50–71` only injects `GMSApiKey`, `pod 'react-native-maps/Google'`, and `GMSServices.provideAPIKey(...)` when `props?.iosGoogleMapsApiKey` is truthy.
   - Because `props` is `undefined`, iOS builds link Apple MapKit only — yet `SafeMapView.tsx:211, 378` unconditionally passes `provider={PROVIDER_GOOGLE}`, failing on iOS.
4. **Static `app.json` String Literal + Client Key Restriction Conflict**:
   - Static `app.json` does not expand `"$(EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)"` (confirmed by `getPrebuildConfigAsync`).
   - Even with Google Cloud billing enabled, mobile-restricted Google API keys (restricted by Android SHA-1 + package name or iOS bundle ID) are **rejected (`REQUEST_DENIED`) by Google Geocoding and Directions Web Service REST endpoints** called directly in `services/googleMapsService.ts:93, 117`.

### 6.2 Permissions Review
- **iOS (`app.json:28–29`, `96–100`)**: `NSLocationWhenInUseUsageDescription` and `NSLocationAlwaysAndWhenInUseUsageDescription` are clearly defined. *(Note: ZuruSasa only needs foreground When-In-Use permission; `NSLocationAlwaysAndWhenInUseUsageDescription` can trigger App Store Review rejection under Guideline 5.1.1 unless background location is actively justified and used.)*
- **Android (`app.json:56–60`)**: `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION` are properly declared (duplicate short-form entries like `"ACCESS_FINE_LOCATION"` alongside `"android.permission.ACCESS_FINE_LOCATION"` are normalized by Expo but should be cleaned up).

---

## 7. Performance & UX Bottlenecks

1. **Sequential `O(N)` Async Geocoding Loop on Render (`SafeMapView.tsx:83–103`)**:
   ```tsx
   for (const reel of reels) {
     const locationStr = reel.experience?.location || 'Mombasa';
     const baseCoords = await googleMapsService.geocodeLocation(locationStr);
     ...
   }
   ```
   When `reels` contains 50–80 listings with unmatched addresses and a network geocoder is active, awaiting sequential HTTP requests inside `useEffect` blocks marker rendering for `50 × ~200ms = 10+ seconds` and fires redundant uncached requests on every filter change.
2. **React Custom View Marker Overhead at Scale**:
   Rendering custom React `<View>` trees inside `<Marker>` forces native bridge bitmap snapshotting per pin. Above ~80–150 unclustered pins on mid-range Android devices common in Kenya (e.g., Samsung Galaxy A-series, Tecno, Infinix), custom view markers cause frame drops during pan/zoom compared to GPU-rendered symbol/GeoJSON layers.
3. **Client-Pull All Rows vs. Spatial Bounding-Box Queries**:
   `useReels()` fetches a flat `.limit(30)` ordered by `created_at DESC` (`lib/queries/reels.ts:55`), and `filterService.fetchServerFilteredReels` caps at `.limit(80)` (`services/filterService.ts:183`). Panning the map to Watamu, Lamu, Naivasha, or Nairobi will show **empty map areas** even when matching listings exist in PostgreSQL outside the latest 30–80 global rows.
4. **Android Custom Marker Clipping (`SafeMapView.tsx:649–656`)**:
   Applying `transform: [{ scale: 1.12 }]` and `shadowRadius: 12` directly on the root child `<View>` of a native marker clips shadows and scaled edges on Android unless converted to vector layers or wrapped in a padded transparent container.

---

## 8. Provider Comparison & Migration Justification

### 8.1 Why Replacing `react-native-maps` (`PROVIDER_GOOGLE`) Is Necessary
We evaluated keeping `react-native-maps` first:
- **Google Maps (`PROVIDER_GOOGLE`)** requires an active Google Cloud billing account. Without active billing, Android/iOS SDKs display dark/watermarked error tiles (`BillingNotEnabledMapError`) or blank grids, and Google Geocoding/Places/Routes APIs reject all requests.
- **Using `<UrlTile>` inside `react-native-maps` without Google API keys is not viable on Android**, because `react-native-maps` on Android instantiates `com.google.android.gms.maps.MapView` as its underlying host view — which still crashes at startup when `com.google.android.geo.API_KEY` is absent from `AndroidManifest.xml`.
- **Mapbox (`@rnmapbox/maps`)** also requires a valid credit/debit card on file during standard account creation to unlock account tokens and the mandatory secret `sk.*` (`DOWNLOADS:READ`) token required by Gradle/CocoaPods to download the proprietary native SDK binary.

### 8.2 Comprehensive Provider Comparison Matrix

| Evaluation Criteria | Google Maps SDK (`react-native-maps`) | Mapbox Maps SDK (`@rnmapbox/maps` v10/v11) | **MapLibre Native (`@maplibre/maplibre-react-native` v11 + OpenFreeMap / MapTiler)** |
| :--- | :--- | :--- | :--- |
| **Native RN & New Arch (`0.86` Fabric) Support** | Good (`1.27.2` has Fabric codegen, though custom `<Marker>` child bitmaps still have known Fabric quirks). | Strong native C++/Metal/Vulkan SDK with Fabric support & Expo config plugin. | **Strong — v11 is architected specifically for React Native New Architecture (Fabric)** + official Expo config plugin (`@maplibre/maplibre-react-native`), plus `maplibre-gl` parity on Web. |
| **Credit Card / Billing Requirement** | **Hard Blocker**: Mandatory active Google Cloud billing account. | **Hard Blocker**: Mandatory credit/debit card on file for standard accounts & SDK `DOWNLOADS:READ` secret token. | **ZERO Credit Card / ZERO Billing Required**: Open-source BSD native SDK + **OpenFreeMap** vector tiles require no card and no API key. |
| **Map Appearance & Customization** | Clean default cartography; custom JSON styling available for light/dark themes. | Best-in-class Mapbox Studio 3D terrain & custom vector styling. | **Full GL Style Spec vector customization**: Crisp 60fps vector streets, water, parks, 3D extruded buildings, and instant light (`liberty`/`positron`) & dark (`dark`) styles customizable to ZuruSasa's brand palette. |
| **Pinch-to-Zoom & Pan Performance** | Smooth 60fps native vector tiles (Google Play Services on Android). | Smooth 60fps OpenGL/Metal vector rendering + 3D pitch/bearing. | **Smooth 60fps OpenGL ES / Metal C++ vector rendering** with two-finger pinch, double-tap zoom, one-finger zoom, 360° pan, rotation, and 3D pitch. |
| **Marker & Clustering Performance** | Relies on JS `supercluster` (`react-native-map-clustering`) + heavy native view bitmap snapshots (`tracksViewChanges` bugs). | Native C++ `ShapeSource` clustering + GPU `SymbolLayer` & `MarkerView`. | **Native C++ `ShapeSource` (`cluster={true}`) + GPU `SymbolLayer`/`CircleLayer` + `MarkerView`** — handles 5,000+ pins at 60fps with zero `tracksViewChanges` bitmap freeze bugs. |
| **Routing & Directions** | Google Routes API (\$5–\$10 / 1k after free tier); no free unbilled tier. | Mapbox Directions API (100k free/mo, card required). | **OSRM / OpenRouteService / Valhalla** via server `maps-proxy` + Upstash Redis cache (\$0, no card), paired with **free 1-tap deep-link handoff to native Google Maps / Apple Maps / Waze** for turn-by-turn voice driving. |
| **Pricing & Usage Limits** | Mobile SDK map loads: \$0; Places/Geocoding/Routes: pay-as-you-go above monthly SKU caps (billing required). | Free up to 25,000 mobile MAU; \$4.00 per 1,000 MAU thereafter (card required). | **\$0 / Unlimited** with OpenFreeMap (or self-hosted Protomaps PMTiles on Cloudflare R2 for ~\$0–\$2/mo at 50k+ MAU). Zero per-MAU SDK tax. |
| **Integration Complexity in Expo SDK 57** | Already installed, **but** blocked by GCP billing + broken plugin config + no Web support. | Medium-High (requires `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` secret in EAS + local `.netrc`/Gradle). | **Low-Medium**: Single `"@maplibre/maplibre-react-native"` plugin in `app.json` — **zero Gradle download tokens, zero `.netrc` secrets** — builds cleanly on EAS Build (`development`/`preview`/`production`). |
| **Suitability for Kenya & African Markets** | Highest raw commercial POI density (small shops/villas), if billing is active. | Moderate-Good (OSM-derived base + proprietary additions). | **High for Roads, Coastlines, Towns & Major Hotels** (Mombasa, Diani Beach Rd, Nyali, Bamburi, Watamu, Malindi, Lamu, Kilifi, Nairobi, Maasai Mara roads/airstrips are well-mapped in OSM). **Mitigation for boutique villa POIs**: Hosts drop exact pins on the map during listing creation and coordinates live canonically in Supabase PostGIS! |

### 8.3 Final Provider Verdict
**Adopt `@maplibre/maplibre-react-native` (v11) on iOS & Android + `maplibre-gl` on Web**, backed by:
1. **Basemap Vector Tiles**: **OpenFreeMap** (`https://tiles.openfreemap.org/styles/liberty` for Light Mode, `https://tiles.openfreemap.org/styles/dark` for Dark Mode), abstracted behind `EXPO_PUBLIC_MAP_STYLE_LIGHT_URL` / `EXPO_PUBLIC_MAP_STYLE_DARK_URL` so ZuruSasa can swap to custom branded style JSONs, Protomaps PMTiles on Cloudflare R2, or MapTiler/Stadia at any time without touching component code.
2. **Geocoding & Place Autocomplete**: Server-proxied **Photon (Komoot)** (`photon.komoot.io`, biased toward Kenya/East Africa bbox) with **Nominatim** fallback (proper `User-Agent` + 30-day Upstash Redis cache) via a new Supabase Edge Function `maps-proxy`.
3. **Road Routing & Turn-by-Turn**: Server-proxied **OSRM** (`router.project-osrm.org` / optional free-key **OpenRouteService**) cached in Upstash Redis for in-app road polylines & ETA, paired with **1-tap native Google Maps / Apple Maps / Waze deep links** (`google.navigation:q=lat,lng` / `maps://`) which run for free on every guest's phone with zero API keys.

---

## 9. Recommended Premium Map Experience for ZuruSasa

### 9.1 Surface 1 — Discover Map (`app/(tabs)/discover.tsx` + `DiscoverMapView`)
- **Floating Airbnb-Style Mode Pill**: Persistent bottom-center pill (`Map` with map icon in Grid mode; `List` with list icon in Map mode) positioned cleanly above the tab bar, hiding `AIFloatingButton` (or docking it cleanly as a compact header/rail icon) when Map mode is active so floating controls never collide.
- **Native 60fps Vector Map & Clustering**:
  - GeoJSON `ShapeSource` (`cluster={true}`, `clusterRadius={50}`, `clusterMaxZoomLevel={14}`) rendering brand-orange (`#F26522`) cluster badges with crisp count typography (`DMSans_700Bold`).
  - Tapping a cluster smoothly zooms (`cameraRef.current.fitBounds` / `zoomTo` over `350ms`) to expand constituent stays and experiences.
- **Signature `KES` Price Pills (3 Distinct Visual States)**:
  - **Default**: Crisp `#FFFFFF` (or `#18181B` in dark mode) capsule with subtle border & elevation, bold `KES 15,000` / `KES 15k` label.
  - **Selected**: Elevated `#F26522` Zuru orange capsule (`zIndex: 100`), white text, subtle pointer stem, smooth camera ease-to-center.
  - **Visited / Viewed**: Soft muted `#F3F4F6` / `#27272A` capsule so travelers scanning 20+ coastal villas immediately see which pins they already tapped.
- **Viewport-Driven Discovery (*"Search this area"*)**:
  - Panning or zooming >15% outside the loaded bounding box surfaces a sleek top pill (**"Search this area"**) or auto-fetches after a `450ms` debounce via PostGIS RPC `search_listings_in_bounds(min_lat, min_lng, max_lat, max_lng, ...)`, combined with active category/price/amenity filters.
- **Clean Native Map Chrome**:
  - Right-rail compact glass control stack: **Locate Me** (requests foreground permission on demand and flies camera to user GPS puck), **`+` Zoom In**, and **`-` Zoom Out**.
- **Swipeable Bottom Preview Carousel**:
  - Horizontal paginated `FlatList` of compact, high-craft listing cards (real cover image, real average review rating or *"New"* badge when `reviews_count === 0`, real `price_unit`, distance from user when GPS granted, heart/save toggle, and tap-to-open listing/reel). Swiping cards smoothly pans/highlights the corresponding pin on the map.
- **Honest Town Summary Badges for Unpinned Legacy Listings (`location_precision = 'city_only'`)**:
  - Legacy listings lacking street coordinates **never** receive fake `Math.random()` coordinates. At regional zoom (`zoom <= 11`), towns with unpinned inventory show a clear summary pill (e.g., **"Diani · 24 stays"**); tapping filters the list sheet to Diani while street-level zoom displays only genuinely pinned listings.

### 9.2 Surface 2 — Listing & Booking Detail (*"Where you'll be"*)
- Replace `mapCardMock` in both `components/ReelInfoSheet.tsx` and `components/booking/BookingDetailsStep.tsx` with a dedicated **`ListingLocationMapCard`** component:
  - Renders a genuine embedded MapLibre map (`200px` height, rounded `20px` corners, scroll/pitch gestures disabled inline so vertical sheet scrolling never fights map pan).
  - **Exact vs. Privacy Mode**:
    - `location_precision === 'exact'` (hotels, resorts, restaurants, events, boat departure jetties, or confirmed bookings): Renders ZuruSasa's exact custom pin.
    - `location_precision === 'approximate'` (unbooked private villas/homes): Renders a translucent `#F26522` **~500m privacy circle (`FillLayer` + `LineLayer`)** around a deterministic neighborhood center with caption *"Exact location provided after booking"*.
  - Tapping anywhere on `ListingLocationMapCard` opens a **Full-Screen Neighborhood Map Modal** with full pinch-to-zoom, pan, user distance check, and *"Open in Maps"* (for exact/confirmed locations).

### 9.3 Surface 3 — Host Pin-Drop & Place Search (`app/host/create-reel.tsx`)
- Replace the 6 hardcoded town chips in `MediaAndBasicsSection.tsx` with a **`HostLocationPickerModal`**:
  1. **Search Bar with Autocomplete** powered by `maps-proxy` (`action: 'autocomplete'`, country-biased to Kenya & East Africa, covering Nairobi, Diani, Watamu, Lamu, Mombasa, Malindi, Kilifi, Naivasha, Nanyuki, Maasai Mara, Kisumu, Zanzibar, Arusha, Kampala, etc.).
  2. **"Use My Current Location"** GPS button for hosts standing on-property when filming a live reel.
  3. **Interactive Center-Crosshair Pin-Drop Map**: Host drags/zooms the map beneath a fixed center pin (Airbnb/Uber pickup pattern — far more accurate on touchscreens than dragging a tiny marker with a finger!) with debounced reverse-geocoding filling `city`, `country_code`, and formatted area label.
  4. **Location Privacy Toggle**: *"Show exact pin to guests"* vs. *"Show approximate ~500m area until booking is confirmed"*.
- Add a non-intrusive **"Pin exact location on map"** banner in `app/(tabs)/listings.tsx` / `HostDashboard.tsx` so existing hosts can upgrade legacy `city_only` listings in 10 seconds.

### 9.4 Surface 4 — Live Journey & Arrival Companion (`JourneyCompanionSheet.tsx`)
- Scope `JourneyCompanionSheet` honestly and reliably as ZuruSasa's **Live Route Overview & Arrival Companion**:
  - Renders real road geometry via `maps-proxy` (`action: 'route'`, OSRM driving profile cached in Upstash Redis) — following real highways/bridges (e.g., Dongo Kundu Bypass / Likoni route) rather than straight lines across water.
  - Requests foreground permission cleanly if not yet granted, subscribes to `Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 10000 })` while open (with strict `subscription.remove()` cleanup on unmount/close), and updates remaining distance & live ETA dynamically.
  - Primary CTA opens a clean action sheet for **1-tap Turn-by-Turn Navigation** in **Google Maps**, **Apple Maps** (iOS), or **Waze** using exact confirmed coordinates.

---

## 10. Phased Implementation Plan (Phases 1–4)

### Phase 1 — MapLibre Native Foundation, PostGIS Schema & `maps-proxy` Edge Function
**Objective**: Establish real geospatial storage in Supabase, server-cached zero-billing geocoding/routing, and working MapLibre native rendering on Android, iOS, and Web without touching existing booking/payment flows.

1. **Dependencies & Expo Config**:
   - Install `@maplibre/maplibre-react-native` (and `maplibre-gl` for Web support) via `npx expo install`; remove unused `react-native-maps` and `react-native-map-clustering` once migration of `SafeMapView.tsx` completes.
   - Update `app.json` (and optional `app.config.ts`) to replace `"react-native-maps"` + dead `googleMaps` blocks with `"@maplibre/maplibre-react-native"`.
   - Add `EXPO_PUBLIC_MAP_STYLE_LIGHT_URL=https://tiles.openfreemap.org/styles/liberty` and `EXPO_PUBLIC_MAP_STYLE_DARK_URL=https://tiles.openfreemap.org/styles/dark` to `.env.example` and `.env`.
2. **Supabase PostGIS Migration (`supabase/migrations/YYYYMMDD_geospatial_listings_postgis.sql`)**:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;

   ALTER TABLE public.experiences
     ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS display_latitude DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS display_longitude DOUBLE PRECISION,
     ADD COLUMN IF NOT EXISTS location_precision TEXT NOT NULL DEFAULT 'city_only'
       CHECK (location_precision IN ('exact', 'approximate', 'city_only')),
     ADD COLUMN IF NOT EXISTS formatted_address TEXT,
     ADD COLUMN IF NOT EXISTS city TEXT,
     ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'KE',
     ADD COLUMN IF NOT EXISTS geog GEOGRAPHY(Point, 4326)
       GENERATED ALWAYS AS (
         CASE
           WHEN display_latitude IS NOT NULL AND display_longitude IS NOT NULL
           THEN ST_SetSRID(ST_MakePoint(display_longitude, display_latitude), 4326)::geography
           ELSE NULL
         END
       ) STORED;

   CREATE INDEX IF NOT EXISTS idx_experiences_geog_gist ON public.experiences USING GIST (geog);
   CREATE INDEX IF NOT EXISTS idx_experiences_precision ON public.experiences (location_precision);
   ```
   - **Privacy Security Guarantee**: Store `display_latitude` / `display_longitude` (deterministic ~350m–500m offset computed once on write when `location_precision = 'approximate'`, or equal to `latitude`/`longitude` when `'exact'`) for public `SELECT` queries, and expose exact `latitude`/`longitude` for `'approximate'` listings **only** to the listing owner (`auth.uid() = user_id`) or guests with a `confirmed`/`paid` booking via a `get_confirmed_booking_coordinates(booking_id uuid)` `SECURITY DEFINER` RPC! That ensures unbooked clients cannot scrape exact private-villa coordinates from raw PostgREST JSON payloads.
   - **Bounding-Box Viewport RPC**: Create `public.search_reels_in_bounds(min_lat float8, min_lng float8, max_lat float8, max_lng float8, p_categories text[] DEFAULT NULL, p_min_price numeric DEFAULT 0, p_max_price numeric DEFAULT 150000, p_limit int DEFAULT 150)` using `ST_Intersects(e.geog, ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography)` so map panning executes indexed spatial queries in `<15ms`.
3. **Supabase Edge Function (`supabase/functions/maps-proxy/index.ts`)**:
   - Actions: `autocomplete`, `reverse_geocode`, `geocode_venue`, and `route`.
   - Uses Upstash Redis (`UPSTASH_REDIS_REST_URL`) already configured in ZuruSasa's backend (`30-day TTL` on geocode/autocomplete keys, `15-min TTL` on route polylines) + rate limiting (`_shared/rateLimiter.ts`).
   - Upstream zero-card providers: **Photon (`photon.komoot.io`)** + **Nominatim** fallback (with compliant `User-Agent: ZuruSasaMobile/1.0`) for search/reverse-geocoding, and **OSRM (`router.project-osrm.org`)** (or optional free `OPENROUTESERVICE_API_KEY`) for driving polylines.
4. **Honest Legacy Backfill Script**:
   - One-time idempotent migration/script querying existing `180` `experiences`: populates `city = initcap(location)` and geocodes **only** rows whose `title` / `entity_name` resolves to a high-confidence named venue within 25 km of the stated town; leaves generic rows (e.g., `"New Coastal Activity"` in `"diani"`) at `location_precision = 'city_only'` with `NULL` street coordinates (zero fabricated pins).

### Phase 2 — Premium Discover Map & Interactive Detail Map Cards
**Objective**: Unlock Map Mode in Discover and replace cover-photo mocks in Listing & Booking Detail.

1. **Discover Screen (`app/(tabs)/discover.tsx`)**:
   - Render the floating `Map / List` toggle pill (`bottom: insets.bottom + 76`, centered) calling `setDiscoverViewMode((m) => (m === 'grid' ? 'map' : 'grid'))` with light haptic feedback on iOS.
   - Suppress overlapping `AIFloatingButton` while `discoverViewMode === 'map'` (Zuru Agent remains 1 tap away in the top category bar).
2. **New MapLibre `DiscoverMapView` (`components/map/DiscoverMapView.tsx`)**:
   - Uses `<MapLibreGL.MapView>` on iOS/Android (and `maplibre-gl` on Web via platform file `MapCanvas.native.tsx` / `MapCanvas.web.tsx`) synced with `useTheme()` (`isDark` switches between OpenFreeMap `liberty` and `dark`).
   - Renders clustered pins via `<ShapeSource cluster clusterRadius={50}>` + `KES` price pills (`default` / `selected` / `viewedIds` states) + town summary badges for `city_only` counts at low zoom.
   - Adds right-side **Locate Me** + **`+` / `-` Zoom** controls, debounced **"Search this area"** pill wired to `search_reels_in_bounds`, and a **horizontal swipeable preview card carousel** displaying real `average_rating` (or *"New"*), real `price_unit`, and tap-to-open listing.
3. **Listing & Booking *"Where you'll be"* (`components/map/ListingLocationMapCard.tsx`)**:
   - Replaces `mapCardMock` in `ReelInfoSheet.tsx` and `BookingDetailsStep.tsx`.
   - Renders exact pin (`exact`), ~500m translucent orange circle (`approximate`), or clean coastal region overview (`city_only`), expanding into `FullScreenLocationModal.tsx` on tap.

### Phase 3 — Host Pin-Drop Picker, Autocomplete & Legacy Prompt
**Objective**: Guarantee 100% of newly published stays, villas, tours, boats, and events capture accurate coordinates.

1. **Host Location Picker (`components/map/HostLocationPickerModal.tsx`)**:
   - Search autocomplete input (`maps-proxy` -> Photon/Nominatim), *"Use My Current GPS"* button, interactive center-crosshair MapLibre pin-drop canvas, reverse-geocoded neighborhood/city preview, and *"Exact location"* vs. *"Approximate (~500m circle until booked)"* privacy switch.
2. **Create Reel Form Integration (`hooks/useCreateReelForm.ts` & `MediaAndBasicsSection.tsx`)**:
   - Persist `latitude`, `longitude`, `display_latitude`, `display_longitude`, `location_precision`, `city`, `formatted_address`, and `country_code` into `public.experiences` (and `lat`/`lng` on `public.reels`).
3. **Host Listings Prompt (`app/(tabs)/listings.tsx`)**:
   - Show an actionable *"Add map pin"* chip on any host listing where `location_precision === 'city_only'`.

### Phase 4 — Live Journey Companion Upgrade & Polish
**Objective**: Deliver accurate post-booking arrival guidance and external turn-by-turn handoff.

1. **`JourneyCompanionSheet.tsx` & `SafeRouteMapView`**:
   - Fetch confirmed booking coordinates via `get_confirmed_booking_coordinates(booking.id)`.
   - Request foreground location permission if undetermined (never silently assume Mombasa), subscribe to `Location.watchPositionAsync` while active, and fit camera bounds smoothly to `[userLocation, destLocation]` over real OSRM road geometry from `maps-proxy`.
   - Replace misleading *"Live in-app guidance"* copy with *"Live Route & ETA Tracking"* + prominent **1-tap Open in Google Maps / Apple Maps / Waze** action buttons.

---

## 11. Exact Files Requiring Modification

> **Constraint Confirmation**: Zero files below were modified during this audit. All paths represent the exact change manifest for Phases 1–4 while leaving Authentication (`app/auth.tsx`, `context/AuthContext.tsx`), Booking Checkout/Ledger RPCs, Paystack Webhooks, Video Feed (`app/(tabs)/index.tsx`), and Tab Navigation (`app/(tabs)/_layout.tsx`) untouched.

| Phase | Action | File Path | Planned Change |
| :---: | :---: | :--- | :--- |
| **1** | `[MODIFY]` | `package.json` | Add `@maplibre/maplibre-react-native` (and `maplibre-gl` for web); remove `react-native-maps` & `react-native-map-clustering` after cutover. |
| **1** | `[MODIFY]` | `app.json` | Replace `"react-native-maps"` and dead `ios.config.googleMaps` / `android.config.googleMaps` blocks with `"@maplibre/maplibre-react-native"`; remove unused `NSLocationAlwaysAndWhenInUseUsageDescription` if background tracking is not used. |
| **1** | `[MODIFY]` | `.env.example` | Replace `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` with `EXPO_PUBLIC_MAP_STYLE_LIGHT_URL` & `EXPO_PUBLIC_MAP_STYLE_DARK_URL` (defaulting to OpenFreeMap). |
| **1** | `[NEW]` | `supabase/migrations/202611080001_postgis_listing_coordinates.sql` | Enable `postgis`, add coordinate + `location_precision` columns & GiST index on `experiences`, create `search_reels_in_bounds` and `get_confirmed_booking_coordinates` RPCs. |
| **1** | `[NEW]` | `supabase/functions/maps-proxy/index.ts` | Edge Function for Upstash-Redis-cached place autocomplete, reverse geocoding, and OSRM road routing. |
| **1** | `[NEW]` | `services/mapService.ts` | Client geospatial service calling `maps-proxy` & `search_reels_in_bounds` (replaces `services/googleMapsService.ts`). |
| **1** | `[MODIFY]` | `lib/supabase.ts` | Add `display_latitude`, `display_longitude`, `location_precision`, `city`, `formatted_address`, `country_code` to `ExperienceRow` & `ReelRow`. |
| **1** | `[MODIFY]` | `lib/queries/reels.ts` & `services/filterService.ts` | Include new geospatial fields in `experiences(...)` `SELECT` clauses; add bounding-box query hook `useViewportReels`. |
| **2** | `[NEW]` | `components/map/MapCanvas.native.tsx` & `MapCanvas.web.tsx` | Unified cross-platform MapLibre wrapper (`@maplibre/maplibre-react-native` on iOS/Android, `maplibre-gl` on Web — zero static SVG fake maps). |
| **2** | `[MODIFY]` | `components/map/DiscoverMapView.tsx` | Full premium Discover Map with C++ `ShapeSource` clustering, 3-state `KES` price pills, zoom/locate controls, *"Search this area"*, town badges, and horizontal preview carousel. |
| **2** | `[MODIFY]` | `app/(tabs)/discover.tsx` | Render floating `Map / List` toggle pill, wire viewport filter state, and prevent `AIFloatingButton` overlap in map mode. |
| **2** | `[NEW]` | `components/map/ListingLocationMapCard.tsx` & `FullScreenLocationModal.tsx` | Embedded interactive/expandable neighborhood map supporting exact pin and ~500m privacy radius. |
| **2** | `[MODIFY]` | `components/ReelInfoSheet.tsx` & `components/booking/BookingDetailsStep.tsx` | Replace `mapCardMock` cover-photo placeholder under *"Where you'll be"* with `ListingLocationMapCard`. |
| **3** | `[NEW]` | `components/map/HostLocationPickerModal.tsx` | Interactive center-crosshair MapLibre pin-drop + place autocomplete + GPS button + exact/approximate privacy toggle. |
| **3** | `[MODIFY]` | `hooks/useCreateReelForm.ts` & `components/host/create-reel/MediaAndBasicsSection.tsx` | Capture and save exact & display coordinates + pan-Kenya/Africa address fields when publishing listings. |
| **3** | `[MODIFY]` | `app/(tabs)/listings.tsx` | Display *"Add exact map pin"* prompt chip on legacy `city_only` host listings. |
| **4** | `[MODIFY]` | `components/journey/JourneyCompanionSheet.tsx` & `components/map/SafeMapView.tsx` | Upgrade `SafeRouteMapView` to MapLibre, fetch confirmed exact coordinates, wire `Location.watchPositionAsync` cleanup, render real OSRM road polyline, and polish 1-tap Google/Apple/Waze navigation handoff; delete `NativeMapsBridge.tsx` & `googleMapsService.ts` once unused. |

---

## 12. Risks, Costs & Testing Requirements

### 12.1 Cost & Scaling Economics (Zero-Credit-Card Baseline -> High Growth)

| Monthly Scale | Vector Map Tiles (OpenFreeMap -> PMTiles R2) | Geocoding & Autocomplete (`maps-proxy` + Redis) | Road Routing (`maps-proxy` + OSRM/ORS + Redis) | Native Turn-by-Turn Handoff (Google/Apple/Waze Deep Links) | **Estimated Monthly Map Cost** |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **0 – 10,000 MAU** (Launch / Early Growth) | **\$0** (OpenFreeMap CDN, no card/key) | **\$0** (Photon / Nominatim + 30-day Redis cache) | **\$0** (OSRM / ORS free tier + 15-min Redis cache) | **\$0** | **\$0 / mo** |
| **10,000 – 50,000 MAU** (Regional Scale) | **\$0 – \$5/mo** (OpenFreeMap or self-hosted Kenya/Africa Protomaps `.pmtiles` on Cloudflare R2 zero-egress) | **\$0** (>85% cache hit rate on coastal/Nairobi destinations) | **\$0 – \$15/mo** (ORS free tier / lightweight OSRM container) | **\$0** | **\$0 – \$20 / mo** |
| **100,000+ MAU** (Pan-African Scale) | **~\$10 – \$25/mo** (Global or Africa `.pmtiles` on Cloudflare R2 + CDN) | **~\$15 – \$49/mo** (Dedicated Pelias/Geoapify plan if needed) | **~\$20/mo** (Self-hosted Africa OSRM container, ~2 GB RAM) | **\$0** | **~\$45 – \$95 / mo** *(vs. \$300+/mo on Mapbox MAU pricing)* |

### 12.2 Key Technical Risks & Mitigations

| Risk | Likelihood | Impact | Concrete Mitigation |
| :--- | :---: | :---: | :--- |
| **OpenStreetMap boutique villa POI gaps in rural Kenya/Africa** | High | Medium | Never depend solely on text geocoding for property pins: make **interactive pin-drop + host GPS capture** the primary step in `HostLocationPickerModal` so ZuruSasa builds its own first-party verified coordinate database in PostGIS. |
| **Public Nominatim / OSRM demo server rate limits** | Medium | High | Route 100% of requests through `supabase/functions/maps-proxy` with compliant `User-Agent`, `350ms` client debounce, Upstash Redis caching (`30d` geocode / `15m` route), and configurable env vars (`GEOCODER_BASE_URL`, `OSRM_BASE_URL`) for instant provider swap. |
| **Expo Go incompatibility with `@maplibre/maplibre-react-native`** | Certain | Low | ZuruSasa *already* requires a custom `expo-dev-client` (`eas.json` `development` profile) due to `react-native-persona`, `react-native-passkey`, and `@react-native-google-signin/google-signin`. Guard native imports cleanly so Web (`maplibre-gl`) and Jest tests never crash. |
| **Bottom-sheet gesture conflict with embedded detail map** | Medium | Medium | Disable pan/scroll gestures on the inline `200px` `ListingLocationMapCard` (`scrollEnabled={false}`, `pitchEnabled={false}`) and enable full multi-touch gestures inside the tap-to-expand `FullScreenLocationModal`. |
| **Private villa exact-coordinate leakage via network tab / PostgREST** | Medium | High | Store obfuscated `display_latitude` / `display_longitude` for public reads when `location_precision = 'approximate'`, and gate raw `latitude` / `longitude` behind a `SECURITY DEFINER` RPC checking confirmed booking ownership. |

### 12.3 Device & Build Testing Requirements (Before Closing Implementation Phases)
Because this workstation has no local Android SDK/emulator or macOS Xcode simulator and `eas simulator` is not enabled on `okelo0121`, Phase 1–4 implementation **must** be verified via:
1. **EAS Development Build (`npx eas-cli build --profile development --platform android` / `ios`)** installed on a physical Android phone and physical iPhone (or local Android Studio emulator once Android SDK is installed):
   - Two-finger pinch-to-zoom in/out across Mombasa -> Diani -> Watamu -> Nairobi at 60fps with zero blank tiles.
   - Rapid 360° pan, double-tap zoom, two-finger rotate/pitch, and `+` / `-` zoom button taps.
   - Cluster tap -> smooth zoom expansion -> `KES` price pill tap -> immediate `#F26522` selected state + bottom preview card sync -> swipe carousel -> pin highlight updates.
   - Panning to a new coastal town -> *"Search this area"* -> PostGIS `search_reels_in_bounds` updates visible pins accurately.
   - Location permission **Granted** vs. **Denied** flows on both Discover *"Locate Me"* and `JourneyCompanionSheet`.
   - Dark Mode <-> Light Mode live switching in `Profile -> Preferences`.
   - Host creating a new listing via `HostLocationPickerModal` (autocomplete + pin-drop + ~500m privacy toggle) -> verifying public Discover/Detail shows ~500m circle before booking and exact pin + external Google/Apple Maps turn-by-turn handoff after booking confirmation.
2. **Expo Web Verification (`npx expo start --web`)**:
   - Confirm `MapCanvas.web.tsx` (`maplibre-gl`) renders genuine interactive OpenFreeMap vector tiles in Chrome/Edge with mouse wheel zoom, drag pan, and clickable `KES` price pills (completely replacing the old static SVG fallback).
