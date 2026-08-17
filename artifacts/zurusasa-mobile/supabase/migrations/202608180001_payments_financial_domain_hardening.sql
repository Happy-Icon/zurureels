-- Migration: 202608180001_payments_financial_domain_hardening.sql
-- Hardens ZuruSasa Payments, Escrow, Refund pipeline, Host Payout Backfill, and Platform Settings

-- 1. Platform Configuration Table (Dynamic Commissions, Currency, Policies)
create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

drop policy if exists "Platform settings are readable by authenticated users" on public.platform_settings;
create policy "Platform settings are readable by authenticated users"
  on public.platform_settings for select
  using (true);

-- Seed default 15% marketplace commission
insert into public.platform_settings (key, value, description)
values (
  'commission',
  '{"host_fee_bps": 1500, "guest_fee_bps": 0, "currency": "KES", "min_payout_amount": 100}'::jsonb,
  'Marketplace commission configuration in basis points (1500 = 15%)'
)
on conflict (key) do nothing;

-- 2. Enhance Host Payouts Table with Retry Tracking and Unique Active Payout Constraint
alter table public.host_payouts
  add column if not exists retry_count integer not null default 0,
  add column if not exists max_retries integer not null default 3;

-- Ensure only one active (scheduled/processing/success) payout exists per booking
create unique index if not exists host_payouts_active_booking_idx
  on public.host_payouts (booking_id)
  where status in ('scheduled', 'processing', 'success');

-- 3. Refund Requests Table (Automated Reversal & Paystack Refund Tracking)
create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  quote_id uuid references public.booking_quotes(id) on delete restrict,
  payment_attempt_id uuid references public.payment_attempts(id) on delete restrict,
  guest_id uuid not null references auth.users(id) on delete restrict,
  amount bigint not null check (amount > 0),
  currency text not null default 'KES' check (currency = 'KES'),
  provider text not null default 'paystack',
  provider_refund_id text,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'success', 'failed', 'cancelled')
  ),
  reason text,
  failure_reason text,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists refund_requests_booking_status_idx
  on public.refund_requests (booking_id, status);

create index if not exists refund_requests_guest_idx
  on public.refund_requests (guest_id, status);

alter table public.refund_requests enable row level security;

drop policy if exists "Guests can read their refund requests" on public.refund_requests;
create policy "Guests can read their refund requests"
  on public.refund_requests for select
  using (guest_id = auth.uid());

drop policy if exists "Hosts can read refund requests for their listings" on public.refund_requests;
create policy "Hosts can read refund requests for their listings"
  on public.refund_requests for select
  using (
    exists (
      select 1 from public.bookings b
      join public.booking_quotes bq on b.quote_id = bq.id
      where b.id = refund_requests.booking_id and bq.host_id = auth.uid()
    )
  );

drop trigger if exists refund_requests_touch_updated_at on public.refund_requests;
create trigger refund_requests_touch_updated_at
before update on public.refund_requests
for each row execute function public.touch_marketplace_updated_at();

