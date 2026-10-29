import {z} from 'zod';
import {records,put,nextId} from './erp-store';
import {commerceDb,directMenu,findOrder,saveOrder,type DirectOrder} from './commerce-store';
import {builderIngredients} from '../shared/custom-crepe';
export const unitSchema=z.enum(['kg','un','L']);
export type Stock={sourceKey?:string;id:number;name:string;unit:z.infer<typeof unitSchema>;current:number;minimum:number};
export type Recipe={yieldQuantity?:number;prepMinutes?:number;estimatedCost?:number;instructions?:string;active?:boolean;updatedAt?:string;id:number;lines:{stockId:number;quantity:number}[]};
type Movement={id:number;stockId:number;quantity:number;reason:string;reference:string;createdAt:string};
export function stockList():Stock[]{
 const existing=records<Stock>('inventory');
 const normalize=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const names=[...builderIngredients.salgado,...builderIngredients.doce,'Massa tradicional','Massa de baunilha','Massa de chocolate','Farinha de trigo','Leite','Ovos','Manteiga','Creme de leite','Ervas e temperos','Embalagem para crepe'];
 const beverages=directMenu().filter(p=>p.category==='Bebida');
 let id=Math.max(0,...existing.map(i=>i.id));
 for(const name of [...new Set([...names,...beverages.map(p=>p.name)])]){
 const sourceKey=normalize(name);
 const found=existing.find(i=>i.sourceKey===sourceKey||(!i.sourceKey&&normalize(i.name)===sourceKey));
 if(found){if(!found.sourceKey){found.sourceKey=sourceKey;put('inventory',found);}continue;}
 const unit=name==='Leite'?'L':name.startsWith('Massa')||name==='Ovos'||name.startsWith('Embalagem')||beverages.some(p=>p.name===name)?'un':'kg';
 const item:Stock={id:++id,name,sourceKey,unit,current:0,minimum:0};put('inventory',item);existing.push(item);
 }
 return existing.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
export const stockSchema=z.object({id:z.number().int().positive().optional(),name:z.string().trim().min(2).max(160),unit:unitSchema,minimum:z.number().finite().min(0).max(100000)});
export function saveStock(input:z.infer<typeof stockSchema>){const all=stockList(),old=all.find(i=>i.id===input.id);if(input.id&&!old)throw new Error('Insumo não encontrado');if(all.some(i=>i.id!==input.id&&i.name.toLowerCase()===input.name.toLowerCase()))throw new Error('Nome já cadastrado');if(old&&old.unit!==input.unit)throw new Error('A unidade de um insumo cadastrado não pode ser alterada');return put<Stock>('inventory',{...old,...input,id:input.id??nextId('inventory'),current:old?.current??0});}
export const recipes=()=>records<Recipe>('recipes');
export const recipeSchema=z.object({yieldQuantity:z.number().finite().positive().max(100000).default(1),prepMinutes:z.number().int().min(0).max(100000).default(0),estimatedCost:z.number().finite().min(0).max(1000000).optional(),instructions:z.string().max(10000).default(''),active:z.boolean().default(true),id:z.number().int().positive(),lines:z.array(z.object({stockId:z.number().int().positive(),quantity:z.number().finite().positive().max(10000)})).min(1).max(100)});
export function saveRecipe(raw:z.input<typeof recipeSchema>){const input=recipeSchema.parse(raw);if(!directMenu().some(p=>p.id===input.id))throw new Error('Produto não encontrado');if(new Set(input.lines.map(l=>l.stockId)).size!==input.lines.length||input.lines.some(l=>!stockList().some(i=>i.id===l.stockId)))throw new Error('Confira os ingredientes da ficha');return put('recipes',{...input,updatedAt:new Date().toISOString()});}
export const movements=()=>records<Movement>('stock_movements').slice(0,200);
export function moveStock(stockId:number,quantity:number,reason:string,reference:string){const item=stockList().find(i=>i.id===stockId);if(!item||!Number.isFinite(quantity)||quantity===0)throw new Error('Movimentação inválida');if(item.current+quantity < -0.000001)throw new Error(`Saldo insuficiente: ${item.name}`);put('inventory',{...item,current:Math.round((item.current+quantity)*1000000)/1000000});put<Movement>('stock_movements',{id:nextId('stock_movements'),stockId,quantity,reason,reference,createdAt:new Date().toISOString()});}
export function adjustStock(input:{stockId:number;quantity:number;reason:string}){const db=commerceDb();db.exec('BEGIN IMMEDIATE');try{moveStock(input.stockId,input.quantity,input.reason,'manual');db.exec('COMMIT');return stockList();}catch(e){db.exec('ROLLBACK');throw e;}}
export function consumeOrder(order:DirectOrder){
 if(records<{id:number;orderId:string}>('stock_consumptions').some(c=>c.orderId===order.publicId))return;
 const required=new Map<number,number>();
 for(const item of order.items){const recipe=recipes().find(r=>r.id===item.productId);if(!recipe||recipe.active===false)throw new Error(`Preencha a ficha de composição de ${item.name} antes de iniciar a produção.`);for(const line of recipe.lines)required.set(line.stockId,(required.get(line.stockId)??0)+line.quantity*item.quantity/(recipe.yieldQuantity??1));}
 for(const [id,qty] of required)moveStock(id,-qty,'Baixa pela ficha de composição',order.publicId);
 put('stock_consumptions',{id:nextId('stock_consumptions'),orderId:order.publicId});
}
export function changeOrderStatus(publicId:string,status:DirectOrder['status']){const db=commerceDb();db.exec('BEGIN IMMEDIATE');try{const order=findOrder(publicId);if(!order)throw new Error('Pedido não encontrado');if(status!=='cancelled'&&order.paymentMethod==='online'&&order.paymentStatus!=='paid')throw new Error('Aguarde confirmação do pagamento');if(order.status==='cancelled'||order.status==='completed')throw new Error('Pedido já encerrado');if(['production','ready','completed'].includes(status))consumeOrder(order);order.status=status;saveOrder(order);db.exec('COMMIT');return {publicId,status};}catch(e){db.exec('ROLLBACK');throw e;}}

export const movementSchema=z.object({stockId:z.number().int().positive(),type:z.enum(['entry','out','set']),quantity:z.number().finite().min(0).max(100000),reason:z.string().trim().min(3).max(300)}).refine(i=>i.type==='set'||i.quantity>0,'Informe uma quantidade maior que zero');
export function recordMovement(raw:unknown){const input=movementSchema.parse(raw),db=commerceDb();db.exec('BEGIN IMMEDIATE');try{const item=stockList().find(i=>i.id===input.stockId);if(!item)throw new Error('Insumo não encontrado');const delta=input.type==='set'?input.quantity-item.current:input.type==='out'?-input.quantity:input.quantity;if(delta!==0)moveStock(item.id,delta,`${input.type==='set'?'Acerto':input.type==='out'?'Baixa':'Entrada'}: ${input.reason}`,'manual');db.exec('COMMIT');return stockList();}catch(e){db.exec('ROLLBACK');throw e;}}
