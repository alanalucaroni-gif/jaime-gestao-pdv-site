import { z } from 'zod';
import {commerceDb,directOrders,findOrder,saveOrder} from './commerce-store';
import {trips} from './logistics';
export const cashInput=z.object({requestId:z.string().uuid(),type:z.enum(['in','out']),amount:z.number().positive().max(1000000),description:z.string().trim().min(3).max(300),method:z.enum(['cash','pix','bank','card']),orderId:z.string().optional(),tripId:z.number().int().positive().optional()});
import {cashRows,writeCash} from './cash-ledger';
export {cashRows,writeCash} from './cash-ledger';
export function recordCash(raw:z.infer<typeof cashInput>){const input=cashInput.parse(raw);cashRows();const db=commerceDb();db.exec('BEGIN IMMEDIATE');try{
 if(input.orderId&&input.tripId)throw new Error('Selecione apenas um vínculo.');
 if(input.orderId){const o=findOrder(input.orderId);if(!o||o.status==='cancelled'||o.paymentMethod==='online'||o.paymentStatus==='paid')throw new Error('Pedido não disponível para recebimento manual.');writeCash('order:'+o.publicId,'in',Number(o.total),'Recebimento: '+o.customerName,input.method);o.paymentStatus='paid';o.counterPayment=input.method;saveOrder(o);}
 else if(input.tripId){const t=trips().find(t=>t.id===input.tripId);if(!t)throw new Error('Entrega não encontrada');writeCash('trip:'+t.id,'out',t.cost,'Pagamento entrega: '+(t.company??'entregador')+' · '+t.orderId,input.method);}
 else writeCash('manual:'+input.requestId,input.type,input.amount,input.description,input.method);
 db.exec('COMMIT');return cashRows();}catch(e){db.exec('ROLLBACK');throw e;}}
export function cashOverview(){const rows=cashRows();return {rows,pendingOrders:directOrders().filter(o=>o.paymentMethod==='offline'&&o.paymentStatus!=='paid'&&!['cancelled'].includes(o.status)&&!rows.some(r=>r.reference==='order:'+o.publicId)).map(o=>({id:o.publicId,name:o.customerName,total:Number(o.total)})),pendingTrips:trips().filter(t=>!rows.some(r=>r.reference==='trip:'+t.id)).map(t=>({id:t.id,name:t.company??'Entregador',total:t.cost})),onlineNote:'Cartão e Mercado Pago: pagamento aprovado não significa repasse bancário. Registre o repasse quando entrar na conta.'};}
