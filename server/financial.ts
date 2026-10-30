import { z } from "zod";
import { records, put, nextId } from "./erp-store";
import { cashRows, writeCash } from "./cash-ledger";
import {
  dateSchema,
  moneySchema,
  paymentMethodSchema,
  today,
  transaction,
} from "./backoffice-common";

export const financialInput = z
  .object({
    requestId: z.string().uuid(),
    type: z.enum(["payable", "receivable"]),
    description: z.string().trim().min(3).max(300),
    person: z.string().trim().min(2).max(160),
    category: z.string().trim().min(2).max(100),
    document: z.string().trim().max(100).default(""),
    issueDate: dateSchema,
    firstDueDate: dateSchema,
    total: moneySchema.refine(n => n > 0),
    installmentCount: z.number().int().min(1).max(60),
    notes: z.string().trim().max(2000).default(""),
  })
  .refine(
    i => Math.round(i.total * 100) >= i.installmentCount,
    "Cada parcela deve ter pelo menos R$ 0,01."
  );
export type FinancialEntry = z.infer<typeof financialInput> & {
  id: number;
  createdAt: string;
  cancelledAt?: string;
  cancelReason?: string;
  installments: { number: number; dueDate: string; amountCents: number }[];
};
export type Settlement = {
  id: number;
  requestId: string;
  entryId: number;
  installment: number;
  principalCents: number;
  interestCents: number;
  discountCents: number;
  cashCents: number;
  method: z.infer<typeof paymentMethodSchema>;
  note: string;
  createdAt: string;
  reversedAt?: string;
  reversalReason?: string;
};
const entries = () => records<FinancialEntry>("financial_entries");
export const settlements = () => records<Settlement>("financial_settlements");
function dueMonth(first: string, offset: number) {
  const [year, month, day] = first.split("-").map(Number);
  const last = new Date(Date.UTC(year, month + offset, 0));
  return new Date(
    Date.UTC(
      last.getUTCFullYear(),
      last.getUTCMonth(),
      Math.min(day, last.getUTCDate())
    )
  )
    .toISOString()
    .slice(0, 10);
}
export function createFinancial(raw: unknown) {
  const input = financialInput.parse(raw);
  // Initialize the shared cash table before transactions that later settle entries.
  cashRows();
  return transaction(() => {
    const old = entries().find(e => e.requestId === input.requestId);
    if (old) {
      if (
        Object.keys(input).some(
          key =>
            old[key as keyof typeof input] !== input[key as keyof typeof input]
        )
      )
        throw new Error("Esta solicitação já foi usada com outros dados.");
      return old;
    }
    const cents = Math.round(input.total * 100),
      base = Math.floor(cents / input.installmentCount);
    const installments = Array.from(
      { length: input.installmentCount },
      (_, index) => ({
        number: index + 1,
        dueDate: dueMonth(input.firstDueDate, index),
        amountCents: base + (index < cents % input.installmentCount ? 1 : 0),
      })
    );
    installments.forEach(i => dateSchema.parse(i.dueDate));
    return put<FinancialEntry>("financial_entries", {
      ...input,
      id: nextId("financial_entries"),
      installments,
      createdAt: new Date().toISOString(),
    });
  });
}
export function financialOverview() {
  const paid = settlements(),
    date = today();
  const list = entries().map(entry => ({
    ...entry,
    installments: entry.installments.map(i => {
      const payments = paid.filter(
        s =>
          s.entryId === entry.id && s.installment === i.number && !s.reversedAt
      );
      const settledCents = payments.reduce(
        (sum, s) => sum + s.principalCents,
        0
      );
      const remainingCents = i.amountCents - settledCents;
      const status = entry.cancelledAt
        ? "cancelled"
        : remainingCents === 0
          ? "paid"
          : i.dueDate < date
            ? "overdue"
            : settledCents > 0
              ? "partial"
              : "open";
      return { ...i, settledCents, remainingCents, status, payments };
    }),
  }));
  const totals = { payableCents: 0, receivableCents: 0, overdueCents: 0 };
  for (const e of list.filter(e => !e.cancelledAt))
    for (const i of e.installments) {
      totals[e.type === "payable" ? "payableCents" : "receivableCents"] +=
        i.remainingCents;
      if (i.status === "overdue") totals.overdueCents += i.remainingCents;
    }
  return { entries: list, settlements: paid, totals, today: date };
}
export const settleInput = z
  .object({
    requestId: z.string().uuid(),
    entryId: z.number().int().positive(),
    installment: z.number().int().positive(),
    principal: moneySchema.refine(n => n > 0),
    interest: moneySchema.default(0),
    discount: moneySchema.default(0),
    method: paymentMethodSchema,
    note: z.string().trim().max(500).default(""),
  })
  .refine(
    i => i.discount < i.principal + i.interest,
    "O valor efetivo deve ser maior que zero."
  );
