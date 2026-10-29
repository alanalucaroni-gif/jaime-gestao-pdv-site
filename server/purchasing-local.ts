import {stockList,moveStock} from "./inventory";
import {quotedPrice} from "../shared/quote-units";
import { commerceDb } from './commerce-store';
import crypto from 'node:crypto';
import { z } from 'zod';
import { records,put,nextId } from "./erp-store";
export { records,put,nextId } from "./erp-store";
export const supplierSchema=z.object({id:z.number().int().positive().optional(), name:z.string().trim().min(2).max(160),whatsapp:z.string().regex(/^(?:55)?\d{10,11}$/),cnpj:z.string().max(20).default(''),email:z.union([z.literal(''),z.string().email()]).default(''),contact:z.string().max(160).default(''),category:z.string().max(100).default(''),address:z.string().max(500).default(''),paymentTerms:z.string().max(300).default(''),notes:z.string().max(2000).default(''),active:z.boolean().default(true)});
export type Supplier=z.infer<typeof supplierSchema>&{id:number};
export const listSuppliers=()=>records<Supplier>('suppliers');
export function createSupplier(raw:unknown) { const input=supplierSchema.parse(raw); if(input.id&&!listSuppliers().some(s=>s.id===input.id))throw new Error('Fornecedor não encontrado'); return put('suppliers',{...input,id:input.id??nextId('suppliers')}); }
type Item={stockItemId?:number;id:number;itemName:string;quantity:string;unit:string};
type Quote={deliveryDays?:number;paymentMethod?:string;paymentDays?:number;id:number;supplierId:number;token:string;status:string;total:string;notes?:string;items:{purchaseItemId:number;unitPrice:string;available:number;quotedUnitPrice?:string;priceUnit?:string;content?:number}[]};
export type PurchaseOrder={deliveryDays?:number;paymentMethod?:string;paymentDays?:number;pdfToken?:string;deliveryStatus?:string;deliveryError?:string;id:string;supplierId:number;status:"ordered"|"received";receivedAt?:string;total:string;items:(Item&{unitPrice:string;total:string})[]};
export type Purchase={purchaseOrders?:PurchaseOrder[];id:number;publicId:string;status:string;notes?:string;createdAt:string;expiresAt:string;items:Item[];quotes:Quote[]};
export const listRequests=()=>records<Purchase>('purchases');
export const getPurchaseRequest=(publicId:string)=>listRequests().find(r=>r.publicId===publicId);
export function createPurchaseRequest(raw:unknown) { const input=z.object({items:z.array(z.object({stockItemId:z.number().int().positive().optional(),itemName:z.string().trim().min(1).max(160),quantity:z.string().refine(v=>Number.isFinite(Number(v))&&Number(v)>0&&Number(v)<=100000),unit:z.string().min(1).max(20)})).min(1).max(100),supplierIds:z.array(z.number().int().positive()).min(1).max(100),notes:z.string().max(2000).optional()}).parse(raw); const ids=[...new Set(input.supplierIds)]; if(ids.some(id=>!listSuppliers().some(s=>s.id===id&&s.active)))throw new Error('Selecione fornecedores ativos'); for(const item of input.items){if(item.stockItemId){const stock=stockList().find(s=>s.id===item.stockItemId);if(!stock||stock.unit!==item.unit)throw new Error('Insumo ou unidade inválidos');item.itemName=stock.name;}}
 const id=nextId('purchases');return put<Purchase>('purchases',{id,publicId:`PC-${crypto.randomUUID().slice(0,8).toUpperCase()}`,status:'sent',notes:input.notes,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+7*86400000).toISOString(),items:input.items.map((i,n)=>({...i,id:n+1})),quotes:ids.map((supplierId,n)=>({id:id*1000+n+1,supplierId,token:crypto.randomBytes(32).toString('hex'),status:'sent',total:'0.00',items:[]}))}); }
