# E-mails do Fluxo Jurídico

Modelos de convite e recuperação preparados para instalar no Supabase. Compra e liberação estão integradas ao backend do Vendas com fila persistente; o envio depende da configuração do provedor e do remetente verificado. `preview.html` contém exemplos fictícios e permite baixar o HTML de cada modelo. A logo PNG pública preserva a marca usada no produto e oferece compatibilidade com leitores de e-mail que não exibem SVG.

| Arquivo         | Assunto                               | Gatilho                                                          |
| --------------- | ------------------------------------- | ---------------------------------------------------------------- |
| `recovery.html` | Redefina sua senha \| Fluxo Jurídico  | Recuperação solicitada pelo titular ou administrativo            |
| `invite.html`   | Seu primeiro acesso \| Fluxo Jurídico | Convite individual gerado pela autenticação                      |
| `purchase.html` | Compra aprovada \| Fluxo Jurídico     | Pagamento confirmado pela consulta autenticada ao Mercado Pago   |
| `access.html`   | Acesso liberado \| Fluxo Jurídico     | Provisionamento confirmado, identidade pronta e escritório ativo |

## Recuperação e convite

Instalar em Authentication → Email Templates do Supabase. Preservar `{{ .ConfirmationURL }}`: o link inclui a verificação individual; não substituir por uma URL comum de login. Configurar o endereço oficial de acesso e os redirecionamentos permitidos, além do remetente e SMTP. A instalação não é possível pela integração atual, que não expõe a configuração do Auth.

Referência oficial: https://supabase.com/docs/guides/auth/auth-email-templates e https://supabase.com/docs/guides/auth/auth-smtp.

## Compra e liberação

O motor de envio usa a API do Resend. Antes de ativar, configurar `RESEND_API_KEY` como segredo, `EMAIL_FROM` no formato `Fluxo Jurídico <remetente@dominio-verificado>` e `EMAIL_DELIVERY_ENABLED=true` no Vendas. `SALES_BASE_URL` e `SAAS_BASE_URL` devem apontar para as URLs oficiais HTTPS. A chave permanece no servidor. O Supabase usa a configuração SMTP do mesmo remetente ou do provedor escolhido para os emails de autenticação. Preencher os campos pelo servidor, escapando HTML nos dados do cliente. Construir `order_status_url` e `login_url` a partir das URLs oficiais configuradas, exigindo HTTPS. Nunca aceitar esses links a partir do navegador.

A tabela interna `billing.email_outbox` mantém uma chave única por pedido e tipo de aviso, HTML e remetente estáveis nas repetições, lease de processamento e estados `waiting`, `sending`, `retry`, `accepted`, `review` e `cancelled`. Ela não possui acesso de navegador. O job existente de repetição do provisionamento também processa a fila. Falhas definitivas e tentativas incertas fora da janela de deduplicação do provedor exigem revisão, evitando reenvio automático possivelmente duplicado. Aceito não comprova entrega na caixa de entrada. Erros de e-mail não devem desfazer uma compra ou liberar acesso por conta própria.

Não enviar compra aprovada para pagamentos pendentes ou recusados. Não enviar liberação para uma conta bloqueada, para HTTP 200 sem confirmação, nem enquanto o acesso estiver em repetição. Não reenviar avisos de compras antigas automaticamente ao ativar o serviço.

## Verificação final após configuração

Em homologação, conferir um convite e uma recuperação em caixa de teste; confirmar que o link abre a etapa correta para definir senha. Depois testar pagamento aprovado, pendente, recusado, repetição do webhook e falha de envio, usando credenciais e compradores de teste. Nenhuma mensagem real foi enviada na preparação dos modelos.

## Estado da validação

Os testes automatizados cobrem os quatro modelos, escape de dados, links, rejeição do provedor, repetição, pagamentos não aprovados e bloqueio posterior do acesso. A migration e a reivindicação atômica de uma mensagem foram testadas no banco de homologação com rollback. Isso não comprova entrega: ainda é necessário configurar o remetente/SMTP e confirmar convite, recuperação, compra e liberação na caixa de teste. Não habilitar o envio antes dessa configuração.
