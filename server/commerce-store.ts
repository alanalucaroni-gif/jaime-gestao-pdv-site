import { builderIngredients, customPrice } from "../shared/custom-crepe";
import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseType } from 'node:sqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { initialMenu } from '../shared/catalog';

export const orderInput = z.object({
  requestId: z.string().uuid(), customerName: z.string().trim().min(2).max(160),
  phone: z.string().regex(/^\d{10,13}$/), address: z.string().trim().max(1000).default(''),
  customerNote: z.string().trim().max(1000).default(''),
  deliveryType: z.enum(['delivery', 'pickup']), paymentMethod: z.enum(['offline', 'online']),
  items: z.array(z.object({ productId: z.number().int().positive().optional(), custom: z.object({ type: z.enum(["salgado", "doce"]), dough: z.enum(["Tradicional", "Chocolate"]), ingredients: z.array(z.string()).min(1).max(6), note: z.string().max(1000) }).optional(), quantity: z.number().int().min(1).max(20) })).min(1).max(40),
}).refine(x => x.deliveryType !== 'delivery' || x.address.length >= 8, 'Informe o endereço completo');
export type DirectOrder = {
  source?: "site" | "balcao"; counterPayment?: string; cashReceived?: number; change?: number;
  publicId: string; token: string; requestId: string; customerName: string; phone: string; address: string;
  customerNote: string; deliveryType: 'delivery' | 'pickup'; paymentMethod: 'offline' | 'online';
  status: 'analysis' | 'production' | 'ready' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'cash_on_delivery' | 'refunded' | 'charged_back';
  subtotal: string; deliveryFee: string; total: string; createdAt: string;
  items: { productId: number; name: string; quantity: number; unitPrice: string; observations: string }[];
  paymentId?: string; paymentUpdated?: string; paymentKey?: string; paymentFingerprint?: string;
  qrCode?: string; qrImage?: string;
};
let database: DatabaseType | undefined;
export function commerceDb() {
  if (!database) {
    const location = process.env.COMMERCE_DB_PATH || path.resolve('data/jaime.sqlite');
    fs.mkdirSync(path.dirname(location), { recursive: true });
    database = new DatabaseSync(location);
    database.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS direct_orders (id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS direct_menu (id INTEGER PRIMARY KEY, body TEXT NOT NULL)');
    const insert = database.prepare('INSERT OR IGNORE INTO direct_menu VALUES (?, ?)');
    for (const item of initialMenu) insert.run(item.id, JSON.stringify(item));
  }
  for (const row of database.prepare("SELECT id,body FROM direct_menu").all()) { const p=JSON.parse(String(row.body)); if (!p.sku) { p.sku=`JA-${String(p.id).padStart(4,"0")}`; p.barcode=""; p.image=p.id<=14 ? `/menu-images/${p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g,"-")}.webp` : ""; database.prepare("UPDATE direct_menu SET body=? WHERE id=?").run(JSON.stringify(p),row.id); } }
  return database;
}
export function directMenu() { return commerceDb().prepare('SELECT body FROM direct_menu ORDER BY id').all().map(row => JSON.parse(String(row.body)) as typeof initialMenu[number]); }
export function directOrders() { return commerceDb().prepare('SELECT body FROM direct_orders ORDER BY rowid DESC LIMIT 200').all().map(row => JSON.parse(String(row.body)) as DirectOrder); }
export function findOrder(id: string) { const row = commerceDb().prepare('SELECT body FROM direct_orders WHERE id=?').get(id); return row ? JSON.parse(String(row.body)) as DirectOrder : undefined; }
export function saveOrder(order: DirectOrder) { commerceDb().prepare('UPDATE direct_orders SET body=? WHERE id=?').run(JSON.stringify(order), order.publicId); }
export function deliveryCents() { const fee = Number(process.env.DELIVERY_FEE_CENTS || 500); if (!Number.isSafeInteger(fee) || fee < 0) throw new Error('Taxa de entrega inválida'); return fee; }
export function newOrder(raw: unknown, verifiedFee?: number) {
  const input = orderInput.parse(raw);
  const old = commerceDb().prepare('SELECT body FROM direct_orders WHERE request_id=?').get(input.requestId);
  if (old) return JSON.parse(String(old.body)) as DirectOrder;
  const catalog = directMenu();
  const items = input.items.map(line => {
    if (line.custom) {
      const custom = line.custom;
      if (line.productId || new Set(custom.ingredients).size !== custom.ingredients.length || custom.ingredients.some(item => !builderIngredients[custom.type].includes(item))) throw new Error('Ingredientes inválidos');
      return { productId: 0, name: 'Monte seu crepe (' + custom.type + ')', quantity: line.quantity, unitPrice: customPrice(custom).toFixed(2), observations: [custom.dough, custom.ingredients.join(', '), custom.note].filter(Boolean).join('; ') };
    }
    const product = catalog.find(item => item.id === line.productId && item.available);
    if (!product) throw new Error('Produto indisponível. Atualize o cardápio.');
    return { productId: product.id, name: product.name, quantity: line.quantity, unitPrice: product.price.toFixed(2), observations: '' };
  });
  const cents = items.reduce((sum, item) => sum + Math.round(Number(item.unitPrice) * 100) * item.quantity, 0);
  const fee = input.deliveryType === 'delivery' ? (verifiedFee ?? deliveryCents()) : 0;
  const order: DirectOrder = { ...input, publicId: `JA-${crypto.randomUUID()}`, token: crypto.randomBytes(32).toString('hex'), status: 'analysis', paymentStatus: input.paymentMethod === 'offline' ? 'cash_on_delivery' : 'pending', items, subtotal: (cents / 100).toFixed(2), deliveryFee: (fee / 100).toFixed(2), total: ((cents + fee) / 100).toFixed(2), createdAt: new Date().toISOString() };
  commerceDb().prepare('INSERT INTO direct_orders VALUES (?, ?, ?)').run(order.publicId, input.requestId, JSON.stringify(order));
  return order;
}
export function customerOrder(order: DirectOrder) { return { publicId: order.publicId, status: order.status, paymentStatus: order.paymentStatus, paymentMethod: order.paymentMethod, total: order.total, deliveryFee: order.deliveryFee, items: order.items, qrCode: order.qrCode, qrImage: order.qrImage }; }

