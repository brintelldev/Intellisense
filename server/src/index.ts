import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import { authRouter } from "./routes/auth.js";
import { retainRouter } from "./routes/retain/index.js";
import { obtainRouter } from "./routes/obtain/index.js";
import { tenantsRouter } from "./routes/tenants.js";
import { seedRouter } from "./routes/seed.js";
import { scoringRouter } from "./routes/scoring.js";
import { lifecycleRouter } from "./routes/lifecycle.js";
import { authMiddleware } from "./middleware/auth.js";
import { tenantMiddleware } from "./middleware/tenant.js";

const app = express();
const port = parseInt(process.env.PORT || "3001");

// Database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// Session
const PgSession = connectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "sessions",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  })
);

// CORS for development
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "intelli-sense-api", timestamp: new Date().toISOString() });
});

// Public routes
app.use("/api/auth", authRouter);
app.use("/api/seed", seedRouter);

// Protected routes
app.use("/api/tenants", authMiddleware, tenantsRouter);
app.use("/api/retain", authMiddleware, tenantMiddleware, retainRouter);
app.use("/api/obtain", authMiddleware, tenantMiddleware, obtainRouter);
app.use("/api/lifecycle", authMiddleware, tenantMiddleware, lifecycleRouter);
app.use("/api", authMiddleware, tenantMiddleware, scoringRouter);

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`[Intelli Sense API] Running on http://localhost:${port}`);
});

export { pool };
