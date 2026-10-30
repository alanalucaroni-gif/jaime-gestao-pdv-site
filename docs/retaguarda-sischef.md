# Retaguarda: observação, implementação e pendências

## Origem e limite da análise

Referência observada em 29/10/2026: sessão autenticada fornecida pela responsável, em `sistema.sischef.com`. A inspeção usou a interface do navegador, sem salvar registros, emitir documentos, alterar saldos ou testar pagamentos reais. Não foram recuperados código privado, banco, contratos de API ou regras internas do Sischef. Nenhum dado pessoal de clientes, credencial ou token da sessão foi incorporado ao projeto.

Código inicial do Jaime: commit `044afa8b1208b94b6a6f9e826f38f7625e5355a0`. Arquivos consultados: `server/inventory.ts`, `server/purchasing-local.ts`, `server/cash.ts`, `server/cash-ledger.ts`, `server/commerce-store.ts`, `server/routers.ts`, componentes e documentação de desenvolvimento.

REA 6.8.0 foi compilado a partir do ZIP fornecido. Foi executado `analyze-javascript-application` sobre uma cópia da base, com seleção explícita dos quatro arquivos `server/inventory.ts`, `server/purchasing-local.ts`, `server/cash-ledger.ts` e `server/routers.ts`, limite de 30 segundos por fonte e entrega resumida. O inventário iniciou, mas a análise parou com `capability_unavailable`, provedor `process-ownership`: `ps -axo pid=,ppid=,pgid=,uid=,stat=,command=` retornou `fatal library error, lookup self`. Portanto, não há conclusão semântica válida atribuída ao REA. As conclusões sobre funcionamento do Jaime abaixo derivam da leitura do código e dos testes; as do Sischef derivam da interface observada. Nenhuma captura REA da sessão autenticada foi realizada.

## Matriz de cobertura

| Área | Evidência da referência | Situação do Jaime |
| --- | --- | --- |
| Menu administrativo | Cadastros, produtos/taxas, produção, financeiro, caixa, pedidos, fiscal, estoque, relatórios, configurações | Navegação existente ampliada com Produção de lotes e A pagar e receber |
| Produtos simples | Lista com grupo, unidade, código de barras, compra, venda e estoque; cadastro com abas principal, complementar, fiscal, composição e estoque | Cadastro de produtos, SKU, código de barras, preço e disponibilidade já existia. Grupos livres, unidade comercial e tributação completa continuam pendentes |
| Produtos com passos | Listagem de pizzas/combos com número de passos | Montador próprio já existente; reprodução dos limites, regras de preço e combinações do Sischef ainda pendente |
| Taxas | Listagem separada de entrega, serviço e gorjeta | Tarifas logísticas existentes; serviço e gorjeta pendentes |
| Composição de venda | Ingredientes, quantidades, valores e fator de perda; opções de baixa na venda ou produção | Ficha por produto com rendimento e baixa idempotente já existia. Mantida como Composição de venda; seleção de gatilho por produto e perdas nesta ficha continuam pendentes |
| Produção | Receitas, extrato de insumos, produções realizadas; ações de produzir e imprimir visíveis | Novo cadastro de receitas de transformação e registro de lote, consumindo matérias-primas e dando entrada no insumo produzido. Impressão e etiquetas pendentes |
| Estoque | Contagem/acerto, entrada/saída, alertas e importação/exportação CSV; XML aparece no menu | Movimentos e mínimos já existiam. Nova contagem CSV com prévia e proteção contra saldo desatualizado. Entrada por XML, custo médio e locais pendentes |
| Financeiro | Formulário A pagar com pessoa, categoria, datas, parcelas, documento, juros e desconto. Extratos, conciliação, DRE/DFC aparecem no menu | Novo título a pagar/receber, parcelas mensais, baixas parciais, juros/descontos, contrapartida no caixa, estorno e cancelamento auditável. Conciliação, recorrência, anexos, DRE/DFC e múltiplas contas pendentes |
| Caixa | Conferência e turnos aparecem no menu | Fluxo de caixa já existente recebe novas baixas/estornos. Turnos e conferência formal pendentes |
| Compras | Pedido de compra/devoluções no menu | Fornecedores, cotações e recebimentos reais de estoque já existiam. Não geram títulos financeiros automaticamente nesta versão |
| Fiscal | Painel consultado: status, datas, série, modelo, numeração, certificado, ambiente, exportação de XML e relatórios | Nenhuma emissão fiscal implementada nesta alteração. Exige provedor/SEFAZ, certificado, parâmetros fiscais e validação em homologação. Comprovante de venda continua sem valor fiscal |
| Relatórios | Categorias Gestão, Financeiros, Fiscais, Vendas, Compras, Estoques e Cadastros | Históricos operacionais dos novos módulos; paridade de relatórios gerenciais pendente |
| Integrações | Link Integrações e API no menu | Não foram implementadas novas integrações externas nem copiados contratos desconhecidos |

Itens apenas vistos no menu não foram testados. A presença de uma opção não estabelece suas regras, permissões ou efeitos.

## Decisões da implementação — não atribuídas ao Sischef

### Produção de lotes

