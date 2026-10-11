# E-mails do Fluxo Jurídico

Modelos preparados para revisão; ainda não instalados no Supabase e ainda sem envio de transações pelo Vendas. `preview.html` contém exemplos fictícios e permite baixar o HTML de cada modelo. A logo PNG pública preserva a marca usada no produto e oferece compatibilidade com leitores de e-mail que não exibem SVG.

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

Estes são modelos para integração, sem motor de envio instalado. Antes de ativar, selecionar o serviço e o remetente com domínio verificado. Preencher os campos pelo servidor, escapando HTML nos dados do cliente. Construir `order_status_url` e `login_url` a partir das URLs oficiais configuradas, exigindo HTTPS. Nunca aceitar esses links a partir do navegador.

O envio deve manter uma fila persistente e uma chave única por pedido e tipo de aviso, permitindo repetir uma falha sem duplicar mensagens já aceitas. Registrar os estados aguardando, aceito pelo provedor e falha. Aceito não comprova entrega na caixa de entrada. Erros de e-mail não devem desfazer uma compra ou liberar acesso por conta própria.

Não enviar compra aprovada para pagamentos pendentes ou recusados. Não enviar liberação para uma conta bloqueada, para HTTP 200 sem confirmação, nem enquanto o acesso estiver em repetição. Não reenviar avisos de compras antigas automaticamente ao ativar o serviço.

## Verificação final após configuração

Em homologação, conferir um convite e uma recuperação em caixa de teste; confirmar que o link abre a etapa correta para definir senha. Depois testar pagamento aprovado, pendente, recusado, repetição do webhook e falha de envio, usando credenciais e compradores de teste. Nenhuma mensagem real foi enviada na preparação dos modelos.
