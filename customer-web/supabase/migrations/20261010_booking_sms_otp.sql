alter table public.bookings
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists car text,
  add column if not exists pickup_latitude double precision,
  add column if not exists pickup_longitude double precision,
  add column if not exists drop_latitude double precision,
  add column if not exists drop_longitude double precision,
  add column if not exists otp_hash text,
  add column if not exists otp_expires_at timestamptz,
  add column if not exists otp_attempts integer not null default 0,
  add column if not exists otp_verified_at timestamptz;

alter table public.bookings alter column customer_id drop not null;

create index if not exists bookings_status_id_idx
  on public.bookings (status, id desc);

create table if not exists public.booking_otp_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
);

alter table public.booking_otp_rate_limits enable row level security;
revoke all on public.booking_otp_rate_limits from anon, authenticated;
grant all on public.booking_otp_rate_limits to service_role;

create or replace function public.consume_booking_otp_rate_limit(
  p_rate_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  insert into public.booking_otp_rate_limits (rate_key, window_started_at, request_count)
  values (p_rate_key, now(), 1)
  on conflict (rate_key) do update
    set window_started_at = case
          when public.booking_otp_rate_limits.window_started_at
            <= now() - make_interval(secs => p_window_seconds)
          then now()
          else public.booking_otp_rate_limits.window_started_at
        end,
        request_count = case
          when public.booking_otp_rate_limits.window_started_at
            <= now() - make_interval(secs => p_window_seconds)
          then 1
          else public.booking_otp_rate_limits.request_count + 1
        end
  returning request_count into current_count;

  return current_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_booking_otp_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_booking_otp_rate_limit(text, integer, integer)
  to service_role;

create or replace function public.record_booking_otp_failure(p_booking_id bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempts integer;
begin
  update public.bookings
  set otp_attempts = otp_attempts + 1,
      status = case
        when otp_attempts + 1 >= 5 then 'OTP locked'
        else status
      end,
      otp_hash = case
        when otp_attempts + 1 >= 5 then null
        else otp_hash
      end
  where id = p_booking_id
    and status = 'Awaiting OTP'
  returning otp_attempts into current_attempts;

  return coalesce(current_attempts, 0);
end;
$$;

revoke all on function public.record_booking_otp_failure(bigint)
  from public, anon, authenticated;
grant execute on function public.record_booking_otp_failure(bigint)
  to service_role;
