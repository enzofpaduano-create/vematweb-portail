import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { useLang } from "@/i18n/I18nProvider";
import type { Brand } from "@/data/brands";

type Props = {
  brand: Brand;
  index?: number;
};

export function BrandCard({ brand, index = 0 }: Props) {
  const { lang, t } = useLang();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="group bg-white border border-zinc-200 hover:border-accent shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col"
    >
      <a
        href={brand.website}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-zinc-50 border-b border-zinc-200 h-72 flex items-center justify-center p-10 group-hover:bg-white transition-colors"
        aria-label={`${t("brands.visitSite")} ${brand.name}`}
      >
        <img
          src={brand.logo}
          alt={brand.name}
          className="max-h-44 w-auto object-contain"
          loading="lazy"
        />
      </a>
      <div className="p-8 flex flex-col flex-grow">
        <div className="flex flex-wrap gap-2 mb-4">
          {brand.categories.map((cat) => (
            <span
              key={cat}
              className="text-[10px] font-bold uppercase tracking-widest text-accent bg-accent/10 px-2.5 py-1"
            >
              {t(`brands.categoryLabels.${cat}`)}
            </span>
          ))}
        </div>
        <h3 className="text-xl font-heading font-bold text-zinc-950 mb-2 leading-tight">
          {brand.name}
        </h3>
        <p className="text-sm font-medium text-zinc-500 mb-4 uppercase tracking-wide">
          {brand.tagline[lang]}
        </p>
        <p className="text-zinc-700 leading-relaxed mb-6 flex-grow">
          {brand.description[lang]}
        </p>
        <a
          href={brand.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-accent font-bold text-sm uppercase tracking-wide hover:gap-3 transition-all self-start"
        >
          {t("brands.visitSite")}
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </motion.div>
  );
}
