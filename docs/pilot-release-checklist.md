# Pilot Release Checklist

Este checklist valida se o app esta pronto para uma apresentacao controlada ou operacao piloto com uma barbearia real.

Ele nao representa liberacao para escala comercial total. O objetivo e confirmar ambiente, tenant, owner, barbeiros, servicos, agenda e booking publico com o menor risco operacional possivel para um piloto.

## 1. Objetivo do checklist

- [ ] Validar que o ambiente esta operacional.
- [ ] Validar que o Supabase esta configurado e aplicado corretamente.
- [ ] Validar que a barbearia piloto existe como tenant isolado.
- [ ] Validar que owner, barbeiros, servicos e horarios estao coerentes.
- [ ] Validar que o booking publico funciona no slug correto.
- [ ] Validar que os fluxos principais passam antes de apresentar para cliente piloto.

## 2. Ambiente

- [ ] `VITE_SUPABASE_URL` configurada no ambiente ativo.
- [ ] `VITE_SUPABASE_ANON_KEY` configurada no ambiente ativo.
- [ ] Producao nao depende de fallback local.
- [ ] Deploy da Vercel esta `Ready`.
- [ ] URL publica do deploy esta acessivel.
- [ ] O ambiente alvo usa o projeto Supabase correto.
- [ ] As migrations, RLS e RPCs manuais necessarias ja foram aplicadas no Supabase.

## 3. Banco e seguranca

- [ ] Tabelas principais existem: `barbershops`, `profiles`, `barbers`, `services`, `appointments`.
- [ ] RLS tenant-aware esta aplicada.
- [ ] Policies tenant-aware foram conferidas no ambiente alvo.
- [ ] A RPC `public.link_barber_profile_by_email` esta aplicada.
- [ ] O indice parcial contra slot duplicado ativo esta aplicado:

```txt
appointments_unique_active_barbershop_barber_start
```

- [ ] O fluxo publico de booking nao exige `SELECT` publico em `appointments`.
- [ ] `public.public_appointment_slots` esta disponivel para disponibilidade publica.
- [ ] Profiles de owner e barber estao coerentes com `barbershop_id` e `barber_id` quando aplicavel.

## 4. Tenant e barbearia piloto

- [ ] A barbearia piloto esta ativa.
- [ ] O `slug` publico esta definido.
- [ ] `business_hours` esta configurado.
- [ ] `slot_step_minutes` esta configurado com valor valido.
- [ ] Nome, telefone, endereco e descricao basicos estao coerentes.
- [ ] Os dados da barbearia aparecem corretamente no painel do owner.

## 5. Owner

- [ ] A conta do owner foi criada.
- [ ] O profile do owner esta ativo.
- [ ] O owner esta vinculado a `barbershop_id` correta.
- [ ] O owner acessa o painel interno sem erro.
- [ ] O owner ve o checklist operacional.
- [ ] O owner ve a agenda da propria barbearia.
- [ ] O owner nao ve dados operacionais de outro tenant.

## 6. Barbeiros

- [ ] Existe pelo menos um barbeiro ativo na barbearia piloto.
- [ ] Cada barbeiro ativo pertence ao tenant correto.
- [ ] O usuario do barbeiro ja criou conta quando necessario.
- [ ] O owner consegue vincular barbeiro por e-mail.
- [ ] O profile vinculado fica com `role = barber`.
- [ ] O profile vinculado recebe `barbershop_id` correto.
- [ ] O profile vinculado recebe `barber_id` correto.
- [ ] O barbeiro acessa o proprio painel.
- [ ] O barbeiro ve apenas a propria agenda.
- [ ] O barbeiro consegue criar agendamento manual proprio.

## 7. Servicos

- [ ] Existe pelo menos um servico ativo na barbearia piloto.
- [ ] Cada servico ativo pertence ao tenant correto.
- [ ] Preco, duracao e comissao estao coerentes.
- [ ] O servico aparece no booking publico do slug correto.
- [ ] Servicos inativos nao aparecem para cliente final.

## 8. Booking publico

- [ ] `/book/:slug` abre a barbearia correta.
- [ ] O header publico mostra branding do tenant correto.
- [ ] O booking lista apenas barbeiros ativos do tenant.
- [ ] O booking lista apenas servicos ativos do tenant.
- [ ] O cliente consegue escolher barbeiro, servico, data e horario.
- [ ] O payload do appointment usa `barbershop_id`, `barber_id` e `service_id` corretos.
- [ ] O appointment criado fica no tenant correto.
- [ ] O slot duplicado ativo e bloqueado.
- [ ] Slug invalido ou inativo mostra erro amigavel.
- [ ] O fluxo publico nao cai em fallback global.

## 9. Validacao automatizada

Executar antes de liberar o piloto:

```bash
npm run test
npm run typecheck
npm run build
npm run validate
npm run check
npm audit --audit-level=moderate
npx playwright test
```

Checklist:

- [ ] `npm run test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run validate`
- [ ] `npm run check`
- [ ] `npm audit --audit-level=moderate`
- [ ] `npx playwright test`

## 10. Teste manual ponta a ponta

- [ ] Owner entra com a conta correta.
- [ ] Owner confirma tenant, slug e dados da barbearia.
- [ ] Owner confirma barbeiros, servicos e horarios.
- [ ] Owner vincula o e-mail do barbeiro.
- [ ] Barbeiro entra com a propria conta.
- [ ] Barbeiro ve apenas a propria agenda.
- [ ] Barbeiro cria um agendamento manual proprio.
- [ ] Cliente agenda pelo booking publico do slug.
- [ ] Owner ve os agendamentos da barbearia.
- [ ] Barbeiro ve apenas os proprios agendamentos.

## 11. Limites conhecidos antes do piloto

- [ ] Billing e assinatura ainda nao foram implementados.
- [ ] Convite formal por e-mail ainda nao foi implementado.
- [ ] Admin global e suporte interno ainda nao foram implementados.
- [ ] Observabilidade, rate limit e CAPTCHA ainda podem evoluir.
- [ ] Ainda existe espaco para polish de UX.
- [ ] Sessao SPA e uso de `localStorage` permanecem ponto de hardening futuro contra XSS.

## 12. Criterio para liberar piloto

- [ ] Todos os checks automatizados passam.
- [ ] O fluxo manual owner -> barber -> cliente passa.
- [ ] O tenant piloto esta configurado no ambiente correto.
- [ ] Os dados reais minimos da barbearia piloto ja foram cadastrados.
- [ ] As limitacoes conhecidas foram comunicadas ao cliente piloto.
- [ ] O time entende que esta liberacao e para piloto controlado, nao para escala comercial completa.

## Referencias uteis

- `docs/security-model.md`
- `docs/dependency-audit.md`
- `docs/owner-barber-operational-flow.md`
- `docs/barber-profile-linking-rpc.md`
- `docs/RELEASE_PROCESS.md`
