import {registerPurchasePdf} from "../purchase-pdf";
import "dotenv/config";
import { registerCommerce, adminAccess } from "../commerce";
import express from "express";
import fs from "fs/promises";
import { createServer } from "http";
import path from "path";
import crypto from "node:crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { markOrderPaid, markStripeEvent } from "../db";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  app.get("/manus-routes.json", async (_req, res, next) => {
    try {
      const routesPath = path.resolve(process.cwd(), "public/manus-routes.json");
      const routes = await fs.readFile(routesPath, "utf-8");
      res.type("application/json").send(routes);
    } catch (error) {
      next(error);
    }
  });
  registerCommerce(app);
  registerPurchasePdf(app);
  app.use("/gestao", adminAccess);
  app.use("/pdv", adminAccess);
  app.use("/api/trpc", (req, res, next) => {
    const publicRoutes = new Set(["menu.list", "auth.me", "auth.logout", "purchasing.getQuote", "purchasing.submitQuote"]);
    if (req.path.slice(1).split(",").every(route => publicRoutes.has(route))) return next();
    const origin = req.header("origin");
    const allowed = process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).origin : `http://${req.get("host")}`;
    if (origin && origin !== allowed) return res.sendStatus(403);
    return adminAccess(req, res, next);
  });
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  app.get("/", (_req, res) => res.sendFile(path.resolve(process.cwd(), process.env.NODE_ENV === "development" ? "client/public/inicio.html" : "dist/public/inicio.html")));
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, process.env.HOST || "127.0.0.1", () => console.log(`Server listening on port ${port}`));
}

startServer().catch(error => { console.error(error); process.exit(1); });


