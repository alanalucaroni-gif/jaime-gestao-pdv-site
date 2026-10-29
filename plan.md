# Crepe OS — plano de implementação

## Escopo confirmado

Criar um sistema web de vendas e gestão para a J'aime Creperia, tomando como referência funcional o pacote `appdelivery-main.zip` e como referência visual/comercial o `cardapio.html` enviado. O produto deverá permitir vender pelo site/cardápio e administrar o ciclo completo: pedido, pagamento, produção, retirada ou entrega, logística e visão financeira. O MVP demonstra tanto o painel operacional quanto a loja/checkout, usando os 20 produtos reais do cardápio e sua identidade em creme, azul profundo e vermelho.

## Implementação

- React + TypeScript + Tailwind no frontend já provisionado.
- Dashboard responsivo em uma única rota inicial, com navegação lateral inspirada no painel WebRestaurant da referência e módulos de visão geral, pedidos, cardápio, estoque e financeiro.
- Prévia de loja online com cardápio, carrinho, dados de entrega/retirada e confirmação de pedido; o provedor de pagamento e o cálculo real de frete entram como integrações da próxima etapa.
- Quadro Kanban com os estágios `Em análise`, `Em produção`, `Pronto para entrega` e `Concluído`, permitindo avançar pedidos.
- Dados locais e interações demonstráveis (filtro de status, criação rápida de pedido, alteração de preço e disponibilidade, abertura/fechamento da loja e baixa de estoque). O catálogo compartilhado usa `localStorage` entre `/` e `/loja` nesta etapa de Preview; a próxima etapa deve persistir produtos e preços em MySQL/Drizzle para sincronização entre dispositivos.
- Reutilizar os componentes Radix existentes, lucide-react para ícones e estado local para que o MVP seja navegável mesmo antes de configurar autenticação e perfis.
- Manifesto de rotas estático em `public/manus-routes.json`.

## Estrutura principal

- `client/src/pages/Home.tsx`: shell operacional do dashboard, quadro Kanban, gestor de cardápio e módulos do MVP.
- `client/src/pages/Storefront.tsx`: experiência pública de cardápio, carrinho e checkout demonstrativo.
- `/loja`: rota pública para o canal de venda; `/`: painel interno da operação.
- `client/src/index.css`: tokens de cor, tipografia, superfícies e responsividade.
- `client/src/App.tsx`: rota raiz e providers.
- `drizzle/schema.ts`: tabelas de usuários existentes; futuras tabelas de produtos, pedidos, itens e movimentos de estoque.
- `server/routers.ts` e `server/db.ts`: pontos de extensão para queries e mutações persistentes.
- `public/manus-routes.json`: declaração das rotas visíveis.

## Design

### Direções consideradas

1. **Editorial utilitário** (0,07): alto contraste, tipografia grande e composição assimétrica inspirada na referência Figma.
2. **Café artesanal** (0,06): tons quentes, textura e linguagem mais acolhedora.
3. **Terminal de cozinha** (0,04): interface densa, codificada e orientada a filas.

Escolha: **Editorial utilitário**.

### Movimento de design

Um painel operacional inspirado na estrutura comprovada da referência — sidebar fixa, barra superior e conteúdo em cartões — com a identidade da J'aime: azul profundo, creme quente, vermelho vivo, tipografia display condensada e círculos/ovais que lembram um crepe. A interface tem hierarquia editorial, mas cada decisão serve para reduzir o tempo entre “ver” e “agir”.

### Princípios

- **Clareza de balcão:** estados, valores e alertas aparecem antes dos detalhes.
- **Contraste com propósito:** azul profundo e creme organizam o olhar; vermelho é reservado para ações e itens em atenção.
- **Ritmo modular:** blocos com bordas finas e cantos moderados, evitando o aspecto de template genérico.
- **Operação em movimento:** alvos de toque amplos, responsividade e ações rápidas sempre visíveis.

### Filosofia de cor

O azul profundo comunica confiança e controle; o creme traz o calor do papel do cardápio; o vermelho vivo dá apetite e energia comercial. Verde aparece apenas para estados semânticos de estoque e operação.