- Receita de transformação tem nome, insumo de saída, rendimento total, ingredientes, consumo líquido, perda e modo de preparo. É separada da ficha da venda, que continua vinculada ao produto do cardápio.
- Consumo bruto = consumo líquido × quantidade produzida ÷ rendimento ÷ (1 − perda/100). Quantidades são arredondadas para seis casas na unidade base kg/un/L.
- O responsável define quantidades e perdas reais; não foram inventadas receitas.
- Ingrediente repetido, insumo inexistente, saída consumindo a si própria e receita pausada são rejeitados.
- Prévia informa necessidade e disponibilidade; a confirmação recalcula sob transação. Falta de um ingrediente bloqueia o lote inteiro. Entrada, saídas e lote são atômicos.
- UUID evita produção duplicada no reenvio. Mesma chave com outro conteúdo é recusada. O histórico guarda a versão da receita e os consumos usados no lote, inclusive após edição da receita.
- Para não baixar matéria-prima duas vezes, a ficha da venda deve consumir o insumo preparado quando há pré-produção. Não há conversão automática de fichas antigas, produção recursiva nem estorno automático de lotes.

### Contagem CSV

- Modelo UTF-8 com BOM e separador `;`: `id;nome;unidade;saldo_base;contagem`.
- Preencher somente `contagem`; linhas vazias são ignoradas. Decimais usam vírgula ou ponto, sem milhar, até seis casas e máximo 100.000 por campo.
- ID e unidade identificam o cadastro. O nome não substitui a identidade. Parser suporta aspas duplas, delimitadores e quebras de linha dentro de campos.
- Prévia não movimenta saldos. Confirmação exige motivo e verifica novamente o saldo base. Uma movimentação entre exportar e aplicar exige nova exportação e contagem.
- Cabeçalho incorreto, duplicação, unidade divergente, quantidade inválida ou saldo obsoleto impedem a aplicação integral. O reenvio da mesma confirmação retorna a contagem já aplicada.

### Financeiro

- Títulos manuais a pagar/receber têm descrição, pessoa, categoria, documento, data e observações. Pessoa/categoria são textos neste incremento; não substituem cadastro relacional completo.
- Total em centavos, dividido em 1–60 parcelas mensais. Restos de centavos ficam nas primeiras parcelas. Dia 31 é limitado ao último dia de cada mês, retomando o dia original nos meses seguintes.
- Criar título não movimenta caixa. Baixar confirma manualmente pagamento/recebimento e movimenta o caixa pelo principal + juros − desconto. Não faz transferência bancária, conciliação ou cobrança externa.
- Saldo é reduzido pelo principal da baixa; por exemplo, principal 100 com desconto 5 quita 100 e movimenta 95. Baixas parciais não podem exceder o saldo.
- Reenvio não duplica título, baixa ou caixa. Uma chave reutilizada com valores diferentes é rejeitada.
- Estorno mantém o registro, lança a contrapartida no caixa e reabre o saldo. Cancelamento exige motivo e ausência de baixas ativas.
- Compras/vendas e recebimentos de PDV continuam com seus próprios vínculos. Não cadastrar novamente como título algo já recebido no Fluxo de caixa, para evitar duplicidade operacional. A criação automática e a conciliação entre essas origens ficam para uma próxima etapa.

## Correção de origem do catálogo ausente

O commit inicial importa `client/src/data/menu.ts`, mas o arquivo não está no Git. A regra genérica `data/` ignora diretórios com esse nome em qualquer nível. A base falhava em `pnpm check` por módulo ausente.

O tipo e o seed passam a pertencer a `shared/catalog.ts`. A regra de dados privados foi restringida a `/data/`. Como o cardápio original não estava disponível, o seed é explicitamente vazio; não foram reconstruídos nomes, IDs ou preços por suposição. Produtos existentes em SQLite não são removidos ou substituídos. Instalação nova exige cadastro do menu verificado ou restauração do seed original com seus IDs. A loja informa cardápio em atualização enquanto não há itens.

Os produtos e preços usados nos testes são fixtures explícitas em `server/test-catalog.ts`, sem execução no servidor de produção. A ausência do original impede atestar fidelidade do cardápio inicial ou recuperar composições comerciais anteriores.

## Validação e limites

Executados: `pnpm check`, `pnpm test` (42 testes em 6 arquivos) e `pnpm build`. Os testes novos chamam as procedures tRPC reais contra SQLite temporário e verificam parcelas, centavos, datas, baixa parcial, repetição, excesso, estorno, cancelamento, produção com perda, insuficiência, snapshots e contagem CSV. Os testes existentes de compras, vendas, estoque, logística e pagamento continuam passando.

A tentativa de conexão ao navegador para revisão visual não respondeu. Portanto, não há alegação de validação visual ou teste de ponta a ponta destas novas telas. Build bem-sucedido não substitui esse teste. Nenhum teste real de SEFAZ, Mercado Pago, banco, WhatsApp ou entrega foi executado nesta alteração.

As rotas novas usam a proteção administrativa existente de `/api/trpc`; não foram adicionadas a rotas públicas. Dados permanecem no SQLite local e exigem a mesma política de backup e instância única. Não há migração destrutiva nem dependência de banco externo.

Esta entrega amplia três fluxos da retaguarda; não é uma reprodução completa do Sischef. A matriz acima orienta os próximos incrementos e explicita o que precisa de observação, código ou integração externa.
