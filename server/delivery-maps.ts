import crypto from 'node:crypto';
import type { Express, RequestHandler } from 'express';
import { z } from 'zod';
import { deliverySettings, saveDeliverySettings, priceForMeters } from './delivery-settings';
const quotes = new Map<string, {address:string;fee:number;expires:number;settings:string}>();
const normalize = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
async function google(url:string, fields:string, body?:unknown) {
 const key=process.env.GOOGLE_MAPS_API_KEY;
 if(!key) throw new Error('Entrega automática aguardando configuração do Maps. Escolha retirada.');
 const r=await fetch(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':fields},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
 if(!r.ok) throw new Error('Não foi possível consultar o Maps. Tente novamente.');
 return r.json();
}
export function verifiedDelivery(token:unknown,address:string) {
 const q=quotes.get(String(token));
 if(!q||q.expires<Date.now()||q.address!==address||q.settings!==JSON.stringify(deliverySettings())) throw new Error('Calcule novamente a entrega antes de confirmar.');
 return q.fee;
}
export function registerDeliveryMaps(app:Express,admin:RequestHandler) {
 app.get('/api/direct/delivery-settings',admin,(_req,res)=>res.json({...deliverySettings(),mapsEnabled:Boolean(process.env.GOOGLE_MAPS_API_KEY)}));
 app.post('/api/direct/delivery-settings',admin,(req,res)=>{try {res.json(saveDeliverySettings(req.body));}catch(e){res.status(400).json({error:e instanceof z.ZodError?e.issues[0].message:(e as Error).message});}});
 app.post('/api/direct/address-search',async(req,res)=>{try {
  const {input}=z.object({input:z.string().trim().min(4).max(200)}).parse(req.body);
  if(!deliverySettings().enabled) throw new Error('Entrega automática ainda não ativada.');
  const data=await google('https://places.googleapis.com/v1/places:autocomplete','suggestions.placePrediction.placeId,suggestions.placePrediction.text',{input, includedRegionCodes:['br'],languageCode:'pt-BR',locationBias:{circle:{center:{latitude:-21.7878,longitude:-46.5614},radius:25000}}});
  res.json((data.suggestions??[]).filter((s:any)=>s.placePrediction).map((s:any)=>({id:s.placePrediction.placeId,text:s.placePrediction.text.text})));
 }catch(e){res.status(400).json({error:(e as Error).message});}});
 app.post('/api/direct/delivery-quote',async(req,res)=>{try {
  const {placeId}=z.object({placeId:z.string().regex(/^[a-zA-Z0-9_-]+$/).max(250)}).parse(req.body);
  const config=deliverySettings(); if(!config.enabled) throw new Error('Entrega automática ainda não ativada.');
  const place=await google('https://places.googleapis.com/v1/places/'+placeId,'formattedAddress,addressComponents,location');
  const component=(type:string)=>place.addressComponents?.find((c:any)=>c.types.includes(type));
  const city=component('administrative_area_level_2')?.longText??component('locality')?.longText??'';
  if(normalize(city)!=='pocos de caldas'||component('administrative_area_level_1')?.shortText!=='MG'||component('country')?.shortText!=='BR') throw new Error('Atendemos somente Poços de Caldas/MG.');
  if(!component('street_number')) throw new Error('Pesquise o endereço com o número do imóvel e selecione novamente.');
  if(!place.location) throw new Error('Localização não encontrada.');
  const data=await google('https://routes.googleapis.com/directions/v2:computeRoutes','routes.distanceMeters',{origin:{address:config.origin},destination:{location:{latLng:place.location}},travelMode:'DRIVE',languageCode:'pt-BR',units:'METRIC'});
  const meters=data.routes?.[0]?.distanceMeters; const fee=priceForMeters(meters,config.bands);
  for(const [key,q] of quotes) if(q.expires<Date.now()) quotes.delete(key);
  if(quotes.size>=2000) quotes.delete(quotes.keys().next().value!);
  const token=crypto.randomBytes(32).toString('hex');const address=place.formattedAddress;
  quotes.set(token,{address,fee,expires:Date.now()+15*60*1000,settings:JSON.stringify(config)});
  res.json({token,address,cep:component('postal_code')?.longText??'',km:meters/1000,fee:fee/100});
 }catch(e){res.status(400).json({error:(e as Error).message});}});
}
