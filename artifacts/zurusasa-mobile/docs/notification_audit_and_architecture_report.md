# ZuruSasa Notification & Communication Audit and Target Architecture Report

**Project:** ZuruSasa Mobile (`artifacts/zurusasa-mobile`) & Supabase Backend  
**Audit Date:** 2026-11-21  
**Audit Mode:** Strictly Read-Only Static Codebase & Migration Inspection (Zero source files, migrations, dependencies, environment variables, or database objects modified)  
**Deliverable:** `docs/notification_audit_and_architecture_report.md`

---

## Status Label Legend

Every audit finding in this report is explicitly labeled with one of the four mandatory status labels:

- **`Already implemented`** — Functionality exists end-to-end in the local codebase or migrations as described.
- **`Partially implemented`** — Core building blocks exist, but critical channels, triggers, filters, security guards, or error-handling paths are incomplete or broken.
- **`Not implemented`** — No implementation exists in the local application code, Edge Functions, or SQL migrations.
- **`Requires further verification`** — Pre-migration remote database state (baseline tables/RLS/publications prior to `202608010001`) or external dashboard settings (Supabase Auth SMTP, external schedulers, Resend domain verification, EAS credentials) cannot be confirmed from local repository files alone.

---

## 1. Existing Notification Architecture

### 1.1 High-Level Architectural Topology — `Partially implemented`

ZuruSasa's current notification system is split across three disconnected execution paths without a unified server-side dispatcher or event outbox:

1. **Direct Database Inserts (SQL RPCs & Privileged Edge Functions)** (`Partially implemented`):
   - PostgreSQL `SECURITY DEFINER` RPCs (`host_confirm_booking`, `host_decline_booking`, `guest_cancel_booking`, `host_check_in_booking`, `guest_check_in_booking`, `report_booking_arrival_issue`, `submit_booking_review`) and backend Edge Functions (`paystack-webhook/index.ts`, `process-booking-refund/index.ts`, `process-host-payouts/index.ts`) write rows directly into `public.notifications`.
   - Because there are **zero** PostgreSQL triggers (`CREATE TRIGGER`) or `pg_net` webhooks on `public.notifications` across all 41 local migrations (`supabase/migrations/*.sql`), DB-inserted notifications **only** reach the mobile app via Supabase Realtime (`in_app`) and never automatically trigger Expo Push, Resend email, or Africa's Talking SMS.
2. **Client-Invoked Edge Function Dispatch (`dispatch-notification` & `send-email`)** (`Partially implemented`):
   - `supabase/functions/dispatch-notification/index.ts:243-540` and `supabase/functions/send-email/index.ts:58-275` both require a user JWT (`verify_jwt = true` in `supabase/config.toml:40-44` and `userClient.auth.getUser()`).
   - Consequently, push and email notifications for several workflows—such as host booking acceptance/decline (`lib/queries/host.ts:171-197,228-252`), chat messages (`lib/queries/messages.ts:330-379`), and host applications (`app/become-host.tsx:98-106`)—are fired asynchronously from the mobile client. If the user's app backgrounds or loses connectivity immediately after the database RPC succeeds, push and email delivery silently fail.
3. **Standalone Privacy Export Email Paths** (`Already implemented` / isolated):
   - `supabase/functions/request-personal-data/index.ts:41-96` and `supabase/functions/process-personal-data-export/index.ts:186-233` call the Resend HTTP API (`https://api.resend.com/emails`) directly, bypassing `send-email` and `public.notifications`.

### 1.2 In-App Notifications, Notification Bell & Notification Centre — `Already implemented` (with defects)

- **Notification Bell & Unread Badge** (`Already implemented`):
  - `app/(tabs)/profile.tsx:62,496-508` renders the notification bell button (`testID="notification-bell-btn"`) navigating to `/notifications`, overlaid with `<NotificationBadge count={unreadCount} />` (`components/NotificationBadge.tsx:8-18`), which caps display at `'99+'` using `unreadCount` from `useNotifications()`.
- **Notification Data Hook (`useNotifications`)** (`Already implemented` core / `Partially implemented` filtering):
  - `hooks/useNotifications.ts:31-205` fetches persisted notifications via `notificationService.fetchNotifications(userId)` and `notificationService.fetchUnreadCount(userId)` (`services/notificationService.ts:57-145`).
  - Subscribes to `notifications:${userId}` via `realtimeManager.subscribe` (`hooks/useNotifications.ts:70-136`), updates state on `INSERT`/`UPDATE`/`DELETE`, invalidates React Query keys (`['bookings']`, `['my-bookings']`, `['host-calendar-bookings']`) on booking/payment/refund events, and provides optimistic `markAsRead`, `markAllAsRead`, and `deleteNotification`.
  - **Type-Allowlist Filtering Bug** (`Partially implemented`): `hooks/useNotifications.ts:8-29,139-143,193` filters `notifications` using `GUEST_NOTIFICATION_TYPES` and `HOST_NOTIFICATION_TYPES` before returning them. These sets **omit** `'booking_declined'`, `'booking_checked_in'`, `'arrival_issue_reported'`, `'payment_failed'`, `'booking_rescheduled'`, `'zuruplan_reminder'`, `'listing_inquiry'`, `'review_received'`, `'new_review'`, `'like'`, `'comment'`, and `'follow'`. Even though `app/notifications/index.tsx:32-55,78-93` aliases the hook output as `rawNotifications` and defines local filter sets containing `'booking_declined'`, those rows are already stripped by `useNotifications` before reaching the screen.
- **Notification Centre Screen & Cards** (`Already implemented` core / `Partially implemented` card actions):
  - `app/notifications/index.tsx:57-271` renders a `SectionList` grouped into `Today`, `Yesterday`, and `Earlier`, supports pull-to-refresh, `Mark all read`, marks items read on press, and routes via `action_type` (`booking`, `chat`, `payout`, `listing`, `discover`, `profile`, `support`).
  - `components/NotificationCard.tsx:14-133` lacks an explicit switch case for `'refund_processed'` (falls back to default bell icon), omits CTA labels for `'profile'` and `'support'`, and ignores the `onDelete={deleteNotification}` prop passed by `app/notifications/index.tsx:235`.
- **Foreground Banners & Modal Alerts** (`Already implemented`):
  - `app/_layout.tsx:172-186` (`GlobalNotificationSubscriber`) triggers `notificationService.presentLocalNotification(...)` on every Realtime `INSERT` into `public.notifications`.
  - `context/CustomAlertContext.tsx:179-444` provides animated in-app modal alerts (`useCustomAlert`) with `expo-haptics` feedback. No third-party toast/snackbar library (`react-native-toast-message`, `burnt`, `sonner-native`) is installed in `package.json:16-71` (`Not implemented`).
- **Unused Components & Production Test Buttons** (`Not implemented` dead components / `Already implemented` risk):
  - `components/EmptyNotifications.tsx:6-31` and `components/NotificationPermissionModal.tsx:19-75` have zero imports anywhere in the codebase (`app/notifications/index.tsx:257-265` uses an inline empty state).
  - `app/notifications/index.tsx:65-75,194-203` and `app/profile/notifications.tsx:197-217` expose `"Test Banner"` / `"Test Push Banner"` buttons to **all users** in production (not gated behind `__DEV__`), calling `notificationService.triggerTestPush(user.id)` (`services/notificationService.ts:446-485`) which inserts a real `'booking_confirmed'` row into `public.notifications`.

---

## 2. Existing Database Tables and Relationships

> **Baseline Schema Caveat (`Requires further verification`):** `supabase/migrations/` contains 41 SQL files starting at `202608010001_secure_booking_foundation.sql` with no initial `0000_init.sql` baseline dump, and `supabase/schema.sql` / `supabase/seeds/` do not exist (`Not implemented`). Pre-migration definitions, columns, RLS policies, and `supabase_realtime` publication membership for base tables (`profiles`, `experiences`, `bookings`, `conversations`, `messages`, `reels`, `reel_likes`, `reel_saves`, `user_follows`, `event_subscribers`, `host_reviews`) exist remotely prior to `202608010001` and require live database verification.

### 2.1 `public.notifications` — `Already implemented` (reusable core; missing delivery/idempotency columns)

- **Migrations:** `202608130005`, `202608130006:56-99`, `202608130008:65-111`, `202608130009:5-98`, `202608130010:120-232`, `202608140001:9-237`, `202611020001:421-533`.
- **Columns & Relationships:**
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` (`202608030001:12`, `202608140001:11`)
  - Alias / legacy columns: `recipient_id uuid`, `actor_id uuid`, `sender_id uuid`, `type text DEFAULT 'notification'`, `title text DEFAULT ''`, `message text DEFAULT ''`, `body text DEFAULT ''`, `content text DEFAULT ''`, `image_url text`, `action_type text`, `action_id text`, `data jsonb DEFAULT '{}'::jsonb`, `metadata jsonb DEFAULT '{}'::jsonb`, `is_read boolean DEFAULT false`, `read boolean DEFAULT false`, `category text`, `status text`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz DEFAULT now()`.
- **Constraints & Indexes:**
  - `202608140001:46-85` dynamically dropped all `NOT NULL` constraints (except `id`, `user_id`, `created_at`) and **all `CHECK` constraints** (`contype = 'c'`) on `public.notifications`.
  - Index `idx_notifications_user_created` on `(user_id, created_at DESC)` (`202608130006:78`, `202608130010:142`).
  - Missing: No `dedupe_key` / `idempotency_key` column or unique index; no `priority` or `event_id` column.
- **Database Triggers:**
  - `trg_sync_notifications_columns` (`BEFORE INSERT OR UPDATE`, executes `public.sync_notifications_columns()`, `202608140001:91-138`): Keeps `user_id <-> recipient_id`, `message <-> body <-> content`, `metadata <-> data`, and `is_read <-> read` synchronized.
  - No outbound push/email/webhook trigger exists (`Not implemented`).
- **RLS Policies, Grants & RPC:**
  - RLS enabled (`202608140001:144`). `REVOKE ALL ON public.notifications FROM anon;` (`202611020001:424`), `GRANT ALL ON public.notifications TO authenticated;` (`202608140001:180`).
  - Policies (`202608140001:156-176`, updated `202611020001:426-430`): `"notifications_select_policy"` (`user_id = auth.uid() OR recipient_id = auth.uid()`), `"notifications_insert_policy"` (`WITH CHECK (user_id = auth.uid())`), `"notifications_update_policy"`, `"notifications_delete_policy"`.
  - RPC `public.send_notification(p_user_id, p_type, p_title, p_message, p_metadata)` (`SECURITY DEFINER`, `202611020001:432-533`): Granted to `authenticated, service_role`; validates relationship (`conversations`, `booking_quotes`, `bookings`, `user_follows`, `reel_likes`) and blocks `('payment_success', 'payout_completed', 'refund_processed', 'verification_approved')` for non-privileged callers.

