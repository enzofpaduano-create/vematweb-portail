import { motion } from "framer-motion";
import { ArrowRight, Package } from "lucide-react";
import { Link } from "wouter";
import type { SubCategory } from "@/data/products";
import { useLang } from "@/i18n/I18nProvider";
import { productDetails } from "@/data/productDetails";
import { toMetric } from "@/lib/units";
import terexLogo from "@/assets/brands/terex.png";
import tadanoLogo from "@/assets/brands/tadano-demag.png";
import jlgLogo from "@/assets/brands/jlg.png";
import magniLogo from "@/assets/brands/magni.png";
import mecalacLogo from "@/assets/brands/mecalac.png";
import fuchsLogo from "@/assets/brands/fuchs.svg";

function getBrandLogo(brand: string): { src: string; darkBg: boolean } | null {
  const b = brand.toLowerCase();
  if (b.includes("fuchs")) return { src: fuchsLogo, darkBg: true };
  if (b.includes("terex")) return { src: terexLogo, darkBg: false };
  if (b.includes("tadano")) return { src: tadanoLogo, darkBg: false };
  if (b.includes("jlg")) return { src: jlgLogo, darkBg: false };
  if (b.includes("magni")) return { src: magniLogo, darkBg: false };
  if (b.includes("mecalac")) return { src: mecalacLogo, darkBg: false };
  return null;
}

// Priority spec groups — first matching key wins per group; first 3 matches are shown
const SPEC_GROUPS = [
  // Cranes — capacity
  {
    label: { fr: "Capacité max.", en: "Max Capacity" },
    keys: ["Capacité max.", "Capacité nominale", "Max Capacity", "Max. Crane Capacity", "Capacity", "Capacité de levage", "Charge maximale", "Max. Load Moment"],
  },
  // Cranes — boom length
  {
    label: { fr: "Longueur flèche", en: "Boom Length" },
    keys: ["Longueur max. de la flèche principale", "Longueur flèche principale", "Max Jib Length", "Longueur de flèche", "Extension flèche / Jib"],
  },
  // Cranes — hook height / reach
  {
    label: { fr: "Portée / Hauteur", en: "Reach / Height" },
    keys: ["Hauteur de tête max.", "Max. Tip Height", "Portée max.", "Capacity at Max Radius", "Hauteur max. crochet"],
  },
  // Nacelles — platform height
  {
    label: { fr: "Hauteur max.", en: "Platform Height" },
    keys: ["Hauteur max. plateforme"],
  },
  // Nacelles — horizontal outreach
  {
    label: { fr: "Portée horizontale", en: "Horizontal Outreach" },
    keys: ["Max Working Outreach", "Horizontal Outreach"],
  },
  // Nacelles / access — platform capacity (weight)
  {
    label: { fr: "Capacité plateforme", en: "Platform Capacity" },
    keys: ["Platform Capacity Unrestricted", "Capacité max. plateforme"],
  },
  // All — machine weight (Fuchs: "Poids de service sans équipements")
  {
    label: { fr: "Poids machine", en: "Machine Weight" },
    keys: ["Poids de service sans équipements", "Poids en ordre de marche", "Poids de la machine"],
  },
  // All — max reach (Fuchs: "Portée", Construction: "Portée maximum")
  {
    label: { fr: "Portée max.", en: "Max Reach" },
    keys: ["Portée", "Portée maximum"],
  },
  // Fuchs — engine power
  {
    label: { fr: "Puissance moteur", en: "Engine Power" },
    keys: ["Puissance du moteur UE-niveau V"],
  },
  // Construction loaders — tipping load
  {
    label: { fr: "Charge de basculement", en: "Tipping Load" },
    keys: ["Charge de basculement châssis droit"],
  },
];

function getTopSpecs(slug: string, lang: "fr" | "en"): Array<{ label: string; value: string }> {
  const details = productDetails[slug];
  if (!details) return [];

  const result: Array<{ label: string; value: string }> = [];

  if (details.specifications) {
    const specs = details.specifications;
    for (const group of SPEC_GROUPS) {
      if (result.length >= 3) break;
      for (const key of group.keys) {
        const raw = specs[key];
        if (raw) {
          const value = typeof raw === "string" ? raw : (raw[lang] || raw.fr);
          result.push({ label: group.label[lang], value });
          break;
        }
      }
    }
  }

  // Fallback: fill remaining slots with bilingual features
  if (result.length < 3 && details.features) {
    const featureList = Array.isArray(details.features)
      ? details.features
      : (details.features[lang] || details.features.fr || []);
    const needed = 3 - result.length;
    featureList.slice(0, needed).forEach((f) => {
      result.push({ label: lang === "fr" ? "Caractéristique" : "Feature", value: f });
    });
  }

  return result.slice(0, 3);
}

interface ProductCatalogProps {
  subcategories: SubCategory[];
}

