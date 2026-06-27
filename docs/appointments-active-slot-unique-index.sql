-- Manual hardening for active appointment slot duplication protection.
-- Do not apply automatically from the app.
--
-- Goal:
-- Prevent two active appointments from sharing the same
-- barbershop_id + barber_id + start_at combination.
--
-- Blocking statuses:
-- - scheduled
-- - confirmed
-- - completed
--
-- Non-blocking statuses:
-- - cancelled
-- - no_show

create unique index if not exists appointments_unique_active_barbershop_barber_start
on public.appointments (barbershop_id, barber_id, start_at)
where status in ('scheduled', 'confirmed', 'completed');

notify pgrst, 'reload schema';
