/**
 * app.ts v2 - Exporta o app Express SEM chamar app.listen()
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
import { lifecycleRouter } from "./routes/lifecycle";
import { authMiddleware } from "./middleware/auth";
import { tenantMiddleware } from "./middleware/tenant";

export function createApp(sessionStore?: session.Store) {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";
  const useSecureSessionCookie = process.env.SESSION_COOKIE_SECURE === "true";

  // In production the app may sit behind more than one proxy / TLS terminator.
  // Trusting the chain keeps req.protocol aligned with X-Forwarded-Proto.
  if (isProduction) {
    app.set("trust proxy", true);
  }

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Sessão: em testes usa store em memória, em produção usa PgSession
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "test-secret",
      resave: false,
      saveUninitialized: false,
      proxy: isProduction,
      cookie: {
        // No maxAge by default → session cookie that expires when the browser closes.
        // The /auth/login endpoint sets maxAge explicitly when rememberMe=true.
        httpOnly: true,
        secure: useSecureSessionCookie,
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
  app.use("/api/lifecycle", authMiddleware, tenantMiddleware, lifecycleRouter);

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
