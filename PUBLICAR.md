# J’aime — site, PDV e gestão

Um único projeto com três acessos: `/` e `/loja` (site e pedidos), `/pdv` (operação), `/gestao` (retaguarda).

## Executar
Node.js 24. Instale com pnpm usando o lockfile, copie `.env.example` para `.env` e configure as variáveis localmente. Execute `npm run dev` e acesse http://127.0.0.1:3000.

## Validar e publicar
`npm run check`, `npm run test`, `npm run build`. Em servidor Node persistente: `npm start`. Configure ADMIN_USER, ADMIN_PASSWORD e PUBLIC_URL em produção. O banco SQLite precisa de volume persistente e backups. GitHub armazena o código; GitHub Pages não executa este backend.

Não enviar `.env`, banco `data/`, logs, comprovantes nem dados de clientes. As chaves devem ficar nas variáveis do servidor. Configurações de tarifas e dados operacionais locais não acompanham o código.

Maps: Places API (New) e Routes API. Pagamento online e WhatsApp exigem as respectivas credenciais. O fluxo de caixa registra a saída do motoboy ao atribuir a entrega; vendas em dinheiro/Pix do PDV geram entrada. Cartão/repasse bancário necessita conciliação.
