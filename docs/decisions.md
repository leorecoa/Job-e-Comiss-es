# Decisoes

## ADR 001 - SPA com Vite

O projeto permanece como SPA React + Vite para manter baixo custo e deploy simples.

## ADR 002 - Supabase com Fallback Local

Supabase e usado para persistencia online. `localStorage` permanece como fallback para desenvolvimento e demonstracoes locais.

## ADR 003 - Booking Publico Sem Login

Clientes podem agendar sem login. O fluxo publico deve ler apenas dados nao sensiveis e slots ocupados por view publica.

## ADR 004 - Sem Router Pesado

Enquanto as rotas forem poucas, o app usa deteccao simples por `window.location.pathname`.

## ADR 005 - Repositories para Persistencia

Componentes nao devem chamar Supabase diretamente. Acesso a dados fica concentrado em `services/`.
