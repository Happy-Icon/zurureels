# ZuruReels Polish Tasks

**Created:** February 17, 2026  
**Purpose:** Complete all remaining tasks to launch-ready state

---

## Task Progress Legend
- [ ] Not started
- [~] In progress
- [x] Completed
- [!] Blocked

---

## Phase 1: Critical Blockers (Must complete before any other work)

### P1-1: Replace Mock Data with Real Database Queries
**Priority:** Critical | **Effort:** Medium | **Files:** [`frontend/src/pages/Host.tsx`](frontend/src/pages/Host.tsx)

- [ ] Create `useHostReels` hook to fetch reels for logged-in host
- [ ] Replace `mockHostReels` array with real data from hook
- [ ] Add loading states for reel fetching
- [ ] Add error handling for failed queries
- [ ] Test with actual host account

### P1-2: Video Upload to Supabase Storage
**Priority:** Critical | **Effort:** Medium | **Files:** [`frontend/src/components/video-editor/MiniVideoEditor.tsx`](frontend/src/components/video-editor/MiniVideoEditor.tsx)

- [ ] Create `reels-videos` storage bucket in Supabase
- [ ] Implement video compression before upload (optional, for performance)
- [ ] Add upload progress indicator
- [ ] Handle upload errors gracefully
- [ ] Generate thumbnail from video frame
- [ ] Store video URL in reels table after upload

### P1-3: Booking Cancellation with Refunds
**Priority:** Critical | **Effort:** High | **Files:** [`frontend/src/pages/Bookings.tsx`](frontend/src/pages/Bookings.tsx), [`frontend/src/components/booking/CheckOutDialog.tsx`](frontend/src/components/booking/CheckOutDialog.tsx)

- [ ] Add "Cancel Booking" button to booking cards
- [ ] Create cancellation confirmation dialog
- [ ] Implement Paystack refund API call (backend edge function)
- [ ] Update booking status to 'cancelled' after refund
- [ ] Add cancellation policy display (time limits, fees)
- [ ] Send cancellation confirmation email
- [ ] Notify host of cancellation

### P1-4: Host Booking Approval Workflow
**Priority:** Critical | **Effort:** Medium | **Files:** [`frontend/src/components/host/dashboard/HostBookings.tsx`](frontend/src/components/host/dashboard/HostBookings.tsx)

- [ ] Add "Approve" and "Decline" buttons to booking requests
- [ ] Implement approval API call to update booking status
- [ ] Send notification to guest on approval/decline
- [ ] Add optional decline reason text field
- [ ] Update booking status in real-time
- [ ] Add booking details modal (guest info, dates, special requests)

### P1-5: Push Notifications Integration
**Priority:** Critical | **Effort:** Medium | **Files:** [`backend/supabase/functions/push-notification/index.ts`](backend/supabase/functions/push-notification/index.ts)

- [ ] Complete OneSignal setup in frontend
- [ ] Wire `push-notification` edge function
- [ ] Store device tokens in `user_devices` table
- [ ] Send push on new booking request
- [ ] Send push on booking confirmation
- [ ] Send push on payment received
- [ ] Test on Android device

---

## Phase 2: Payment & Financial

### P2-1: Host Payout System
**Priority:** High | **Effort:** High

- [ ] Create `payouts` table in database
- [ ] Add payout settings to host profile (bank account info)
- [ ] Implement Paystack Transfer API integration
- [ ] Create payout scheduling logic (weekly/monthly)
- [ ] Add payout history view for hosts
- [ ] Send payout confirmation emails
- [ ] Handle failed payouts

### P2-2: M-Pesa Integration
**Priority:** High | **Effort:** Medium

- [ ] Set up M-Pesa Daraja API credentials
- [ ] Create M-Pesa payment option in checkout
- [ ] Implement STK Push for payment initiation
- [ ] Handle M-Pesa callback/webhook
- [ ] Add M-Pesa transaction validation
- [ ] Test with sandbox environment

### P2-3: Payment History Page
**Priority:** Medium | **Effort:** Low

- [ ] Create payment history section in profile
- [ ] Display all transactions (debits, credits)
- [ ] Add transaction filtering by date
- [ ] Add transaction export (PDF/CSV)
- [ ] Show payment method used per transaction

