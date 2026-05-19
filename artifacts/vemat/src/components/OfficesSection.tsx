import { motion } from "framer-motion";
import { ArrowUpRight, Building2, MapPin, Globe2 } from "lucide-react";
import { AfricaMap } from "@/components/AfricaMap";
import { useLang } from "@/i18n/I18nProvider";
import { offices, ACTIVE_COUNTRY_COUNT } from "@/data/offices";

const iconForType = {
  hq: Building2,
  branch: MapPin,
  partner: Globe2,
} as const;

export function OfficesSection() {
  const { t, lang } = useLang();

  return (
    <section className="relative py-24 md:py-32 bg-white overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(24,24,27,1) 1px, transparent 1px), linear-gradient(90deg, rgba(24,24,27,1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="container relative mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[10px] font-black uppercase tracking-[0.4em] text-accent mb-6 block"
          >
            {t("offices.eyebrow")}
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="text-4xl md:text-6xl font-heading font-extrabold text-zinc-950 tracking-tighter leading-[1.05]"
          >
            {t("offices.title")}{" "}
            <span className="text-accent">{t("offices.titleAccent")}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-lg md:text-xl text-zinc-600 mt-7 leading-relaxed font-medium"
          >
            {t("offices.subtitle")}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="lg:col-span-7 relative rounded-[2rem] border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-4 md:p-6 shadow-sm"
          >
            <AfricaMap />
          </motion.div>

          <div className="lg:col-span-5 space-y-2 overflow-hidden">
            {offices.map((o, i) => {
              const Icon = iconForType[o.type];
              const isHQ = o.type === "hq";
              return (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.6, ease: "easeOut" }}
                  className={`group relative p-4 rounded-2xl border transition-all duration-500 ${
                    isHQ
                      ? "bg-gradient-to-br from-accent/10 via-accent/5 to-white border-accent/50 hover:border-accent shadow-sm"
                      : "bg-white border-zinc-200 hover:border-accent/40 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-500 ${
                        isHQ
                          ? "bg-accent text-white shadow-md shadow-accent/30"
                          : "bg-zinc-100 text-accent group-hover:bg-accent group-hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <h3 className="text-base font-heading font-extrabold text-zinc-950 tracking-tight leading-tight">
                          {o.city}
                        </h3>
                        <span
                          className={`text-[8px] font-black uppercase tracking-[0.2em] shrink-0 ${
                            isHQ ? "text-accent" : "text-zinc-500"
                          }`}
                        >
                          {o.tagline[lang]}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-700 font-semibold">
                        {o.country[lang]}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1 leading-snug line-clamp-2">
                        {o.description[lang]}
                      </p>
                      {o.partnerUrl && (
                        <a
                          href={o.partnerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 mt-2 group/partner"
                        >
                          {o.partnerLogo && (
                            <img
                              src={o.partnerLogo}
                              alt={o.partnerName ?? ""}
                              className="h-11 w-auto object-contain shrink-0 transition-transform duration-300 group-hover/partner:scale-105"
                              draggable={false}
                            />
                          )}
                          <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.2em] text-accent group-hover/partner:text-zinc-950 transition-colors">
                            {o.partnerName}
                            <ArrowUpRight className="h-3 w-3" />
                          </span>
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-200 mt-16 md:mt-20 rounded-2xl overflow-hidden border border-zinc-200"
        >
          {[
            { v: String(offices.length), l: t("offices.statOffices") },
            { v: `${ACTIVE_COUNTRY_COUNT}`, l: t("offices.statCountries") },
            { v: "2", l: t("offices.statContinents") },
            { v: "24/7", l: t("offices.statSupport") },
          ].map((s, i) => (
            <div key={i} className="bg-white p-8 text-center">
              <div className="text-4xl md:text-5xl font-heading font-extrabold text-accent">
                {s.v}
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-bold mt-3">
                {s.l}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
