# Processo de release

A produção usa `main` como branch de publicação. Mudanças normais não devem ser enviadas diretamente para `main`.

## Fluxo obrigatório

1. Criar uma branch curta por mudança ou lote coerente.
2. Fazer todos os commits intermediários nessa branch. A Vercel pode criar Preview para a branch ou PR; conferir build, health e isolamento antes de usá-lo como gate de aceite.
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

## Estado da proteção em 2026-09-24

- O repositório é público e o plano GitHub Free pode aplicar proteção a `main`, mas a regra de PR/checks ainda não foi salva. Enquanto isso, um push direto pode disparar Production antes do Quality Gate terminar.
- A regra preparada exige PR, `quality-gate`, `acquisition-e2e`, branch atualizada, conversas resolvidas e bloqueio de bypass; não exige aprovação de outro usuário porque não há revisor independente configurado. Confirmar a regra em Settings → Branches e o campo `protected` da API após aplicá-la.
- Observação ao vivo: a Vercel criou Preview para este PR, apesar de `vercel.json` conter `git.deploymentEnabled` para `main`. O deployment está READY, mas `/api/health` responde 500 sem a configuração de Preview. Investigar a divergência entre configuração e comportamento. Preview só pode ser gate após configurar credenciais e dados de teste isolados, proteção de acesso e webhooks de teste.
- Antes do primeiro cliente pagante: validar plano Vercel para uso comercial, identidade e contato nos textos legais, uma aquisição real controlada e o primeiro acesso ao SaaS. O teste `acquisition-e2e` automatizado não compra nem provisiona um cliente real.
- Até a proteção entrar em vigor, conferir o SHA do PR e do CI antes do merge; verificar health e logs de Production depois da publicação.
