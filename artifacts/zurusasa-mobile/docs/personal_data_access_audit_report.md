# Personal Data Access Request and Identity Verification Workflow Audit Report

**Target System**: ZuruSasa Mobile (`artifacts/zurusasa-mobile`) & Supabase Backend  
**Audit Date**: November 8, 2026  
**Auditor**: Teamwork Personal Data Access Taskforce (`pda_worker_1`)  
**Scope**: Requirements R1–R4, Sections A through N  
**Integrity Mode**: Benchmark / Strictly Read-Only Static Analysis (Zero Code Changes, Zero Remote API Probes)  
**Deliverable File**: `docs/personal_data_access_audit_report.md`  
**Governing Frameworks**: Kenya Data Protection Act 2019 (Sections 25, 26, 40) & General Data Protection Regulation (GDPR Articles 15, 20, 30)

---

## Executive Summary

This comprehensive audit evaluates the ZuruSasa mobile application and Supabase Edge Functions infrastructure to prepare for implementing a production-grade **Personal Data Access Request and Identity Verification** workflow under `Settings → Privacy & Data → Request My Personal Data` (`app/profile/privacy.tsx`).

### Current Production State vs. Feature Maturity

| Domain | Implemented Repository Status | Verification Level | Critical Gap / Architectural Reality |
|---|---|---|---|
| **Registration & Sign-In** | Implemented: Google OAuth, Email OTP, Phone OTP, Passkeys (`app/auth.tsx`, `hooks/useAuthScreenFlow.ts`) | Mixed (Email confirmed via GoTrue OTP; Phone OTP confirmed only if used at sign-in) | Profile creation auto-inserts unverified fields (`context/AuthContext.tsx:104-138`). `services/authService.ts` does not exist; logic is in hooks and context. |
| **Session & Token Storage** | Implemented: `@supabase/supabase-js` v2.110.7 with `@react-native-async-storage/async-storage` v2.2.0 (`lib/supabase.ts:60-73`) | Plaintext mobile sandbox storage | `expo-secure-store` is **not installed** in `package.json`. Tokens reside in unencrypted device storage. |
| **Recent Auth Timestamp** | Supabase Auth provides `user.last_sign_in_at` and JWT `auth_time`/`amr`/`aal` claims | **Not checked anywhere** in client or Edge Functions | No re-authentication, step-up challenge, or session freshness verification exists in the codebase. |
| **Email/Phone Changes** | Implemented in `app/profile/info.tsx` and `hooks/useAuthScreenFlow.ts` | **Unverified client updates** | In `app/profile/info.tsx`, editing `email` is silently dropped (`handleSaveField`). Editing `phone` updates `profiles.phone` directly without SMS challenge. |
| **Email Delivery** | Implemented: Dual-path (Supabase GoTrue for Auth OTP; Resend REST API in `supabase/functions/send-email/index.ts` for app emails) | Server-side verified via JWT and authoritative user lookup | No dedicated data export verification template exists. Using `signInWithOtp` for data requests risks active session pollution. |
| **SMS Delivery** | Implemented: Africa's Talking in `supabase/functions/dispatch-notification/index.ts` and `services/smsService.ts` | Dispatches SMS; does **not** verify identity | `public.profiles.phone` cannot be trusted as an identity verification factor. Twilio is **not present** in the repository. |
| **Passkey Support** | Implemented: `react-native-passkey` v3.6.1 + Supabase Auth WebAuthn in `services/passkeyService.ts` and `app/profile/security.tsx` | True asymmetric cryptographic authentication | Device biometrics (`expo-local-authentication`) are **not installed**. Passkey provides cryptographic assertions ideal for 1-tap step-up re-auth. |
| **Personal Data Inventory** | 20 relational tables identified across 33 database migrations (`supabase/migrations/`) | Authenticated user foreign keys | Standalone tables for `zuru_plans` and `saved_listings` do not exist. ZuruPlans are stored in `profiles.metadata.saved_trips`. |
| **Data Request UI** | Entry point in `app/profile/privacy.tsx:324-342` | **Inert UI Stub** | Clicking button executes a mock 800ms `setTimeout` and triggers a static `Alert.alert` (`app/profile/privacy.tsx:105-114`). |
| **Export Infrastructure** | Database tables, private storage bucket, and async workers | **Completely Missing** | Tables `personal_data_requests` and `personal_data_audit_logs`, bucket `personal-data-exports`, and export workers do not exist. |

---

## Table of Contents

