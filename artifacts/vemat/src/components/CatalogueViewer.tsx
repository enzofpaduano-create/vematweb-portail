import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  FileText,
  Mail,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Folder,
  FolderOpen,
  Copy,
  Check,
  Printer,
  ShoppingCart,
  Trash2,
  Eye,
  EyeOff,
  Filter,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useSEO, useScrollTop } from "@/hooks/use-seo";
import { useLang } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import terexLogo from "@/assets/brands/terex.png";
import { getCatalogue, buildSvgUrl, fetchSvgText, fetchSchemaAsBlobUrl, isSvgFilename } from "@/lib/cataloguesApi";
import { translatePartFrToEn } from "@/lib/partTranslations";

// ─── Local i18n strings (page-specific) ───────────────────────────────────────

const STR = {
  fr: {
    seoTitle: "Catalogue technique TRT 35 — Vemat Terex",
    seoDesc: "Catalogue de pièces détachées Terex TRT 35 (B268091) — 231 sous-assemblages, 2 113 pièces, 133 schémas techniques. Distributeur officiel Vemat Group au Maroc.",
    breadcrumbParts: "Pièces de rechange",
    breadcrumbCatalog: "Catalogue",
    searchPlaceholder: "Rechercher un numéro de pièce ou une désignation (ex: 60398, joystick, filtre)…",
    loading: "Chargement du catalogue…",
    error: "Erreur",
    catalogNotFound: "catalogue introuvable",
    catalogTRT35: "Catalogue TRT 35",
    resultsFor: (n: number, q: string) => `${n} résultat${n > 1 ? "s" : ""} pour « ${q} »`,
    noResults: "Aucun résultat.",
    pos: "Pos",
    technicalCatalog: "Catalogue technique",
    pageTitle: "Terex TRT 35 — Catalogue de pièces détachées",
    pageIntro: (code: string) =>
      `Catalogue technique complet de la grue tout-terrain Terex TRT 35 (Crespellano, Italie), série ${code}. Naviguez par module pour accéder aux schémas et numéros de pièces d'origine sur 8 niveaux de profondeur.`,
    statSubAssemblies: "Sous-assemblages",
    statParts: "Pièces référencées",
    statSchemas: "Schémas techniques",
    mainModules: "Modules principaux",
    moduleSubAssemblies: (n: number) => `${n} sous-assemblages`,
    modulePieces: (n: number) => `${n} pièce${n > 1 ? "s" : ""}`,
    moduleSchemas: (n: number) => `${n} schéma${n > 1 ? "s" : ""}`,
    backToOverview: "Retour à l'aperçu",
    subAssemblage: "Sous-assemblage",
    techSchema: "Schéma technique",
    inheritedFrom: (label: string) => `(hérité de ${label})`,
    fullscreen: "Plein écran",
    schemaUnavailable:
      "Schéma technique non disponible pour cette section. La liste des pièces ci-dessous reste exploitable. Contactez-nous pour obtenir le plan d'origine Terex.",
    subAssemblies: (n: number) => `Sous-assemblages (${n})`,
    schemaShort: "● Schéma",
    subElements: (n: number) => `${n} sous-éléments`,
    partsList: (n: number) => `Liste des pièces (${n})`,
    partNumber: "Numéro de pièce",
    designation: "Désignation",
    qty: "Qté",
    action: "Action",
    devis: "Devis",
    reset: "Réinitialiser",
    download: "Télécharger",
    close: "Fermer",
    fullscreenHelp: "Molette pour zoomer · cliquer-glisser pour déplacer · ESC pour fermer",
    cartLabel: (n: number) => `${n} pièce${n > 1 ? "s" : ""} sélectionnée${n > 1 ? "s" : ""}`,
    cartRequest: "Demander un devis",
    cartClear: "Vider la sélection",
    cartSelectAll: "Tout sélectionner",
    cartSelectAllShort: "Tout",
    copy: "Copier",
    copied: "Copié",
    print: "Imprimer",
    selectAll: "Tout cocher",
    inCart: "Sélectionnée",
    onlySchemas: "Avec schémas seulement",
    expandAll: "Tout déplier",
    collapseAll: "Tout replier",
    advancedSearch: "Recherche avancée",
    filterByModule: "Filtrer par module",
    allModules: "Tous les modules",
    schemaHint: "Cliquez une ligne du tableau ci-dessous pour la mettre en évidence",
    highlightedAnnotation: (n: string) => `Pos ${n} en surbrillance`,
  },
  en: {
    seoTitle: "TRT 35 Technical Catalog — Vemat Terex",
    seoDesc: "Terex TRT 35 (B268091) spare parts catalog — 231 sub-assemblies, 2,113 parts, 133 technical schematics. Vemat Group, official Terex distributor in Morocco.",
    breadcrumbParts: "Spare parts",
    breadcrumbCatalog: "Catalog",
    searchPlaceholder: "Search a part number or description (e.g. 60398, joystick, filter)…",
    loading: "Loading catalog…",
    error: "Error",
    catalogNotFound: "catalog not found",
    catalogTRT35: "TRT 35 catalog",
    resultsFor: (n: number, q: string) => `${n} result${n > 1 ? "s" : ""} for "${q}"`,
    noResults: "No result.",
    pos: "Pos",
    technicalCatalog: "Technical catalog",
    pageTitle: "Terex TRT 35 — Spare parts catalog",
    pageIntro: (code: string) =>
      `Complete technical catalog for the Terex TRT 35 rough-terrain crane (Crespellano, Italy), serial ${code}. Browse by module to access exploded views and original part numbers across 8 levels of depth.`,
    statSubAssemblies: "Sub-assemblies",
    statParts: "Indexed parts",
    statSchemas: "Technical schematics",
    mainModules: "Main modules",
    moduleSubAssemblies: (n: number) => `${n} sub-assemblies`,
    modulePieces: (n: number) => `${n} part${n > 1 ? "s" : ""}`,
    moduleSchemas: (n: number) => `${n} diagram${n > 1 ? "s" : ""}`,
    backToOverview: "Back to overview",
    subAssemblage: "Sub-assembly",
    techSchema: "Technical schematic",
    inheritedFrom: (label: string) => `(inherited from ${label})`,
    fullscreen: "Fullscreen",
    schemaUnavailable:
      "Technical schematic not available for this section. The parts list below remains usable. Contact us for the original Terex drawing.",
    subAssemblies: (n: number) => `Sub-assemblies (${n})`,
    schemaShort: "● Diagram",
    subElements: (n: number) => `${n} sub-elements`,
    partsList: (n: number) => `Parts list (${n})`,
    partNumber: "Part number",
    designation: "Designation",
    qty: "Qty",
    action: "Action",
    devis: "Quote",
    reset: "Reset",
    download: "Download",
    close: "Close",
    fullscreenHelp: "Wheel to zoom · drag to pan · ESC to close",
    cartLabel: (n: number) => `${n} part${n > 1 ? "s" : ""} selected`,
    cartRequest: "Request a quote",
    cartClear: "Clear selection",
    cartSelectAll: "Select all",
    cartSelectAllShort: "All",
    copy: "Copy",
    copied: "Copied",
    print: "Print",
    selectAll: "Select all",
    inCart: "Selected",
    onlySchemas: "With diagrams only",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    advancedSearch: "Advanced search",
    filterByModule: "Filter by module",
    allModules: "All modules",
    schemaHint: "Click a row in the table below to highlight it",
    highlightedAnnotation: (n: string) => `Pos ${n} highlighted`,
  },
} as const;