### 2.2 `public.user_devices` — `Already implemented` (reusable; missing metadata & cross-user token eviction)

- **Migrations:** `202608130005:9-30`, `202608130006:8-50`, `202608130007:4-10`, `202608130008:8-60`, `202608130010:8-115`, `202608130011:4-119`.
- **Columns & Constraints:**
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `push_token text NOT NULL` (relaxed nullable in `0006:20`/`0011:6`), `device_token text` (legacy nullable synced column, `202608130011:13-14`), `device_type text DEFAULT 'android'`, `is_active boolean NOT NULL DEFAULT true`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.
  - Unique constraint `UNIQUE (user_id, push_token)` (`202608130011:30`).
  - Indexes: `idx_user_devices_user_id`, `idx_user_devices_push_token`, `idx_user_devices_active_user` on `(user_id, is_active)` (`202608130010:43-45`; first two also in `202608130006:39-40`).
  - Missing: `last_seen_at`, `app_version`, `locale`, `timezone`, `failure_count`, and cross-user uniqueness/deactivation on `push_token`.
- **RLS, Grants & RPC:**
  - RLS enabled (`202608130010:48`), policy `"Users can manage their own devices"` (`FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`).
  - Residual `GRANT SELECT ON public.user_devices TO anon;` exists in `202608130008:59` and `202608130010:59`.
  - RPC `public.register_device_push_token(p_push_token text, p_device_type text DEFAULT 'android')` (`SECURITY DEFINER`, `202608130011:38-119`) upserts `(user_id, push_token)` and syncs `device_token`.
  - Triggers: None (`Not implemented`).

### 2.3 `public.profiles` — `Partially implemented` (preferences & KYC columns; pre-existing base schema)

- **Local Migrations:** `202608040001` (`account_status`), `202608200001` (`persona_inquiry_id`, `verification_status`, `identity_verification_status`, `verified_at`, `verification_updated_at`, `verification_details`), `202608200002` (`is_verified`), `202611020001:264-327` (`trg_guard_profile_privileged_columns` preventing non-`service_role` elevation of `role` to `'admin'` or self-approval of KYC columns).
- **JSONB Columns Referenced in Code (`Requires further verification` for base DDL/RLS):**
  - `profiles.notification_settings` (read/written by `app/profile/notifications.tsx:134,161`; read by `dispatch-notification/index.ts:342` and `send-email/index.ts:203`).
  - `profiles.metadata` (stores `notifications_enabled` checked at `dispatch-notification/index.ts:347` and `send-email/index.ts:214`, plus `saved_trips` for ZuruPlan at `services/zuruPlanService.ts:166`).
  - `profiles.privacy_settings` (`app/profile/privacy.tsx:210-217`, `process-personal-data-export/index.ts:323`).
- **Missing:** No `timezone` column, no `marketing_opt_in` / `marketing_opt_in_at` columns, and no normalized `notification_preferences` table (`Not implemented`).

### 2.4 Messaging & AI Tables — `Requires further verification` (Human) / `Already implemented` (AI)

- **Human Messaging (`public.conversations`, `public.messages`):** Base tables and RLS policies were created prior to `202608010001` (`Requires further verification`). Local migrations verify `conversations(participant_one, participant_two)` (`202611020001:469-472`), `ON DELETE CASCADE` from `auth.users` (`202608030001:11-12`), and index `idx_messages_conv_created` on `public.messages (conversation_id, created_at DESC)` (`202608130001:30-31`). Client queries (`lib/supabase.ts:447-472`, `lib/queries/messages.ts`) read `conversations(id, participant_one, participant_two, last_message_at)` and `messages(id, conversation_id, sender_id, content, image_url, metadata, is_read, created_at)`. No DB trigger on `messages` sends notifications (`Not implemented`).
- **AI Chat (`public.ai_conversations`, `public.ai_messages`, `public.ai_user_memories`):** `Already implemented` (`20261106000001`) with `auth.uid() = user_id` RLS and `updated_at` triggers; strictly isolated from notifications and human messaging.

### 2.5 Bookings, Quotes, Lifecycle Events, Check-In & Financials — `Already implemented`

- **`public.bookings`:** Base table pre-existing (`Requires further verification` for base DDL); extended with `quote_id` (unique partial index `bookings_quote_id_idx`), `payment_attempt_id` (`202608010001:102-110`), `user_id ON DELETE SET NULL` (`202608030002:59-67`), `terms_snapshot` / `house_rules_snapshot` / `cancellation_policy_snapshot` / `arrival_snapshot` / `checkout_snapshot` (`202608200006:29-35`), `is_exclusive_stay` (`202611140002:19-20`), `checked_in_at` / `checked_in_by` / `check_in_method` / `arrival_issue_*` (`202611150001:16-23`). Indexes: `idx_bookings_user_id`, `idx_bookings_exp_checkin_checkout` (`202608130001:23-27`). Direct `INSERT/UPDATE/DELETE` revoked from `anon, authenticated` (`202608180002:94`). Trigger `trg_ensure_booking_check_in_code` (`202611150001:94-98`) creates 6-digit PINs in `public.booking_check_in_codes` (`202611150001:57-108`).
- **`public.booking_quotes`:** `202608010001`, `202608130004`, `202611140002`, `202611150004`. Statuses: `('quote_locked', 'payment_pending', 'payment_succeeded', 'confirmed', 'expired', 'cancelled', 'consumed')`. GiST exclusion constraint prevents overlapping exclusive stays (`202611140002:45-53`). Read-only SELECT RLS for `guest_id = auth.uid()` and `host_id = auth.uid()`.
- **`public.booking_lifecycle_events`:** `202608180002:6-33`. Immutable transition audit log (`booking_id`, `from_status`, `to_status`, `actor_id`, `actor_type`, `reason`, `idempotency_key`, `created_at`). Selectable by guest/host participants. **Highly reusable** as the authoritative state-transition audit source for notification idempotency.
- **`public.payment_attempts` & `public.payment_events`:** `202608010001:56-98`. `payment_attempts` has `unique(quote_id, idempotency_key)` and unique `provider_reference` (Guest SELECT RLS only); `payment_events` has unique `provider_event_key` and RLS enabled with **no client policies** (server-only).
- **`public.financial_ledger`, `public.host_payout_recipients`, `public.host_payouts`, `public.refund_requests`:** `202608020001`, `202608180001`, `202608250002`, `202611150001`. `host_payouts` includes `scheduled_for`, `retry_count`, `max_retries` (default 3), and partial unique index `host_payouts_active_booking_idx`; `refund_requests` has partial unique index `refund_requests_one_live_booking_idx`.
- **`public.reviews`:** `202608200006:38-81`. Direct writes revoked; `submit_booking_review()` RPC (`202608200006:84-207`) inserts a `'new_review'` in-app notification for the host.
- **`public.experiences`, `public.events`, `public.special_offers`:** `experiences` extended with `booking_mode`, `check_in_time` (default `'14:00'`), `check_out_time` (default `'10:00'`), `cancellation_policy`, `arrival_instructions`, `checkout_instructions` (`202608200006:8-19`), PostGIS coordinates (`202611070001`), and `promotional_tags` / `operating_hours` (`202611140001:8-11`). `events` and `special_offers` (`202611140001:14-90`, `202611150003:8-9`) — note `202611140001` enables RLS on `special_offers` (line 62) but **not** on `events` (`Requires further verification`).
- **`public.personal_data_requests` & `public.personal_data_audit_logs`:** `202611090001:53-187`. Stores GDPR/Kenya DPA 2019 export status and salted OTP hashes.

### 2.6 Notification Infrastructure Tables That Do Not Exist — `Not implemented`

- `notification_preferences`, `notification_deliveries` / `email_logs`, `notification_templates`, `notification_queue`, `cron_job_logs`, and `trips` / `itineraries` (ZuruPlan saves to `AsyncStorage` and `profiles.metadata->'saved_trips'`, `services/zuruPlanService.ts:166`, `process-personal-data-export/index.ts:324`).

---

## 3. Existing Backend Functions and Scheduled Jobs

### 3.1 Inventory of Supabase Edge Functions (`supabase/functions/`, 17 total)