1. [Section A: Existing Authentication Architecture](#section-a-existing-authentication-architecture)
2. [Section B: Email Verification Capabilities](#section-b-email-verification-capabilities)
3. [Section C: SMS Verification Capabilities](#section-c-sms-verification-capabilities)
4. [Section D: Passkey Support Status](#section-d-passkey-support-status)
5. [Section E: Personal Data Inventory, Tables, and Storage Locations](#section-e-personal-data-inventory-tables-and-storage-locations)
6. [Section F: Existing Reusable Edge Functions and Services](#section-f-existing-reusable-edge-functions-and-services)
7. [Section G: Missing Infrastructure](#section-g-missing-infrastructure)
8. [Section H: Security Gaps and Threat Model](#section-h-security-gaps-and-threat-model)
9. [Section I: Recommended Architecture](#section-i-recommended-architecture)
10. [Section J: Exact Files Requiring Modification or Addition](#section-j-exact-files-requiring-modification-or-addition)
11. [Section K: Proposed Database Migrations and RLS Policies](#section-k-proposed-database-migrations-and-rls-policies)
12. [Section L: Required Environment Variables and External Services](#section-l-required-environment-variables-and-external-services)
13. [Section M: Estimated Implementation Complexity Breakdown](#section-m-estimated-implementation-complexity-breakdown)
14. [Section N: Phased Implementation Plan](#section-n-phased-implementation-plan)
15. [Final Recommendation: Safest and Smallest Production-Ready Implementation](#final-recommendation-safest-and-smallest-production-ready-implementation)

---

## Section A: Existing Authentication Architecture

### 1. Registration and Sign-in Flows

The primary authentication screen is located at `app/auth.tsx` (lines 31–438), driven by the controller hook `hooks/useAuthScreenFlow.ts` (lines 1–512), consuming `context/AuthContext.tsx` (lines 1–280) and `lib/supabase.ts` (lines 1–105).

#### Auth Entry Points and Handlers
- **Screen UI**: `app/auth.tsx` presents a multi-step modal flow:
  - `landing`: Presents options for Google Sign-In, Passkey, Email OTP, and Phone OTP (lines 235–276).
  - `phone` & `otp`: Phone number entry and 6-digit SMS OTP input (`components/auth/PhoneStep.tsx`, `components/auth/OtpStep.tsx`).
  - `email` & `email_otp`: Email entry and 6-digit email code input (`components/auth/EmailStep.tsx`, `components/auth/OtpStep.tsx`).
  - `profile` & `commitment`: For new users whose `profiles.full_name` is null, prompts for First Name, Last Name, Date of Birth, and Email (`components/auth/ProfileFlowScreen.tsx`).
- **Hook Controller**: `hooks/useAuthScreenFlow.ts`:
  1. **Google Sign-In**:
     - *Native Android*: `signInWithGoogleNatively()` (`lib/googleNative.ts:26-120`) invokes `@react-native-google-signin/google-signin` v16.1.2 using Google Play Services. It acquires a Google ID Token minted for `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` and passes it to Supabase via `supabase.auth.signInWithIdToken({ provider: 'google', token: native.idToken })` (`hooks/useAuthScreenFlow.ts:397-408`).
     - *WebBrowser OAuth Fallback*: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: Linking.createURL('/auth'), skipBrowserRedirect: true } })` followed by `WebBrowser.openAuthSessionAsync(data.url, redirectTo)` (`hooks/useAuthScreenFlow.ts:416-453`). It handles token retrieval either via URL hash fragment (`access_token`, `refresh_token` into `supabase.auth.setSession`) or PKCE query code (`supabase.auth.exchangeCodeForSession(code)`).
  2. **Email OTP**:
     - Initiated via `sendOtp(email.trim().toLowerCase())` (`hooks/useAuthScreenFlow.ts:313`), delegating to `context/AuthContext.tsx:232-238`:
       ```typescript
       // context/AuthContext.tsx:232-238
       const sendOtp = useCallback(async (email: string) => {
         const { error } = await supabase.auth.signInWithOtp({
           email,
           options: { shouldCreateUser: true },
         });
         return { error: error ? error.message : null };
       }, []);
       ```
     - Verified via `verifyOtp(email, emailOtp)` (`hooks/useAuthScreenFlow.ts:332-335`), delegating to `context/AuthContext.tsx:240-247`:
       ```typescript
       // context/AuthContext.tsx:240-247
       const verifyOtp = useCallback(async (email: string, token: string) => {
         const { error } = await supabase.auth.verifyOtp({
           email,
           token,
           type: 'email',
         });
         return { error: error ? error.message : null };
       }, []);
       ```
  3. **Phone OTP**:
     - Initiated via `supabase.auth.signInWithOtp({ phone: fullPhoneNumber })` (`hooks/useAuthScreenFlow.ts:246-248`).
     - Verified via `supabase.auth.verifyOtp({ phone: fullPhoneNumber, token: otp, type: 'sms' })` (`hooks/useAuthScreenFlow.ts:292-296`).
     - Resend supports WhatsApp fallback via `supabase.auth.signInWithOtp({ phone: fullPhoneNumber, options: { channel: 'whatsapp' } })` (`hooks/useAuthScreenFlow.ts:267-271`).
  4. **Passkey Authentication**:
     - Initiated via `passkeyService.signIn()` (`hooks/useAuthScreenFlow.ts:462-487`, `services/passkeyService.ts:195-314`).
- **Profile Initialization**:
  - `context/AuthContext.tsx:104-138`: When a user signs in, if no record is found in `public.profiles` for `resolvedUser.id`, an initial profile row is inserted directly from the client (`{ id: userId, full_name, email: resolvedUser.email, role: 'guest', metadata }`).
  - `hooks/useAuthScreenFlow.ts:144-156`: If `profile.full_name` is missing, the user is redirected to `step = 'profile'` to complete legal details before proceeding to the home feed.
- **Architectural Note on `services/authService.ts`**: The codebase does **not** contain a file named `services/authService.ts`. Authentication functions are distributed across `lib/supabase.ts`, `context/AuthContext.tsx`, `hooks/useAuthScreenFlow.ts`, `services/passkeyService.ts`, and `lib/googleNative.ts`.

---

### 2. Session Management, Token Handling, Refresh Tokens, and Persistence

#### Client Initialization & Configuration
In `lib/supabase.ts` (lines 60–73):
```typescript
// lib/supabase.ts:60-73
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    experimental: {
      passkey: true,
    },
  },
  global: {
    fetch: customFetchWithTimeout,
  },
});
```

#### Storage Implementation (AsyncStorage vs. SecureStore)
- The mobile app explicitly imports `@react-native-async-storage/async-storage` v2.2.0 (`lib/supabase.ts:2`, `package.json:23`).
- `AsyncStorage` persists session tokens (Supabase JWT access token and refresh token) into unencrypted XML/SQLite files in the application's private app directory (`/data/data/com.zurureels.app/databases` on Android).
- **Security Finding**: `expo-secure-store` is **not installed** in `package.json` (lines 16–71). Hardware-backed keystore/keychain storage is not used for session tokens. While protected by Android/iOS application sandbox permissions against non-root apps, tokens on rooted devices, jailbroken environments, or system backup images are readable in plaintext.
- **Auto-Refresh**: `autoRefreshToken: true` enables Supabase's internal timer to automatically exchange the refresh token for a new JWT before the access token expires (typically 1 hour).
- **Session Lifecycle in Context**:
  - `context/AuthContext.tsx:166-184`: On mount, calls `supabase.auth.getSession()` to rehydrate the active session from `AsyncStorage`. A 6-second timeout fails open to prevent app lockup during offline startup.
  - `context/AuthContext.tsx:185-194`: Attaches `supabase.auth.onAuthStateChange` listener to update local React state on token refresh, sign-in, and sign-out.
  - `context/AuthContext.tsx:249-258`: On sign-out, deactivates the user's push token in `user_devices` via `notificationService.deactivatePushToken(session.user.id)` and invokes `supabase.auth.signOut()`.

---

### 3. Availability and Audit of Recent Authentication Timestamps

#### Supabase Auth Capabilities vs. Codebase Reality
1. **`auth.users.last_sign_in_at`**:
   - Supabase Auth populates `last_sign_in_at` (timestamptz) whenever a user completes an authentication event (OAuth, OTP, or Passkey).
   - This timestamp is exposed on the client in `User.last_sign_in_at` (e.g., `session.user.last_sign_in_at`).
2. **Session Claims (`auth_time`, `amr`, `aal`)**:
   - The Supabase JWT decoded payload standardly contains:
     - `auth_time`: Unix epoch integer indicating when the user authenticated.
     - `amr`: Authentication Method Reference array (e.g., `[{"method": "otp", "timestamp": ...}]`, `[{"method": "oauth", ...}]`, `[{"method": "webauthn", ...}]`).
     - `aal`: Authenticator Assurance Level (`aal1` for single-factor OTP/OAuth, `aal2` for multi-factor/passkey).
3. **Repository Gap**:
   - A static search for `last_sign_in_at`, `auth_time`, `amr`, `aal`, and `reauth` across the entire codebase yields **0 matches**.
   - Neither client components (`app/profile/privacy.tsx`, `app/profile/security.tsx`) nor Edge Functions (`supabase/functions/delete-account/index.ts`, `send-email/index.ts`) perform any recent authentication check.
   - **Vulnerability**: A session persisted in `AsyncStorage` 30 days ago is treated with the exact same authority as one authenticated 30 seconds ago. There is no step-up prompt for destructive actions (e.g., account deletion, password changes) or for requesting personal data exports.

---

### 4. Account Email and Phone Change Workflows

#### Email Change Workflows
- **Onboarding Flow** (`hooks/useAuthScreenFlow.ts:366-371`):
  ```typescript
  // hooks/useAuthScreenFlow.ts:366-371
  if (email && email.trim().toLowerCase() !== user?.email?.toLowerCase()) {
    const { error: emailError } = await supabase.auth.updateUser({
      email: email.trim().toLowerCase(),
    });
    if (emailError) throw emailError;
    setStep('email_sent');
  }
  ```
  Calling `supabase.auth.updateUser({ email })` triggers Supabase Auth's built-in email verification workflow, sending confirmation links/codes before updating `auth.users.email`.
- **Settings Screen Defect** (`app/profile/info.tsx`):
  - In `app/profile/info.tsx:300-313` and lines 494–510, an "Email address" editing modal exists.
  - However, in `handleSaveField` (`app/profile/info.tsx:114-158`), `email` is **completely omitted** from the update call:
    ```typescript
    // app/profile/info.tsx:118-140
    const updates: Record<string, any> = {
      full_name: legalName.trim(),
      preferred_name: preferredName.trim() || null,
      host_display_name: hostDisplayName,
      phone: phone.trim() || null,
      residential_address: residentialAddress.trim() || null,
      postal_address: postalAddress.trim() || null,
      emergency_contact: emergencyName.trim() ? { ... } : null,
    };
    await supabase.from('profiles').update(updates).eq('id', user.id);
    await supabase.auth.updateUser({
      data: { full_name: legalName.trim(), phone: phone.trim() },
    });
    ```
  - **Defect**: When an existing user edits their email under `Settings → Personal Info` and taps "Save", the change is silently dropped. `auth.users.email` is unchanged.

#### Phone Change Workflows
- In `app/profile/info.tsx` (lines 134–140), editing the phone number executes:
  1. `supabase.from('profiles').update({ phone: phone.trim() || null }).eq('id', user.id)`
  2. `supabase.auth.updateUser({ data: { phone: phone.trim() } })`
- **Critical Security Finding**:
  - The phone number is written directly to `public.profiles.phone` and `raw_user_meta_data.phone`.
  - It does **not** call `supabase.auth.updateUser({ phone })` (which would have triggered an SMS OTP verification challenge).
  - Consequently, `auth.users.phone` remains unchanged/NULL, `auth.users.phone_confirmed_at` is **not set**, and the phone number stored in `public.profiles` is completely unverified.

---

### 5. Authentication Mechanisms Safely Reusable for Data Request Verification

The following existing mechanisms can safely be reused for the Personal Data Access Request workflow:

1. **Active JWT Verification (`verify_jwt = true`)**:
   - All private Edge Functions (`supabase/functions/send-email`, `delete-account`, `dispatch-notification`) enforce `verify_jwt = true` in `supabase/config.toml` (lines 4–45) and validate the caller via `userClient.auth.getUser()`.
   - A new `request-personal-data` Edge Function should reuse this baseline authorization.
2. **Authoritative Email Lookup (`auth.users.email`)**:
   - `auth.users.email` is verified at account creation or via Supabase Auth email change.
   - Resolving the destination email strictly from `auth.users.email` (via `admin.auth.admin.getUserById(user.id)`) ensures personal data exports or verification codes are never routed to an unverified address.
3. **Passkey Re-Authentication (`passkeyService.signIn()`)**:
   - `services/passkeyService.ts:195-314` provides native platform authenticator assertion (`Passkey.getPlatformKey` / `Passkey.get`).
   - For users with a registered passkey (`passkeyService.listPasskeys()`), triggering a passkey assertion during the data request flow provides cryptographic, hardware-backed re-authentication without sending out-of-band codes.

---

## Section B: Email Verification Capabilities

### 1. Transactional Email Pipeline via Resend

The codebase operates two distinct email delivery pipelines:

```
┌────────────────────────────────────────────────────────┐
│                   EMAIL ARCHITECTURE                   │
└────────────────────────────────────────────────────────┘
          │                                   │
          ▼                                   ▼
 [1. Supabase Auth (GoTrue)]     [2. Transactional Edge Function]
  • signInWithOtp({ email })       • send-email Edge Function
  • GoTrue built-in SMTP / Resend  • services/emailService.ts
  • Login / Signup OTPs only       • Calls api.resend.com/emails
                                   • Uses RESEND_API_KEY
                                   • Enforces server rate limits
```

#### Application Transactional Email Pipeline (`send-email`)
- **Server Implementation**: `supabase/functions/send-email/index.ts` (lines 1–276).
- **Configuration in `supabase/config.toml`**:
  ```toml
  # supabase/config.toml:40-41
  [functions.send-email]
  verify_jwt = true
  ```
- **API Endpoint**: Directly invokes the Resend REST API via `fetch('https://api.resend.com/emails', ...)` (`send-email/index.ts:245-257`).
- **Secrets & Environment Variables**:
  - `RESEND_API_KEY`: Read via `Deno.env.get('RESEND_API_KEY')` (`send-email/index.ts:94`, `.env.example:31`).
  - `RESEND_FROM_EMAIL` / `EMAIL_FROM`: Configured as `Deno.env.get('RESEND_FROM_EMAIL') || Deno.env.get('EMAIL_FROM') || 'ZuruSasa <onboarding@resend.dev>'` (`send-email/index.ts:113-115`, `.env.example:32`).
- **Client Dispatch Service**: `services/emailService.ts` (lines 116–156):
  ```typescript
  // services/emailService.ts:123-130
  const { data: edgeData, error: edgeError } = await supabase.functions.invoke('send-email', {
    body: {
      recipientUserId: params.recipientUserId,
      bookingId: params.bookingId,
      subject: params.subject,
      html: params.html,
    },
  });
  ```
- **Security Controls in `send-email`**:
  1. **Authentication Guard**: Rejects unauthenticated requests with 401 (`send-email/index.ts:67-86`).
  2. **Rate Limiting**: Enforces max 10 emails per 60 seconds per user via Upstash Redis (`checkRateLimit(request, 'send_email', 10, 60, user.id)`) (`send-email/index.ts:88-92`).
  3. **Strict Recipient Authorization**:
     - Cross-user emails require an associated `bookingId` where the caller is either host or guest (`send-email/index.ts:156-184`).
     - Arbitrary `body.to` emails are forbidden unless matching the caller's own verified email (`send-email/index.ts:187-193`).
  4. **Authoritative Email Resolution**: The recipient's email is resolved strictly on the server from `public.profiles.email` or `admin.auth.admin.getUserById(targetUserId)` (`send-email/index.ts:224-238`).
  5. **Notification Preferences**: Checks `metadata.notifications_enabled` and `notification_settings.account_activity.email` before dispatching (`send-email/index.ts:213-222`).

---

### 2. Supabase Auth (GoTrue) Email Pipeline and Configuration

- Invoked via `supabase.auth.signInWithOtp({ email })` (`context/AuthContext.tsx:232-238`).
- Managed entirely within Supabase Auth (GoTrue).
- Sends default Supabase magic link / OTP templates.

---

### 3. Existing OTP and Magic-Link Workflows and Templates

- **OTP Screen UI**: `components/auth/OtpStep.tsx` (lines 1–110) renders a 6-digit input with resend buttons, error banners, and loading indicators.
- **Email Templates in Code**:
  - `services/emailService.ts:38-114`: `getZuruSasaEmailTemplate()` generates a dark-mode styled HTML email with ZuruSasa branding (`#0B0F19` background, `#F26522` button/accent, booking metadata card).
  - `supabase/functions/send-email/index.ts:29-56`: `buildHostWelcomeHtml()` provides a clean welcome email for new hosts.
- **Gaps**:
  - There is currently **no email template or workflow** for personal data request verification or data export delivery.
  - The "Request my personal data" button in `app/profile/privacy.tsx:105-114` contains only a mock timer:
    ```typescript
    // app/profile/privacy.tsx:105-114
    const handleRequestData = async () => {
      setDataRequestLoading(true);
      setTimeout(() => {
        setDataRequestLoading(false);
        Alert.alert(
          'Data Export Requested',
          `A full copy of your ZuruSasa account data, booking records, and reel activity will be compiled and emailed to ${user?.email || 'your registered address'} within 24 hours.`
        );
      }, 800);
    };
    ```

---

### 4. Why Supabase `signInWithOtp` Must NOT Be Used for Data Requests

Using `supabase.auth.signInWithOtp({ email })` for personal data access request verification introduces severe security and architectural risks:
1. **Session Pollution / Overwrite**: `signInWithOtp` is an authentication endpoint designed to mint new user sessions. Calling it while a user is already logged in risks overwriting the active session tokens, triggering unexpected `onAuthStateChange` events, or breaking the client's local session state.
2. **Intent Confusion**: A sign-in OTP template says "Your login code is 123456". If an attacker triggers this, the user has no idea they are approving a full dump of their personal data.
3. **No Request Scoping**: Supabase GoTrue OTPs are general authentication tokens; they cannot be bound to a specific `request_id`, purpose, or client IP.

---

### 5. Recommended Dedicated Verification Pipeline: Server-Generated 6-Digit CSPRNG Code via Resend

To maintain a single, unified email delivery architecture without adding new external vendors:

```
┌────────────────────────────────────────────────────────────────────────┐
│              RECOMMENDED EMAIL VERIFICATION WORKFLOW                   │
└────────────────────────────────────────────────────────────────────────┘

  [Mobile Client: Settings -> Privacy]
               │
               ▼ 1. POST /functions/v1/personal-data-request (action: "initiate")
  [Edge Function: request-personal-data]
               │
               ├── 2. Verify Caller JWT (userClient.auth.getUser())
               ├── 3. Fetch verified email from auth.users (admin.auth.admin.getUserById)
               ├── 4. Generate 6-digit CSPRNG code: crypto.getRandomValues(new Uint32Array(1))
               ├── 5. Hash code: SHA-256(code + salt + user_id)
               ├── 6. Store in `personal_data_requests` table:
               │       (id, user_id, email, otp_hash, status: 'pending_verification',
               │        otp_expires_at: now() + 10 mins, otp_attempts: 0, otp_max_attempts: 3)
               └── 7. Dispatch HTML email via Resend API (RESEND_API_KEY)
                           │
                           ▼
                      [Resend API]
                           │
                           ▼
                    [User's Inbox]
               "Your ZuruSasa Personal Data Verification Code is 839201"
```

**Benefits**:
- **Zero New Vendors**: Reuses existing `RESEND_API_KEY` and verified sender domain (`EMAIL_FROM`).
- **No Session Pollution**: Completely decoupled from GoTrue login tokens.
- **Fail-Closed Security**: Hashed code stored server-side with strict attempt limits (max 3) and short TTL (10 minutes).

---

## Section C: SMS Verification Capabilities

### 1. SMS Integrations in Codebase: Africa's Talking Gateway Audit

- **Africa's Talking**: The **only** SMS provider implemented in the repository.
- **Twilio**: A grep search for `twilio` returns **0 results**. Neither Twilio packages nor configuration exist.
- **Server Implementation**: Located in `supabase/functions/dispatch-notification/index.ts` (lines 165–241):
  ```typescript
  // supabase/functions/dispatch-notification/index.ts:165-241
  async function dispatchAfricasTalkingSms(
    phoneE164: string,
    message: string,
  ): Promise<{ sent: boolean; provider: string; httpStatus?: number; ... }> {
    const apiKey = Deno.env.get('AFRICASTALKING_API_KEY');
    const username = Deno.env.get('AFRICASTALKING_USERNAME');
    const senderId = Deno.env.get('AFRICASTALKING_SENDER_ID');
    ...
    const endpoint =
      username.trim().toLowerCase() === 'sandbox'
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging';
    ...
  }
  ```
- **Environment Variables** (`.env.example:33-34`):
  - `AFRICASTALKING_API_KEY`
  - `AFRICASTALKING_USERNAME`
  - `AFRICASTALKING_SENDER_ID` (optional alphanumeric sender ID)
- **Client Service**: `services/smsService.ts` (lines 69–176):
  - Validates E.164 phone numbers using `formatToE164()` (`smsService.ts:40-67`).
  - Dispatches SMS by invoking the `dispatch-notification` Edge Function (`smsService.ts:106-117`).

---

### 2. Verification Status of Phone Numbers: The `public.profiles.phone` Unverified Vulnerability

There are three locations where user phone numbers can exist in the data model:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PHONE NUMBER STORAGE AUDIT                           │
└────────────────────────────────────────────────────────────────────────┘

 1. auth.users.phone & phone_confirmed_at
    • Status: Verified ONLY if the user registered via Phone OTP.
    • For Google OAuth or Email OTP users: NULL.
    • Not updated when user modifies phone in app profile.

 2. public.profiles.phone
    • Status: UNVERIFIED.
    • Updated directly via client RLS in app/profile/info.tsx:134.
    • No SMS OTP verification required to write to this column.
    • Protected by no trigger against arbitrary values.

 3. auth.users.raw_user_meta_data.phone
    • Status: UNVERIFIED.
    • Updated via supabase.auth.updateUser({ data: { phone } }) in info.tsx:138.
    • Arbitrary client-supplied JSON metadata.
```

#### Vulnerability Analysis: Stored Phone Numbers Cannot Be Assumed Verified
In `app/profile/info.tsx` (lines 118–140), any user can type an arbitrary phone number (e.g., `+254700000000`) and tap "Save". The database executes:
```typescript
await supabase.from('profiles').update({ phone: phone.trim() || null }).eq('id', user.id);
```
No SMS challenge is issued. `public.profiles.phone` is updated immediately.
- **Critical Risk**: If the data access workflow were to send an authorization code to `public.profiles.phone`, an attacker who gained temporary session access could change `profiles.phone` to their own number and authorize an export, or spam an innocent third party's phone number.

---

### 3. Evaluation of Twilio (Absence Confirmed)

A complete search across package manifests, environment definitions, and application source confirms that Twilio is not present in the ZuruSasa project. Recommending Twilio would violate the team constraint against introducing redundant external SaaS vendors when Africa's Talking is already integrated.

---

### 4. Feasibility & Recommendation on SMS

#### Current Feasibility Assessment
- **SMS Verification for Active Sessions**: **NOT currently supported**.
  - While `dispatch-notification` can transmit text messages via Africa's Talking, there is no code-generation, hashing, verification, or attempt-tracking table for phone verification outside of initial GoTrue login.
  - Initial GoTrue login Phone OTP (`hooks/useAuthScreenFlow.ts:238-304`) only works for initial sign-in, not for in-session step-up verification.

#### Smallest Secure Integration Recommendation
1. **Primary Recommendation**: **Do not require SMS verification for Personal Data Access Requests**.
   - Email verification (via authoritative `auth.users.email`) combined with Passkey assertion (`services/passkeyService.ts`) provides full cryptographic and out-of-band coverage without recurring telco SMS costs, carrier delivery failures, or SIM-swap risks.
2. **If SMS is Offered as an Optional Secondary Channel**:
   - The system **MUST NOT** send codes to `public.profiles.phone` unless `auth.users.phone_confirmed_at IS NOT NULL` and matches `profiles.phone`.
   - If `auth.users.phone_confirmed_at` is null, the user must first complete a formal phone confirmation challenge (`supabase.auth.updateUser({ phone })` or a dedicated server-side challenge) before that phone number is permitted to authorize data exports.
   - SMS codes must be 6-digit numeric, valid for 5 minutes, stored as SHA-256 hashes, with max 3 attempts.

---

## Section D: Passkey Support Status

### 1. Technical Inventory: `react-native-passkey` v3.6.1 + Supabase Auth WebAuthn

The ZuruSasa mobile application already contains an advanced, dedicated passkey integration built on `react-native-passkey` and Supabase Auth's WebAuthn engine.

#### Technical Inventory
- **Library**: `react-native-passkey` v3.6.1 (`package.json:60`).
- **Core Service**: `services/passkeyService.ts` (lines 1–536).
- **UI Components**:
  - `components/passkey/PasskeySetupSheet.tsx` (lines 1–334): Bottom sheet explaining passkey security and handling retry states.
  - `app/profile/security.tsx` (lines 36–42, 68–76, 88–147): Passkey registration, listing, and deletion under `Settings → Login & security`.
  - `app/auth.tsx` (lines 245–256) & `hooks/useAuthScreenFlow.ts` (lines 462–487): Passkey sign-in on landing screen.
- **Client Config**: `lib/supabase.ts:66-68` enables `experimental: { passkey: true }` in `@supabase/supabase-js`.

---

### 2. Platform Support Architecture: Android Credential Manager & iOS ASAuthorizationPlatformPublicKeyCredentialProvider

| Platform | Underlying API | Implementation File & Line | Status |
|---|---|---|---|
| **Android** | Android Credential Manager (`androidx.credentials`) | `services/passkeyService.ts:251-255, 422-426` | Implemented (Requires API 28+, Google Play Services) |
| **iOS** | `ASAuthorizationPlatformPublicKeyCredentialProvider` | `services/passkeyService.ts:251-255, 422-426` | Implemented via `react-native-passkey` |
| **Web** | `navigator.credentials` (W3C WebAuthn) | `services/passkeyService.ts:168-175, 198-207, 327-334` | Implemented |
| **Expo Go** | Sandbox environment | `services/passkeyService.ts:43-55, 176-180, 210-219, 337-346` | **Unsupported by design** (detected & cleanly messaged) |

#### Android Native Configuration
- **Permissions** in `app.json` (lines 51–54) and `android/app/src/main/AndroidManifest.xml` (lines 12–13):
  ```xml
  <!-- android/app/src/main/AndroidManifest.xml:12-13 -->
  <uses-permission android:name="android.permission.USE_BIOMETRIC"/>
  <uses-permission android:name="android.permission.USE_FINGERPRINT"/>
  ```
- **Application Package**: `com.zurureels.app` (`app.json:30`).

---

### 3. Distinguishing Ordinary Biometrics from Cryptographic Passkeys

```
┌───────────────────────────────────────┬───────────────────────────────────────┐
│     ORDINARY BIOMETRIC UNLOCKING      │        CRYPTOGRAPHIC PASSKEYS         │
│     (expo-local-authentication)       │       (react-native-passkey)          │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ • Local device OS prompt only.        │ • Asymmetric public-key cryptography. │
│ • Returns a simple boolean (true/false)│ • Private key held in hardware secure │
│   to client JavaScript.               │   enclave (Titan M2 / Secure Enclave).│
│ • No cryptographic assertion or signature│ • Signs a server-minted challenge    │
│   sent to backend.                    │   (challengeId) with private key.     │
│ • Easily bypassed on rooted devices   │ • Server verifies signature against   │
│   via runtime hooking (e.g. Frida).   │   registered public key (non-repudiable│
│ • NOT phishing-resistant; no domain   │ • Phishing-resistant; bound to Relying│
│   binding.                            │   Party ID (rpId).                    │
│ • Status: NOT INSTALLED in repo.      │ • Status: FULLY IMPLEMENTED in repo.  │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

**Conclusion**: The repository does **not** use naive local biometric unlocking (`expo-local-authentication` is absent from `package.json`). Instead, it implements true FIDO2/WebAuthn passkeys via `react-native-passkey`.

---

### 4. Recommended Approach: 1-Tap Cryptographic Passkey Step-Up Re-Authentication

When a user requests personal data under `Settings → Privacy & Data`:
1. Check if the user has a registered passkey via `await passkeyService.listPasskeys()`.
2. If `hasPasskey === true`, offer **"Verify with Passkey"** as the primary, 1-tap verification method.
3. The client calls `passkeyService.signIn()` or a lightweight `passkeyService.reauthenticate()`:
   - Supabase issues an authentication challenge via `(supabase.auth as any).passkey.startAuthentication()`.
   - Android Credential Manager prompts for fingerprint/face biometric verification.
   - The signed assertion is verified by Supabase via `verifyAuthentication()`.
4. Upon successful passkey verification:
   - The user has achieved cryptographic step-up verification (AAL2 assurance).
   - The client immediately posts to the Personal Data Access Request endpoint with high confidence.
   - No emails or SMS messages need to be sent.
5. If the user does not have a registered passkey (`hasPasskey === false`), gracefully fall back to the dedicated Resend Email OTP verification code.

---

## Section E: Personal Data Inventory, Tables, and Storage Locations

### 1. Relational Schema Architecture across 33 Migrations (20 Relational Tables)

Static analysis across all 33 database migrations (`supabase/migrations/202608010001` through `202611070001`) reveals 20 relational tables containing user personal data.

#### Key Architectural Findings:
1. **Actual Relational Schema vs. Assumed Nomenclature**:
   - **ZuruPlan Trips & Itineraries** do not have a standalone table; they are stored as JSON structures in client `AsyncStorage` (`@zurusasa_trips_${userId}`) and synced to `public.profiles.metadata -> 'saved_trips'` (`services/zuruPlanService.ts:168-242`).
   - **Wishlists / Saved Listings** are represented by `public.reel_saves` and `public.event_subscribers` (`lib/queries/reels.ts:153-220`).
   - **M-Pesa / Mobile Money Transactions** are processed through Paystack and recorded in `public.payment_attempts` (`provider = 'paystack'`), `public.host_payout_recipients` (`bank_code = 'MPESA'`), and `public.host_payouts` (`202608010001`, `202608020001`).
   - **Guest Information** is captured as an integer count (`bookings.guests`, `booking_quotes.guest_count`) and primary booker `bookings.user_id`; separate multi-guest guestbook tables do not exist.

---

### 2. Comprehensive Table Catalog

| Category | Table / Store Name | Primary Key | User Linkage Column(s) | Defining Migrations & Source Files |
| :--- | :--- | :--- | :--- | :--- |
| **a) Account & Profiles** | `public.profiles` | `id` (UUID) | `id = auth.uid()` | `202608040001`, `202608200001`, `202611020001` |
| **a) Account & Profiles** | `auth.users` (metadata) | `id` (UUID) | `id = auth.uid()` | Supabase Auth catalog (`send-email/index.ts:233`) |
| **b) Bookings & Stays** | `public.bookings` | `id` (UUID) | `user_id` (guest), host via `experience_id`/`quote_id` | `202608010001`, `202608200006`, `lib/supabase.ts:285` |
| **b) Bookings & Stays** | `public.booking_quotes` | `id` (UUID) | `guest_id`, `host_id` | `202608010001`, `202608180001`, `202608200006` |
| **b) Bookings & Stays** | `public.booking_lifecycle_events` | `id` (UUID) | `actor_id`, and booking participants via `booking_id` | `202608180002_booking_lifecycle_availability_hardening.sql` |
| **b) Bookings & Stays** | `public.host_blocked_dates` | `id` (UUID) | `host_id` | `202608050001_host_calendar_availability.sql` |
| **b) Bookings & Stays** | `public.calendar_connections` | `id` (UUID) | `host_id` | `202608180002_booking_lifecycle_availability_hardening.sql` |
| **b) Bookings & Stays** | `public.external_calendar_blocks` | `id` (UUID) | via `connection_id` -> `host_id` | `202608180002_booking_lifecycle_availability_hardening.sql` |
| **c) Payments & Ledger** | `public.payment_attempts` | `id` (UUID) | `guest_id` | `202608010001_secure_booking_foundation.sql` |
| **c) Payments & Ledger** | `public.financial_ledger` | `id` (UUID) | via `booking_id` / `quote_id` (`guest_id`, `host_id`) | `202608020001`, `202608250002` |
| **c) Payments & Ledger** | `public.payment_events` | `id` (UUID) | Provider webhook payload (no direct user FK) | `202608010001` — **EXCLUDED FROM EXPORT** |
| **d) Refunds & Payouts** | `public.refund_requests` | `id` (UUID) | `guest_id`, host via `booking_id` | `202608180001_payments_financial_domain_hardening.sql` |
| **d) Refunds & Payouts** | `public.host_payout_recipients` | `id` (UUID) | `host_id` | `202608020001_phase2_marketplace_ledger_and_payouts.sql` |
| **d) Refunds & Payouts** | `public.host_payouts` | `id` (UUID) | `host_id` | `202608020001`, `202608180001` |
| **e) Messages & Conversations** | `public.conversations` | `id` (UUID) | `participant_one`, `participant_two` | `202608030001:11`, `lib/queries/messages.ts:28` |
| **e) Messages & Conversations** | `public.messages` | `id` (UUID) | `sender_id`, conversation participants | `202608030001:12`, `lib/queries/messages.ts:173` |
| **e) Messages & Conversations** | `public.ai_conversations` | `id` (UUID) | `user_id` | `20261106000001_ai_conversations_and_memory_isolation.sql` |
| **e) Messages & Conversations** | `public.ai_messages` | `id` (UUID) | via `conversation_id` -> `user_id` | `20261106000001_ai_conversations_and_memory_isolation.sql` |
| **f) Wishlists & Saves** | `public.reel_saves` | `id` or composite | `user_id` | `202608030001:35`, `lib/queries/reels.ts:159` |
| **f) Wishlists & Saves** | `public.event_subscribers` | `id` or composite | `user_id` | `202608030001:45`, `lib/queries/reels.ts:208` |
| **f) Wishlists & Saves** | `public.user_follows` | `id` or composite | `follower_id`, `following_id` | `202608030001:39`, `lib/queries/interactions.ts:235` |
| **g) ZuruPlan Trips** | `profiles.metadata.saved_trips` | JSON array | `profiles.id = auth.uid()` | `services/zuruPlanService.ts:168-242` |
| **h) Reel Interactions** | `public.reel_likes` | `(user_id, reel_id)` | `user_id` | `202608130005:57`, `202608030001:34` |
| **h) Reel Interactions** | `public.reel_views` | `id` or composite | `viewer_id` | `202608030001:36`, `202608200005:31` |
| **h) Reel Interactions** | `public.reel_shares` | `id` or composite | `sharer_id` | `202608030001:37` |
| **h) Reel Interactions** | `public.host_profile_views` | `id` or composite | `viewer_id`, `host_id` | `202608030001:42` |
| **i) User-Generated Content** | `public.experiences` | `id` (UUID) | `user_id` (Host) | `202608010001`, `202608200006`, `202611070001` |
| **i) User-Generated Content** | `public.reels` | `id` (UUID) | `user_id` | `202608080001:260`, `lib/supabase.ts:236` |
| **i) User-Generated Content** | `public.reviews` | `id` (UUID) | `reviewer_id` (author), `reviewee_id` (subject) | `202608200006_marketplace_booking_deepening_and_reviews.sql` |
| **i) User-Generated Content** | `public.support_tickets` | `id` (UUID) | `user_id` | `app/profile/support.tsx:159-165` |
| **j) Notifications & Devices** | `public.notifications` | `id` (UUID) | `user_id`, `recipient_id`, `sender_id` | `202608140001_fix_notifications_table_columns_and_constraints.sql` |
| **j) Notifications & Devices** | `public.user_devices` | `id` (UUID) | `user_id` | `202608130008`, `202608130011` |
| **k) Privacy & Preferences** | `profiles.privacy_settings` | JSONB on row | `profiles.id = auth.uid()` | `app/profile/privacy.tsx:60-98` |
| **k) Privacy & Preferences** | `profiles.notification_settings` | JSONB on row | `profiles.id = auth.uid()` | `app/profile/notifications.tsx:135-163` |
| **l) AI Memories & Analytics** | `public.ai_user_memories` | `id` (UUID) | `user_id` | `20261106000001:84-95` |

