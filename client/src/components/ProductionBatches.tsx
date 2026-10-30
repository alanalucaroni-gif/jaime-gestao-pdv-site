import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const newRecipe = () => ({
  id: undefined as number | undefined,
  name: "",
  outputStockId: 0,
  yieldQuantity: 1,
  instructions: "",
  active: true,
  lines: [{ stockId: 0, quantity: 0, lossPercent: 0 }],
});
export default function ProductionBatches() {
  const utils = trpc.useUtils(),
    stock = trpc.inventory.list.useQuery();
  const recipes = trpc.production.recipes.useQuery(),
    batches = trpc.production.batches.useQuery();
  const [draft, setDraft] = useState(newRecipe),
    [editing, setEditing] = useState(false),
    [message, setMessage] = useState("");
  const [recipeId, setRecipeId] = useState(0),
    [quantity, setQuantity] = useState(1),
    [note, setNote] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const preview = trpc.production.preview.useQuery(
    { recipeId, quantity },
    {
      enabled: recipeId > 0 && quantity > 0 && quantity <= 100000,
      retry: false,
    }
  );
  const fail = (e: { message: string }) => setMessage(e.message);
  const save = trpc.production.saveRecipe.useMutation({
    onError: fail,
    onSuccess: () => {
      setEditing(false);
      setMessage("Receita salva.");
      void utils.production.recipes.invalidate();
      void utils.production.preview.invalidate();
    },
  });
  const produce = trpc.production.produce.useMutation({
    onError: fail,
    onSuccess: b => {
      setMessage(
        `Lote #${b.id} registrado: ${b.output.quantity} ${b.output.unit} de ${b.output.name}.`
      );
      requestId.current = crypto.randomUUID();
      setRecipeId(0);
      setNote("");
      void utils.production.invalidate();
      void utils.inventory.invalidate();
    },
  });
  const stockName = (id: number) => stock.data?.find(i => i.id === id);
  const changeLine = (
    n: number,
    patch: Partial<(typeof draft.lines)[number]>
  ) =>
    setDraft(d => ({
      ...d,
      lines: d.lines.map((l, i) => (n === i ? { ...l, ...patch } : l)),
    }));
  return (
    <section className="erp-page backoffice-page">
      <span className="eyebrow">PRODUÇÃO / LOTES</span>
      <div className="purchase-toolbar">
        <div>
          <h1>Da receita ao estoque.</h1>
          <p>
            Transforme ingredientes em insumos prontos, com consumo e rendimento
            registrados no mesmo lote.
          </p>
        </div>
        <button
          onClick={() => {
            setDraft(newRecipe());
            setMessage("");
            setEditing(true);
          }}
        >
          Nova receita de produção
        </button>
      </div>
      <p className="backoffice-notice">
        Esta receita produz um insumo, como massa pronta. Na ficha de composição
        da venda, use esse insumo para consumir o que foi produzido.
      </p>
      {message && <p role="status">{message}</p>}
      {(stock.error || recipes.error || batches.error) && (
        <p role="alert">
          Não foi possível carregar a produção. Atualize a página.
        </p>
      )}
      <div className="backoffice-split">
        <section className="panel backoffice-card">
          <h2>Receitas cadastradas</h2>
          {recipes.isLoading ? (
            <p>Carregando…</p>
          ) : !recipes.data?.length ? (
            <p>Cadastre uma receita com seus ingredientes e rendimento real.</p>
          ) : (
            recipes.data.map(r => (
              <article className="backoffice-list-row" key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <p>
                    {r.yieldQuantity} {stockName(r.outputStockId)?.unit} de{" "}
                    {stockName(r.outputStockId)?.name} ·{" "}
                    {r.active ? "Ativa" : "Pausada"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setDraft({ ...r, lines: r.lines.map(l => ({ ...l })) });
                    setMessage("");
                    setEditing(true);
                  }}
                >
                  Editar
                </button>
              </article>
            ))
          )}
        </section>
        <section className="panel backoffice-card">
          <h2>Registrar produção</h2>
          <form
            className="erp-form"
            onSubmit={e => {
              e.preventDefault();
              setMessage("");
              produce.mutate({
                requestId: requestId.current,
                recipeId,
                quantity,
                note,
              });
            }}
          >
            <label>
              Receita
              <select
                required
                disabled={produce.isPending}
                value={recipeId || ""}
                onChange={e => {
                  setRecipeId(Number(e.target.value));
                  requestId.current = crypto.randomUUID();
                  setMessage("");
                }}
              >
                <option value="">Selecione</option>
                {recipes.data
                  ?.filter(r => r.active)
                  .map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Quantidade produzida{" "}
              {recipeId
                ? `(${stockName(recipes.data?.find(r => r.id === recipeId)?.outputStockId ?? 0)?.unit ?? ""})`
                : ""}
              <input
                required
                disabled={produce.isPending}
                type="number"
                min="0.000001"
                max="100000"
                step="0.000001"
                value={quantity}
                onChange={e => {
                  setQuantity(Number(e.target.value));
                  requestId.current = crypto.randomUUID();
                }}
              />
            </label>
            <label>
              Observação do lote
              <input
                disabled={produce.isPending}
                maxLength={500}
                value={note}
                onChange={e => {
                  setNote(e.target.value);
                  requestId.current = crypto.randomUUID();
                }}
              />
            </label>
            {preview.error && <p role="alert">{preview.error.message}</p>}
            {preview.data && (
              <div>
                <h3>Consumo previsto</h3>
                {preview.data.consumed.map(l => (
                  <p key={l.stockId}>
                    {l.name}:{" "}
                    <strong>
                      {l.quantity} {l.unit}
                    </strong>{" "}
                    · disponível {l.current} {l.unit}{" "}
                    {!l.sufficient && (
                      <span className="backoffice-danger">— insuficiente</span>
                    )}
                  </p>
                ))}
                {preview.data.recipe.instructions && (
                  <p>Modo de preparo: {preview.data.recipe.instructions}</p>
                )}
              </div>
            )}
            <button
              disabled={
                produce.isPending ||
                preview.isFetching ||
                !preview.data ||
                preview.data.consumed.some(l => !l.sufficient)
              }
            >
              {produce.isPending
                ? "Registrando…"
                : "Confirmar produção e movimentar estoque"}
            </button>
          </form>
        </section>
      </div>
      <section className="panel backoffice-card">
        <h2>Histórico de lotes</h2>
        <div className="backoffice-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lote</th>
                <th>Data</th>
                <th>Receita</th>
                <th>Produzido</th>
                <th>Insumos consumidos</th>
              </tr>
            </thead>
            <tbody>
              {batches.data?.map(b => (
                <tr key={b.id}>
                  <td>#{b.id}</td>
                  <td>
                    {new Date(b.createdAt).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </td>
                  <td>
                    {b.recipe.name}
                    {b.note && <p>{b.note}</p>}
                  </td>
                  <td>
                    {b.output.quantity} {b.output.unit} · {b.output.name}
                  </td>
                  <td>
                    {b.consumed.map(l => (
                      <p key={l.stockId}>
                        {l.name}: {l.quantity} {l.unit}
                      </p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!batches.data?.length && <p>Nenhuma produção registrada.</p>}
        </div>
      </section>
      <Dialog
        open={editing}
        onOpenChange={open => {
          if (!save.isPending) setEditing(open);
        }}
      >
        <DialogContent className="inventory-dialog">
          <DialogHeader>
            <DialogTitle>
              {draft.id
                ? "Editar receita de produção"
                : "Nova receita de produção"}
            </DialogTitle>
            <DialogDescription>
              Informe o consumo líquido para o rendimento total. Perda de 10%
              exige consumo bruto igual ao líquido dividido por 0,90.
            </DialogDescription>
          </DialogHeader>
          <form
            className="erp-form"
            onSubmit={e => {
              e.preventDefault();
              setMessage("");
              save.mutate(draft);
            }}
          >
            <label>
              Nome da receita
              <input
                required
                minLength={2}
                maxLength={160}
                value={draft.name}
                onChange={e => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Insumo produzido
              <select
                required
                value={draft.outputStockId || ""}
                onChange={e =>
                  setDraft({ ...draft, outputStockId: Number(e.target.value) })
                }
              >
                <option value="">Selecione</option>
                {stock.data?.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.unit})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rendimento total (
              {stockName(draft.outputStockId)?.unit ?? "unidade do insumo"})
              <input
                required
                type="number"
                min="0.000001"
                max="100000"
                step="0.000001"
                value={draft.yieldQuantity}
                onChange={e =>
                  setDraft({ ...draft, yieldQuantity: Number(e.target.value) })
                }
              />
            </label>
            {draft.lines.map((l, n) => (
              <fieldset className="backoffice-fieldset" key={n}>
                <legend>Ingrediente {n + 1}</legend>
                <label>
                  Insumo
                  <select
                    required
                    value={l.stockId || ""}
                    onChange={e =>
                      changeLine(n, { stockId: Number(e.target.value) })
                    }
                  >
                    <option value="">Selecione</option>
                    {stock.data
                      ?.filter(i => i.id !== draft.outputStockId)
                      .map(i => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.unit})
                        </option>
                      ))}
                  </select>
                </label>
                <div className="editor-row">
                  <label>
                    Quantidade líquida (
                    {stockName(l.stockId)?.unit ?? "unidade"})
                    <input
                      required
                      type="number"
                      min="0.000001"
                      max="100000"
                      step="0.000001"
                      value={l.quantity || ""}
                      onChange={e =>
                        changeLine(n, { quantity: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Perda (%)
                    <input
                      required
                      type="number"
                      min="0"
                      max="99"
                      step="0.01"
                      value={l.lossPercent}
                      onChange={e =>
                        changeLine(n, { lossPercent: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={draft.lines.length === 1}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      lines: draft.lines.filter((_, i) => n !== i),
                    })
                  }
                >
                  Remover ingrediente
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              disabled={draft.lines.length >= 100}
              onClick={() =>
                setDraft({
                  ...draft,
                  lines: [
                    ...draft.lines,
                    { stockId: 0, quantity: 0, lossPercent: 0 },
                  ],
                })
              }
            >
              Adicionar ingrediente
            </button>
            <label>
              Modo de preparo
              <textarea
                maxLength={10000}
                value={draft.instructions}
                onChange={e =>
                  setDraft({ ...draft, instructions: e.target.value })
                }
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.active}
                onChange={e => setDraft({ ...draft, active: e.target.checked })}
              />{" "}
              Receita ativa
            </label>
            {save.error && <p role="alert">{save.error.message}</p>}
            <button disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar receita"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
