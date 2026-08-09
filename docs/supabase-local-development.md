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

A configuracao local versionada fica em `supabase/config.toml`. As seis migrations sao aplicadas em ordem: schema principal, helpers RLS, policies tenant-scoped, RPCs de booking, constraints e Storage.

O `supabase/seed.sql` e exclusivamente local e cria dois tenants ficticios, cada um com um barbeiro e um servico ativos. Ele nao cria usuarios Auth, appointments, e-mails ou dados reais.

Execute os testes pgTAP locais depois do reset:

```powershell
npx supabase test db --local supabase/tests
```

Os testes criam usuarios Auth e profiles ficticios somente dentro de transacoes revertidas. Eles simulam JWTs locais para comprovar isolamento de owners e barbers, constraints tenant-scoped e o contrato das RPCs publicas.

O dump estrutural remoto e somente uma fonte read-only para revisao. Dumps brutos ficam fora do repositorio e nunca incluem dados. O schema `storage` e gerenciado pelo Supabase; a baseline versiona somente o bucket e as policies da aplicacao.

Use `supabase db reset --local` exclusivamente na stack local. Nunca use `db push`, `db reset --linked` ou `db reset --db-url`, e nunca execute reset em producao.

## Producao existente

A baseline cria projetos novos, mas nao deve ser aplicada retroativamente sem uma estrategia revisada de migration history. Projetos existentes exigirao uma etapa futura de alinhamento; correcoes devem ser feitas por novas migrations, nunca editando migrations ja aplicadas.

O procedimento revisavel para reconciliar o historico de producao esta em `docs/supabase-production-migration-history-rollout.md`.

## Dividas preservadas

- Dois indices equivalentes em `appointments`.
- Policies de escrita do Storage consolidadas pela migration `20260809000900`.
- View publica legada `public_appointment_slots` removida pela migration `20260809001000`.
- Privilegios de `profiles` endurecidos pela migration `20260809000800`.
- Privilegios dos helpers privados endurecidos pela migration `20260809000700`.
- Search paths dos helpers privados a revisar.
