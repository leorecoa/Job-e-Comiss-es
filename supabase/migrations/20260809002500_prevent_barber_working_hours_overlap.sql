-- Review-only for remote rollout; apply manually after checking existing overlaps.
-- Preflight (must return no rows; never delete/repair conflicts automatically):
-- select a.id, b.id from public.barber_working_hours a
-- join public.barber_working_hours b on a.id < b.id
--   and a.barber_id = b.barber_id and a.weekday = b.weekday
--   and a.start_time < b.end_time and b.start_time < a.end_time;
--
-- TIME has no built-in timerange. Numeric seconds preserve fractional precision
-- and 24:00 without a timezone, date anchor or rounding. EXTRACT(TIME) is immutable.
-- btree_gist already exists in extensions (001); range_ops is built into PostgreSQL.
alter table public.barber_working_hours
  add constraint barber_working_hours_no_overlap exclude using gist (
    barber_id extensions.gist_uuid_ops with =,
    weekday extensions.gist_int4_ops with =,
    pg_catalog.numrange(
      extract(epoch from start_time),
      extract(epoch from end_time),
      '[)'
    ) with &&
  );

-- Adjacent intervals remain valid. Constraint installation fails on existing
-- overlaps, and the exclusion index guards concurrent INSERT/UPDATE as well.
-- Validate: supabase test db --local. Rollback requires separate manual review;
-- removing this constraint would allow overlapping working hours again.
