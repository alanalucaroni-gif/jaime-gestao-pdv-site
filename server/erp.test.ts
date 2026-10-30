import { seedTestCatalog } from './test-catalog';
import {stockList,saveRecipe,adjustStock,changeOrderStatus,movements} from "./inventory";
import {newOrder} from "./commerce-store";
import crypto from "node:crypto";
import {quotedPrice} from "../shared/quote-units";
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { commerceDb } from './commerce-store';
import {createSupplier,listSuppliers,createPurchaseRequest,getPurchaseRequest,getSupplierQuote,submitSupplierQuote,awardSupplierQuote,receivePurchase} from './purchasing-local';
import {calculateRoute,saveLogisticsConfig,saveDriver,drivers} from './logistics';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jaime-erp-'));
beforeAll(()=>{process.env.COMMERCE_DB_PATH=path.join(dir,'erp.sqlite');seedTestCatalog()});
afterAll(()=>{commerceDb().close();fs.rmSync(dir,{recursive:true,force:true});delete process.env.COMMERCE_DB_PATH;delete process.env.GOOGLE_MAPS_API_KEY;vi.unstubAllGlobals()});
it('persiste fornecedor e edição sem criar duplicado',()=>{const s=createSupplier({name:'Fornecedor teste',whatsapp:'35999999999',category:'Laticínios'});createSupplier({...s,contact:'Ana'});expect(listSuppliers()).toHaveLength(1);expect(listSuppliers()[0].contact).toBe('Ana');});
it('isola formulário público, calcula quantidade e bloqueia reenvio',()=>{const r=createPurchaseRequest({supplierIds:[listSuppliers()[0].id],items:[{itemName:'Queijo',quantity:'3',unit:'kg'}]});const token=r.quotes[0].token;expect(getSupplierQuote(token)).not.toHaveProperty('request.quotes');expect(()=>submitSupplierQuote({token,items:[{purchaseItemId:999,unitPrice:'10',available:1}]})).toThrow();submitSupplierQuote({token,items:[{purchaseItemId:1,unitPrice:'12.50',available:1}]});expect(getPurchaseRequest(r.publicId)?.quotes[0].total).toBe('37.50');expect(()=>submitSupplierQuote({token,items:[]})).toThrow();awardSupplierQuote(r.quotes[0].id);expect(receivePurchase(r.id).status).toBe('received');expect(receivePurchase(r.id).status).toBe('received');});
it('não escolhe proposta incompleta como compra completa',()=>{const r=createPurchaseRequest({supplierIds:[listSuppliers()[0].id],items:[{itemName:'Farinha',quantity:'2',unit:'kg'}]});submitSupplierQuote({token:r.quotes[0].token,items:[{purchaseItemId:1,unitPrice:'0',available:0}]});expect(()=>awardSupplierQuote(r.quotes[0].id)).toThrow('não atende');});
it('salva entregador e tarifa e exige chave de Maps',async()=>{saveDriver({name:'Moto teste',phone:'35999999999',company:'Particular',active:true});expect(drivers()).toHaveLength(1);saveLogisticsConfig({origin:'Rua origem, 100',perKm:2,minimum:5});delete process.env.GOOGLE_MAPS_API_KEY;await expect(calculateRoute('Rua destino, 200')).rejects.toThrow('Configure');process.env.GOOGLE_MAPS_API_KEY='test-key';vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({routes:[{distanceMeters:3500,duration:'600s'}]})}));expect(await calculateRoute('Rua destino, 200')).toEqual({km:3.5,minutes:10,estimatedCost:7});});
import {awardPurchaseItems,receivePurchaseOrder} from './purchasing-local';
it('divide compra por fornecedor e recebe cada pedido sem duplicar',()=>{
 const a=createSupplier({name:'Fornecedor A',whatsapp:'35999999998'}),b=createSupplier({name:'Fornecedor B',whatsapp:'35999999997'});
 const r=createPurchaseRequest({supplierIds:[a.id,b.id],items:[{stockItemId:stockList().find(i=>i.name==='Farinha de trigo')!.id,itemName:'Farinha',quantity:'2',unit:'kg'},{stockItemId:stockList().find(i=>i.name==='Muçarela')!.id,itemName:'Queijo',quantity:'3',unit:'kg'}]});
 for(const [n,q] of r.quotes.entries())submitSupplierQuote({token:q.token,items:[{purchaseItemId:1,unitPrice:n?'8':'5',available:1},{purchaseItemId:2,unitPrice:n?'10':'15',available:1}]});
 const selections=[{itemId:1,quoteId:r.quotes[0].id},{itemId:2,quoteId:r.quotes[1].id}];
 expect(()=>awardPurchaseItems({requestId:r.id,selections:[selections[0],selections[0]]})).toThrow();
 const result=awardPurchaseItems({requestId:r.id,selections});expect(result.purchaseOrders?.map(o=>o.total)).toEqual(['10.00','30.00']);
 expect(()=>awardPurchaseItems({requestId:r.id,selections})).toThrow();
 const first=receivePurchaseOrder(r.id,result.purchaseOrders![0].id);expect(first.status).toBe('awarded');const date=first.purchaseOrders![0].receivedAt;
 expect(receivePurchaseOrder(r.id,result.purchaseOrders![0].id).purchaseOrders![0].receivedAt).toBe(date);
 expect(receivePurchaseOrder(r.id,result.purchaseOrders![1].id).status).toBe('received');
});