---

### 3. Storage Buckets Inventory

1. **`reels` Bucket**:
   - Created in `supabase/migrations/202608080001_fix_reservation_and_reels_pipeline.sql:242-258`.
   - `public = true`, `file_size_limit = 104857600` (100 MB).
   - Scoped under `${user.id}/...` (`supabase/functions/delete-account/index.ts:71-78`).
2. **`avatars` Bucket**:
   - Referenced in `supabase/functions/delete-account/index.ts:71`, `app/(tabs)/profile.tsx:191`.
   - Stores user portrait photos under `${user.id}/${filename}`.
3. **`identity-documents` Bucket**:
   - Referenced in `supabase/functions/delete-account/index.ts:71`.
   - Private bucket for host KYC / government ID uploads.
4. **Cloudinary CDN Media**:
   - Client upload in `lib/cloudinaryUpload.ts:18-51` uses unsigned presets (`EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`).
   - URLs stored in `reels.video_url`, `reels.thumbnail_url`, `profiles.avatar_url`, and `messages.content`. These valid URLs should be included in the export.

---

### 4. Data Isolation Boundaries and Redaction Rules

To comply with GDPR Article 15/20 and Kenya Data Protection Act 2019 without creating IDOR vulnerabilities:
1. **Multi-Party Conversations**:
   - Export all messages where `sender_id = requesting_user_id`.
   - For incoming counterparty messages, export only the `content` and timestamp, attributed to the counterparty's public display name. **Never** export counterparty private email, phone, or address.
