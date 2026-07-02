# Job e Comissoes

SaaS multi-tenant para operacao de barbearias, com foco em agenda, booking publico, catalogo por tenant, barbeiros, servicos e controle operacional.

O projeto nasceu como uma ferramenta de controle interno e hoje opera como uma aplicacao React + Supabase com autenticacao, isolamento por `barbershop_id`, RLS tenant-aware e fluxos separados para owner, barber e cliente final.

<p align="left">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=111827" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/TailwindCSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=111827" />
  <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" />
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" />
</p>

---

## Visao geral

O **Job e Comissoes** e uma SPA para gestao de barbearias com modelo SaaS multi-tenant.

O produto cobre tres frentes principais:

- operacao interna da barbearia;
- booking publico por slug em `/book/:slug`;
- isolamento de tenant por `barbershop_id`.

Hoje o app ja suporta agenda interna, catalogo por tenant, onboarding de owner, vinculacao de barbeiro a usuario, painel proprio do barbeiro e configuracao operacional da barbearia.

---

## Problema que resolve

Barbearias pequenas e medias costumam operar agenda, comissao, servicos e fechamento por planilha, caderno ou mensagens.

Esse fluxo tende a gerar:

- perda de historico operacional;
- calculo manual de comissao;
- agenda misturada entre profissionais;
- dificuldade para abrir booking publico sem expor dados internos;
- dependencia de ajustes manuais no banco para colocar uma nova barbearia em operacao;
- risco de mistura de dados entre tenants em uma evolucao SaaS mal isolada.

O Job e Comissoes centraliza essa operacao em uma unica aplicacao, com tenant isolation e fluxos separados por papel.

---

## Funcionalidades principais

- agenda interna com status de agendamento;
- booking publico por slug;
- catalogo de barbeiros por tenant;
- catalogo de servicos por tenant;
- configuracao de business hours e `slot_step_minutes` por barbearia;
- onboarding de owner e checklist operacional;
- branding publico da barbearia;
- vinculacao de barbeiro a usuario por e-mail via RPC;
- painel do barbeiro com agenda propria;
- criacao manual de agendamento pelo barbeiro usando a sessao autenticada;
- controle de comissoes, vales e relatorios;
- persistencia em Supabase com fallback local apenas para dev/demo;
- autenticacao com roles `owner` e `barber`;
- isolamento multi-tenant por `barbershop_id`.

---

## Estado atual do produto

O estado atual real do app inclui:

- multi-tenant por `barbershop_id`;
- booking publico por `/book/:slug`;
- onboarding de owner com criacao de barbearia;
- checklist operacional do owner;
- catalogo de barbeiros e servicos por tenant;
- horarios e `slot_step_minutes` por barbearia;
- branding publico por barbearia;
- vinculacao owner -> barber por e-mail via RPC `link_barber_profile_by_email`;
- painel do barbeiro com leitura da propria agenda;
- criacao manual de agendamento pelo barbeiro usando `authSession.barbershopId` e `authSession.barberId`;
- bloqueio de slug invalido no booking publico;
- validacao robusta de payload no booking publico;
- bloqueio de horarios duplicados ativos;
- fail-closed em producao sem Supabase configurado;
- cobertura automatizada com Vitest e Playwright.

O fallback local existe para desenvolvimento e demonstracao. Em producao, o app nao deve operar dados reais sem Supabase configurado.

---

## Demonstracao

Deploy atual:

```txt
https://job-e-comiss-es.vercel.app
```

Rotas principais:

```txt
/                 painel interno ou fluxo publico conforme contexto
/book/:slug       booking publico da barbearia
/book             rota publica sem slug explicito
/agendar          alias publico
/onboarding       criacao inicial da barbearia do owner
```

Fluxo publico:

```txt
Cliente acessa /book/:slug
-> escolhe barbeiro
-> escolhe servico
-> escolhe data e horario
-> informa nome e telefone
-> confirma agendamento
```

Fluxo owner:

