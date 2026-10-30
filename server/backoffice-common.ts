import { z } from "zod";
import { commerceDb } from "./commerce-store";

export const moneySchema = z
  .number()
  .finite()
  .min(0)
  .max(1_000_000)
  .refine(
    n => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001,
    "Use no máximo duas casas decimais."
  );
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => {
    const d = new Date(value + "T12:00:00Z");
    return (
      !Number.isNaN(d.valueOf()) &&
      d.toISOString().slice(0, 10) === value &&
      value >= "2000-01-01" &&
      value <= "2100-12-31"
    );
  }, "Data inválida.");
export const paymentMethodSchema = z.enum(["cash", "pix", "bank", "card"]);
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date()
  );
export function transaction<T>(work: () => T): T {
  const db = commerceDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
