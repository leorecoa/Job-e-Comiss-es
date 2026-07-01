# Public Booking Branding

## Status

This document describes the planned Supabase columns for public booking branding.

This is documentation only. Do not execute this file as an automatic migration.

## Objective

Allow each barbershop public booking page to show its own visual identity:

- cover image
- logo
- description
- WhatsApp
- Instagram
- address

The public booking UI remains functional without these fields. If no images are configured, the page uses a polished dark fallback header.

## Planned SQL

Apply this manually in Supabase when ready:

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

## Example Update

Example placeholder update for a tenant created by owner onboarding:

```sql
update public.barbershops
set
  logo_url = 'https://example.com/minha-barbearia-logo.png',
  cover_image_url = 'https://example.com/minha-barbearia-cover.jpg',
  description = 'Agenda online da minha barbearia.',
  instagram_url = 'https://instagram.com/minha_barbearia',
  whatsapp = '5585999999999',
  primary_color = '#f59e0b',
  secondary_color = '#0ea5e9'
where slug = 'minha-barbearia';

notify pgrst, 'reload schema';
```

Replace placeholder URLs and phone numbers before using this in production.

## Frontend Contract

The app maps Supabase snake_case columns to camelCase fields:

```txt
logo_url -> logoUrl
cover_image_url -> coverImageUrl
description -> description
instagram_url -> instagramUrl
whatsapp -> whatsapp
primary_color -> primaryColor
secondary_color -> secondaryColor
```

Public booking should continue to work if these fields are null.

Invalid slugs must continue returning no barbershop and must not fall back to any hardcoded tenant.

## Validation Checklist

After applying the SQL and filling branding data, validate:

- `/book/minha-barbearia` opens with or without branding fields
- a second tenant slug opens with its own branding when fields are configured
- `/book/barbearia-inexistente` remains blocked
- public booking still creates appointments with `barbershop_id`, `barber_id`, and `service_id`
- owner and barber login flows are unchanged

## Not Included

This branding change does not alter:

- RLS policies
- appointment insert policies
- commission rules
- schedule rules
- owner dashboard
- barber dashboard
- PDF/CSV reports
