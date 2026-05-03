import type { Request, Response, NextFunction } from "express";
import { getSupabaseServer, isSupabaseConfigured } from "../lib/supabaseServer";

/**
 * Express middleware: only allow DG, Manager, or Technicien.
 *
 * Reads the JWT from the `Authorization: Bearer <token>` header.
 * Validates it via Supabase, then checks role membership across
 * the three internal user types.
 *
 * On success, attaches `req.catalogueUser = { id, role }`.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      catalogueUser?: {
        id: string;
        role: "vemat_dg" | "vemat_admin" | "vemat_technicien";
        email: string | undefined;
      };
    }
  }
}

export async function requireCatalogueAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    res.status(503).json({ error: "Auth backend not configured" });
    return;
  }

  const auth = req.header("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Missing Bearer token" });
    return;
  }
  const token = match[1].trim();

  const supabase = getSupabaseServer();

  // 1. Validate JWT
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  const userId = userData.user.id;
  const email = userData.user.email;

  // 2. Check role: try profiles (DG / Manager) first, then technicians table
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profile && (profile.role === "vemat_dg" || profile.role === "vemat_admin")) {
    req.catalogueUser = { id: userId, role: profile.role, email };
    next();
    return;
  }

  const { data: tech } = await supabase
    .from("technicians")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (tech) {
    req.catalogueUser = { id: userId, role: "vemat_technicien", email };
    next();
    return;
  }

  res.status(403).json({ error: "Catalogue access requires DG, Manager, or Technicien role" });
}