-- 4. RPC: Schedule Pending Host Payouts (Automatic Backfill for Hosts)
create or replace function public.schedule_pending_host_payouts(
  p_host_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient record;
  v_booking record;
  v_scheduled_count integer := 0;
begin
  if p_host_id is null then
    raise exception 'Host ID is required' using errcode = '22023';
  end if;

  -- 1. Find active payout recipient for host
  select r.recipient_code into v_recipient
  from public.host_payout_recipients r
  where r.host_id = p_host_id and r.is_active = true
  order by r.created_at desc limit 1;

  if v_recipient.recipient_code is null then
    return 0;
  end if;

  -- 2. Find all confirmed/paid bookings belonging to this host that lack an active payout record
  for v_booking in
    select
      b.id as booking_id,
      b.check_out,
      bq.host_id,
      bq.host_payout_amount,
      bq.currency
    from public.bookings b
    join public.booking_quotes bq on b.quote_id = bq.id
    where bq.host_id = p_host_id
      and b.status in ('paid', 'confirmed')
      and bq.host_payout_amount > 0
      and not exists (
        select 1 from public.host_payouts hp
        where hp.booking_id = b.id
          and hp.status in ('scheduled', 'processing', 'success')
      )
  loop
    insert into public.host_payouts (
      host_id,
      booking_id,
      recipient_code,
      amount,
      currency,
      scheduled_for,
      status
    ) values (
      v_booking.host_id,
      v_booking.booking_id,
      v_recipient.recipient_code,
      v_booking.host_payout_amount,
      coalesce(v_booking.currency, 'KES'),
      greatest(now(), (v_booking.check_out + interval '24 hours')),
      'scheduled'
    )
    on conflict do nothing;

    v_scheduled_count := v_scheduled_count + 1;
  end loop;

  return v_scheduled_count;
end;
$$;

-- 5. Updated create_booking_quote using Configurable Platform Commission
create or replace function public.create_booking_quote(
  p_experience_id uuid,
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_guest_count integer,
  p_idempotency_key uuid
)
returns public.booking_quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_id uuid := auth.uid();
  v_experience record;
  v_quote public.booking_quotes%rowtype;
  v_units integer;
  v_subtotal bigint;
  v_host_fee_bps integer := 1500;
  v_host_fee bigint;
  v_existing_booking boolean;
  v_setting jsonb;
begin
  if v_guest_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  if p_idempotency_key is null then
    raise exception 'An idempotency key is required' using errcode = '22023';
  end if;

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'A valid check-in and check-out range is required' using errcode = '22023';
  end if;

  if p_check_in < (now() - interval '1 day') or p_guest_count is null or p_guest_count < 1 or p_guest_count > 30 then
    raise exception 'Invalid booking dates or guest count' using errcode = '22023';
  end if;

  perform public.expire_booking_quotes();

  select bq.* into v_quote
  from public.booking_quotes bq
  where bq.guest_id = v_guest_id
    and bq.idempotency_key = p_idempotency_key;

  if found then
    return v_quote;
  end if;

  -- Load dynamic platform commission setting
  select value into v_setting
  from public.platform_settings
  where key = 'commission';

  if v_setting is not null and (v_setting->>'host_fee_bps') is not null then
    v_host_fee_bps := (v_setting->>'host_fee_bps')::integer;
  end if;

  -- Lock the listing row so concurrent quote requests do not overlap
  select e.id, e.user_id, e.current_price, e.price_unit, e.availability_status
  into v_experience
  from public.experiences e
  where e.id = p_experience_id
  for update;

  if not found then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  if v_experience.user_id = v_guest_id then
    raise exception 'Hosts cannot book their own listing' using errcode = '22023';
  end if;

  if coalesce(v_experience.availability_status, 'available') <> 'available' then
    raise exception 'Listing is not available' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.bookings b
    where b.experience_id = p_experience_id
      and coalesce(b.status, 'pending') not in ('cancelled', 'refunded', 'failed')
      and b.check_in < p_check_out
      and b.check_out > p_check_in
  ) into v_existing_booking;

  if v_existing_booking then
    raise exception 'Those dates are no longer available' using errcode = 'P0001';
  end if;

  if v_experience.current_price is null or v_experience.current_price < 0 then
    raise exception 'Listing price is unavailable' using errcode = 'P0001';
  end if;

  v_units := case
    when lower(coalesce(v_experience.price_unit, 'night')) in ('night', 'nights', 'per_night')
      then greatest(1, ceil(extract(epoch from (p_check_out - p_check_in)) / 86400.0)::integer)
    else p_guest_count
  end;

  v_subtotal := round(v_experience.current_price * v_units * 100)::bigint;
  v_host_fee := round(v_subtotal * (v_host_fee_bps / 10000.0))::bigint;

  insert into public.booking_quotes (
    guest_id,
    host_id,
    experience_id,
    idempotency_key,
    check_in,
    check_out,
    guest_count,
    pricing_snapshot,
    cancellation_policy_snapshot,
    subtotal_amount,
    guest_service_fee_amount,
    tax_amount,
    total_amount,
    host_service_fee_amount,
    host_payout_amount
  ) values (
    v_guest_id,
    v_experience.user_id,
    p_experience_id,
    p_idempotency_key,
    p_check_in,
    p_check_out,
    p_guest_count,
    jsonb_build_object(
      'listing_unit_price', v_experience.current_price,
      'listing_price_unit', coalesce(v_experience.price_unit, 'night'),
      'units', v_units,
      'currency', 'KES',
      'price_scale', 100,
      'host_fee_bps', v_host_fee_bps
    ),
    jsonb_build_object(
      'version', 'v1',
      'free_cancellation_until', null,
      'policy_note', 'Policy rules enforced by the refund workflow.'
    ),
    v_subtotal,
    0,
    0,
    v_subtotal,
    v_host_fee,
    v_subtotal - v_host_fee
  ) returning * into v_quote;

  return v_quote;
