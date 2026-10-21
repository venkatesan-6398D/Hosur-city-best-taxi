do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'booking-otp-dispatch'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;
end;
$$;

update public.bookings
set status = 'Pending confirmation',
    otp_hash = null,
    otp_expires_at = null,
    otp_verified_at = null,
    otp_send_claimed_at = null
where status in (
  'OTP scheduled',
  'Sending OTP',
  'Awaiting OTP',
  'OTP verified',
  'OTP expired',
  'OTP locked',
  'OTP delivery failed'
);
