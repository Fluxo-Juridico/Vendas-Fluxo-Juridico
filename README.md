# Fluxo Jurídico — Página de Vendas

Site comercial do Fluxo Jurídico. A implementação funcional de referência é a v30; a infraestrutura ativa está desacoplada do provedor anterior.

## Arquitetura

- `server/api/`: código-fonte das rotas de checkout, webhook, CRM e jobs.
- `server/lib/`: regras compartilhadas de billing, Mercado Pago e integrações.
- `api/`: wrappers finos de deploy gerados a partir de `server/api/`.
- `platform/runtime/`: adaptador local de banco, configuração e HMAC.
- `archive/source-v30/`: snapshot somente para auditoria e comparação.
- `supabase/migrations/`: schema e políticas versionadas.
- arquivos de interface na raiz permanecem inalterados para preservar o comportamento atual.

O código em `archive/` não participa do runtime.

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

Preços, usuários e armazenamento também podem ser configurados pelas variáveis documentadas em `.env.example`.

## Validação local/CI

- `npm run check`: valida arquitetura, sintaxe, segredos, contratos e nomenclatura.
- `npm run build`: regenera os wrappers de `api/` sem alterar a lógica de negócio.
- `npm run predeploy`: valida o contrato de configuração do ambiente.