### Paradigma de layout

Sidebar escura fixa em desktop, barra superior clara para contexto e conteúdo organizado em faixas assimétricas: uma faixa hero de operação, uma faixa de KPIs compactos e um corpo com fila de pedidos e alertas laterais. No mobile, a sidebar vira navegação horizontal compacta.

### Elementos de assinatura

- Wordmark “J'AIME / OS” em caixa alta com separador diagonal.
- Cartão hero com grande número de pedidos e uma forma oval vermelha, ecoando a silhueta de um crepe sem usar ilustração decorativa.
- Etiquetas de status em pílulas retangulares, com pequenos códigos como `EM PREPARO` e `BAIXO ESTOQUE`.

### Interação e animação

Ações importantes têm resposta imediata com mudança de cor e microelevação. A lista de pedidos usa transições curtas de opacidade e deslocamento; evitar animações contínuas. Toasts confirmam ações de baixa de estoque e mudança de disponibilidade.

### Tipografia

Usar Arial/Helvetica como base segura: títulos com peso 800 e leve condensação via `letter-spacing: -0.05em`; texto de interface em fonte sem serifa neutra; rótulos de status em caixa alta e espaçamento positivo. A fonte proprietária da referência não está incluída, então não será presumida.

### Essência da marca

**J'aime Creperia: o sabor da marca e o pulso da operação em uma tela.** Personalidade: autoral, apetitoso, confiável.

### Voz

- Headline: “Seu próximo crepe começa aqui.”
- CTA: “Atualizar cardápio” / “Abrir novo pedido”.

### Wordmark

“J'AIME” em peso alto, com marca circular e “OS” separado por uma barra diagonal curta.

### Cor proprietária

Vermelho J'aime `#F23F46`, apoiado pelo azul `#002B54` e pelo creme `#FFF3E2`.


## Expansão operacional solicitada
O gestor agora organiza cinco áreas complementares: estoque com entradas e baixas; fichas de produção com rendimento, ingredientes, tempo e custo; logística com motoboys e regras de taxa; pagamentos com Pix, cartão, dinheiro na entrega e provedor online; e integrações com site, iFood, WhatsApp e marketplaces. O quadro interno normaliza todos os canais para a mesma fila da cozinha. O Stripe foi habilitado em sandbox; checkout real, webhooks idempotentes e persistência MySQL/Drizzle permanecem como a etapa de produção, porque credenciais e contratos de cada marketplace precisam ser conectados sem simular confirmação de pagamento.


## Persistência e pagamentos implementados
O banco agora possui tabelas aditivas para produtos, itens e movimentos de estoque, fichas, motoboys, taxas, pagamentos, integrações, pedidos, itens de pedido e eventos Stripe. A API tRPC expõe sincronização/edição do catálogo, leitura/criação de pedidos e criação de Checkout Session Stripe no servidor. O webhook `/api/stripe/webhook` preserva o corpo bruto, valida assinatura, deduplica `event_id` e marca o pedido como pago após `checkout.session.completed`. A confirmação financeira não depende do retorno do navegador.


## Cardápio original preservado
A loja pública foi reimplementada visualmente a partir do `cardapio.html` enviado: paleta creme/vermelho/azul, tipografia de impacto, padrão xadrez, categorias, cards com imagens originais, lista de bebidas e sacola lateral. O HTML deixou de ser apenas estático: os itens e preços continuam vindo do banco, produtos indisponíveis são ocultados e o checkout cria pedidos persistentes no mesmo fluxo do gestor.


## Fornecedores e compras
O gestor ganhou uma aba de abastecimento que usa os itens abaixo do mínimo para montar uma cotação. Fornecedores são cadastrados com WhatsApp; cada cotação gera um link público individual para o fornecedor preencher preços e disponibilidade. O gestor compara os totais respondidos, escolhe o menor valor e, ao receber a compra, lança a quantidade no estoque e registra o último custo do insumo. O envio atual usa links `wa.me` com mensagem pré-preenchida, sem depender de credenciais da API oficial do WhatsApp Business.
