import type { CustomCrepe } from "./custom-crepe";

export type MenuProduct = {
  id: number;
  name: string;
  description: string;
  category: "Salgado" | "Vegetariano" | "Doce" | "Bebida";
  price: number;
  available: boolean;
  accent: string;
  sku?: string;
  barcode?: string;
  image?: string;
  custom?: CustomCrepe;
};

// The original seed was absent from Git. Existing SQLite products remain intact.
// New installations start empty; enter the verified menu in Gestão > Cardápio.
export const initialMenu: MenuProduct[] = [];