2. **Multi-Party Bookings & Quotes**:
   - Guest Export: Export stay dates, property title, address, amount paid, terms, and host public name. **Redact** host service fee (`host_service_fee_amount`), host net payout (`host_payout_amount`), and host bank/M-Pesa details.
   - Host Export: Export booking dates, guest count, gross amount, host service fee, and guest public display name. **Redact** guest private email, phone, and payment card details.
3. **Financial Records & Provider Secrets**:
   - `payment_attempts.provider_response`: **Redact entirely** (contains Paystack customer card BINs, account numbers, IP addresses, authorization tokens).
   - `host_payout_recipients.recipient_code`: **Redact entirely** (`RCP_xxxx` Paystack transfer secret).
   - `host_payout_recipients.account_number`: Mask phone number/account (e.g., `+254 7****123`).
   - `host_payouts.provider_transfer_code`: **Redact entirely** (`TRF_xxxx`).
   - `calendar_connections.sync_token`: **Redact entirely** (Google OAuth calendar token).
   - `payment_events`: **Completely excluded from export** (contains raw internal gateway webhook payloads).

---

## Section F: Existing Reusable Edge Functions and Services

The ZuruSasa backend possesses existing serverless modules that directly satisfy requirements for the Personal Data Access pipeline:

### 1. Upstash Redis Rate Limiter (`supabase/functions/_shared/rateLimiter.ts`)
- **Implementation**: Lines 7–82.
- **Capabilities**: Atomic `INCR`, `EXPIRE`, `TTL` checks via Upstash REST. Supports rate limiting by `userId` and client IP (extracting `cf-connecting-ip`, `x-real-ip`, or `x-forwarded-for`).
- **Reuse**: Directly enforces OTP request cooldowns (e.g., max 3 verification requests per 15 minutes) and brute-force defenses.

