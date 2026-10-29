export function quotedPrice(price:number,priceUnit:string,stockUnit:string,content?:number){
 if(!Number.isFinite(price)||price<=0||price>1000000)throw new Error('Informe um preço válido');
 let factor=priceUnit===stockUnit?1:priceUnit==='g'&&stockUnit==='kg'?0.001:priceUnit==='ml'&&stockUnit==='L'?0.001:content;
 if(!factor||!Number.isFinite(factor)||factor<=0||factor>100000)throw new Error(`Informe quanto cada ${priceUnit} contém em ${stockUnit}`);
 return {factor,normalized:price/factor};
}
