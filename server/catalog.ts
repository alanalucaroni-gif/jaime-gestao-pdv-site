import { writeCash, cashRows } from './cash';
import { z } from 'zod';
import crypto from 'node:crypto';
import { commerceDb, directMenu, newOrder, saveOrder } from './commerce-store';
export const productSchema = z.object({
 id:z.number().int().positive().optional(), name:z.string().trim().min(2).max(160), description:z.string().trim().max(2000),
 category:z.enum(['Salgado','Vegetariano','Doce','Bebida']), price:z.number().finite().positive().max(99999).refine(n=>Math.abs(n*100-Math.round(n*100))<0.000001),
 available:z.boolean(), sku:z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/), barcode:z.string().trim().max(50).regex(/^[0-9]*$/),
 image:z.string().max(2800000).refine(s=>s==='' || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s) || /^\/menu-images\/[a-z0-9-]+\.webp$/.test(s)),
});
export function saveProduct(raw:unknown) {
 const input=productSchema.parse(raw); const all=directMenu();
 if(input.id && !all.some(p=>p.id===input.id)) throw new Error('Produto não encontrado');
 if(all.some(p=>p.id!==input.id && (p.sku?.toLowerCase()===input.sku.toLowerCase() || (input.barcode && p.barcode===input.barcode)))) throw new Error('Código SKU ou código de barras já cadastrado');
 const id=input.id ?? Math.max(0,...all.map(p=>p.id))+1;
 const product={...all.find(p=>p.id===id),...input,id,accent:'product-cream',updatedAt:new Date().toISOString()};
 commerceDb().prepare('INSERT INTO direct_menu (id,body) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(id,JSON.stringify(product)); return product;
}
const saleSchema=z.object({requestId:z.string().uuid(),customerName:z.string().trim().min(2).max(160),phone:z.string().regex(/^\d{10,13}$/).optional(),note:z.string().max(1000).default(''),method:z.enum(['cash','card','pix','pending']),received:z.number().finite().nonnegative().optional(),items:z.array(z.object({productId:z.number().int().positive(),quantity:z.number().int().min(1).max(20)})).min(1).max(40)});
export function createSale(raw:unknown){
 const input=saleSchema.parse(raw);
 const previous=commerceDb().prepare('SELECT body FROM direct_orders WHERE request_id=?').get(input.requestId);
 if(previous) return JSON.parse(String(previous.body));
 const menu=directMenu(); let cents=0;
 for(const item of input.items){const p=menu.find(p=>p.id===item.productId&&p.available);if(!p)throw new Error('Produto indisponível');cents+=Math.round(p.price*100)*item.quantity;}
 if(input.method==='cash' && Math.round((input.received??0)*100)<cents)throw new Error('Valor recebido menor que o total');
 cashRows();const db=commerceDb();db.exec('BEGIN IMMEDIATE');try {
 const order=newOrder({requestId:input.requestId,customerName:input.customerName,phone:input.phone||'0000000000',customerNote:input.note,deliveryType:'pickup',paymentMethod:'offline',items:input.items});
 order.source='balcao'; order.counterPayment=input.method;order.phone=input.phone||'';order.paymentStatus=input.method==='pending'?'cash_on_delivery':'paid';
 order.cashReceived=input.method==='cash'?input.received:undefined;order.change=input.method==='cash'?((Math.round(input.received!*100)-cents)/100):undefined;
 saveOrder(order);if(input.method==='cash'||input.method==='pix')writeCash('order:'+order.publicId,'in',Number(order.total),'Venda PDV: '+order.customerName,input.method);db.exec('COMMIT');return order;
 }catch(error){db.exec('ROLLBACK');throw error;}
}
