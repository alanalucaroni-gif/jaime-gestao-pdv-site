import crypto from "node:crypto";
import { z } from "zod";
import {
  countHeaders,
  countNumber,
  parseCountCsv,
  writeCountCsv,
} from "../shared/stock-count-csv";
import { stockList, moveStock } from "./inventory";
import { records, put, nextId } from "./erp-store";
import { transaction } from "./backoffice-common";
export const stockCountInput = z.object({
  csv: z.string().min(1).max(500_000),
});
export function exportStockCount() {
  return writeCountCsv(
    stockList().map(i => [i.id, i.name, i.unit, i.current, ""])
  );
}
export function previewStockCount(raw: unknown) {
  const { csv } = stockCountInput.parse(raw),
    [header, ...data] = parseCountCsv(csv);
  if (!header || header.join(";") !== countHeaders.join(";"))
    throw new Error("Cabeçalho inválido. Use o modelo exportado.");
  if (!data.length || data.length > 1000)
    throw new Error("Importe entre 1 e 1.000 linhas.");
  const stock = stockList(),
    ids = new Set<number>();
  const rows = data
    .map((line, n) => {
      try {
        if (line.length !== 5 || !/^[1-9]\d*$/.test(line[0]))
          throw new Error("Identificador ou colunas inválidos.");
        const id = Number(line[0]),
          item = stock.find(s => s.id === id);
        if (!item || item.unit !== line[2])
          throw new Error("Insumo ou unidade não corresponde ao cadastro.");
        if (ids.has(id)) throw new Error("Insumo duplicado.");
        ids.add(id);
        // Uncounted rows may remain blank in an exported full inventory.
        if (!line[4].trim()) return null;
        const expected = countNumber(line[3]),
          counted = countNumber(line[4]);
        if (Math.abs(item.current - expected) > 0.0000001)
          throw new Error(
            "O saldo mudou desde a exportação. Exporte novamente e reconte."
          );
        return {
          stockId: id,
          name: item.name,
          unit: item.unit,
          previous: expected,
          counted,
          delta: Math.round((counted - expected) * 1e6) / 1e6,
        };
      } catch (error) {
        throw new Error(`Linha ${n + 2}: ${(error as Error).message}`);
      }
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);
  if (!rows.length)
    throw new Error("Preencha a coluna contagem de pelo menos um insumo.");
  return rows;
}
export const importStockCountInput = stockCountInput.extend({
  requestId: z.string().uuid(),
  reason: z.string().trim().min(3).max(300),
});
export function importStockCount(raw: unknown) {
  const input = importStockCountInput.parse(raw);
  const digest = crypto
    .createHash("sha256")
    .update(input.csv)
    .update("\0")
    .update(input.reason)
    .digest("hex");
  return transaction(() => {
    const old = records<{
      id: number;
      requestId: string;
      digest: string;
      rows: ReturnType<typeof previewStockCount>;
      createdAt: string;
    }>("stock_counts").find(r => r.requestId === input.requestId);
    if (old) {
      if (old.digest !== digest)
        throw new Error(
          "Esta contagem já foi usada com outro arquivo ou motivo."
        );
      return old;
    }
    const rows = previewStockCount(input),
      id = nextId("stock_counts");
    for (const row of rows)
      if (row.delta !== 0)
        moveStock(
          row.stockId,
          row.delta,
          "Contagem CSV: " + input.reason,
          "count:" + id
        );
    return put("stock_counts", {
      id,
      requestId: input.requestId,
      digest,
      rows,
      createdAt: new Date().toISOString(),
    });
  });
}