// ─── CartItem (compatible with DemandeDevis) ─────────────────────────────────

type CartItem = { sku: string; title: string; brand: string; quantity: number };

// ─── Build ancestors path for a node (used for breadcrumb + svg fallback) ────

function findAncestors(node: TreeNode, tree: TreeNode): TreeNode[] {
  const path: TreeNode[] = [];
  function find(n: TreeNode): boolean {
    path.push(n);
    if (n === node) return true;
    for (const c of n.children) {
      if (find(c)) return true;
    }
    path.pop();
    return false;
  }
  find(tree);
  return path; // includes the node itself at the end
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PartFR {
  pos: string;
  partNumber: string;
  version?: string;
  name: string;
  nameFR?: string;
  qty: string;
  remarks?: string;
}

interface TreeNode {
  depth: number;
  code: string;
  name: string;
  labelOriginal: string;
  labelFR: string;
  nameFR: string;
  svgFile?: string | null;
  // Vintage Crespellano catalogues (A300/A350) serve schemas split across
  // multiple raster pages. svgFiles is the full ordered list; svgFile keeps
  // the first one for legacy back-compat with older catalog.json payloads.
  svgFiles?: string[];
  svgTableId?: string | null;
  parts: PartFR[];
  partsCount: number;
  children: TreeNode[];
}

interface CatalogData {
  machine: string;
  catalogCode: string;
  scrapedAt: string;
  stats: { nodes: number; parts: number; withSvg: number };
  tree: TreeNode;
}

// ─── Page component ──────────────────────────────────────────────────────────

// Pick the locale-appropriate display name for a node
function nodeLabel(n: TreeNode, lang: "fr" | "en"): string {
  if (lang === "en") return n.name || n.nameFR || n.labelOriginal;
  return n.nameFR || n.name || n.labelFR || n.labelOriginal;
}
function partLabel(p: PartFR, lang: "fr" | "en"): string {
  if (lang === "en") {
    // p.name is the original Terex value — usually English/Italian, but for
    // some parts Terex stored it in French ("BAGUE", "Gauche joystick").
    // Run it through the FR→EN dictionary to catch those cases. Already-English
    // text passes through unchanged (no dictionary matches → no-op).
    const raw = p.name || p.nameFR || "";
    return translatePartFrToEn(raw);
  }
  return p.nameFR || p.name || "";
}

interface CatalogueViewerProps {
  /** Machine slug, e.g. "trt-35" — matches the GCS folder under the bucket. */
  slug: string;
  /** Supabase client for the current portail (DG, Manager, or Tech). */
  supabase: SupabaseClient;
  /** Human-readable label, e.g. "TRT 35" — used in headers. */
  machineLabel: string;
  /** Where the back-arrow breadcrumb returns to, e.g. "/direction/catalogues". */
  backHref: string;
  /** localStorage key for the parts cart. Different per portail to avoid collision. */
  cartStorageKey?: string;
  /** True when rendered inside a portal that already provides its own header
   *  (DG, Manager, Tech). Removes the public navbar offset (pt-24, top-24). */
  embedded?: boolean;
  /** Allow download of schemas. Direction only — Manager/Tech can only print. */
  canDownload?: boolean;
}

export default function CatalogueViewer({
  slug,
  supabase,
  machineLabel,
  backHref,
  cartStorageKey = "vemat_devis_cart",
  embedded = false,
  canDownload = false,
}: CatalogueViewerProps) {
  const { lang } = useLang();
  const s = STR[lang as "fr" | "en"] || STR.fr;
  useSEO(`${machineLabel} — Catalogue`, `Catalogue interne ${machineLabel}`);
  useScrollTop();

  const [data, setData] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeNode, setActiveNode] = useState<TreeNode | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [onlySchemas, setOnlySchemas] = useState(false);
  const [moduleFilter, setModuleFilter] = useState<string>(""); // empty = all
  const [highlightPos, setHighlightPos] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // Cart for multi-part quote requests
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const cartList = useMemo(() => [...cart.values()], [cart]);

  function toggleCartItem(p: PartFR) {
    if (!p.partNumber) return;
    setCart((prev) => {
      const next = new Map(prev);
      if (next.has(p.partNumber)) next.delete(p.partNumber);
      else next.set(p.partNumber, {
        sku: p.partNumber,
        title: partLabel(p, lang as "fr" | "en") || p.partNumber,
        brand: `Terex ${machineLabel}`,
        quantity: parseInt(p.qty, 10) || 1
      });
      return next;
    });
  }

  function addAllPartsToCart(parts: PartFR[]) {
    setCart((prev) => {
      const next = new Map(prev);
      for (const p of parts) {
        if (!p.partNumber) continue;
        if (!next.has(p.partNumber)) {
          next.set(p.partNumber, {
            sku: p.partNumber,
            title: partLabel(p, lang as "fr" | "en") || p.partNumber,
            brand: `Terex ${machineLabel}`,
            quantity: parseInt(p.qty, 10) || 1
          });
        }
      }
      return next;
    });
  }

  function clearCart() { setCart(new Map()); }

  function submitCart() {
    if (cartList.length === 0) return;
    localStorage.setItem(cartStorageKey, JSON.stringify(cartList));
    setLocation("/demande-devis");
  }

  function handlePrint() { window.print(); }

  // Path string to identify a node uniquely (depth + code)
  const nodeKey = (n: TreeNode) => `d${n.depth}-${n.code}-${n.labelOriginal}`;

  // ─── Helper: find a node by code, walking the tree ───────────────────────
  function findNodeByCode(code: string, tree: TreeNode): TreeNode | null {
    if (tree.code === code) return tree;
    for (const c of tree.children) {
      const r = findNodeByCode(code, c);
      if (r) return r;
    }
    return null;
  }

  useEffect(() => {
    let cancelled = false;
    getCatalogue<CatalogData>(supabase, slug)
      .then((d: CatalogData) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
        // Auto-expand depth 0 + 1
        const initialExpanded = new Set<string>();
        initialExpanded.add(nodeKey(d.tree));
        d.tree.children.forEach((c) => initialExpanded.add(nodeKey(c)));
        setExpanded(initialExpanded);
        // Restore active node from URL ?node=...
        const params = new URLSearchParams(window.location.search);
        const nodeParam = params.get("node");
        if (nodeParam) {
          const target = findNodeByCode(nodeParam, d.tree);
          if (target) {
            setActiveNode(target);
            // Expand all ancestors so the tree shows the path
            const ancestors = findAncestors(target, d.tree);
            for (const a of ancestors) initialExpanded.add(nodeKey(a));
            setExpanded(new Set(initialExpanded));
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || "Erreur de chargement");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Sync activeNode → URL ────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    if (activeNode) params.set("node", activeNode.code);
    else params.delete("node");
    const newSearch = params.toString();
    const currentSearch = window.location.search.replace(/^\?/, "");
    if (newSearch !== currentSearch) {
      const newUrl = window.location.pathname + (newSearch ? "?" + newSearch : "") + window.location.hash;
      window.history.replaceState({}, "", newUrl);
    }
  }, [activeNode, loading]);

  // Reset SVG annotation highlight when navigating
  useEffect(() => { setHighlightPos(null); }, [activeNode]);

  // ─── Search across all parts in the tree ────────────────────────────────────

  const searchResults = useMemo(() => {
    if (!data || !search.trim()) return null;
    const q = search.trim().toLowerCase();
    const results: Array<{ node: TreeNode; part: PartFR; ancestors: TreeNode[] }> = [];
    function visit(n: TreeNode, ancestors: TreeNode[]) {
      // Match parts inside this node
      for (const p of n.parts) {
        const haystack = `${p.partNumber || ""} ${p.name || ""} ${p.nameFR || ""}`.toLowerCase();
        if (haystack.includes(q)) {
          results.push({ node: n, part: p, ancestors: [...ancestors] });
          if (results.length >= 100) return;
        }
      }
      // Also match the node itself
      const nodeText = `${n.code} ${n.name} ${n.labelFR} ${n.nameFR}`.toLowerCase();
      if (nodeText.includes(q)) {
        results.push({
          node: n,
          part: { pos: "", partNumber: n.code, name: n.name, nameFR: n.nameFR, qty: "" },
          ancestors: [...ancestors],
        });
      }
      for (const c of n.children) visit(c, [...ancestors, n]);
    }
    visit(data.tree, []);
    return results.slice(0, 60);
  }, [data, search]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-zinc-400 font-medium">{s.loading}</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-red-500 font-medium">{s.error} : {error || s.catalogNotFound}</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-zinc-50 print:pt-0 print:bg-white ${embedded ? "" : "pt-24 md:pt-28"}`}>
      {/* Print-only stylesheet to hide chrome and reset layout */}
      <style>{`
        @media print {
          body { background: white !important; }
          header, footer, nav.global, .print\\:hidden { display: none !important; }
          aside { display: none !important; }
          main { border: none !important; padding: 0 !important; }
          .lg\\:sticky, .sticky { position: static !important; }
          .max-h-\\[600px\\] { max-height: none !important; }
          img { max-width: 100% !important; }
          .grid { display: block !important; }
          a { color: black !important; text-decoration: none !important; }
          @page { margin: 12mm; }
        }
      `}</style>

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className={`bg-white border-b border-zinc-200 sticky z-30 print:hidden ${embedded ? "top-0" : "top-24 md:top-28"}`}>
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4 flex-wrap">
          <Link
            href={backHref}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            {lang === "fr" ? "Catalogues" : "Catalogues"}
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="text-sm text-zinc-600">Terex</span>
          <span className="text-zinc-300">/</span>
          <span className="text-sm text-zinc-600">{s.breadcrumbCatalog}</span>
          <span className="text-zinc-300">/</span>
          <span className="text-sm font-bold text-zinc-950">{machineLabel} ({data.catalogCode})</span>

          <div className="flex-1" />
          <img src={terexLogo} alt="Terex" className="h-8 object-contain" />
        </div>
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={s.searchPlaceholder}
              className="pl-11 h-11 rounded-xl border-zinc-200"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-zinc-100"
              >
                <X className="h-4 w-4 text-zinc-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Search results overlay ──────────────────────────────────────────── */}
      {searchResults && (
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h2 className="text-lg font-bold mb-4">{s.resultsFor(searchResults.length, search)}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {searchResults.length === 0 && <div className="text-zinc-400 text-sm">{s.noResults}</div>}
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  setActiveNode(r.node);
                  const newExpanded = new Set(expanded);
                  for (const a of r.ancestors) newExpanded.add(nodeKey(a));
                  newExpanded.add(nodeKey(r.node));
                  setExpanded(newExpanded);
                  setSearch("");
                }}
                className="text-left bg-white rounded-xl p-4 border border-zinc-200 hover:border-accent hover:shadow-soft transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="font-mono text-xs font-bold text-accent">{r.part.partNumber || r.node.code}</div>
                  {r.part.pos && (
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400">{s.pos} {r.part.pos}</div>
                  )}
                </div>
                <div className="text-sm font-semibold text-zinc-950 mb-1">
                  {partLabel(r.part, lang as "fr" | "en") || nodeLabel(r.node, lang as "fr" | "en")}
                </div>
                <div className="text-xs text-zinc-500 line-clamp-1">
                  {r.ancestors
                    .slice(1)
                    .map((a) => nodeLabel(a, lang as "fr" | "en"))
                    .filter(Boolean)
                    .join(" › ")}
                  {" › "}
                  {nodeLabel(r.node, lang as "fr" | "en")}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Main 2-column layout ────────────────────────────────────────────── */}
      {!searchResults && (
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Sidebar tree */}
          <aside className={`bg-white rounded-2xl border border-zinc-200 p-3 lg:sticky overflow-y-auto print:hidden ${embedded ? "lg:top-[160px] lg:max-h-[calc(100vh-180px)]" : "lg:top-[260px] lg:max-h-[calc(100vh-280px)]"}`}>
            <div className="flex items-center justify-between px-2 py-2">
              <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400">
                {lang === "fr" ? `Catalogue ${machineLabel}` : `${machineLabel} catalog`}
              </h3>
              <button
                onClick={() => {
                  if (expanded.size > data.tree.children.length + 1) {
                    // Collapse all (keep root + first level)
                    const e = new Set<string>();
                    e.add(nodeKey(data.tree));
                    setExpanded(e);
                  } else {
                    // Expand all
                    const e = new Set<string>();
                    function walk(n: TreeNode) {
                      e.add(nodeKey(n));
                      for (const c of n.children) walk(c);
                    }
                    walk(data.tree);
                    setExpanded(e);
                  }
                }}
                className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 hover:text-accent transition-colors"
                title={expanded.size > data.tree.children.length + 1 ? s.collapseAll : s.expandAll}
              >
                {expanded.size > data.tree.children.length + 1 ? s.collapseAll : s.expandAll}
              </button>
            </div>
            <div className="px-2 pb-3 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-[11px] text-zinc-600 cursor-pointer hover:text-zinc-900 select-none">
                <input
                  type="checkbox"
                  checked={onlySchemas}
                  onChange={(e) => setOnlySchemas(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-zinc-300 text-accent accent-accent"
                />
                {onlySchemas ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {s.onlySchemas}
              </label>
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="text-[11px] border border-zinc-200 rounded-md px-2 py-1 bg-white text-zinc-700 hover:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">{s.allModules}</option>
                {data.tree.children.map((m) => (
                  <option key={m.code} value={m.code}>
                    {nodeLabel(m, lang as "fr" | "en")}
                  </option>
                ))}
              </select>
            </div>
            <TreeNodeView
              node={data.tree}
              lang={lang as "fr" | "en"}
              expanded={expanded}
              setExpanded={setExpanded}
              activeNode={activeNode}
              setActiveNode={setActiveNode}
              nodeKey={nodeKey}
              filterOnlySchemas={onlySchemas}
              moduleFilter={moduleFilter}
            />
          </aside>

          {/* Content area */}
          <main className="bg-white rounded-2xl border border-zinc-200 p-6 lg:p-8 min-h-[600px]">
            {!activeNode && <CatalogOverview data={data} lang={lang as "fr" | "en"} onPickNode={setActiveNode} machineLabel={machineLabel} />}
            {activeNode && (
              <NodeDetailView
                node={activeNode}
                rootTree={data.tree}
                lang={lang as "fr" | "en"}
                onClose={() => setActiveNode(null)}
                onPickNode={setActiveNode}
                cart={cart}
                onToggleCartItem={toggleCartItem}
                onAddAllParts={addAllPartsToCart}
                onPrint={handlePrint}
                highlightPos={highlightPos}
                setHighlightPos={setHighlightPos}
                slug={slug}
                supabase={supabase}
                embedded={embedded}
                canDownload={canDownload}
              />
            )}
          </main>
        </div>
      )}

      {/* Floating cart action bar — hidden in embedded portails (DG/Tech) */}
      <AnimatePresence>
        {!embedded && cartList.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 280 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 print:hidden"
          >
            <div className="bg-zinc-950 text-white rounded-2xl shadow-2xl flex items-center gap-2 p-2 pl-4 max-w-[calc(100vw-2rem)]">
              <ShoppingCart className="h-4 w-4 text-accent flex-shrink-0" />
              <span className="text-xs font-bold whitespace-nowrap">
                {s.cartLabel(cartList.length)}
              </span>
              <button
                onClick={clearCart}
                className="ml-2 p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                title={s.cartClear}
                aria-label={s.cartClear}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={submitCart}
                className="inline-flex items-center gap-1.5 bg-accent text-zinc-950 hover:bg-amber-400 transition-colors rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider"
              >
                <Mail className="h-3.5 w-3.5" />
                {s.cartRequest}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tree node view (recursive) ──────────────────────────────────────────────

// Returns true if this subtree contains at least one node with a schema (any page)
function subtreeHasSchema(n: TreeNode): boolean {
  if ((n.svgFiles && n.svgFiles.length > 0) || n.svgFile) return true;
  for (const c of n.children) if (subtreeHasSchema(c)) return true;
  return false;
}

function TreeNodeView({
  node,
  lang,
  expanded,
  setExpanded,
  activeNode,
  setActiveNode,
  nodeKey,
  filterOnlySchemas = false,
  moduleFilter = "",
}: {
  node: TreeNode;
  lang: "fr" | "en";
  expanded: Set<string>;
  setExpanded: (s: Set<string>) => void;
  activeNode: TreeNode | null;
  setActiveNode: (n: TreeNode) => void;
  nodeKey: (n: TreeNode) => string;
  filterOnlySchemas?: boolean;
  moduleFilter?: string;
}) {
  // Apply filters: hide subtree if onlySchemas and no schema in subtree, or if moduleFilter is set and node is at depth 1 and doesn't match
  if (filterOnlySchemas && !subtreeHasSchema(node)) return null;
  if (moduleFilter && node.depth === 1 && node.code !== moduleFilter) return null;
  const isExpanded = expanded.has(nodeKey(node));
  const isActive = activeNode === node;
  const hasChildren = node.children.length > 0;

  const toggle = () => {
    const ne = new Set(expanded);
    if (isExpanded) ne.delete(nodeKey(node));
    else ne.add(nodeKey(node));
    setExpanded(ne);
  };

  const indent = node.depth * 12;
  const displayName = nodeLabel(node, lang);
  const showCode = node.code && node.code.length > 0 && node.code !== node.labelOriginal;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1.5 pr-2 rounded-md cursor-pointer transition-colors ${
          isActive ? "bg-zinc-950 text-white" : "hover:bg-zinc-50 text-zinc-800"
        }`}
        style={{ paddingLeft: `${indent + 6}px` }}
        onClick={() => setActiveNode(node)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
            className={`p-0.5 rounded ${isActive ? "hover:bg-zinc-800" : "hover:bg-zinc-200"} flex-shrink-0`}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-[18px] flex-shrink-0" />
        )}
        {hasChildren ? (
          isExpanded ? (
            <FolderOpen className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? "text-zinc-400" : "text-zinc-400"}`} />
          ) : (
            <Folder className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? "text-zinc-400" : "text-zinc-400"}`} />
          )
        ) : (
          <FileText className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? "text-zinc-400" : "text-zinc-300"}`} />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium truncate leading-tight">{displayName || node.labelOriginal}</div>
          {showCode && (
            <div
              className={`text-[10px] font-mono truncate leading-tight ${isActive ? "text-zinc-400" : "text-zinc-400"}`}
            >
              {node.code}
              {((node.svgFiles && node.svgFiles.length > 0) || node.svgFile) && (
                <span className="ml-1.5 text-accent">●</span>
              )}
            </div>
          )}
        </div>
      </div>
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((c, i) => (
            <TreeNodeView
              key={i}
              node={c}
              lang={lang}
              expanded={expanded}
              setExpanded={setExpanded}
              activeNode={activeNode}
              setActiveNode={setActiveNode}
              nodeKey={nodeKey}
              filterOnlySchemas={filterOnlySchemas}
              moduleFilter={moduleFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Catalog overview ────────────────────────────────────────────────────────

function CatalogOverview({
  data,
  lang,
  onPickNode,
  machineLabel,
}: {
  data: CatalogData;
  lang: "fr" | "en";
  onPickNode: (n: TreeNode) => void;
  machineLabel: string;
}) {
  const s = STR[lang] || STR.fr;
  const title = lang === "fr"
    ? `Terex ${machineLabel} — Catalogue de pièces détachées`
    : `Terex ${machineLabel} — Spare parts catalog`;
  const intro = lang === "fr"
    ? `Catalogue technique de la grue Terex ${machineLabel} (Crespellano, Italie), série ${data.catalogCode}. Naviguez par module pour accéder aux schémas et numéros de pièces d'origine sur tous les niveaux de profondeur.`
    : `Technical catalog for the Terex ${machineLabel} crane (Crespellano, Italy), serial ${data.catalogCode}. Browse by module to access exploded views and original part numbers across all depth levels.`;
  return (
    <div>
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.25em] font-black text-accent mb-2">
          {s.technicalCatalog}
        </p>
        <h1 className="text-3xl lg:text-4xl font-black text-zinc-950 mb-3">{title}</h1>
        <p className="text-zinc-600 max-w-2xl leading-relaxed">{intro}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <Stat label={s.statSubAssemblies} value={data.stats.nodes} />
        <Stat label={s.statParts} value={data.stats.parts.toLocaleString(lang === "en" ? "en-US" : "fr-FR")} />
        <Stat label={s.statSchemas} value={data.stats.withSvg} />
      </div>

      <h2 className="text-lg font-bold text-zinc-950 mb-4">{s.mainModules}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.tree.children.map((m, i) => {
          const totalDescendants = countDescendants(m);
          return (
            <button
              key={i}
              onClick={() => onPickNode(m)}
              className="text-left bg-zinc-50 hover:bg-white hover:border-accent hover:shadow-soft border border-transparent rounded-xl p-4 transition-all"
            >
              <div className="font-bold text-zinc-950 mb-1">{nodeLabel(m, lang)}</div>
              <div className="text-xs text-zinc-500 mb-2 line-clamp-2 font-mono">{m.code}</div>
              <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                {totalDescendants.nodes > 1 && <span>{s.moduleSubAssemblies(totalDescendants.nodes - 1)}</span>}
                <span>{s.modulePieces(totalDescendants.parts)}</span>
                {totalDescendants.withSvg > 0 && (
                  <span className="text-accent">{s.moduleSchemas(totalDescendants.withSvg)}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function countDescendants(n: TreeNode): { nodes: number; parts: number; withSvg: number } {
  let nodes = 1;
  let parts = n.parts.length;
  let withSvg = (n.svgFiles && n.svgFiles.length > 0) || n.svgFile ? 1 : 0;
  for (const c of n.children) {
    const sub = countDescendants(c);
    nodes += sub.nodes;
    parts += sub.parts;
    withSvg += sub.withSvg;
  }
  return { nodes, parts, withSvg };
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-zinc-950 rounded-xl p-5">
      <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 mb-1">{label}</div>
      <div className="text-3xl font-black text-white">{value}</div>
    </div>
  );
}

// ─── Node detail view ────────────────────────────────────────────────────────

/** Return the full ordered list of schema pages for a node (multi-page support). */
function getNodeSvgs(n: TreeNode): string[] {
  if (n.svgFiles && n.svgFiles.length > 0) return n.svgFiles;
  if (n.svgFile) return [n.svgFile];
  return [];
}

// Walk a node + its ancestors looking for schema pages to inherit.
// Strategy: at each level walking up, ALSO check siblings — siblings often share
// the same diagram, so a sibling's pages are more relevant than a distant ancestor's.
function findInheritedSvg(
  node: TreeNode,
  tree: TreeNode
): { svgs: string[]; ownedBy: TreeNode | null } {
  const ownPages = getNodeSvgs(node);
  if (ownPages.length > 0) return { svgs: ownPages, ownedBy: null };
  const path: TreeNode[] = [];
  function find(n: TreeNode): boolean {
    path.push(n);
    if (n === node) return true;
    for (const c of n.children) {
      if (find(c)) return true;
    }
    path.pop();
    return false;
  }
  find(tree);
  for (let i = path.length - 2; i >= 0; i--) {
    const ancestor = path[i];
    const codePrefix = node.code.split(/[_-]/)[0];
    function findSiblingByPrefix(n: TreeNode): TreeNode | null {
      if (n !== node && getNodeSvgs(n).length > 0 && n.code.startsWith(codePrefix)) return n;
      for (const c of n.children) {
        const r = findSiblingByPrefix(c);
        if (r) return r;
      }
      return null;
    }
    const sibling = findSiblingByPrefix(ancestor);
    if (sibling) return { svgs: getNodeSvgs(sibling), ownedBy: sibling };
    const ancestorPages = getNodeSvgs(ancestor);
    if (ancestorPages.length > 0) return { svgs: ancestorPages, ownedBy: ancestor };
  }
  return { svgs: [], ownedBy: null };
}

function NodeDetailView({
  node,
  onClose,
  onPickNode,
  rootTree,
  lang,
  cart,
  onToggleCartItem,
  onAddAllParts,
  onPrint,
  highlightPos,
  setHighlightPos,
  slug,
  supabase,
  embedded,
  canDownload,
}: {
  node: TreeNode;
  onClose: () => void;
  onPickNode: (n: TreeNode) => void;
  rootTree: TreeNode;
  lang: "fr" | "en";
  cart: Map<string, CartItem>;
  onToggleCartItem: (p: PartFR) => void;
  onAddAllParts: (parts: PartFR[]) => void;
  onPrint: () => void;
  highlightPos: string | null;
  setHighlightPos: (pos: string | null) => void;
  slug: string;
  supabase: SupabaseClient;
  embedded?: boolean;
  canDownload?: boolean;
}) {
  const s = STR[lang] || STR.fr;
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenIdx, setFullscreenIdx] = useState(0);
  const ownPages = useMemo(() => getNodeSvgs(node), [node]);
  const inherited = useMemo(() => findInheritedSvg(node, rootTree), [node, rootTree]);
  const svgPages = ownPages.length > 0 ? ownPages : inherited.svgs;
  const svgUrl = svgPages[0] || "";
  const inheritedFrom = ownPages.length > 0 ? null : inherited.ownedBy;
  const primary = nodeLabel(node, lang) || s.subAssemblage;
  const secondary = lang === "fr" ? node.name : node.nameFR;
  const ancestors = useMemo(() => findAncestors(node, rootTree).slice(0, -1), [node, rootTree]);
  // Set of pos numbers that label clickable annotations on the schema.
  // Pulls positions from:
  //  - the current node's own parts
  //  - all descendant nodes' parts (parent nodes display schemas whose
  //    numeric labels point to children's parts)
  //  - the source node when the schema is inherited (and its descendants)
  // Both the raw value (e.g. "10/1", "1.10") and the trailing-stripped
  // numeric core (e.g. "10*" → "10") are added so the click matcher has
  // multiple shapes to resolve against.
  const positionSet = useMemo(() => {
    const set = new Set<string>();
    function addPart(p: PartFR) {
      const raw = (p.pos || "").trim();
      if (!raw) return;
      set.add(raw);
      const stripped = raw.replace(/\D+$/, "").trim();
      if (stripped && stripped !== raw) set.add(stripped);
    }
    function walk(n: TreeNode) {
      for (const p of n.parts) addPart(p);
      for (const c of n.children) walk(c);
    }
    walk(node);
    if (inheritedFrom) walk(inheritedFrom);
    return set;
  }, [node, inheritedFrom]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 print:hidden">
        <button
          onClick={onClose}
          className="text-xs text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> {s.backToOverview}
        </button>
        <button
          onClick={onPrint}
          className="text-xs text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1.5 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-zinc-100"
        >
          <Printer className="h-3.5 w-3.5" />
          {s.print}
        </button>
      </div>

      {/* Clickable breadcrumb of ancestors */}
      {ancestors.length > 1 && (
        <nav className="flex items-center gap-1.5 text-xs text-zinc-500 mb-3 flex-wrap print:hidden" aria-label="breadcrumb">
          {ancestors.slice(1).map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <button
                onClick={() => onPickNode(a)}
                className="hover:text-accent hover:underline transition-colors truncate max-w-[180px]"
                title={nodeLabel(a, lang)}
              >
                {nodeLabel(a, lang)}
              </button>
              <ChevronRight className="h-3 w-3 text-zinc-300 flex-shrink-0" />
            </span>
          ))}
          <span className="text-zinc-700 font-medium">{primary}</span>
        </nav>
      )}

      <div className="flex flex-wrap items-baseline gap-3 mb-2">
        <span className="font-mono text-sm font-bold text-accent">{node.code}</span>
        <h2 className="text-xl lg:text-2xl font-black text-zinc-950">{primary}</h2>
      </div>
      {secondary && secondary !== primary && (
        <p className="text-xs text-zinc-500 mb-6">{secondary}</p>
      )}

      {/* Schema(s) — single SVG/PNG OR multi-page raster (vintage A300/A350) */}
      {svgPages.length > 0 ? (
        <div className="mb-8 bg-zinc-50 rounded-2xl border border-zinc-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-zinc-100 gap-3">
            <span className="text-xs font-semibold text-zinc-500">
              {s.techSchema}
              {svgPages.length > 1 && (
                <span className="ml-2 text-[10px] text-zinc-400 font-normal">
                  ({svgPages.length} pages)
                </span>
              )}
              {inheritedFrom && (
                <span className="ml-2 text-[10px] text-zinc-400 font-normal">
                  {s.inheritedFrom(nodeLabel(inheritedFrom, lang) || inheritedFrom.code)}
                </span>
              )}
            </span>
            <button
              onClick={() => { setFullscreenIdx(0); setFullscreen(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-accent transition-colors flex-shrink-0"
            >
              <Maximize2 className="h-3 w-3" />
              {s.fullscreen}
            </button>
          </div>
          {svgPages.map((page, idx) => (
            <div key={page} className={idx > 0 ? "border-t border-zinc-100" : ""}>
              {svgPages.length > 1 && (
                <div className="px-4 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider bg-zinc-50">
                  Page {idx + 1} / {svgPages.length}
                </div>
              )}
              <div className="bg-white p-4 flex items-center justify-center" style={{ minHeight: 240 }}>
                <InteractiveSvg
                  filename={page}
                  slug={slug}
                  supabase={supabase}
                  positions={positionSet}
                  highlightPos={highlightPos}
                  onPosClick={(p) => setHighlightPos(p === highlightPos ? null : p)}
                  onMaximize={() => { setFullscreenIdx(idx); setFullscreen(true); }}
                />
              </div>
            </div>
          ))}
          {positionSet.size > 0 && (
            <div className="px-4 py-1.5 bg-zinc-50 border-t border-zinc-100 text-[10px] text-zinc-500 print:hidden">
              {s.schemaHint}
              {highlightPos && (
                <span className="ml-2 inline-flex items-center gap-1 bg-accent/15 text-accent rounded px-1.5 py-0.5 font-bold">
                  {s.highlightedAnnotation(highlightPos)}
                  <button onClick={() => setHighlightPos(null)} className="ml-0.5 hover:text-zinc-900"><X className="h-2.5 w-2.5" /></button>
                </span>
              )}
            </div>
          )}
        </div>
      ) : node.parts.length > 0 ? (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          {s.schemaUnavailable}
        </div>
      ) : null}

      {/* Children navigation */}
      {node.children.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-zinc-950 mb-3">{s.subAssemblies(node.children.length)}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {node.children.map((c, i) => {
              const desc = countDescendants(c);
              return (
                <button
                  key={i}
                  onClick={() => onPickNode(c)}
                  className="text-left bg-zinc-50 hover:bg-white hover:border-accent hover:shadow-soft border border-transparent rounded-xl p-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="font-mono text-xs font-bold text-accent truncate">{c.code}</div>
                    {getNodeSvgs(c).length > 0 && (
                      <span className="text-[9px] uppercase tracking-wider font-bold text-accent">{s.schemaShort}</span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-zinc-950 mb-1">{nodeLabel(c, lang) || "—"}</div>
                  <div className="text-[11px] text-zinc-400">
                    {s.modulePieces(desc.parts)}
                    {c.children.length > 0 && ` · ${s.subElements(c.children.length)}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Parts table */}
      {node.parts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-zinc-950">{s.partsList(node.parts.length)}</h3>
            {!embedded && (
              <button
                onClick={() => onAddAllParts(node.parts)}
                className="text-xs text-zinc-500 hover:text-accent inline-flex items-center gap-1.5 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 print:hidden"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                {s.cartSelectAll}
              </button>
            )}
          </div>
          <PartsTable
            parts={node.parts}
            lang={lang}
            cart={cart}
            onToggle={onToggleCartItem}
            highlightPos={highlightPos}
            onRowClick={(p) => setHighlightPos(p.pos === highlightPos ? null : p.pos.replace(/\D+$/, "").trim())}
            embedded={embedded}
          />
        </div>
      )}

      {/* Fullscreen lightbox — opens the page that was clicked */}
      <AnimatePresence>
        {fullscreen && svgPages[fullscreenIdx] && (
          <FullscreenSchema
            filename={svgPages[fullscreenIdx]}
            slug={slug}
            supabase={supabase}
            label={
              svgPages.length > 1
                ? `${node.code} — ${nodeLabel(node, lang)} (page ${fullscreenIdx + 1}/${svgPages.length})`
                : `${node.code} — ${nodeLabel(node, lang)}`
            }
            lang={lang}
            onClose={() => setFullscreen(false)}
            canDownload={canDownload}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Interactive inline SVG that highlights position labels ─────────────────

function InteractiveSvg({
  filename,
  slug,
  supabase,
  positions,
  highlightPos,
  onPosClick,
  onMaximize,
}: {
  filename: string;
  slug: string;
  supabase: SupabaseClient;
  positions: Set<string>;
  highlightPos: string | null;
  onPosClick: (pos: string) => void;
  onMaximize: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svgText, setSvgText] = useState<string | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const isSvg = isSvgFilename(filename);

  // Fetch the schema — SVG as text (inline render) or PNG/JPG as blob URL
  useEffect(() => {
    let cancelled = false;
    let createdBlobUrl: string | null = null;
    setSvgText(null);
    setImgUrl(null);
    setError(false);

    if (isSvg) {
      fetchSvgText(supabase, slug, filename)
        .then((t) => {
          if (cancelled) return;
          setSvgText(t.replace(/^<\?xml[^>]*\?>\s*/, ""));
        })
        .catch(() => { if (!cancelled) setError(true); });
    } else {
      fetchSchemaAsBlobUrl(supabase, slug, filename)
        .then((url) => {
          if (cancelled) { URL.revokeObjectURL(url); return; }
          createdBlobUrl = url;
          setImgUrl(url);
        })
        .catch(() => { if (!cancelled) setError(true); });
    }
    return () => {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [supabase, slug, filename, isSvg]);

  // After svg renders, attach click handlers to <text> elements whose content matches a position
  useEffect(() => {
    if (!svgText || !containerRef.current) return;
    const root = containerRef.current.querySelector("svg");
    if (!root) return;
    // Iterate <text> only (not tspans) — <text>.textContent already concatenates
    // all child tspans, and a single click handler on the parent <text> covers
    // its full bounding box.
    // PTC Arbortext IsoDraw embeds an accessibility `<desc>` mirror inside
    // each <text> (e.g. `<text><desc>11</desc>11</text>` → textContent="1111"),
    // which would otherwise prevent the regex from matching. Strip metadata
    // children before reading the visible label.
    function visibleText(el: Element): string {
      const clone = el.cloneNode(true) as Element;
      clone.querySelectorAll("desc, title, metadata").forEach((e) => e.remove());
      return (clone.textContent || "").trim();
    }
    const texts = root.querySelectorAll("text");
    texts.forEach((t) => {
      const raw = visibleText(t);
      if (!raw) return;
      // Resolve to a position present in positionSet, trying in order:
      //  1. Exact match (e.g. "10", "10/1", "1.10", "8E")
      //  2. Strip trailing non-digits (e.g. "10*", "12a" → "10", "12")
      //  3. Numeric prefix only (e.g. "10A1B" → "10")
      let pos: string | null = null;
      if (positions.has(raw)) {
        pos = raw;
      } else {
        const stripTail = raw.replace(/\D+$/, "");
        if (stripTail && positions.has(stripTail)) {
          pos = stripTail;
        } else {
          const m = raw.match(/^(\d{1,4})/);
          if (m && positions.has(m[1])) pos = m[1];
        }
      }
      if (!pos) return;
      const el = t as SVGElement;
      el.style.cursor = "pointer";
      el.style.fontWeight = "bold";
      // Force pointer events on — some PTC Arbortext IsoDraw exports set
      // `pointer-events="none"` on a <g> wrapper, which otherwise blocks clicks.
      el.style.pointerEvents = "all";
      el.setAttribute("data-pos", pos);
      if (highlightPos === pos) {
        el.style.fill = "#dc2626"; // red-600
        el.style.fontSize = "1.5em";
      } else {
        el.style.fill = "#d97706"; // amber-600
        el.style.fontSize = "";
      }
      const handler = (e: Event) => {
        e.stopPropagation();
        onPosClick(pos!);
      };
      const prev = (el as any).__posHandler;
      if (prev) el.removeEventListener("click", prev);
      (el as any).__posHandler = handler;
      el.addEventListener("click", handler);
    });
    return () => {
      texts.forEach((t) => {
        const h = (t as any).__posHandler;
        if (h) t.removeEventListener("click", h);
      });
    };
  }, [svgText, positions, highlightPos, onPosClick]);

  if (error) {
    return (
      <div className="text-zinc-400 text-sm py-12 text-center">
        Schéma indisponible.
      </div>
    );
  }
  if (!svgText && !imgUrl) {
    return <div className="text-zinc-300 text-xs py-12 text-center animate-pulse">…</div>;
  }
  // PNG/JPG: render as <img>, no clickable position labels (raster image)
  if (imgUrl) {
    return (
      <div
        className="w-full cursor-zoom-in flex items-center justify-center"
        style={{ maxHeight: 560, minHeight: 200 }}
        onClick={onMaximize}
      >
        <img
          src={imgUrl}
          alt="Schéma technique"
          draggable={false}
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: 552,
            width: "auto",
            height: "auto",
            objectFit: "contain",
          }}
        />
      </div>
    );
  }
  // SVG: render inline with clickable position labels
  return (
    <div
      ref={containerRef}
      className="w-full max-h-[560px] overflow-auto cursor-zoom-in flex items-center justify-center"
      onClick={(e) => {
        const tgt = e.target as HTMLElement;
        if (tgt.tagName.toLowerCase() === "text" || tgt.tagName.toLowerCase() === "tspan") return;
        onMaximize();
      }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svgText! }}
    />
  );
}

// ─── Fullscreen SVG viewer (lightbox with pan/zoom) ──────────────────────────

function FullscreenSchema({
  filename,
  slug,
  supabase,
  label,
  lang,
  onClose,
  canDownload,
}: {
  filename: string;
  slug: string;
  supabase: SupabaseClient;
  label: string;
  lang: "fr" | "en";
  onClose: () => void;
  canDownload?: boolean;
}) {
  const s = STR[lang] || STR.fr;
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [svgText, setSvgText] = useState<string | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const isSvg = isSvgFilename(filename);

  // Fetch schema — SVG inline OR PNG/JPG as blob URL
  useEffect(() => {
    let cancelled = false;
    let createdBlob: string | null = null;
    setSvgText(null);
    setImgUrl(null);
    if (isSvg) {
      fetchSvgText(supabase, slug, filename).then((t) => {
        if (!cancelled) setSvgText(t.replace(/^<\?xml[^>]*\?>\s*/, ""));
      });
    } else {
      fetchSchemaAsBlobUrl(supabase, slug, filename).then((url) => {
        if (cancelled) { URL.revokeObjectURL(url); return; }
        createdBlob = url;
        setImgUrl(url);
      });
    }
    return () => { cancelled = true; if (createdBlob) URL.revokeObjectURL(createdBlob); };
  }, [supabase, slug, filename, isSvg]);

  const handleDownload = async () => {
    let blob: Blob | null = null;
    if (svgText) blob = new Blob([svgText], { type: "image/svg+xml" });
    else if (imgUrl) {
      try { blob = await (await fetch(imgUrl)).blob(); } catch { return; }
    }
    if (!blob) return;
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(8, z + 0.25));
      if (e.key === "-") setZoom((z) => Math.max(0.25, z - 0.25));
      if (e.key === "0") {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setZoom((z) => Math.min(8, Math.max(0.25, z + delta)));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.ox + (e.clientX - dragRef.current.startX),
      y: dragRef.current.oy + (e.clientY - dragRef.current.startY),
    });
  };
  const onMouseUp = () => {
    dragRef.current = null;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-zinc-950/95 backdrop-blur-sm flex flex-col"
    >
      <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-zinc-800">
        <div className="text-white text-sm font-semibold truncate">{label}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-white text-xs font-mono w-14 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(8, z + 0.25))}
            className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
            className="px-3 py-2 rounded-lg bg-zinc-800 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-700"
          >
            {s.reset}
          </button>
          {canDownload && (
            <button
              onClick={handleDownload}
              disabled={!svgText && !imgUrl}
              className="px-3 py-2 rounded-lg bg-zinc-800 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {s.download}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-800 text-white hover:bg-red-500"
            aria-label={s.close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        className="flex-1 overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {svgText ? (
          <div
            draggable={false}
            className="bg-white rounded-lg shadow-2xl"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: dragRef.current ? "none" : "transform 0.12s ease",
              maxWidth: "90vw",
              maxHeight: "85vh",
              overflow: "visible",
              padding: "16px",
            }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: svgText }}
          />
        ) : imgUrl ? (
          <img
            src={imgUrl}
            alt="Schéma technique"
            draggable={false}
            className="bg-white rounded-lg shadow-2xl p-4"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: dragRef.current ? "none" : "transform 0.12s ease",
              maxWidth: "90vw",
              maxHeight: "85vh",
            }}
          />
        ) : (
          <div className="text-zinc-400 text-sm animate-pulse">…</div>
        )}
      </div>
      <div className="text-center text-zinc-500 text-[10px] py-2 uppercase tracking-wider">
        {s.fullscreenHelp}
      </div>
    </motion.div>
  );
}

// ─── Reusable parts table ────────────────────────────────────────────────────

function PartsTable({
  parts,
  lang,
  cart,
  onToggle,
  highlightPos = null,
  onRowClick,
  embedded = false,
}: {
  parts: PartFR[];
  lang: "fr" | "en";
  cart: Map<string, CartItem>;
  onToggle: (p: PartFR) => void;
  highlightPos?: string | null;
  onRowClick?: (p: PartFR) => void;
  embedded?: boolean;
}) {
  const s = STR[lang] || STR.fr;
  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  async function copyPart(sku: string) {
    try {
      await navigator.clipboard.writeText(sku);
      setCopiedSku(sku);
      setTimeout(() => setCopiedSku((c) => (c === sku ? null : c)), 1400);
    } catch (_) {
      /* no-op */
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-zinc-500 text-[11px] uppercase tracking-wider">
          <tr>
            {!embedded && <th className="text-left px-3 py-2.5 font-bold w-8 print:hidden"></th>}
            <th className="text-left px-3 py-2.5 font-bold w-12">{s.pos}</th>
            <th className="text-left px-3 py-2.5 font-bold">{s.partNumber}</th>
            <th className="text-left px-3 py-2.5 font-bold">{s.designation}</th>
            <th className="text-left px-3 py-2.5 font-bold w-20">{s.qty}</th>
            {!embedded && <th className="text-right px-3 py-2.5 font-bold w-32 print:hidden">{s.action}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {parts.map((p, i) => {
            const primary = partLabel(p, lang) || "—";
            const secondary = lang === "fr" ? p.name : p.nameFR;
            const inCart = !!p.partNumber && cart.has(p.partNumber);
            const isCopied = copiedSku === p.partNumber;
            const cleanPos = p.pos.replace(/\D+$/, "").trim();
            const isHighlighted = !!highlightPos && cleanPos === highlightPos;
            return (
              <tr
                key={i}
                onClick={() => onRowClick?.(p)}
                ref={(el) => {
                  if (isHighlighted && el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }}
                className={`transition-colors cursor-pointer ${
                  isHighlighted
                    ? "bg-amber-100 ring-2 ring-amber-400 ring-inset"
                    : inCart
                    ? "bg-accent/5"
                    : "hover:bg-zinc-50/60"
                }`}
              >
                {!embedded && (
                  <td className="px-3 py-2.5 print:hidden" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={inCart}
                      onChange={() => onToggle(p)}
                      className="h-4 w-4 rounded border-zinc-300 text-accent focus:ring-accent cursor-pointer accent-accent"
                      aria-label={`Sélectionner ${p.partNumber}`}
                    />
                  </td>
                )}
                <td className="px-3 py-2.5 text-zinc-400 font-mono text-xs">{p.pos || "—"}</td>
                <td className="px-3 py-2.5">
                  <div className="inline-flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-zinc-950">{p.partNumber}</span>
                    {p.version && p.version !== "0" && (
                      <span className="text-[10px] text-zinc-400">v{p.version}</span>
                    )}
                    {p.partNumber && (
                      <button
                        onClick={(e) => { e.stopPropagation(); copyPart(p.partNumber); }}
                        className={`inline-flex items-center justify-center h-6 w-6 rounded transition-colors print:hidden ${
                          isCopied
                            ? "bg-green-100 text-green-700"
                            : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                        }`}
                        title={isCopied ? s.copied : s.copy}
                        aria-label={s.copy}
                      >
                        {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-zinc-700">
                  <div className="font-medium">{primary}</div>
                  {secondary && secondary !== primary && (
                    <div className="text-[11px] text-zinc-400 mt-0.5">{secondary}</div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-zinc-600 font-mono text-xs">{p.qty || "—"}</td>
                {!embedded && (
                  <td className="px-3 py-2.5 text-right print:hidden" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onToggle(p)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                        inCart
                          ? "bg-accent text-white"
                          : "bg-zinc-950 text-white hover:bg-accent"
                      }`}
                    >
                      {inCart ? <Check className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                      {inCart ? s.inCart : s.devis}
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
