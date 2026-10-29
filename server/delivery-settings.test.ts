import {describe,it,expect} from 'vitest';
import {priceForMeters,deliverySettingsSchema} from './delivery-settings';
describe('taxa por trajeto',()=>{
 const bands=[{upToKm:2,price:5},{upToKm:4,price:8}];
 it('usa metros sem arredondar para faixa menor',()=>{expect(priceForMeters(2000,bands)).toBe(500);expect(priceForMeters(2001,bands)).toBe(800)});
 it('recusa além do limite e distâncias inválidas',()=>{expect(()=>priceForMeters(4001,bands)).toThrow();expect(()=>priceForMeters(NaN,bands)).toThrow()});
 it('não ativa sem origem e faixas',()=>{expect(deliverySettingsSchema.safeParse({enabled:true,origin:'',bands:[]}).success).toBe(false)});
 it('recusa faixas repetidas ou fora de ordem',()=>{expect(deliverySettingsSchema.safeParse({enabled:false,origin:'',bands:[bands[1],bands[0]]}).success).toBe(false)});
});
