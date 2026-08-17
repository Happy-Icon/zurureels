-- Migration: 202608180002_booking_lifecycle_availability_hardening.sql
-- Booking lifecycle, authoritative server availability, refund state machine, and Google Calendar foundation.
-- The database remains the sole authority for dates, booking transitions, and money movement.

-- 1. Durable record of server-owned status changes for support and incident audit review.
create table if not exists public.booking_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('guest', 'host', 'system', 'payment_provider')),
  reason text,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create index if not exists booking_lifecycle_events_booking_created_idx
  on public.booking_lifecycle_events (booking_id, created_at desc);

alter table public.booking_lifecycle_events enable row level security;
drop policy if exists "Booking participants can read lifecycle events" on public.booking_lifecycle_events;
create policy "Booking participants can read lifecycle events"
  on public.booking_lifecycle_events for select to authenticated
  using (
    exists (
      select 1 from public.bookings b
      left join public.booking_quotes q on q.id = b.quote_id
      left join public.experiences e on e.id = b.experience_id
      where b.id = booking_lifecycle_events.booking_id
        and (b.user_id = auth.uid() or q.host_id = auth.uid() or e.user_id = auth.uid())
    )
  );

-- 2. Google Calendar External Calendar Blocks Foundation
-- Stores imported busy/free time blocks without PII for unified availability checks.
create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google' check (provider in ('google', 'ical')),
  calendar_id text not null,
  calendar_name text not null default 'ZuruSasa Bookings',
  sync_token text,
  channel_id text,
  channel_expiration timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_connections_host_idx
  on public.calendar_connections (host_id, is_active);

alter table public.calendar_connections enable row level security;
drop policy if exists "Hosts can manage their calendar connections" on public.calendar_connections;
create policy "Hosts can manage their calendar connections"
  on public.calendar_connections for all to authenticated
  using (host_id = auth.uid());

create table if not exists public.external_calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  connection_id uuid references public.calendar_connections(id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date > start_date),
  created_at timestamptz not null default now()
);

create index if not exists external_calendar_blocks_exp_idx
  on public.external_calendar_blocks (experience_id, start_date, end_date);

alter table public.external_calendar_blocks enable row level security;
drop policy if exists "External calendar blocks are readable by everyone" on public.external_calendar_blocks;
create policy "External calendar blocks are readable by everyone"
  on public.external_calendar_blocks for select
  using (true);

-- 3. A booking must never have more than one live refund request.
create unique index if not exists refund_requests_one_live_booking_idx
  on public.refund_requests (booking_id)
  where status in ('pending', 'processing', 'success');

-- 4. Host Blocked Dates GiST Exclusive Constraint
alter table public.host_blocked_dates
  drop constraint if exists host_blocked_dates_active_excl;
alter table public.host_blocked_dates
  add constraint host_blocked_dates_active_excl
  exclude using gist (
    experience_id with =,
    daterange(start_date, end_date, '[)') with &&
  );

-- Revoke direct mutation permissions on bookings and blocked dates
revoke insert, update, delete on public.bookings from anon, authenticated;
revoke insert, update, delete on public.host_blocked_dates from anon, authenticated;

-- 5. Authoritative Server-Side Availability RPC
create or replace function public.get_experience_unavailable_dates(
  p_experience_id uuid
)
returns table (
  start_date date,
  end_date date,
  reason text,
  block_type text
)
language sql
security definer
set search_path = public
as $$
  -- A. Manual host blocked dates
  select
    h.start_date,
    h.end_date,
    h.reason,
    'host_blocked' as block_type
  from public.host_blocked_dates h
  where h.experience_id = p_experience_id

  union all

  -- B. Active bookings (paid, confirmed, completed, refund_pending)
  select
    b.check_in::date as start_date,
    b.check_out::date as end_date,
    'Reserved' as reason,
    'booking' as block_type
  from public.bookings b
  where b.experience_id = p_experience_id
    and coalesce(b.status, 'pending') not in ('cancelled', 'refunded', 'failed')

  union all

  -- C. In-flight active quotes (held during checkout)
  select
    q.check_in::date as start_date,
    q.check_out::date as end_date,
    'Checkout in progress' as reason,
    'quote_hold' as block_type
  from public.booking_quotes q
  where q.experience_id = p_experience_id
    and q.status in ('quote_locked', 'payment_pending', 'payment_succeeded')
    and q.expires_at > now()

  union all

  -- D. External calendar busy blocks (Google Calendar / iCal sync)
  select
    eb.start_date,
    eb.end_date,
    'External block' as reason,
    'external_calendar' as block_type
  from public.external_calendar_blocks eb
  where eb.experience_id = p_experience_id;
