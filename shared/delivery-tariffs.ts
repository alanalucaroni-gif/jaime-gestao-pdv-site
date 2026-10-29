import data from './imperial-delivery-tariffs.json';
export type DeliveryCompany = 'Moto City' | 'Zupt';
export const deliveryTariffs = data.neighborhoods;
export function neighborhoodKey(value:string) {
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\bjd\.?/g,'jardim').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean).sort().join(' ');
}
export function detectNeighborhood(address:string) {
 const parts=address.split(/[,;–—]| - /).map(neighborhoodKey);
 const matches=deliveryTariffs.filter(row=>neighborhoodKey(row.bairro)!==neighborhoodKey('Poços de Caldas')&&parts.includes(neighborhoodKey(row.bairro)));
 return matches.length===1?matches[0].bairro:'';
}
export function tariffFor(neighborhood:string,company:DeliveryCompany) {
 const row=deliveryTariffs.find(r=>r.bairro===neighborhood);
 const price=row?.valores[company];
 if(typeof price!=='number'||!Number.isFinite(price)||price<=0) throw new Error('Preço não cadastrado para este bairro e empresa.');
 return price;
}
