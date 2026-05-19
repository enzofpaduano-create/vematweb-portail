import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, Globe, ShieldCheck, HardHat, MapPin, FileText, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSEO, useScrollTop } from "@/hooks/use-seo";
import { HeroSection } from "@/components/HeroSection";
import { CategoryCard } from "@/components/CategoryCard";
import { ServiceCard } from "@/components/ServiceCard";
import { BrandStrip } from "@/components/BrandStrip";
import { CTASection } from "@/components/CTASection";
import { SectionHeader } from "@/components/SectionHeader";
import { OfficesSection } from "@/components/OfficesSection";
import { categories } from "@/data/categories";
import { useLang } from "@/i18n/I18nProvider";
import { heroSlides } from "@/data/heroSlides";
import { BlogTicker } from "@/components/BlogTicker";

import africanImg from "@/assets/images/african-presence.png";

export default function Home() {
  const { t } = useLang();
  useSEO(t("seo.home.title"), t("seo.home.desc"));
  useScrollTop();

  const services = (
    [0, 1, 2, 3].map((i) => ({
      title: t(`services.list.${i}.title`),
      description: t(`services.list.${i}.description`),
    }))
  );

  return (
    <div className="min-h-screen">
      <HeroSection
        title={t("home.heroTitle")}
        subtitle={t("home.heroSubtitle")}
        images={heroSlides}
        intervalMs={5000}
        eyebrow={t("home.heroEyebrow")}
        primaryCta={{ label: t("home.heroPrimary"), href: "/grues" }}
        secondaryCta={{ label: t("home.heroSecondary"), href: "/contact" }}
      />

      <BlogTicker />

      {/* Categories Grid */}
      <section className="py-24 bg-zinc-50">
        <div className="container mx-auto px-4 md:px-6">
          <SectionHeader
            title={t("home.equipmentTitle")}
            subtitle={t("home.equipmentSubtitle")}
            alignment="center"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {categories.map((category, index) => (
              <CategoryCard
                key={category.slug}
                index={index}
                title={t(`categories.${category.tKey}.title`)}
                description={t(`categories.${category.tKey}.description`)}
                image={category.image}
                href={category.href}
              />
            ))}
          </div>
        </div>
      </section>

      <BrandStrip />

      <OfficesSection />

      {/* Maps Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <SectionHeader
            title={t("home.mapTitle")}
            subtitle={t("home.mapSub")}
            alignment="center"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="relative h-[500px] md:h-[600px] rounded-[3rem] overflow-hidden shadow-2xl border border-zinc-100 group"
          >
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3327.098854486264!2d-7.7059007!3d33.4988051!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xda62b8f3182b7b7%3A0x24a8382e0dcf197a!2sVemat!5e0!3m2!1sfr!2ses!4v1776970279331!5m2!1sfr!2ses"
              width="100%"
              height="100%"
              style={{ border: 0, filter: "grayscale(0.2) contrast(1.1)" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Vemat Location"
              className="absolute inset-0"
            ></iframe>
            
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/20 via-transparent to-transparent pointer-events-none" />
            
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
              <motion.a
                href="https://www.google.es/maps/place/Vemat/@33.4988051,-7.7059007,17z/data=!4m15!1m8!3m7!1s0xda62b88d3d82e8d:0xff07a03e55b31821!2sVEMAT,+Maroc!3b1!8m2!3d33.4988362!4d-7.7034864!16s%2Fg%2F11b8tj4nvh!3m5!1s0xda62b8f3182b7b7:0x24a8382e0dcf197a!8m2!3d33.499145!4d-7.7040357!16s%2Fg%2F11ddwx4mn_?entry=ttu"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-4 bg-white text-zinc-950 px-10 py-5 rounded-full font-black uppercase tracking-[0.2em] text-xs shadow-2xl hover:bg-accent hover:text-white transition-all duration-300 pointer-events-auto"
              >
                <MapPin className="h-4 w-4" />
                {t("home.mapButton")}
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Value Props / Services */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
            <div className="lg:col-span-1">
              <SectionHeader
                title={t("home.expertiseTitle")}
                subtitle={t("home.expertiseSubtitle")}
              />
              <Link href="/services" className="inline-flex items-center text-accent font-bold hover:text-accent/80 transition-colors">
                <span>{t("home.viewServices")}</span>
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {services.map((service, index) => (
                <ServiceCard
                  key={index}
                  index={index}
                  title={service.title}
                  description={service.description}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* African Presence */}
      <section className="relative py-48 bg-white overflow-hidden">
        <motion.div
          initial={{ scale: 1.2, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 0.85 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="absolute inset-0 z-0"
        >
          <img
            src={africanImg}
            alt=""
            className="w-full h-full object-cover"
          />
        </motion.div>
        {/* Left → soft white veil so the headline stays readable; right → image fully visible */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/70 to-transparent z-1" />
        <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-white/80 to-transparent z-1" />

        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <h2 className="text-3xl md:text-7xl font-heading font-extrabold text-zinc-950 mb-8 leading-tight tracking-tighter">
                {t("home.africaTitle")} <span className="text-accent underline decoration-accent/30 underline-offset-8">{t("home.africaTitleAccent")}</span>.
              </h2>
              <p className="text-lg md:text-2xl text-zinc-600 mb-12 leading-relaxed font-medium">
                {t("home.africaSubtitle")}
              </p>
              <Link href="/a-propos">
                <Button size="lg" className="bg-zinc-950 text-white hover:bg-accent hover:text-white rounded-full font-extrabold px-10 h-16 uppercase tracking-widest transition-all duration-300 hover:scale-105">
                  {t("home.africaCta")}
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Why Vemat - Refined Grid */}
      <section className="py-32 bg-white relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
        <div className="container mx-auto px-4 md:px-6">
          <SectionHeader title={t("home.whyTitle")} alignment="center" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mt-20">
            {[
              { icon: Globe, title: t("home.whyNetworkTitle"), text: t("home.whyNetworkText"), delay: 0.1 },
              { icon: HardHat, title: t("home.whyExpertTitle"), text: t("home.whyExpertText"), delay: 0.2 },
              { icon: ShieldCheck, title: t("home.whyTrustTitle"), text: t("home.whyTrustText"), delay: 0.3 }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: item.delay, ease: "easeOut" }}
                className="group p-10 rounded-3xl border border-zinc-100 hover:border-accent/20 transition-all duration-500 hover:shadow-soft"
              >
                <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mb-8 text-zinc-950 group-hover:bg-accent group-hover:text-white transition-all duration-500 shadow-sm">
                  <item.icon className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-heading font-extrabold mb-5 tracking-tight group-hover:text-accent transition-colors">
                  {item.title}
                </h3>
                <p className="text-zinc-500 leading-relaxed font-medium">
                  {item.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Forms CTA Section */}
      <section className="py-24 bg-white border-t border-zinc-200">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">Services en ligne</p>
            <h2 className="text-3xl md:text-4xl font-heading font-extrabold text-zinc-950 tracking-tight">
              Besoin d'un devis ou d'une intervention ?
            </h2>
            <p className="text-zinc-600 mt-4 max-w-xl mx-auto">
              Déposez votre demande directement en ligne. Notre équipe vous répond sous 24h.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {/* Devis */}
            <Link href="/demande-devis">
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="group relative bg-white border border-zinc-200 hover:border-accent/40 hover:shadow-soft rounded-2xl p-8 cursor-pointer transition-all"
              >
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-5">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-xl font-black text-zinc-950 mb-2">Demande de devis</h3>
                <p className="text-sm text-zinc-600 leading-relaxed mb-6">
                  Grues, nacelles, élévateurs, pièces de rechange — obtenez un devis personnalisé pour votre projet.
                </p>
                <div className="inline-flex items-center gap-2 text-accent font-bold text-sm group-hover:gap-3 transition-all">
                  Faire une demande <ArrowRight className="w-4 h-4" />
                </div>
              </motion.div>
            </Link>

            {/* Intervention */}
            <Link href="/demande-intervention">
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="group relative bg-zinc-950 border border-zinc-950 hover:border-accent rounded-2xl p-8 cursor-pointer transition-all"
              >
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-5">
                  <Wrench className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-black text-white mb-2">Demande d'intervention</h3>
                <p className="text-sm text-zinc-300 leading-relaxed mb-6">
                  Panne, maintenance, entretien — signalez un problème sur votre machine avec photos et documents.
                </p>
                <div className="inline-flex items-center gap-2 text-accent font-bold text-sm group-hover:gap-3 transition-all">
                  Signaler un problème <ArrowRight className="w-4 h-4" />
                </div>
              </motion.div>
            </Link>
          </div>
        </div>
      </section>

      <CTASection
        title={t("home.ctaTitle")}
        description={t("home.ctaDesc")}
        primaryCta={{ label: t("home.ctaPrimary"), href: "/contact" }}
        secondaryCta={{ label: t("home.ctaSecondary"), href: "/grues" }}
      />
    </div>
  );
}
