/**
 * app.ts - Exporta o app Express SEM chamar app.listen()
 * Isso permite ao Supertest fazer requisições diretas sem precisar de uma porta real.
 */
import express from "express";
import session from "express-session";
import { authRouter } from "./routes/auth";
import { retainRouter } from "./routes/retain/index";
import { obtainRouter } from "./routes/obtain/index";
import { tenantsRouter } from "./routes/tenants";
import { seedRouter } from "./routes/seed";
import { scoringRouter } from "./routes/scoring";
import { authMiddleware } from "./middleware/auth";
import { tenantMiddleware } from "./middleware/tenant";

export function createApp(sessionStore?: session.Store) {
  const app = express();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Sessão: em testes usa store em memória, em produção usa PgSession
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "test-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "lax",
      },
    })
  );

  // CORS — reflect only from known origins; never echo arbitrary origins in production
  const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:5173", "http://localhost:3000", "http://localhost:4173"];
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "intelli-sense-api", timestamp: new Date().toISOString() });
  });

  // Rotas públicas
  app.use("/api/auth", authRouter);

  // Seed: disponível apenas fora de produção
  if (process.env.NODE_ENV !== "production") {
    app.use("/api/seed", seedRouter);
  }

  // Rotas protegidas
  app.use("/api/tenants", authMiddleware, tenantsRouter);
  app.use("/api", authMiddleware, tenantMiddleware, scoringRouter);
  app.use("/api/retain", authMiddleware, tenantMiddleware, retainRouter);
  app.use("/api/obtain", authMiddleware, tenantMiddleware, obtainRouter);

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
