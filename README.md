# Fluxo Jurídico — Página de Vendas

Site comercial migrado da versão v30 do Hatchable, com checkout Mercado Pago e CRM.

## Planos

| Plano | Mensalidade | Usuários | Armazenamento |
| --- | ---: | ---: | ---: |
| Solo | R$ 99 | 2 | 5 GB |
| Essencial | R$ 197 | 3 | 15 GB |
| Profissional | R$ 297 | 10 | 25 GB |
| Premium | R$ 497 | 20 | 100 GB |

## Fluxo preservado

1. O cliente escolhe o plano.
2. Nome, e-mail, CPF, escritório e telefone são validados.
3. O pedido e o lead são registrados no Postgres/Supabase.
4. O checkout recorrente é aberto no Mercado Pago.
5. O webhook confirma o estado real do pagamento.
6. Pagamento aprovado dispara provisionamento assinado no SaaS.
7. Reembolso, chargeback ou cancelamento podem bloquear o acesso.
8. O Admin sincroniza cobranças e CRM por HMAC.

Dados de cartão/CVV não passam pela aplicação.

## Variáveis obrigatórias

- `DATABASE_URL`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `BILLING_BRIDGE_SECRET`
- `CRON_SECRET`
- `SAAS_BASE_URL`
- `CHECKOUT_ENABLED`
- `AUTO_ACTIVATE_ON_APPROVED`

Os preços, limites de usuários e armazenamento também podem ser configurados pelas variáveis documentadas em `.env.example`.


## Recuperação automática

A rota `/api/jobs/retry-provisioning` exige `Authorization: Bearer <CRON_SECRET>` e é preparada para execução diária pelo cron da hospedagem. Ela tenta novamente apenas pedidos em estados de pagamento que exigem ação no SaaS e cujo provisionamento ainda não foi concluído.
