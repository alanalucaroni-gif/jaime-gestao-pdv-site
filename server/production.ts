import { z } from "zod";
import { stockList, moveStock } from "./inventory";
import { records, put, nextId } from "./erp-store";
import { transaction } from "./backoffice-common";

const quantity = z
  .number()
  .finite()
  .positive()
  .max(100_000)
  .refine(
    n => Math.abs(n * 1e6 - Math.round(n * 1e6)) < 0.000001,
    "Use no máximo seis casas decimais."
  );
export const productionRecipeInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2).max(160),
  outputStockId: z.number().int().positive(),
  yieldQuantity: quantity,
  instructions: z.string().trim().max(10000).default(""),
  active: z.boolean().default(true),
  lines: z
    .array(
      z.object({
        stockId: z.number().int().positive(),
        quantity,
        lossPercent: z.number().finite().min(0).max(99).default(0),
      })
    )
    .min(1)
    .max(100),
});
export type ProductionRecipe = z.infer<typeof productionRecipeInput> & {
  id: number;
  updatedAt: string;
};
export type ProductionBatch = {
  id: number;
  requestId: string;
  recipeId: number;
  quantity: number;
  note: string;
  createdAt: string;
  output: { stockId: number; name: string; unit: string; quantity: number };
  recipe: ProductionRecipe;
  consumed: { stockId: number; name: string; unit: string; quantity: number }[];
};
export const productionRecipes = () =>
  records<ProductionRecipe>("production_recipes");
export const productionBatches = () =>
  records<ProductionBatch>("production_batches");
export function saveProductionRecipe(raw: unknown) {
  const input = productionRecipeInput.parse(raw),
    stock = stockList();
  if (input.id && !productionRecipes().some(r => r.id === input.id))
    throw new Error("Receita não encontrada.");
  if (!stock.some(s => s.id === input.outputStockId))
    throw new Error("Selecione o insumo produzido.");
  if (new Set(input.lines.map(l => l.stockId)).size !== input.lines.length)
    throw new Error("Ingrediente duplicado.");
  if (
    input.lines.some(
      l =>
        l.stockId === input.outputStockId ||
        !stock.some(s => s.id === l.stockId)
    )
  )
    throw new Error(
      "Confira os ingredientes; o produto final não pode consumir a si mesmo."
    );
  return transaction(() =>
    put<ProductionRecipe>("production_recipes", {
      ...input,
      id: input.id ?? nextId("production_recipes"),
      updatedAt: new Date().toISOString(),
    })
  );
}
export const productionBatchInput = z.object({
  requestId: z.string().uuid(),
  recipeId: z.number().int().positive(),
  quantity,
  note: z.string().trim().max(500).default(""),
});
export function previewProduction(raw: { recipeId: number; quantity: number }) {
  const input = productionBatchInput
    .omit({ requestId: true, note: true })
    .parse(raw);
  const recipe = productionRecipes().find(
    r => r.id === input.recipeId && r.active
  );
  if (!recipe) throw new Error("Receita inexistente ou pausada.");
  const stock = stockList(),
    output = stock.find(s => s.id === recipe.outputStockId);
  if (!output) throw new Error("Insumo produzido não encontrado.");
  // quantity on a line is net usable quantity. Gross input = net / (1 - loss).
  const consumed = recipe.lines.map(l => {
    const item = stock.find(s => s.id === l.stockId);
    if (!item) throw new Error("Ingrediente não encontrado.");
    const amount =
      Math.round(
        ((l.quantity * input.quantity) /
          recipe.yieldQuantity /
          (1 - l.lossPercent / 100)) *
          1e6
      ) / 1e6;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000)
      throw new Error("Quantidade fora dos limites de estoque.");
    return {
      stockId: item.id,
      name: item.name,
      unit: item.unit,
      quantity: amount,
      current: item.current,
      sufficient: Math.round(item.current * 1e6) >= Math.round(amount * 1e6),
    };
  });
  return {
    recipe,
    output: {
      stockId: output.id,
      name: output.name,
      unit: output.unit,
      quantity: input.quantity,
    },
    consumed,
  };
}
export function produceBatch(raw: unknown) {
  const input = productionBatchInput.parse(raw);
  return transaction(() => {
    const old = productionBatches().find(b => b.requestId === input.requestId);
    if (old) {
      if (
        old.recipeId !== input.recipeId ||
        old.quantity !== input.quantity ||
        old.note !== input.note
      )
        throw new Error("Esta produção já foi usada com outros dados.");
      return old;
    }
    const plan = previewProduction(input);
    if (plan.consumed.some(l => !l.sufficient))
      throw new Error(
        "Saldo insuficiente: " +
          plan.consumed
            .filter(l => !l.sufficient)
            .map(l => l.name)
            .join(", ")
      );
    const id = nextId("production_batches"),
      reference = "production:" + id;
    for (const line of plan.consumed)
      moveStock(
        line.stockId,
        -line.quantity,
        `Produção: ${plan.recipe.name}`,
        reference
      );
    moveStock(
      plan.output.stockId,
      plan.output.quantity,
      `Produzido: ${plan.recipe.name}`,
      reference
    );
    return put<ProductionBatch>("production_batches", {
      ...input,
      id,
      createdAt: new Date().toISOString(),
      recipe: plan.recipe,
      output: plan.output,
      consumed: plan.consumed.map(({ current, sufficient, ...line }) => line),
    });
  });
}
