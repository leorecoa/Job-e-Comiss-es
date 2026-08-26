# Supabase Security Advisors

## Corrigido

- `public_bucket_allows_listing`: a policy SELECT publica ampla do bucket `barbershop-branding` foi removida. O bucket continua publico e seus arquivos continuam acessiveis por URL publica.
- Owners autenticados mantem SELECT somente no proprio prefixo tenant e nas operacoes de informacao, upload e remocao exigidas pelo Storage. O helper operation-aware bloqueia `object.list` e a listagem do bucket.

## Aceitos por desenho

As RPCs `SECURITY DEFINER` abaixo usam `search_path` controlado e possuem EXECUTE revogado de `PUBLIC`. Os testes de banco validam seus grants e limites:

- Booking publico: `create_public_appointment` e `get_public_appointment_slots` aceitam `anon` e `authenticated`, resolvem o tenant pelo argumento validado e expõem somente o contrato publico necessario.
- Operacoes internas: `complete_appointment_with_financial_record`, `create_owner_barbershop`, `get_internal_appointments`, `link_barber_profile_by_email` e `update_owner_appointment` exigem `auth.uid()`, profile ativo e validacoes de role/tenant aplicaveis.

Essas funcoes precisam de `SECURITY DEFINER` para executar operacoes atomicas ou leituras projetadas sem reabrir acesso direto amplo as tabelas.

## Limitacao do plano

- `auth_leaked_password_protection` permanece aberto porque a protecao de senhas vazadas depende do Supabase Pro. Nao ha workaround proprio de consulta a senhas vazadas.