export function settleFinancial(raw: unknown) {
  const input = settleInput.parse(raw);
  cashRows();
  return transaction(() => {
    const old = settlements().find(s => s.requestId === input.requestId);
    const principalCents = Math.round(input.principal * 100),
      interestCents = Math.round(input.interest * 100),
      discountCents = Math.round(input.discount * 100);
    if (old) {
      if (
        old.entryId !== input.entryId ||
        old.installment !== input.installment ||
        old.principalCents !== principalCents ||
        old.interestCents !== interestCents ||
        old.discountCents !== discountCents ||
        old.method !== input.method ||
        old.note !== input.note
      )
        throw new Error("Esta baixa já foi usada com outros dados.");
      return old;
    }
    const entry = financialOverview().entries.find(e => e.id === input.entryId);
    const installment = entry?.installments.find(
      i => i.number === input.installment
    );
    if (!entry || entry.cancelledAt || !installment)
      throw new Error("Parcela indisponível.");
    if (principalCents > installment.remainingCents)
      throw new Error("Valor maior que o saldo da parcela.");
    const settlement: Settlement = {
      ...input,
      id: nextId("financial_settlements"),
      principalCents,
      interestCents,
      discountCents,
      cashCents: principalCents + interestCents - discountCents,
      createdAt: new Date().toISOString(),
    };
    put("financial_settlements", settlement);
    writeCash(
      "financial:" + settlement.id,
      entry.type === "payable" ? "out" : "in",
      settlement.cashCents / 100,
      `${entry.type === "payable" ? "Pagamento" : "Recebimento"}: ${entry.description} · parcela ${installment.number}`,
      input.method
    );
    return settlement;
  });
}
export const reasonInput = z.object({
  id: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
});
export function reverseSettlement(raw: unknown) {
  const input = reasonInput.parse(raw);
  cashRows();
  return transaction(() => {
    const row = settlements().find(s => s.id === input.id);
    if (!row) throw new Error("Baixa não encontrada.");
    if (row.reversedAt) return row;
    const entry = entries().find(e => e.id === row.entryId);
    if (!entry || entry.cancelledAt)
      throw new Error("Lançamento indisponível.");
    writeCash(
      "financial-reversal:" + row.id,
      entry.type === "payable" ? "in" : "out",
      row.cashCents / 100,
      `Estorno: ${entry.description} · ${input.reason}`,
      row.method
    );
    return put("financial_settlements", {
      ...row,
      reversedAt: new Date().toISOString(),
      reversalReason: input.reason,
    });
  });
}
export function cancelFinancial(raw: unknown) {
  const input = reasonInput.parse(raw);
  return transaction(() => {
    const entry = entries().find(e => e.id === input.id);
    if (!entry) throw new Error("Lançamento não encontrado.");
    if (entry.cancelledAt) return entry;
    if (settlements().some(s => s.entryId === entry.id && !s.reversedAt))
      throw new Error("Estorne as baixas antes de cancelar.");
    return put("financial_entries", {
      ...entry,
      cancelledAt: new Date().toISOString(),
      cancelReason: input.reason,
    });
  });
}
