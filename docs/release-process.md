# Processo de release

A produção usa `main` como branch de publicação. Mudanças normais não devem ser enviadas diretamente para `main`.

## Fluxo obrigatório

1. Criar uma branch curta por mudança ou lote coerente.
2. Fazer todos os commits intermediários nessa branch. Branches diferentes de `main` não geram deploy automático na Vercel.
3. Abrir Pull Request para `main`.
4. Exigir o Quality Gate verde e revisar o diff.
5. Executar/confirmar: `npm run verify && npm run test:e2e && npm run build && npm run predeploy`.
6. Integrar por **squash merge**, gerando um único commit de release em `main`.
7. Confirmar o check da Vercel em `success/READY`.
8. Executar smoke test do fluxo afetado e consultar logs/health.
9. Somente então considerar o release concluído.

## Critérios de aceite

- nenhum segredo ou dado de cliente no diff;
- migrations somente forward-only e pertencentes ao SaaS principal;
- contratos compartilhados permanecem versionados;
- Quality Gate verde;
- Vercel publicada;
- endpoint de health mostra commit e migration esperados;
- sem novos erros 5xx relevantes nos logs;
- rollback conhecido para mudanças de alto impacto.

## Regras

- não usar commits vazios ou alterações cosméticas em `main` apenas para forçar deploy, salvo recuperação operacional excepcional;
- agrupar correções relacionadas em uma única PR;
- não editar artefatos gerados como fonte;
- mudanças em billing, Auth, permissões, checkout ou banco exigem teste explícito no PR;
- alterações que dependam de variável de ambiente nova só podem ser integradas depois que a configuração de produção for confirmada.
