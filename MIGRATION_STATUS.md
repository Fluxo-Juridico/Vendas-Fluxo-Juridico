# Status da migração — Vendas

Atualizado em 19/09/2026.

## Referência funcional

Snapshot de referência: v30, preservado em `archive/source-v30/`.

## Concluído

- Página comercial e APIs ativas versionadas no GitHub.
- Backend organizado com fonte em `server/api/` e `server/lib/`.
- `api/` reduzido a wrappers de deploy gerados automaticamente.
- Checkout recorrente Mercado Pago preservado.
- Webhook com validação HMAC e consulta autoritativa ao provedor preservado.
- CRM e exportações internas assinadas preservados.
- Provisionamento assinado para o SaaS principal preservado.
- Nomenclatura e URLs do provedor anterior removidas do código ativo.
- `SAAS_BASE_URL` obrigatória para provisionamento.
- Timeouts com `AbortSignal.timeout`.
- Schema Postgres/Supabase versionado para leads, pedidos e eventos.
- RLS habilitado e acesso direto de clientes bloqueado.
- Retry de provisionamento autenticado por `CRON_SECRET`.
- Cron diário preparado em `vercel.json`.
- Métodos HTTP explicitamente validados.
- GitHub Actions valida estrutura, build, migrations, sintaxe, segredos, nomenclatura e métodos HTTP.
- Deploy automático da Vercel permanece desativado nesta etapa.

## Pendente para homologação

- Aplicar e confirmar migrations no banco de destino.
- Configurar variáveis reais no ambiente de hospedagem.
- Testar checkout real, webhook, recorrência, cancelamento e retry ponta a ponta.
- Confirmar integração Vendas → Admin → SaaS antes de publicar domínio.
