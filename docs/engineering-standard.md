# Padrão de engenharia — Fluxo Jurídico

Versão canônica: `engineering-v1`.

Os três repositórios do produto seguem o mesmo ciclo de mudança: **branch → testes → lint/análise estática → build → predeploy → PR → CI verde → merge**.

## Fronteiras

- **Vendas**: aquisição, checkout, Mercado Pago, webhook, CRM comercial e contratos compartilhados.
- **Principal**: autenticação, organizações, operação jurídica, documentos, storage e schema do banco.
- **Administrativo**: administração da plataforma, acesso de clientes e observabilidade de billing.

Uma regra de negócio deve ter um único proprietário. Integrações entre repositórios usam contratos versionados em `@fluxo-juridico/contracts`; consumidores fixam SHA imutável.

## Código

- Nomes descrevem responsabilidade; não usar nomes versionados como `final-v2`, `module-7` ou `fix-new`.
- Entry points apenas compõem dependências e iniciam features.
- Código novo deve ser modular e ter responsabilidade única.
- Arquivos de compatibilidade não recebem funcionalidades novas.
- Dados volumosos ficam em arquivos de dados ou storage, não embutidos em módulos de execução.
- Segredos nunca são versionados.

## Nomenclatura e comentários

- Código canônico usa arquivos em `kebab-case` e nomes baseados em responsabilidade.
- Contratos versionados como `billing-v1.js` são exceção deliberada; nomes temporários como `final`, `old`, `copy`, `new-fix` ou `module-7` não são permitidos.
- Comentários explicam decisões, invariantes e integrações externas; não narram o código linha a linha.
- `TODO`, `FIXME` e `HACK` exigem uma issue rastreável.
- `npm run format` cobre código ativo, contratos, configuração e documentação; `npm run check:maintainability` protege nomenclatura e comentários no CI.

## Qualidade

Toda PR deve passar por:

1. `npm test`
2. `npm run check`
3. `npm run check:static`
4. `npm run build`
5. `npm run predeploy`

O formatter é executado com `npm run format`; o CI verifica as superfícies canônicas com `npm run format:check`.

## Mudanças entre sistemas

Mudanças em billing, aquisição, planos, limites ou protocolos exigem atualização do contrato compartilhado, testes nos consumidores e novo SHA fixado. Mudanças de schema pertencem somente ao Principal e são forward-only.
