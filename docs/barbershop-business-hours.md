# Barbershop Business Hours

## Objetivo

Permitir que cada barbearia controle seus proprios dias de atendimento, horario de abertura, horario de fechamento e intervalo entre slots do booking publico.

## Estado esperado no app

- O owner edita o funcionamento da propria barbearia no painel interno.
- O booking publico `/book/:slug` usa somente a configuracao da barbearia carregada pelo slug.
- Uma barbearia nao herda horario operacional de outra.
- Se a barbearia ainda nao tiver configuracao persistida, o app usa um padrao seguro local:
  - segunda: fechado
  - terca a sabado: `08:00` - `20:00`
  - domingo: `10:00` - `18:00`
  - intervalo: `30` minutos

## SQL sugerido

```sql
alter table public.barbershops
add column if not exists business_hours jsonb,
add column if not exists slot_step_minutes integer;

comment on column public.barbershops.business_hours is
'Agenda operacional publica por dia da semana no formato JSON.';

comment on column public.barbershops.slot_step_minutes is
'Intervalo em minutos entre horarios do booking publico.';

notify pgrst, 'reload schema';
```

## Formato esperado de `business_hours`

```json
{
  "sunday": { "active": true, "open": "10:00", "close": "18:00" },
  "monday": { "active": false, "open": "08:00", "close": "20:00" },
  "tuesday": { "active": true, "open": "08:00", "close": "20:00" },
  "wednesday": { "active": true, "open": "08:00", "close": "20:00" },
  "thursday": { "active": true, "open": "08:00", "close": "20:00" },
  "friday": { "active": true, "open": "08:00", "close": "20:00" },
  "saturday": { "active": true, "open": "08:00", "close": "20:00" }
}
```

## Exemplo de update

```sql
update public.barbershops
set
  business_hours = '{
    "sunday": { "active": false, "open": "10:00", "close": "18:00" },
    "monday": { "active": true, "open": "09:00", "close": "18:00" },
    "tuesday": { "active": true, "open": "09:00", "close": "18:00" },
    "wednesday": { "active": true, "open": "09:00", "close": "18:00" },
    "thursday": { "active": true, "open": "09:00", "close": "18:00" },
    "friday": { "active": true, "open": "09:00", "close": "19:00" },
    "saturday": { "active": true, "open": "08:00", "close": "16:00" }
  }'::jsonb,
  slot_step_minutes = 20
where slug = 'leo-do-leo';
```

## RLS

Nao foi necessaria mudanca de RLS nesta etapa.

O app continua usando o `barbershop_id` autenticado do owner para salvar a configuracao da propria barbearia.