it('converte embalagem e gramas para preço por kg',()=>{expect(quotedPrice(40,'pacote','kg',2).normalized).toBe(20);expect(quotedPrice(0.02,'g','kg').normalized).toBe(20);expect(()=>quotedPrice(10,'un','kg')).toThrow();});
it('baixa ficha uma vez e reverte toda a operação quando falta saldo',()=>{
 const a=stockList().find(i=>i.name==='Farinha de trigo')!,b=stockList().find(i=>i.name==='Manteiga')!;
 saveRecipe({id:1,lines:[{stockId:a.id,quantity:0.1},{stockId:b.id,quantity:0.05}]});
 const order=newOrder({requestId:crypto.randomUUID(),customerName:'Teste composição',phone:'35999999999',deliveryType:'pickup',paymentMethod:'offline',items:[{productId:1,quantity:2}]});
 const before=stockList().find(i=>i.id===a.id)!.current;
 expect(()=>changeOrderStatus(order.publicId,'production')).toThrow('Saldo insuficiente');expect(stockList().find(i=>i.id===a.id)!.current).toBe(before);
 adjustStock({stockId:b.id,quantity:1,reason:'Saldo de teste'});changeOrderStatus(order.publicId,'production');changeOrderStatus(order.publicId,'ready');
 expect(stockList().find(i=>i.id===a.id)!.current).toBeCloseTo(before-0.2);expect(stockList().find(i=>i.id===b.id)!.current).toBeCloseTo(0.9);
 expect(movements().filter(m=>m.reference===order.publicId)).toHaveLength(2);
});
import {saveStock} from './inventory';
it('edita insumo importado mantendo saldo, ID e vínculo sem recriar o nome original',()=>{const old=stockList().find(i=>i.name==='Bacon')!;adjustStock({stockId:old.id,quantity:2,reason:'Contagem inicial teste'});const count=stockList().length;saveStock({id:old.id,name:'Bacon em cubos',unit:old.unit,minimum:1});const all=stockList();expect(all).toHaveLength(count);expect(all.find(i=>i.id===old.id)).toMatchObject({name:'Bacon em cubos',current:2,minimum:1});expect(all.some(i=>i.name==='Bacon')).toBe(false);expect(()=>saveStock({id:old.id,name:'Bacon em cubos',unit:'un',minimum:1})).toThrow();});
import {recordMovement} from './inventory';
it('entrada soma, baixa subtrai e acerto define saldo contado',()=>{const i=stockList().find(i=>i.name==='Ovos')!;recordMovement({stockId:i.id,type:'entry',quantity:10,reason:'Entrada teste'});recordMovement({stockId:i.id,type:'out',quantity:3,reason:'Baixa teste'});expect(stockList().find(s=>s.id===i.id)?.current).toBe(7);recordMovement({stockId:i.id,type:'set',quantity:4,reason:'Contagem teste'});expect(stockList().find(s=>s.id===i.id)?.current).toBe(4);expect(()=>recordMovement({stockId:i.id,type:'out',quantity:5,reason:'Baixa teste'})).toThrow();});
it('divide consumo pelo rendimento da ficha',()=>{const i=stockList().find(s=>s.name==='Leite')!;adjustStock({stockId:i.id,quantity:10,reason:'Teste rendimento'});saveRecipe({id:2,yieldQuantity:20,lines:[{stockId:i.id,quantity:2}]});const o=newOrder({requestId:crypto.randomUUID(),customerName:'Teste rendimento',phone:'35999999999',deliveryType:'pickup',paymentMethod:'offline',items:[{productId:2,quantity:3}]});changeOrderStatus(o.publicId,'production');expect(stockList().find(s=>s.id===i.id)?.current).toBeCloseTo(9.7);});

