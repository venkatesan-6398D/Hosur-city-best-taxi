alter table public.bookings
  add column if not exists pickup_at timestamptz,
  add column if not exists otp_send_at timestamptz,
  add column if not exists otp_send_attempts integer not null default 0,
  add column if not exists otp_send_claimed_at timestamptz;

create index if not exists bookings_scheduled_otp_idx
  on public.bookings (otp_send_at)
  where status = 'OTP scheduled';