$$;

-- 6. Authoritative create_booking_quote RPC
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
  v_setting jsonb;
  v_free_cancellation_until timestamptz;
begin
  if v_guest_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;
  if p_idempotency_key is null then
    raise exception 'An idempotency key is required' using errcode = '22023';
  end if;
  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in
     or p_check_in < (now() - interval '1 day')
     or p_guest_count is null or p_guest_count < 1 or p_guest_count > 30 then
    raise exception 'Invalid booking dates or guest count' using errcode = '22023';
  end if;

  perform public.expire_booking_quotes();

  select * into v_quote from public.booking_quotes
  where guest_id = v_guest_id and idempotency_key = p_idempotency_key;
  if found then return v_quote; end if;

  -- Both quote creation and host blocking take this lock first.
  select e.id, e.user_id, e.current_price, e.price_unit, e.availability_status
  into v_experience from public.experiences e
  where e.id = p_experience_id for update;
  if not found then raise exception 'Listing not found' using errcode = 'P0002'; end if;
  if v_experience.user_id = v_guest_id then
    raise exception 'Hosts cannot book their own listing' using errcode = '22023';
  end if;
  if coalesce(v_experience.availability_status, 'available') <> 'available' then
    raise exception 'Listing is not available' using errcode = 'P0001';
  end if;

  -- Verify against host blocked dates
  if exists (
    select 1 from public.host_blocked_dates h
    where h.experience_id = p_experience_id
      and h.start_date < p_check_out::date
      and h.end_date > p_check_in::date
  ) then
    raise exception 'Those dates are blocked by the host' using errcode = 'P0001';
  end if;

  -- Verify against active bookings
  if exists (
    select 1 from public.bookings b
    where b.experience_id = p_experience_id
      and coalesce(b.status, 'pending') not in ('cancelled', 'refunded', 'failed')
      and b.check_in < p_check_out and b.check_out > p_check_in
  ) then
    raise exception 'Those dates are no longer available' using errcode = 'P0001';
  end if;

  -- Verify against external calendar blocks
  if exists (
    select 1 from public.external_calendar_blocks eb
    where eb.experience_id = p_experience_id
      and eb.start_date < p_check_out::date
      and eb.end_date > p_check_in::date
  ) then
    raise exception 'Those dates are blocked by external calendar sync' using errcode = 'P0001';
  end if;

  if v_experience.current_price is null or v_experience.current_price < 0 then
    raise exception 'Listing price is unavailable' using errcode = 'P0001';
  end if;

  select value into v_setting from public.platform_settings where key = 'commission';
  if v_setting ? 'host_fee_bps' then v_host_fee_bps := (v_setting->>'host_fee_bps')::integer; end if;
  if v_host_fee_bps < 0 or v_host_fee_bps > 10000 then
    raise exception 'Invalid platform commission configuration' using errcode = 'P0001';
  end if;

  v_units := case when lower(coalesce(v_experience.price_unit, 'night')) in ('night', 'nights', 'per_night')
    then greatest(1, ceil(extract(epoch from (p_check_out - p_check_in)) / 86400.0)::integer)
    else p_guest_count end;
  v_subtotal := round(v_experience.current_price * v_units * 100)::bigint;
  v_host_fee := round(v_subtotal * (v_host_fee_bps / 10000.0))::bigint;
  v_free_cancellation_until := least(p_check_in, now() + interval '24 hours');

  insert into public.booking_quotes (
    guest_id, host_id, experience_id, idempotency_key, check_in, check_out, guest_count,
    pricing_snapshot, cancellation_policy_snapshot, subtotal_amount, guest_service_fee_amount,
    tax_amount, total_amount, host_service_fee_amount, host_payout_amount
  ) values (
    v_guest_id, v_experience.user_id, p_experience_id, p_idempotency_key, p_check_in, p_check_out, p_guest_count,
    jsonb_build_object('listing_unit_price', v_experience.current_price, 'listing_price_unit', coalesce(v_experience.price_unit, 'night'), 'units', v_units, 'currency', 'KES', 'price_scale', 100, 'host_fee_bps', v_host_fee_bps),
    jsonb_build_object('version', 'v2', 'free_cancellation_until', v_free_cancellation_until, 'after_free_cancellation_refund_bps', 0, 'policy_note', 'Full refund until the recorded cutoff; no automatic refund after it.'),
    v_subtotal, 0, 0, v_subtotal, v_host_fee, v_subtotal - v_host_fee
  ) returning * into v_quote;
  return v_quote;
