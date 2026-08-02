# Paystack Marketplace Payments Runbook & Deployment Guide

This document provides step-by-step instructions for linking Supabase CLI, setting secrets, deploying database migrations, deploying Edge Functions, and configuring Paystack webhooks for secure server-side payment processing.

---

## 1. Prerequisites & Supabase CLI Setup

Execute the following commands in the project root (`zurusasa-mobile`):

### Install Supabase CLI locally
```bash
npm.cmd install --save-dev supabase
```
*Why*: Installs the Supabase CLI executable as a local project dependency so `npx.cmd supabase` commands are available.

### Login to Supabase CLI
```bash
npx.cmd supabase login
```
*Why*: Authenticates your local machine with your Supabase account token.

### Link Project
```bash
npx.cmd supabase link --project-ref rjzgzxxdrltlteeshtuw
```
*Why*: Connects your local repository to your remote Supabase project (`rjzgzxxdrltlteeshtuw`).

---

## 2. Configure Edge Function Secrets

Ensure the secret `PAYSTACK_SECRET_KEY` is configured in your remote Supabase project:

```bash
npx.cmd supabase secrets set PAYSTACK_SECRET_KEY="sk_test_YOUR_PAYSTACK_SECRET_KEY"
```

*Why*: Edge Functions (`create-booking-payment` and `paystack-webhook`) use `PAYSTACK_SECRET_KEY` to initiate STK push requests and cryptographically verify webhook signatures using HMAC-SHA512.

---

### Deploy Database Migrations

Deploy Phase 1 & Phase 2 migrations to your Supabase database:

```bash
npx.cmd supabase db push
```

Alternatively, if managing via the Supabase Dashboard SQL Editor:
1. Open [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/rjzgzxxdrltlteeshtuw/sql/new).
2. Run [`supabase/migrations/202608010001_secure_booking_foundation.sql`](file:///C:/Users/ADMIN/Desktop/projects/replit/zurureels/artifacts/zurusasa-mobile/supabase/migrations/202608010001_secure_booking_foundation.sql).
3. Run [`supabase/migrations/202608020001_phase2_marketplace_ledger_and_payouts.sql`](file:///C:/Users/ADMIN/Desktop/projects/replit/zurureels/artifacts/zurusasa-mobile/supabase/migrations/202608020001_phase2_marketplace_ledger_and_payouts.sql).

*Effect*:
- Enables `pgcrypto` and `btree_gist` extensions.
- Creates `booking_quotes`, `payment_attempts`, and `payment_events` tables with RLS and constraints.
- Creates double-entry `financial_ledger`, `host_payout_recipients`, and scheduled `host_payouts` tables.
- Defines security-definer RPCs `create_booking_quote`, `begin_payment_attempt`, `settle_paystack_success`, `settle_paystack_failure`, `host_confirm_booking`, and `host_cancel_booking`.

---

## 4. Deploy Supabase Edge Functions

Deploy all Edge Functions using the Supabase CLI:

```bash
# 1. Deploy payment creation endpoint
npx.cmd supabase functions deploy create-booking-payment

# 2. Deploy public Paystack webhook receiver
npx.cmd supabase functions deploy paystack-webhook

# 3. Deploy host payout onboarding endpoint
npx.cmd supabase functions deploy create-host-recipient

# 4. Deploy automated host payouts processing batch job
npx.cmd supabase functions deploy process-host-payouts
```

*Effect*:
- `create-booking-payment`: Accepts quote ID and phone number, initiates M-Pesa charge via Paystack using server-owned pricing.
- `paystack-webhook`: Verifies `x-paystack-signature`, deduplicates events in `payment_events`, verifies transaction with Paystack API, and calls `settle_paystack_success` RPC (which logs financial ledger entries and schedules host payout).
- `create-host-recipient`: Onboards host M-Pesa / Bank accounts securely via Paystack `/transferrecipient` API and saves active recipient code.
- `process-host-payouts`: Batch-processes due payouts 24h post check-out via Paystack `/transfer` API.

---

## 5. Configure Paystack Webhook URL

1. Log into your [Paystack Dashboard](https://dashboard.paystack.com/).
2. Navigate to **Settings** > **API Keys & Webhooks**.
3. Under **Webhook URL**, set the URL to:
   ```
   https://rjzgzxxdrltlteeshtuw.supabase.co/functions/v1/paystack-webhook
   ```
4. Click **Save Changes**.

---

## 6. End-to-End Test Mode Validation

1. **Create Booking Quote**:
   Call RPC `create_booking_quote` with listing ID, check-in, check-out, guest count, and idempotency UUID.
2. **Initiate Payment**:
   Post to `https://rjzgzxxdrltlteeshtuw.supabase.co/functions/v1/create-booking-payment` with user JWT, quote ID, test M-Pesa phone number (`0700000000`), and idempotency UUID.
3. **Webhook Processing & Financial Ledger**:
   When Paystack sends `charge.success` event:
   - Check `payment_events` table in Supabase (status processed).
   - Check `financial_ledger` table (verify 3 double-entry entries: `guest_payment`, `host_escrow_credit`, `platform_fee_revenue`).
   - Check `host_payouts` table (scheduled for 24h post check-out).
4. **Host Payout Recipient Onboarding**:
   In `HostWalletScreen` (`app/host/wallet.tsx`), enter M-Pesa number and click **Save Payout Method**. Verify `host_payout_recipients` table stores the recipient code `RCP_...`.

---

## 7. Rollback Plan

If an emergency rollback is required:
1. Revert Edge Function deployments:
   ```bash
   npx.cmd supabase functions delete process-host-payouts
   npx.cmd supabase functions delete create-host-recipient
   npx.cmd supabase functions delete paystack-webhook
   npx.cmd supabase functions delete create-booking-payment
   ```

2. Existing mobile app logic continues to use `initiate-paystack-stk` until client code in `BookingSheet.tsx` is updated.
