# Deployment

## Ambiente

O app e uma SPA Vite e pode ser publicado na Vercel.

## Variaveis

Configure no ambiente de deploy:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Sem essas variaveis, o app usa fallback em `localStorage`.

## Validacao Antes do Deploy

```bash
npm run check
npm run build
npm audit --audit-level=moderate
```

## Supabase

O schema base fica em `docs/supabase-schema.sql`. Rode esse SQL no projeto Supabase antes de testar persistencia online.
