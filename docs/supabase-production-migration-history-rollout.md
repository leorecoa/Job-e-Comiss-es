# Reconciliacao do migration history de producao

## Objetivo

O schema de producao ja possui objetos equivalentes a baseline incorporada pela PR #164. Este rollout faz o projeto reconhecer os seis timestamps no migration history sem executar novamente o corpo das migrations.

## Escopo

`supabase migration repair` altera somente `supabase_migrations.schema_migrations`. Ele nao deve executar migrations nem alterar tabelas, policies, funcoes ou dados da aplicacao. A marcacao so pode ocorrer depois de a paridade estrutural estar confirmada.

## Pre-requisitos

- PR #164 e PR #165 incorporadas.
- Branch `main` limpa, sincronizada e sem migrations concorrentes.
- Project ref confirmado como `splyxgspgcbbvcobhepq`.
- Exatamente as seis migrations `20260809000100` a `20260809000600` presentes e com hashes conferidos.
- Paridade estrutural com producao confirmada.
- Backup e plano de recuperacao do projeto disponiveis.
- Nenhuma migration adicional criada entre o preflight e o rollout.

## Estado anterior

Em 9 de agosto de 2026, `npx supabase migration list --linked` mostrou o migration history remoto vazio. As seis versoes da baseline estavam presentes somente no repositorio local, em ordem crescente. Nao havia versoes desconhecidas somente no remoto.

## Dry-run anterior

`npx supabase db push --linked --dry-run` concluiu sem aplicar SQL e classificou exatamente estas migrations como pendentes:

- `20260809000100_core_schema.sql`
- `20260809000200_rls_helpers.sql`
- `20260809000300_tenant_policies.sql`
- `20260809000400_public_booking_rpcs.sql`
- `20260809000500_tenant_constraints.sql`
- `20260809000600_storage_policies.sql`

O dry-run nao incluiu seed ou roles. Nao execute `db push` real para resolver esse estado, pois o schema equivalente ja existe.

## Procedimento manual posterior ao merge

Este procedimento exige revisao e execucao manual por operador autorizado. Antes de **cada** comando, confirme e registre:

- project ref `splyxgspgcbbvcobhepq`;
- timestamp exato do comando;
- branch `main` limpa e sincronizada;
- ausencia de migrations adicionais.

Marque uma versao por vez, interrompendo o rollout diante de qualquer divergencia:

```powershell
npx supabase migration repair 20260809000100 --status applied --linked
npx supabase migration repair 20260809000200 --status applied --linked
npx supabase migration repair 20260809000300 --status applied --linked
npx supabase migration repair 20260809000400 --status applied --linked
npx supabase migration repair 20260809000500 --status applied --linked
npx supabase migration repair 20260809000600 --status applied --linked
```

Esses comandos marcam o historico; eles nao substituem a validacao de paridade e nao devem executar o SQL das migrations.

## Validacao posterior

Execute apenas as verificacoes read-only:

```powershell
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Resultado esperado: as seis versoes alinhadas entre local e remoto, nenhuma migration da baseline pendente e nenhum SQL a aplicar. Pare se o resultado for diferente.

## Rollback do historico

Somente apos revisao explicita, uma marcacao comprovadamente incorreta pode ser removida individualmente:

```powershell
npx supabase migration repair TIMESTAMP --status reverted --linked
```

`reverted` remove apenas o registro correspondente do migration history; nao desfaz objetos do schema. Nao reverta em massa. Depois de cada reversao, valide novamente `migration list --linked` e o dry-run.

## Proibicoes

- Nunca execute `db reset --linked` ou reset com URL remota.
- Nao use `db push` real para aplicar esta baseline.
- Nao edite, renomeie ou apague migrations incorporadas ou registradas.
- Nao aplique `supabase/seed.sql` em producao.
- Nao prossiga se project ref, hashes, branch ou lista de migrations divergirem.

## Registro operacional

- [ ] Data e hora registradas.
- [ ] Operador identificado.
- [ ] Project ref confirmado.
- [ ] Saida resumida anterior de `migration list` registrada.
- [ ] Saida resumida anterior do dry-run registrada.
- [ ] Cada versao marcada registrada individualmente.
- [ ] Saida resumida posterior de `migration list` registrada.
- [ ] Dry-run final sem migrations pendentes registrado.
- [ ] Incidentes e divergencias registrados.
