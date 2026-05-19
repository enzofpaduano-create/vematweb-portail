import { useSEO, useScrollTop } from "@/hooks/use-seo";
import { Link } from "wouter";
import { CTASection } from "@/components/CTASection";
import { useLang } from "@/i18n/I18nProvider";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  Wrench,
  Settings,
  Lightbulb,
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import venteImg from "@/assets/services/vente.jpg";
import savImg from "@/assets/services/sav.png";
import piecesImg from "@/assets/services/pieces.jpg";
import conseilImg from "@/assets/services/conseil.jpg";

export default function Services() {
  const { t } = useLang();
  useSEO(t("seo.services.title"), t("seo.services.desc"));
  useScrollTop();

  const serviceIcons = [
    ShoppingCart,
    Wrench,
    Settings,
    Lightbulb
  ];

  const serviceImages = [
    venteImg,
    savImg,
    piecesImg,
    conseilImg
  ];

  const services = [0, 1, 2, 3].map((i) => ({
    title: t(`services.list.${i}.title`),
    description: t(`services.list.${i}.description`),
    icon: serviceIcons[i],
    image: serviceImages[i],
    details: [
      "Expertise technique approfondie",
      "Solutions sur mesure",
      "Support réactif 24/7",
      "Qualité certifiée constructeur"
    ]
  }));

  return (
    <div className="min-h-screen bg-white selection:bg-accent selection:text-white">
      {/* Refined Services Hero */}
      <div className="relative h-[70vh] min-h-[550px] overflow-hidden bg-zinc-950 flex items-center">
        <motion.div 
          initial={{ scale: 1.05, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.25 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&q=80')] bg-cover bg-center mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950/20 to-white" />
        
        <div className="container mx-auto px-4 md:px-6 relative z-10 pt-20">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
            >
              <span className="text-accent text-[10px] font-black uppercase tracking-[0.4em] mb-6 inline-block px-4 py-2 bg-accent/5 rounded-full border border-accent/10">
                Vemat Excellence
              </span>
              <h1 className="text-5xl md:text-8xl font-heading font-extrabold text-zinc-100 mb-8 tracking-tighter leading-[1.1] uppercase">
                {t("services.pageTitle")}
              </h1>
              <p className="text-zinc-400 text-lg md:text-xl font-medium leading-relaxed max-w-2xl">
                {t("services.pageSub")}
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Services Breakdown */}
      <section className="py-24 relative -mt-16 z-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 gap-24">
            {services.map((service, index) => {
              const Icon = service.icon;
              const isEven = index % 2 === 0;

              return (
                <div 
                  key={index} 
                  className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-12 lg:gap-24 bg-white p-8 lg:p-16 rounded-[2.5rem] shadow-soft border border-zinc-100`}
                >
                  {/* Text Content */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="flex-1"
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-14 h-14 rounded-2xl bg-zinc-950 flex items-center justify-center text-accent">
                        <Icon className="w-7 h-7" />
                      </div>
                      <span className="text-zinc-100 font-heading font-black text-4xl tracking-tighter stroke-zinc-200" style={{ WebkitTextStroke: '1px #e4e4e7', color: 'transparent' }}>0{index + 1}</span>
                    </div>

                    <h2 className="text-3xl md:text-4xl font-heading font-extrabold text-zinc-950 mb-6 tracking-tight uppercase">
                      {service.title}
                    </h2>
                    
                    <p className="text-lg text-zinc-500 font-medium leading-relaxed mb-8">
                      {service.description}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
                      {service.details.map((detail, dIdx) => (
                        <div key={dIdx} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-accent/60" />
                          <span className="text-zinc-600 font-bold text-[10px] uppercase tracking-wider">{detail}</span>
                        </div>
                      ))}
                    </div>

                    <Link href="/contact">
                      <motion.button
                        whileHover={{ x: 5 }}
                        className="group flex items-center gap-3 text-accent font-black uppercase tracking-[0.2em] text-[10px]"
                      >
                        En savoir plus
                        <ArrowRight className="w-3 h-3 transition-transform" />
                      </motion.button>
                    </Link>
                  </motion.div>

                  {/* Image Visual */}
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="flex-1 w-full"
                  >
                    <div className="relative aspect-[16/10] rounded-2xl overflow-hidden shadow-xl">
                      <img 
                        src={service.image}
                        alt={service.title}
                        className="w-full h-full object-cover transition-transform duration-1000 hover:scale-105"
                      />
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <CTASection
        title={t("services.ctaTitle")}
        description={t("services.ctaDesc")}
        primaryCta={{ label: t("services.ctaBtn"), href: "/contact" }}
        background="dark"
      />
    </div>
  );
}
