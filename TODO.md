# TODO — Crepe OS

## Dashboard operacional

- [ ] Exibir uma visão inicial de gestão para a creperia com resumo de pedidos do dia, faturamento, ticket médio, tempo médio de preparo e itens em atenção.
- [ ] Exibir pedidos recentes com cliente, horário, tipo de pedido, valor e status visual.
- [ ] Exibir alertas de estoque baixo e ações rápidas relacionadas à operação.
- [ ] Exibir o estado de funcionamento da loja e permitir abrir ou pausar o recebimento de pedidos.

## Loja online e checkout

- [ ] Disponibilizar uma rota pública de loja com cardápio, categorias e itens disponíveis.
- [ ] Permitir adicionar produtos ao carrinho, ajustar quantidades e visualizar subtotal.
- [ ] Permitir escolher retirada ou entrega e coletar os dados mínimos do cliente para confirmar o pedido.
- [ ] Exibir a etapa de pagamento como parte do checkout, preparada para receber um provedor real sem simular uma cobrança concluída.
- [ ] Confirmar o pedido na fila interna após a finalização do checkout demonstrativo.

## Pedidos e delivery

- [ ] Disponibilizar navegação entre Visão geral, Pedidos, Cardápio, Estoque e Financeiro.
- [ ] Exibir um quadro Kanban com as etapas `Em análise`, `Em produção`, `Pronto para entrega` e `Concluído`.
- [ ] Permitir avançar um pedido para a próxima etapa do fluxo.
- [ ] Diferenciar canal de venda, forma/status de pagamento e modalidade de entrega ou retirada.
- [ ] Reservar no modelo de domínio os estados de expedição, entregador e taxa de entrega para a integração logística.
- [ ] Permitir filtrar a fila de pedidos por status.
- [ ] Permitir iniciar um novo pedido por uma ação primária visível.

## Cardápio e estoque

- [ ] Exibir produtos com categoria, descrição, preço e disponibilidade.
- [ ] Permitir alternar disponibilidade de itens do cardápio.
- [ ] Permitir registrar uma baixa rápida de estoque a partir de um alerta.

## Base técnica

- [ ] Manter a aplicação responsiva para desktop e celular.
- [ ] Servir `GET /manus-routes.json` com a rota principal declarada.
- [ ] Conservar a estrutura do template React/Express/tRPC/Drizzle para evolução com autenticação e persistência MySQL.

## Catálogo real da J'aime e preços sincronizados — concluído

- [x] Substituir os itens genéricos pelos 20 produtos reais do cardápio enviado, com nomes, categorias, descrições e preços da J'aime Creperia.
- [x] Permitir editar o preço diretamente no módulo Cardápio; o valor é salvo no catálogo compartilhado do frontend e aparece na loja pública `/loja`.
- [x] Permitir pausar um item no gestor e removê-lo automaticamente da loja pública.
- [x] Aplicar a identidade visual da marca com creme `#FFF3E2`, azul `#002B54`/`#011F41` e vermelho `#F23F46`.

## Operação completa: estoque, produção, entregas e pagamentos — em implementação

- [x] Controle de estoque com entradas, baixas, saldo disponível, estoque mínimo e alertas de compra.
- [x] Fichas de produção com rendimento, tempo, ingredientes, quantidades e custo estimado.
- [x] Controle de motoboys com status disponível, em rota ou fora de escala, além de contagem de entregas.
- [x] Configuração de taxa base, valor por quilômetro, raio máximo e pedido mínimo para entrega.
- [x] Configuração de Pix, cartão e dinheiro na entrega no painel.
- [x] Tela de configuração de pagamento online preparada para Stripe/Mercado Pago; Stripe sandbox habilitado no projeto.
- [x] Central de integrações com Site J'aime, iFood, WhatsApp e outro marketplace, com pedidos externos destinados à fila unificada.
- [x] Persistir o catálogo e pedidos no banco MySQL/Drizzle; o schema também está preparado para estoque, fichas, motoboys, taxas, integrações, métodos de pagamento e eventos Stripe.
- [x] Criar API tRPC para sincronizar catálogo, editar preço/disponibilidade, listar pedidos e criar pedidos do site.
- [x] Criar Checkout Session Stripe no servidor e webhook com assinatura, deduplicação por `event_id` e atualização do pedido para pago.
- [ ] Implementar os webhooks/API oficiais de cada plataforma externa, começando pelo contrato escolhido para iFood e WhatsApp Business.

## Loja conectada ao backend — concluído

- [x] A rota `/loja` consulta `menu.list` no banco e usa preço/disponibilidade persistidos, com fallback local apenas se o banco ainda não responder.
- [x] O checkout do site cria o pedido persistente antes do pagamento.
- [x] Pix/cartão encaminham para Checkout Session Stripe; “na entrega” confirma o pedido diretamente na fila.
- [x] A confirmação de pagamento depende do webhook Stripe, não apenas do retorno do navegador.

## Cardápio HTML original — concluído

- [x] Preservar a linguagem visual do `cardapio.html`: padrão xadrez, paleta original, tipografia de impacto, categorias e sacola lateral.
- [x] Reutilizar as imagens originais dos crepes como assets públicos do frontend.
- [x] Manter o visual original conectado ao catálogo persistente, preços editáveis, disponibilidade, criação de pedidos e checkout.

## Fornecedores e compras — implementado

- [x] Aba de fornecedores no gestor com cadastro de nome e WhatsApp.
- [x] Cotação criada a partir dos itens abaixo do mínimo do estoque.
- [x] Link individual de cotação enviado pelo WhatsApp com mensagem pré-preenchida.
- [x] Página pública para o fornecedor preencher preços, disponibilidade e condições.
- [x] Comparação das respostas por menor total e seleção do fornecedor vencedor.
- [x] Recebimento com entrada no estoque, registro de movimento e atualização do último custo.
