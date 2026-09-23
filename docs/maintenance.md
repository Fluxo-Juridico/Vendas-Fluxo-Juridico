# Manutenção do site de Vendas

## Responsabilidade

Este repositório possui somente aquisição e billing público: site comercial, checkout, Mercado Pago, webhook, CRM de origem e provisionamento assinado.

Regras jurídicas, Auth do produto, documentos, RLS e migrations pertencem ao SaaS principal.

## Frontend

- `index.html`: conteúdo e semântica.
- `site.js`: comportamento e checkout.
- `site.css`: layout e componentes.
- `motion.css`: animações.
- `sales-theme.css`: tema visual, hierarquia tipográfica e responsividade fina.

Não criar folhas `final.css`, `fix-v2.css`, `refinement.css` ou similares. Altere a camada proprietária correta.

## Backend

- `server/api/`: rotas fonte.
- `server/lib/`: billing e integrações compartilhadas.
- `api/`: wrappers versionados gerados; nunca editar manualmente.
- `contracts/billing-v1.js`: fonte canônica do billing compartilhado.
- `contracts/subscription-management-v1.js`: fonte canônica da gestão de assinatura compartilhada.
- `contracts/acquisition-v1.js`: jornada canônica de aquisição, do checkout ao primeiro login.
- `contracts/engineering-v1.js`: padrão de engenharia compartilhado pelos três repositórios.
- `package.json#exports`: superfície pública do pacote `@fluxo-juridico/contracts`; consumidores devem fixar um SHA imutável.

## Antes de integrar

1. `npm run verify`
2. `npm run test:e2e`
3. `npm run build`
4. `npm run predeploy`
5. revisar o diff para segredos e código de outro domínio
6. integrar somente com CI verde

## Publicação

Somente `main` gera deploy automático. Um release só está concluído quando o deployment de produção estiver READY e checkout/webhook não apresentarem erros novos.

## Padrão compartilhado

O contrato `engineering-v1` é comum ao Vendas, Principal e Administrativo. O CI aplica ESLint de segurança/análise estática e o formatter canônico. Mudanças em integração ou aquisição devem usar `@fluxo-juridico/contracts` e preservar a sequência definida em `acquisition-v1`.

O browser E2E cobre a contratação visível: escolha de plano → dados do checkout → retorno de pagamento aprovado → provisionamento ativado → link de primeiro acesso.

## Baseline congelada

As fronteiras estruturais do site de Vendas estão registradas em `docs/architecture-freeze.md`. O Vendas permanece proprietário da aquisição, billing público e contratos compartilhados; não recebe schema, regras jurídicas ou Auth do produto.

## Legibilidade e manutenção

O código ativo usa nomes de arquivo em `kebab-case`, nomenclatura baseada em responsabilidade e formatação canônica por Prettier. Comentários devem registrar decisões, invariantes ou contexto externo; não devem repetir o que nomes de funções e variáveis já expressam.

Marcadores `TODO`, `FIXME` e `HACK` só podem permanecer vinculados a uma issue rastreável. `npm run check:maintainability` verifica essas convenções e participa de `npm run check:static`. O comando `npm run format` normaliza a baseline de código, configuração e documentação.
