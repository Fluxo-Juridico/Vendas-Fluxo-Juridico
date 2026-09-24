# Homologação real de aquisição

Este fluxo é manual e deliberadamente separado do CI comum. Ele **não cria checkout nem executa cobrança automaticamente**.

## Objetivo

Comprovar em produção a sequência real:

Vendas → Mercado Pago → webhook → pedido aprovado → billing → organização → identidade Auth → Owner → plano/limites → primeiro acesso.

## Workflow

Use **Live Acquisition Homologation** no GitHub Actions.

### 1. `preflight`

Não altera dados. Verifica:

- `/api/health`;
- contrato `billing-v1`;
- billing online habilitado;
- catálogo dos quatro planos;
- Termos de Uso e Política de Privacidade publicados.

### 2. `order`

Informe o UUID de um pedido de teste controlado. Verifica:

- status público do pedido;
- registro correspondente em `sales.sales_orders`;
- aceite versionado de Termos e Privacidade.

### 3. `provisioned`

Use depois de concluir o pagamento de teste no Mercado Pago. Exige:

- pagamento `approved`;
- assinatura do provedor vinculada;
- provisionamento `activated`;
- `billing.platform_accounts` ativa e `provisioned`;
- `organization_id` e `auth_user_id`;
- membership Owner ativa;
- plano, assentos e armazenamento aplicados.

### 4. `first-access`

Use depois de abrir o convite/login real do Owner. Além dos itens anteriores, exige `auth.users.last_sign_in_at`.

## Segredo necessário

O repositório precisa de um GitHub Actions secret chamado `LIVE_DATABASE_URL`, contendo uma conexão PostgreSQL de produção apropriada para a homologação.

Nunca coloque a URL do banco no código, workflow, issue ou log.

## Limites

O workflow não digita cartão, não conclui pagamento e não lê e-mail do usuário. A etapa de pagamento e o clique no convite continuam sob controle humano.

Depois que os quatro estágios passarem para um mesmo pedido de teste, o fluxo Mercado Pago → SaaS pode ser considerado homologado até o primeiro acesso real.
