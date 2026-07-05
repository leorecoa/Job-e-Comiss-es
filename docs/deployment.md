# Deployment

## Ambiente

O app e uma SPA Vite publicada na Vercel.

Em producao, o app depende de Supabase configurado. Sem Supabase, o comportamento esperado e fail-closed: nenhuma operacao real deve usar `localStorage` como banco operacional.

## Variaveis

Configure no ambiente de deploy:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Regras:

- `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` precisam apontar para o projeto Supabase correto.
- producao nao deve depender de fallback local;
- fallback em `localStorage` existe apenas para desenvolvimento ou demonstracao local sem Supabase;
- nunca commite `.env`.

## Supabase

O estado atual do app depende de schema, RLS tenant-aware, RPC publica de disponibilidade, indice contra slot duplicado e RPC de vinculo de barbeiro.

Nao aplique apenas um SQL isolado em ambiente novo. Aplique e valide manualmente a sequencia completa.

Ordem recomendada para um projeto Supabase novo:

```txt
1. docs/supabase-schema.sql
2. docs/supabase-tenant-rls-plan.sql
3. docs/public-appointment-availability-rpc.sql
4. docs/appointments-active-slot-unique-index.sql
5. docs/barber-profile-linking-rpc.sql
```

Arquivos de estado aplicado/historico, como `docs/supabase-tenant-rls-applied.md`, `docs/supabase-barbershop-id-not-null-applied.md` e `docs/supabase-appointment-barbershop-trigger-removal-applied.md`, servem para auditoria do ambiente atual. Eles nao substituem revisao antes de aplicar SQL em outro projeto.

## Regras importantes

- Public booking usa a RPC `public.get_public_appointment_slots(uuid)` para disponibilidade.
- A view `public.public_appointment_slots` permanece temporariamente para rollout/compatibilidade, mas nao deve ser usada pelo frontend novo.
- Public booking nao deve consultar `public.appointments` completo.
- Inserts publicos em `appointments` nao devem usar `.select()` ou `.single()`.
- `appointments` contem dados sensiveis de cliente, como nome, telefone e observacoes.
- `barbershop_id` e a chave de isolamento tenant.
- Owner opera apenas a propria `barbershop_id`.
- Barber opera apenas a propria `barbershop_id` e o proprio `barber_id`.
- A RPC `public.get_public_appointment_slots(uuid)` deve ser aplicada para listar apenas slots ocupados da barbearia solicitada, sem expor dados pessoais.
- A RPC `public.link_barber_profile_by_email(text, uuid)` deve ser aplicada para vincular usuario existente a barbeiro sem expor `auth.users` ao frontend.
- O indice `appointments_unique_active_barbershop_barber_start` deve ser aplicado para bloquear corrida de agendamento duplicado ativo.

## Validacao Antes do Deploy

Execute localmente antes de promover uma alteracao:

```bash
npm run test
npm run typecheck
npm run build
npm run validate
npm run check
npm audit --audit-level=moderate
npx playwright test
```

No ambiente Vercel/Supabase, valide manualmente:

- env vars configuradas;
- deploy `Ready`;
- RLS tenant-aware aplicada;
- `public.get_public_appointment_slots(uuid)` acessivel para booking publico anonimo;
- RPC de vinculo aplicada;
- indice de slot duplicado aplicado;
- `/book/:slug` cria appointment sem public SELECT em `appointments`;
- owner ve apenas a propria barbearia;
- barber ve apenas a propria agenda.
