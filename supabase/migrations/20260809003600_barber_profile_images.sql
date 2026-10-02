-- Public presentation metadata only. Existing table SELECT grants cover this
-- column; owner-only tenant RLS continues to govern writes. No ACL changes.
alter table public.barbers
  add column photo_path text,
  add constraint barbers_photo_path_own_namespace check (
    photo_path is null or (
      photo_path like barbershop_id::text || '/barbers/' || id::text || '/%'
      and photo_path ~ '^[0-9a-f-]{36}/barbers/[0-9a-f-]{36}/[A-Za-z0-9_-]+\.(png|jpg|webp)$'
    )
  );

comment on column public.barbers.photo_path is
  'Public photo object in barbershop-branding: tenant/barbers/barber/unique-file. NULL preserves the visual fallback.';
