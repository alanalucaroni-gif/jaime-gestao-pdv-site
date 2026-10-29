import fs from 'node:fs';
const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('pnpm-workspace.yaml',s=>s.replaceAll('set this to true or false','true'));
edit('server/commerce.ts',s=>s.replace("if (req.query.refresh === '1' && order.paymentId && onlineEnabled()) {\n      try { applyPayment(order, await provider().get({ id: order.paymentId })); }", "if (req.query.refresh === '1' && order.paymentFingerprint && onlineEnabled()) {\n      try {\n        let paymentId = order.paymentId;\n        if (!paymentId) { const found = await provider().search({ options: { external_reference: order.publicId } }); paymentId = found.results?.[0]?.id; }\n        if (paymentId) applyPayment(order, await provider().get({ id: paymentId }));\n      }"));
// Only advertise server-backed catalog writes as successful after acknowledgement.
edit('client/src/pages/Home.tsx',s=>s.replace('toast.success("Novo pedido adicionado à fila");','toast.info("Pedido de balcão demonstrativo. Para registrar um pedido real, use o cardápio do site.");').replace('quarta-feira, 21 de outubro','{new Date().toLocaleDateString("pt-BR", {weekday:"long",day:"numeric",month:"long"})}'));