```txt
Owner entra no painel
-> configura barbearia
-> define dias/horarios
-> cria barbeiros
-> cria servicos
-> verifica checklist
-> usa o link /book/:slug
```

Fluxo barber:

```txt
Barber entra com conta vinculada
-> ve apenas a propria agenda
-> cria agendamento manual apenas para si
-> atualiza status do proprio fluxo operacional
```

---

## Arquitetura

A aplicacao separa interface, regras de negocio e persistencia por repositories.

```txt
Frontend React
|- rotas publicas
|  \- booking publico por slug
|
|- painel interno
|  |- owner
|  \- barber
|
|- camada de dominio
|  |- appointments
|  |- barbers
|  |- services
|  |- barbershops
|  \- finance
|
|- repositories
|  |- Supabase
|  \- fallback local para dev/demo
|
\- infraestrutura
   |- Supabase Auth
   |- Supabase Database
   |- Supabase RLS
   \- Vercel
```

Decisoes importantes:

- React + TypeScript no frontend;
- Supabase como backend gerenciado;
- repositories para separar UI e persistencia;
- fallback local apenas fora de producao;
- booking publico desacoplado de `appointments` completos;
- tenant isolation por `barbershop_id`.

---

## Stack

### Frontend

- React 19
- TypeScript
- Vite
- TailwindCSS
- Framer Motion
- jsPDF

### Backend as a Service

- Supabase Auth
- Supabase Database
- Supabase Row Level Security
- Supabase Storage para branding

### Qualidade

- Vitest
- Playwright
- TypeScript typecheck
- GitHub Actions

### Deploy

- Vercel

---

## Seguranca e multi-tenant

O app usa `barbershop_id` como chave principal de isolamento de tenant.

Modelo base:

```txt
barbershops
|- profiles
|- barbers
|- services
|- appointments
\- financial records
```

Pontos principais do modelo atual:

- RLS tenant-aware no Supabase;
- owner opera a propria barbearia;
- barber opera apenas o proprio escopo autenticado;
- booking publico nao faz `SELECT` publico em `appointments`;
- disponibilidade publica usa `public_appointment_slots`;
- payload publico e validado antes de chegar ao Supabase;
- RPC dedicada para vinculo owner -> barber por e-mail;
- regressao automatizada para mutations sensiveis entre tenants;
- fallback/localStorage nao deve ser tratado como auth de producao.

Limites importantes:

- isso nao significa seguranca absoluta;
- persistencia de sessao em SPA ainda merece hardening continuo contra XSS;
- CAPTCHA, rate limiting externo e observabilidade ainda podem evoluir.

Mais detalhes:

- [docs/security-model.md](./docs/security-model.md)
- [docs/barber-profile-linking-rpc.md](./docs/barber-profile-linking-rpc.md)

---

## Booking publico

O booking publico e tenant-aware e opera por slug.

Comportamento atual:

- carrega a barbearia por `/book/:slug`;
- lista apenas barbeiros ativos da barbearia;
- lista apenas servicos ativos da barbearia;
- usa business hours e `slot_step_minutes` da barbearia do slug;
- valida `barbershop_id`, `barber_id`, `service_id`, `start_at` e `end_at`;
- cria appointment sem exigir `SELECT` publico em `appointments`;
- bloqueia conflito de horario ativo para o mesmo barbeiro.

O booking publico nao deve assumir tenant padrao silencioso em producao.

---

## Painel interno

O painel interno hoje ja diferencia claramente owner e barber.

### Owner

- cria e configura a propria barbearia;
- edita branding publico;
- define dias e horarios de funcionamento;
- define `slot_step_minutes`;
- cria, edita, remove ou desativa barbeiros e servicos;
- usa checklist operacional para readiness do booking;
- vincula barbeiro a usuario por e-mail via RPC.

### Barber

- entra apenas com profile coerente;
- ve somente a propria agenda;
- cria agendamento manual apenas para o proprio `barberId`;
- usa `barbershopId` e `barberId` da sessao, nao do formulario.

Fluxo operacional completo:

