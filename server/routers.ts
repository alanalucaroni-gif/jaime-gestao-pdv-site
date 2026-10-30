import { financialInput, financialOverview, createFinancial, settleInput, settleFinancial, reasonInput, reverseSettlement, cancelFinancial } from './financial';
import { productionRecipes, productionBatches, productionRecipeInput, saveProductionRecipe, productionBatchInput, previewProduction, produceBatch } from './production';
import { exportStockCount, stockCountInput, previewStockCount, importStockCountInput, importStockCount } from './stock-count';
import { cashInput, cashOverview, recordCash } from './cash';
import {movementSchema,recordMovement} from "./inventory";
import {dispatchPurchasePdfs} from "./purchase-pdf";
import {stockList,stockSchema,saveStock,adjustStock,recipes,saveRecipe,recipeSchema,movements,changeOrderStatus} from "./inventory";
import { awardPurchaseItems, awardItemsSchema, receivePurchaseOrder } from "./purchasing-local";
import { drivers,saveDriver,driverSchema,logisticsConfig,saveLogisticsConfig,configSchema,calculateRoute,trips,assignTrip,tripSchema,finishTrip } from "./logistics";
import { listSuppliers, createSupplier, createPurchaseRequest, getPurchaseRequest, getSupplierQuote, submitSupplierQuote, awardSupplierQuote, receivePurchase, listRequests, supplierSchema } from "./purchasing-local";
import { commerceDb, directMenu, directOrders, findOrder, saveOrder } from "./commerce-store";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { listOrders, listProducts, syncProducts, updateProduct, createOrderRecord, updateOrderStatus } from "./db";
import crypto from "node:crypto";

