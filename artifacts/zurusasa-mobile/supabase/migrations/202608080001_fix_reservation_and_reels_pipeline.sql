-- Migration: 202608080001_fix_reservation_and_reels_pipeline.sql
-- Fixes:
-- 1. Host booking authorization (host_confirm_booking, host_cancel_booking, host_decline_booking)
-- 2. Bookings RLS policies for host update
-- 3. Reels RLS policies and storage bucket setup
-- 4. In-app notification on booking decline

-- =============================================================================
-- 1. BOOKINGS RLS POLICIES FOR HOSTS & GUESTS
-- =============================================================================

alter table public.bookings enable row level security;

-- Hosts can view bookings for their experiences or quotes
drop policy if exists "Hosts can view bookings for their experiences" on public.bookings;
create policy "Hosts can view bookings for their experiences"
  on public.bookings for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.experiences e
      where e.id = bookings.experience_id and e.user_id = auth.uid()
    )
    or exists (
      select 1 from public.booking_quotes bq
      where bq.id = bookings.quote_id and bq.host_id = auth.uid()
    )
  );

-- Hosts can update bookings for their experiences or quotes
drop policy if exists "Hosts can update bookings for their experiences" on public.bookings;
create policy "Hosts can update bookings for their experiences"
  on public.bookings for update
  to authenticated
  using (
    exists (
      select 1 from public.experiences e
      where e.id = bookings.experience_id and e.user_id = auth.uid()
    )
    or exists (
      select 1 from public.booking_quotes bq
      where bq.id = bookings.quote_id and bq.host_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.experiences e
      where e.id = bookings.experience_id and e.user_id = auth.uid()
    )
    or exists (
      select 1 from public.booking_quotes bq
      where bq.id = bookings.quote_id and bq.host_id = auth.uid()
    )
  );

-- =============================================================================
-- 2. ROBUST HOST BOOKING AUTHORIZATION RPCs
-- =============================================================================

-- Helper function to check if current authenticated user is authorized host for a booking
create or replace function public.is_booking_host(p_booking_id uuid, p_host_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_host boolean := false;
begin
  select exists (
    select 1
    from public.bookings b
    left join public.booking_quotes bq on b.quote_id = bq.id
    left join public.experiences e on b.experience_id = e.id
    where b.id = p_booking_id
      and (
        bq.host_id = p_host_id
        or e.user_id = p_host_id
        or (b.metadata->>'host_id')::uuid = p_host_id
      )
  ) into v_is_host;

  return coalesce(v_is_host, false);
end;
$$;

grant execute on function public.is_booking_host(uuid, uuid) to authenticated;

-- Host Decline Booking RPC
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

  -- Check authorization via quote host_id, experience owner, or booking host
  v_is_auth := public.is_booking_host(p_booking_id, v_host_id);

  if not v_is_auth then
    raise exception 'You are not authorized to manage this booking' using errcode = '42501';
  end if;

  -- Guard against duplicate decline/cancellation
  if v_booking.status in ('cancelled', 'declined', 'completed', 'refunded') then
    raise exception 'Booking status (%) cannot be declined', v_booking.status using errcode = 'P0001';
  end if;

  -- Update booking status to cancelled
  update public.bookings
  set status = 'cancelled',
      updated_at = now()
  where id = v_booking.id
  returning * into v_booking;

  -- Cancel any scheduled payouts
  update public.host_payouts
  set status = 'cancelled',
      failure_reason = coalesce(p_reason, 'Reservation declined by host')
  where booking_id = v_booking.id and status = 'scheduled';

  -- Create notification for guest if notifications table exists
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notifications') then
    begin
      insert into public.notifications (
        user_id,
        type,
        title,
        message,
        metadata
      ) values (
        v_booking.user_id,
        'booking_declined',
        'Reservation Declined',
        coalesce('Your reservation for "' || v_booking.trip_title || '" was declined by the host.', 'Reservation declined'),
        jsonb_build_object('booking_id', v_booking.id, 'reason', p_reason)
      );
    exception when others then
      null;
    end;
  end if;

  return v_booking;
end;
$$;

-- Host Cancel Booking RPC (Updated with robust auth)
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

-- Host Confirm Booking RPC (Updated with robust auth)
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

  if v_booking.status not in ('paid', 'pending') then
    raise exception 'Booking status (%) cannot be confirmed', v_booking.status using errcode = 'P0001';
  end if;

  update public.bookings
  set status = 'confirmed',
      updated_at = now()
  where id = v_booking.id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.host_decline_booking(uuid, text) from public;
revoke all on function public.host_cancel_booking(uuid, text) from public;
revoke all on function public.host_confirm_booking(uuid) from public;

grant execute on function public.host_decline_booking(uuid, text) to authenticated;
grant execute on function public.host_cancel_booking(uuid, text) to authenticated;
grant execute on function public.host_confirm_booking(uuid) to authenticated;

-- =============================================================================
-- 3. REELS STORAGE BUCKET & RLS POLICIES
-- =============================================================================

-- Ensure reels bucket exists in storage.buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reels', 'reels', true, 104857600, array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

-- Storage object policies for reels bucket
drop policy if exists "Public Read Reels Storage" on storage.objects;
create policy "Public Read Reels Storage"
  on storage.objects for select
  to public
  using (bucket_id = 'reels');

drop policy if exists "Authenticated Upload Reels Storage" on storage.objects;
create policy "Authenticated Upload Reels Storage"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'reels' and auth.uid() is not null);

-- Reels Table RLS Policies
alter table public.reels enable row level security;

drop policy if exists "Anyone can view active and published reels" on public.reels;
create policy "Anyone can view active and published reels"
  on public.reels for select
  using (status in ('active', 'published') or auth.uid() = user_id);

drop policy if exists "Authenticated users can insert own reels" on public.reels;
create policy "Authenticated users can insert own reels"
  on public.reels for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Hosts can update own reels" on public.reels;
create policy "Hosts can update own reels"
  on public.reels for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Hosts can delete own reels" on public.reels;
create policy "Hosts can delete own reels"
  on public.reels for delete
  to authenticated
  using (auth.uid() = user_id);

-- Index on reels status & created_at for fast Discover queries
create index if not exists reels_status_created_idx
  on public.reels (status, created_at desc);