end;
$$;

-- 6. Updated guest_cancel_booking with Automated Refund Record and Ledger Balancing
create or replace function public.guest_cancel_booking(
  p_booking_id uuid,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_quote public.booking_quotes%rowtype;
  v_host_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_booking.user_id <> v_user_id then
    raise exception 'You are not authorized to cancel this booking' using errcode = '42501';
  end if;

  if v_booking.status in ('cancelled', 'declined', 'completed', 'refunded') then
    return v_booking;
  end if;

  -- Cancel scheduled payouts
  update public.host_payouts
  set status = 'cancelled',
      failure_reason = coalesce(p_reason, 'Guest cancelled reservation')
  where booking_id = v_booking.id and status = 'scheduled';

  -- If booking was paid, create refund request & balance the ledger
  if v_booking.status in ('paid', 'confirmed') and v_booking.quote_id is not null then
    select bq.* into v_quote
    from public.booking_quotes bq
    where bq.id = v_booking.quote_id;

    if found then
      -- 1. Insert Refund Request for Paystack Processing
      insert into public.refund_requests (
        booking_id,
        quote_id,
        payment_attempt_id,
        guest_id,
        amount,
        currency,
        reason,
        status
      ) values (
        v_booking.id,
        v_quote.id,
        v_booking.payment_attempt_id,
        v_user_id,
        v_quote.total_amount,
        v_quote.currency,
        coalesce(p_reason, 'Guest requested cancellation'),
        'pending'
      ) on conflict do nothing;

      -- 2. Record Double-Entry Ledger Balancing Entries for Refund
      -- Entry A: Reverse Host Escrow (Debit: HOST_ESCROW_PAYABLE, Credit: PLATFORM_CASH)
      insert into public.financial_ledger (
        booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
      ) values (
        v_booking.id, v_quote.id, v_booking.payment_attempt_id, 'refund_debit',
        'HOST_ESCROW_PAYABLE', 'PLATFORM_CASH', v_quote.host_payout_amount, v_quote.currency,
        jsonb_build_object('cancellation_by', 'guest', 'reason', p_reason)
      );

      -- Entry B: Reverse Platform Fee (Debit: PLATFORM_SERVICE_FEE_REVENUE, Credit: PLATFORM_CASH)
      if v_quote.host_service_fee_amount > 0 then
        insert into public.financial_ledger (
          booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
        ) values (
          v_booking.id, v_quote.id, v_booking.payment_attempt_id, 'refund_debit',
          'PLATFORM_SERVICE_FEE_REVENUE', 'PLATFORM_CASH', v_quote.host_service_fee_amount, v_quote.currency,
          jsonb_build_object('cancellation_by', 'guest', 'fee_reversal', true)
        );
      end if;
    end if;
  end if;

  update public.bookings
  set status = 'cancelled',
      updated_at = now()
  where id = v_booking.id
  returning * into v_booking;

  if v_booking.quote_id is not null then
    update public.booking_quotes
    set status = 'cancelled',
        updated_at = now()
    where id = v_booking.quote_id;
  end if;

  -- Notify host
  select e.user_id into v_host_id
  from public.experiences e
  where e.id = v_booking.experience_id;

  if v_host_id is not null then
    begin
      insert into public.notifications (
        user_id,
        type,
        title,
        message,
        action_type,
        action_id,
        metadata
      ) values (
        v_host_id,
        'booking_cancelled',
        'Reservation Cancelled',
        coalesce('Reservation for "' || v_booking.trip_title || '" was cancelled by the guest.', 'Reservation cancelled'),
        'booking',
        v_booking.id,
        jsonb_build_object('booking_id', v_booking.id, 'reason', p_reason)
      );
    exception when others then
      null;
    end;
  end if;

  return v_booking;
end;
$$;

-- 7. Updated host_decline_booking with Automated Refund Record and Ledger Balancing
create or replace function public.host_decline_booking(
  p_booking_id uuid,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_quote public.booking_quotes%rowtype;
  v_is_auth boolean;
begin
  if v_host_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  v_is_auth := public.is_booking_host(p_booking_id, v_host_id);
  if not v_is_auth then
    raise exception 'You are not authorized to manage this booking' using errcode = '42501';
  end if;

  if v_booking.status in ('cancelled', 'declined', 'completed', 'refunded') then
    return v_booking;
  end if;

  -- Cancel scheduled payouts
  update public.host_payouts
  set status = 'cancelled',
      failure_reason = coalesce(p_reason, 'Reservation declined by host')
  where booking_id = v_booking.id and status = 'scheduled';

  -- If booking was paid, create refund request & balance the ledger
  if v_booking.status in ('paid', 'confirmed') and v_booking.quote_id is not null then
    select bq.* into v_quote
    from public.booking_quotes bq
    where bq.id = v_booking.quote_id;

    if found then
      -- 1. Insert Refund Request for Paystack Processing
      insert into public.refund_requests (
        booking_id,
        quote_id,
        payment_attempt_id,
        guest_id,
        amount,
        currency,
        reason,
        status
      ) values (
        v_booking.id,
        v_quote.id,
        v_booking.payment_attempt_id,
        v_booking.user_id,
        v_quote.total_amount,
        v_quote.currency,
        coalesce(p_reason, 'Host declined reservation'),
        'pending'
      ) on conflict do nothing;

      -- 2. Record Double-Entry Ledger Balancing Entries for Refund
      insert into public.financial_ledger (
        booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
      ) values (
        v_booking.id, v_quote.id, v_booking.payment_attempt_id, 'refund_debit',
        'HOST_ESCROW_PAYABLE', 'PLATFORM_CASH', v_quote.host_payout_amount, v_quote.currency,
        jsonb_build_object('cancellation_by', 'host', 'reason', p_reason)
      );

      if v_quote.host_service_fee_amount > 0 then
        insert into public.financial_ledger (
          booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
        ) values (
          v_booking.id, v_quote.id, v_booking.payment_attempt_id, 'refund_debit',
          'PLATFORM_SERVICE_FEE_REVENUE', 'PLATFORM_CASH', v_quote.host_service_fee_amount, v_quote.currency,
          jsonb_build_object('cancellation_by', 'host', 'fee_reversal', true)
        );
      end if;
    end if;
  end if;

  update public.bookings
  set status = 'cancelled',
      updated_at = now()
  where id = v_booking.id
  returning * into v_booking;

  if v_booking.quote_id is not null then
    update public.booking_quotes
    set status = 'cancelled',
        updated_at = now()
    where id = v_booking.quote_id;
  end if;

  begin
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      action_type,
      action_id,
      metadata
    ) values (
      v_booking.user_id,
      'booking_declined',
      'Reservation Declined',
      coalesce('Your reservation for "' || v_booking.trip_title || '" was declined by the host.', 'Reservation declined'),
      'booking',
      v_booking.id,
      jsonb_build_object('booking_id', v_booking.id, 'reason', p_reason)
    );
  exception when others then
    null;
  end;

  return v_booking;
end;
$$;

create or replace function public.host_cancel_booking(
  p_booking_id uuid,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.host_decline_booking(p_booking_id, p_reason);
end;
$$;

-- 8. Updated settle_paystack_success using schedule_pending_host_payouts
create or replace function public.settle_paystack_success(
  p_provider_reference text,
  p_provider_charge_id text,
  p_paystack_response jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.payment_attempts%rowtype;
  v_quote public.booking_quotes%rowtype;
  v_experience record;
  v_booking_id uuid;
  v_trip_title text;
begin
  select pa.* into v_attempt
  from public.payment_attempts pa
  where pa.provider_reference = p_provider_reference
  for update;

  if not found then
    raise exception 'Payment attempt with reference % not found', p_provider_reference using errcode = 'P0002';
  end if;

  if v_attempt.status = 'succeeded' then
    select b.id into v_booking_id
    from public.bookings b
    where b.payment_attempt_id = v_attempt.id;
    if v_booking_id is not null then
      return v_booking_id;
    end if;
  end if;

  if v_attempt.status not in ('created', 'pending') then
    raise exception 'Payment attempt % cannot be settled from status %', p_provider_reference, v_attempt.status using errcode = 'P0001';
  end if;

  select bq.* into v_quote
  from public.booking_quotes bq
  where bq.id = v_attempt.quote_id
  for update;

  if not found then
    raise exception 'Associated quote not found' using errcode = 'P0002';
  end if;

  if v_quote.status in ('consumed', 'payment_succeeded') then
    select b.id into v_booking_id
    from public.bookings b
    where b.quote_id = v_quote.id;
    if v_booking_id is not null then
      return v_booking_id;
    end if;
  end if;

  select e.title into v_experience
  from public.experiences e
  where e.id = v_quote.experience_id;

  v_trip_title := coalesce(v_experience.title, 'Stay Booking');

  insert into public.bookings (
    user_id,
    experience_id,
    trip_title,
    amount,
    guests,
    check_in,
    check_out,
    status,
    quote_id,
    payment_attempt_id
  ) values (
    v_quote.guest_id,
    v_quote.experience_id,
    v_trip_title,
    round(v_quote.total_amount / 100.0, 2),
    v_quote.guest_count,
    v_quote.check_in,
    v_quote.check_out,
    'paid',
    v_quote.id,
    v_attempt.id
  ) returning id into v_booking_id;

  update public.payment_attempts pa
  set status = 'succeeded',
      provider_charge_id = coalesce(p_provider_charge_id, pa.provider_charge_id),
      provider_response = coalesce(p_paystack_response, pa.provider_response),
      succeeded_at = now()
  where pa.id = v_attempt.id;

  update public.booking_quotes bq
  set status = 'consumed'
  where bq.id = v_quote.id;

  -- 4. Record double-entry financial ledger entries
  -- Entry 1: Guest Payment (Debit: PAYSTACK_CLEARING, Credit: PLATFORM_CASH)
  insert into public.financial_ledger (
    booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
  ) values (
    v_booking_id, v_quote.id, v_attempt.id, 'guest_payment', 'PAYSTACK_CLEARING', 'PLATFORM_CASH', v_quote.total_amount, v_quote.currency,
    jsonb_build_object('guest_id', v_quote.guest_id)
  );

  -- Entry 2: Host Escrow Credit (Debit: PLATFORM_CASH, Credit: HOST_ESCROW_PAYABLE)
  insert into public.financial_ledger (
    booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
  ) values (
    v_booking_id, v_quote.id, v_attempt.id, 'host_escrow_credit', 'PLATFORM_CASH', 'HOST_ESCROW_PAYABLE', v_quote.host_payout_amount, v_quote.currency,
    jsonb_build_object('host_id', v_quote.host_id, 'host_service_fee', v_quote.host_service_fee_amount)
  );

  -- Entry 3: Platform Service Fee Revenue (Debit: PLATFORM_CASH, Credit: PLATFORM_SERVICE_FEE_REVENUE)
  if v_quote.host_service_fee_amount > 0 then
    insert into public.financial_ledger (
      booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
    ) values (
      v_booking_id, v_quote.id, v_attempt.id, 'platform_fee_revenue', 'PLATFORM_CASH', 'PLATFORM_SERVICE_FEE_REVENUE', v_quote.host_service_fee_amount, v_quote.currency,
      jsonb_build_object('fee_bps', (v_quote.pricing_snapshot->>'host_fee_bps')::integer)
    );
  end if;

  -- 5. Schedule Host Payout via the central scheduler RPC
  perform public.schedule_pending_host_payouts(v_quote.host_id);

  return v_booking_id;
end;
$$;

-- Permissions
grant execute on function public.schedule_pending_host_payouts(uuid) to authenticated, service_role;
grant execute on function public.create_booking_quote(uuid, timestamptz, timestamptz, integer, uuid) to authenticated;
grant execute on function public.guest_cancel_booking(uuid, text) to authenticated;
grant execute on function public.host_decline_booking(uuid, text) to authenticated;
grant execute on function public.host_cancel_booking(uuid, text) to authenticated;
grant execute on function public.settle_paystack_success(text, text, jsonb) to service_role;