### 2. Worker & Internal Service Authorization (`supabase/functions/_shared/workerAuth.ts`)
- **Implementation**: Lines 8–110.
- **Capabilities**: Constant-time string comparison (`timingSafeEqual`) preventing timing side-channel attacks. Validates `CRON_SECRET`, `service_role` keys, and admin JWTs.
- **Reuse**: Authorizes asynchronous background workers and scheduled cleanup jobs.

### 3. Transactional Email Delivery (`supabase/functions/send-email/index.ts`)
- **Implementation**: Lines 18–275.
- **Capabilities**: Direct Resend API integration (`RESEND_API_KEY`), verified sender enforcement (`RESEND_FROM_EMAIL` or `EMAIL_FROM`), rate limiting (10/min/user), and dark-mode HTML email templating (`#0B0F19`, `#F26522`).
- **Reuse**: Dispatches OTP verification codes and export completion notifications without adding new email services.

### 4. Push & SMS Notification Dispatcher (`supabase/functions/dispatch-notification/index.ts`)
- **Implementation**: Lines 34–541.
- **Capabilities**: Africa's Talking SMS API client (`dispatchAfricasTalkingSms`, lines 165–241) and Expo Push Notification dispatcher (lines 389–486).
- **Reuse**: Sends Account Takeover (ATO) alerts and optional SMS OTPs.

