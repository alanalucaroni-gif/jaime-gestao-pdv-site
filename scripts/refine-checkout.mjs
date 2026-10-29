import fs from 'node:fs';
const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('client/src/pages/Storefront.tsx',s=>{
 s=s.replace('const [cart, setCart] = useState<CartLine[]>([]);','const [cart, setCart] = useState<CartLine[]>(() => { try { const saved = JSON.parse(sessionStorage.getItem("jaime-cart") || "[]"); return Array.isArray(saved) ? saved.filter(x => Number.isInteger(x.quantity) && x.quantity > 0 && Number.isFinite(x.price)) : []; } catch { return []; } });\n  useEffect(() => { try { sessionStorage.setItem("jaime-cart", JSON.stringify(cart)); } catch {} }, [cart]);');
 s=s.replace('staleTime: 30_000','staleTime: 5_000, refetchInterval: 15_000');
 s=s.replace('  useEffect(() => { const sync = () => setProducts(loadMenu()); window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync); }, []);','');
 return s;
});
edit('client/src/components/DirectCheckout.tsx',s=>s.replace("{['completed','cancelled'].includes(order.status) &&", "{(order.paymentMethod === 'offline' || ['paid','refunded','charged_back'].includes(order.paymentStatus) || ['completed','cancelled'].includes(order.status)) &&").replace('localStorage.removeItem(\'jaime-active-order\'); onClose();','localStorage.removeItem(\'jaime-active-order\'); setOrder(undefined); setToken(\'\'); requestId.current = crypto.randomUUID();').replace('Encerrar acompanhamento','Fazer outro pedido'));
edit('client/src/pages/Home.tsx',s=>s.replace('<div className="crepe-app">','<div className="crepe-app">\n      <div role="note" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:60,background:"#011f41",color:"white",padding:"8px 16px",fontSize:12}}>Pedidos do site e cardápio conectados. Estoque, financeiro, motoboys e integrações ainda contêm demonstrações.</div>'));
edit('.gitignore',s=>s+'\n# Dados privados de pedidos\ndata/\n*.sqlite-wal\n*.sqlite-shm\n');
edit('.dockerignore',s=>s+'\ndata\n.env*\n.manus-logs\n');
edit('package.json',s=>{const p=JSON.parse(s);p.engines={node:'>=22.13.0'};return JSON.stringify(p,null,2)+'\n';});
