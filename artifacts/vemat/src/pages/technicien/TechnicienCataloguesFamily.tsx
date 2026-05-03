import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, AlertCircle, BookOpen } from "lucide-react";
import { TechnicienLayout } from "./TechnicienLayout";
import { supabaseTech } from "@/lib/supabase";
import { useLang } from "@/i18n/I18nProvider";
import { listCatalogues, type CatalogueIndexEntry } from "@/lib/cataloguesApi";
import { familyOf, familyBySlug } from "@/lib/cataloguesFamilies";

export default function TechnicienCataloguesFamily() {
  const { lang } = useLang();
  const [, params] = useRoute<{ family: string }>("/espace-technicien/catalogues/groupe/:family");
  const familySlug = (params?.family || "").toLowerCase();
  const meta = familyBySlug(familySlug);

  const [machines, setMachines] = useState<CatalogueIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCatalogues(supabaseTech)
      .then((res) => { if (!cancelled) setMachines(res.machines); })
      .catch((e: Error) => { if (!cancelled) setError(e.message || "Erreur"); });
    return () => { cancelled = true; };
  }, []);

  const filtered = machines && meta
    ? machines.filter((m) => familyOf(m.slug) === meta.key).sort((a, b) => a.label.localeCompare(b.label))
    : [];

  if (!meta) {
    return (
      <TechnicienLayout>
        <div className="p-10 max-w-3xl bg-zinc-50 min-h-screen">
          <Link href="/espace-technicien/catalogues" className="text-sm text-orange-500 hover:underline inline-flex items-center gap-1 mb-4">
            <ArrowLeft className="h-3 w-3" /> {lang === "fr" ? "Retour" : "Back"}
          </Link>
          <h1 className="text-xl font-bold text-zinc-950">
            {lang === "fr" ? "Famille inconnue" : "Unknown family"} : {familySlug}
          </h1>
        </div>
      </TechnicienLayout>
    );
  }

  return (
    <TechnicienLayout>
      <div className="p-6 lg:p-10 max-w-[1400px] mx-auto bg-zinc-50 min-h-screen">
        <Link
          href="/espace-technicien/catalogues"
          className="text-xs text-zinc-500 hover:text-orange-500 inline-flex items-center gap-1 mb-4 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          {lang === "fr" ? "Toutes les familles" : "All families"}
        </Link>

        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.25em] font-black text-orange-500 mb-2">
            {meta.key}
          </p>
          <h1 className="text-3xl lg:text-4xl font-black text-zinc-950 mb-2">
            {lang === "fr" ? meta.labelFr : meta.labelEn}
          </h1>
          <p className="text-zinc-500 text-sm max-w-2xl">
            {lang === "fr" ? meta.descriptionFr : meta.descriptionEn}
          </p>
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

        {machines !== null && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-10 text-center">
            <BookOpen className="h-10 w-10 text-zinc-300 mx-auto mb-4" />
            <p className="font-bold text-zinc-700 mb-1">
              {lang === "fr" ? `Aucune machine ${meta.key} pour l'instant` : `No ${meta.key} machines yet`}
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => (
              <Link
                key={m.slug}
                href={`/espace-technicien/catalogues/${encodeURIComponent(m.slug)}`}
                className="group bg-white rounded-2xl border border-zinc-200 p-6 hover:border-orange-400 hover:shadow-soft transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold mb-1">
                      {m.brand || "Terex"}
                    </p>
                    <h3 className="text-xl font-black text-zinc-950 group-hover:text-orange-500 transition-colors">
                      {m.label}
                    </h3>
                  </div>
                  <ArrowRight className="h-5 w-5 text-zinc-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                </div>
                <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
                  {typeof m.nodeCount === "number" && (
                    <span>{m.nodeCount} {lang === "fr" ? "sous-assemblages" : "sub-assemblies"}</span>
                  )}
                  {typeof m.schemaCount === "number" && (
                    <span>{m.schemaCount} {lang === "fr" ? "schémas" : "diagrams"}</span>
                  )}
                  {typeof m.partCount === "number" && (
                    <span>
                      {m.partCount.toLocaleString(lang === "fr" ? "fr-FR" : "en-US")} {lang === "fr" ? "pièces" : "parts"}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </TechnicienLayout>
  );
}
