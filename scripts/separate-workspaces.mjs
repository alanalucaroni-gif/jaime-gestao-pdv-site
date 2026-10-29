import fs from 'node:fs';
const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('client/src/App.tsx',s=>s.replace('<Route path={"/gestao"} component={Home} />','<Route path={"/gestao"}><Home key="backoffice" area="backoffice" /></Route>\n      <Route path={"/pdv"}><Home key="pdv" area="pdv" /></Route>'));
edit('server/_core/index.ts',s=>s.replace('app.use("/gestao", adminAccess);','app.use("/gestao", adminAccess);\n  app.use("/pdv", adminAccess);'));
edit('client/src/pages/Home.tsx',s=>{
 s=s.replace('export default function Home() {','export default function Home({ area = "backoffice" }: { area?: "backoffice" | "pdv" }) {\n  const isPOS = area === "pdv";\n  const areaSections = sections.filter(section => isPOS ? ["orders", "pos"].includes(section.id) : !["orders", "pos"].includes(section.id));');
 s=s.replace('useState<Section>("overview")','useState<Section>(isPOS ? "orders" : "overview")');
 s=s.replace('    setActiveSection(section);','    if (!isPOS && ["orders","pos"].includes(section)) { window.location.assign("/pdv"); return; }\n    setActiveSection(section);');
 s=s.replace('<div className="crepe-app">','<div className={`crepe-app workspace-shell ${isPOS ? "workspace-pdv" : "workspace-backoffice"}`}>');
 s=s.replace('<Logo />\n        <div className="sidebar-store">','<Logo />\n        <WorkspaceSwitcher isPOS={isPOS} />\n        {isPOS && <button className="pdv-new-sale" onClick={() => navigate("pos")}><Plus size={18}/> Nova venda</button>}\n        <div className="sidebar-store">');
 const start=s.indexOf('          <div className="nav-section-label">Operação</div>');const end=s.indexOf('        </nav>',start);
 s=s.slice(0,start)+`          <div className="nav-section-label">{isPOS ? "Frente de caixa" : "Administração"}</div>
          {areaSections.map(section => { const Icon = section.icon; return <button key={section.id} className={\`nav-item \${activeSection === section.id ? "is-active" : ""}\`} onClick={() => navigate(section.id)}><Icon size={18}/><span>{section.id === "pos" ? "Venda rápida" : section.label}</span>{section.id === "orders" && <span className="nav-count">{activeOrders.length}</span>}</button>; })}
`+s.slice(end);
 const bs=s.indexOf('        <div className="sidebar-bottom">');const be=s.indexOf('\n      </aside>',bs);
 s=s.slice(0,bs)+'        <div className="sidebar-bottom workspace-bottom"><a href="/loja" target="_blank" rel="noreferrer"><Store size={18}/> Abrir cardápio</a><span>{isPOS ? "Operação de vendas" : "Administração da J’aime"}</span></div>'+s.slice(be);
 const hs=s.indexOf('        <header className="topbar">');const he=s.indexOf('\n\n        <main',hs);
 s=s.slice(0,hs)+`        <header className="topbar workspace-topbar"><div><span className="workspace-kicker">J’AIME CREPERIA</span><h2>{isPOS ? "PDV · Operação" : "Retaguarda"}</h2></div><WorkspaceSwitcher isPOS={isPOS}/></header>
        {isPOS && <div className="pdv-metrics"><div><span>Pedidos carregados</span><strong>{orders.length}</strong></div><div><span>Em andamento</span><strong>{activeOrders.length}</strong></div><div><span>Total dos pedidos</span><strong>{formatCurrency(orders.reduce((sum,o)=>sum+o.total,0))}</strong></div><div><span>Ticket médio</span><strong>{formatCurrency(orders.length ? orders.reduce((sum,o)=>sum+o.total,0)/orders.length : 0)}</strong></div><p>Site e balcão na mesma fila<br/><small>Últimos 200 pedidos · atualização a cada 10s</small></p></div>}
`+s.slice(he);
 s=s.replace('Arraste o olhar. Avance cada pedido no tempo certo.','Acompanhe os pedidos do site e do balcão por etapa.');
 s=s.replace('Pedidos do site e cardápio conectados. Estoque, financeiro, motoboys e integrações ainda contêm demonstrações.', 'Pedidos e produtos conectados. Módulos administrativos de estoque, financeiro e integrações ainda contêm demonstrações.');
 return s;
});
