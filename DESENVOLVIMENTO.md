# J’aime — site e pedidos diretos

## Executar localmente
Node.js 22.13 ou superior (validado com Node 24). Instale com `pnpm install --frozen-lockfile` e execute `npm run dev`.

- Site: http://127.0.0.1:3000/
- Pedidos: http://127.0.0.1:3000/loja
- Gestão: http://127.0.0.1:3000/gestao

## Implementado e validado
O site original abre o cardápio próprio, sem links para Deeliv. Pedidos comuns e personalizados são calculados no servidor e salvos em SQLite, em `data/jaime.sqlite`. O painel recebe os pedidos e permite avançar o preparo; o cliente acompanha em “Meu pedido”. A sacola é preservada na sessão do navegador.

Pagamento na entrega/retirada funciona localmente. Pix/cartão usam o Payment Brick e SDK oficial Mercado Pago; ficam desabilitados enquanto faltarem as credenciais. Valores, moeda, referência e ambiente são verificados antes de marcar como pago. Há assinatura de webhook, chave de idempotência e atualização manual consultando o provedor.

Validação: TypeScript, 14 testes automatizados e build aprovados. Pelo navegador: pedido de retirada de R$49,99 salvo, recebido na gestão e atualizado para “Em preparação” na tela do cliente. Layout conferido em 390px sem rolagem horizontal. Não foram feitas cobranças reais nem testes conectados ao sandbox Mercado Pago.

## Configurar Mercado Pago
Copie `.env.example` para `.env`. Preencha no servidor `MP_PUBLIC_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` e `PUBLIC_URL` (origem HTTPS, sem caminho). Comece com `MP_MODE=test` e credenciais/usuários de teste.

Configure o webhook de pagamentos em `https://SEU-DOMINIO/api/direct/webhook`. Teste aprovação, rejeição, Pix pendente, confirmação, repetição de notificações e recuperação após interrupção. Somente depois configure as credenciais reais e `MP_MODE=production`.

Documentação oficial:
- https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/default-rendering
- https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks

## Publicação
Esta versão precisa de servidor Node persistente e disco persistente. GitHub guarda o código; hospedagem estática sozinha não executa o backend. `compose.yaml` prepara uma única instância com volume de dados. Configure HTTPS por proxy, `PUBLIC_URL`, `ADMIN_USER` e `ADMIN_PASSWORD` forte com pelo menos 16 caracteres. Em produção, `/gestao` e APIs administrativas exigem essas credenciais; o acesso sem senha existe somente em desenvolvimento local.

`DELIVERY_FEE_CENTS=500` mantém a taxa fixa de R$5 do protótipo. Confirme taxa, área atendida, preços e dados comerciais antes de abrir pedidos ao público. Faça backups do banco usando mecanismo SQLite consistente. Não execute múltiplas réplicas com este armazenamento.

## Limites atuais
- Pix/cartão estão implementados, mas aguardam configuração e teste real em sandbox.
- Estoque, financeiro, motoboys, integrações e pedido manual de balcão ainda possuem funções demonstrativas. Fornecedores dependem do banco MySQL legado.
- Pagamento rejeitado não tem nova tentativa com outro cartão no mesmo pedido; precisa de tratamento adicional antes de operação comercial completa.
- Horários de funcionamento, área de entrega e pausa da loja ainda precisam ser ligados às regras do servidor.
- Mudanças estão nesta pasta local. Não foram publicadas nem enviadas ao repositório GitHub.

## Módulos adaptados do Imperial Parma — 25/10/2026
Referência: https://github.com/alanalucaroni-gif/imperialparma (cadastro de fornecedores, compras e logística).

Fornecedores, cotações, entregadores, tarifas e atribuições agora persistem na tabela erp_records do SQLite data/jaime.sqlite. A aplicação não depende de MySQL para esses módulos. Registros antigos eventualmente existentes no MySQL não são migrados automaticamente.

Fornecedores: cadastro/edição com contatos e dados comerciais. Cotações: histórico, quantidade × preço, formulário público isolado com validade de sete dias, bloqueio após envio, consulta por item, escolha de proposta completa e registro idempotente de recebimento. Ainda não há divisão por fornecedor por item, PDF, anexos, renovação de link nem entrada real no estoque. Os insumos sugeridos continuam demonstrativos. Links localhost não são utilizáveis pelos fornecedores em outros computadores; publicar com domínio HTTPS antes do uso externo.

Logística: entregadores ativos/inativos, empresa, telefone, atribuição de pedido de entrega e custo combinado, registro de conclusão. O status logístico é separado do status do pedido no PDV. Não há rastreamento GPS ou pagamento automático de entregadores.

