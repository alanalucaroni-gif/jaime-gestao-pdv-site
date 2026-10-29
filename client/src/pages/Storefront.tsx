import DirectCheckout from "@/components/DirectCheckout";
import { builderIngredients } from "@shared/custom-crepe";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Minus, Plus, ShoppingBag, Store, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadMenu, type MenuProduct } from "@/data/menu";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Product = MenuProduct;
type CartLine = Product & { quantity: number };
type Category = "Todos" | Product["category"] | "Monte";

const tabs: Array<{ label: string; value: Category }> = [
  { label: "Tudo", value: "Todos" },
  { label: "Salgados", value: "Salgado" },
  { label: "Vegetariano", value: "Vegetariano" },
  { label: "Doces", value: "Doce" },
  { label: "Bebidas", value: "Bebida" },
  { label: "Monte o seu", value: "Monte" },
];
const categoryTitles: Record<Exclude<Category, "Todos" | "Monte">, string> = { Salgado: "Crepes salgados", Vegetariano: "Crepe vegetariano", Doce: "Crepes doces", Bebida: "Bebidas" };
const categoryLabels: Record<Product["category"], string> = { Salgado: "Salgado", Vegetariano: "Vegetariano", Doce: "Doce", Bebida: "Bebida" };
const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const slug = (name: string) => name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const imageFor = (name: string) => `/menu-images/${slug(name)}.webp`;

export default function Storefront() {
  const [tab, setTab] = useState<Category>("Todos");
  const [products, setProducts] = useState<Product[]>(loadMenu);
  const [cart, setCart] = useState<CartLine[]>(() => { try { const saved = JSON.parse(sessionStorage.getItem("jaime-cart") || "[]"); return Array.isArray(saved) ? saved.filter(x => Number.isInteger(x.quantity) && x.quantity > 0 && Number.isFinite(x.price)) : []; } catch { return []; } });
  useEffect(() => { try { sessionStorage.setItem("jaime-cart", JSON.stringify(cart)); } catch {} }, [cart]);
  const [bagOpen, setBagOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderType, setOrderType] = useState<"delivery" | "pickup">("delivery");
  const [payment, setPayment] = useState("Pix");
  const [customer, setCustomer] = useState("");
  const [address, setAddress] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const menuQuery = trpc.menu.list.useQuery(undefined, { staleTime: 5_000, refetchInterval: 15_000 });

  useEffect(() => {
    if (menuQuery.data?.length) setProducts(menuQuery.data.map(item => ({ id: item.id, image: item.image, sku: item.sku, name: item.name, category: item.category as Product["category"], description: item.description, price: Number(item.price), available: item.available === 1, accent: item.accent })));
  }, [menuQuery.data]);


  const visible = products.filter(product => product.available && (tab === "Todos" || product.category === tab));
  const linesTotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const deliveryFee = orderType === "delivery" && cart.length ? 5 : 0;
  const total = linesTotal + deliveryFee;
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);
  const groups = useMemo(() => (tab === "Todos" ? ["Salgado", "Vegetariano", "Doce", "Bebida"] as Product["category"][] : [tab as Product["category"]]), [tab]);

  const add = (product: Product) => setCart(current => { const found = current.find(line => line.id === product.id); return found ? current.map(line => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { ...product, quantity: 1 }]; });
  const changeQuantity = (id: number, amount: number) => setCart(current => current.flatMap(line => line.id !== id ? [line] : line.quantity + amount <= 0 ? [] : [{ ...line, quantity: line.quantity + amount }]));

  return <div className="original-menu">
    <header className="original-header"><a className="original-back" href="/">← Início</a><a className="original-logo" href="/loja" aria-label="J'aime Creperia"><img src="/assets/original-01.png" alt="J'aime Creperia" /></a><button className="original-pill" onClick={() => setBagOpen(true)}>Sacola {count ? `(${count})` : ""}</button><button className="checkout-secondary" onClick={() => setCheckoutOpen(true)}>Meu pedido</button></header>
    <main className="original-main"><h1>Cardápio</h1><p className="original-sub">Feito na hora, do nosso jeito. Escolha seus crepes e envie o pedido direto para a loja.</p><div className="original-tabs">{tabs.map(item => <button key={item.value} aria-pressed={tab === item.value} onClick={() => setTab(item.value)}>{item.label}</button>)}</div>
      {tab === "Monte" ? <CustomBuilder onAdd={add} /> : groups.map(group => { const items = visible.filter(product => product.category === group); if (!items.length) return null; return <section className="original-section" key={group}><h2>{categoryTitles[group]}</h2>{group === "Bebida" ? <div className="original-drink-list">{items.map(product => <OriginalDrink product={product} onAdd={add} key={product.id} />)}</div> : <div className="original-cards">{items.map(product => <OriginalCard product={product} onAdd={add} key={product.id} />)}</div>}</section>; })}
    </main>
    <button className={`original-bag ${count ? "on" : ""}`} onClick={() => setBagOpen(true)}><span>{count} {count === 1 ? "item" : "itens"} · {formatCurrency(linesTotal)}</span><strong>Ver sacola</strong></button>
    {bagOpen && <BagPanel cart={cart} total={total} subtotal={linesTotal} deliveryFee={deliveryFee} onClose={() => setBagOpen(false)} onChange={changeQuantity} onCheckout={() => { setBagOpen(false); setCheckoutOpen(true); }} />}
    {checkoutOpen && <DirectCheckout cart={cart} onClose={() => setCheckoutOpen(false)} onOrdered={() => setCart([])} />}
    {completed && <div className="original-overlay"><div className="original-success"><div className="success-check"><Check /></div><span>pedido recebido</span><h2>Já estamos preparando seu crepe.</h2><p>Pedido <strong>{orderNumber}</strong> entrou na fila da J'aime Creperia.</p><Button onClick={() => { setCompleted(false); setCart([]); }}>Voltar ao cardápio</Button></div></div>}
  </div>;
}