end;
$$;

-- 7. Host Block Dates RPC
create or replace function public.block_host_dates(
  p_experience_id uuid,
  p_start_date date,
  p_end_date date,
  p_reason text default 'Personal use'
)
returns public.host_blocked_dates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid := auth.uid();
  v_block public.host_blocked_dates%rowtype;
begin
  if v_host_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date then
    raise exception 'Invalid date range' using errcode = '22023';
  end if;
  perform 1 from public.experiences e where e.id = p_experience_id and e.user_id = v_host_id for update;
  if not found then raise exception 'Listing not found or permission denied' using errcode = '42501'; end if;

  if exists (
    select 1 from public.bookings b where b.experience_id = p_experience_id
      and coalesce(b.status, 'pending') not in ('cancelled', 'refunded', 'failed')
      and b.check_in::date < p_end_date and b.check_out::date > p_start_date
  ) or exists (
    select 1 from public.booking_quotes q where q.experience_id = p_experience_id
      and q.status in ('quote_locked', 'payment_pending', 'payment_succeeded', 'confirmed')
      and q.expires_at > now() and q.check_in::date < p_end_date and q.check_out::date > p_start_date
  ) then
    raise exception 'Dates contain an active reservation or checkout in progress' using errcode = 'P0001';
  end if;

  insert into public.host_blocked_dates (experience_id, host_id, start_date, end_date, reason)
  values (p_experience_id, v_host_id, p_start_date, p_end_date, coalesce(nullif(trim(p_reason), ''), 'Personal use'))
  returning * into v_block;
  return v_block;
end;
$$;

