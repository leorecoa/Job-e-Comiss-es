-- Manual hardening for active appointment slot duplication protection.
-- Do not apply automatically from the app.
-- Apply manually after docs/supabase-schema.sql and
-- docs/supabase-tenant-rls-plan.sql.
--
-- Goal:
-- Prevent two active appointments from sharing the same
-- barbershop_id + barber_id + start_at combination.
--
-- This index is the database race-condition guard. The app also performs a
-- pre-check, but the app-side check is not enough for concurrent requests.
-- The index does not grant read access and does not replace RLS.
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
