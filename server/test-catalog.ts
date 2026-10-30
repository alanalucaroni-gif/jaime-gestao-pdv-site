// Explicit test fixtures; never seed a production database with invented prices.
import { commerceDb } from "./commerce-store";
export function seedTestCatalog() {
  const insert = commerceDb().prepare(
    "INSERT OR IGNORE INTO direct_menu VALUES (?, ?)"
  );
  for (const id of [1, 2])
    insert.run(
      id,
      JSON.stringify({
        id,
        name: `Produto de teste ${id}`,
        description: "Somente testes automatizados",
        category: "Salgado",
        price: id === 1 ? 49.99 : 10,
        available: true,
        accent: "product-cream",
        sku: `TEST-${id}`,
        barcode: "",
        image: "",
      })
    );
}
