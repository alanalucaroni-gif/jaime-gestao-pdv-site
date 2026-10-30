import { beforeAll, afterAll, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { appRouter } from "./routers";
import { commerceDb, directMenu } from "./commerce-store";
import { stockList, recordMovement, movements, saveStock } from "./inventory";
import { productionBatches } from "./production";
import { cashRows } from "./cash-ledger";
import { parseCountCsv, writeCountCsv } from "../shared/stock-count-csv";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jaime-backoffice-"));
const api = appRouter.createCaller({
  user: null,
  req: {} as never,
  res: {} as never,
});
let flour: number, milk: number, dough: number;
beforeAll(() => {
  process.env.COMMERCE_DB_PATH = path.join(dir, "test.sqlite");
  const stock = stockList();
  flour = stock.find(s => s.name === "Farinha de trigo")!.id;
  milk = stock.find(s => s.name === "Leite")!.id;
  dough = stock.find(s => s.name === "Massa tradicional")!.id;
});
afterAll(() => {
  commerceDb().close();
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.COMMERCE_DB_PATH;
});
const balance = (id: number) => stockList().find(s => s.id === id)!.current;
const entry = () => ({
  requestId: crypto.randomUUID(),
  type: "payable" as const,
  person: "Fornecedor de teste",
  description: "Insumos de teste",
  category: "Compras",
  issueDate: "2026-01-01",
  firstDueDate: "2026-01-31",
  total: 100,
  installmentCount: 3,
});
it("inicia catálogo vazio sem semear preços comerciais inventados", () => {
  expect(directMenu()).toEqual([]);
});
it("divide centavos sem perder total e preserva o dia após fevereiro", async () => {
  const input = entry(),
    saved = await api.financial.create(input);
  expect(saved.installments.map(i => i.amountCents)).toEqual([
    3334, 3333, 3333,
  ]);
  expect(saved.installments.map(i => i.dueDate)).toEqual([
    "2026-01-31",
    "2026-02-28",
    "2026-03-31",
  ]);
  expect((await api.financial.create(input)).id).toBe(saved.id);
  await expect(api.financial.create({ ...input, total: 200 })).rejects.toThrow(
    "outros dados"
  );
  expect(cashRows()).toHaveLength(0);
});
it("baixa parcial grava caixa, rejeita excesso, estorna uma vez e permite cancelamento", async () => {
  const saved = await api.financial.create({
    ...entry(),
    total: 100,
    installmentCount: 1,
  });
  const payment = {
    requestId: crypto.randomUUID(),
    entryId: saved.id,
    installment: 1,
    principal: 40,
    interest: 2,
    discount: 1,
    method: "pix" as const,
  };
  const result = await api.financial.settle(payment);
  await api.financial.settle(payment);
  expect(
    cashRows().filter(r => r.reference === "financial:" + result.id)
  ).toHaveLength(1);
  expect(
    cashRows().find(r => r.reference === "financial:" + result.id)
  ).toMatchObject({ type: "out", amount: 41 });
  let view = await api.financial.overview();
  expect(
    view.entries.find(e => e.id === saved.id)!.installments[0].remainingCents
  ).toBe(6000);
  await expect(
    api.financial.settle({
      ...payment,
      requestId: crypto.randomUUID(),
      principal: 61,
    })
  ).rejects.toThrow("maior");
  await expect(
    api.financial.settle({ ...payment, method: "cash" })
  ).rejects.toThrow("outros dados");
  await expect(
    api.financial.cancel({ id: saved.id, reason: "Erro de lançamento" })
  ).rejects.toThrow("Estorne");
  await api.financial.reverse({
    id: result.id,
    reason: "Pagamento não confirmado",
  });
  await api.financial.reverse({
    id: result.id,
    reason: "Pagamento não confirmado",
  });
  expect(
    cashRows().filter(r => r.reference === "financial-reversal:" + result.id)
  ).toHaveLength(1);
  view = await api.financial.overview();
  expect(
    view.entries.find(e => e.id === saved.id)!.installments[0].remainingCents
  ).toBe(10000);
  await api.financial.cancel({ id: saved.id, reason: "Cadastro incorreto" });
  await expect(
    api.financial.settle({ ...payment, requestId: crypto.randomUUID() })
  ).rejects.toThrow("indisponível");
});
it("recebível entra no caixa com saldo quitado e bloqueia valores sem precisão monetária", async () => {
  const saved = await api.financial.create({
    ...entry(),
    type: "receivable",
    total: 25,
    installmentCount: 1,
  });
  const p = await api.financial.settle({
    requestId: crypto.randomUUID(),
    entryId: saved.id,
    installment: 1,
    principal: 25,
    method: "bank",
  });
  expect(
    cashRows().find(r => r.reference === "financial:" + p.id)
  ).toMatchObject({ type: "in", amount: 25 });
  expect(
    (await api.financial.overview()).entries.find(e => e.id === saved.id)!
      .installments[0].status
  ).toBe("paid");
  await expect(
    api.financial.create({ ...entry(), total: 1.001 })
  ).rejects.toThrow();
  await expect(
    api.financial.create({ ...entry(), total: 0.01, installmentCount: 2 })
  ).rejects.toThrow();
  await expect(
    api.financial.create({ ...entry(), firstDueDate: "2026-02-30" })
  ).rejects.toThrow();
});
it("lote consome bruto com perda e registra saída e entrada de forma idempotente", async () => {
  recordMovement({
    stockId: flour,
    type: "entry",
    quantity: 10,
    reason: "Compra de teste",
  });
  recordMovement({
    stockId: milk,
    type: "entry",
    quantity: 5,
    reason: "Compra de teste",
  });
  const recipe = await api.production.saveRecipe({
    name: "Massa de teste",
    outputStockId: dough,
    yieldQuantity: 10,
    lines: [
      { stockId: flour, quantity: 0.9, lossPercent: 10 },
      { stockId: milk, quantity: 1 },
    ],
  });
  const input = {
    requestId: crypto.randomUUID(),
    recipeId: recipe.id,
    quantity: 20,
  };
  const plan = await api.production.preview(input);
  expect(plan.consumed.map(l => l.quantity)).toEqual([2, 2]);
  const batch = await api.production.produce(input);
  expect(balance(flour)).toBe(8);
  expect(balance(milk)).toBe(3);
  expect(balance(dough)).toBe(20);
  expect(
    movements().filter(m => m.reference === "production:" + batch.id)
  ).toHaveLength(3);
  await api.production.produce(input);
  expect(balance(dough)).toBe(20);
  await expect(
    api.production.produce({ ...input, quantity: 10 })
  ).rejects.toThrow("outros dados");
  await api.production.saveRecipe({
    ...recipe,
    name: "Receita revisada",
    lines: [{ stockId: flour, quantity: 0.5 }],
  });
  expect(productionBatches().find(b => b.id === batch.id)!.recipe.name).toBe(
    "Massa de teste"
  );
});
it("insuficiência em ingrediente posterior não deixa movimentos ou lote parcial", async () => {
  const recipe = await api.production.saveRecipe({
    name: "Teste sem leite",
    outputStockId: dough,
    yieldQuantity: 1,
    lines: [
      { stockId: flour, quantity: 0.1 },
      { stockId: milk, quantity: 50 },
    ],
  });
  const before = {
    flour: balance(flour),
    dough: balance(dough),
    count: productionBatches().length,
    movements: movements().length,
  };
  await expect(
    api.production.produce({
      requestId: crypto.randomUUID(),
      recipeId: recipe.id,
      quantity: 1,
    })
  ).rejects.toThrow("Saldo insuficiente");
  expect({
    flour: balance(flour),
    dough: balance(dough),
    count: productionBatches().length,
    movements: movements().length,
  }).toEqual(before);
  await expect(
    api.production.saveRecipe({
      ...recipe,
      lines: [{ stockId: dough, quantity: 1 }],
    })
  ).rejects.toThrow("si mesmo");
  await api.production.saveRecipe({ ...recipe, active: false });
  await expect(
    api.production.preview({ recipeId: recipe.id, quantity: 1 })
  ).rejects.toThrow("pausada");
});
it("CSV preserva aspas, ponto e vírgula, quebra de linha e vírgula decimal", async () => {
  const item = saveStock({
    name: 'Tempero; "teste"\nlinha',
    unit: "kg",
    minimum: 0,
  });
  const csv = writeCountCsv([[item.id, item.name, item.unit, 0, "1,25"]]);
  expect(parseCountCsv(csv)[1][1]).toBe(item.name);
  const preview = await api.stockCount.preview({ csv });
  expect(preview[0].counted).toBe(1.25);
  const input = {
    csv,
    requestId: crypto.randomUUID(),
    reason: "Contagem física",
  };
  const result = await api.stockCount.import(input);
  expect(balance(item.id)).toBe(1.25);
  expect((await api.stockCount.import(input)).id).toBe(result.id);
  expect(
    movements().filter(m => m.reference === "count:" + result.id)
  ).toHaveLength(1);
});
it("CSV rejeita saldo desatualizado, duplicado e inválido sem aplicar parcialmente", async () => {
  const before = balance(flour);
  const csv = writeCountCsv([
    [flour, "Farinha", "kg", before, 1],
    [milk, "Leite", "L", 999, 3],
  ]);
  await expect(
    api.stockCount.import({
      csv,
      requestId: crypto.randomUUID(),
      reason: "Contagem física",
    })
  ).rejects.toThrow("saldo mudou");
  expect(balance(flour)).toBe(before);
  const duplicate = writeCountCsv([
    [flour, "Farinha", "kg", before, 1],
    [flour, "Farinha", "kg", before, 2],
  ]);
  await expect(api.stockCount.preview({ csv: duplicate })).rejects.toThrow(
    "duplicado"
  );
  await expect(
    api.stockCount.preview({
      csv: writeCountCsv([[flour, "Farinha", "kg", before, "-1"]]),
    })
  ).rejects.toThrow("número");
  const full = await api.stockCount.export();
  await expect(api.stockCount.preview({ csv: full })).rejects.toThrow(
    "Preencha"
  );
});