Shared helpers (`supabase/functions/_shared/`): `rateLimiter.ts` (Upstash Redis REST rate limiter; fails open if Redis env vars are missing) and `workerAuth.ts` (`timingSafeEqual`, `authorizeWorkerOrAdmin` accepting `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or admin JWT).

| Edge Function | `verify_jwt` (`supabase/config.toml`) | Auth & Rate Limit | Notification / Communication Behavior | Status |
|---|---|---|---|---|
| `dispatch-notification` | `true` | User JWT (`auth.getUser()`), rate limit `30/60s`, relationship check | Inserts optional `notifications` row; sends Expo Push (`exp.host`) and optional Africa's Talking SMS. No email, no receipt polling, no retries. | `Partially implemented` |
| `send-email` | `true` | User JWT (`auth.getUser()`), rate limit `10/60s`, self/booking-counterparty/admin check | Calls Resend (`api.resend.com/emails`) for `host_application` template or client-supplied raw `subject`+`html`. No email log or retry queue. | `Partially implemented` |
| `paystack-webhook` | `false` | POST HMAC-SHA512 `x-paystack-signature`; GET `?callback=1` rate limit `20/60s` + Paystack `/transaction/verify` | Inserts in-app `notifications` (`payment_success`, `booking_request`, `refund_processed`). Zero push or email. | `Partially implemented` |
| `process-booking-refund` | `false` | Batch: `authorizeWorkerOrAdmin`; Single `bookingId`: user JWT + guest/host check | Calls Paystack `/refund`; inserts in-app `refund_processed` notification. Zero push or email; no retry backoff. | `Partially implemented` |
| `process-host-payouts` | `false` | `authorizeWorkerOrAdmin` (`CRON_SECRET` / `service_role` / admin JWT) | Calls `complete_due_bookings()`, Paystack `/transfer` (1h/2h/4h retry), inserts in-app `payout_completed`. Zero push/email; zero failure alert; no cron caller. | `Partially implemented` |
| `request-personal-data` | `true` | User JWT, rate limit `5/3600s` | Sends 6-digit OTP email directly via Resend (`api.resend.com/emails`); invokes `process-personal-data-export`. | `Already implemented` |
| `process-personal-data-export` | `false` | **NONE** (critical unauthenticated gap) | Builds JSON/PDF archive, uploads to Storage, sends archive-ready email directly via Resend. | `Partially implemented` (security flaw) |
| `cleanup-personal-data-exports` | `false` | **BROKEN** (imports non-existent `requireWorkerAuth` from `_shared/workerAuth.ts`) | Cleans expired export archives; sends no notifications; no cron caller. | `Partially implemented` (broken) |
| `persona-webhook` | `false` | HMAC-SHA256 `persona-signature` (300s window) | Updates `profiles` KYC fields only. **Zero notifications/push/email.** | `Partially implemented` (no notifications) |
| `verify-persona-inquiry` | `true` | User JWT + Persona `referenceId === user.id` | Updates `profiles` KYC fields only. **Zero notifications/push/email.** | `Partially implemented` (no notifications) |
| `create-booking-payment` | `true` | User JWT + rate limit `5/60s` | Initiates Paystack Card/M-Pesa or settles `amount === 0` (`free_entry`) via `settle_paystack_success` **with zero notifications**. | `Partially implemented` (free-entry silent) |
| `create-host-recipient` | `true` | User JWT + rate limit `5/60s` | Creates Paystack transfer recipient & schedules payouts. No notifications. | `Already implemented` (non-notif) |
| `delete-account`, `maps-proxy`, `redis-cache`, `zuru-ai`, `create-persona-inquiry` | Mixed | Varies | Non-notification utility/AI/auth functions. | `Already implemented` (non-notif) |

### 3.2 Scheduled Jobs, Cron Jobs & Background Workers — `Not implemented`

- **Repository Scheduler Search:** Zero occurrences of `pg_cron`, `pg_net`, `cron.schedule`, `.github/workflows/`, or `.eas/` exist anywhere in the repository (`Not implemented`).
- **Orphaned Cron-Ready Backend Artifacts (`Partially implemented`):**
  - `supabase/functions/process-host-payouts/index.ts` and `supabase/functions/process-booking-refund/index.ts` (batch mode) implement `CRON_SECRET` authentication via `authorizeWorkerOrAdmin`, and `supabase/functions/cleanup-personal-data-exports/index.ts` attempts to import worker auth, **but nothing in source control invokes them**.
  - `public.expire_booking_quotes()` (`202608010001:45,155`) documents *"Expired quotes are transitioned by expire_booking_quotes before each quote is created and by a scheduled job"*, yet only inline pre-quote calls exist (`202611150004:83`).
  - `public.complete_due_bookings()` (`202608180002:708-727`) is only called inside `process-host-payouts/index.ts:41`.
  - Whether external cron triggers exist inside the hosted Supabase Dashboard or third-party infrastructure `Requires further verification`.
- **Database Triggers Inventory:** Across all 41 local migrations, 12 `CREATE TRIGGER` statements exist (column syncs, `updated_at` timestamps, `trg_guard_profile_privileged_columns`, `trg_ensure_booking_check_in_code`, PostGIS coordinate sync). **Zero** database triggers enqueue notifications or call Edge Functions (`Not implemented`).

---

## 4. Existing Push Notification Implementation

### 4.1 Mobile Client Configuration & Packages — `Already implemented` (missing `expo-device`)

- **Packages (`package.json:29,32,34,44`):** `@supabase/supabase-js` (`^2.110.7`), `expo` (`~57.0.20`), `expo-constants` (`~57.0.17`), `expo-notifications` (`~57.0.17`). `expo-device` is **not installed** (`Not implemented`), so `notificationService.registerPushToken` has no `Device.isDevice` physical-device guard.
- **App Config (`app.json:9,30-31,55-60,73-80,107-110`):** Configures `scheme: "zurusasa-mobile"`, `android.package: "com.zurureels.app"`, `android.googleServicesFile: "./google-services.json"` (present at repo root), Android permissions `POST_NOTIFICATIONS`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED`, `expo-notifications` plugin (`icon: "./assets/images/icon.png"`, `color: "#F26522"`, `defaultChannel: "default"`), and `extra.eas.projectId: "7288bdeb-4a70-4035-9563-587a72f32534"`. `eas.json:1-31` configures `development`, `preview`, and `production` profiles with `credentialsSource: "remote"`.
- **Foreground Handler & Android Channel (`services/notificationService.ts:12-40,286-296`):** Initializes `Notifications.setNotificationHandler` (`shouldPlaySound: true`, `shouldSetBadge: true`, `shouldShowBanner: true`, `shouldShowList: true`) and creates Android channel `'default'` (`AndroidImportance.MAX`, vibration `[0, 250, 250, 250]`, light `#F26522`, `sound: 'default'`).

### 4.2 Device-Token Registration & Lifecycle — `Partially implemented`

1. **Registration Flow (`services/notificationService.ts:266-418`)** (`Already implemented` core):
   - `registerPushToken(userId)` skips web and Android Expo Go, checks/requests permissions via `getPermissionsAsync()`/`requestPermissionsAsync()`, resolves `projectId` (from `Constants.expoConfig.extra.eas.projectId`, `Constants.easConfig.projectId`, or hardcoded fallback), calls `Notifications.getExpoPushTokenAsync({ projectId })`, and calls `supabase.rpc('register_device_push_token', { p_push_token: token, p_device_type: Platform.OS })` (`202608130011:38-119`), with a direct `user_devices` fallback query/upsert.
2. **Lifecycle Defects (`Partially implemented` / `Not implemented`):**
   - **Duplicate Invocation (`Partially implemented`):** Called from **both** `AuthContext.loadProfile` (`context/AuthContext.tsx:353-355`) and `GlobalNotificationSubscriber` (`app/_layout.tsx:154-156`) on boot/sign-in.
   - **No Token Rotation Listener (`Not implemented`):** `Notifications.addPushTokenListener` is not registered anywhere; OS push token rotations are missed until restart/re-login.
   - **Over-Broad Logout Deactivation (`Partially implemented`):** `AuthContext.signOut` (`context/AuthContext.tsx:478-484`) calls `notificationService.deactivatePushToken(session.user.id)`, which updates `user_devices` with `.eq('user_id', userId)` (`services/notificationService.ts:423-441`) instead of scoping to the current device's `push_token` — disabling push on all of the user's other devices.
   - **Cross-Account Token Leak (`Partially implemented`):** `user_devices` enforces `UNIQUE (user_id, push_token)` (`202608130011:30`). If User A does not cleanly sign out (or uninstalls/reinstalls) and User B logs in on the same physical device, User A's row for that `push_token` remains `is_active = true`.
3. **Listeners & Deep Linking (`Partially implemented`):**
   - **Tap Listener (`app/_layout.tsx:76-119`)** (`Partially implemented`): `RootLayoutNav` registers `addNotificationResponseReceivedListener` and `getLastNotificationResponseAsync()`. However, routing only handles `conversationId`/`chat` (`/chat/${conversationId}`) and `bookingId`/`booking` (`/reservations`); `payout`, `listing`, `discover`, `profile`, and `support` action types are ignored.
   - **Foreground Received Listener (`Not implemented`):** No `Notifications.addNotificationReceivedListener` is registered. Instead, `GlobalNotificationSubscriber` (`app/_layout.tsx:172-186`) fires `presentLocalNotification` on every `notifications` `INSERT` while `setNotificationHandler` has `shouldShowBanner: true` — risking **duplicate foreground banners** whenever remote push and Realtime `INSERT` both fire.

### 4.3 Push Delivery Backend (`dispatch-notification`) — `Partially implemented`

- `supabase/functions/dispatch-notification/index.ts:389-486` queries active tokens from `public.user_devices` (`user_id = recipientId AND is_active = true`), deduplicates tokens in memory, and POSTs to `https://exp.host/--/api/v2/push/send` (`sound: 'default'`, `channelId: 'default'`, `priority: 'high'`, `badge: 1`) (`Partially implemented`).
- Deactivates tokens returning `DeviceNotRegistered` or `InvalidCredentials` (`lines 461-477`) (`Already implemented`).
- **Missing Backend Capabilities (`Not implemented`):** No Expo 100-message batch chunking, no Expo Push Receipt polling (`/push/getReceipts`), no retry/backoff on 429/5xx errors, and no `notification_deliveries` persistence. Furthermore, backend webhooks, cron workers, and SQL RPCs never invoke `dispatch-notification`.

---

## 5. Existing Email Implementation

### 5.1 Resend Integration & Dispatch Paths — `Partially implemented`

Resend (`https://api.resend.com/emails`) is the sole transactional email provider configured in local Edge Functions (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EMAIL_FROM` in `.env.example` and Edge Function code). Supabase Auth (`signInWithOtp` in `context/AuthContext.tsx:460-466`) sends login/signup OTPs externally via Supabase GoTrue (`Requires further verification` in Supabase Dashboard SMTP config).

Three Edge Functions invoke Resend:
1. **`supabase/functions/send-email/index.ts:94-275`** (`Partially implemented`):
   - Requires user JWT (`verify_jwt = true`, `auth.getUser()`), rate-limited to `10/60s` per user via Upstash Redis.
   - Authoritative sender: `RESEND_FROM_EMAIL || EMAIL_FROM || 'ZuruSasa <onboarding@resend.dev>'` (`lines 112-115`).
   - Accepts either `type: 'host_application'` (server-rendered `buildHostWelcomeHtml`) or arbitrary `subject` + `html` from the client when `recipientUserId` matches self, admin, or a shared booking counterparty (`lines 141-198`).
   - Resolves target email from `profiles.email` or `auth.admin.getUserById(targetUserId)`.
   - Checks `profiles.metadata.notifications_enabled === false || profiles.notification_settings.account_activity?.email === false` (`lines 213-222`) and **silently skips** transactional emails if disabled.
   - Performs a single `fetch('https://api.resend.com/emails')` with no plain-text `text` body, no delivery log table, and no retry queue.
2. **`supabase/functions/request-personal-data/index.ts:41-96,115-116`** (`Already implemented`):
   - Calls Resend directly with `EMAIL_FROM ?? RESEND_FROM_EMAIL ?? 'ZuruSasa Privacy <privacy@zurusasa.com>'` to send 6-digit data-export OTP verification emails. (Logs OTP to console when `RESEND_API_KEY` is missing at `line 48`.)
3. **`supabase/functions/process-personal-data-export/index.ts:186-233,246-247`** (`Partially implemented` — auth flaw):
   - Calls Resend directly to notify the user that their personal data archive is ready for download.

### 5.2 Existing Email Templates — `Partially implemented` (decentralized; client-side HTML)

There is **no centralized server-side template registry** (`Not implemented`). Four templates are scattered across client and Edge Functions:

| Template | Location | Trigger / Caller | Variables | Gaps |
|---|---|---|---|---|
| Host Welcome | `send-email/index.ts:29-56,130-139` (`buildHostWelcomeHtml`) | `app/become-host.tsx:98-106` | `hostName` | HTML only (no `text` part). |
| Booking Confirmed | `services/emailService.ts:38-114,161-195` (`getZuruSasaEmailTemplate`) | `lib/queries/host.ts:187-196` (`useHostConfirmBooking`) | `guestName`, `tripTitle`, `bookingId`, `amount`, `startDate`, `endDate` | **Client-rendered raw HTML**; `lib/queries/host.ts:193-194` passes `data.start_date` / `data.end_date` (`undefined` on `public.bookings`, which uses `check_in` / `check_out`); **never sent for instant bookings**. |
| Booking Cancelled | `services/emailService.ts:38-114,197-231` (`getZuruSasaEmailTemplate`) | `lib/queries/host.ts:244-251` (`useHostDeclineBooking`) | `name`, `tripTitle`, `bookingId`, `reason` | **Client-rendered raw HTML**; **never sent on guest cancellation**. |
| Personal Data OTP & Export Ready | `request-personal-data/index.ts:41-96`, `process-personal-data-export/index.ts:186-233` | Data export flow | `otp`, `requestId` | Duplicated Resend `fetch` boilerplate outside `send-email`. |

- **Missing Email Templates (`Not implemented`):** Guest payment receipt, host new booking alert, guest cancellation notice to host, guest cancellation confirmation, refund processed receipt, host payout completed/failed notice, 24h & 1h check-in reminders, Persona KYC verified/declined notices, unread message digest, post-stay review prompt, and promotional opt-in campaigns.

---

## 6. Booking and Payment Notification Workflows

### 6.1 End-to-End Workflow Matrix (Verified Backend & Client)

| Workflow | Event Origin | In-App DB Row | Push | Email | Status |
|---|---|---|---|---|---|
| **1. Guest Booking Creation (Paid M-Pesa / Card)** | `hooks/useBookingCheckout.ts:861-912` -> `create-booking-payment` -> `paystack-webhook/index.ts:51-104` -> `settle_paystack_success` (`202611140002:388-554`) | Yes (`payment_success` to guest, `booking_request` to host) | **No** | **No** | `Partially implemented` |
| **1b. Guest Booking Creation (`amount === 0` Free Entry)** | `create-booking-payment/index.ts:148-178` -> `settle_paystack_success` | **No** (bypasses `paystack-webhook`) | **No** | **No** | `Not implemented` |
| **2a. Booking Confirmation (Instant Book)** | `settle_paystack_success` sets `bookings.status = 'confirmed'` (`202611140002:455-459`) | **Wrong copy** (`payment_success` says *"The host will confirm your reservation shortly."*; host gets `booking_request`) | **No** | **No** | `Partially implemented` |
| **2b. Booking Confirmation (Host Accept: `paid` -> `confirmed`)** | `useHostConfirmBooking` (`lib/queries/host.ts:153-200`) -> `host_confirm_booking` (`202608180002:333-372`) | Yes (`booking_confirmed` inserted in SQL RPC) | Client-triggered (`dispatch-notification`, `createInApp: false`) | Client-triggered (`send-email`, broken `start_date`/`end_date`) | `Partially implemented` |
| **3a. Payment Verification & Settlement** | Paystack POST HMAC-SHA512 & GET `?callback=1` (`paystack-webhook/index.ts:207-350`) -> `/transaction/verify/` | Yes (`dispatchPostSettlementNotifications`) | **No** | **No** | `Partially implemented` |
| **3b. Payment Failure (`charge.failed` / Poll Timeout)** | `paystack-webhook/index.ts:351-366` -> `settle_paystack_failure` (`202608010001:533-588`); client poll `useBookingCheckout.ts:1019-1070` | **No** | **No** | **No** | `Not implemented` |
| **3c. Refunds** | `process-booking-refund/index.ts:1-263` & `paystack-webhook/index.ts:367-429` (`refund.processed`) | Yes (`refund_processed` — **can duplicate!**) | **No** | **No** | `Partially implemented` |
| **4a. Guest Cancellation** | `useGuestCancelBooking` (`lib/queries/bookings.ts:128-154`) -> `guest_cancel_booking` (`202611150001:625-768`) | Yes (`booking_cancelled` to host; **none** to guest) | **No** | **No** | `Partially implemented` |
| **4b. Host Cancellation / Decline** | `useHostDeclineBooking` (`lib/queries/host.ts:202-255`) -> `host_decline_booking` / `host_cancel_booking` (`202608180002:519-668`) | Yes (`booking_declined` to guest — **filtered out by `useNotifications.ts`!**) | Client-triggered (`type: 'booking_cancelled'`) | Client-triggered (`sendBookingCancelledEmail`) | `Partially implemented` |
| **4c. Admin / System Cancellation** | None | **No** | **No** | **No** | `Not implemented` |
| **5. Booking Rescheduling** | None | **No** | **No** | **No** | `Not implemented` |
| **6a. Host Check-In & Arrival Issues** | `host_check_in_booking`, `guest_check_in_booking`, `report_booking_arrival_issue` (`202611150001:363,494,599`) | Yes (`booking_checked_in`, `arrival_issue_reported` — **dropped by `useNotifications.ts`!**) | **No** | **No** | `Partially implemented` |
| **6b. Host Payouts** | `create-host-recipient/index.ts`, `schedule_pending_host_payouts` (`202611150001:165-262`), `process-host-payouts/index.ts:1-206` | Yes (`payout_completed` on success only; **none** on failure/hold) | **No** | **No** | `Partially implemented` |
| **7. Identity Verification (Persona KYC)** | `services/personaVerificationService.ts:85-277`, `create-persona-inquiry`, `verify-persona-inquiry`, `persona-webhook` | **No** | **No** | **No** | `Not implemented` |
| **8. ZuruPlan Reminders & Trip Updates** | `services/zuruPlanService.ts:154-279`, `app/plan/*`, `JourneyCompanionSheet.tsx:280-288` | **No** | **No** | **No** | `Not implemented` |

### 6.2 Key Workflow Observations

- **Guest Booking Creation & Payment Providers (`Already implemented` checkout / `Partially implemented` notifications):**
  - `create_booking_quote` (`202611150004:13-470`) locks a 15-minute quote with frozen policy/pricing snapshots. `create-booking-payment` (`verify_jwt = true`) calls `begin_payment_attempt` and supports **Paystack only** (`mobile_money` MPESA STK via `/charge` and `card` 3DS via `/transaction/initialize`; `0` matches in codebase for Stripe, Pesapal, Flutterwave, Daraja, Braintree, or PayPal).
  - Direct DML on `public.bookings` is revoked from `anon, authenticated` (`202608180002:94`); `settle_paystack_success` (`202611140002:388-554`) inserts the booking, writes `financial_ledger` entries, writes `booking_lifecycle_events`, creates a 6-digit check-in code (`trg_ensure_booking_check_in_code`), and calls `schedule_pending_host_payouts`.
  - Free-entry bookings (`Number(attempt.amount) === 0`, `create-booking-payment/index.ts:148-178`) invoke `settle_paystack_success` directly and skip `dispatchPostSettlementNotifications` completely (`Not implemented`).
- **Booking Confirmation (`Partially implemented`):**
  - `BookingSuccessModal` (`components/booking/BookingStatusModals.tsx:670-677`) displays `"Booking Confirmed! ... is confirmed and locked in"` unconditionally even when `bookings.status = 'paid'` (awaiting host acceptance).
  - For host acceptance, `lib/queries/host.ts:153-200` calls `host_confirm_booking` (`202608180002:333-372`), which returns `public.bookings` (`return v_booking;` at line 370). Because `public.bookings` stores `check_in` and `check_out` (not `start_date`/`end_date`), `lib/queries/host.ts:193-194` passes `startDate: undefined, endDate: undefined` to `emailService.sendBookingConfirmedEmail`.
- **Payment Verification, Failures & Refunds (`Partially implemented`):**
  - Card checkout has a GET `?callback=1` bridge (`paystack-webhook/index.ts:207-255`) that actively calls `/transaction/verify/` if still pending. M-Pesa polling (`hooks/useBookingCheckout.ts:1019-1070`, 40 polls x `1200ms`) only reads Supabase tables without an active Paystack requery fallback.
  - `charge.failed` (`paystack-webhook/index.ts:351-366`) calls `settle_paystack_failure` and emits zero user notifications.
  - `process-booking-refund/index.ts:1-263` marks `refund_requests.status = 'success'` and `bookings.status = 'refunded'` immediately upon Paystack `POST /refund` HTTP 200 without verifying async Paystack status, and both `process-booking-refund` (line 241) and `paystack-webhook` (line 411) insert `'refund_processed'` rows into `public.notifications` without deduplication.
- **Booking Cancellation (`Partially implemented`) & Rescheduling (`Not implemented`):**
  - `guest_cancel_booking` (`202611150001:625-768`) completely ignores `cancellation_policy_snapshot` (lines 681-717) and refunds `100%` (`v_quote.total_amount`) unconditionally. Admin/system cancellation is `Not implemented`.
  - Exhaustive search for `reschedul|modify_booking|change_dates|change_time|alter_booking|rebook` returned zero matches (`Not implemented`).
- **Host Booking Acceptance, Alerts & Payouts (`Partially implemented`):**
  - `app/profile/payments.tsx:280,295` routes `"Payout methods"` / `"Transaction history"` to `components/payments/HostEarningsView.tsx:1-295` (an un-wired USD `$0.00` stub) instead of `app/host/wallet.tsx`.
  - `process-host-payouts/index.ts:74-84` checks `if (booking?.status !== 'completed')` and **cancels** the `host_payouts` row (`status = 'cancelled'`) if not completed, conflicting with `schedule_pending_host_payouts` (`202611150001:165-262`) which schedules payouts at `checked_in_at + 24h` (often before `check_out`).
- **Identity Verification (`Not implemented` notifications) & ZuruPlan (`Not implemented` reminders):**
  - `services/personaVerificationService.ts:85-277`, `app/host/verification.tsx`, `verify-persona-inquiry/index.ts`, and `persona-webhook/index.ts` emit **zero** in-app, push, or email notifications on KYC submission, approval, failure, or cancellation. `app/host/verification.tsx:133-146` exposes a `"Re-verify / Test Again"` reset button in production.
  - `app/become-host.tsx:98-106` sends the `'host_application'` email via `send-email`, with no in-app or push notification.
  - `services/zuruPlanService.ts:154-279` saves itineraries to `AsyncStorage` and `profiles.metadata.saved_trips`. Zero scheduled reminders (`scheduleNotificationAsync` with future triggers or backend cron) exist. `components/journey/JourneyCompanionSheet.tsx:280-288` (`handleShareETA`) is a local alert stub (`Not implemented`).
  - `services/smsService.ts:69-176` wraps `dispatch-notification` with `sendSms: true` and has **zero** callers; `hooks/useCreateReelForm.ts:1235-1242` misuses `type: 'booking_request'` when a listing reel is published.

---

## 7. Messaging and Realtime Implementation

### 7.1 Inbox & 1:1 Messaging — `Already implemented` (in-app & push) / `Not implemented` (email & read-receipt enforcement)

- **Conversation Creation (`lib/queries/messages.ts:26-72`, `components/EnquireModal.tsx:117`)** (`Already implemented`): `useEnquire` sorts `[userId, hostId]` deterministically, finds/creates a `conversations` row, and updates `last_message_at`.
- **Message Creation & Notification Trigger (`lib/queries/messages.ts:320-401`, `services/notificationService.ts:178-179`, `app/chat/[id].tsx:182-188,220-227`)** (`Already implemented` in-app & push / `Not implemented` DB trigger & email): `useSendMessage` inserts into `public.messages`, updates `conversations.last_message_at`, and at `lib/queries/messages.ts:365-378` invokes `notificationService.createNotification({ userId: recipientId, type: 'message', ..., actionType: 'chat', actionId: input.conversationId, metadata: ... })`, which sets `createInApp: true, sendPush: true` inside `services/notificationService.ts:178-179` (`dispatch-notification`). There is **no** database trigger on `messages` (`Not implemented`) and **no** email digest or offline-message email (`Not implemented`).
- **Unread Badges (`lib/queries/messages.ts:76-276`, `app/(tabs)/_layout.tsx:30,74-75,120`, `app/(tabs)/inbox.tsx`)** (`Already implemented`): `useUnreadMessageCount(userId)` counts unread incoming messages across user conversations and drives the Inbox tab red dot and per-row badges (`ConversationListRow`).
- **Defects in Chat & Privacy (`Partially implemented` / `Not implemented`):**
  - `app/profile/privacy.tsx:38,81,210-217` persists `profiles.privacy_settings.read_receipts`, but `app/chat/[id].tsx:95-99,134-136,364-370` and `useMarkMessagesRead` (`lib/queries/messages.ts:403-422`) ignore it and unconditionally set `is_read = true` and render checkmark icons (`Not implemented` enforcement).
  - `app/chat/[id].tsx:127` wipes **all** optimistic `temp-` messages whenever any Realtime `INSERT` arrives; lines `410,417` render a hardcoded green `onlineDot` and static `"Typically replies within 1 hour"`; `useMarkMessagesRead.onSuccess` (`lib/queries/messages.ts:417-420`) omits invalidating `['conversations']` (`Partially implemented`).

### 7.2 Realtime Subscriptions Inventory — `Already implemented` (manager) / `Partially implemented` (table filters)

- **Centralized Manager (`lib/realtimeManagerCore.ts:144-574`, `lib/realtimeManager.ts:1-14`, `lib/networkManager.ts:16-68`)** (`Already implemented`): Implements reference-counted logical keys, monotonic generation topics (`<prefix>_g<n>`), pre-`.subscribe()` `.on('postgres_changes', ...)` binding, explicit `SUBSCRIBED`/`CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` recovery with exponential backoff (`[1s, 2s, 5s, 10s, 20s]`), `removeChannel` cleanup, NetInfo/AppState coordination, and `teardownAll()` on `AuthContext.signOut` (`context/AuthContext.tsx:486`).
- **All 8 Subscription Call Sites:**
  1. `notifications:${userId}` (`app/_layout.tsx:159-212`) — `notifications`, `filter: user_id=eq.${userId}`, cleanup returned.
  2. `notifications:${userId}` (`hooks/useNotifications.ts:70-136`) — shares key #1, `notifications`, `filter: user_id=eq.${userId}`, cleanup returned.
  3. `inbox:${userId}` (`app/(tabs)/inbox.tsx:50-70`) — `conversations`, **NO filter**, cleanup returned.
  4. `unread_messages:${userId}` (`lib/queries/messages.ts:237-249`) — `messages`, **NO filter**, cleanup returned.
  5. `chat:${id}` (`app/chat/[id].tsx:108-155`) — `messages`, `filter: conversation_id=eq.${id}`, cleanup returned.
  6. `guest_bookings:${userId}` (`lib/queries/bookings.ts:47-88`) — `bookings` (**NO filter**) + `notifications` (`filter: user_id=eq.${userId}`), cleanup returned.
  7. `host_bookings:${hostId}` (`lib/queries/host.ts:403-436`) — `bookings` (**NO filter**) + `notifications` (`filter: user_id=eq.${hostId}`), cleanup returned.
  8. `booking_settle:${quote.id}:${attemptId}` (`hooks/useBookingCheckout.ts:479-496,989-1016`) — `bookings` (`user_id=eq.${user.id}`) + `payment_attempts` (`guest_id=eq.${user.id}`), cleaned up via `cleanupPaymentListeners()`.

---

## 8. Existing User Preferences

- **Notification Preferences UI & Persistence (`Already implemented` UI / `Partially implemented` enforcement):**
  - `app/profile/notifications.tsx:52-167,545-626` reads and writes `profiles.notification_settings` JSONB with two tabs: `'offers'` (12 items defaulting in React state to `DEFAULT_OFF`: `email/push/sms/phone_calls = false`) and `'account'` (6 items defaulting in React state to `DEFAULT_ACCOUNT_ON` or `DEFAULT_ACCOUNT_WITH_SMS`).
- **Critical Disconnects Between UI and Backend (`Partially implemented`):**
  1. **13 of 18 UI Keys Ignored Server-Side (`Partially implemented`):** `resolveNotificationCategory` in `supabase/functions/dispatch-notification/index.ts:53-71,340-352,392-394` only maps 5 keys (`messages`, `account_activity`, `listing_activity`, `reminders`, `all_offers`); `supabase/functions/send-email/index.ts:213-222` only checks `account_activity.email === false`; and `phone_calls` is unchecked everywhere.
  2. **`"All offers and updates"` Toggle Bug (`app/profile/notifications.tsx:151-167,433-444`) (`Partially implemented`):** Toggling `all_offers` only updates `prefsMap.all_offers`, leaving the other 11 offer keys untouched.
  3. **Uninitialized New-User Defaults Allow Marketing Push (`Partially implemented`):** Defaults (`DEFAULT_OFF` / `DEFAULT_ACCOUNT_ON`) live only in React state until the user visits `app/profile/notifications.tsx` and toggles a switch. For new users whose `profiles.notification_settings` is `null`/`{}`, `dispatch-notification/index.ts:392-394` evaluates `settings['all_offers']?.push === false` as `false` — **permitting promotional pushes by default**.
  4. **Critical Receipts Can Be Suppressed (`Partially implemented`):** `send-email/index.ts:213-222` and `dispatch-notification/index.ts:347-352,392-394` suppress transactional booking confirmations/cancellations if `notifications_enabled === false` or `account_activity === false`.
  5. **UI Theme & Test Bugs (`Partially implemented`):** Offers tab sections 2–5 (`app/profile/notifications.tsx:313-431`) omit dark-mode theme colors on `sectionHeader`/`sectionSubtitle`, and lines `197-217` expose `"Test Push Banner"` to all users.
- **Unpersisted Stub Preference Screens (`Not implemented` persistence):**
  - `app/profile/preferences.tsx:26-27,99-126` (`autoPlayReels`, `reduceMotion`) and `app/profile/settings.tsx:50-53` (`coHostBooking`, `instantBookingRule`, `highContrast`, `largeText`) use local React `useState` with zero database or `AsyncStorage` persistence.

---

## 9. Missing Functionality

1. **Unified Server-Side Notification Dispatcher / Outbox (`Not implemented`):** No server-to-server notification orchestrator exists that SQL RPCs, webhooks, and cron jobs can invoke for multi-channel (`in_app` + `push` + `email` + optional `sms`) delivery.
2. **24-Hour and 1-Hour Booking / Event / ZuruPlan Reminders (`Not implemented`):** No reminder scheduler, `pg_cron` job, reminder state tracking, or future `Notifications.scheduleNotificationAsync` calls exist.
3. **Scheduled Jobs & Cron Orchestration (`Not implemented`):** Zero `pg_cron`, `pg_net`, GitHub Actions, or EAS workflows exist in the repo to run `process-host-payouts`, `process-booking-refund` batch recovery, `cleanup-personal-data-exports`, `expire_booking_quotes()`, or `complete_due_bookings()`.
4. **Booking Rescheduling (`Not implemented`):** Zero UI, RPCs, Edge Functions, or quote/booking modification flows exist (`0` matches across codebase).
5. **Admin / System Booking Cancellation (`Not implemented`):** No admin override or automated expiry/failure cancellation RPC exists for `bookings`.
6. **Identity Verification (KYC) Notifications (`Not implemented`):** Zero in-app, push, or email alerts from `persona-webhook`, `verify-persona-inquiry`, or client KYC handlers.
7. **Free-Entry (`amount === 0`) & Payment Failure Notifications (`Not implemented`):** Zero alerts on `amount === 0` settlement in `create-booking-payment` or on `charge.failed` / M-Pesa polling timeout.
8. **Centralized Template Registry & Email/Push Delivery Tracking (`Not implemented`):** No `notification_templates` registry, no `notification_deliveries` / `email_logs` table, no `dedupe_key` idempotency, no retry/DLQ queues, and no Expo Push Receipt polling.
9. **Opt-In Promotional Governance & User Timezone Storage (`Not implemented`):** No explicit `marketing_opt_in` consent timestamps or unsubscribe flows, no `timezone` columns on `profiles`/`experiences`, and `JourneyCompanionSheet.handleShareETA` is an alert stub.

---

## 10. Bugs and Reliability Risks

### 10.1 Duplicate Notification Risks — `Partially implemented` (gaps)
- **Duplicate `refund_processed` In-App Rows (`Partially implemented`):** Both `supabase/functions/process-booking-refund/index.ts:241-249` (synchronously on Paystack `/refund` HTTP 200) and `supabase/functions/paystack-webhook/index.ts:411-419` (later on `refund.processed` webhook) insert `'refund_processed'` into `public.notifications` with no deduplication check.
- **Foreground Duplicate OS Banners (`Partially implemented`):** `services/notificationService.ts:17-24` sets `shouldShowBanner: true` while `app/_layout.tsx:172-186` calls `presentLocalNotification` on every `notifications` `INSERT`. When remote push + Realtime `INSERT` both arrive in the foreground, users see two banners.
- **Race-Prone `payment_success` Deduplication (`Partially implemented`):** `paystack-webhook/index.ts:54-62` uses a `COUNT(*)` check-then-insert rather than an atomic `UNIQUE (dedupe_key)` constraint, leaving a race window between concurrent GET `?callback=1` and POST webhook calls.
- **Duplicate Boot Token Registration (`Partially implemented`):** `notificationService.registerPushToken` is invoked concurrently by both `AuthContext.loadProfile` (`context/AuthContext.tsx:353-355`) and `GlobalNotificationSubscriber` (`app/_layout.tsx:154-156`).

### 10.2 Missing Notifications & Misleading/Dropped Alerts — `Partially implemented` / `Not implemented`
- **Hook Allowlist Silently Drops Valid DB Notifications (`Partially implemented`):** `hooks/useNotifications.ts:8-29` omits `'booking_declined'`, `'booking_checked_in'`, `'arrival_issue_reported'`, `'payment_failed'`, `'booking_rescheduled'`, and `'zuruplan_reminder'`.
- **Silent Workflows (`Not implemented`):** Free-entry bookings (`create-booking-payment/index.ts:148-178`), `charge.failed` (`paystack-webhook/index.ts:351-366`), Persona KYC (`persona-webhook`, `verify-persona-inquiry`), payout exhaustion (`process-host-payouts/index.ts:142-154`), and ZuruPlan/24h/1h reminders emit zero alerts.
- **Broken Confirmation Email Dates & Instant-Book Copy (`Partially implemented`):** `lib/queries/host.ts:193-194` passes `data.start_date`/`data.end_date` (`undefined` on `bookings`, which uses `check_in`/`check_out`); `paystack-webhook/index.ts:83,95` tells instant-book guests *"The host will confirm your reservation shortly"* and tells hosts to *"Review and confirm"*; `BookingSuccessModal` (`components/booking/BookingStatusModals.tsx:670-677`) tells `'paid'` guests *"Booking Confirmed!"*; `hooks/useCreateReelForm.ts:1235-1242` inserts `type: 'booking_request'` when a listing reel is published.

### 10.3 Failed Email & Push Delivery Handling — `Not implemented`
- `dispatch-notification` (`lines 422-486`) catches Expo gateway errors and returns `{ dispatched: 0, skippedReason: 'expo_gateway_error' }`; it never polls `/push/getReceipts` and never chunks arrays >100 tokens (`Not implemented`).
- `send-email` (`lines 244-274`) performs one Resend `fetch`, logs errors to console, and returns HTTP failure to the client (`lib/queries/host.ts:196,251` swallows it with `.catch(console.warn)`). No delivery audit rows are stored (`Not implemented`).

### 10.4 Retry Mechanisms — `Not implemented` (notifications) / `Partially implemented` (payouts)
- Notifications, push, SMS, and `process-booking-refund` (`process-booking-refund/index.ts:183-201`) have **zero** retry or backoff queues (`Not implemented`).
- `process-host-payouts/index.ts:125-154` implements exponential backoff (`1h`, `2h`, `4h` up to `max_retries = 3`), **but** has no cron job to re-run it and emits no alert when all 3 attempts fail (`Partially implemented`).

### 10.5 Realtime Subscription Cleanup & Channel Issues — `Already implemented` (manager) / `Partially implemented` (filters)
- `lib/realtimeManagerCore.ts` cleanly manages ref-counting, generation topics, NetInfo/AppState reconnection, and `teardownAll()` on sign-out (`Already implemented`).
- Risks (`Partially implemented`): `InboxScreen`, `useUnreadMessageCount`, `useMyBookings`, and `useHostBookings` subscribe to `conversations`, `messages`, and `bookings` **without** `filter` parameters, increasing RLS evaluation load and spurious invalidations; three concurrent `notifications` bindings run when viewing Trips/Host Bookings; `app/chat/[id].tsx:127` clears all `temp-` messages on any `INSERT`; `useMarkMessagesRead` (`lib/queries/messages.ts:417-420`) fails to invalidate `['conversations']`.

### 10.6 Device-Token Lifecycle — `Partially implemented`
- `AuthContext.signOut` (`context/AuthContext.tsx:480`) calls `deactivatePushToken(userId)`, deactivating **all** devices for that user (`services/notificationService.ts:429`) (`Partially implemented`).
- `register_device_push_token` (`202608130011:76`) upserts on `(user_id, push_token)` without deactivating matching `push_token` rows belonging to prior accounts on the same physical phone (cross-account push bleed) (`Partially implemented`).
- Missing `Notifications.addPushTokenListener`, `Notifications.addNotificationReceivedListener`, and `expo-device` physical-device guard (`Not implemented`).

### 10.7 Scheduled Reminder & Payout Worker Capabilities — `Not implemented` / `Partially implemented`
- Zero `pg_cron` or CI/EAS schedulers exist in repo (`Not implemented`).
- **Payout Cancellation Bug (`process-host-payouts/index.ts:74-84`) (`Partially implemented`):** `schedule_pending_host_payouts` (`202611150001:165-262`) sets `scheduled_for = checked_in_at + 24h`, which for multi-night stays occurs *before* `check_out`. Because `complete_due_bookings()` (`202608180002:708-727`) only sets `status = 'completed'` when `check_out <= now()`, running `process-host-payouts` mid-stay hits `booking?.status !== 'completed'` and **permanently sets `host_payouts.status = 'cancelled'`**.

### 10.8 Booking Cancellation & Rescheduling Handling — `Partially implemented` / `Not implemented`
- `guest_cancel_booking` (`202611150001:681-717`) ignores `cancellation_policy_snapshot` and always issues a `100%` refund + full host escrow reversal (`Partially implemented`).
- `host_confirm_booking` (`202608180002:350-352`) rejects `'pending'` bookings, though `HostReservationsView` `requests` tab renders legacy `'pending'` rows alongside `'paid'` (`Partially implemented`).
- `process-booking-refund` marks Paystack `/refund` HTTP 200 as `'success'` synchronously without waiting for asynchronous settlement; un-awaited client invocations strand `'refund_pending'` bookings if the request drops (`Partially implemented`).
- Rescheduling is `Not implemented`.

### 10.9 Timezone Handling — `Partially implemented` (broken stay date math & SQL type bug)
- Neither `profiles` nor `experiences` stores an IANA `timezone` column (`Not implemented`).
- Check-in RPCs (`202611150001:316,436`) and `reservationHelpers.ts:46-61` hardcode `Africa/Nairobi` (`UTC+3`), whereas `NotificationCenterScreen`, `NotificationCard`, `NativeChatScreen`, and `zuruPlanService` use device-local `Date` (`Partially implemented`).
- **UTC Date-Shift Bug (`hooks/useBookingCheckout.ts:803-824`, `components/booking/bookingHelpers.ts:42-46`, `components/booking/categoryFlowConfig.ts:100-134`) (`Partially implemented`):** Building local midnight in `UTC+3` and calling `.toISOString()` shifts dates backward (`2026-11-22T00:00:00+03:00` -> `2026-11-21T21:00:00Z`), causing Postgres `::date` casts to evaluate as `2026-11-21` (**-1 day**). `app/host/calendar.tsx:210-211` similarly compares `.split('T')[0]` (UTC) against local `todayISO`.
- **SQL Type Crash (`202611150004:166,175`) (`Partially implemented`):** `create_booking_quote` selects `events.end_time` (`text` per `202611150003:9`) into `v_event_end_at timestamptz`, raising a PostgreSQL syntax error whenever `events.end_time` contains a clock string like `'23:30'`.

### 10.10 Authentication & RLS Security Cross-References — `Partially implemented`
- Preference suppression (`send-email`, `dispatch-notification`), unauthenticated `process-personal-data-export`, broken `cleanup-personal-data-exports`, raw HTML injection via `send-email`, notification spoofing in `send_notification` / `dispatch-notification`, and `metadata->>'host_id'` ownership mismatches directly affect reliability and trust (`Partially implemented`; detailed in **Section 11**).

---

## 11. Security and RLS Findings

1. **CRITICAL — Unauthenticated `process-personal-data-export` (`supabase/config.toml:49-50`, `supabase/functions/process-personal-data-export/index.ts:235-261`):** `Already implemented` vulnerability. `verify_jwt = false` AND zero `Authorization`, `CRON_SECRET`, or `service_role` check in code. Anyone knowing `(request_id, user_id)` can trigger full 12-table archive generation and Resend email dispatch.
2. **HIGH — Broken Auth Import in `cleanup-personal-data-exports` (`supabase/functions/cleanup-personal-data-exports/index.ts:3,27`):** `Partially implemented`. Imports non-existent `requireWorkerAuth` from `../_shared/workerAuth.ts` (which exports `authorizeWorkerOrAdmin`), causing runtime crashes.
3. **MEDIUM — Client-Supplied Raw HTML in `send-email` (`supabase/functions/send-email/index.ts:144-186`):** `Already implemented` behavior. Any authenticated booking guest or host can pass arbitrary `subject` and `html` to email the counterparty, enabling template spoofing/phishing.
4. **MEDIUM — Notification Type Spoofing & Relationship Bypass (`202611020001:462` vs `dispatch-notification/index.ts:12-17,123-160`):** `Partially implemented`.
   - `send_notification` RPC only blocks `('payment_success', 'payout_completed', 'refund_processed', 'verification_approved')`, allowing related users to forge `'verification'`, `'booking_confirmed'`, `'booking_request'`, `'arrival_issue_reported'`, or `'listing_approved'` (`Partially implemented`).
   - `dispatch-notification/index.ts:153-160` lets *any* user send `SOCIAL_TYPES` notifications to *any* user who has ever published a reel (`reels.user_id = recipientId`), without proving an actual like/comment/follow (`Partially implemented`).
   - `dispatch-notification/index.ts:126` queries non-existent table `'follows'` instead of `public.user_follows` (`202608030001:39`, `202611020001:485`) (`Partially implemented`).
5. **MEDIUM — Plaintext OTP Logged When `RESEND_API_KEY` Missing (`supabase/functions/request-personal-data/index.ts:48`):** `Already implemented` logging behavior. Logs 6-digit OTPs to Edge Function stdout when `RESEND_API_KEY` is unset.
6. **MEDIUM — Host Ownership Mismatch (`lib/queries/host.ts` vs `202608130003:7-42`):** `Partially implemented`. `useHostBookings` matches `experiences.user_id` OR `experiences.metadata->>'host_id'`, whereas `is_booking_host` and `block_host_dates` only authorize `experiences.user_id` / `booking_quotes.host_id`.
7. **LOW / VERIFICATION — Missing `CHECK` Constraints, Residual `anon` Grant & `events` RLS:** `Partially implemented` / `Requires further verification`.
   - `202608140001:73-81` dropped all `CHECK` constraints on `public.notifications` (`Already implemented` schema state).
   - `202608130010:59` retains `GRANT SELECT ON public.user_devices TO anon;` (mitigated by `TO authenticated` RLS policy) (`Already implemented` residual grant).
   - `202611140001:14-37` creates `public.events` without `ENABLE ROW LEVEL SECURITY` (`Requires further verification` in live DB).
   - `supabase/functions/_shared/rateLimiter.ts:1-81` fails open if Upstash Redis is unconfigured or unreachable (`Partially implemented`).
8. **Positive Controls Verified (`Already implemented`):** Paystack HMAC-SHA512 + `/transaction/verify` (`paystack-webhook/index.ts:21-41,113-156`), Persona HMAC-SHA256 with 300s replay window (`persona-webhook/index.ts:39-81`), `trg_guard_profile_privileged_columns` & `service_role` settlement locks (`202611020001`), `REVOKE INSERT, UPDATE, DELETE ON public.bookings` (`202608180002:94`), and tightened `notifications_insert_policy` (`WITH CHECK (user_id = auth.uid())`, `202611020001:426-430`).

---

## 12. Recommended Architecture Using Existing Infrastructure

To satisfy all 11 target requirements (`R4`) while maximizing reuse of existing ZuruSasa infrastructure (`public.notifications`, `public.user_devices`, `public.profiles.notification_settings`, `public.booking_lifecycle_events`, Expo Push, Resend, Africa's Talking, and `_shared/workerAuth.ts`), adopt an **Event-Driven Outbox & Unified Notification Orchestrator** architecture:

### 12.1 Core Architectural Principles
1. **Single Server-Side Entry Point (`send-notification` / upgraded `dispatch-notification`):**
   - Refactor `dispatch-notification` (or introduce an internal `_shared/notificationOrchestrator.ts` used by Edge Functions + a `CRON_SECRET`/`service_role`-enabled worker) so **no booking, payment, refund, payout, cancellation, or KYC push/email depends on the mobile client**.
   - Lock `send-email` so non-admin clients **cannot** pass raw `subject`/`html`; all transactional emails must reference a server-side `templateKey` + validated data/record lookup.
2. **Database Outbox / Queue Driven by Authoritative Events:**
   - SQL RPCs (`settle_paystack_success`, `host_confirm_booking`, `host_decline_booking`, `guest_cancel_booking`, `host_check_in_booking`, `guest_check_in_booking`, `report_booking_arrival_issue`, `submit_booking_review`), Edge Functions (`create-booking-payment` free-entry, `paystack-webhook`, `process-booking-refund`, `process-host-payouts`, `persona-webhook`, `verify-persona-inquiry`, `request-personal-data`), and a `AFTER INSERT` trigger on `public.messages` enqueue a canonical event into `notification_deliveries` (or insert into `notifications` + `notification_deliveries` via a single SQL helper `enqueue_notification_event(...)`).
   - A `pg_cron` job (e.g., every 1 minute via `pg_net` calling a worker Edge Function authenticated by `CRON_SECRET`) drains pending/retryable deliveries, processes 24h & 1h scheduled reminders, and polls Expo Push Receipts.
3. **Critical vs. Preference-Governed Policy:**
   - Classify every `templateKey` into one of three tiers:
     - **`critical` (cannot be opted out of in-app or core transactional email/push):** Payment receipts (`payment_success`), payment failures (`payment_failed`), booking confirmations (`booking_confirmed`, instant & host-accepted), host new-booking alerts (`booking_request`), cancellations (`booking_cancelled`, `booking_declined`), refunds (`refund_processed`), payout completed/failed (`payout_completed`, `payout_failed`), KYC decisions (`verification_approved`, `verification_declined`), arrival issues (`arrival_issue_reported`), and security/data-export OTPs. **Always attempt `in_app` + `push` (if active token exists) + `email` (Resend)**.
     - **`transactional_optional` (maps to `notifications.priority = 'normal'`; respects per-channel `notification_settings`):** Chat messages (`message` -> `messages`), pre-arrival reminders (`booking_reminder_24h`, `booking_reminder_1h`, `zuruplan_reminder` -> `reminders`), check-in alerts (`booking_checked_in` -> `account_activity`), and review prompts (`review_reminder` -> `reminders`).
     - **`promotional` (strictly separate opt-in):** Special offers, price drops, and campaigns (`promotion`, `wishlist_available` -> `all_offers` / `offers_*`). **Blocked unless `marketing_opt_in = true`** (explicit opt-in), with one-click unsubscribe token + Resend `List-Unsubscribe` headers.
4. **Centralized Server-Side Templates (`supabase/functions/_shared/templates/`):**
   - Consolidate all templates (`host_welcome`, `booking_confirmed`, `booking_cancelled`, `booking_request`, `payment_receipt`, `payment_failed`, `refund_processed`, `payout_completed`, `payout_failed`, `reminder_24h`, `reminder_1h`, `zuruplan_reminder`, `kyc_approved`, `kyc_declined`, `new_message_digest`, `data_export_otp`, `data_export_ready`, `promotional_offer`) on the server with localized/escaped HTML + plain-text `text` fallback and dynamic deep-link payloads (`action_type`, `action_id`, route).
5. **Independent Channel Delivery Tracking, Idempotency & Retries:**
   - Every notification event produces one `public.notifications` row (when `in_app` applies) keyed by `dedupe_key` (`<event_type>:<entity_id>:<recipient_id>:<window>`) and independent child rows in `public.notification_deliveries` for `push`, `email`, and `sms`.
   - **Expo Push:** Chunk batches to `<= 100` messages per POST to `/push/send`, persist `expo_ticket_id`, poll `/push/getReceipts` after 15 minutes, deactivate `DeviceNotRegistered` tokens, and retry 429/5xx with exponential backoff (`1m`, `5m`, `15m`, `1h`, `max_attempts = 5`).
   - **Resend Email:** Persist `provider_message_id` (`id` from Resend), support optional Resend webhook updates (`delivered`, `bounced`, `complained`), and retry transient 429/5xx failures with backoff.
6. **24-Hour & 1-Hour Booking & ZuruPlan Reminders + Timezone Integrity:**
   - Store IANA `timezone` on `experiences` (default `'Africa/Nairobi'`) and `profiles` (default `'Africa/Nairobi'`).
   - Fix stay date serialization on client/RPC so `check_in`/`check_out` combine listing `check_in_time` / `check_out_time` in the listing's IANA timezone when computing UTC `timestamptz`.
   - A `pg_cron` job (every 5–10 minutes) queries confirmed, un-cancelled, un-checked-in `bookings` where `effective_start_at - interval '24 hours'` or `'1 hour'` falls within the due window and enqueues `booking_reminder_24h` / `booking_reminder_1h` with `dedupe_key = 'reminder_24h:' || booking_id || ':' || user_id` (guest & host). For ZuruPlan, normalize saved trip reminders (either via a lightweight `trip_reminders` schedule or local + server sync) using the user's `profiles.timezone`.
7. **Client Synchronization & Deduplication:**
   - Add `Notifications.addPushTokenListener`, `expo-device` check, single `registerPushToken` call site, token-scoped `deactivatePushToken(userId, currentToken)`, and foreground suppression so `GlobalNotificationSubscriber` skips `presentLocalNotification` when the app received a remote Expo push (via `addNotificationReceivedListener` dedupe cache of recent `notification_id`s) or when `AppState.currentState === 'active'` and remote push already displays.
   - Update `hooks/useNotifications.ts` type sets to match all canonical types and wire `NotificationCard` delete + tap deep-linking for all `action_type`s.

---

## 13. Proposed Database Changes, Only Where Necessary

Existing tables (`public.notifications`, `public.user_devices`, `public.profiles`, `public.booking_lifecycle_events`, `public.payment_events`, `public.host_payouts`, `public.refund_requests`) cover ~75% of the required schema. Only minimal, strictly necessary additions are proposed:

### 13.1 Reuse Existing Tables with Minimal Column/Constraint Additions

1. **`public.notifications` (Reuse existing table — add idempotency & priority):**
   - **Proposed changes:**
     - `ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key text;`
     - `CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_key ON public.notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;`
     - `ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical', 'normal', 'promotional'));` (where `'normal'` maps to the `transactional_optional` policy tier in Section 12.1)
   - **Why strictly necessary:** Eliminates duplicate `refund_processed` and concurrent `payment_success` inserts atomically at the DB layer without breaking existing client queries or `trg_sync_notifications_columns`.
2. **`public.user_devices` (Reuse existing table — fix cross-account push leak & staleness):**
   - **Proposed changes:**
     - `ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now(), ADD COLUMN IF NOT EXISTS app_version text, ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0;`
     - Update `register_device_push_token` RPC (`202608130011`) to execute `UPDATE public.user_devices SET is_active = false, updated_at = now() WHERE push_token = p_push_token AND user_id <> v_user_id AND is_active = true;` before upserting `(v_user_id, p_push_token)`.
     - `REVOKE SELECT ON public.user_devices FROM anon;` (clean up `202608130010:59`).
   - **Why strictly necessary:** Prevents cross-account push leaks on shared/reinstalled devices and tracks token health.
3. **`public.profiles` & `public.experiences` (Reuse existing tables — timezone & promotional consent):**
   - **Proposed changes:**
     - `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Nairobi', ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz, ADD COLUMN IF NOT EXISTS marketing_opt_out_at timestamptz;`
     - `ALTER TABLE public.experiences ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Nairobi';`
     - Continue reusing `profiles.notification_settings` JSONB (fixing defaults via server-side merge/SQL default rather than creating a redundant `notification_preferences` table, unless relational analytics require one later).
   - **Why strictly necessary:** Accurate 24h/1h reminders cannot be computed from UTC dates without listing/user IANA timezones, and GDPR/Kenya DPA 2019 require explicit, auditable promotional opt-in timestamps separate from transactional `notification_settings`.
4. **`public.bookings` (Reuse existing table — reminder/reschedule safety):**
   - **Proposed changes (only when implementing reminders/rescheduling):**
     - `ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz, ADD COLUMN IF NOT EXISTS reminder_1h_sent_at timestamptz;` (or track solely via `notifications.dedupe_key` — keeping columns on `bookings` or using `notification_deliveries` avoids table bloat; `dedupe_key` on `notifications` + `notification_deliveries` can actually eliminate needing columns on `bookings`!).
     - Fix `create_booking_quote` (`202611150004:166-175`) cast bug (`events.end_time` `text` -> combined `event_date` + `end_time` time conversion) and enable RLS on `public.events` (`202611140001`).

### 13.2 New Tables Strictly Required

1. **`public.notification_deliveries` (Strictly necessary — independent channel tracking, retries & receipts):**
   - **Columns:** `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL`, `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `channel text NOT NULL CHECK (channel IN ('in_app', 'push', 'email', 'sms'))`, `template_key text NOT NULL`, `priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('critical', 'normal', 'promotional'))`, `dedupe_key text NOT NULL`, `payload jsonb NOT NULL DEFAULT '{}'::jsonb`, `status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed', 'skipped', 'dead_letter'))`, `provider text`, `provider_message_id text`, `expo_ticket_id text`, `receipt_checked_at timestamptz`, `attempt_count integer NOT NULL DEFAULT 0`, `max_attempts integer NOT NULL DEFAULT 5`, `next_retry_at timestamptz NOT NULL DEFAULT now()`, `last_error text`, `sent_at timestamptz`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.
   - **Constraints & Indexes:** `UNIQUE (dedupe_key, channel)`, partial index on `(status, next_retry_at)` where `status IN ('pending', 'failed')`, partial index on `(expo_ticket_id)` where `channel = 'push' AND status = 'sent' AND receipt_checked_at IS NULL`.
   - **RLS:** Enable RLS; server/`service_role` writes only (revoke `anon`, `authenticated` writes); optional `SELECT` for `user_id = auth.uid()` if delivery history is ever surfaced, or keep strictly `service_role`-only like `public.payment_events`.
   - **Why strictly necessary:** `public.notifications` is a 1-row-per-user inbox feed and cannot independently track 3–4 delivery channels (`push`, `email`, `sms`, `in_app`), Expo ticket receipt polling, Resend message IDs, or per-channel retry backoff.
2. **Optional / Deferred (`zuruplan_reminders` only if ZuruPlan moves server-side):**
   - Currently ZuruPlan itineraries live in `profiles.metadata.saved_trips`. Either store lightweight reminder schedules in a small `public.trip_reminders` table (`user_id`, `trip_id`, `title`, `remind_at timestamptz`, `sent_at`) when Phase 4 enables server-pushed ZuruPlan alerts, or schedule local `expo-notifications` triggers on-device.

### 13.3 Required Extensions & Scheduled Jobs (`pg_cron` + `pg_net`)
- Enable `pg_cron` and `pg_net` in Supabase migrations and register scheduled jobs (calling Edge Functions with `CRON_SECRET` stored in Supabase Vault):
  1. `process-notification-queue` (every 1 minute): Claims pending/retryable `notification_deliveries` and checks Expo Push Receipts.
  2. `process-booking-reminders` (every 5 minutes): Scans upcoming bookings for 24h and 1h reminders.
  3. `process-host-payouts` (every 15 minutes): Runs `complete_due_bookings()` and due Paystack transfers.
  4. `process-booking-refund-batch` (every 15 minutes): Recovers stranded `pending`/`failed` `refund_requests`.
  5. `expire-booking-quotes` (every 5 minutes) & `cleanup-personal-data-exports` (daily).

---

## 14. Recommended Phased Implementation Plan

### Phase 0 — Immediate Security & Correctness Hotfixes (P0)
- **Scope:**
  1. Secure `supabase/functions/process-personal-data-export/index.ts` with `authorizeWorkerOrAdmin` (or `CRON_SECRET`/`service_role` check).
  2. Fix broken `requireWorkerAuth` import in `supabase/functions/cleanup-personal-data-exports/index.ts:3,27` -> `authorizeWorkerOrAdmin`.
  3. Fix `create_booking_quote` SQL runtime crash (`202611150004:166,175`) on `events.end_time` (`text` -> `timestamptz`) and verify/add RLS on `public.events`.
  4. Remove plaintext OTP console logging in `request-personal-data/index.ts:48`, gate `"Test Banner"` / `"Test Push Banner"` / `"Re-verify"` behind `__DEV__`, and revoke `anon` `SELECT` on `user_devices`.
  5. Fix `process-host-payouts/index.ts:74-84` so non-completed checked-in bookings defer `scheduled_for` to `check_out + 24h` instead of permanently cancelling the payout.
  6. Fix `guest_cancel_booking` (`202611150001:681-717`) to honor `cancellation_policy_snapshot` (flexible/moderate/strict tiers), and fix `useHostConfirmBooking` date mapping (`check_in`/`check_out` instead of `start_date`/`end_date`) + `BookingSuccessModal` `'paid'` vs `'confirmed'` copy.
- **Dependencies:** None.
- **Verification Gate:** Security review of Edge Function auth, SQL migration dry-run on staging, unit tests on refund calculation and `events.end_time` quotes.
- **Rollback:** Revert individual Edge Function deployments or SQL function definitions.

### Phase 1 — Core Database Schema, Centralized Templates & Unified Worker (P1)
- **Scope:**
  1. Add `dedupe_key` + `priority` to `public.notifications`, timezone/marketing columns to `public.profiles` and `public.experiences`, cross-account `push_token` deactivation in `register_device_push_token`, and create `public.notification_deliveries`.
  2. Build `supabase/functions/_shared/templates/` (HTML + plain text for all transactional & reminder templates) and `supabase/functions/process-notification-queue/index.ts` (Expo Push 100-item batching, receipt polling, Resend delivery, exponential backoff retries, critical-vs-preference policy).
  3. Lock `send-email` against raw client HTML (`templateKey` allowlist only) and harden `dispatch-notification` / `send_notification` (`user_follows` fix, stricter relationship & `PRIVILEGED_ONLY_TYPES` checks).
- **Dependencies:** Phase 0; Supabase Vault secrets (`CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` on verified domain).
- **Verification Gate:** Integration tests proving idempotent `dedupe_key`, independent `notification_deliveries` states (`push`, `email`, `in_app`), critical bypass of non-essential opt-outs, and Expo receipt handling.
- **Rollback:** Additive schema columns/table are non-breaking; disable `pg_cron` worker job if regression occurs.

### Phase 2 — Complete Workflow Event Wiring & Cron Automation (P1)
- **Scope:**
  1. Wire server-side event emission into: `paystack-webhook` (branching on `booking_mode = 'instant'` vs `'approval_required'`, `charge.failed`, and deduplicated `refund.processed`), `create-booking-payment` (`amount === 0` free-entry), `host_confirm_booking`, `host_decline_booking`, `guest_cancel_booking`, `process-booking-refund`, `process-host-payouts` (success + exhausted-retry failure alert), `persona-webhook` / `verify-persona-inquiry` (KYC approved/declined), and `AFTER INSERT ON public.messages` trigger (push + optional offline email digest).
  2. Remove unreliable client-side push/email firing from `lib/queries/host.ts` (`useHostConfirmBooking`, `useHostDeclineBooking`).
  3. Register `pg_cron` + `pg_net` schedules for `process-notification-queue`, `process-host-payouts`, `process-booking-refund`, `expire_booking_quotes`, and `cleanup-personal-data-exports`.
- **Dependencies:** Phase 1.
- **Verification Gate:** End-to-end staging tests across all 9 workflows confirming 1 in-app row + 1 push + 1 email (zero duplicates on webhook retries) and scheduled payout/refund execution.
- **Rollback:** Restore legacy client fallback calls behind a feature flag if server queue stalls.

### Phase 3 — Client Push, In-App UI, Preferences & Realtime Fixes (P2)
- **Scope:**
  1. Fix `hooks/useNotifications.ts` type allowlists (`booking_declined`, `booking_checked_in`, `arrival_issue_reported`, `payment_failed`, `booking_rescheduled`, `zuruplan_reminder`, etc.), wire `NotificationCard` `onDelete` and `'refund_processed'` icon, and remove unused dead components or integrate them.
  2. Fix `NotificationPreferencesScreen` (`app/profile/notifications.tsx`): make `all_offers` toggle all 11 child offer keys, persist explicit defaults on user signup, separate promotional opt-in consent (`marketing_opt_in`), and align all 18 UI keys with server preference mapping (or simplify UI to supported categories).
  3. Fix push lifecycle: add `expo-device`, deduplicate `registerPushToken` call sites, add `addPushTokenListener`, scope `deactivatePushToken` to the current `push_token`, complete tap deep-linking for `payout`/`listing`/`profile`/`support`, and prevent duplicate foreground local+remote banners.
  4. Add `filter` parameters to `InboxScreen` / `useMyBookings` / `useHostBookings` Realtime channels where supported, fix `NativeChatScreen` optimistic `temp-` wipe and `read_receipts` privacy enforcement, and link `app/profile/payments.tsx` to `app/host/wallet.tsx`.
- **Dependencies:** Phase 1 & Phase 2.
- **Verification Gate:** Jest unit tests + device QA on iOS & Android dev builds (foreground, background, killed state, logout/account-switch).
- **Rollback:** OTA EAS Update (`eas-update`) for JS-only fixes.

### Phase 4 — 24h & 1h Reminders, Timezone Fixes, ZuruPlan & Booking Rescheduling (P2/P3)
- **Scope:**
  1. Fix UTC stay-date shifting (`hooks/useBookingCheckout.ts`, `bookingHelpers.ts`, `categoryFlowConfig.ts`, `app/host/calendar.tsx`) by combining `check_in_time`/`check_out_time` with the listing's IANA `timezone`.
  2. Implement `pg_cron` 24-hour and 1-hour pre-arrival reminder scanner for `bookings` (guest & host) and ZuruPlan itinerary reminders (`trip_reminders` or local scheduled notifications), plus real `JourneyCompanionSheet` ETA sharing via `messages`.
  3. Design and implement `request_booking_reschedule` / `respond_booking_reschedule` RPCs (if product-approved) with GiST availability re-validation, price-delta handling, and `booking_rescheduled` multi-channel notifications.
- **Dependencies:** Phases 1–3.
- **Verification Gate:** Timezone boundary tests (`UTC+3` midnight/noon check-ins), reminder deduplication tests under repeated cron ticks, and full reschedule conflict tests.
- **Rollback:** Disable reminder cron jobs independently; reschedule RPCs can be feature-flagged in UI.

---

## Conclusion & Next Steps

This audit confirms that ZuruSasa already possesses core building blocks (`public.notifications`, `public.user_devices`, `booking_lifecycle_events`, Paystack escrow/ledger/payouts, `dispatch-notification`, `send-email`, `RealtimeSubscriptionManager`, and `app/profile/notifications.tsx`), **but** suffers from fragmented client/server dispatch, missing cron automation, missing push/email coverage on critical payment/booking/KYC/reminder events, duplicate `refund_processed` risks, preference/filter disconnects, and timezone date-shift bugs.

No repository files, database objects, environment variables, packages, or Edge Functions have been modified during this audit. **Please review these findings and confirm approval before proceeding with Phase 0 or Phase 1 implementation.**
