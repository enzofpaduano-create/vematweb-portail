/**
 * Catalogue family taxonomy — groups machines by Terex Crespellano product line.
 * Used by the catalogues portal to display a 2-level navigation:
 *   /direction/catalogues          → family grid (TRT, RT, A, RC, TCC, Lattice)
 *   /direction/catalogues/groupe/:family  → machines within that family
 *   /direction/catalogues/:slug    → individual catalogue viewer
 */

export type CatalogueFamily =
  | "TRT"
  | "RT"
  | "A"
  | "RC"
  | "TCC"
  | "Lattice"
  | "Other";

export const FAMILY_ORDER: CatalogueFamily[] = [
  "TRT",
  "RT",
  "A",
  "RC",
  "TCC",
  "Lattice",
  "Other",
];

export interface FamilyMeta {
  key: CatalogueFamily;
  /** URL-safe family identifier */
  slug: string;
  /** Display name (FR) */
  labelFr: string;
  /** Display name (EN) */
  labelEn: string;
  /** Subtitle / description (FR) */
  descriptionFr: string;
  /** Subtitle / description (EN) */
  descriptionEn: string;
  /** Tailwind color name used for accents (e.g. "amber", "blue") */
  color: string;
}

export const FAMILY_META: Record<CatalogueFamily, FamilyMeta> = {
  TRT: {
    key: "TRT",
    slug: "trt",
    labelFr: "Grues télescopiques",
    labelEn: "Telescopic cranes",
    descriptionFr: "Grues télescopiques tout-terrain (TRT 35 → TRT 100)",
    descriptionEn: "Telescopic rough terrain cranes (TRT 35 → TRT 100)",
    color: "amber",
  },
  RT: {
    key: "RT",
    slug: "rt",
    labelFr: "Grues tout-terrain",
    labelEn: "Rough terrain cranes",
    descriptionFr: "Grues sur roues tout-terrain (RT 35 → RT 660B)",
    descriptionEn: "Rough terrain cranes (RT 35 → RT 660B)",
    color: "blue",
  },
  A: {
    key: "A",
    slug: "a",
    labelFr: "Grues série A",
    labelEn: "A-series cranes",
    descriptionFr: "Grues Terex série A (A300 → A600)",
    descriptionEn: "Terex A-series cranes (A300 → A600)",
    color: "emerald",
  },
  RC: {
    key: "RC",
    slug: "rc",
    labelFr: "Grues série RC",
    labelEn: "RC-series cranes",
    descriptionFr: "Grues Terex série RC (RC30 → RC60)",
    descriptionEn: "Terex RC-series cranes (RC30 → RC60)",
    color: "rose",
  },
  TCC: {
    key: "TCC",
    slug: "tcc",
    labelFr: "Grues série TCC",
    labelEn: "TCC-series cranes",
    descriptionFr: "Grues Terex série TCC (TCC40 → TCC60)",
    descriptionEn: "Terex TCC-series cranes (TCC40 → TCC60)",
    color: "violet",
  },
  Lattice: {
    key: "Lattice",
    slug: "lattice",
    labelFr: "Grues à treillis",
    labelEn: "Lattice cranes",
    descriptionFr: "Grues à treillis (séries 10xx — 1045 → 1080)",
    descriptionEn: "Lattice boom cranes (10xx series — 1045 → 1080)",
    color: "slate",
  },
  Other: {
    key: "Other",
    slug: "other",
    labelFr: "Autres",
    labelEn: "Other",
    descriptionFr: "Catalogues divers",
    descriptionEn: "Miscellaneous catalogues",
    color: "zinc",
  },
};

/**
 * Map a slug like "trt-50" → "TRT", "rt-100-usa" → "RT", "1075l" → "Lattice".
 */
export function familyOf(slug: string): CatalogueFamily {
  const s = slug.toLowerCase();
  if (s.startsWith("trt-")) return "TRT";
  if (s.startsWith("rt-") || s === "rt") return "RT";
  if (s.startsWith("a-") || /^a\d/.test(s)) return "A";
  if (s.startsWith("rc-") || /^rc\d/.test(s)) return "RC";
  if (s.startsWith("tcc-") || /^tcc\d/.test(s)) return "TCC";
  if (/^\d/.test(s)) return "Lattice";
  return "Other";
}

/**
 * Look up family metadata by URL slug (e.g., "trt" → TRT meta).
 * Returns null if the slug is not a known family.
 */
export function familyBySlug(slug: string): FamilyMeta | null {
  const lower = (slug || "").toLowerCase();
  for (const meta of Object.values(FAMILY_META)) {
    if (meta.slug === lower) return meta;
  }
  return null;
}

/**
 * Group an array of catalogue entries by family, preserving FAMILY_ORDER.
 */
export function groupByFamily<T extends { slug: string }>(
  entries: T[],
): Array<{ family: CatalogueFamily; meta: FamilyMeta; items: T[] }> {
  const buckets = new Map<CatalogueFamily, T[]>();
  for (const e of entries) {
    const f = familyOf(e.slug);
    if (!buckets.has(f)) buckets.set(f, []);
    buckets.get(f)!.push(e);
  }
  return FAMILY_ORDER.filter((f) => buckets.has(f)).map((f) => ({
    family: f,
    meta: FAMILY_META[f],
    items: buckets.get(f)!,
  }));
}