export function ProductCatalog({ subcategories }: ProductCatalogProps) {
  const { lang, t } = useLang();

  return (
    <div className="space-y-16">
      {subcategories.map((sub, index) => (
        <motion.div
          key={sub.slug}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: index * 0.05 }}
          id={sub.slug}
          className="bg-white border border-zinc-200 overflow-hidden scroll-mt-28"
          data-testid={`subcategory-${sub.slug}`}
        >
          <div className="border-b border-zinc-200 bg-gradient-to-r from-zinc-950 to-zinc-800 text-white p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 min-w-[260px]">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-accent font-semibold">
                    {sub.brand}
                  </span>
                  <span className="h-px w-8 bg-zinc-600" />
                  <span className="text-xs text-zinc-400 font-medium">
                    {sub.totalCount} {sub.totalCount > 1 ? t("catalog.products") : t("catalog.product")}
                  </span>
                </div>
                <h3 className="font-heading text-2xl md:text-3xl font-bold leading-tight">
                  {sub.title[lang]}
                </h3>
                {sub.description && (
                  <p className="mt-3 text-zinc-300 text-sm md:text-base max-w-3xl">
                    {sub.description[lang]}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-4">
                {(() => {
                  const logo = getBrandLogo(sub.brand);
                  if (!logo) return null;
                  return (
                    <div className={`rounded-lg px-5 py-3 shadow-sm ${logo.darkBg ? "bg-zinc-800" : "bg-white"}`}>
                      <img
                        src={logo.src}
                        alt={sub.brand}
                        className="h-12 w-auto object-contain"
                        draggable={false}
                      />
                    </div>
                  );
                })()}
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 bg-accent text-white px-5 py-3 text-sm font-semibold hover:bg-accent/90 transition-colors"
                  data-testid={`button-quote-${sub.slug}`}
                >
                  {t("catalog.quote")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          {sub.models.length > 0 ? (
            <div className="p-6 md:p-8">
              <h4 className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold mb-4">
                {t("catalog.models")}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {sub.models.map((model) => {
                  const specs = model.slug ? getTopSpecs(model.slug, lang) : [];
                  const hasSpecs = specs.length > 0;

                  return model.slug ? (
                    <Link
                      key={model.name}
                      href={`/produit/${model.slug}`}
                      className="group relative flex flex-col border border-zinc-200 bg-white hover:border-accent hover:bg-zinc-950 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl"
                      data-testid={`model-${model.name}`}
                    >
                      {/* Model name row */}
                      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-4">
                        <Package className="h-4 w-4 sm:h-5 sm:w-5 text-accent shrink-0 group-hover:scale-110 transition-transform duration-300" />
                        <span className="font-mono text-xs sm:text-sm font-bold text-zinc-900 group-hover:text-white break-all transition-colors duration-300 min-w-0">
                          {model.name}
                        </span>
                        <ArrowRight className="hidden sm:block h-4 w-4 text-accent ml-auto opacity-0 group-hover:opacity-100 transform translate-x-3 group-hover:translate-x-0 transition-all duration-300" />
                      </div>

                      {/* Expandable specs */}
                      {hasSpecs && (
                        <div className="overflow-hidden max-h-0 group-hover:max-h-40 transition-all duration-500 ease-out delay-200">
                          <div className="border-t border-zinc-800 mx-4 pt-3 pb-4 space-y-2.5">
                            {specs.map((s) => (
                              <div key={s.label}>
                                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-0.5">
                                  {s.label}
                                </p>
                                <p className="text-xs font-extrabold text-white leading-tight">
                                  {toMetric(s.value)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Link>
                  ) : (
                    <div
                      key={model.name}
                      className="group flex items-center gap-2 border border-zinc-200 bg-zinc-50 px-3 py-3 hover:border-zinc-300 transition-colors"
                      data-testid={`model-${model.name}`}
                    >
                      <Package className="h-4 w-4 text-zinc-400 shrink-0" />
                      <span className="font-mono text-sm font-semibold text-zinc-900 truncate">
                        {model.name}
                      </span>
                    </div>
                  );
                })}
                {sub.models.length < sub.totalCount && (
                  <Link
                    href="/contact"
                    className="flex items-center justify-center gap-2 border border-dashed border-zinc-300 px-3 py-3 text-sm text-zinc-600 hover:border-accent hover:text-accent transition-colors"
                    data-testid={`more-${sub.slug}`}
                  >
                    +{sub.totalCount - sub.models.length} {t("catalog.more")}
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 md:p-8 bg-zinc-50">
              <p className="text-sm text-zinc-600">
                {t("catalog.fullList")}{" "}
                <Link
                  href="/contact"
                  className="text-accent font-semibold hover:underline"
                >
                  {t("catalog.contactUs")}
                </Link>
                .
              </p>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