function OriginalCard({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) { return <article className="original-card"><div className="original-photo">{(product.image || product.image === undefined && product.name in { Eugene: 1, Royal: 1, Monet: 1, Matisse: 1, Cezanne: 1, Gaston: 1, Pierre: 1, Chapelle: 1, Florian: 1, Lucie: 1, Margot: 1, Olivier: 1, Matilde: 1, Léon: 1 }) ? <img src={product.image || imageFor(product.name)} alt={`Crepe ${product.name}`} /> : <span>{product.name.slice(0, 1)}</span>}</div><h3>{product.name}</h3><small>{categoryLabels[product.category]}</small><p>{product.description}</p><div className="original-price"><b>{formatCurrency(product.price)}</b><button onClick={() => onAdd(product)}>+ Adicionar</button></div></article>; }
function OriginalDrink({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) { return <div className="original-drink"><div><h3>{product.name}</h3><p>{product.description}</p></div><div className="original-price"><b>{formatCurrency(product.price)}</b><button onClick={() => onAdd(product)}>+ Adicionar</button></div></div>; }
function BagPanel({ cart, subtotal, deliveryFee, total, onClose, onChange, onCheckout }: { cart: CartLine[]; subtotal: number; deliveryFee: number; total: number; onClose: () => void; onChange: (id: number, amount: number) => void; onCheckout: () => void }) { return <div className="original-overlay" onMouseDown={onClose}><aside className="original-panel" onMouseDown={event => event.stopPropagation()}><h2>Sua sacola <button onClick={onClose}><X /></button></h2>{cart.length ? cart.map(line => <div className="original-line" key={line.id}><div><strong>{line.name}</strong><span>{formatCurrency(line.price)}</span></div><div className="original-qty"><button onClick={() => onChange(line.id, -1)}><Minus /></button>{line.quantity}<button onClick={() => onChange(line.id, 1)}><Plus /></button></div></div>) : <p>Sua sacola está vazia.</p>}<div className="original-total"><span>Subtotal</span><b>{formatCurrency(subtotal)}</b><span>Entrega</span><b>{deliveryFee ? formatCurrency(deliveryFee) : "A calcular"}</b><strong>Total</strong><strong>{formatCurrency(total)}</strong></div><button className="original-pill original-full" disabled={!cart.length} onClick={onCheckout}>Continuar pedido <ArrowRight size={16} /></button></aside></div>; }
function CheckoutModal({ customer, setCustomer, address, setAddress, customerNote, setCustomerNote, orderType, setOrderType, payment, setPayment, total, busy, onClose, onConfirm }: { customer: string; setCustomer: (v: string) => void; address: string; setAddress: (v: string) => void; customerNote: string; setCustomerNote: (v: string) => void; orderType: "delivery" | "pickup"; setOrderType: (v: "delivery" | "pickup") => void; payment: string; setPayment: (v: string) => void; total: number; busy: boolean; onClose: () => void; onConfirm: () => void }) { const canConfirm = customer.trim() && (orderType === "pickup" || address.trim()); return <div className="original-overlay"><div className="original-checkout"><h2>Último passo <button onClick={onClose}><X /></button></h2><label>Seu nome<input value={customer} onChange={event => setCustomer(event.target.value)} placeholder="Como podemos te chamar?" /></label><div className="original-options"><button className={orderType === "delivery" ? "active" : ""} onClick={() => setOrderType("delivery")}><Truck /> Entrega</button><button className={orderType === "pickup" ? "active" : ""} onClick={() => setOrderType("pickup")}><Store /> Retirada</button></div>{orderType === "delivery" && <label>Endereço<input value={address} onChange={event => setAddress(event.target.value)} placeholder="Rua, número e bairro" /></label>}<label>Observações do pedido<textarea value={customerNote} onChange={event => setCustomerNote(event.target.value)} placeholder="Ex.: sem cebola, tocar a campainha, retirar talher..." /></label><div className="original-payment"><span>Forma de pagamento</span>{["Pix", "Cartão", "Na entrega"].map(method => <button className={payment === method ? "active" : ""} key={method} onClick={() => setPayment(method)}>{method}</button>)}</div><p className="original-note">A observação será enviada para a cozinha junto com a comanda.</p><div className="original-checkout-bottom"><strong>{formatCurrency(total)}</strong><button className="original-pill" disabled={!canConfirm || busy} onClick={onConfirm}>{busy ? "Enviando..." : "Confirmar pedido"}</button></div></div></div>; }



function CustomBuilder({ onAdd }: { onAdd: (product: Product) => void }) {
  const [type, setType] = useState<"salgado" | "doce">("salgado");
  const [massa, setMassa] = useState<"Tradicional" | "Chocolate">("Tradicional");
  const [chosen, setChosen] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [obs, setObs] = useState("");
  const base = type === "doce" ? 18 : 25;
  const unit = base + chosen.length * 5;
  const toggle = (ingredient: string) => setChosen(items => items.includes(ingredient) ? items.filter(item => item !== ingredient) : items.length >= 6 ? items : [...items, ingredient]);
  const addCustom = () => { if (!chosen.length) return; const product = { id: -Date.now(), name: `Monte seu crepe (${type})`, category: type === "doce" ? "Doce" : "Salgado" as Product["category"], description: `${massa}; ${chosen.join(", ")}${obs.trim() ? `; obs: ${obs.trim()}` : ""}`, price: unit, available: true, accent: "product-amber", custom: { type, dough: massa, ingredients: chosen, note: obs.trim() } }; for (let index = 0; index < quantity; index += 1) onAdd(product); setChosen([]); setObs(""); setQuantity(1); };
  return <section className="original-builder"><h2>Monte seu crepe</h2><div className="builder-grid"><div><h3>Que tipo?</h3><div className="builder-chips">{(["salgado", "doce"] as const).map(item => <button className={type === item ? "active" : ""} key={item} onClick={() => { setType(item); setChosen([]); }}>{item === "doce" ? "Doce" : "Salgado"}</button>)}</div><h3>Escolha a massa</h3><div className="builder-chips">{(["Tradicional", "Chocolate"] as const).map(item => <button className={massa === item ? "active" : ""} key={item} onClick={() => setMassa(item)}>{item}</button>)}</div><h3>Escolha os sabores <small>{chosen.length} de 6</small></h3><div className="builder-ingredients">{builderIngredients[type].map(item => <button className={chosen.includes(item) ? "active" : ""} key={item} onClick={() => toggle(item)}>{item}<span>{chosen.includes(item) ? "✓" : "+"}</span></button>)}</div><h3>Alguma observação?</h3><textarea value={obs} onChange={event => setObs(event.target.value)} placeholder="Ex.: sem cebola" /></div><aside><div className="builder-summary"><span>Seu crepe</span><strong>{formatCurrency(unit)}</strong><p>{chosen.length ? chosen.join(", ") : "Escolha seus ingredientes"}</p></div><div className="builder-quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>{quantity}<button onClick={() => setQuantity(Math.min(20, quantity + 1))}>+</button></div><button className="original-pill original-full" disabled={!chosen.length} onClick={addCustom}>Adicionar · {formatCurrency(unit * quantity)}</button></aside></div></section>;
}



