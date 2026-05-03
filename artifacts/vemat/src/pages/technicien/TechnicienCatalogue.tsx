import { useRoute } from "wouter";
import { TechnicienLayout } from "./TechnicienLayout";
import { supabaseTech } from "@/lib/supabase";
import CatalogueViewer from "@/components/CatalogueViewer";

function slugToLabel(slug: string): string {
  return slug
    .split("-")
    .map((seg) => seg.toUpperCase())
    .join(" ");
}

export default function TechnicienCatalogue() {
  const [, params] = useRoute<{ slug: string }>("/espace-technicien/catalogues/:slug");
  const slug = params?.slug || "";

  // We render the viewer outside the dark TechnicienLayout main bg by giving it
  // its own light background — the viewer expects a zinc-50 page.
  return (
    <TechnicienLayout>
      <CatalogueViewer
        slug={slug}
        supabase={supabaseTech}
        machineLabel={slugToLabel(slug)}
        backHref="/espace-technicien/catalogues"
        cartStorageKey="vemat_tech_devis_cart"
        embedded
      />
    </TechnicienLayout>
  );
}
