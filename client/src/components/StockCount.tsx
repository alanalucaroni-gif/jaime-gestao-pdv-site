import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

export default function StockCount() {
  const utils = trpc.useUtils();
  const [csv, setCsv] = useState(""),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const preview = trpc.stockCount.preview.useMutation({
    onError: e => setMessage(e.message),
  });
  const apply = trpc.stockCount.import.useMutation({
    onSuccess: result => {
      setMessage(
        `Contagem #${result.id} registrada. ${result.rows.length} insumo(s) conferido(s).`
      );
      setCsv("");
      preview.reset();
      requestId.current = crypto.randomUUID();
      void utils.inventory.invalidate();
    },
    onError: e => setMessage(e.message),
  });
  const busy = preview.isPending || apply.isPending;
  async function download() {
    try {
      const content = await utils.stockCount.export.fetch();
      const url = URL.createObjectURL(
        new Blob([content], { type: "text/csv;charset=utf-8" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "contagem-estoque.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function read(file?: File) {
    if (!file) return;
    setMessage("");
    preview.reset();
    if (file.size > 500_000) {
      setMessage("Use um CSV de até 500 KB.");
      return;
    }
    const content = await file.text();
    setCsv(content);
    requestId.current = crypto.randomUUID();
  }
  return (
    <details className="panel stock-count-panel">
      <summary>Contagem de estoque por CSV</summary>
      <p>
        Exporte o modelo, preencha somente a coluna <strong>contagem</strong> e
        importe para conferir. Linhas sem contagem são ignoradas. Use vírgula ou
        ponto decimal, sem separador de milhar.
      </p>
      <p>
        Se uma venda ou entrada mudar o saldo após a exportação, a conferência
        será bloqueada para evitar sobrescrever a movimentação.
      </p>
      <div className="backoffice-actions">
        <button type="button" onClick={download} disabled={busy}>
          Exportar modelo CSV
        </button>
        <label>
          Importar contagem
          <input
            aria-label="Arquivo de contagem CSV"
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={e => {
              void read(e.target.files?.[0]);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <button
          disabled={!csv || busy}
          onClick={() => {
            setMessage("");
            preview.mutate({ csv });
          }}
        >
          Conferir arquivo
        </button>
      </div>
      {preview.data && (
        <>
          <div className="backoffice-table-wrap">
            <table>
              <caption>Prévia da contagem — ainda não aplicada</caption>
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Saldo base</th>
                  <th>Contado</th>
                  <th>Diferença</th>
                </tr>
              </thead>
              <tbody>
                {preview.data.map(r => (
                  <tr key={r.stockId}>
                    <td>
                      {r.name} ({r.unit})
                    </td>
                    <td>{r.previous}</td>
                    <td>{r.counted}</td>
                    <td>
                      {r.delta > 0 ? "+" : ""}
                      {r.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form
            className="erp-form"
            onSubmit={e => {
              e.preventDefault();
              apply.mutate({ csv, reason, requestId: requestId.current });
            }}
          >
            <label>
              Motivo da contagem
              <input
                required
                minLength={3}
                maxLength={300}
                value={reason}
                disabled={busy}
                onChange={e => setReason(e.target.value)}
              />
            </label>
            <button disabled={busy || reason.trim().length < 3}>
              {apply.isPending ? "Aplicando…" : "Confirmar e aplicar contagem"}
            </button>
          </form>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </details>
  );
}
