import { useEffect, useState } from "react";
import { Link } from "wouter";
import { BookOpen, ArrowRight, AlertCircle, ConstructionIcon, Truck, Layers } from "lucide-react";
const Crane = ConstructionIcon;
import { DGGuard } from "./DGGuard";
import { DGLayout } from "./DGLayout";
import { supabaseDG } from "@/lib/supabase";
import { useLang } from "@/i18n/I18nProvider";
import { listCatalogues, type CatalogueIndexEntry } from "@/lib/cataloguesApi";
import { groupByFamily, type CatalogueFamily } from "@/lib/cataloguesFamilies";

const FAMILY_ICONS: Record<CatalogueFamily, typeof BookOpen> = {
  TRT: Crane,
  RT: Crane,
  A: Crane,
  RC: Crane,
  TCC: Truck,
  Lattice: Layers,
  Other: BookOpen,
};

// Tailwind needs full class names so we map per family explicitly.
const FAMILY_BG: Record<CatalogueFamily, string> = {
  TRT: "bg-amber-50 group-hover:bg-amber-100 text-amber-700",
  RT: "bg-blue-50 group-hover:bg-blue-100 text-blue-700",
  A: "bg-emerald-50 group-hover:bg-emerald-100 text-emerald-700",
  RC: "bg-rose-50 group-hover:bg-rose-100 text-rose-700",
  TCC: "bg-violet-50 group-hover:bg-violet-100 text-violet-700",
  Lattice: "bg-slate-100 group-hover:bg-slate-200 text-slate-700",
  Other: "bg-zinc-100 group-hover:bg-zinc-200 text-zinc-700",
};

export default function DGCatalogues() {
  const { lang } = useLang();
  const [machines, setMachines] = useState<CatalogueIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCatalogues(supabaseDG)
      .then((res) => { if (!cancelled) setMachines(res.machines); })
      .catch((e: Error) => { if (!cancelled) setError(e.message || "Erreur"); });
    return () => { cancelled = true; };
  }, []);

  const groups = machines ? groupByFamily(machines) : [];
  const totalParts = machines?.reduce((s, m) => s + (m.partCount ?? 0), 0) ?? 0;
  const totalSchemas = machines?.reduce((s, m) => s + (m.schemaCount ?? 0), 0) ?? 0;

  return (
    <DGGuard>
      <DGLayout>
        <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.25em] font-black text-purple-600 mb-2">
              {lang === "fr" ? "Catalogues techniques" : "Technical catalogs"}
            </p>
            <h1 className="text-3xl lg:text-4xl font-black text-zinc-950 mb-2">
              {lang === "fr" ? "Catalogues internes" : "Internal catalogs"}
            </h1>
            <p className="text-zinc-500 text-sm max-w-2xl">
              {lang === "fr"
                ? "Catalogues de pièces détachées Terex Crespellano organisés par famille — accessibles uniquement à la Direction, aux Managers et aux Techniciens."
                : "Terex Crespellano spare parts catalogues, grouped by family — restricted to Direction, Managers and Technicians."}
            </p>
            {machines !== null && machines.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-xs text-zinc-500">
                <span><b className="text-zinc-900">{machines.length}</b> {lang === "fr" ? "machines" : "machines"}</span>
                <span><b className="text-zinc-900">{totalParts.toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}</b> {lang === "fr" ? "pièces référencées" : "parts referenced"}</span>
                <span><b className="text-zinc-900">{totalSchemas.toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}</b> {lang === "fr" ? "schémas techniques" : "technical diagrams"}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-3 mb-6">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="font-bold text-red-700">{lang === "fr" ? "Erreur" : "Error"}</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          {machines === null && !error && (
            <div className="text-zinc-400 text-sm py-20 text-center animate-pulse">
              {lang === "fr" ? "Chargement…" : "Loading…"}
            </div>
          )}

          {machines !== null && machines.length === 0 && (
            <div className="bg-white rounded-2xl border border-zinc-200 p-10 text-center">
              <BookOpen className="h-10 w-10 text-zinc-300 mx-auto mb-4" />
              <p className="font-bold text-zinc-700 mb-1">
                {lang === "fr" ? "Aucun catalogue pour l'instant" : "No catalogues yet"}
              </p>
              <p className="text-sm text-zinc-500">
                {lang === "fr"
                  ? "Les catalogues apparaîtront ici dès qu'ils seront scrapés et uploadés."
                  : "Catalogues will appear here once scraped and uploaded."}
              </p>
            </div>
          )}

          {groups.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {groups.map(({ family, meta, items }) => {
                const Icon = FAMILY_ICONS[family];
                const itemsParts = items.reduce((s, m) => s + (m.partCount ?? 0), 0);
                return (
                  <Link
                    key={family}
                    href={`/direction/catalogues/groupe/${meta.slug}`}
                    className="group bg-white rounded-2xl border border-zinc-200 p-6 hover:border-purple-400 hover:shadow-soft transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${FAMILY_BG[family]} transition-colors`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <ArrowRight className="h-5 w-5 text-zinc-300 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="text-xl font-black text-zinc-950 group-hover:text-purple-600 transition-colors mb-1">
                      {lang === "fr" ? meta.labelFr : meta.labelEn}
                    </h3>
                    <p className="text-xs text-zinc-500 mb-4 leading-snug">
                      {lang === "fr" ? meta.descriptionFr : meta.descriptionEn}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                      <span><b className="text-zinc-900">{items.length}</b> {lang === "fr" ? (items.length === 1 ? "machine" : "machines") : items.length === 1 ? "machine" : "machines"}</span>
                      {itemsParts > 0 && (
                        <span>{itemsParts.toLocaleString(lang === "fr" ? "fr-FR" : "en-US")} {lang === "fr" ? "pièces" : "parts"}</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </DGLayout>
    </DGGuard>
  );
}
