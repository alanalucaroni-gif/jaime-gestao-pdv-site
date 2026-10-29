import fs from 'node:fs';
const edit = (p,fn)=>fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));
edit('client/src/data/menu.ts',s=>'import type { CustomCrepe } from "../../../shared/custom-crepe";\n'+s.replace('export type MenuProduct = {','export type MenuProduct = {\n  custom?: CustomCrepe;'));
edit('client/src/pages/Storefront.tsx',s=>{
 s='import DirectCheckout from "@/components/DirectCheckout";\nimport { builderIngredients } from "@shared/custom-crepe";\n'+s;
 const start=s.indexOf('  const createOrder ='); const end=s.indexOf('\n  useEffect', start); s=s.slice(0,start)+s.slice(end);
 const begin=s.indexOf('  const confirmOrder ='); const finish=s.indexOf('\n  return <div', begin); s=s.slice(0,begin)+s.slice(finish);
 const modalStart=s.indexOf('    {checkoutOpen &&'); const modalEnd=s.indexOf('\n    {completed',modalStart); s=s.slice(0,modalStart)+'    {checkoutOpen && <DirectCheckout cart={cart} onClose={() => setCheckoutOpen(false)} onOrdered={() => setCart([])} />}'+s.slice(modalEnd);
 s=s.replace('href="/">← Gestão','href="/">← Início');
 s=s.replace('Sacola {count ?', 'Sacola {count ?');
 s=s.replace('</button></header>', '</button><button className="checkout-secondary" onClick={() => setCheckoutOpen(true)}>Meu pedido</button></header>');
 const constants=s.indexOf('const builderIngredients ='); const constantsEnd=s.indexOf('\n\nfunction CustomBuilder',constants); s=s.slice(0,constants)+s.slice(constantsEnd);
 s=s.replace('price: unit, available: true, accent: "product-amber"', 'price: unit, available: true, accent: "product-amber", custom: { type, dough: massa, ingredients: chosen, note: obs.trim() }');
 return s;
});
edit('server/commerce-store.ts',s=>{
 s='import { builderIngredients, customPrice } from "../shared/custom-crepe";\n'+s;
 s=s.replace('productId: z.number().int().positive(), quantity:', 'productId: z.number().int().positive().optional(), custom: z.object({ type: z.enum(["salgado", "doce"]), dough: z.enum(["Tradicional", "Chocolate"]), ingredients: z.array(z.string()).min(1).max(6), note: z.string().max(1000) }).optional(), quantity:');
 s=s.replace('    const product = catalog.find', `    if (line.custom) {
      const custom = line.custom;
      if (line.productId || new Set(custom.ingredients).size !== custom.ingredients.length || custom.ingredients.some(item => !builderIngredients[custom.type].includes(item))) throw new Error('Ingredientes inválidos');
      return { productId: 0, name: 'Monte seu crepe (' + custom.type + ')', quantity: line.quantity, unitPrice: customPrice(custom).toFixed(2), observations: [custom.dough, custom.ingredients.join(', '), custom.note].filter(Boolean).join('; ') };
    }
    const product = catalog.find`);
 return s;
});
