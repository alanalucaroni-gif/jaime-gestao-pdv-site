// Strict semicolon CSV: quotes, doubled quotes, embedded newline and UTF-8 BOM.
export function parseCountCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false,
    closed = false;
  for (let n = 0; n < source.length; n++) {
    const c = source[n];
    if (quoted) {
      if (c === '"') {
        if (source[n + 1] === '"') {
          value += '"';
          n++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += c;
    } else if (c === '"') {
      if (value || closed) throw new Error("Aspas inválidas no CSV.");
      quoted = true;
    } else if (c === ";" || c === "\n" || c === "\r") {
      row.push(value);
      value = "";
      closed = false;
      if (c !== ";") {
        if (row.some(v => v.trim())) rows.push(row);
        row = [];
        if (c === "\r" && source[n + 1] === "\n") n++;
      }
    } else {
      if (closed) throw new Error("Conteúdo após aspas no CSV.");
      value += c;
    }
  }
  if (quoted) throw new Error("Aspas não fechadas no CSV.");
  row.push(value);
  if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
export const countHeaders = ["id", "nome", "unidade", "saldo_base", "contagem"];
export function writeCountCsv(rows: (string | number)[][]) {
  const cell = (value: string | number) => {
    const s = String(value);
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return (
    "\uFEFF" +
    [countHeaders, ...rows].map(row => row.map(cell).join(";")).join("\r\n")
  );
}
export function countNumber(value: string) {
  if (!/^\d+(?:[.,]\d{1,6})?$/.test(value.trim()))
    throw new Error(
      "Use número positivo ou zero com até seis casas, sem separador de milhar."
    );
  const n = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(n) || n > 100_000)
    throw new Error("Quantidade acima do limite de 100.000.");
  return n;
}
