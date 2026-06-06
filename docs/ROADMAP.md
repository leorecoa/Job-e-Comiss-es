# Roadmap

Este roadmap organiza melhorias futuras por impacto e complexidade.

## Curto prazo

- Mover roles de `user_metadata` para tabela `profiles` com policies.
- Melhorar a tela publica de booking com link copiavel e tema por barbearia.
- Refinar a agenda diaria com atalhos de horario e filtros de status.
- Capturar screenshots publicas com dados ficticios.
- Criar ambiente de demonstracao.
- Adicionar testes de interface para cadastro de atendimento.
- Melhorar mensagens de erro em backup/restauracao.
- Documentar exemplos de relatorio PDF e CSV.

## Medio prazo

- Ativar Supabase Auth para painel interno.
- Criar roles de owner/barber com policies por permissao.
- Endurecer RLS para appointments, barbers e services.
- Adicionar suporte multi-barbearia com isolamento por tenant.
- Criar link publico por barbearia com slug configuravel.
- Migrar agenda e financeiro para Supabase com sincronizacao multi-dispositivo.
- Compartilhar agenda entre dispositivos em tempo real.
- Persistencia em backend para multi-dispositivo.
- Autenticacao real e controle de plano fora do frontend.
- Autenticacao com papeis para dono, barbeiro e cliente.
- Lembretes automaticos para agendamentos confirmados.
- Fechamento mensal por barbeiro.
- Historico de pagamentos e status de comissao.
- Exportacao de backup versionado com migracoes.

## Longo prazo

- Painel administrativo para barbearias com equipe.
- Controle de estoque de produtos.
- Integracao com pagamentos.
- Dashboard de indicadores comerciais.
- Deploy com dominio proprio e monitoramento.

## Criterios de priorizacao

1. Protege dados financeiros ou reduz risco operacional.
2. Melhora fluxo diario de cadastro e fechamento.
3. Aumenta confiabilidade via testes e automacao.
4. Melhora apresentacao publica do projeto.