Google Routes: definir GOOGLE_MAPS_API_KEY apenas no servidor, habilitar Routes API na conta Google e salvar origem/valor por km/custo mínimo em Motoboys e taxas > Rotas e tarifas. Calcula trajeto DRIVE (carro) e estimativa do custo do entregador, sem alterar a taxa do cardápio. Nenhuma chamada real feita durante a implementação; testes usam resposta simulada. Documentação: https://developers.google.com/maps/documentation/routes/compute_route_directions

Validação: TypeScript, build de produção, 20 testes automatizados e navegação desktop/móvel. Manter backup do diretório data.

## Atualização de compras — 26/10/2026
Implementada a escolha por item, com sugestão dos menores preços disponíveis. A finalização exige todos os itens atendidos e grava pedidos separados por fornecedor dentro da cotação, com quantidades, preços e totais preservados. O recebimento é individual e idempotente; a cotação só fica recebida quando todos os pedidos forem recebidos. Isso substitui a limitação anterior de escolha exclusiva de um fornecedor. Frete não é calculado automaticamente. Estoque, PDFs, anexos e rastreamento GPS continuam pendentes.

## Compras e estoque — 26/10/2026
Estoque real na tabela erp_records: ingredientes identificados no cardápio, massas, insumos básicos e bebidas, todos com saldo inicial zero. Novos insumos podem ser cadastrados. As fichas por produto devem ser preenchidas pelo responsável, com consumo em kg/un/L por unidade vendida; não foram inventadas quantidades.

As cotações convertem kg/g/L/ml e embalagens com conteúdo informado para a unidade de estoque. Valores são comparados na unidade base. A compra considera quantidade exata, não arredonda para pacotes inteiros; condições e frete ficam nas observações. Prazo de entrega, forma e prazo de pagamento acompanham a proposta e o PDF.

Receber pedido vinculado a insumos gera entrada atômica e idempotente. Cotações antigas sem vínculo precisam ser recriadas. A baixa da venda ocorre ao avançar para produção/pronto/concluído no PDV, uma vez por pedido, dentro de transação. Ficha ausente ou saldo insuficiente bloqueia a etapa. Venda de balcão também deve avançar no quadro de pedidos. Crepes personalizados ainda precisam de suporte à composição dinâmica e ficam bloqueados por ficha ausente. Cancelamento após produção não repõe ingredientes automaticamente; perdas/devoluções exigem ajuste justificado.

PDF de compra é gerado por pedido em /api/purchases/pdf/:token, com token privado aleatório. O envio é disparado ao finalizar seleção. Requer PUBLIC_URL HTTPS e WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_GRAPH_VERSION, WHATSAPP_PURCHASE_TEMPLATE. Template aprovado pt_BR, cabeçalho DOCUMENT, corpo fixo sem parâmetros. Credenciais nunca vão ao navegador. Ausência de configuração é exibida; resposta OK do provedor significa aceitação, não comprovação de entrega. Timeout fica incerto e não é repetido automaticamente para evitar duplicatas. Nenhuma mensagem real foi enviada nos testes.

Testes: 23 aprovados, TypeScript e build. PDF exemplo renderizado e inspecionado. UI estoque/fichas conferida. WhatsApp real pendente de credenciais, template aprovado e publicação.

## Retaguarda — produção, contagem e financeiro

Detalhes de observação, decisões de implementação e pendências em `docs/retaguarda-sischef.md`.

- **Produção de lotes**: cadastre receitas que transformam ingredientes em um insumo preparado; prévia de consumo, perdas e registro atômico com histórico. Use o insumo preparado na composição da venda para evitar baixar matéria-prima novamente.
- **Estoque > Contagem de estoque por CSV**: exporte, preencha contagem, confira e aplique. Saldo alterado depois da exportação bloqueia a importação; nova contagem é necessária.
- **A pagar e receber**: títulos manuais com parcelas mensais, baixas parciais, juros/descontos, estorno e vínculo com o fluxo de caixa. Não movimenta dinheiro em bancos, nem gera títulos automáticos para compras/vendas.

O arquivo original `client/src/data/menu.ts` não estava versionado. `shared/catalog.ts` passa a ser o contrato; o seed é vazio até recuperar o original ou cadastrar produtos. Dados de produtos existentes no SQLite são preservados. Fixtures de teste nunca populam o banco de produção. A regra `.gitignore` agora ignora somente `/data/`, sem ocultar código em subpastas.

Validação: 42 testes, TypeScript e build aprovados. Revisão visual das novas telas ainda pendente. Emissão fiscal, integração bancária, DRE/DFC, XML de entrada e paridade completa com o Sischef não fazem parte desta alteração.
