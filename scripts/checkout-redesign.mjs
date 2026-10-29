import fs from 'node:fs';
const p='client/src/components/DirectCheckout.tsx';let s=fs.readFileSync(p,'utf8');
s=s.replace("event.preventDefault(); if (busy) return; setBusy(true); setError('');",`event.preventDefault(); if (busy) return;
  if (!cart.length) { setError('Sua sacola está vazia. Adicione um crepe antes de confirmar.'); return; }
  if (!/^\\d{10,13}$/.test(phone.replace(/\\D/g, ''))) { setError('Informe um telefone com DDD, por exemplo (11) 99999-9999.'); return; }
  setBusy(true); setError('');`);
s=s.replace('<form onSubmit={submit} className="direct-form">','<form id="direct-order-form" onSubmit={submit} className="direct-form"><div className="checkout-fields"><div className="checkout-contact">');
s=s.replace('<fieldset><legend>Como você quer receber?', '</div><fieldset className="delivery-choice"><legend>Como você quer receber?');
s=s.replace('value={customer} onChange=', 'placeholder="Como podemos te chamar?" value={customer} onChange=');
s=s.replace('value={phone} onChange=', 'placeholder="(11) 99999-9999" value={phone} onChange=');
s=s.replace('<label>Observações<textarea','<details className="checkout-notes"><summary>Adicionar observações <span>opcional</span></summary><label className="sr-only" htmlFor="order-note">Observações</label><textarea id="order-note"');
s=s.replace('setNote(e.target.value)} /></label>','setNote(e.target.value)} /></details>');
s=s.replace('<p>Entrega: {money(delivery ===', '</div><footer className="checkout-footer"><div className="checkout-totals"><span>Entrega: {money(delivery ===');
s=s.replace("config?.deliveryFee || 0 : 0)}</p><strong>Total: {money(total)}</strong>","config?.deliveryFee || 0 : 0)}</span><strong>Total <b>{money(total)}</b></strong></div>");
s=s.replace('disabled={busy || !config || !cart.length}', 'disabled={busy || !config}');
s=s.replace("'Confirmar pedido'}</button>\n </form>}","'Confirmar pedido →'}</button>{!cart.length && <small>Sacola vazia — adicione um item no cardápio.</small>}</footer>\n </form>}");
s=s.replace("'Finalize seu pedido'", "'Falta pouco para o seu crepe.'");
s=s.replace("'Peça diretamente à J’aime. Escolha entrega ou retirada.'", "'Confira seus dados. O resto é com a J’aime.'");
fs.writeFileSync(p,s);
