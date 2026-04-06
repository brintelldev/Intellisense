import type { Request, Response, NextFunction } from "express";

// Extends Express Request with tenant info
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.session?.tenantId;
  if (!tenantId) {
    return res.status(403).json({ error: "Tenant não configurado" });
  }
  req.tenantId = tenantId;
  next();
}
