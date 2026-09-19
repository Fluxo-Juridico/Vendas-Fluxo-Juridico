# Status da migração — Vendas

Atualizado em 19/09/2026.

## Referência

Fonte funcional de referência: Hatchable v30.

## Concluído

- Página comercial e APIs ativas versionadas no GitHub.
- Checkout recorrente Mercado Pago.
- Webhook com validação HMAC e consulta autoritativa ao provedor.
- CRM e exportações internas assinadas.
- Provisionamento assinado para o SaaS principal.
- URLs antigas do Hatchable removidas do código ativo.
- `SAAS_BASE_URL` obrigatória para provisionamento.
- Timeouts com `AbortSignal.timeout`.
- Schema Postgres/Supabase versionado para leads, pedidos e eventos.
- RLS habilitado e acesso direto de clientes bloqueado.
- Retry de provisionamento autenticado por `CRON_SECRET`.
- Cron diário preparado em `vercel.json`.
- Métodos HTTP explicitamente validados.
- GitHub Actions valida migrations, sintaxe, segredos, URLs antigas e método das rotas.
- Deploy automático da Vercel desativado durante esta etapa.
- Snapshot completo da fonte Hatchable v30 preservado em `legacy-source/` para auditoria e comparação.

## Pendente para homologação

- Aplicar/confirmar a migration no banco de destino.
- Configurar variáveis reais no ambiente de hospedagem.
- Testar checkout real, webhook, recorrência, cancelamento e retry ponta a ponta.
- Confirmar integração Vendas → Admin → SaaS antes de publicar domínio.
