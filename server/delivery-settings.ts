import { z } from 'zod';
import { records, put } from './erp-store';

export const deliverySettingsSchema = z.object({
  enabled: z.boolean(), origin: z.string().trim().max(500),
  bands: z.array(z.object({ upToKm: z.number().positive().max(100), price: z.number().min(0).max(1000) })).max(20),
}).superRefine((value, ctx) => {
  if (value.enabled && (value.origin.length < 8 || !value.bands.length)) ctx.addIssue({ code: 'custom', message: 'Preencha a origem e pelo menos uma faixa antes de ativar.' });
  if (value.bands.some((b, i) => i > 0 && b.upToKm <= value.bands[i - 1].upToKm)) ctx.addIssue({ code: 'custom', message: 'Informe distâncias crescentes, sem faixas repetidas.' });
});
export const deliverySettings = () => records<z.infer<typeof deliverySettingsSchema> & {id:number}>('delivery_settings')[0] ?? {id:1, enabled:false, origin:'', bands:[]};
export const saveDeliverySettings = (value: unknown) => put('delivery_settings', { ...deliverySettingsSchema.parse(value), id:1 });
export function priceForMeters(meters: number, bands: {upToKm:number;price:number}[]) {
  if (!Number.isFinite(meters) || meters < 0) throw new Error('Distância inválida');
  const band = bands.find(b => meters <= b.upToKm * 1000);
  if (!band) throw new Error('Endereço fora da distância atendida. Escolha retirada.');
  return Math.round(band.price * 100);
}