- [docs/owner-barber-operational-flow.md](./docs/owner-barber-operational-flow.md)

---

## Como rodar localmente

Clone o repositorio:

```bash
git clone https://github.com/leorecoa/Job-e-Comiss-es.git
cd Job-e-Comiss-es
```

Instale as dependencias:

```bash
npm install
```

Crie o arquivo de ambiente:

```bash
cp .env.example .env
```

Configure:

```txt
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Rode em desenvolvimento:

```bash
npm run dev
```

Acesse:

```txt
http://localhost:5173
```

Sem Supabase configurado, o app pode usar fallback local apenas em dev/demo. Em producao, o comportamento esperado e fail-closed.

---

## Testes e qualidade

Cobertura atual:

- Vitest para regras de dominio, repositories e regressao de seguranca;
- Playwright E2E para booking publico;
- Playwright E2E para painel do barbeiro;
- Playwright E2E para fluxo operacional do owner;
- testes de regressao para tenant isolation e mutations sensiveis;
- validacao de fail-closed sem Supabase em producao.

Comandos principais:

```bash
npm run test
npm run typecheck
npm run build
npm run validate
npm run check
npm audit --audit-level=moderate
npx playwright test
```

Documentacao relacionada:

- [docs/security-model.md](./docs/security-model.md)
- [docs/dependency-audit.md](./docs/dependency-audit.md)
- [docs/owner-barber-operational-flow.md](./docs/owner-barber-operational-flow.md)
- [docs/barber-profile-linking-rpc.md](./docs/barber-profile-linking-rpc.md)
- [docs/performance-notes.md](./docs/performance-notes.md)

---

## Performance

Apos a baseline `v0.9.0-pilot`, o app recebeu um passe de performance focado no carregamento inicial:

- bundle inicial reduzido de aproximadamente 738 kB para 491 kB;
- gzip do chunk principal reduzido de aproximadamente 203 kB para 138 kB;
- warning do Vite sobre chunk maior que 500 kB deixou de aparecer;
- lazy loading aplicado em dashboards, modais e superficies internas;
- booking publico preservado como entrada direta para `/book/:slug`;
- splash e loading inicial foram reduzidos para nao dominar a primeira renderizacao;
- imagens do booking usam `decoding="async"` e a capa above-the-fold usa prioridade alta quando aplicavel.

Ultima medicao registrada em Lighthouse mobile simulation:

```txt
FCP         ~2.1s
LCP         ~3.3s
Speed Index ~2.1s
```

Esses numeros variam conforme rede, dispositivo, cache e dados carregados no tenant. As mudancas nao alteraram booking publico, dashboard owner, dashboard barber ou isolamento por tenant.

---

## Limites atuais

O projeto ainda nao implementa:

- billing ou assinatura;
- convite formal por e-mail;
- admin global ou suporte operacional multi-tenant;
- observabilidade mais completa;
- rate limit externo e CAPTCHA;
- polimento final de UX em alguns estados vazios e fluxos de onboarding.

---

## Roadmap

Proximos passos mais relevantes:

- melhorar empty states de owner e barber;
- evoluir onboarding comercial da barbearia;
- implementar billing e assinatura;
- criar convite de equipe mais formal;
- ampliar observabilidade e auditoria operacional;
- endurecer ainda mais sessao e superficie de XSS;
- preparar release piloto com fluxo comercial mais completo.

---

## Screenshots

Adicione aqui imagens reais do produto.

Sugestao de organizacao:

### Dashboard

![Dashboard](./docs/screenshots/dashboard.png)

### Agenda

![Agenda](./docs/screenshots/agenda.png)

### Booking publico

![Booking publico](./docs/screenshots/booking.png)

### Gestao de servicos

![Servicos](./docs/screenshots/services.png)

### Branding da barbearia

![Branding](./docs/screenshots/branding.png)

---

## Licenca

Consulte o arquivo [LICENSE](./LICENSE).

---

## Autor

Desenvolvido por Leandro Jesse.

GitHub:

https://github.com/leorecoa
