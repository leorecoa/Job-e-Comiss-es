# Supabase local

As migrations em `supabase/migrations/` sao a fonte canonica para criar um banco local vazio. A baseline estrutural reproduz o schema da aplicacao observado em producao; ela nao altera projetos existentes nem inclui dados.

## Pre-requisitos

- Node.js 22 compativel com o projeto.
- Docker Desktop iniciado e saudavel.
- Dependencias instaladas com `npm install`.

## Comandos

Execute no PowerShell, a partir da raiz do repositorio:

```powershell
npx supabase --version
npx supabase start
npx supabase db reset
npx supabase status
npx supabase stop
```

A configuracao local versionada fica em `supabase/config.toml`. As seis migrations sao aplicadas em ordem: schema principal, helpers RLS, policies tenant-scoped, RPCs de booking, constraints e Storage. Esta PR ainda nao cria `supabase/seed.sql`; essa sera a proxima etapa e usara somente dados ficticios.

O dump estrutural remoto e somente uma fonte read-only para revisao. Dumps brutos ficam fora do repositorio e nunca incluem dados. O schema `storage` e gerenciado pelo Supabase; a baseline versiona somente o bucket e as policies da aplicacao.

Use `supabase db reset` exclusivamente na stack local. Nunca use `db push`, `db reset --linked` ou `db reset --db-url`, e nunca execute reset em producao.

## Producao existente

A baseline cria projetos novos, mas nao deve ser aplicada retroativamente sem uma estrategia revisada de migration history. Projetos existentes exigirao uma etapa futura de alinhamento; correcoes devem ser feitas por novas migrations, nunca editando migrations ja aplicadas.

## Dividas preservadas

- Dois indices equivalentes em `appointments`.
- Dois conjuntos equivalentes de policies de escrita no Storage.
- View publica legada `public_appointment_slots`.
- Grants amplos de `profiles`.
- `EXECUTE` de `PUBLIC` em helpers privados `SECURITY DEFINER`.
- Search paths dos helpers privados a revisar.
