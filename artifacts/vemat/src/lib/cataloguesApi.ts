/**
 * Wrapper for the auth-gated catalogues API.
 *
 * The API server validates a Supabase JWT and checks role membership
 * (DG, Manager, or Technicien) before returning any catalogue data.
 *
 * Usage:
 *   import { listCatalogues, getCatalogue, buildSvgUrl } from "@/lib/cataloguesApi";
 *   const machines = await listCatalogues(supabaseDG);
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function buildApiUrl(path: string) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

export interface CatalogueIndexEntry {
  slug: string;
  label: string;
  brand: string;
  scrapedAt: string;
  nodeCount?: number;
  schemaCount?: number;
  partCount?: number;
}

async function getAccessToken(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Not authenticated");
  }
  return data.session.access_token;
}

async function authedFetch<T>(supabase: SupabaseClient, path: string): Promise<T> {
  const token = await getAccessToken(supabase);
  const res = await fetch(buildApiUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function listCatalogues(
  supabase: SupabaseClient,
): Promise<{ machines: CatalogueIndexEntry[] }> {
  return authedFetch(supabase, "/api/catalogues");
}

export async function getCatalogue<T = unknown>(
  supabase: SupabaseClient,
  slug: string,
): Promise<T> {
  return authedFetch(supabase, `/api/catalogues/${encodeURIComponent(slug)}`);
}

/**
 * Build a fetch-able SVG URL. The token is appended as query param so
 * <img src=...> can load it directly without us needing to set headers.
 *
 * NOTE: this means the token appears in URL — only used for SVG renders
 * inside authenticated portails. The token is short-lived (1h default).
 *
 * For inline `fetch(url)` calls inside the viewer, use `fetchSvgText`
 * instead which sets Authorization header properly.
 */
export function buildSvgUrl(slug: string, filename: string): string {
  return buildApiUrl(
    `/api/catalogues/${encodeURIComponent(slug)}/svg/${encodeURIComponent(filename)}`,
  );
}

export async function fetchSvgText(
  supabase: SupabaseClient,
  slug: string,
  filename: string,
): Promise<string> {
  const token = await getAccessToken(supabase);
  const res = await fetch(buildSvgUrl(slug, filename), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`SVG fetch failed: HTTP ${res.status}`);
  return res.text();
}

/**
 * Fetch a schema (PNG/JPG/etc.) as a Blob URL — used by <img src={...}>.
 * The caller must call URL.revokeObjectURL when done to free memory.
 */
export async function fetchSchemaAsBlobUrl(
  supabase: SupabaseClient,
  slug: string,
  filename: string,
): Promise<string> {
  const token = await getAccessToken(supabase);
  const res = await fetch(buildSvgUrl(slug, filename), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Schema fetch failed: HTTP ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** True if the filename indicates an SVG (renderable inline as text). */
export function isSvgFilename(filename: string): boolean {
  return /\.svg(?:\.svg)?$/i.test(filename);
}
