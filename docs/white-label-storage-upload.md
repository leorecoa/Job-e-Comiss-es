# White Label Storage Upload

## Objective

Allow owners to upload the public logo and cover image used by the white-label booking page.

This phase replaces the manual-only URL workflow with Supabase Storage upload while keeping URL fields available as fallback.

## Expected Bucket

```txt
barbershop-branding
```

Expected file layout:

```txt
barbershop-branding/{barbershop_id}/logo.{ext}
barbershop-branding/{barbershop_id}/cover.{ext}
```

Allowed extensions:

```txt
png
jpg
jpeg
webp
```

Suggested limits:

```txt
Logo: 2MB
Cover: 5MB
```

## Planned SQL

Apply manually in Supabase. Do not run this from the application.

```sql
insert into storage.buckets (id, name, public)
values ('barbershop-branding', 'barbershop-branding', true)
on conflict (id) do update set public = true;

create policy "Public read barbershop branding"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'barbershop-branding');

create policy "Authenticated upload barbershop branding"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'barbershop-branding');

create policy "Authenticated update barbershop branding"
on storage.objects
for update
to authenticated
using (bucket_id = 'barbershop-branding')
with check (bucket_id = 'barbershop-branding');

create policy "Authenticated delete barbershop branding"
on storage.objects
for delete
to authenticated
using (bucket_id = 'barbershop-branding');
```

## Upload Flow

1. Owner selects a logo or cover image in the barbershop branding settings.
2. The app validates file extension, MIME type, and size before upload.
3. The app uploads to the stable path for the current `barbershop_id` using upsert.
4. Supabase returns the public URL for the uploaded object.
5. The URL fills `logoUrl` or `coverImageUrl` in the form.
6. Owner saves the barbershop settings, persisting the URL in `public.barbershops`.

## Current Limitations

- No image resizing or cropping is done in the browser.
- No Supabase Storage SQL is applied by this repository.
- Storage policies are bucket-wide in this plan; tighter tenant-aware object policies can be evaluated later.
- Manual URL fields remain available for emergency fallback or externally hosted assets.

## Next Steps

- Apply the bucket and policies manually in Supabase.
- Validate upload for `/book/gestao-maxima` and `/book/barbearia-fake-rls`.
- Consider image resizing/compression before upload.
- Consider tenant-aware object path checks after the owner profile contract is fully stable.
