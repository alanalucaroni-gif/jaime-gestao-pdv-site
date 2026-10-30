import Financial from '@/components/Financial';
import ProductionBatches from '@/components/ProductionBatches';
import '@/backoffice.css';
import CashFlow from '@/components/CashFlow';
import Inventory from "@/components/Inventory";
import PurchaseComparison from "@/components/PurchaseComparison";
import Logistics from "@/components/Logistics";
import CatalogPOS from "@/components/CatalogPOS";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Bike,
  Boxes,
  Check,
  ClipboardList,
  Handshake,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  DollarSign,
  Download,
  Link2,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Search,
  Settings,
  Settings2,
  ShoppingBag,
  Store,
  Truck,
  UtensilsCrossed,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { initialMenu, type MenuProduct } from "@shared/catalog";

type Section = "pos" | "overview" | "orders" | "menu" | "stock" | "production" | "delivery" | "payments" | "integrations" | "finance" | "suppliers" | "financial" | "batches";
type OrderStatus = "analysis" | "production" | "ready" | "completed";
type Order = {
  id: string;
  customer: string;
  items: string;
  total: number;
  status: OrderStatus;
  channel: "Balcão" | "Delivery" | "Retirada" | "Site" | "iFood" | "WhatsApp";
  time: string;
  payment: string;
  observations: string;
};
type Product = MenuProduct;
type StockItem = {
  id: number;
  name: string;
  detail: string;
  current: number;
  minimum: number;
  unit: string;
  status: "low" | "ok";
};
type ProductionIngredient = { name: string; quantity: string; unit: string };
type ProductionSheet = { id: number; product: string; yield: string; prepTime: string; ingredients: ProductionIngredient[]; cost: number; active: boolean };
type Motoboy = { id: number; name: string; phone: string; status: "online" | "offline" | "delivering"; deliveries: number };
type PaymentSettings = { pix: boolean; card: boolean; cashOnDelivery: boolean; onlineProvider: "Stripe" | "Mercado Pago" | "Não conectado"; onlineEnabled: boolean; deliveryFeeMode: "fixed" | "distance" };
type DeliverySettings = { baseFee: number; perKm: number; maxRadius: number; minimumOrder: number };
type Integration = { id: string; name: string; detail: string; status: "connected" | "pending" | "available"; accent: string; ordersToday: number };

const sections: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: "pos", label: "PDV / Balcão", icon: ShoppingBag },
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "orders", label: "Pedidos", icon: ShoppingBag },
  { id: "menu", label: "Cardápio", icon: UtensilsCrossed },
  { id: "stock", label: "Estoque", icon: Boxes },
  { id: "suppliers", label: "Fornecedores", icon: Handshake },
  { id: "production", label: "Composição de venda", icon: ClipboardList },
  { id: "batches", label: "Produção de lotes", icon: PackageCheck },
  { id: "financial", label: "A pagar e receber", icon: CreditCard },
  { id: "delivery", label: "Motoboys e taxas", icon: Bike },
  { id: "payments", label: "Pagamentos", icon: WalletCards },
  { id: "integrations", label: "Integrações", icon: Link2 },
  { id: "finance", label: "Fluxo de caixa", icon: DollarSign },
];

const statusMeta: Record<OrderStatus, { label: string; short: string; tone: string }> = {
  analysis: { label: "Em análise", short: "Análise", tone: "status-orange" },
  production: { label: "Em produção", short: "Produção", tone: "status-yellow" },
  ready: { label: "Pronto para entrega", short: "Pronto", tone: "status-green" },
  completed: { label: "Concluído", short: "Concluído", tone: "status-dark" },
};

const statusOrder: OrderStatus[] = ["analysis", "production", "ready", "completed"];

const sourceLabels: Record<string, Order["channel"]> = { site: "Site", ifood: "iFood", whatsapp: "WhatsApp", marketplace: "Delivery", balcao: "Balcão" };

const initialOrders: Order[] = [
  { id: "#1048", customer: "Marina Costa", items: "2 crepes · 1 suco", total: 48.8, status: "analysis", channel: "Delivery", time: "19:42", payment: "Pix", observations: "" },
  { id: "#1047", customer: "Rafael Nunes", items: "Crepe Frango + adicional", total: 32.5, status: "production", channel: "Balcão", time: "19:36", payment: "Cartão", observations: "" },
  { id: "#1046", customer: "Bianca Alves", items: "Crepe Nutella + morango", total: 29.9, status: "production", channel: "Retirada", time: "19:28", payment: "Pix", observations: "" },
  { id: "#1045", customer: "João Pedro", items: "3 crepes salgados", total: 62.7, status: "ready", channel: "iFood", time: "19:21", payment: "Pago online", observations: "" },
  { id: "#1044", customer: "Ana Luiza", items: "Crepe Romeu e Julieta", total: 24.9, status: "completed", channel: "Balcão", time: "19:13", payment: "Cartão", observations: "" },
  { id: "#1043", customer: "Carlos Eduardo", items: "Crepe Presunto e queijo", total: 23.9, status: "completed", channel: "Retirada", time: "19:02", payment: "Pix", observations: "" },
];

const initialStock: StockItem[] = [
  { id: 1, name: "Massa de crepe", detail: "Pré-produção · refrigerado", current: 18, minimum: 25, unit: "porções", status: "low" },
  { id: 2, name: "Queijo muçarela", detail: "Laticínios · geladeira 01", current: 6.4, minimum: 5, unit: "kg", status: "ok" },
  { id: 3, name: "Frango desfiado", detail: "Insumos · geladeira 02", current: 2.1, minimum: 4, unit: "kg", status: "low" },
  { id: 4, name: "Nutella", detail: "Doces · prateleira 03", current: 3, minimum: 2, unit: "potes", status: "ok" },
  { id: 5, name: "Morangos", detail: "Hortifruti · geladeira 01", current: 1.2, minimum: 2, unit: "kg", status: "low" },
];

const initialProductionSheets: ProductionSheet[] = [
  { id: 1, product: "Massa tradicional", yield: "20 porções", prepTime: "45 min", cost: 18.4, active: true, ingredients: [{ name: "Farinha de trigo", quantity: "1,2", unit: "kg" }, { name: "Leite", quantity: "1,5", unit: "L" }, { name: "Ovos", quantity: "12", unit: "un" }, { name: "Manteiga", quantity: "180", unit: "g" }] },
  { id: 2, product: "Frango desfiado temperado", yield: "12 porções", prepTime: "35 min", cost: 42.8, active: true, ingredients: [{ name: "Peito de frango", quantity: "2,5", unit: "kg" }, { name: "Cebola roxa", quantity: "300", unit: "g" }, { name: "Requeijão", quantity: "500", unit: "g" }, { name: "Ervas e temperos", quantity: "30", unit: "g" }] },
  { id: 3, product: "Creme de chocolate", yield: "15 porções", prepTime: "20 min", cost: 29.6, active: true, ingredients: [{ name: "Chocolate com avelã", quantity: "700", unit: "g" }, { name: "Creme de leite", quantity: "400", unit: "g" }, { name: "Leite em pó", quantity: "150", unit: "g" }] },
];

