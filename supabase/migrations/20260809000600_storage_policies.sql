insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'barbershop-branding',
  'barbershop-branding',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Owner delete own barbershop branding" on storage.objects
for delete to authenticated
using (bucket_id = 'barbershop-branding' and (storage.foldername(name))[1] = private.current_user_barbershop_id()::text and private.current_user_role() = 'owner');

create policy "Owner insert own barbershop branding" on storage.objects
for insert to authenticated
with check (bucket_id = 'barbershop-branding' and (storage.foldername(name))[1] = private.current_user_barbershop_id()::text and private.current_user_role() = 'owner');

create policy "Owner update own barbershop branding" on storage.objects
for update to authenticated
using (bucket_id = 'barbershop-branding' and (storage.foldername(name))[1] = private.current_user_barbershop_id()::text and private.current_user_role() = 'owner')
with check (bucket_id = 'barbershop-branding' and (storage.foldername(name))[1] = private.current_user_barbershop_id()::text and private.current_user_role() = 'owner');

create policy "Public read barbershop branding" on storage.objects
for select to authenticated, anon
using (bucket_id = 'barbershop-branding');

create policy storage_branding_owner_delete on storage.objects
for delete to authenticated
using (bucket_id = 'barbershop-branding' and (storage.foldername(name))[1] = private.current_user_barbershop_id()::text and private.current_user_role() = 'owner');

create policy storage_branding_owner_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'barbershop-branding' and (storage.foldername(name))[1] = private.current_user_barbershop_id()::text and private.current_user_role() = 'owner');

create policy storage_branding_owner_update on storage.objects
for update to authenticated
using (bucket_id = 'barbershop-branding' and (storage.foldername(name))[1] = private.current_user_barbershop_id()::text and private.current_user_role() = 'owner')
with check (bucket_id = 'barbershop-branding' and (storage.foldername(name))[1] = private.current_user_barbershop_id()::text and private.current_user_role() = 'owner');