### 5. Storage Purge & Admin SDK (`supabase/functions/delete-account/index.ts`)
- **Implementation**: Lines 18–110.
- **Capabilities**: Demonstrates dual-client architecture: user client (caller JWT) and admin client (`SUPABASE_SERVICE_ROLE_KEY`). Performs storage listing and batch object removal across user buckets.
- **Reuse**: Provides the exact template for querying user tables with `service_role` privileges and uploading artifacts to private storage.

---

## Section G: Missing Infrastructure

A rigorous static analysis confirms that the infrastructure required to process, secure, and deliver personal data exports is currently missing:

| Infrastructure Layer | Component Name | Current Repository Status | Gap Description & Impact |
|---|---|---|---|
| **Database Table** | `public.personal_data_requests` | **Missing** | No table exists to track export requests, user linkage, verification status, format (`json`/`pdf`), storage paths, download count, checksum, or expiration timestamps. |
| **Database Table** | `public.personal_data_audit_logs` | **Missing** | No table exists to log tamper-evident compliance audit events (request creation, OTP dispatch, verification attempt, data assembly, download, purge). |
| **Storage Bucket** | `personal-data-exports` | **Missing** | `supabase/migrations/202608080001` (line 243) only defines a public `reels` bucket. No private bucket exists for sensitive PII exports. |
| **Edge Function** | `request-personal-data` | **Missing** | No serverless function exists to enforce recent re-auth, generate/hash verification OTPs, record pending requests, and dispatch email alerts. |
| **Edge Function** | `process-personal-data-export` | **Missing** | No serverless worker exists to collect user data across relational tables, assemble JSON, render branded PDF, compute SHA-256 checksums, and upload to storage. |
| **Edge Function** | `cleanup-personal-data-exports` | **Missing** | No function or scheduled job exists to purge expired archives from private storage and transition records to `expired`. |
| **Background Queue** | Asynchronous Job Queue | **Missing** | No background queue (pg_cron, BullMQ, or pgmq) is configured in the repository. Workers currently rely on external HTTP cron calls with `CRON_SECRET`. |
| **Client Screen** | `app/profile/data-request.tsx` | **Missing** | No dedicated UI exists for format selection, OTP verification challenge, status tracking, and signed-URL downloading. |

---

## Section H: Security Gaps and Threat Model

Handling bulk exports of personal data introduces severe compliance and security liabilities. We evaluated the repository against key threat vectors:

### 1. OTP Generation, Storage, and Cryptographic Hashing
- **Observed State**: Client uses `supabase.auth.signInWithOtp` (`context/AuthContext.tsx:232-238`).
- **Threat**: *Session Hijacking & Intent Confusion*: An attacker tricks a victim into approving a login code, granting session access and allowing data exfiltration.
- **Requirement**: Generate an independent 6-digit CSPRNG code (`crypto.getRandomValues()`). Never store plaintext codes. Hash with **SHA-256 and a secret server salt** before persisting. Compare hashes using constant-time string comparison (`timingSafeEqual` in `_shared/workerAuth.ts`).

### 2. OTP Expiration, Attempt Limits, and Resend Cooldowns
- **Observed State**: No custom OTP attempt or expiration tracking exists outside GoTrue defaults.
- **Threat**: *Brute-Force Enumeration*: 6-digit numeric codes have only 1,000,000 combinations.
- **Requirement**:
  - **Short-Lived Expiration**: Maximum **10 minutes** (600 seconds).
  - **Strict Attempt Counter**: Maximum **3 attempts** per code. On the 3rd failed attempt, destroy OTP and transition request to `failed`.
  - **Resend Cooldown**: Mandatory **60-second cooldown** between code requests.

### 3. Rate Limiting Fail-Open Risk
- **Observed State**: `supabase/functions/_shared/rateLimiter.ts` (lines 53–56) fails open if Redis credentials are missing:
  ```typescript
  if (!redisUrl || !redisToken) {
    return { allowed: true, current: 0, limit: maxRequests, ttl: 0 };
  }
  ```
- **Threat**: *Resource Exhaustion & Denial of Service*: If Redis is offline, attackers can trigger thousands of heavy database and PDF generation queries.
- **Requirement**: For data export endpoints, rate limiting must **fail closed** or enforce database-level request throttling. Limit to **1 completed export per user per 24 hours** and **3 initiation attempts per 24 hours**.

### 4. Absence of Recent Re-Authentication Checks
- **Observed State**: `user.last_sign_in_at` is never checked across the repository.
- **Threat**: *Stale / Unattended Session Abuse*: An attacker or unauthorized physical user accessing an unlocked phone can initiate an export on a 30-day-old session.
- **Requirement**: Verify `user.last_sign_in_at`. If the session is older than **15 minutes**, enforce step-up authentication (passkey assertion or email OTP) before permitting request initiation.

### 5. Insecure Direct Object References (IDOR) & Authorization
- **Threat**: *Cross-Tenant Exfiltration*: An attacker guessing another user's `requestId` downloads their export.
- **Requirement**: Multi-layer RLS and storage enforcement:
  1. `personal_data_requests` RLS enforces `auth.uid() = user_id`.
  2. Storage signed URLs generated only after validating caller `auth.uid() == target_user_id`.

### 6. Storage Bucket Isolation & Signed URLs
- **Observed State**: Migration `202608080001` sets `reels` bucket `public = true`.
- **Threat**: *Public Exposure of Dossiers*: Exports placed in public buckets are accessible to anyone possessing the URL.
- **Requirement**: Bucket `personal-data-exports` must be strictly private (`public = false`). Downloads delivered exclusively via **expiring signed URLs** with a maximum TTL of **24 hours** (`expiresIn: 86400`).

### 7. Sensitive Information Redaction
- **Threat**: Leakage of internal password hashes, payment gateway API keys, or counterparty private contact details.
- **Requirement**: Strictly exclude `encrypted_password`, `provider_response` raw payloads, Paystack `recipient_code`, and counterparty phone/email in shared bookings and chats.

### 8. Account Takeover (ATO) Defense & Out-of-Band Alerts
- **Threat**: Compromised accounts exfiltrated before the victim notices.
- **Requirement**:
  1. Immediately upon request initiation, send an out-of-band security alert email via Resend: *"A personal data access request has been initiated for your ZuruSasa account. If you did not make this request, freeze your account immediately."*
  2. Dispatch push notification to all active devices in `user_devices`.
  3. Prohibit data export if account email/phone was modified in the last **48 hours**.

### 9. Export Retention & Automatic Cleanup
- **Requirement**: In compliance with Kenya DPA 2019 (Storage Limitation), files must auto-expire after **7 days** (168 hours). A daily scheduled worker (`cleanup-personal-data-exports`) purges expired files and marks status `expired`.

### 10. Immutable Compliance Audit Logging
- **Requirement**: Every lifecycle transition (creation, OTP verification, generation, download, expiration) must be written to `public.personal_data_audit_logs`. Authenticated users can read their logs (`SELECT`), but cannot modify or delete them (`INSERT/UPDATE/DELETE = false`).

---

## Section I: Recommended Architecture

### 1. Architectural Overview & Design Tenets

```
[1. User Initiates Request in App]
       │
       ▼
[2. Edge Function Generates Salted OTP & Sends Verification Email via Resend]
       │
       ▼
[3. User Submits OTP -> Server Verifies Hash & Step-Up Auth]
       │
       ▼
[4. Server Enqueues/Triggers Async Export Worker]
       │
       ▼
[5. Worker Queries DB, Aggregates User Tables & Applies PII Redaction]
       │
       ▼
[6. Worker Generates Machine JSON & Branded PDF via pdf-lib]
       │
       ▼
[7. Artifacts Uploaded to Private Bucket `personal-data-exports`]
       │
       ▼
[8. Request Status Marked 'completed' & Notification Email Sent]
       │
       ▼
[9. User Downloads via Expiring Signed URL (24h TTL) in App]
       │
       ▼
[10. Scheduled Worker Purges Storage Objects after 7 Days & Logs Deletion]
```

---

### 2. 10-Stage Data Request Lifecycle Walkthrough

1. **Request Initiation**: User taps "Request my personal data" in `app/profile/privacy.tsx`. Client verifies session freshness; if `last_sign_in_at` > 15 minutes, prompts for passkey assertion or email OTP.
2. **OTP Dispatch**: `request-personal-data` Edge Function generates 6-digit CSPRNG code, computes salted SHA-256 hash, inserts row in `personal_data_requests` (`status = 'pending_verification'`), and sends code via Resend.
3. **Identity Verification & Authorization**: User enters OTP. Function checks max 3 attempts, verifies hash, updates status to `processing`, and logs event in `personal_data_audit_logs`.
4. **Data Aggregation**: Worker initializes Supabase `service_role` client to query user records across all 20 relational tables.
5. **PII Sanitization & Redaction**: Excludes payment provider secret payloads, counterparty personal contacts, and internal authentication tokens.
6. **Dual Export Generation**:
   - Compiles machine-readable JSON archive.
   - Renders human-readable summary PDF using `pdf-lib` (embedded typography, dark-mode cover palette `#0B0F19`, `#F26522`).
   - Calculates SHA-256 checksum for each file.
