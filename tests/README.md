# Testes

Os testes Vitest ficam organizados pela responsabilidade principal:

- `unit/`: funcoes, validacoes, transformacoes e componentes isolados.
- `integration/`: fluxos que combinam componentes, repositories, sessao ou navegacao.
- `security/`: autorizacao, isolamento tenant, exposicao de dados e garantias negativas.
- `contracts/`: contratos estaticos de arquivos, exports, configuracao e design system.

Testes com responsabilidade mista devem ficar na categoria de seu objetivo principal. Use nomes `*.test.ts` ou `*.test.tsx` e nao adicione novos testes Vitest na raiz do repositorio.

## Runners

- Vitest (`tests/`): `npm test` ou `npx vitest run tests/<categoria>`.
- Playwright (`e2e/`): `npx playwright test`.
- pgTAP (`supabase/tests/`): `npx supabase test db --local supabase/tests` com a stack local apropriada.

O comando `npm run check` executa Vitest, typecheck e build. O script `scripts/check.ps1` acrescenta um segundo build e a auditoria de dependencias.
