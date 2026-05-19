import { useSEO, useScrollTop } from "@/hooks/use-seo";
import { SectionHeader } from "@/components/SectionHeader";
import { CTASection } from "@/components/CTASection";
import { BrandCard } from "@/components/BrandCard";
import { OfficesSection } from "@/components/OfficesSection";
import { useLang } from "@/i18n/I18nProvider";
import { brands } from "@/data/brands";
import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import img from "@/assets/images/african-presence.png";
import domenicoImg from "@/assets/domenico.jpg";

export default function APropos() {
  const { t, tArray } = useLang();
  useSEO(t("seo.apropos.title"), t("seo.apropos.desc"));
  useScrollTop();

  return (
    <div className="min-h-screen bg-white selection:bg-accent selection:text-white">
      {/* Refined Hero Header */}
      <div className="pt-24 md:pt-40 pb-12 md:pb-20 border-b border-zinc-100">
        <div className="container mx-auto px-4 md:px-6">
          <SectionHeader 
            title={t("apropos.title")} 
            subtitle={t("apropos.sub")} 
            alignment="left"
          />
        </div>
      </div>

      {/* History & Mission Section */}
      <section className="py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-32 items-start">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="space-y-12"
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-accent mb-6 block">
                  {t("apropos.historyTitle")}
                </span>
                <h2 className="text-3xl md:text-5xl font-heading font-extrabold text-zinc-950 mb-8 tracking-tighter leading-tight">
                  Depuis 2008, <br/>une expertise éprouvée.
                </h2>
                <p className="text-lg text-zinc-500 leading-relaxed font-medium">
                  {t("apropos.historyText")}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-heading font-extrabold text-zinc-950 mb-4 tracking-tight">
                    {t("apropos.missionTitle")}
                  </h4>
                  <p className="text-zinc-500 leading-relaxed text-sm font-medium">
                    {t("apropos.missionText")}
                  </p>
                </div>
                <div>
                  <h4 className="text-lg font-heading font-extrabold text-zinc-950 mb-4 tracking-tight">
                    {t("apropos.visionTitle")}
                  </h4>
                  <p className="text-zinc-500 leading-relaxed text-sm font-medium">
                    {t("apropos.visionText")}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-heading font-extrabold text-zinc-950 mb-6 tracking-tight">
                  {t("apropos.valuesTitle")}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {tArray("apropos.values").map((v, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent/60" />
                      <span className="text-[10px] font-bold text-zinc-950 uppercase tracking-wide">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-xl"
            >
              <img src={img} className="w-full h-full object-cover" alt="African Presence" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* President's Word - Refined */}
      <section className="py-24 md:py-32 bg-zinc-950 relative overflow-hidden">
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-32">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="flex-1 max-w-2xl"
            >
              <Quote className="w-8 h-8 md:w-10 md:h-10 text-accent/40 mb-8" />
              
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-accent/80 mb-6 block">
                {t("apropos.presidentTitle")}
              </span>
              
              <p className="text-xl md:text-3xl font-heading font-extrabold text-zinc-100 mb-10 tracking-tight leading-relaxed italic">
                "{t("apropos.presidentWord")}"
              </p>
              
              <div className="flex flex-col">
                <span className="text-zinc-100 text-lg font-black uppercase tracking-widest mb-1">
                  {t("apropos.presidentName")}
                </span>
                <span className="text-zinc-500 font-bold uppercase tracking-[0.2em] text-[10px]">
                  Fondateur & Président, Vemat Group
                </span>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="flex-1 w-full max-w-xs md:max-w-sm"
            >
              <div className="relative aspect-[3/4] rounded-[2rem] md:rounded-3xl overflow-hidden shadow-2xl grayscale hover:grayscale-0 transition-all duration-700">
                <img 
                  src={domenicoImg} 
                  alt={t("apropos.presidentName")} 
                  className="w-full h-full object-cover" 
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Our offices around Africa */}
      <OfficesSection />

      {/* Network Section - Refined */}
      <section className="py-32 bg-white">
        <div className="container mx-auto px-4 md:px-6 mb-20">
          <div className="max-w-3xl">
            <SectionHeader 
              title={t("apropos.networkTitle")} 
              subtitle={t("apropos.networkText")} 
              alignment="left"
            />
          </div>
        </div>

        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {brands.map((b, i) => (
              <BrandCard key={b.id} brand={b} index={i} />
            ))}
          </div>
        </div>
      </section>

      <CTASection
        title={t("apropos.ctaTitle")}
        description={t("apropos.ctaDesc")}
        primaryCta={{ label: t("apropos.ctaBtn"), href: "/contact" }}
        background="dark"
      />
    </div>
  );
}
