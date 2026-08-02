-- Phase 1: server-owned booking quotes and payment attempts.
--
-- This migration is additive. Existing bookings remain readable and usable by
-- the current application while new checkout work moves onto these records.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.booking_quotes (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references auth.users(id) on delete restrict,
  host_id uuid not null references auth.users(id) on delete restrict,
  experience_id uuid not null references public.experiences(id) on delete restrict,
  idempotency_key uuid not null,
  currency text not null default 'KES' check (currency = 'KES'),
  check_in timestamptz not null,
  check_out timestamptz not null,
  guest_count integer not null check (guest_count > 0 and guest_count <= 30),
  pricing_snapshot jsonb not null,
  cancellation_policy_snapshot jsonb not null,
  subtotal_amount bigint not null check (subtotal_amount >= 0),
  guest_service_fee_amount bigint not null default 0 check (guest_service_fee_amount >= 0),
  tax_amount bigint not null default 0 check (tax_amount >= 0),
  total_amount bigint not null check (total_amount >= 0),
  host_service_fee_amount bigint not null check (host_service_fee_amount >= 0),
  host_payout_amount bigint not null check (host_payout_amount >= 0),
  status text not null default 'quote_locked' check (
    status in ('quote_locked', 'payment_pending', 'payment_succeeded', 'expired', 'cancelled', 'consumed')
  ),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in),
  check (total_amount = subtotal_amount + guest_service_fee_amount + tax_amount),
  check (host_payout_amount = subtotal_amount - host_service_fee_amount)
);

create unique index if not exists booking_quotes_guest_idempotency_key_idx
  on public.booking_quotes (guest_id, idempotency_key);

create index if not exists booking_quotes_experience_dates_idx
  on public.booking_quotes using gist (experience_id, tstzrange(check_in, check_out, '[)'));

-- Active quotes reserve dates. Expired quotes are transitioned by
-- expire_booking_quotes before each quote is created and by a scheduled job.
alter table public.booking_quotes
  drop constraint if exists booking_quotes_active_dates_excl;

alter table public.booking_quotes
  add constraint booking_quotes_active_dates_excl
  exclude using gist (
    experience_id with =,
    tstzrange(check_in, check_out, '[)') with &&
  ) where (status in ('quote_locked', 'payment_pending', 'payment_succeeded'));

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.booking_quotes(id) on delete restrict,
  guest_id uuid not null references auth.users(id) on delete restrict,
  provider text not null check (provider in ('paystack')),
  provider_reference text not null unique,
  idempotency_key uuid not null,
  amount bigint not null check (amount >= 0),
  currency text not null default 'KES' check (currency = 'KES'),
  status text not null default 'created' check (
    status in ('created', 'pending', 'succeeded', 'failed', 'expired', 'cancelled')
  ),
  provider_charge_id text,
  provider_status text,
  display_text text,
  failure_code text,
  failure_message text,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  succeeded_at timestamptz,
  failed_at timestamptz,
  unique (quote_id, idempotency_key)
);

create index if not exists payment_attempts_quote_status_idx
  on public.payment_attempts (quote_id, status, created_at desc);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paystack')),
  provider_event_key text not null unique,
  event_type text not null,
  provider_reference text,
  payload jsonb not null,
  payload_sha256 text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create index if not exists payment_events_reference_idx
  on public.payment_events (provider_reference, received_at desc);

-- The new flow records the source quote on new bookings without disturbing
-- historical bookings that were created by the current mobile client.
alter table public.bookings
  add column if not exists quote_id uuid references public.booking_quotes(id) on delete restrict;

alter table public.bookings
  add column if not exists payment_attempt_id uuid references public.payment_attempts(id) on delete restrict;

create unique index if not exists bookings_quote_id_idx
  on public.bookings (quote_id)
  where quote_id is not null;

alter table public.booking_quotes enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_events enable row level security;

drop policy if exists "Guests can read their booking quotes" on public.booking_quotes;
create policy "Guests can read their booking quotes"
  on public.booking_quotes for select
  using (guest_id = auth.uid());

drop policy if exists "Hosts can read their booking quotes" on public.booking_quotes;
create policy "Hosts can read their booking quotes"
  on public.booking_quotes for select
  using (host_id = auth.uid());

drop policy if exists "Guests can read their payment attempts" on public.payment_attempts;
create policy "Guests can read their payment attempts"
  on public.payment_attempts for select
  using (guest_id = auth.uid());

-- Payment event payloads are provider/audit data and are intentionally not
-- readable or writable by clients.

create or replace function public.touch_marketplace_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists booking_quotes_touch_updated_at on public.booking_quotes;
create trigger booking_quotes_touch_updated_at
before update on public.booking_quotes
for each row execute function public.touch_marketplace_updated_at();

drop trigger if exists payment_attempts_touch_updated_at on public.payment_attempts;
create trigger payment_attempts_touch_updated_at
before update on public.payment_attempts
for each row execute function public.touch_marketplace_updated_at();

create or replace function public.expire_booking_quotes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_quotes_count integer;
  expired_attempts_count integer;
begin
  update public.booking_quotes bq
  set status = 'expired'
  where bq.status in ('quote_locked', 'payment_pending')
    and bq.expires_at <= now();

  get diagnostics expired_quotes_count = row_count;

  update public.payment_attempts pa
  set status = 'expired',
      failed_at = coalesce(pa.failed_at, now())
  from public.booking_quotes bq
  where pa.quote_id = bq.id
    and bq.status = 'expired'
    and pa.status in ('created', 'pending');

  get diagnostics expired_attempts_count = row_count;

  return expired_quotes_count;
