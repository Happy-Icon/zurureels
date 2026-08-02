-- Phase 2: Double-Entry Financial Ledger, Host Payout Onboarding, and Strict Lifecycle RPCs

-- 1. Host Payout Recipients Table (Paystack Transfer Recipients)
create table if not exists public.host_payout_recipients (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete restrict,
  provider text not null check (provider in ('paystack')),
  recipient_code text not null unique,
  account_name text not null,
  account_number text not null,
  bank_code text not null default 'MPESA',
  currency text not null default 'KES' check (currency = 'KES'),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists host_payout_recipients_host_id_idx
  on public.host_payout_recipients (host_id, is_active);

alter table public.host_payout_recipients enable row level security;

drop policy if exists "Hosts can read their payout recipients" on public.host_payout_recipients;
create policy "Hosts can read their payout recipients"
  on public.host_payout_recipients for select
  using (host_id = auth.uid());

-- 2. Double-Entry Financial Ledger Table
create table if not exists public.financial_ledger (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete restrict,
  quote_id uuid references public.booking_quotes(id) on delete restrict,
  payment_attempt_id uuid references public.payment_attempts(id) on delete restrict,
  entry_type text not null check (
    entry_type in ('guest_payment', 'host_escrow_credit', 'platform_fee_revenue', 'host_payout_debit', 'refund_debit')
  ),
  debit_account text not null,
  credit_account text not null,
  amount bigint not null check (amount > 0),
  currency text not null default 'KES' check (currency = 'KES'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists financial_ledger_booking_id_idx
  on public.financial_ledger (booking_id, entry_type);

alter table public.financial_ledger enable row level security;

drop policy if exists "Hosts can read ledger entries for their bookings" on public.financial_ledger;
create policy "Hosts can read ledger entries for their bookings"
  on public.financial_ledger for select
  using (
    exists (
      select 1 from public.bookings b
      join public.booking_quotes bq on b.quote_id = bq.id
      where b.id = financial_ledger.booking_id and bq.host_id = auth.uid()
    )
  );

drop policy if exists "Guests can read ledger entries for their bookings" on public.financial_ledger;
create policy "Guests can read ledger entries for their bookings"
  on public.financial_ledger for select
  using (
    exists (
      select 1 from public.bookings b
      where b.id = financial_ledger.booking_id and b.user_id = auth.uid()
    )
  );

-- 3. Scheduled Host Payouts Table
create table if not exists public.host_payouts (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  recipient_code text not null,
  amount bigint not null check (amount > 0),
  currency text not null default 'KES' check (currency = 'KES'),
  provider_transfer_code text unique,
  status text not null default 'scheduled' check (
    status in ('scheduled', 'processing', 'success', 'failed', 'cancelled')
  ),
  scheduled_for timestamptz not null,
  processed_at timestamptz,
  failure_reason text,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists host_payouts_due_idx
  on public.host_payouts (status, scheduled_for)
  where status = 'scheduled';

create index if not exists host_payouts_host_id_idx
  on public.host_payouts (host_id, status);

alter table public.host_payouts enable row level security;

drop policy if exists "Hosts can read their payouts" on public.host_payouts;
create policy "Hosts can read their payouts"
  on public.host_payouts for select
  using (host_id = auth.uid());

-- Triggers for updated_at
drop trigger if exists host_payout_recipients_touch_updated_at on public.host_payout_recipients;
create trigger host_payout_recipients_touch_updated_at
before update on public.host_payout_recipients
for each row execute function public.touch_marketplace_updated_at();

drop trigger if exists host_payouts_touch_updated_at on public.host_payouts;
create trigger host_payouts_touch_updated_at
before update on public.host_payouts
for each row execute function public.touch_marketplace_updated_at();

-- Update settle_paystack_success to record double-entry ledger entries and schedule host payout
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
  v_host_recipient record;
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
  -- Entry 1: Guest Payment (Debit: Guest Wallet / Paystack Clearing, Credit: Platform Cash Clearing)
  insert into public.financial_ledger (
    booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
  ) values (
    v_booking_id, v_quote.id, v_attempt.id, 'guest_payment', 'PAYSTACK_CLEARING', 'PLATFORM_CASH', v_quote.total_amount, v_quote.currency,
    jsonb_build_object('guest_id', v_quote.guest_id)
  );

  -- Entry 2: Host Escrow Credit (Debit: Platform Cash, Credit: Host Escrow Payable)
  insert into public.financial_ledger (
    booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
  ) values (
    v_booking_id, v_quote.id, v_attempt.id, 'host_escrow_credit', 'PLATFORM_CASH', 'HOST_ESCROW_PAYABLE', v_quote.host_payout_amount, v_quote.currency,
    jsonb_build_object('host_id', v_quote.host_id, 'host_service_fee', v_quote.host_service_fee_amount)
  );

  -- Entry 3: Platform Service Fee Revenue (Debit: Platform Cash, Credit: Platform Revenue)
  insert into public.financial_ledger (
    booking_id, quote_id, payment_attempt_id, entry_type, debit_account, credit_account, amount, currency, metadata
  ) values (
    v_booking_id, v_quote.id, v_attempt.id, 'platform_fee_revenue', 'PLATFORM_CASH', 'PLATFORM_SERVICE_FEE_REVENUE', v_quote.host_service_fee_amount, v_quote.currency,
    jsonb_build_object('fee_bps', 1500)
  );

  -- 5. Schedule Host Payout (Scheduled for 24 hours after check_out)
  select r.recipient_code into v_host_recipient
  from public.host_payout_recipients r
  where r.host_id = v_quote.host_id and r.is_active = true
  order by r.created_at desc limit 1;

  if v_host_recipient.recipient_code is not null then
    insert into public.host_payouts (
      host_id, booking_id, recipient_code, amount, currency, scheduled_for
    ) values (
      v_quote.host_id, v_booking_id, v_host_recipient.recipient_code, v_quote.host_payout_amount, v_quote.currency,
      (v_quote.check_out + interval '24 hours')
    );
  end if;

  return v_booking_id;
end;
$$;

-- Strict Booking Transition RPCs for Hosts
create or replace function public.host_confirm_booking(
  p_booking_id uuid
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

  select bq.* into v_quote
  from public.booking_quotes bq
  where bq.id = v_booking.quote_id;

  if not found or v_quote.host_id <> v_host_id then
    raise exception 'You are not authorized to manage this booking' using errcode = '42501';
  end if;

  if v_booking.status not in ('paid', 'pending') then
    raise exception 'Booking status (%) cannot be confirmed', v_booking.status using errcode = 'P0001';
  end if;

  update public.bookings
  set status = 'confirmed'
  where id = v_booking.id
  returning * into v_booking;

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
declare
  v_host_id uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_quote public.booking_quotes%rowtype;
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

  select bq.* into v_quote
  from public.booking_quotes bq
  where bq.id = v_booking.quote_id;

  if not found or v_quote.host_id <> v_host_id then
    raise exception 'You are not authorized to manage this booking' using errcode = '42501';
  end if;

  if v_booking.status in ('cancelled', 'completed', 'refunded') then
    raise exception 'Booking status (%) cannot be cancelled', v_booking.status using errcode = 'P0001';
  end if;

  update public.bookings
  set status = 'cancelled'
  where id = v_booking.id
  returning * into v_booking;

  -- Cancel any scheduled payout
  update public.host_payouts
  set status = 'cancelled',
      failure_reason = coalesce(p_reason, 'Host cancelled reservation')
  where booking_id = v_booking.id and status = 'scheduled';

  return v_booking;
end;
$$;

revoke all on function public.host_confirm_booking(uuid) from public;
revoke all on function public.host_cancel_booking(uuid, text) from public;

grant execute on function public.host_confirm_booking(uuid) to authenticated;
grant execute on function public.host_cancel_booking(uuid, text) to authenticated;