function byToken(token:string){const request=listRequests().find(r=>r.quotes.some(q=>q.token===token));const quote=request?.quotes.find(q=>q.token===token);if(!request||!quote||Date.parse(request.expiresAt)<Date.now())throw new Error('Link inválido ou expirado. Solicite uma nova cotação.');return {request,quote};}
export function getSupplierQuote(token:string){const {request,quote}=byToken(token);const supplier=listSuppliers().find(s=>s.id===quote.supplierId);return {request:{publicId:request.publicId,notes:request.notes,expiresAt:request.expiresAt,status:request.status},quote:{status:quote.status},items:request.items,supplier:{name:supplier?.name??'Fornecedor'}};}
export function submitSupplierQuote(input:{token:string;items:{purchaseItemId:number;unitPrice:string;available:number;priceUnit?:string;content?:number}[];notes?:string;deliveryDays?:number;paymentMethod?:string;paymentDays?:number}) {
 const {request,quote}=byToken(input.token);if(quote.status!=='sent'||request.status!=='sent')throw new Error('Proposta já enviada ou cotação encerrada');
 if(input.items.length!==request.items.length||new Set(input.items.map(i=>i.purchaseItemId)).size!==input.items.length)throw new Error('Confira todos os itens');
 let cents=0;const lines:Quote['items']=[];
 for(const i of input.items){const item=request.items.find(p=>p.id===i.purchaseItemId);if(!item||!/^\d+(\.\d{1,2})?$/.test(i.unitPrice)||(i.available!==0&&i.available!==1))throw new Error('Preço ou item inválido');
 if(!i.available){lines.push({...i,unitPrice:'0'});continue;}
 const result=quotedPrice(Number(i.unitPrice),i.priceUnit??item.unit,item.unit,i.content);cents+=Math.round(result.normalized*100*Number(item.quantity));
 lines.push({...i,quotedUnitPrice:i.unitPrice,priceUnit:i.priceUnit??item.unit,content:result.factor,unitPrice:String(result.normalized)});
 }
 quote.items=lines;quote.total=(cents/100).toFixed(2);quote.notes=input.notes;quote.deliveryDays=input.deliveryDays;quote.paymentMethod=input.paymentMethod;quote.paymentDays=input.paymentDays;quote.status='responded';put('purchases',request);return {success:true};
}
export function awardSupplierQuote(quoteId:number){const request=listRequests().find(r=>r.quotes.some(q=>q.id===quoteId));const quote=request?.quotes.find(q=>q.id===quoteId);if(!request||!quote||request.status!=='sent'||quote.status!=='responded')throw new Error('Proposta indisponível');if(quote.items.some(i=>!i.available))throw new Error('Esta proposta não atende todos os itens. Crie uma cotação separada para os itens disponíveis.');quote.status='awarded';request.status='awarded';return put('purchases',request);}
export function receivePurchase(id:number){const request=listRequests().find(r=>r.id===id);if(!request||!['awarded','received'].includes(request.status))throw new Error('Escolha uma proposta primeiro');if(request.purchaseOrders)throw new Error('Registre o recebimento de cada pedido de compra');request.status='received';return put('purchases',request);}
export const awardItemsSchema=z.object({requestId:z.number().int().positive(), selections:z.array(z.object({itemId:z.number().int().positive(),quoteId:z.number().int().positive()})).min(1).max(100)});
export function awardPurchaseItems(raw:unknown){
 const input=awardItemsSchema.parse(raw),request=listRequests().find(r=>r.id===input.requestId);
 if(!request||request.status!=='sent')throw new Error('Cotação já encerrada ou não encontrada');
 if(input.selections.length!==request.items.length||new Set(input.selections.map(s=>s.itemId)).size!==request.items.length)throw new Error('Escolha um fornecedor para cada item');
 const orders:PurchaseOrder[]=[];
 for(const selection of input.selections){
  const item=request.items.find(i=>i.id===selection.itemId),quote=request.quotes.find(q=>q.id===selection.quoteId&&q.status==='responded');
  const price=quote?.items.find(i=>i.purchaseItemId===selection.itemId&&i.available===1);
  if(!item||!quote||!price)throw new Error('O fornecedor não disponibilizou este item');
  let order=orders.find(o=>o.supplierId===quote.supplierId);
  if(!order){order={id:`${request.publicId}-${quote.supplierId}`,supplierId:quote.supplierId,status:'ordered',total:'0.00',items:[],deliveryDays:quote.deliveryDays,paymentMethod:quote.paymentMethod,paymentDays:quote.paymentDays,pdfToken:crypto.randomBytes(32).toString('hex'),deliveryStatus:'pending'};orders.push(order);}
  const total=(Math.round(Number(item.quantity)*Number(price.unitPrice)*100)/100).toFixed(2);
  order.items.push({...item,unitPrice:price.unitPrice,total});
  order.total=(order.items.reduce((sum,i)=>sum+Math.round(Number(i.total)*100),0)/100).toFixed(2);
 }
 request.purchaseOrders=orders;request.status='awarded';
 for(const quote of request.quotes)if(input.selections.some(s=>s.quoteId===quote.id))quote.status='awarded';
 return put('purchases',request);
}
export function receivePurchaseOrder(requestId:number,orderId:string){
 const db=commerceDb();db.exec('BEGIN IMMEDIATE');try{
 const request=listRequests().find(r=>r.id===requestId),order=request?.purchaseOrders?.find(o=>o.id===orderId);
 if(!request||!order||!['awarded','received'].includes(request.status))throw new Error('Pedido de compra não encontrado');
 if(order.status==='received'){db.exec('COMMIT');return request;}
 for(const item of order.items){if(!item.stockItemId)throw new Error('Cotação antiga sem vínculo de estoque. Crie uma nova cotação com os insumos cadastrados.');moveStock(item.stockItemId,Number(item.quantity),'Recebimento de compra',order.id);}
 order.status='received';order.receivedAt=new Date().toISOString();
 if(request.purchaseOrders!.every(o=>o.status==='received'))request.status='received';put('purchases',request);db.exec('COMMIT');return request;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
