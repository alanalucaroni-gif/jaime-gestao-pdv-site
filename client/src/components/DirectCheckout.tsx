import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { MenuProduct } from '@/data/menu';

type OrderView = { publicId: string; token?: string; status: string; paymentStatus: string; paymentMethod: string; total: string; qrCode?: string; qrImage?: string };
type Config = { routeDelivery: boolean; deliveryAvailable: boolean; online: boolean; publicKey: string; deliveryFee: number | null };
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
async function api<T>(url: string, options?: RequestInit): Promise<T> {
 const response = await fetch(url, options); const data = await response.json();
 if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.'); return data;
}
let sdkPromise: Promise<void> | undefined;
function loadSdk() { return sdkPromise ||= new Promise<void>((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://sdk.mercadopago.com/js/v2'; script.onload = () => resolve(); script.onerror = () => { sdkPromise = undefined; script.remove(); reject(new Error('Não foi possível carregar o Mercado Pago.')); }; document.head.appendChild(script); }); }
function MercadoPayment({ order, token, publicKey, onResult }: { order: OrderView; token: string; publicKey: string; onResult: (order: OrderView) => void }) {
 const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
 const callback = useRef(onResult); callback.current = onResult;
 useEffect(() => {
  let disposed = false; let controller: { unmount(): void } | undefined;
  loadSdk().then(async () => {
   if (disposed) return;
   const Constructor = (window as unknown as { MercadoPago: new (key: string, options: object) => { bricks(): { create(type: string, id: string, settings: object): Promise<{ unmount(): void }> } } }).MercadoPago;
   controller = await new Constructor(publicKey, { locale: 'pt-BR' }).bricks().create('payment', 'jaime-payment', {
    initialization: { amount: Number(order.total) },
    customization: { paymentMethods: { creditCard: 'all', debitCard: 'all', bankTransfer: 'all', maxInstallments: 1 } },
    callbacks: {
     onReady: () => setLoading(false), onError: () => { setLoading(false); setError('Confira os dados ou tente carregar o formulário novamente.'); },
     onSubmit: async ({ formData }: { formData: unknown }) => {
      setError('');
      try { const result = await api<OrderView>(`/api/direct/orders/${order.publicId}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-order-token': token }, body: JSON.stringify(formData) }); callback.current(result); }
      catch (err) { setError((err as Error).message); throw err; }
     },
    },
   });
   if (disposed) controller.unmount();
  }).catch(err => { setLoading(false); setError(err.message); });
  return () => { disposed = true; controller?.unmount(); };
 }, [order.publicId, order.total, publicKey, token]);
 return <>{loading && <p role="status">Carregando pagamento seguro…</p>}{error && <p role="alert">{error}</p>}<div id="jaime-payment" /></>;
}
export default function DirectCheckout({ cart, onClose, onOrdered }: { cart: (MenuProduct & { quantity: number })[]; onClose(): void; onOrdered(): void }) {
 const [config, setConfig] = useState<Config>(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
 const [customer, setCustomer] = useState(''); const [phone, setPhone] = useState(''); const [address, setAddress] = useState(''); const [note, setNote] = useState('');
 const [delivery, setDelivery] = useState<'delivery' | 'pickup'>('delivery'); const [payment, setPayment] = useState<'offline' | 'online'>('offline');
 const [order, setOrder] = useState<OrderView>(); const [token, setToken] = useState(''); const requestId = useRef(crypto.randomUUID());
 const [suggestions,setSuggestions]=useState<{id:string;text:string}[]>([]);
 const [deliveryQuote,setDeliveryQuote]=useState<{token:string;address:string;cep:string;km:number;fee:number}>();
 const [addressBusy,setAddressBusy]=useState(false);
 const searchAddress=async()=>{setAddressBusy(true);setError('');try{setSuggestions(await api('/api/direct/address-search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:address})}));}catch(e){setError((e as Error).message)}finally{setAddressBusy(false)}};
 const selectAddress=async(placeId:string)=>{setAddressBusy(true);setError('');setDeliveryQuote(undefined);try{const q=await api<NonNullable<typeof deliveryQuote>>('/api/direct/delivery-quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({placeId})});setDeliveryQuote(q);setAddress(q.address);setSuggestions([]);}catch(e){setError((e as Error).message)}finally{setAddressBusy(false)}};
 const [recovering, setRecovering] = useState(true);
 useEffect(() => {
  api<Config>('/api/direct/config').then(setConfig).catch(err => setError(err.message));
  try { const saved = JSON.parse(localStorage.getItem('jaime-active-order') || 'null');
   if (saved?.publicId && saved?.token) { setToken(saved.token); api<OrderView>(`/api/direct/orders/${encodeURIComponent(saved.publicId)}`, { headers: { 'x-order-token': saved.token } }).then(setOrder).catch(err => setError(err.message)).finally(() => setRecovering(false)); return; }
  } catch { /* unavailable storage */ }
  setRecovering(false);
 }, []);
 const refresh = async (provider = false) => {
  if (!order) return; try { setOrder(await api<OrderView>(`/api/direct/orders/${order.publicId}${provider ? '?refresh=1' : ''}`, { headers: { 'x-order-token': token } })); setError(''); } catch (err) { setError((err as Error).message); }
 };
 useEffect(() => { if (!order) return; const timer = setInterval(() => { void refresh(); }, 10000); return () => clearInterval(timer); }, [order?.publicId, token]);
 const submit = async (event: React.FormEvent) => {
  event.preventDefault(); if (busy) return;
  if (!cart.length) { setError('Sua sacola está vazia. Adicione um crepe antes de confirmar.'); return; }
  if (!/^\d{10,13}$/.test(phone.replace(/\D/g, ''))) { setError('Informe um telefone com DDD, por exemplo (11) 99999-9999.'); return; }
  setBusy(true); setError('');
  try {
   const result = await api<OrderView>('/api/direct/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: requestId.current, customerName: customer, phone: phone.replace(/\D/g, ''), address, deliveryToken: deliveryQuote?.token, customerNote: note, deliveryType: delivery, paymentMethod: payment, items: cart.map(line => ({ productId: line.id > 0 ? line.id : undefined, quantity: line.quantity, custom: line.custom })) }) });
   setOrder(result); setToken(result.token!); onOrdered();
   try { localStorage.setItem('jaime-active-order', JSON.stringify({ publicId: result.publicId, token: result.token })); } catch { /* order remains visible */ }
  } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
 };
 const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0) + (delivery === 'delivery' && cart.length ? (config?.routeDelivery ? deliveryQuote?.fee : config?.deliveryFee) || 0 : 0);
 const status: Record<string, string> = { analysis: 'Recebido pela loja', production: 'Em preparação', ready: 'Pronto para entrega ou retirada', completed: 'Concluído', cancelled: 'Cancelado' };
 const paid: Record<string, string> = { pending: 'Aguardando pagamento', paid: 'Pagamento confirmado', failed: 'Pagamento não aprovado', cash_on_delivery: 'Pagamento na entrega ou retirada', refunded: 'Pagamento reembolsado', charged_back: 'Pagamento contestado' };
 return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="direct-checkout"><DialogHeader><DialogTitle>{order ? 'Acompanhe seu pedido' : 'Falta pouco para o seu crepe.'}</DialogTitle><DialogDescription>{order ? 'O status é atualizado automaticamente.' : 'Confira seus dados. O resto é com a J’aime.'}</DialogDescription></DialogHeader>
 {error && <p className="checkout-error" role="alert">{error}</p>}
 {recovering ? <p role="status">Carregando…</p> : order ? <section className="direct-status">
 <p className="order-number">{order.publicId}</p><h3>{status[order.status]}</h3><p aria-live="polite">{paid[order.paymentStatus]}</p><strong>Total: {money(Number(order.total))}</strong>
 {order.paymentMethod === 'online' && order.paymentStatus === 'pending' && !order.qrCode && config?.online && <MercadoPayment order={order} token={token} publicKey={config.publicKey} onResult={setOrder} />}
 {order.qrCode && order.paymentStatus === 'pending' && <div><h3>Pague com Pix</h3>{order.qrImage && <img className="pix-qr" src={`data:image/png;base64,${order.qrImage}`} alt="QR Code Pix do seu pedido" />}<label>Pix copia e cola<textarea readOnly value={order.qrCode} /></label><button className="original-pill" onClick={() => navigator.clipboard.writeText(order.qrCode!).then(() => setError('Código Pix copiado.')).catch(() => setError('Selecione e copie o código acima.'))}>Copiar código Pix</button><p>A confirmação aparecerá aqui depois do pagamento.</p></div>}
 <button className="original-pill" onClick={() => { void refresh(true); }}>Atualizar status</button>
 <button className="checkout-secondary" onClick={onClose}>Voltar ao cardápio</button>
 {(order.paymentMethod === 'offline' || ['paid','refunded','charged_back'].includes(order.paymentStatus) || ['completed','cancelled'].includes(order.status)) && <button className="checkout-secondary" onClick={() => { localStorage.removeItem('jaime-active-order'); setOrder(undefined); setToken(''); requestId.current = crypto.randomUUID(); }}>Fazer outro pedido</button>}
 </section> : <form id="direct-order-form" onSubmit={submit} className="direct-form"><div className="checkout-fields"><div className="checkout-contact">
 <label>Seu nome<input autoComplete="name" required minLength={2} maxLength={160} placeholder="Como podemos te chamar?" value={customer} onChange={e => setCustomer(e.target.value)} /></label>
 <label>Telefone / WhatsApp<input autoComplete="tel" type="tel" required minLength={10} maxLength={20} placeholder="(11) 99999-9999" value={phone} onChange={e => setPhone(e.target.value)} /></label>
 </div><fieldset className="delivery-choice"><legend>Como você quer receber?</legend><label><input type="radio" name="delivery" checked={delivery === 'delivery'} onChange={() => setDelivery('delivery')} /> Entrega</label><label><input type="radio" name="delivery" checked={delivery === 'pickup'} onChange={() => setDelivery('pickup')} /> Retirada</label></fieldset>
 {delivery === 'delivery' && <label>Endereço completo<input autoComplete="street-address" required minLength={8} maxLength={1000} placeholder="Rua, número, bairro e complemento" value={address} onChange={e => {setAddress(e.target.value);setDeliveryQuote(undefined);setSuggestions([])}} /></label>}
 {delivery==='delivery'&&config&&!config.deliveryAvailable&&<p role="status">Entrega temporariamente indisponível. Você pode escolher retirada.</p>}
 {delivery==='delivery'&&config?.routeDelivery&&config.deliveryAvailable&&<div><button type="button" className="checkout-secondary" disabled={addressBusy||address.trim().length<4} onClick={searchAddress}>{addressBusy?'Consultando endereço…':'Buscar endereço e calcular entrega'}</button>{suggestions.map(s=><button type="button" className="checkout-secondary" disabled={addressBusy} key={s.id} onClick={()=>selectAddress(s.id)}>{s.text}</button>)}{suggestions.length>0&&<small>Google Maps</small>}{deliveryQuote&&<p role="status">CEP: {deliveryQuote.cep||'Não informado pelo Maps'} · {deliveryQuote.km.toFixed(2)} km pela rua · Entrega {money(deliveryQuote.fee)}</p>}<small>Inclua o número do imóvel na busca. Informe complemento nas observações.</small></div>}
 <details className="checkout-notes"><summary>Adicionar observações <span>opcional</span></summary><label className="sr-only" htmlFor="order-note">Observações</label><textarea id="order-note" maxLength={1000} placeholder="Ex.: sem cebola, ponto de referência…" value={note} onChange={e => setNote(e.target.value)} /></details>
 <fieldset><legend>Pagamento</legend><label><input type="radio" name="payment" checked={payment === 'offline'} onChange={() => setPayment('offline')} /> Pagar na entrega ou retirada</label><label><input type="radio" name="payment" disabled={!config?.online} checked={payment === 'online'} onChange={() => setPayment('online')} /> Pix ou cartão online — Mercado Pago</label>{config && !config.online && <small>Pagamento online ainda não disponível.</small>}</fieldset>
 </div><footer className="checkout-footer"><div className="checkout-totals"><span>Entrega: {delivery === 'delivery' && config?.routeDelivery && !deliveryQuote ? (config.deliveryAvailable ? 'A calcular pelo endereço' : 'Indisponível') : money(delivery === 'delivery' && cart.length ? (config?.routeDelivery ? deliveryQuote?.fee : config?.deliveryFee) || 0 : 0)}</span><strong>{delivery==='delivery'&&config?.routeDelivery&&!deliveryQuote?'Subtotal':'Total'} <b>{money(total)}</b></strong></div>
 <button className="original-pill" disabled={busy || !config || !cart.length || (delivery==='delivery'&&(!config.deliveryAvailable||!deliveryQuote))}>{busy ? 'Salvando pedido…' : payment === 'online' ? 'Continuar para pagamento' : 'Confirmar pedido →'}</button>{!cart.length && <small>Sacola vazia — adicione um item no cardápio.</small>}</footer>
 </form>}
 </DialogContent></Dialog>;
}