const initialMotoboys: Motoboy[] = [
  { id: 1, name: "Lucas Almeida", phone: "(11) 98812-4420", status: "delivering", deliveries: 8 },
  { id: 2, name: "Rafa Santos", phone: "(11) 99704-1189", status: "online", deliveries: 5 },
  { id: 3, name: "Diego Moura", phone: "(11) 99120-7391", status: "offline", deliveries: 3 },
];

const initialPaymentSettings: PaymentSettings = { pix: true, card: true, cashOnDelivery: true, onlineProvider: "Não conectado", onlineEnabled: false, deliveryFeeMode: "fixed" };
const initialDeliverySettings: DeliverySettings = { baseFee: 5, perKm: 1.5, maxRadius: 8, minimumOrder: 25 };
const initialIntegrations: Integration[] = [
  { id: "site", name: "Site J'aime", detail: "Checkout próprio e cardápio online", status: "connected", accent: "integration-site", ordersToday: 18 },
  { id: "ifood", name: "iFood", detail: "Pedidos e status via integração", status: "pending", accent: "integration-ifood", ordersToday: 9 },
  { id: "whatsapp", name: "WhatsApp", detail: "Link de pedido e atendimento", status: "connected", accent: "integration-whatsapp", ordersToday: 6 },
  { id: "delivery-app", name: "Outro marketplace", detail: "Conectar uma nova plataforma", status: "available", accent: "integration-market", ordersToday: 0 },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const normalizeWhatsapp = (value: string) => { const digits = value.replace(/\D/g, ""); return digits.startsWith("55") ? digits : `55${digits}`; };

function Logo({ caption = "retaguarda" }: { caption?: string }) {
  return (
    <div className="brand-lockup" aria-label="J'aime Creperia">
      <img className="brand-logo" src="/assets/original-01.png" alt="" width="56" height="56" />
      <div>
        <div className="brand-name">J’AIME</div>
        <div className="brand-caption">{caption}</div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const meta = statusMeta[status];
  return <span className={`status-pill ${meta.tone}`}><span className="status-dot" />{meta.label}</span>;
}

function StatCard({ label, value, trend, detail, icon: Icon, positive = true }: { label: string; value: string; trend: string; detail: string; icon: typeof DollarSign; positive?: boolean }) {
  return (
    <article className="stat-card">
      <div className="stat-card-top"><span className="stat-label">{label}</span><span className="stat-icon"><Icon size={15} /></span></div>
      <div className="stat-value">{value}</div>
      <div className={`stat-trend ${positive ? "trend-positive" : "trend-negative"}`}>
        {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        <strong>{trend}</strong><span>{detail}</span>
      </div>
    </article>
  );
}

function OrderCard({ order, onAdvance }: { order: Order; onAdvance: (id: string) => void }) {
  const nextIndex = statusOrder.indexOf(order.status) + 1;
  const canAdvance = nextIndex < statusOrder.length;
  return (
    <article className="order-card">
      <div className="order-card-header"><span className="order-id">{order.id}</span><span className="order-time"><Clock3 size={13} /> {order.time}</span></div>
      <div className="order-customer">{order.customer}</div>
      <div className="order-items">{order.items}</div>
      {order.observations && <div className="order-observations"><strong>Observações:</strong> {order.observations}</div>}
      <div className="order-meta"><span>{order.channel}</span><span>{order.payment}</span><strong>{formatCurrency(order.total)}</strong></div>
      {canAdvance ? (
        <button className="advance-button" onClick={() => onAdvance(order.id)}>
          Avançar para {statusMeta[statusOrder[nextIndex]].short}<ChevronRight size={14} />
        </button>
      ) : <div className="completed-line"><Check size={14} /> Pedido finalizado</div>}
    </article>
  );
}

function NewOrderModal({ products, onClose, onCreate }: { products: Product[]; onClose: () => void; onCreate: (customer: string, item: string) => void }) {
  const [customer, setCustomer] = useState("");
  const [item, setItem] = useState("Crepe da Casa");
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-order-title" onMouseDown={event => event.stopPropagation()}>
        <div className="modal-header"><div><span className="eyebrow">entrada manual</span><h2 id="new-order-title">Abrir novo pedido</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
        <label className="field-label">Nome do cliente<input autoFocus value={customer} onChange={event => setCustomer(event.target.value)} placeholder="Ex.: Camila Oliveira" /></label>
        <label className="field-label">Item principal<select value={item} onChange={event => setItem(event.target.value)}>{products.slice(0, 4).map(product => <option key={product.id}>{product.name}</option>)}</select></label>
        <div className="modal-note"><Bell size={16} /> O pedido entrará em <strong>Em análise</strong> para a cozinha confirmar.</div>
        <div className="modal-actions"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => { onCreate(customer.trim() || "Cliente do balcão", item); onClose(); }}>Criar pedido</Button></div>
      </div>
    </div>
  );
}

function SuppliersPage({ stock }: { stock: StockItem[] }) {
  const requestsQuery = trpc.purchasing.requests.useQuery(undefined, {refetchInterval:10000});
  const [editingId,setEditingId] = useState<number|undefined>();
  const [details,setDetails] = useState({cnpj:"",email:"",contact:"",category:"",address:"",paymentTerms:"",notes:"",active:true});
  const suppliersQuery = trpc.purchasing.suppliers.useQuery();
  const utils = trpc.useUtils();
  const createSupplierMutation = trpc.purchasing.createSupplier.useMutation({ onSuccess: () => suppliersQuery.refetch() });
  const createRequestMutation = trpc.purchasing.createRequest.useMutation();
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [selectedStock, setSelectedStock] = useState<number[]>(() => stock.filter(item => item.status === "low").map(item => item.id));
  const [purchaseQuantities, setPurchaseQuantities] = useState<Record<number, string>>(() => Object.fromEntries(stock.map(item => [item.id, Math.max(1, item.minimum - item.current).toFixed(2)])));
  const [request, setRequest] = useState<any>(null);
  const lowStock = stock.filter(item => item.status === "low");
  const suppliers = suppliersQuery.data ?? [];
  const friendlyError = (e: unknown) => e instanceof Error && e.message.includes("Database") ? "O banco de fornecedores não está conectado. Seus dados foram mantidos; tente novamente após configurar a conexão." : e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente.";
  const addSupplier = async () => {
    setError("");
    const phone = whatsapp.replace(/\D/g, "");
    if (name.trim().length < 2 || !/^(?:55)?\d{10,11}$/.test(phone)) { setError("Informe o nome e um WhatsApp válido com DDD."); return; }
    try { await createSupplierMutation.mutateAsync({ ...details,id:editingId,name: name.trim(), whatsapp: phone }); setName(""); setWhatsapp(""); setEditingId(undefined); setDetails({cnpj:"",email:"",contact:"",category:"",address:"",paymentTerms:"",notes:"",active:true}); toast.success("Fornecedor cadastrado"); } catch(e) { setError(friendlyError(e)); }
  };
  const createRequest = async () => {
    setError("");
    const items = stock.filter(item => selectedStock.includes(item.id)).map(item => ({ itemName: item.name, quantity: purchaseQuantities[item.id] || "", unit: item.unit,stockItemId:item.id }));
    if (!selected.length || !items.length) { setError("Selecione ao menos um fornecedor e um item."); return; }
    if (items.some(item => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) { setError("Informe uma quantidade maior que zero para cada item selecionado."); return; }
    try { const result = await createRequestMutation.mutateAsync({ supplierIds: selected, items, notes }); setRequest(result); requestsQuery.refetch(); toast.success("Cotação criada. Os links estão prontos para compartilhar."); } catch(e) { setError(friendlyError(e)); }
  };
  const refreshRequest = async () => { if (request) setRequest(await utils.purchasing.getRequest.fetch({ publicId: request.publicId })); await requestsQuery.refetch(); };
  const awardQuoteMutation = trpc.purchasing.awardQuote.useMutation({ onSuccess: refreshRequest, onError: e => setError(friendlyError(e)) });
  const receiveMutation = trpc.purchasing.receive.useMutation({ onSuccess: refreshRequest, onError: e => setError(friendlyError(e)) });
  const respondedQuotes = (request?.quotes ?? []).filter((quote: any) => quote.status === "responded" || quote.status === "awarded").sort((a: any, b: any) => Number(a.total) - Number(b.total));
  return <><section className="page-intro compact"><div><span className="eyebrow">compras / abastecimento</span><h1>Fornecedores e cotações<span className="accent-dot">.</span></h1><p>Monte sua lista de compras, escolha os fornecedores e acompanhe as propostas.</p></div><Button disabled={createRequestMutation.isPending || !selected.length || !selectedStock.length} onClick={createRequest}><ShoppingBag size={16} /> {createRequestMutation.isPending ? "Criando…" : `Criar cotação · ${selectedStock.length} itens`}</Button></section>{(error || suppliersQuery.error) && <div className="purchasing-error" role="alert">{error || friendlyError(suppliersQuery.error)}</div>}<div className="purchasing-notice">Estoque conectado: selecione os insumos e confira as quantidades. O envio ao fornecedor é feito por você após criar os links.</div><div className="erp-form"><label>Histórico de cotações<select value={request?.publicId??""} onChange={e=>setRequest(requestsQuery.data?.find(r=>r.publicId===e.target.value)??null)}><option value="">Selecione uma cotação</option>{requestsQuery.data?.map(r=><option key={r.id} value={r.publicId}>{r.publicId} · {new Date(r.createdAt).toLocaleDateString("pt-BR")} · {r.status==="received"?"Recebida":r.status==="awarded"?"Fornecedor escolhido":"Em cotação"}</option>)}</select></label></div><div className="supplier-summary"><div><span>Itens abaixo do mínimo</span><strong>{lowStock.length}</strong></div><div><span>Fornecedores ativos</span><strong>{suppliers.length}</strong></div><div><span>Fornecedores selecionados</span><strong>{selected.length}</strong></div></div><div className="supplier-layout"><section className="panel supplier-panel"><div className="panel-heading"><div><span className="eyebrow">cadastro</span><h2>Fornecedores</h2></div><Handshake size={19} /></div><form className="supplier-form" onSubmit={event => { event.preventDefault(); void addSupplier(); }}><label>Nome do fornecedor<input value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Distribuidora Central" maxLength={160} required /></label><label>WhatsApp com DDD<input type="tel" value={whatsapp} onChange={event => setWhatsapp(event.target.value)} placeholder="(35) 99999-9999" required /></label><details className="supplier-details"><summary>Dados comerciais e contato</summary>{([ ["cnpj","CNPJ"],["contact","Pessoa de contato"],["email","E-mail"],["category","Categoria"],["address","Endereço"],["paymentTerms","Condições de pagamento"],["notes","Observações"] ] as const).map(([key,label])=><label key={key}>{label}<input type={key==="email"?"email":"text"} value={details[key]} onChange={e=>setDetails({...details,[key]:e.target.value})}/></label>)}</details><button className="catalog-primary" disabled={createSupplierMutation.isPending}>{createSupplierMutation.isPending ? "Salvando…" : editingId ? "Salvar alterações" : "+ Cadastrar fornecedor"}</button></form><div className="purchase-toolbar"><strong>1. Escolha quem vai cotar</strong><button onClick={() => setSelected(selected.length === suppliers.length ? [] : suppliers.map(s => s.id))}>{selected.length === suppliers.length ? "Limpar seleção" : "Selecionar todos"}</button></div><div className="supplier-list">{suppliers.map(supplier => <label className="supplier-row" key={supplier.id}><input type="checkbox" checked={selected.includes(supplier.id)} onChange={() => setSelected(current => current.includes(supplier.id) ? current.filter(id => id !== supplier.id) : [...current, supplier.id])} /><div><strong>{supplier.name}</strong><span>WhatsApp: +{normalizeWhatsapp(supplier.whatsapp)}</span></div><button type="button" onClick={()=>{setEditingId(supplier.id);setName(supplier.name);setWhatsapp(supplier.whatsapp);setDetails({cnpj:supplier.cnpj,email:supplier.email,contact:supplier.contact,category:supplier.category,address:supplier.address,paymentTerms:supplier.paymentTerms,notes:supplier.notes,active:supplier.active});}}>Editar</button><a href={`https://wa.me/${normalizeWhatsapp(supplier.whatsapp)}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a></label>)}{!suppliers.length && <p className="empty-state">Cadastre o primeiro fornecedor para começar.</p>}</div></section><section className="panel purchase-panel"><div className="panel-heading"><div><span className="eyebrow">cotação inteligente</span><h2>2. Monte a lista de compras</h2></div><Boxes size={19} /></div><label className="purchase-search">Buscar insumo<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome do ingrediente ou embalagem" /></label><div className="purchase-items">{stock.filter(item => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(item => <div className={`purchase-row ${selectedStock.includes(item.id) ? "is-selected" : ""}`} key={item.id}><input type="checkbox" checked={selectedStock.includes(item.id)} onChange={() => setSelectedStock(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])} /><div><strong>{item.name}</strong><span>Disponível: {item.current} {item.unit} · mínimo: {item.minimum} {item.unit}</span></div><label className="purchase-quantity"><span>Quantidade</span><input type="number" min="0.01" step="0.01" value={purchaseQuantities[item.id] ?? ""} disabled={!selectedStock.includes(item.id)} onChange={event => setPurchaseQuantities(current => ({ ...current, [item.id]: event.target.value }))} /><small>{item.unit}</small></label></div>)}</div><label className="purchase-search">Observações para os fornecedores<textarea value={notes} maxLength={2000} onChange={event => setNotes(event.target.value)} placeholder="Marcas preferidas, prazo de entrega e condições de pagamento" /></label>{request && <div className="quote-result"><strong>Cotação {request.publicId}</strong><p>Confira os itens disponíveis antes de escolher. Registrar recebimento adiciona os itens ao estoque.</p>{["localhost","127.0.0.1"].includes(window.location.hostname)&&<p>Os links locais só abrem neste computador. Publique o sistema para receber respostas externas.</p>}<span>Links dos fornecedores (válidos por 7 dias):</span>{request.quotes.map((quote: any) => { const supplier = suppliers.find(item => item.id === quote.supplierId); const link = `${window.location.origin}/cotacao/${quote.token}`; return <a key={quote.id} href={`https://wa.me/${normalizeWhatsapp(supplier?.whatsapp ?? "")}?text=${encodeURIComponent(`Olá ${supplier?.name ?? ""}, preciso de uma cotação. Preencha neste link: ${link}`)}`} target="_blank" rel="noreferrer">Enviar para {supplier?.name ?? "fornecedor"}</a>; })}<div className="purchase-toolbar"><strong>3. Compare as propostas</strong><button onClick={() => { void refreshRequest().catch(e => setError(friendlyError(e))); }}>Atualizar respostas</button></div><PurchaseComparison key={request.publicId} request={request} suppliers={suppliers} onRefresh={refreshRequest}/>{respondedQuotes.length ? respondedQuotes.map((quote: any, index: number) => { const supplier = suppliers.find(item => item.id === quote.supplierId); return <div className="quote-compare" key={quote.id}><span><b>{index === 0 ? "Menor total informado · " : ""}{supplier?.name ?? "Fornecedor"}</b><small>{quote.status === "awarded" ? "Escolhido" : "Proposta recebida"}</small></span><strong>{formatCurrency(Number(quote.total))}</strong><details className="quote-lines"><summary>Ver valores por item</summary>{request.items.map((item:any)=>{const line=quote.items?.find((i:any)=>i.purchaseItemId===item.id);return <p key={item.id}>{item.itemName} · {item.quantity} {item.unit}: {line?.available ? `${formatCurrency(Number(line.unitPrice))} / ${item.unit} · ${formatCurrency(Number(line.unitPrice)*Number(item.quantity))}` : "Indisponível"}</p>;})}<p>Entrega: {quote.deliveryDays??"A combinar"} dias · {quote.paymentMethod??"A combinar"} · prazo {quote.paymentDays??0} dias</p>{quote.notes&&<p>Condições: {quote.notes}</p>}</details></div>; }) : <span>Aguardando os fornecedores preencherem o link.</span>}</div>}</section></div></>;
}
export default function Home({ area = "backoffice" }: { area?: "backoffice" | "pdv" }) {
  const isPOS = area === "pdv";
  const areaSections = sections.filter(section => isPOS ? ["orders", "pos", "delivery", "finance"].includes(section.id) : !["orders", "pos"].includes(section.id));
  const [activeSection, setActiveSection] = useState<Section>(isPOS ? "orders" : "overview");
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>(initialMenu);
  const inventoryQuery = trpc.inventory.list.useQuery(undefined,{refetchInterval:10000});
  const stock:StockItem[]=(inventoryQuery.data??[]).map(i=>({...i,detail:"Estoque real",status:i.current<i.minimum?"low":"ok"}));
  const [productionSheets, setProductionSheets] = useState(initialProductionSheets);
  const [motoboys, setMotoboys] = useState(initialMotoboys);
  const [paymentSettings, setPaymentSettings] = useState(initialPaymentSettings);
  const [deliverySettings, setDeliverySettings] = useState(initialDeliverySettings);
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const syncMenuMutation = trpc.menu.sync.useMutation({ onError: () => toast.error("Cardápio salvo apenas neste navegador. O banco de dados não está disponível.") });
  const menuQuery = trpc.menu.list.useQuery();
  useEffect(() => {
    if (menuQuery.data?.length) {
      const menu = menuQuery.data.map(item => ({ id: item.id, name: item.name, category: item.category as Product["category"], description: item.description, price: Number(item.price), available: item.available === 1, accent: item.accent }));
      setProducts(menu);
    }
  }, [menuQuery.data]);
  const ordersQuery = trpc.orders.list.useQuery(undefined, { refetchInterval: 10_000, staleTime: 5_000 });
  const updateOrderStatusMutation = trpc.orders.updateStatus.useMutation();

  useEffect(() => {
    if (!ordersQuery.data) return;
    setOrders(ordersQuery.data.filter(order => order.status !== "cancelled").map(order => ({
      id: order.publicId,
      customer: order.customerName,
      items: order.items.length ? order.items.map(item => `${item.quantity}x ${item.name}`).join(" · ") : (order.source === "site" ? "Pedido pelo site" : `Pedido via ${sourceLabels[order.source] ?? order.source}`),
      total: Number(order.total),
      status: order.status === "cancelled" ? "analysis" : order.status,
      channel: sourceLabels[order.source] ?? "Delivery",
      time: new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      payment: order.paymentStatus === "paid" ? "Pago" : order.paymentStatus === "cash_on_delivery" ? "Na entrega" : order.paymentStatus === "failed" ? "Falhou" : order.paymentMethod,
      observations: [`Telefone: ${order.phone}`, order.address, order.customerNote, ...order.items.filter(item => item.observations).map(item => `${item.name}: ${item.observations}`)].filter(Boolean).join(" · "),
    })));
  }, [ordersQuery.data]);

  const persistMenu = (items: Product[]) => {
    syncMenuMutation.mutate({ items: items.map(item => ({ name: item.name, slug: item.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), category: item.category, description: item.description, price: item.price.toFixed(2), available: item.available ? 1 : 0, accent: item.accent })) });
  };

  // Opening the dashboard must never overwrite the server catalog with browser data.
  const [storeOpen, setStoreOpen] = useState(true);
  const [orderFilter, setOrderFilter] = useState<"all" | OrderStatus>("all");
  const [search, setSearch] = useState("");
  const [showNewOrder, setShowNewOrder] = useState(false);

  const todayRevenue = useMemo(() => orders.filter(order => order.status === "completed").reduce((sum, order) => sum + order.total, 0), [orders]);
  const activeOrders = orders.filter(order => order.status !== "completed");
  const lowStock = stock.filter(item => item.status === "low");
  const visibleProducts = products.filter(product => `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase()));
  const filteredOrders = orders.filter(order => orderFilter === "all" || order.status === orderFilter);

  const navigate = (section: Section) => {
    if (!isPOS && ["orders","pos"].includes(section)) { window.location.assign("/pdv"); return; }
    setActiveSection(section);
    setSearch("");
  };

  const advanceOrder = (id: string) => {
    const currentOrder = orders.find(order => order.id === id);
    if (!currentOrder) return;
    const nextStatus = statusOrder[Math.min(statusOrder.indexOf(currentOrder.status) + 1, statusOrder.length - 1)];
    setOrders(current => current.map(order => {
      if (order.id !== id) return order;
      toast.success(`${order.id} movido para ${statusMeta[nextStatus].label}`);
      return { ...order, status: nextStatus };
    }));
    updateOrderStatusMutation.mutate({ publicId: id, status: nextStatus }, { onSuccess: () => ordersQuery.refetch(), onError: () => { toast.error("Não foi possível salvar o avanço da comanda"); ordersQuery.refetch(); } });
  };

  const createOrder = (customer: string, item: string) => {
    const nextNumber = 1049 + orders.length - initialOrders.length;
    const selectedProduct = products.find(product => product.name === item);
    setOrders(current => [{ id: `#${nextNumber}`, customer, items: `1 ${item}`, total: selectedProduct?.price ?? 0, status: "analysis", channel: "Balcão", time: "agora", payment: "Pendente", observations: "" }, ...current]);
    toast.info("Pedido de balcão demonstrativo. Para registrar um pedido real, use o cardápio do site.");
  };

  const toggleProduct = (id: number) => {
    setProducts(current => {
      const updated = current.map(product => product.id === id ? { ...product, available: !product.available } : product);
      persistMenu(updated);
      return updated;
    });
    const product = products.find(item => item.id === id);
    if (product) toast.success(`${product.name}: ${product.available ? "pausado" : "disponível"}`);
  };

  const updateProductPrice = (id: number, value: string) => {
    const price = Number(value.replace(",", "."));
    if (!Number.isFinite(price) || price < 0) return;
    const product = products.find(item => item.id === id);
    setProducts(current => {
      const updated = current.map(product => product.id === id ? { ...product, price } : product);
      persistMenu(updated);
      return updated;
    });
    if (product && product.price !== price) toast.success(`${product.name}: preço atualizado no site`);
  };


  const toggleMotoboy = (id: number) => {
    setMotoboys(current => current.map(motoboy => motoboy.id === id ? { ...motoboy, status: motoboy.status === "offline" ? "online" : "offline" } : motoboy));
    const motoboy = motoboys.find(item => item.id === id);
    if (motoboy) toast.success(`${motoboy.name}: ${motoboy.status === "offline" ? "disponível" : "fora de escala"}`);
  };

  const updateDeliverySettings = (field: keyof DeliverySettings, value: string) => {
    const numericValue = Number(value.replace(",", "."));
    if (!Number.isFinite(numericValue) || numericValue < 0) return;
    setDeliverySettings(current => ({ ...current, [field]: numericValue }));
  };

  const togglePayment = (field: "pix" | "card" | "cashOnDelivery") => {
    setPaymentSettings(current => ({ ...current, [field]: !current[field] }));
  };

  const connectIntegration = (id: string) => {
    setIntegrations(current => current.map(integration => integration.id === id ? { ...integration, status: "connected" } : integration));
    const integration = integrations.find(item => item.id === id);
    if (integration) toast.success(`${integration.name} conectado ao quadro de pedidos`);
  };

  return (
    <div className={`crepe-app workspace-shell ${isPOS ? "workspace-pdv" : "workspace-backoffice"}`}>
      <div role="note" className="workspace-status-note">Pedidos e produtos conectados. Estoque conectado. Caixa conectado. Algumas integrações ainda contêm demonstrações.</div>
      <aside className="sidebar">
        <Logo caption={isPOS ? "ponto de venda" : "retaguarda"} />
        <WorkspaceSwitcher isPOS={isPOS} />
        {isPOS && <button className="pdv-new-sale" onClick={() => navigate("pos")}><Plus size={18}/> Nova venda</button>}
        <div className="sidebar-store"><span className={`store-indicator ${storeOpen ? "is-open" : "is-closed"}`} /><div><strong>{storeOpen ? "Loja aberta" : "Loja pausada"}</strong><span>J'aime Creperia</span></div><button className="sidebar-more" aria-label="Mais opções"><MoreHorizontal size={17} /></button></div>
        <nav className="side-nav" aria-label="Navegação principal">
          <div className="nav-section-label">{isPOS ? "Frente de caixa" : "Administração"}</div>
          {areaSections.map(section => { const Icon = section.icon; return <button key={section.id} className={`nav-item ${activeSection === section.id ? "is-active" : ""}`} onClick={() => navigate(section.id)}><Icon size={18}/><span>{section.id === "pos" ? "Venda rápida" : section.label}</span>{section.id === "orders" && <span className="nav-count">{activeOrders.length}</span>}</button>; })}
        </nav>
        <div className="sidebar-bottom workspace-bottom"><a href="/loja" target="_blank" rel="noreferrer"><Store size={18}/> Abrir cardápio</a><span>{isPOS ? "Operação de vendas" : "Administração da J’aime"}</span></div>
      </aside>

      <div className="main-area">
        <header className="topbar workspace-topbar"><div><span className="workspace-kicker">J’AIME CREPERIA</span><h2>{isPOS ? "PDV · Operação" : "Retaguarda"}</h2></div><WorkspaceSwitcher isPOS={isPOS}/></header>
        {isPOS && <div className="pdv-metrics"><div><span>Pedidos carregados</span><strong>{orders.length}</strong></div><div><span>Em andamento</span><strong>{activeOrders.length}</strong></div><div><span>Total dos pedidos</span><strong>{formatCurrency(orders.reduce((sum,o)=>sum+o.total,0))}</strong></div><div><span>Ticket médio</span><strong>{formatCurrency(orders.length ? orders.reduce((sum,o)=>sum+o.total,0)/orders.length : 0)}</strong></div><p>Site e balcão na mesma fila<br/><small>Últimos 200 pedidos · atualização a cada 10s</small></p></div>}


        <nav className="workspace-mobile-nav" aria-label="Seções da área">{areaSections.map(section => <button key={section.id} aria-current={activeSection === section.id ? "page" : undefined} onClick={() => navigate(section.id)}>{section.id === "pos" ? "Venda rápida" : section.label}</button>)}</nav>
        <main className="page-content">
          {activeSection === "overview" && <Overview orders={orders} activeOrders={activeOrders} todayRevenue={todayRevenue} lowStock={lowStock} storeOpen={storeOpen} onNavigate={navigate} onAdvance={advanceOrder} onNewOrder={() => navigate("pos")} />}
          {activeSection === "orders" && <OrdersPage orders={filteredOrders} filter={orderFilter} setFilter={setOrderFilter} onAdvance={advanceOrder} onNewOrder={() => navigate("pos")} />}
          {activeSection === "menu" && <CatalogPOS mode="catalog" />}
          {activeSection === "pos" && <CatalogPOS mode="pos" />}
          {activeSection === "stock" && <Inventory mode="stock" />}
          {activeSection === "production" && <Inventory mode="recipes" />}
          {activeSection === "delivery" && <Logistics />}
          {activeSection === "payments" && <PaymentsPage settings={paymentSettings} onToggle={togglePayment} onProviderChange={provider => setPaymentSettings(current => ({ ...current, onlineProvider: provider, onlineEnabled: provider !== "Não conectado" }))} onToggleOnline={() => setPaymentSettings(current => ({ ...current, onlineEnabled: !current.onlineEnabled }))} />}
          {activeSection === "integrations" && <IntegrationsPage integrations={integrations} onConnect={connectIntegration} />}
          {activeSection === "finance" && <CashFlow />}
          {activeSection === "financial" && <Financial />}
          {activeSection === "batches" && <ProductionBatches />}
          {activeSection === "suppliers" && <SuppliersPage stock={stock} />}
        </main>
      </div>
      {showNewOrder && <NewOrderModal products={products} onClose={() => setShowNewOrder(false)} onCreate={createOrder} />}
    </div>
  );
}

function Overview({ orders, activeOrders, todayRevenue, lowStock, storeOpen, onNavigate, onAdvance, onNewOrder }: { orders: Order[]; activeOrders: Order[]; todayRevenue: number; lowStock: StockItem[]; storeOpen: boolean; onNavigate: (section: Section) => void; onAdvance: (id: string) => void; onNewOrder: () => void }) {
  return <>
    <section className="page-intro"><div><span className="eyebrow">{new Date().toLocaleDateString("pt-BR", {weekday:"long",day:"numeric",month:"long"})}</span><h1>A casa está girando<span className="accent-dot">.</span></h1><p>O pulso da sua operação, em uma tela.</p></div><div className="intro-actions"><span className={`open-badge ${storeOpen ? "" : "paused"}`}><span /> {storeOpen ? "Recebendo pedidos" : "Pedidos pausados"}</span><Button onClick={onNewOrder}><Plus size={16} /> Novo pedido</Button></div></section>
    <section className="hero-strip"><div className="hero-copy"><span className="eyebrow eyebrow-light">agora na cozinha</span><div className="hero-number">{activeOrders.length}<span> pedidos<br />em andamento</span></div><p>Tem coisa boa saindo. Acompanhe o fluxo e mantenha o balcão em movimento.</p></div><div className="hero-orbit"><div className="orbit-ring" /><div className="orbit-center"><span>tempo médio</span><strong>18<span>min</span></strong><small>↓ 4 min hoje</small></div><div className="orbit-tag orbit-tag-one"><Clock3 size={13} /> 18 min</div><div className="orbit-tag orbit-tag-two"><Truck size={13} /> 6 delivery</div></div></section>
    <section className="stat-grid"><StatCard label="Faturamento hoje" value={formatCurrency(todayRevenue)} trend="12,8%" detail="vs. terça-feira" icon={DollarSign} /><StatCard label="Pedidos hoje" value="42" trend="8,4%" detail="vs. terça-feira" icon={ShoppingBag} /><StatCard label="Ticket médio" value="R$ 31,20" trend="3,2%" detail="vs. terça-feira" icon={CreditCard} /><StatCard label="Clientes recorrentes" value="68%" trend="5,1%" detail="este mês" icon={Users} positive={false} /></section>
    <section className="content-grid"><div className="panel orders-panel"><div className="panel-heading"><div><span className="eyebrow">acompanhamento ao vivo</span><h2>Pedidos recentes</h2></div><button className="text-action" onClick={() => onNavigate("orders")}>Ver quadro completo <ArrowUpRight size={15} /></button></div><div className="order-list">{orders.slice(0, 4).map(order => <div className="order-row" key={order.id}><div className="order-row-id">{order.id}</div><div className="order-row-main"><strong>{order.customer}</strong><span>{order.items}</span></div><div className="order-row-channel">{order.channel}</div><StatusPill status={order.status} /><strong className="order-row-total">{formatCurrency(order.total)}</strong></div>)}</div></div><div className="panel attention-panel"><div className="panel-heading"><div><span className="eyebrow">olho vivo</span><h2>Atenção agora</h2></div><button className="circle-link" onClick={() => onNavigate("stock")} aria-label="Ver estoque"><ArrowUpRight size={16} /></button></div><div className="attention-list">{lowStock.slice(0, 3).map(item => <div className="attention-row" key={item.id}><div className="attention-icon"><Boxes size={16} /></div><div><strong>{item.name}</strong><span>{item.current} {item.unit} disponíveis · mínimo {item.minimum}</span></div><button onClick={() => onNavigate("stock")} aria-label={`Ver ${item.name}`}><ChevronRight size={15} /></button></div>)}<div className="attention-footer"><span>{lowStock.length} itens precisam de atenção</span><button onClick={() => onNavigate("stock")}>Abrir estoque <ChevronRight size={14} /></button></div></div></div></section>
    <section className="quick-row"><button onClick={() => onNavigate("menu")}><UtensilsCrossed size={19} /><span><strong>Atualizar cardápio</strong><small>Gerencie itens e preços</small></span><ChevronRight size={16} /></button><button onClick={() => onNavigate("finance")}><Download size={19} /><span><strong>Exportar relatório</strong><small>Fechamento do dia</small></span><ChevronRight size={16} /></button><button onClick={() => onNavigate("orders")}><PackageCheck size={19} /><span><strong>Ver entregas</strong><small>Acompanhe pedidos delivery</small></span><ChevronRight size={16} /></button></section>
  </>;
}

function OrdersPage({ orders, filter, setFilter, onAdvance, onNewOrder }: { orders: Order[]; filter: "all" | OrderStatus; setFilter: (value: "all" | OrderStatus) => void; onAdvance: (id: string) => void; onNewOrder: () => void }) {
  return <><section className="page-intro compact"><div><span className="eyebrow">operação / pedidos</span><h1>Fila de pedidos<span className="accent-dot">.</span></h1><p>Acompanhe os pedidos do site e do balcão por etapa.</p></div><Button onClick={onNewOrder}><Plus size={16} /> Novo pedido</Button></section><div className="filter-bar"><div className="filter-tabs"><button className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>Todos <span>{orders.length}</span></button>{statusOrder.map(status => <button key={status} className={filter === status ? "is-active" : ""} onClick={() => setFilter(status)}>{statusMeta[status].short} <span>{orders.filter(order => order.status === status).length}</span></button>)}</div><div className="live-label"><span className="live-dot" /> Atualizado agora</div></div><div className="kanban-grid">{statusOrder.map(status => <div className="kanban-column" key={status}><div className={`kanban-header ${statusMeta[status].tone}`}><div><span>{statusMeta[status].label}</span><strong>{orders.filter(order => order.status === status).length.toString().padStart(2, "0")}</strong></div><MoreHorizontal size={17} /></div><div className="kanban-cards">{orders.filter(order => order.status === status).map(order => <OrderCard order={order} onAdvance={onAdvance} key={order.id} />)}{orders.filter(order => order.status === status).length === 0 && <div className="empty-column">Nada por aqui</div>}</div></div>)}</div></>;
}

function MenuPage({ products, onToggle, onPriceChange, onNew }: { products: Product[]; onToggle: (id: number) => void; onPriceChange: (id: number, value: string) => void; onNew: () => void }) {
  const [draftPrices, setDraftPrices] = useState<Record<number, string>>({});
  return <><section className="page-intro compact"><div><span className="eyebrow">gestão / cardápio</span><h1>O que vai para a mesa<span className="accent-dot">.</span></h1><p>Edite o preço aqui e ele aparece atualizado no site da J'aime.</p></div><Button onClick={onNew}><Plus size={16} /> Novo item</Button></section><div className="menu-toolbar"><div className="category-pills"><button className="is-active">Todos</button><button>Salgados</button><button>Vegetarianos</button><button>Doces</button><button>Bebidas</button></div><span className="menu-count">{products.length} itens cadastrados · preços sincronizados</span></div><div className="product-list">{products.map(product => { const draft = draftPrices[product.id] ?? product.price.toFixed(2); return <article className="product-row" key={product.id}><div className={`product-thumb ${product.accent}`}><span>{product.name.split(" ").map(word => word[0]).slice(0, 2).join("")}</span></div><div className="product-main"><div className="product-title-line"><h3>{product.name}</h3><span className="category-tag">{product.category}</span></div><p>{product.description}</p></div><label className="product-price-editor"><span>Preço no site</span><div><span>R$</span><input type="number" min="0" step="0.01" value={draft} onChange={event => setDraftPrices(current => ({ ...current, [product.id]: event.target.value }))} onBlur={() => { onPriceChange(product.id, draft); setDraftPrices(current => { const next = { ...current }; delete next[product.id]; return next; }); }} /></div></label><div className="availability"><button className={`availability-toggle ${product.available ? "is-on" : ""}`} onClick={() => onToggle(product.id)} aria-label={`Alternar disponibilidade de ${product.name}`}><span /></button><span>{product.available ? "Disponível" : "Pausado"}</span></div><button className="icon-button row-more" aria-label={`Mais opções para ${product.name}`}><MoreHorizontal size={18} /></button></article>; })}</div></>;
}

function StockPage({ stock, onStockOut, onStockIn }: { stock: StockItem[]; onStockOut: (id: number) => void; onStockIn: (id: number) => void }) {
  return <><section className="page-intro compact"><div><span className="eyebrow">gestão / insumos</span><h1>Estoque sem surpresa<span className="accent-dot">.</span></h1><p>Entradas, baixas, mínimos e alertas para não faltar ingrediente.</p></div><Button variant="outline" onClick={() => onStockIn(stock[0]?.id)}><Plus size={16} /> Entrada de estoque</Button></section><div className="stock-summary"><div><span>Itens monitorados</span><strong>{stock.length}</strong></div><div><span>Precisam de atenção</span><strong>{stock.filter(item => item.status === "low").length}</strong></div><div><span>Última conferência</span><strong>Hoje, 18:20</strong></div></div><div className="panel stock-panel"><div className="stock-table-head"><span>Insumo</span><span>Disponível</span><span>Mínimo</span><span>Status</span><span>Ações</span></div>{stock.map(item => <div className="stock-row" key={item.id}><div className="stock-name"><div className="stock-icon"><Boxes size={17} /></div><div><strong>{item.name}</strong><span>{item.detail}</span></div></div><strong>{item.current} {item.unit}</strong><span>{item.minimum} {item.unit}</span><span className={`stock-status ${item.status}`}>{item.status === "low" ? "Comprar" : "Tudo certo"}</span><div className="stock-actions"><button className="stock-action" onClick={() => onStockIn(item.id)}>Entrada +1</button><button className="stock-action" onClick={() => onStockOut(item.id)}>Baixa -1</button></div></div>)}</div></>;
}

function FinancePage({ revenue }: { revenue: number }) {
  const bars = [38, 52, 44, 68, 62, 79, 91, 76, 88, 72, 84, 96];
  return <><section className="page-intro compact"><div><span className="eyebrow">gestão / financeiro</span><h1>O número da casa<span className="accent-dot">.</span></h1><p>Uma leitura simples para decisões melhores.</p></div><Button variant="outline"><Download size={16} /> Exportar relatório</Button></section><div className="finance-grid"><div className="panel revenue-panel"><div className="panel-heading"><div><span className="eyebrow">últimos 30 dias</span><h2>Faturamento</h2></div><span className="finance-period">30 dias <ChevronRight size={14} /></span></div><div className="revenue-total"><strong>{formatCurrency(revenue * 13.4)}</strong><span className="trend-positive"><ArrowUpRight size={14} /> 18,6% no período</span></div><div className="bar-chart">{bars.map((height, index) => <div className="bar-group" key={index}><div className="bar" style={{ height: `${height}%` }} /><span>{["22", "24", "26", "28", "30", "02", "04", "06", "08", "10", "12", "14"][index]}</span></div>)}</div></div><div className="panel breakdown-panel"><div className="panel-heading"><div><span className="eyebrow">hoje</span><h2>Por canal</h2></div><MoreHorizontal size={18} /></div><div className="breakdown-item"><div className="breakdown-label"><span className="breakdown-dot yellow" /><span>Delivery</span><strong>48%</strong></div><div className="progress-line"><span style={{ width: "48%" }} /></div></div><div className="breakdown-item"><div className="breakdown-label"><span className="breakdown-dot orange" /><span>Balcão</span><strong>32%</strong></div><div className="progress-line"><span style={{ width: "32%" }} /></div></div><div className="breakdown-item"><div className="breakdown-label"><span className="breakdown-dot dark" /><span>Retirada</span><strong>20%</strong></div><div className="progress-line"><span style={{ width: "20%" }} /></div></div><div className="breakdown-footer"><span>Ticket médio</span><strong>R$ 31,20</strong></div></div></div><div className="finance-footnote"><Store size={16} /> Os valores exibidos são uma visão operacional e podem ser conciliados no fechamento do dia.</div></>;
}


function ProductionPage({ sheets, onToggle, onNew }: { sheets: ProductionSheet[]; onToggle: (id: number) => void; onNew: () => void }) {
  return <><section className="page-intro compact"><div><span className="eyebrow">produção / padronização</span><h1>Fichas que protegem o sabor<span className="accent-dot">.</span></h1><p>Ingredientes, rendimento, tempo e custo para a equipe produzir sempre igual.</p></div><Button onClick={onNew}><Plus size={16} /> Nova ficha</Button></section><div className="production-summary"><div><span>Fichas ativas</span><strong>{sheets.filter(sheet => sheet.active).length}</strong></div><div><span>Custo médio por ficha</span><strong>{formatCurrency(sheets.reduce((sum, sheet) => sum + sheet.cost, 0) / sheets.length)}</strong></div><div><span>Última revisão</span><strong>Hoje, 09:30</strong></div></div><div className="production-grid">{sheets.map(sheet => <article className="panel production-card" key={sheet.id}><div className="production-card-head"><div><span className="eyebrow">ficha #{String(sheet.id).padStart(2, "0")}</span><h2>{sheet.product}</h2></div><button className={`sheet-status ${sheet.active ? "is-active" : ""}`} onClick={() => onToggle(sheet.id)}>{sheet.active ? "Ativa" : "Pausada"}</button></div><div className="production-meta"><span><strong>Rendimento</strong>{sheet.yield}</span><span><strong>Preparo</strong>{sheet.prepTime}</span><span><strong>Custo estimado</strong>{formatCurrency(sheet.cost)}</span></div><div className="ingredient-list"><div className="ingredient-head"><span>Ingrediente</span><span>Quantidade</span></div>{sheet.ingredients.map(ingredient => <div className="ingredient-row" key={ingredient.name}><span>{ingredient.name}</span><strong>{ingredient.quantity} {ingredient.unit}</strong></div>)}</div><button className="sheet-edit" onClick={() => toast(`Editando ficha de ${sheet.product}`)}><Settings size={14} /> Editar ficha e modo de preparo <ChevronRight size={14} /></button></article>)}</div></>;
}

function DeliveryPage({ motoboys, settings, onToggleMotoboy, onUpdateSettings }: { motoboys: Motoboy[]; settings: DeliverySettings; onToggleMotoboy: (id: number) => void; onUpdateSettings: (field: keyof DeliverySettings, value: string) => void }) {
  const onlineCount = motoboys.filter(motoboy => motoboy.status !== "offline").length;
  return <><section className="page-intro compact"><div><span className="eyebrow">logística / última milha</span><h1>Entrega no ritmo da casa<span className="accent-dot">.</span></h1><p>Controle motoboys, raio de atendimento e taxa antes do pedido sair.</p></div><Button onClick={() => toast("Convite de motoboy copiado") }><Plus size={16} /> Cadastrar motoboy</Button></section><div className="delivery-grid"><section className="panel settings-panel"><div className="panel-heading"><div><span className="eyebrow">regras de entrega</span><h2>Taxas e área</h2></div><Truck size={19} /></div><div className="settings-fields"><label className="field-label">Taxa base (R$)<input type="number" min="0" step="0.50" value={settings.baseFee} onChange={event => onUpdateSettings("baseFee", event.target.value)} /></label><label className="field-label">Valor por km (R$)<input type="number" min="0" step="0.10" value={settings.perKm} onChange={event => onUpdateSettings("perKm", event.target.value)} /></label><label className="field-label">Raio máximo (km)<input type="number" min="1" step="1" value={settings.maxRadius} onChange={event => onUpdateSettings("maxRadius", event.target.value)} /></label><label className="field-label">Pedido mínimo (R$)<input type="number" min="0" step="1" value={settings.minimumOrder} onChange={event => onUpdateSettings("minimumOrder", event.target.value)} /></label></div><div className="fee-preview"><span>Exemplo para 4 km</span><strong>{formatCurrency(settings.baseFee + settings.perKm * 4)}</strong><small>calculado automaticamente no checkout</small></div></section><section className="panel motoboy-panel"><div className="panel-heading"><div><span className="eyebrow">equipe de rua</span><h2>Motoboys <span className="heading-count">{onlineCount} online</span></h2></div><Bike size={19} /></div><div className="motoboy-list">{motoboys.map(motoboy => <div className="motoboy-row" key={motoboy.id}><div className="motoboy-avatar">{motoboy.name.split(" ").map(part => part[0]).join("")}</div><div className="motoboy-copy"><strong>{motoboy.name}</strong><span>{motoboy.phone} · {motoboy.deliveries} entregas hoje</span></div><span className={`motoboy-status ${motoboy.status}`}><i />{motoboy.status === "delivering" ? "Em rota" : motoboy.status === "online" ? "Disponível" : "Fora de escala"}</span><button className="stock-action" onClick={() => onToggleMotoboy(motoboy.id)}>{motoboy.status === "offline" ? "Colocar online" : "Pausar"}</button></div>)}</div></section></div><div className="delivery-note"><Bike size={16} /> A taxa configurada alimenta o checkout do site e deve ser confirmada pelo motoboy no fechamento da entrega.</div></>;
}

function PaymentsPage({ settings, onToggle, onProviderChange, onToggleOnline }: { settings: PaymentSettings; onToggle: (field: "pix" | "card" | "cashOnDelivery") => void; onProviderChange: (provider: PaymentSettings["onlineProvider"]) => void; onToggleOnline: () => void }) {
  return <><section className="page-intro compact"><div><span className="eyebrow">configuração / recebimentos</span><h1>Receba do seu jeito<span className="accent-dot">.</span></h1><p>Escolha como o cliente paga pelo site, na retirada ou na entrega.</p></div><Button variant="outline" onClick={() => toast("Configurações salvas neste dispositivo")}><Check size={16} /> Salvar configuração</Button></section><div className="payments-grid"><section className="panel payment-methods"><div className="panel-heading"><div><span className="eyebrow">meios aceitos</span><h2>Na operação</h2></div><WalletCards size={19} /></div><PaymentToggle label="Pix" detail="Confirmação rápida pelo site" active={settings.pix} onClick={() => onToggle("pix")} /><PaymentToggle label="Cartão" detail="Pagamento online ou na maquininha" active={settings.card} onClick={() => onToggle("card")} /><PaymentToggle label="Dinheiro na entrega" detail="Motoboy confirma no fechamento" active={settings.cashOnDelivery} onClick={() => onToggle("cashOnDelivery")} /></section><section className="panel online-payment-card"><div className="panel-heading"><div><span className="eyebrow">checkout do site</span><h2>Pagamento online</h2></div><CreditCard size={19} /></div><label className="field-label">Provedor<select value={settings.onlineProvider} onChange={event => onProviderChange(event.target.value as PaymentSettings["onlineProvider"])}><option>Não conectado</option><option>Stripe</option><option>Mercado Pago</option></select></label><div className={`connection-banner ${settings.onlineEnabled ? "connected" : "pending"}`}><span className="connection-dot" /><div><strong>{settings.onlineEnabled ? `${settings.onlineProvider} selecionado` : "Ainda não conectado"}</strong><span>{settings.onlineEnabled ? "Checkout pronto para receber a configuração de credenciais." : "Selecione um provedor para habilitar o fluxo online."}</span></div></div><button className={`online-toggle ${settings.onlineEnabled ? "is-on" : ""}`} onClick={onToggleOnline}><span /><strong>{settings.onlineEnabled ? "Ativo no site" : "Ativar depois da conexão"}</strong></button><p className="payment-warning">As chaves secretas e webhooks devem ser configurados com segurança antes de publicar. Nunca coloque cartão, CVV ou chave privada no navegador.</p></section></div><div className="payment-flow"><span>Site</span><ChevronRight size={14} /><strong>Checkout</strong><ChevronRight size={14} /><span>Provedor</span><ChevronRight size={14} /><span>Confirmação</span><ChevronRight size={14} /><span>Pedido na cozinha</span></div></>;
}

function PaymentToggle({ label, detail, active, onClick }: { label: string; detail: string; active: boolean; onClick: () => void }) {
  return <button className={`payment-toggle ${active ? "is-active" : ""}`} onClick={onClick}><span><strong>{label}</strong><small>{detail}</small></span><span className="toggle-track"><span /></span></button>;
}


function IntegrationsPage({ integrations, onConnect }: { integrations: Integration[]; onConnect: (id: string) => void }) {
  const connected = integrations.filter(integration => integration.status === "connected");
  return <><section className="page-intro compact"><div><span className="eyebrow">canais / pedidos externos</span><h1>Uma fila, todos os pedidos<span className="accent-dot">.</span></h1><p>Receba pedidos do site, iFood, WhatsApp e outros marketplaces no mesmo fluxo da cozinha.</p></div><Button onClick={() => toast("Escolha uma plataforma para conectar")}><Plus size={16} /> Adicionar canal</Button></section><div className="integration-summary"><div><span>Canais conectados</span><strong>{connected.length}</strong></div><div><span>Pedidos externos hoje</span><strong>{integrations.reduce((sum, integration) => sum + integration.ordersToday, 0)}</strong></div><div><span>Destino dos pedidos</span><strong>Fila da cozinha</strong></div></div><div className="integration-grid">{integrations.map(integration => <article className="panel integration-card" key={integration.id}><div className={`integration-logo ${integration.accent}`}>{integration.name === "iFood" ? "iF" : integration.name === "WhatsApp" ? "WA" : integration.name === "Site J'aime" ? "J" : "+"}</div><div className="integration-copy"><div className="integration-title"><h2>{integration.name}</h2><span className={`integration-status ${integration.status}`}><i />{integration.status === "connected" ? "Conectado" : integration.status === "pending" ? "Aguardando conexão" : "Disponível"}</span></div><p>{integration.detail}</p><strong>{integration.ordersToday ? `${integration.ordersToday} pedidos hoje` : "Ainda sem pedidos"}</strong></div><button className="integration-action" onClick={() => integration.status === "connected" ? toast(`${integration.name}: configurações abertas`) : onConnect(integration.id)}>{integration.status === "connected" ? "Configurar" : "Conectar"}<ChevronRight size={15} /></button></article>)}</div><div className="integration-flow"><span>iFood</span><span>WhatsApp</span><span>Site</span><span>Marketplace</span><strong>→ fila unificada da cozinha</strong></div></>;
}




function WorkspaceSwitcher({isPOS}:{isPOS:boolean}) {
 return <details className="workspace-switcher"><summary>{isPOS ? 'J’aime PDV' : 'J’aime Retaguarda'} <span>⇄</span></summary><nav aria-label="Alternar área"><a href="/pdv" aria-current={isPOS?'page':undefined}><strong>PDV</strong><small>Vendas e acompanhamento de pedidos</small></a><a href="/gestao" aria-current={!isPOS?'page':undefined}><strong>Retaguarda</strong><small>Produtos, cadastros e administração</small></a><a href="/loja"><strong>Cardápio</strong><small>Experiência do cliente</small></a></nav></details>;
}
