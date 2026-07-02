# Production Error Visibility

## Objetivo

Este documento registra o tratamento minimo de erros em producao no Job e Comissoes.

O app deve mostrar mensagens uteis para owner, barber e cliente, mas manter detalhes tecnicos apenas no console para diagnostico.

## Mensagens para usuario

Mensagens exibidas na UI devem diferenciar:

- estado vazio valido;
- erro de validacao;
- conflito de negocio, como horario ja reservado;
- sessao expirada ou incompleta;
- falha de rede;
- erro inesperado.

Exemplos esperados:

- `Nao foi possivel carregar os agendamentos. Tente novamente.`
- `Esse horario acabou de ser reservado. Escolha outro horario.`
- `Sua sessao pode ter expirado. Entre novamente.`
- `Nao foi possivel salvar as configuracoes da barbearia.`

Erros brutos do Supabase nao devem ser mostrados ao usuario final.

## Logs tecnicos

Detalhes tecnicos devem ser enviados ao console com contexto do fluxo:

```ts
logOperationalError('public-booking:create-appointment', error);
```

O log deve ajudar a identificar:

- fluxo;
- operacao;
- codigo conhecido, quando existir;
- mensagem tecnica sanitizada.

## Dados que nao devem ser logados

Nao registre:

- access token;
- refresh token;
- senha;
- `Authorization`;
- `apikey`;
- cookies;
- headers completos;
- objeto de sessao completo;
- payloads com dados pessoais de clientes quando nao forem necessarios.

## Diagnostico em producao

Para investigar um erro:

1. Reproduza o fluxo afetado no deploy.
2. Leia a mensagem exibida para o usuario.
3. Abra o console do navegador.
4. Procure logs com prefixo entre colchetes, como `[owner:load-catalog]`.
5. Compare o contexto do log com o fluxo testado.

Se o erro envolver banco, RLS ou RPC, valide o comportamento no Supabase sem liberar dados sensiveis no frontend.