import {assignTrip} from './logistics';
import {detectNeighborhood,tariffFor} from '../shared/delivery-tariffs';
it('reconhece bairro completo sem confundir parte do nome',()=>{
 expect(detectNeighborhood('Rua teste, 10 - Jardim Acácias, Poços de Caldas')).toBe('ACACIAS JD.');
 expect(detectNeighborhood('Rua Aparecida, 10 - Bairro não cadastrado')).toBe('');
 expect(()=>tariffFor('Não cadastrado','Zupt')).toThrow();
});
it('atribui empresa com preço do servidor e preserva taxa do cliente',()=>{
 const order=newOrder({requestId:crypto.randomUUID(),customerName:'Teste entrega',phone:'35999999999',address:'Rua teste, 10 - ALCOA (PORTARIA)',deliveryType:'delivery',paymentMethod:'offline',items:[{productId:1,quantity:1}]},700);
 const trip=assignTrip({orderId:order.publicId,company:'Zupt',neighborhood:'ALCOA (PORTARIA)',cost:0});
 expect(trip.cost).toBe(22);expect(trip.customerDeliveryFee).toBe(7);expect(trip.costSource).toBe('table');
 expect(()=>assignTrip({orderId:order.publicId,company:'Moto City',neighborhood:'ALCOA (PORTARIA)',cost:1})).toThrow('já atribuído');
});

import {cashRows,recordCash} from './cash';
import {createSale} from './catalog';
import {finishTrip,trips} from './logistics';
it('recebe dinheiro descontando troco e não duplica venda nem saída do moto',()=>{
 const input={requestId:crypto.randomUUID(),customerName:'Caixa teste',method:'cash',received:1000,items:[{productId:1,quantity:1}]};
 const sale=createSale(input);createSale(input);
 const entries=cashRows().filter(r=>r.reference==='order:'+sale.publicId);expect(entries).toHaveLength(1);expect(entries[0].amount).toBe(Number(sale.total));
 const trip=trips()[0];finishTrip(trip.id);finishTrip(trip.id);expect(cashRows().filter(r=>r.reference==='trip:'+trip.id)).toHaveLength(1);
});
it('entrada manual é idempotente e pedido offline só entra ao receber',()=>{
 const manual={requestId:crypto.randomUUID(),type:'in' as const,amount:50,description:'Saldo inicial',method:'cash' as const};recordCash(manual);recordCash(manual);expect(cashRows().filter(r=>r.reference==='manual:'+manual.requestId)).toHaveLength(1);
 const o=newOrder({requestId:crypto.randomUUID(),customerName:'Pagamento entrega',phone:'35999999999',address:'Rua teste, 10',deliveryType:'delivery',paymentMethod:'offline',items:[{productId:1,quantity:1}]});
 expect(cashRows().some(r=>r.reference==='order:'+o.publicId)).toBe(false);
 recordCash({...manual,requestId:crypto.randomUUID(),orderId:o.publicId,amount:1});expect(cashRows().find(r=>r.reference==='order:'+o.publicId)?.amount).toBe(Number(o.total));
});
