# Contrato Supabase — Vendas

Este repositório consome o banco compartilhado do Fluxo Jurídico, mas não é fonte de verdade do schema.

## Responsabilidade

- leads, pedidos e eventos de pagamento são persistidos pelo backend;
- tabelas comerciais permanecem protegidas contra acesso direto de `anon` e `authenticated`;
- alterações de schema não são criadas neste repositório;
- toda migration futura deve ser versionada em `Fluxo-Juridico/Fluxo-Juridico/supabase/migrations/` e aplicada de forma coordenada.

## Objetos consumidos

Entre os objetos usados pelo Vendas estão:

- `sales_leads`;
- `sales_orders`;
- `sales_payment_events`;
- estruturas de billing compartilhadas com provisionamento e sincronização.

O histórico de migrations já aplicado permanece no Supabase e no histórico do Git. Não mantenha snapshots SQL duplicados aqui.
