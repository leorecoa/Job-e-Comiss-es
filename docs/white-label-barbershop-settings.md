# White Label Barbershop Settings

## Objective

Allow each owner to configure the public identity of their own barbershop from the internal dashboard.

This makes the public booking route `/book/:slug` behave like a real white-label page for each tenant.

## Fields

The owner-facing form manages:

```txt
name
phone
address
description
whatsapp
instagram_url
logo_url
cover_image_url
primary_color
secondary_color
```

The public booking page consumes these app fields:

```txt
logoUrl
coverImageUrl
description
instagramUrl
whatsapp
primaryColor
secondaryColor
```

The slug remains read-only in this phase to avoid breaking public booking links.

## Required SQL

Apply manually in Supabase when the environment is ready:

```sql
alter table public.barbershops
add column if not exists logo_url text,
add column if not exists cover_image_url text,
add column if not exists description text,
add column if not exists instagram_url text,
add column if not exists whatsapp text,
add column if not exists primary_color text,
add column if not exists secondary_color text;

notify pgrst, 'reload schema';
```

Do not apply this SQL automatically from the repository.

## Scope Of This Phase

Included:

- owner can edit public barbershop identity
- barber does not see the white-label settings area
- image fields are manual URLs
- public booking uses branding when fields exist
- public booking keeps graceful fallbacks when fields are null
- colors are applied through controlled inline styles, not dynamic Tailwind classes

Not included:

- Supabase Storage
- file upload
- image resizing
- slug editing
- RLS or policy changes
- appointment, schedule, commission, PDF, CSV, or dashboard business-rule changes

## Limitations

Image URLs can still be pasted manually as fallback, but the next phase adds Supabase Storage upload.

Colors should be valid hex values such as:

```txt
#f59e0b
#0ea5e9
```

If colors are missing or invalid, the public page falls back to the app's default gold/blue accents.

## Next Phase

The next white-label phase is documented in:

```txt
docs/white-label-storage-upload.md
```

It adds Supabase Storage upload support:

1. Create a controlled storage bucket for barbershop brand assets.
2. Add upload UI for logo and cover image.
3. Validate file type and size before upload.
4. Store public asset URLs back into `public.barbershops`.
5. Document storage policies separately from this UI phase.
