# Supabase local

Esta configuracao prepara apenas o ambiente local do Supabase. A baseline de migrations e o `seed.sql` serao adicionados em uma PR futura.

## Pre-requisitos

- Node.js 22 compativel com o projeto.
- Docker Desktop iniciado e saudavel.
- Dependencias instaladas com `npm install`.

## Comandos

Execute no PowerShell, a partir da raiz do repositorio:

```powershell
npx supabase --version
npx supabase start
npx supabase status
npx supabase stop
```

A configuracao local versionada fica em `supabase/config.toml`. As futuras migrations ficarao em `supabase/migrations/`, e `supabase/seed.sql` tera somente dados ficticios para desenvolvimento local.

Neste fluxo local, nunca use `supabase link`, `--linked` ou `--db-url`. Nunca execute `supabase db reset` contra producao.