7. **Secure Storage**: Uploads files to private bucket `personal-data-exports/${user_id}/${request_id}/...`.
8. **Notification & Completion**: Updates request status to `completed`. Sends email notification via Resend that the export is ready.
9. **Secure Download Delivery**: Mobile app displays status card with "Download Export" button. Client requests a 24-hour signed URL from storage.
10. **Automated Purge & Lifecycle Close**: After 7 days, daily scheduled job deletes files from storage bucket, transitions request to `expired`, and records deletion in audit logs.

---

### 3. Machine-Readable JSON Export Specification (GDPR Art. 20)

Conforms to standard data portability specifications:
```json
{
  "export_metadata": {
    "request_id": "c3a9d240-...",
    "user_id": "9b1deb4d-...",
    "generated_at": "2026-11-08T15:30:00Z",
    "expires_at": "2026-11-15T15:30:00Z",
    "sha256_checksum": "a4f8e9...",
    "regulatory_framework": "Kenya DPA 2019 / GDPR Art. 15 & 20"
  },
  "profile": { ... },
  "bookings": [ ... ],
  "booking_quotes": [ ... ],
  "payments": [ ... ],
  "conversations": [ ... ],
  "zuru_plans": [ ... ],
  "reels": [ ... ],
  "reviews": [ ... ],
  "notifications": [ ... ],
  "privacy_preferences": { ... }
}
```

---

### 4. Human-Readable PDF Export Specification (`pdf-lib` in Deno Edge Functions)

- **Pure JavaScript Execution**: `pdf-lib` (`https://esm.sh/pdf-lib@1.17.9`) runs natively in Deno Edge Functions without headless browsers, Puppeteer, or third-party paid rendering APIs.
- **Document Layout**:
  - Page 1: ZuruSasa branded title page, user summary, export date, request ID, integrity SHA-256 fingerprint, and legal compliance notice.
  - Page 2: Account details, profile metadata, KYC verification history, and privacy consent settings.
  - Page 3: Stay history, booking summaries, reservation references, and itinerary dates.
  - Page 4: Financial ledger transactions and payment attempt history (masked account numbers).
  - Page 5: User-generated content index (reels, reviews, and support inquiries).

---

## Section J: Exact Files Requiring Modification or Addition

### 1. Existing Repository Files to Modify

| File Path | Line Range | Architectural Rationale for Modification |
|---|---|---|
| `app/profile/privacy.tsx` | 105–114, 324–342 | Replace placeholder `handleRequestData` alert with navigation to `/profile/data-request` or open modal; bind button to live request query. |
| `app/profile/_layout.tsx` | 14–21 | Register `<Stack.Screen name="data-request" />` within the authenticated profile sub-navigation stack. |
| `lib/supabase.ts` | 75–435 | Export TypeScript interfaces for `PersonalDataRequestRow` and `PersonalDataAuditLogRow`. |
| `supabase/config.toml` | 40–45 | Register Edge Functions `request-personal-data` (`verify_jwt = true`), `process-personal-data-export` (`verify_jwt = false`), and `cleanup-personal-data-exports` (`verify_jwt = false`). |
| `.env.example` | 30–41 | Document configuration variables: `DATA_EXPORT_RETENTION_DAYS`, `DATA_EXPORT_SIGNED_URL_TTL_SECONDS`. |

### 2. New Files to Create

| File Path | Component Type | Responsibility |
|---|---|---|
| `app/profile/data-request.tsx` | Mobile Screen | Dedicated UI for requesting data, format selection, OTP challenge, status tracking, and downloading. |
| `components/privacy/DataRequestModal.tsx` | UI Component | Modal sheet for 6-digit OTP verification and format selection. |
| `components/privacy/DataRequestStatusCard.tsx` | UI Component | Card rendered under Privacy & Data displaying active export status and download action. |
| `services/dataRequestService.ts` | Client Service | Encapsulates client RPC calls and Edge Function invocations for data requests. |
| `supabase/migrations/202611090001_personal_data_access_requests.sql` | Database Migration | Production SQL DDL: types, tables, indexes, private storage bucket, RLS policies, and RPCs. |
| `supabase/functions/request-personal-data/index.ts` | Edge Function | Handles request initiation, recent auth check, OTP hashing, and Resend email delivery. |
| `supabase/functions/process-personal-data-export/index.ts` | Edge Function | Queries user records, applies redaction, renders JSON and `pdf-lib` PDF, uploads to private storage. |
| `supabase/functions/cleanup-personal-data-exports/index.ts` | Edge Function | Scheduled cleanup worker to purge expired files (> 7 days) and record audit log events. |

---

## Section K: Proposed Database Migrations and RLS Policies

The complete SQL DDL below is ready for deployment in `supabase/migrations/202611090001_personal_data_access_requests.sql`:

```sql
-- =============================================================================
-- Migration: 202611090001_personal_data_access_requests.sql
-- Description: Schema, Private Storage, RLS, and Audit Logging for
--              Personal Data Access Requests (Kenya DPA 2019 / GDPR compliant).
-- =============================================================================

-- ── 1. Enums ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.personal_data_request_status AS ENUM (
    'pending_verification',
    'processing',
    'completed',
    'failed',
    'expired',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.personal_data_export_format AS ENUM (
    'json',
    'pdf',
    'both'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Private Storage Bucket ────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'personal-data-exports',
  'personal-data-exports',
  false,
  52428800, -- 50 MB limit
  ARRAY['application/json', 'application/pdf', 'application/zip']
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Strict storage policies: Only service_role can write/delete. Users access via signed URLs only.
DROP POLICY IF EXISTS "Deny public access to personal data exports" ON storage.objects;
CREATE POLICY "Deny public access to personal data exports"
  ON storage.objects FOR ALL
  TO public
  USING (false);

-- ── 3. Table: personal_data_requests ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.personal_data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.personal_data_request_status NOT NULL DEFAULT 'pending_verification',
  format public.personal_data_export_format NOT NULL DEFAULT 'both',
  
  -- Security & Verification
  otp_hash TEXT,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  otp_max_attempts INTEGER NOT NULL DEFAULT 3,
  otp_expires_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  
  -- Generated Artifacts & Integrity
  json_storage_path TEXT,
  pdf_storage_path TEXT,
  file_size_bytes BIGINT,
  checksum_sha256 TEXT,
  
  -- Expiration & Failure Metadata
  expires_at TIMESTAMPTZ,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pdr_user_status
  ON public.personal_data_requests (user_id, status);

CREATE INDEX IF NOT EXISTS idx_pdr_cleanup_due
  ON public.personal_data_requests (status, expires_at)
  WHERE status = 'completed';

-- ── 4. Table: personal_data_audit_logs ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.personal_data_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.personal_data_requests(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_role TEXT NOT NULL DEFAULT 'user',
  ip_address TEXT,
  user_agent TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_pdal_user_created
  ON public.personal_data_audit_logs (user_id, created_at DESC);

-- ── 5. Row Level Security (RLS) ──────────────────────────────────────────────

ALTER TABLE public.personal_data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_data_audit_logs ENABLE ROW LEVEL SECURITY;

-- personal_data_requests policies:
DROP POLICY IF EXISTS "Users can view own data requests" ON public.personal_data_requests;
CREATE POLICY "Users can view own data requests"
  ON public.personal_data_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own data requests" ON public.personal_data_requests;
CREATE POLICY "Users can insert own data requests"
  ON public.personal_data_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Direct client updates/deletes are blocked; all updates occur via service_role or RPC
DROP POLICY IF EXISTS "Deny direct updates by users" ON public.personal_data_requests;
CREATE POLICY "Deny direct updates by users"
  ON public.personal_data_requests FOR UPDATE
  TO authenticated
  USING (false);

-- personal_data_audit_logs policies:
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.personal_data_audit_logs;
CREATE POLICY "Users can view own audit logs"
  ON public.personal_data_audit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Immutable audit ledger: no client modifications allowed
DROP POLICY IF EXISTS "Users cannot modify audit logs" ON public.personal_data_audit_logs;
CREATE POLICY "Users cannot modify audit logs"
  ON public.personal_data_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- ── 6. Helper RPCs for Request Lifecycle ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_personal_data_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calling_user_id UUID := auth.uid();
  v_req RECORD;
BEGIN
  IF v_calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '28000';
  END IF;

  SELECT * INTO v_req
  FROM public.personal_data_requests
  WHERE id = p_request_id AND user_id = v_calling_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING errcode = 'P0002';
  END IF;

  IF v_req.status NOT IN ('pending_verification', 'processing') THEN
    RAISE EXCEPTION 'Cannot cancel request in status: %', v_req.status USING errcode = '22023';
  END IF;

  UPDATE public.personal_data_requests
  SET status = 'cancelled', updated_at = clock_timestamp()
  WHERE id = p_request_id;

  INSERT INTO public.personal_data_audit_logs (request_id, user_id, event_type, actor_role, details)
  VALUES (p_request_id, v_calling_user_id, 'request_cancelled_by_user', 'user', '{}'::jsonb);

  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_personal_data_request(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_personal_data_request(UUID) TO authenticated;
```

