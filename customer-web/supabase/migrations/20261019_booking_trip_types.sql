alter table public.bookings
  add column if not exists trip_type text not null default 'Local Taxi',
  add column if not exists rental_hours integer;

alter table public.bookings
  add constraint bookings_rental_hours_valid
  check (
    trip_type in ('Local Taxi', 'Outstation', 'Hourly Rental', 'Airport')
    and (
      (
        trip_type = 'Hourly Rental'
        and rental_hours is not null
        and rental_hours between 1 and 24
      )
      or (trip_type <> 'Hourly Rental' and rental_hours is null)
    )
  );