### P2-4: Payment Webhook Verification
**Priority:** High | **Effort:** Medium

- [ ] Implement Paystack webhook signature verification
- [ ] Handle duplicate webhook calls (idempotency)
- [ ] Log all webhook events
- [ ] Update booking status from webhook
- [ ] Handle failed payment webhooks

---

## Phase 3: Authentication & User Management

### P3-1: Phone Verification
**Priority:** High | **Effort:** Medium

- [ ] Integrate SMS provider (Twilio/Africa's Talking)
- [ ] Add phone input to profile settings
- [ ] Implement OTP generation and sending
- [ ] Create OTP verification UI
- [ ] Update `verification_badges.phone` on success
- [ ] Rate limit OTP attempts

### P3-2: Identity Verification
**Priority:** High | **Effort:** High

- [ ] Create `verification_documents` table
- [ ] Add document upload UI (ID/Passport)
- [ ] Integrate with verification API (Smile ID/Onfido)
- [ ] Create admin verification review panel
- [ ] Update `verification_badges.identity` on approval
- [ ] Send verification status notifications

### P3-3: Two-Factor Authentication
**Priority:** Medium | **Effort:** Medium

- [ ] Add 2FA setup in security settings
- [ ] Implement TOTP (Google Authenticator style)
- [ ] Create 2FA verification on login
- [ ] Add backup codes generation
- [ ] Handle 2FA recovery flow

### P3-4: Profile Avatar Upload
**Priority:** Low | **Effort:** Low

- [ ] Create `avatars` storage bucket
- [ ] Wire camera button in profile to upload
- [ ] Add image cropping before upload
- [ ] Update profile with avatar URL
- [ ] Display avatar throughout app

---

## Phase 4: Host Dashboard Completion

### P4-1: Reel Editing
**Priority:** High | **Effort:** Medium

- [ ] Add "Edit" option to reel cards
- [ ] Pre-populate editor with existing reel data
- [ ] Allow video replacement
- [ ] Update reel in database
- [ ] Maintain reel history/versioning

### P4-2: Reel Deletion
**Priority:** High | **Effort:** Low

- [ ] Add "Delete" option to reel cards
- [ ] Show deletion confirmation dialog
- [ ] Soft delete (archive) vs hard delete
- [ ] Remove video from storage
- [ ] Update host stats after deletion

### P4-3: Draft Saving
**Priority:** Medium | **Effort:** Medium

- [ ] Add "Save as Draft" button in editor
- [ ] Create `drafts` table or add `status='draft'`
- [ ] Implement draft auto-save
- [ ] Show drafts in separate tab
- [ ] Allow draft to published conversion

### P4-4: Host Verification Workflow
**Priority:** High | **Effort:** High

- [ ] Create admin panel for host verification
- [ ] Display pending verifications
- [ ] Approve/decline with reason
- [ ] Update host role on approval
- [ ] Send approval notification to host

### P4-5: Reel Analytics
**Priority:** Medium | **Effort:** Medium

- [ ] Create `reel_analytics` table
- [ ] Track views, likes, shares per reel
- [ ] Display analytics on reel cards
- [ ] Create analytics dashboard view
- [ ] Export analytics data

---

## Phase 5: Booking System Enhancement

### P5-1: Availability Calendar
**Priority:** High | **Effort:** High

- [ ] Add availability fields to experiences table
- [ ] Create calendar UI for hosts
- [ ] Allow blocking/unblocking dates
- [ ] Check availability before booking
- [ ] Handle overlapping bookings

### P5-2: Booking Modification
**Priority:** Medium | **Effort:** High

- [ ] Add "Modify Booking" option
- [ ] Allow date changes (if available)
- [ ] Handle price adjustments
- [ ] Notify host of changes
- [ ] Update booking in database

### P5-3: Booking Reminders
**Priority:** Medium | **Effort:** Medium

- [ ] Create reminder edge function
- [ ] Send email reminder 24h before
- [ ] Send push notification 2h before
- [ ] Add reminder preferences to settings
- [ ] Track reminder delivery

### P5-4: Booking Confirmation Emails
**Priority:** Medium | **Effort:** Low

- [ ] Create booking confirmation template
- [ ] Wire to [`send-email`](backend/supabase/functions/send-email/index.ts) function
- [ ] Include booking details in email
- [ ] Add calendar invite attachment
- [ ] Send to both guest and host

---

## Phase 6: Notifications Enhancement

### P6-1: Email Notifications
**Priority:** High | **Effort:** Low

- [ ] Wire notification preferences to email sending
- [ ] Create email templates for each type
- [ ] Batch email notifications (optional)
- [ ] Add unsubscribe link
- [ ] Track email delivery

### P6-2: Notification Preferences
**Priority:** Medium | **Effort:** Low

- [ ] Connect profile settings to notification logic
- [ ] Per-channel toggles (email, push, SMS)
- [ ] Per-type toggles (bookings, marketing, security)
- [ ] Save preferences to `notification_settings`
- [ ] Apply preferences before sending

### P6-3: SMS Notifications
**Priority:** Medium | **Effort:** Medium

- [ ] Integrate SMS provider
- [ ] Create SMS templates
- [ ] Send SMS for critical notifications
- [ ] Track SMS delivery
- [ ] Handle opt-outs

---

## Phase 7: Mobile App Completion

### P7-1: iOS Platform
**Priority:** Low | **Effort:** Medium | **Status:** DEFERRED

> **Note:** iOS development is deferred to post-launch. Focus on Android and PWA for initial release.

- [ ] Run `npx cap add ios`
- [ ] Configure iOS permissions (camera, location)
- [ ] Set up iOS signing credentials
- [ ] Test on iOS device
- [ ] Configure deep linking for iOS

### P7-2: Native Plugins (Android)
**Priority:** High | **Effort:** Low

- [ ] Install `@capacitor/camera`
- [ ] Install `@capacitor/geolocation`
- [ ] Install `@capacitor/push-notifications`
- [ ] Wire plugins to existing UI
- [ ] Test native functionality

### P7-3: Deep Linking
**Priority:** High | **Effort:** Medium

- [ ] Configure app links (Android)
- [ ] Handle deep link routing
- [ ] Test booking deep links
- [ ] Test reel deep links

### P7-4: App Store Assets
**Priority:** Medium | **Effort:** Low

- [ ] Create app icons (all sizes)
- [ ] Create splash screens
- [ ] Prepare store screenshots
- [ ] Write store descriptions
- [ ] Prepare promotional graphics

### P7-5: Biometric Authentication
**Priority:** Low | **Effort:** Medium | **Status:** DEFERRED

> **Note:** Biometric authentication deferred to post-launch.

- [ ] Install `@capacitor/biometric`
- [ ] Add biometric login option
- [ ] Store credentials securely
- [ ] Handle biometric failures
- [ ] Fallback to password

---

## Phase 8: Database & Backend

### P8-1: Reviews Table
**Priority:** High | **Effort:** Medium

- [ ] Create `reviews` table
```sql
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  experience_id uuid REFERENCES experiences NOT NULL,
  booking_id uuid REFERENCES bookings NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);
```
- [ ] Add RLS policies
- [ ] Create review submission UI
- [ ] Display reviews on experience cards
- [ ] Calculate average ratings

### P8-2: Saved Reels Table
**Priority:** Medium | **Effort:** Low

- [ ] Create `saved_reels` table
```sql
CREATE TABLE saved_reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  reel_id uuid REFERENCES reels NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, reel_id)
);
```
- [ ] Wire save button to database
- [ ] Display saved reels in Saved page
- [ ] Add unsave functionality

### P8-3: Messages/Conversations
**Priority:** Medium | **Effort:** High

- [ ] Create `conversations` table
- [ ] Create `messages` table
- [ ] Build messaging UI
- [ ] Real-time message subscription
- [ ] Message notifications

### P8-4: TypeScript Types Update
**Priority:** Medium | **Effort:** Low

- [ ] Run Supabase types generator
- [ ] Update [`types.ts`](frontend/src/integrations/supabase/types.ts)
- [ ] Fix any type errors
- [ ] Add missing table types

### P8-5: Full-Text Search
**Priority:** Low | **Effort:** Medium

- [ ] Add search vectors to experiences
- [ ] Create search function
- [ ] Build search UI
- [ ] Add search suggestions
- [ ] Track popular searches

---

## Phase 9: AI & City Pulse

### P9-1: Chat History Persistence
**Priority:** Medium | **Effort:** Low

- [ ] Create `chat_messages` table
- [ ] Store user messages and AI responses
- [ ] Load history on chat open
- [ ] Add "Clear History" option

### P9-2: AI Context Enhancement
**Priority:** Medium | **Effort:** Medium

- [ ] Pass user preferences to AI context
- [ ] Include booking history in context
- [ ] Add saved reels to context
- [ ] Personalize recommendations

### P9-3: AI Fallback Handling
**Priority:** Medium | **Effort:** Low

- [ ] Detect AI service unavailability
- [ ] Show friendly error message
- [ ] Provide cached suggestions
- [ ] Retry mechanism

---

## Phase 10: Polish & Optimization

### P10-1: Error Boundaries
**Priority:** Medium | **Effort:** Low

- [ ] Add error boundary to app root
- [ ] Create error fallback UI
- [ ] Add error reporting
- [ ] Handle chunk load failures

### P10-2: Loading States
**Priority:** Medium | **Effort:** Low

- [ ] Add skeleton loaders to all data components
- [ ] Create shimmer effects
- [ ] Add loading spinners where appropriate
- [ ] Handle slow connections

### P10-3: Image Optimization
**Priority:** Medium | **Effort:** Low

- [ ] Implement lazy loading for images
- [ ] Add blur placeholders
- [ ] Use WebP format where supported
- [ ] Optimize thumbnail sizes

### P10-4: Performance Audit
**Priority:** Medium | **Effort:** Medium

- [ ] Run Lighthouse audit
- [ ] Fix Core Web Vitals issues
- [ ] Optimize bundle size
- [ ] Add service worker caching

### P10-5: Security Audit
**Priority:** High | **Effort:** Medium

- [ ] Move hardcoded API key to env vars [`city-pulse-ai/index.ts:18`](backend/supabase/functions/city-pulse-ai/index.ts:18)
- [ ] Review RLS policies
- [ ] Add rate limiting to edge functions
- [ ] Implement CSRF protection
- [ ] Security headers check

### P10-6: Analytics Integration
**Priority:** Medium | **Effort:** Low

- [ ] Set up PostHog or Mixpanel
- [ ] Track key user actions
- [ ] Create conversion funnels
- [ ] Add error tracking (Sentry)

---

## Quick Wins (Can be done anytime)

- [ ] Remove console.log statements from production code
- [ ] Add proper error messages to all catch blocks
- [ ] Fix any TypeScript `any` types
- [ ] Add proper loading states to buttons
- [ ] Improve form validation messages
- [ ] Add keyboard navigation support
- [ ] Improve accessibility (ARIA labels)
- [ ] Add proper focus management in modals

---

## Task Count Summary

| Phase | Total Tasks | Critical | High | Medium | Low |
|-------|-------------|----------|------|--------|-----|
| Phase 1 | 22 | 22 | 0 | 0 | 0 |
| Phase 2 | 17 | 0 | 8 | 6 | 3 |
| Phase 3 | 17 | 0 | 6 | 6 | 5 |
| Phase 4 | 18 | 0 | 8 | 6 | 4 |
| Phase 5 | 16 | 0 | 4 | 7 | 5 |
| Phase 6 | 12 | 0 | 2 | 6 | 4 |
| Phase 7 | 16 | 0 | 6 | 4 | 6 |
| Phase 8 | 16 | 0 | 2 | 8 | 6 |
| Phase 9 | 9 | 0 | 0 | 6 | 3 |
| Phase 10 | 18 | 0 | 2 | 10 | 6 |
| **Total** | **161** | **22** | **38** | **59** | **42** |

---

## How to Use This Document

1. Start with **Phase 1** - these are critical blockers
2. Work through phases in order
3. Check off tasks as you complete them
4. Add notes/blockers as needed
5. Update task counts as scope changes

**Remember:** A task isn't done until it's tested!