---

## Section L: Required Environment Variables and External Services

### 1. Existing Reused Secrets & Configuration (Zero New Vendors)

| Secret Name | Hosting Environment | Existing Source Location | Purpose in Data Request Workflow |
|---|---|---|---|
| `RESEND_API_KEY` | Edge Function Secret | `supabase/functions/send-email/index.ts:94` | Transmitting 6-digit verification code and ready notifications |
| `RESEND_FROM_EMAIL` / `EMAIL_FROM` | Edge Function Secret | `supabase/functions/send-email/index.ts:113` | Verified sender domain address |
| `AFRICASTALKING_API_KEY` | Edge Function Secret | `supabase/functions/dispatch-notification/index.ts:169` | (Optional) Africa's Talking SMS delivery for confirmed phones |
| `AFRICASTALKING_USERNAME` | Edge Function Secret | `supabase/functions/dispatch-notification/index.ts:170` | Africa's Talking API account username |
| `UPSTASH_REDIS_REST_URL` | Edge Function Secret | `supabase/functions/_shared/rateLimiter.ts:28` | Distributed rate limiting and OTP attempt tracking |
| `UPSTASH_REDIS_REST_TOKEN` | Edge Function Secret | `supabase/functions/_shared/rateLimiter.ts:29` | Upstash Redis authentication token |
| `CRON_SECRET` | Edge Function Secret | `supabase/functions/_shared/workerAuth.ts:24` | Authenticating scheduled cleanup worker calls |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function Secret | Supabase Core Environment | Privileged data aggregation across all 20 tables |

### 2. New Configuration Defaults (Documented in `.env.example`)

| Variable Name | Default Value | Purpose |
|---|---|---|
| `DATA_EXPORT_RETENTION_DAYS` | `7` | Days before export files are purged from storage |
| `DATA_EXPORT_SIGNED_URL_TTL_SECONDS` | `86400` | Signed URL validity duration (24 hours) |
| `DATA_EXPORT_MAX_REQUESTS_PER_DAY` | `1` | Rate limit on completed requests per user per day |

---

## Section M: Estimated Implementation Complexity Breakdown

| Workstream | Subtasks & Engineering Activities | Complexity | Estimated Effort |
|---|---|---|---|
| **1. Database & Storage Foundation** | - Create migration `202611090001_personal_data_access_requests.sql`<br>- Configure private storage bucket `personal-data-exports`<br>- Implement RLS policies & helper RPCs | **Low–Medium** | 1.5 engineer-days |
| **2. Request & OTP Edge Function** | - Implement `request-personal-data` Edge Function<br>- Salted SHA-256 OTP generation & storage in DB/Redis<br>- Rate limiting, step-up re-auth check, and email dispatch via Resend | **Medium** | 2.5 engineer-days |
| **3. Async Data Aggregator & PDF Generator** | - Implement `process-personal-data-export` Edge Function<br>- Query eligible records across 20 user tables with PII redaction<br>- Format machine JSON & render styled PDF via `pdf-lib`<br>- Upload to private storage and compute SHA-256 checksum | **High** | 3.5 engineer-days |
| **4. Mobile Client Screens & Navigation** | - Replace stub in `app/profile/privacy.tsx`<br>- Build dedicated `app/profile/data-request.tsx` screen<br>- Build format selector & 6-digit OTP verification sheet<br>- Add status card, countdown timer, and secure download handler | **Medium** | 2.5 engineer-days |
| **5. Retention Cleanup & Security Hardening** | - Implement `cleanup-personal-data-exports` cron worker<br>- ATO alert notification email/push integration<br>- Audit logging hooks and fail-closed rate limit verification | **Low–Medium** | 1.5 engineer-days |
| **Total Implementation** | **Full End-to-End Production Delivery** | **Balanced** | **11.5 engineer-days** |

---

## Section N: Phased Implementation Plan

### Phase 1: Database Foundation, Storage Bucket, and RLS Policies (Days 1–2)
- **Milestones**:
  1. Apply migration `202611090001_personal_data_access_requests.sql`.
  2. Create private storage bucket `personal-data-exports` (`public = false`).
  3. Validate RLS rules: ensure authenticated users can only view their own requests and cannot update status or checksums.
- **Acceptance Gate**: Unauthenticated or cross-user queries return zero rows.

### Phase 2: Edge Functions & Server-Side Processing Pipeline (Days 3–6)
- **Milestones**:
  1. Deploy `request-personal-data` Edge Function with step-up auth validation and Resend email delivery.
  2. Deploy `process-personal-data-export` Edge Function:
     - Aggregates records across all 20 relational tables.
     - Redacts provider secrets and counterparty PII.
     - Generates valid JSON and branded `pdf-lib` PDF.
     - Computes SHA-256 checksum and uploads to `personal-data-exports`.
  3. Deploy on-demand signed URL generator (24-hour expiration).
- **Acceptance Gate**: End-to-end integration test successfully executes: Request → OTP Verification → Data Aggregation → Storage Upload → Signed URL Download.

### Phase 3: Mobile Client Integration (Days 7–9)
- **Milestones**:
  1. Replace placeholder alert in `app/profile/privacy.tsx` with navigation to `app/profile/data-request.tsx`.
  2. Implement `app/profile/data-request.tsx` utilizing design tokens (`DM Sans`, `#FAFAFA`/`#121212`, `#F26522`).
  3. Integrate 6-digit OTP modal sheet adapting `components/auth/OtpStep.tsx`.
  4. Build active request status card with progress indicators, expiration countdown, and in-app download handling (`expo-web-browser` / `expo-linking`).
- **Acceptance Gate**: User initiates request, verifies OTP in modal, views real-time progress, and downloads file on device.

### Phase 4: Lifecycle Automation, ATO Safeguards & Audit Verification (Days 10–12)
- **Milestones**:
  1. Deploy `cleanup-personal-data-exports` scheduled daily cron worker with `CRON_SECRET`.
  2. Send immediate security notification email and push alert upon request initiation (ATO defense).
  3. Verify Kenya Data Protection Act 2019 and GDPR compliance checklists.
- **Acceptance Gate**: Files older than 7 days are automatically purged from storage and marked `expired` in database. Audit trail records complete lifecycle chain.

---

## Final Recommendation: Safest and Smallest Production-Ready Implementation

### Explicit Distinction: Implemented Features vs. Recommendations

To maintain complete audit integrity, the table below explicitly delineates what currently exists in the repository versus what is recommended for implementation:

| Domain | Implemented Repository Feature | Recommended Future Implementation |
|---|---|---|
| **Client UI** | Mock button in `app/profile/privacy.tsx:324-342` with 800ms alert timer (`handleRequestData`). | Dedicated screen `app/profile/data-request.tsx` and OTP sheet `DataRequestModal.tsx`. |
| **Database Schema** | 20 relational tables storing personal data across 33 migrations. | Tables `personal_data_requests` and `personal_data_audit_logs` defined in migration `202611090001`. |
| **Storage** | Public `reels` bucket, user avatars, and private `identity-documents` bucket. | Private `personal-data-exports` bucket with 24-hour signed URLs. |
| **Email** | Resend API in `send-email/index.ts` for transactional notifications. | Dedicated OTP verification template and ready alert in `request-personal-data`. |
| **SMS** | Africa's Talking in `dispatch-notification/index.ts` and `smsService.ts`. | Recommended **NOT** to require SMS; if offered, require verified `auth.users.phone_confirmed_at`. |
| **Passkeys** | `react-native-passkey` v3.6.1 + Supabase WebAuthn in `services/passkeyService.ts`. | 1-tap passkey assertion for step-up re-authentication during data request initiation. |
| **Export Worker** | None. | Deno Edge Function `process-personal-data-export` using `pdf-lib` for zero-vendor PDF generation. |
| **Purge Lifecycle** | User account deletion RPC in `delete-account/index.ts`. | Scheduled cron Edge Function `cleanup-personal-data-exports` for 7-day retention purge. |

### Minimal Architecture Strategy (Zero-Vendor Expansion)
1. **Re-Authentication**: Require 1-tap Passkey assertion if registered; fallback to a 6-digit CSPRNG OTP sent via Resend.
2. **Email Delivery**: Reuse existing Resend API integration (`RESEND_API_KEY`, `EMAIL_FROM`) in Edge Functions.
3. **PDF Generation**: Use `pdf-lib` in Deno for in-memory PDF rendering with zero headless browsers and zero SaaS fees.
4. **Storage & Access**: Write exports to private bucket `personal-data-exports`, accessible solely via 24-hour expiring signed URLs.
5. **Retention**: Enforce a strict 7-day storage retention lifecycle with automated daily cleanup.

This architecture provides the smallest, most secure, and completely compliant implementation, fully aligned with the Kenya Data Protection Act 2019 and GDPR requirements.