end;
$$;

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
  v_host_fee bigint;
  v_existing_booking boolean;
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

  -- Lock the listing row so two quote requests cannot both pass availability
  -- checks before their exclusion constraint is evaluated.
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

  -- Existing listing prices are stored in whole KES; financial tables store
  -- all values in minor units to avoid floating point arithmetic.
  v_subtotal := round(v_experience.current_price * v_units * 100)::bigint;
  v_host_fee := round(v_subtotal * 0.15)::bigint;

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
      'host_fee_bps', 1500
    ),
    jsonb_build_object(
      'version', 'v1',
      'free_cancellation_until', null,
      'policy_note', 'Policy rules will be enforced by the refund workflow.'
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

create or replace function public.begin_payment_attempt(
  p_quote_id uuid,
  p_idempotency_key uuid
)
returns public.payment_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_id uuid := auth.uid();
  v_quote public.booking_quotes%rowtype;
  v_attempt public.payment_attempts%rowtype;
  v_has_active_attempt boolean;
begin
  if v_guest_id is null then
    raise exception 'Authentication is required' using errcode = '28000';
  end if;

  if p_idempotency_key is null then
    raise exception 'An idempotency key is required' using errcode = '22023';
  end if;

  perform public.expire_booking_quotes();

  -- Check if attempt already exists for this (quote_id, idempotency_key)
  select pa.* into v_attempt
  from public.payment_attempts pa
  where pa.quote_id = p_quote_id
    and pa.idempotency_key = p_idempotency_key;

  if found then
    if v_attempt.status in ('created', 'pending', 'succeeded') then
      return v_attempt;
    else
      raise exception 'Payment attempt with this idempotency key was % and cannot be re-submitted', v_attempt.status using errcode = '22023';
    end if;
  end if;

  select bq.* into v_quote
  from public.booking_quotes bq
  where bq.id = p_quote_id
    and bq.guest_id = v_guest_id
  for update;

  if not found then
    raise exception 'Booking quote not found' using errcode = 'P0002';
  end if;

  if v_quote.expires_at <= now() then
    update public.booking_quotes set status = 'expired' where id = v_quote.id;
    raise exception 'Booking quote has expired' using errcode = 'P0001';
  end if;

  -- If quote is in payment_pending state but has no active in-flight attempt,
  -- reset status to quote_locked so a new attempt with a fresh idempotency key can proceed.
  if v_quote.status = 'payment_pending' then
    select exists (
      select 1 from public.payment_attempts pa
      where pa.quote_id = v_quote.id and pa.status in ('created', 'pending')
    ) into v_has_active_attempt;

    if not v_has_active_attempt then
      update public.booking_quotes set status = 'quote_locked' where id = v_quote.id;
      v_quote.status := 'quote_locked';
    else
      raise exception 'A payment attempt is already in progress for this quote' using errcode = 'P0001';
    end if;
  end if;

  if v_quote.status <> 'quote_locked' then
    raise exception 'Booking quote status (%) does not allow payment', v_quote.status using errcode = 'P0001';
  end if;

  insert into public.payment_attempts (
    quote_id,
    guest_id,
    provider,
    provider_reference,
    idempotency_key,
    amount,
    currency
  ) values (
    v_quote.id,
    v_guest_id,
    'paystack',
    'zuru_' || replace(gen_random_uuid()::text, '-', ''),
    p_idempotency_key,
    v_quote.total_amount,
    v_quote.currency
  ) returning * into v_attempt;

  update public.booking_quotes
  set status = 'payment_pending'
  where id = v_quote.id;

  return v_attempt;
end;
$$;

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

  return v_booking_id;
end;
$$;

create or replace function public.settle_paystack_failure(
  p_provider_reference text,
  p_failure_code text,
  p_failure_message text,
  p_paystack_response jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.payment_attempts%rowtype;
  v_quote public.booking_quotes%rowtype;
begin
  select pa.* into v_attempt
  from public.payment_attempts pa
  where pa.provider_reference = p_provider_reference
  for update;

  if not found then
    return false;
  end if;

  if v_attempt.status = 'succeeded' then
    return false;
  end if;

  update public.payment_attempts pa
  set status = 'failed',
      failure_code = p_failure_code,
      failure_message = p_failure_message,
      provider_response = coalesce(p_paystack_response, pa.provider_response),
      failed_at = now()
  where pa.id = v_attempt.id;

  select bq.* into v_quote
  from public.booking_quotes bq
  where bq.id = v_attempt.quote_id
  for update;

  if found and v_quote.status = 'payment_pending' then
    if v_quote.expires_at > now() then
      update public.booking_quotes bq
      set status = 'quote_locked'
      where bq.id = v_quote.id;
    else
      update public.booking_quotes bq
      set status = 'expired'
      where bq.id = v_quote.id;
    end if;
  end if;

  return true;
end;
$$;

revoke all on function public.expire_booking_quotes() from public;
revoke all on function public.create_booking_quote(uuid, timestamptz, timestamptz, integer, uuid) from public;
revoke all on function public.begin_payment_attempt(uuid, uuid) from public;
revoke all on function public.settle_paystack_success(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.settle_paystack_failure(text, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.create_booking_quote(uuid, timestamptz, timestamptz, integer, uuid) to authenticated;
grant execute on function public.begin_payment_attempt(uuid, uuid) to authenticated;
