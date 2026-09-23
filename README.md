# Fluxo Jurídico — Vendas

Site comercial e camada de aquisição/cobrança do Fluxo Jurídico.

## Estrutura atual

- `index.html` e `site.js`: estrutura e comportamento da interface comercial.
- `site.css`: layout e componentes estruturais.
- `motion.css`: animações e transições.
- `sales-theme.css`: tema comercial canônico, tipografia e refinamentos responsivos.
- `server/api/`: checkout, consulta de pagamento, webhook, CRM interno e jobs.
- `server/lib/`: domínio de billing, Mercado Pago e provisionamento.
- `api/`: wrappers serverless **versionados**, gerados a partir de `server/api/`; são artefatos de deploy e não devem ser editados manualmente.
- `platform/runtime/`: adaptador local de banco, configuração e HMAC.
- `supabase/README.md`: contrato de banco consumido pelo Vendas. Migrations são mantidas exclusivamente no SaaS principal.
- `scripts/`: validações de integridade, build e pré-deploy.
- `vercel.json`: headers, cron e política de deploy manual.

Não há snapshots históricos, migrations locais ou cópias paralelas do código ativo no repositório.

## Responsabilidades

O projeto de Vendas é responsável por:

- apresentação comercial dos planos;
- validação dos dados de contratação;
- criação de lead e pedido;
- criação/reutilização de checkout;
- integração direta com Mercado Pago;
- recebimento e validação de webhook;
- normalização do estado de pagamento;
- provisionamento assinado para o SaaS principal;
- exportações internas assinadas para o Administrativo;
- retry de provisionamento por job autenticado.

A gestão de usuários e regras jurídicas não pertencem a este repositório.

## Planos

| Plano | Mensalidade | Usuários | Armazenamento |
| --- | ---: | ---: | ---: |
| Solo | R$ 99 | 2 | 5 GB |
| Essencial | R$ 197 | 3 | 15 GB |
| Profissional | R$ 297 | 10 | 25 GB |
| Premium | R$ 497 | 20 | 100 GB |

O catálogo canônico também é validado no CI para impedir divergência silenciosa com o Administrativo e o SaaS principal.

## Fluxo

1. O cliente escolhe o plano.
2. Os dados comerciais são validados.
3. Lead e pedido são gravados no Postgres/Supabase.
4. Checkout pendente recente do mesmo e-mail/plano é reutilizado quando aplicável.
5. O Mercado Pago processa a cobrança.
6. O webhook valida assinatura e consulta o recurso autoritativo no provedor.
7. O estado de pagamento é persistido.
8. Eventos terminais provisionam ou bloqueiam o acesso no SaaS por ponte HMAC.
9. Falhas transitórias entram em retry autenticado.

Dados de cartão e CVV não passam pela aplicação.

## Variáveis obrigatórias

- `DATABASE_URL`
- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `BILLING_BRIDGE_SECRET`
- `CRON_SECRET`
- `SAAS_BASE_URL`
- `CHECKOUT_ENABLED`
- `AUTO_ACTIVATE_ON_APPROVED`

Preços, usuários e armazenamento podem ser configurados pelas variáveis documentadas em `.env.example`.

## Validação

- `npm run verify`: executa testes e a auditoria estrutural local em uma única etapa.
- `npm run check`: valida arquitetura, sintaxe, segredos, billing, catálogo de planos e ausência de legado.
- `npm run build`: gera os wrappers de `api/` e os arquivos públicos temporários sem versioná-los.
- `npm run predeploy`: valida a configuração necessária para publicar.

Veja também `docs/maintenance.md` para regras de ownership, limpeza e publicação.

## Fluxo entre sistemas

`Vendas → Mercado Pago → Vendas → SaaS principal`

`Vendas → exportações HMAC → Administrativo`

## Governança do banco

O projeto de Vendas consome o mesmo Postgres/Supabase da plataforma, mas **não é dono do schema**. Toda mudança futura de tabela, índice, policy, função ou trigger deve ser criada e versionada em `Fluxo-Juridico/Fluxo-Juridico/supabase/migrations/`.