const productInput = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(180),
  category: z.string().min(1).max(40),
  description: z.string().max(2000),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  available: z.number().int().min(0).max(1),
  accent: z.string().max(40),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  menu: router({
    list: publicProcedure.query(() => directMenu().map(p => ({ ...p, price: p.price.toFixed(2), available: p.available ? 1 : 0 }))),
    sync: publicProcedure.input(z.object({ items: z.array(productInput).min(1) })).mutation(({ input }) => (() => { const db = commerceDb(); db.exec('BEGIN IMMEDIATE'); try { for (const item of input.items) { const old = directMenu().find(p => p.name === item.name); if (!old) throw new Error('Produto não cadastrado'); db.prepare('UPDATE direct_menu SET body=? WHERE id=?').run(JSON.stringify({ ...old, price: Number(item.price), available: item.available === 1 }), old.id); } db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return directMenu(); })()),
    update: publicProcedure.input(z.object({ id: z.number().int().positive(), price: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(), available: z.number().int().min(0).max(1).optional() })).mutation(({ input }) => updateProduct(input.id, { price: input.price, available: input.available })),
  }),
  orders: router({
    list: publicProcedure.query(() => directOrders().map(o => ({ ...o, source: o.source || "site", paymentMethod: o.paymentMethod === "offline" ? "Na entrega/retirada" : "Mercado Pago" }))),
    create: publicProcedure.input(z.object({
      source: z.enum(["site", "ifood", "whatsapp", "marketplace", "balcao"]),
      customerName: z.string().min(1).max(160),
      address: z.string().max(1000).optional(),
      customerNote: z.string().max(2000).optional(),
      deliveryType: z.enum(["delivery", "pickup", "counter"]),
      paymentMethod: z.string().max(40),
      paymentStatus: z.enum(["pending", "paid", "failed", "cash_on_delivery"]).optional(),
      subtotal: z.string(),
      deliveryFee: z.string(),
      total: z.string(),
      externalId: z.string().max(120).optional(),
      items: z.array(z.object({ productId: z.number().int().positive().optional(), name: z.string(), quantity: z.number().int().positive(), unitPrice: z.string(), observations: z.string().max(2000).optional() })).min(1),
    })).mutation(({ input }) => createOrderRecord({ ...input, publicId: `JA-${crypto.randomUUID().slice(0, 8).toUpperCase()}` })),
    updateStatus: publicProcedure.input(z.object({ publicId: z.string().max(40), status: z.enum(["analysis", "production", "ready", "completed", "cancelled"]) })).mutation(({ input }) => changeOrderStatus(input.publicId,input.status)),
  }),
  financial: router({
    overview: publicProcedure.query(financialOverview),
    create: publicProcedure.input(financialInput).mutation(({ input }) => createFinancial(input)),
    settle: publicProcedure.input(settleInput).mutation(({ input }) => settleFinancial(input)),
    reverse: publicProcedure.input(reasonInput).mutation(({ input }) => reverseSettlement(input)),
    cancel: publicProcedure.input(reasonInput).mutation(({ input }) => cancelFinancial(input)),
  }),
  production: router({
    recipes: publicProcedure.query(productionRecipes),
    saveRecipe: publicProcedure.input(productionRecipeInput).mutation(({ input }) => saveProductionRecipe(input)),
    batches: publicProcedure.query(productionBatches),
    preview: publicProcedure.input(productionBatchInput.omit({ requestId: true, note: true })).query(({ input }) => previewProduction(input)),
    produce: publicProcedure.input(productionBatchInput).mutation(({ input }) => produceBatch(input)),
  }),
  stockCount: router({
    export: publicProcedure.query(exportStockCount),
    preview: publicProcedure.input(stockCountInput).mutation(({ input }) => previewStockCount(input)),
    import: publicProcedure.input(importStockCountInput).mutation(({ input }) => importStockCount(input)),
  }),
  cash: router({overview:publicProcedure.query(cashOverview),record:publicProcedure.input(cashInput).mutation(({input})=>recordCash(input))}),
  logistics: router({
    drivers: publicProcedure.query(drivers),
    saveDriver: publicProcedure.input(driverSchema).mutation(({input})=>saveDriver(input)),
    config: publicProcedure.query(logisticsConfig),
    saveConfig: publicProcedure.input(configSchema).mutation(({input})=>saveLogisticsConfig(input)),
    route: publicProcedure.input(z.object({destination:z.string().trim().min(5).max(500)})).mutation(({input})=>calculateRoute(input.destination)),
    trips: publicProcedure.query(trips),
    assign: publicProcedure.input(tripSchema).mutation(({input})=>assignTrip(input)),
    finish: publicProcedure.input(z.object({id:z.number().int().positive()})).mutation(({input})=>finishTrip(input.id)),
  }),
  inventory: router({
    movement: publicProcedure.input(movementSchema).mutation(({input})=>recordMovement(input)),
    list: publicProcedure.query(stockList),
    save: publicProcedure.input(stockSchema).mutation(({input})=>saveStock(input)),
    adjust: publicProcedure.input(z.object({stockId:z.number().int().positive(),quantity:z.number().finite().min(-100000).max(100000).refine(n=>n!==0),reason:z.string().trim().min(3).max(300)})).mutation(({input})=>adjustStock(input)),
    recipes: publicProcedure.query(recipes),
    saveRecipe: publicProcedure.input(recipeSchema).mutation(({input})=>saveRecipe(input)),
    movements: publicProcedure.query(movements),
  }),
  purchasing: router({
    requests: publicProcedure.query(() => listRequests()),
    suppliers: publicProcedure.query(() => listSuppliers()),
    createSupplier: publicProcedure.input(supplierSchema).mutation(({ input }) => createSupplier(input)),
    createRequest: publicProcedure.input(z.object({ items: z.array(z.object({ itemName: z.string().min(1), quantity: z.string(), unit: z.string().max(20), stockItemId: z.number().int().positive().optional() })).min(1), supplierIds: z.array(z.number().int().positive()).min(1), notes: z.string().max(2000).optional() })).mutation(({ input }) => createPurchaseRequest(input)),
    getRequest: publicProcedure.input(z.object({ publicId: z.string().max(40) })).query(({ input }) => getPurchaseRequest(input.publicId)),
    getQuote: publicProcedure.input(z.object({ token: z.string().min(20).max(80) })).query(({ input }) => getSupplierQuote(input.token)),
    submitQuote: publicProcedure.input(z.object({ token: z.string().min(20).max(80), items: z.array(z.object({ purchaseItemId: z.number().int().positive(), unitPrice: z.string(), priceUnit:z.enum(["kg","g","un","L","ml","pacote"]).optional(),content:z.number().finite().positive().max(100000).optional(), available: z.number().int().min(0).max(1) })).min(1), notes: z.string().max(2000).optional(),deliveryDays:z.number().int().min(0).max(365).optional(),paymentMethod:z.enum(["Pix","Boleto","Transferência","Dinheiro","Cartão"]).optional(),paymentDays:z.number().int().min(0).max(365).optional() })).mutation(({ input }) => submitSupplierQuote(input)),
    awardItems: publicProcedure.input(awardItemsSchema).mutation(async ({input})=>{const result=awardPurchaseItems(input);return await dispatchPurchasePdfs(result.id)??result;}),
    sendPdfs: publicProcedure.input(z.object({requestId:z.number().int().positive()})).mutation(({input})=>dispatchPurchasePdfs(input.requestId)),
    receiveOrder: publicProcedure.input(z.object({requestId:z.number().int().positive(),orderId:z.string().max(80)})).mutation(({input})=>receivePurchaseOrder(input.requestId,input.orderId)),
    awardQuote: publicProcedure.input(z.object({ quoteId: z.number().int().positive() })).mutation(({ input }) => awardSupplierQuote(input.quoteId)),
    receive: publicProcedure.input(z.object({ requestId: z.number().int().positive() })).mutation(({ input }) => receivePurchase(input.requestId)),
  }),
});

export type AppRouter = typeof appRouter;
