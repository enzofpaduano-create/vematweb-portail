import { useRoute } from "wouter";
import { DGGuard } from "./DGGuard";
import { supabaseDG } from "@/lib/supabase";
import CatalogueViewer from "@/components/CatalogueViewer";

/** Convert a slug like "trt-50-55us" → "TRT 50 55US" for display. */
function slugToLabel(slug: string): string {
  return slug
    .split("-")
    .map((seg) => seg.toUpperCase())
    .join(" ");
}

export default function DGCatalogue() {
  const [, params] = useRoute<{ slug: string }>("/direction/catalogues/:slug");
  const slug = params?.slug || "";

  return (
    <DGGuard>
      <CatalogueViewer
        slug={slug}
        supabase={supabaseDG}
        machineLabel={slugToLabel(slug)}
        backHref="/direction/catalogues"
        cartStorageKey="vemat_dg_devis_cart"
        embedded
        canDownload
      />
    </DGGuard>
  );
}
