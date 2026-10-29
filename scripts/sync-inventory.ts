import {stockList} from '../server/inventory';
import {directMenu} from '../server/commerce-store';
import {builderIngredients} from '../shared/custom-crepe';
const all=stockList();const required=[...builderIngredients.salgado,...builderIngredients.doce,...directMenu().filter(p=>p.category==='Bebida').map(p=>p.name)];
console.log(JSON.stringify({ingredientes:builderIngredients.salgado.length+builderIngredients.doce.length,bebidas:directMenu().filter(p=>p.category==='Bebida').length,totalEstoque:all.length,faltantes:required.filter(n=>!all.some(i=>i.name===n))}));
