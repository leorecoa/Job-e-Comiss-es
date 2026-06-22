# Owner Operational Settings

## Objetivo

Concentrar no painel owner as configuracoes operacionais da propria barbearia:

- dias e horarios de funcionamento;
- intervalo entre slots do booking publico;
- criacao, edicao e remocao segura de barbeiros e servicos.

## Regras de tenant

- Toda escrita usa a `barbershop_id` real do owner autenticado.
- O app nao usa `localStorage` como fonte de verdade para `barbershop_id` quando Supabase esta ativo.
- Nenhuma query de owner deve operar fora da `barbershop_id` autenticada.

## Funcionamento da barbearia

Os dados ficam em `public.barbershops`:

- `business_hours`
- `slot_step_minutes`

O booking publico `/book/:slug` usa somente os dados da barbearia carregada pelo slug.

Se a barbearia ainda nao tiver configuracao persistida, o app usa um padrao seguro local apenas como bootstrap visual:

- segunda: fechado
- terca a sabado: `08:00` - `20:00`
- domingo: `10:00` - `18:00`
- intervalo: `30` minutos

Se um dia estiver fechado, nenhum horario e exibido.

Se fechamento for menor ou igual a abertura, o owner recebe erro amigavel ao salvar e o booking nao exibe slots para esse dia.

## Remocao segura de catalogo

### Servicos

- sem historico de appointments: pode excluir fisicamente;
- com historico: nao apaga, apenas marca `active = false`.

### Barbeiros

- sem historico de appointments: pode excluir fisicamente;
- com historico: nao apaga, apenas marca `active = false`.

## Historico preservado

Appointments antigos nunca devem perder integridade por remocao de catalogo.

Itens desativados deixam de aparecer no booking publico, mas continuam preservando referencias historicas.

## RLS

Nenhuma mudanca nova de RLS foi necessaria nesta etapa.
