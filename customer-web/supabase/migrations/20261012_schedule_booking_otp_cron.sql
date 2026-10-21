create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

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

  perform cron.schedule(
    'booking-otp-dispatch',
    '* * * * *',
    $job$
    select net.http_post(
      url := 'https://jbkjkfgzrihnlmvrhwbc.supabase.co/functions/v1/booking-otp',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'booking_otp_publishable_key'
        ),
        'x-booking-scheduler-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'booking_otp_scheduler_secret'
        )
      ),
      body := jsonb_build_object('action', 'send_due_otps')
    );
    $job$
  );
end;
$$;
