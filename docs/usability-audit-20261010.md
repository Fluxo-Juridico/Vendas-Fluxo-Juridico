# Auditoria de usabilidade — 10/10/2026

O site usa a mesma marca provisória e símbolos Microsoft Fluent do SaaS. A marca foi aplicada ao cabeçalho, rodapé, miniatura e área de segurança. Os símbolos das três propostas de valor representam cadastro, histórico e operação.

A navegação móvel mantém os links do produto acessíveis em uma faixa rolável. Os controles de acesso e contratação têm área de toque adequada; o checkout respeita largura e altura da tela. Os formulários bloqueiam submissões simultâneas e sinalizam carregamento para tecnologias assistivas.

## Validação

- 36 testes de unidade e contrato, incluindo billing, webhook e contratos entre produtos.
- Contratação simulada até pagamento aprovado e primeiro acesso.
- Identidade, largura de página e checkout em 1536, 768 e 390 px.
- Erros de envio de contato e checkout, com restauração do botão e preservação de dados.
- ESLint, Prettier, arquitetura e convenções de manutenção.

Os testes usam respostas simuladas; não efetuam cobranças reais nem comprovam o funcionamento em produção do Mercado Pago, webhook ou entrega de e-mails.
