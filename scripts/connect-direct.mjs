import fs from 'node:fs';
const edit = (p, fn) => fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8')));
edit('server/_core/index.ts', s => {
 s=s.replace('import "dotenv/config";', 'import "dotenv/config";\nimport { registerCommerce, adminAccess } from "../commerce";');
 const start=s.indexOf('  app.post("/api/stripe/webhook"'); const end=s.indexOf('  // Configure body parser',start); s=s.slice(0,start)+s.slice(end);
 s=s.replace('  registerOAuthRoutes(app);','  registerCommerce(app);\n  app.use("/gestao", adminAccess);\n  app.use("/api/trpc", (req, res, next) => {\n    const publicRoutes = new Set(["menu.list", "auth.me", "auth.logout", "purchasing.getQuote", "purchasing.submitQuote"]);\n    if (req.path.slice(1).split(",").every(route => publicRoutes.has(route))) return next();\n    const origin = req.header("origin");\n    const allowed = process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).origin : `http://${req.get("host")}`;\n    if (origin && origin !== allowed) return res.sendStatus(403);\n    return adminAccess(req, res, next);\n  });\n  registerOAuthRoutes(app);');
 return s;
});
edit('server/routers.ts', s=> {
 s='import { commerceDb, directMenu, directOrders, findOrder, saveOrder } from "./commerce-store";\n'+s;
 s=s.replace('list: publicProcedure.query(() => listProducts())', 'list: publicProcedure.query(() => directMenu().map(p => ({ ...p, price: p.price.toFixed(2), available: p.available ? 1 : 0 })))');
 s=s.replace('syncProducts(input.items)', `(() => { const db = commerceDb(); db.exec('BEGIN IMMEDIATE'); try { for (const item of input.items) { const old = directMenu().find(p => p.name === item.name); if (!old) throw new Error('Produto não cadastrado'); db.prepare('UPDATE direct_menu SET body=? WHERE id=?').run(JSON.stringify({ ...old, price: Number(item.price), available: item.available === 1 }), old.id); } db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return directMenu(); })()`);
 s=s.replace('list: publicProcedure.query(() => listOrders())', 'list: publicProcedure.query(() => directOrders().map(o => ({ ...o, source: "site", paymentMethod: o.paymentMethod === "offline" ? "Na entrega/retirada" : "Mercado Pago" })))');
 s=s.replace('updateOrderStatus(input.publicId, input.status)', `(() => { const order = findOrder(input.publicId); if (!order) throw new Error('Pedido não encontrado'); if (input.status !== 'cancelled' && order.paymentMethod === 'online' && order.paymentStatus !== 'paid') throw new Error('Aguarde a confirmação do pagamento'); order.status = input.status; saveOrder(order); return { publicId: order.publicId, status: order.status }; })()`);
 const start = s.indexOf('  payments: router({'); const end=s.indexOf('  purchasing: router({',start); s=s.slice(0,start)+s.slice(end);
 return s;
});
edit('client/src/App.tsx', s=>s.replace('<Route path={"/"} component={Home} />','<Route path={"/"} component={Storefront} />\n      <Route path={"/gestao"} component={Home} />\n      <Route path={"/menu"} component={Storefront} />'));
edit('client/src/pages/Home.tsx', s=>s.replace('useState(initialOrders)', 'useState<Order[]>([])').replace(' + 814.4, [orders]', ', [orders]').replace('observations: [order.customerNote,','observations: [`Telefone: ${order.phone}`, order.address, order.customerNote,').replace('ordersQuery.data.map(order =>', 'ordersQuery.data.filter(order => order.status !== "cancelled").map(order =>'));
