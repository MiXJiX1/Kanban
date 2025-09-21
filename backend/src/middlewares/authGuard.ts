import { Request, Response, NextFunction } from "express";
import { verify } from "../lib/auth.js";
export function authGuard(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  try {
    const payload = verify(h.substring(7));
    (req as any).userId = payload.sub;
    next();
  } catch { return res.status(401).json({ message: "Unauthorized" }); }
}
