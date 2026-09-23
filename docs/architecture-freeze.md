# Architecture Freeze — Vendas

Baseline: `engineering-v1`.

- `index.html`: conteúdo e semântica da aquisição.
- `site.js`: comportamento do site e checkout, sem regra jurídica ou schema.
- `site.css`, `motion.css` e `sales-theme.css`: camadas visuais canônicas; não criar folhas de correção paralelas.
- `server/api/`: rotas HTTP fonte.
- `server/lib/`: billing, Mercado Pago e integrações comerciais.
- `contracts/`: única fonte dos contratos compartilhados consumidos pelos demais repositórios.
- `api/`: wrappers gerados para deploy.
- O SaaS principal é o único proprietário de Auth do produto, documentos, RLS e migrations.

Alterar essas fronteiras exige PR explícita, documentação, atualização deliberada do contrato quando necessário e CI verde. Novas integrações entre os três sistemas devem usar contratos versionados em vez de copiar implementação.