create or replace function public.unblock_host_dates(
  p_block_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid := auth.uid();
begin
  if v_host_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  delete from public.host_blocked_dates
  where id = p_block_id and host_id = v_host_id;
  return found;
end;
$$;

-- 8. Host Confirm Booking (paid -> confirmed)
create or replace function public.host_confirm_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
begin
  if v_host_id is null then raise exception 'Authentication is required' using errcode = '28000'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if not public.is_booking_host(p_booking_id, v_host_id) then
    raise exception 'You are not authorized to manage this booking' using errcode = '42501';
  end if;
  if v_booking.status = 'confirmed' then return v_booking; end if;
  if v_booking.status <> 'paid' then
    raise exception 'Only a paid booking can be confirmed' using errcode = 'P0001';
  end if;

  update public.bookings set status = 'confirmed', updated_at = now() where id = v_booking.id returning * into v_booking;
  if v_booking.quote_id is not null then
    update public.booking_quotes set status = 'confirmed', updated_at = now() where id = v_booking.quote_id;
  end if;

  -- Schedule host payout now that booking is confirmed
  perform public.schedule_pending_host_payouts(v_host_id);

  insert into public.booking_lifecycle_events (booking_id, from_status, to_status, actor_id, actor_type)
  values (v_booking.id, 'paid', 'confirmed', v_host_id, 'host');

  insert into public.notifications (user_id, type, title, message, action_type, action_id, metadata)
  values (v_booking.user_id, 'booking_confirmed', 'Reservation Confirmed! 🎉',
    coalesce('Your reservation for "' || v_booking.trip_title || '" was confirmed by the host.', 'Reservation confirmed'),
    'booking', v_booking.id, jsonb_build_object('booking_id', v_booking.id));

  return v_booking;
end;
$$;

-- 9. Guest Cancel Booking (paid/confirmed -> refund_pending or cancelled)
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
  v_target_status text := 'cancelled';
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

  if v_booking.status in ('cancelled', 'declined', 'completed', 'refunded', 'refund_pending') then
    return v_booking;
  end if;

  -- Cancel scheduled payouts
  update public.host_payouts
  set status = 'cancelled',
      failure_reason = coalesce(p_reason, 'Guest cancelled reservation')
  where booking_id = v_booking.id and status = 'scheduled';

  -- If booking was paid or confirmed, create refund request & balance the ledger
  if v_booking.status in ('paid', 'confirmed') and v_booking.quote_id is not null then
    v_target_status := 'refund_pending';

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
      insert into public.financial_ledger (
        booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
      ) values (
        v_booking.id, v_quote.id, v_booking.payment_attempt_id, 'refund_debit',
        'HOST_ESCROW_PAYABLE', 'PLATFORM_CASH', v_quote.host_payout_amount, v_quote.currency,
        jsonb_build_object('cancellation_by', 'guest', 'reason', p_reason)
      );

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

  insert into public.booking_lifecycle_events (booking_id, from_status, to_status, actor_id, actor_type, reason)
  values (v_booking.id, v_booking.status, v_target_status, v_user_id, 'guest', p_reason);

  update public.bookings
  set status = v_target_status,
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

-- 10. Host Decline Booking (paid -> refund_pending or cancelled)
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
  v_target_status text := 'cancelled';
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

  if v_booking.status in ('cancelled', 'declined', 'completed', 'refunded', 'refund_pending') then
    return v_booking;
  end if;

  -- Cancel scheduled payouts
  update public.host_payouts
  set status = 'cancelled',
      failure_reason = coalesce(p_reason, 'Reservation declined by host')
  where booking_id = v_booking.id and status = 'scheduled';

  -- If booking was paid, create refund request & balance the ledger
  if v_booking.status in ('paid', 'confirmed') and v_booking.quote_id is not null then
    v_target_status := 'refund_pending';

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

  insert into public.booking_lifecycle_events (booking_id, from_status, to_status, actor_id, actor_type, reason)
  values (v_booking.id, v_booking.status, v_target_status, v_host_id, 'host', p_reason);

  update public.bookings
  set status = v_target_status,
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

-- 11. Schedule Pending Host Payouts (Only for confirmed / completed bookings)
create or replace function public.schedule_pending_host_payouts(p_host_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient record;
  v_booking record;
  v_count integer := 0;
begin
  if p_host_id is null then raise exception 'Host ID is required' using errcode = '22023'; end if;
  if auth.role() = 'authenticated' and auth.uid() <> p_host_id then
    raise exception 'You are not authorized to schedule another host''s payouts' using errcode = '42501';
  end if;

  select recipient_code into v_recipient from public.host_payout_recipients
  where host_id = p_host_id and is_active = true order by created_at desc limit 1;
  if v_recipient.recipient_code is null then return 0; end if;

  for v_booking in
    select b.id booking_id, b.check_out, q.host_id, q.host_payout_amount, q.currency
    from public.bookings b join public.booking_quotes q on q.id = b.quote_id
    where q.host_id = p_host_id and b.status in ('confirmed', 'completed') and q.host_payout_amount > 0
      and not exists (select 1 from public.host_payouts hp where hp.booking_id = b.id and hp.status in ('scheduled', 'processing', 'success'))
  loop
    insert into public.host_payouts (host_id, booking_id, recipient_code, amount, currency, scheduled_for, status)
    values (v_booking.host_id, v_booking.booking_id, v_recipient.recipient_code, v_booking.host_payout_amount,
      coalesce(v_booking.currency, 'KES'), greatest(now(), v_booking.check_out + interval '24 hours'), 'scheduled')
    on conflict do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- 12. Complete Due Bookings (confirmed -> completed when check_out <= now())
create or replace function public.complete_due_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  with completed as (
    update public.bookings
    set status = 'completed', updated_at = now()
    where status = 'confirmed' and check_out <= now()
    returning id
  )
  insert into public.booking_lifecycle_events (booking_id, from_status, to_status, actor_type)
  select id, 'confirmed', 'completed', 'system' from completed;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Permissions
grant execute on function public.get_experience_unavailable_dates(uuid) to anon, authenticated, service_role;
grant execute on function public.create_booking_quote(uuid, timestamptz, timestamptz, integer, uuid) to authenticated;
grant execute on function public.block_host_dates(uuid, date, date, text) to authenticated;
grant execute on function public.unblock_host_dates(uuid) to authenticated;
grant execute on function public.host_confirm_booking(uuid) to authenticated;
grant execute on function public.guest_cancel_booking(uuid, text) to authenticated;
grant execute on function public.host_decline_booking(uuid, text) to authenticated;
grant execute on function public.host_cancel_booking(uuid, text) to authenticated;
grant execute on function public.schedule_pending_host_payouts(uuid) to authenticated, service_role;
grant execute on function public.complete_due_bookings() to service_role;
