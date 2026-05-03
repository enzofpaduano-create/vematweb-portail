import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, Phone, Mail, LayoutGrid, Wrench, FileText, Package } from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useLang } from "@/i18n/I18nProvider";
import vematLogo from "@/assets/vemat-logo.png";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();
  const { lang, setLang, t } = useLang();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isHome = location === "/";
  const isScrolled = scrolled || !isHome;

  // Main navigation = product/info pages only. Action shortcuts (devis, pièces
  // détachées, SAV) live in the right-hand action area for clarity.
  const navLinks = [
    { href: "/grues",                    label: t("nav.grues") },
    { href: "/nacelles",                 label: t("nav.nacelles") },
    { href: "/elevateurs-telescopiques", label: t("nav.elevateurs") },
    { href: "/construction",             label: t("nav.construction") },
    { href: "/services",                 label: t("nav.services") },
    { href: "/blog",                     label: t("nav.blog") },
    { href: "/a-propos",                 label: t("nav.apropos") },
  ];

  const LangSwitch = ({ dark = false }: { dark?: boolean }) => (
    <div
      className={`inline-flex items-center overflow-hidden rounded-full border transition-all duration-300 ${
        dark
          ? "border-zinc-200 bg-white/50 backdrop-blur-sm"
          : "border-white/20 bg-white/10 backdrop-blur-md"
      }`}
    >
      {(["fr", "en"] as const).map((code) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
              active
                ? "bg-accent text-accent-foreground shadow-sm"
                : dark
                ? "text-zinc-600 hover:text-zinc-950"
                : "text-white/70 hover:text-white"
            }`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-700 px-4 md:px-8 pt-4 pointer-events-none">
      <div
        className={`w-full transition-all duration-700 pointer-events-auto ${
          isScrolled
            ? "bg-white/70 backdrop-blur-xl border border-zinc-200/50 py-3.5 px-6 xl:px-8 rounded-full shadow-2xl"
            : "bg-transparent py-4 px-0"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className={`transition-all duration-500 ${isScrolled ? "scale-95" : "scale-100"}`}>
              <img
                src={vematLogo}
                alt="Vemat Group"
                className={`w-auto object-contain transition-all duration-500 ${
                  isScrolled
                    ? "h-10 md:h-11 brightness-0"
                    : isHome
                      ? "h-16 md:h-20 brightness-0 invert drop-shadow-[0_0_20px_rgba(255,255,255,0.6)]"
                      : "h-11 md:h-12 brightness-0 invert drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                }`}
              />
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex min-w-0 flex-1 items-center justify-end gap-3 xl:gap-5">
            {/* Nav links */}
            <ul className="flex min-w-0 items-center gap-0.5 xl:gap-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`relative px-2 py-1.5 text-[11px] xl:text-[12px] font-bold uppercase tracking-wider transition-all duration-300 rounded-full whitespace-nowrap ${
                      location === link.href
                        ? "text-accent"
                        : isScrolled
                        ? "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100"
                        : "text-white/90 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Right actions */}
            <div className="flex shrink-0 items-center gap-2 border-l border-zinc-200/50 pl-3">
              {/* LinkedIn */}
              <a
                href="https://www.linkedin.com/company/vemat-group-ltd/posts/?feedView=all"
                target="_blank"
                rel="noopener noreferrer"
                className={`transition-all duration-300 hover:text-accent hover:scale-110 ${isScrolled ? "text-zinc-400" : "text-white/70"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>

              <LangSwitch dark={isScrolled} />

              {/* Divider */}
              <div className={`w-px h-5 ${isScrolled ? "bg-zinc-200" : "bg-white/20"}`} />

              {/* Devis machine — texte + icône */}
              <Link
                href="/demande-devis"
                title={t("nav.devisRequest")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                  isScrolled
                    ? "text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>{t("nav.devisShort")}</span>
              </Link>

              {/* Pièces détachées — texte + icône */}
              <Link
                href="/pieces-de-rechange"
                title={t("nav.pdrAction")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                  isScrolled
                    ? "text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <Package className="w-3.5 h-3.5 shrink-0" />
                <span>{t("nav.pdrAction")}</span>
              </Link>

              {/* SAV — bouton principal rouge (action urgente) */}
              <Link
                href="/demande-intervention"
                className="flex items-center gap-1.5 rounded-full bg-accent hover:bg-accent/90 px-3 py-1.5 text-[11px] font-bold text-accent-foreground transition-all shadow-sm"
              >
                <Wrench className="w-3.5 h-3.5 shrink-0" />
                <span>{t("nav.sav")}</span>
              </Link>

              {/* Portail — icône seule */}
              <Link
                href="/espace-vemat"
                title={t("nav.portal")}
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                  isScrolled
                    ? "text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </Link>
            </div>
          </nav>

          {/* Mobile Nav */}
          <div className="lg:hidden flex items-center gap-3">
            {/* SAV visible mobile */}
            <Link
              href="/demande-intervention"
              className="flex items-center gap-1.5 rounded-full bg-accent hover:bg-accent/90 px-3 py-1.5 text-[11px] font-bold text-accent-foreground transition-all"
            >
              <Wrench className="w-3.5 h-3.5" />
              {t("nav.sav")}
            </Link>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className={`rounded-full transition-colors ${isScrolled ? "text-zinc-950" : "text-white"}`}>
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-white text-zinc-950 border-zinc-100 w-[300px]">
                <div className="flex flex-col h-full mt-8">
                  <div className="mb-12 p-2 bg-zinc-950 inline-block rounded-lg self-start">
                    <img src={vematLogo} alt="Vemat Group" className="h-8 w-auto" />
                  </div>

                  <nav className="flex flex-col gap-5">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`text-lg font-black uppercase tracking-widest transition-colors hover:text-accent ${
                          location === link.href ? "text-accent" : "text-zinc-950"
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>

                  <div className="mt-10 pt-8 border-t border-zinc-100 space-y-3">
                    <Link href="/demande-devis" className="flex items-center gap-2 text-sm font-bold text-zinc-700 hover:text-zinc-950 transition-colors">
                      <FileText className="w-4 h-4" />
                      {t("nav.devisRequest")}
                    </Link>
                    <Link href="/pieces-de-rechange" className="flex items-center gap-2 text-sm font-bold text-zinc-700 hover:text-zinc-950 transition-colors">
                      <Package className="w-4 h-4" />
                      {t("nav.pdrAction")}
                    </Link>
                    <Link href="/demande-intervention" className="flex items-center gap-2 text-sm font-bold text-accent hover:text-accent/80 transition-colors">
                      <Wrench className="w-4 h-4" />
                      {t("nav.interventionSav")}
                    </Link>
                    <Link href="/espace-vemat" className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-800 transition-colors">
                      <LayoutGrid className="w-4 h-4" />
                      {t("nav.portal")}
                    </Link>
                  </div>

                  <div className="mt-6">
                    <LangSwitch dark />
                  </div>

                  <div className="mt-auto pb-12 space-y-5">
                    <div className="flex items-center gap-4 text-zinc-500 group">
                      <div className="p-3 rounded-full bg-zinc-50 group-hover:bg-accent/20 group-hover:text-accent transition-all">
                        <Phone className="h-5 w-5" />
                      </div>
                      <span className="font-bold">+212 650 14 64 64</span>
                    </div>
                    <div className="flex items-center gap-4 text-zinc-500 group">
                      <div className="p-3 rounded-full bg-zinc-50 group-hover:bg-accent/20 group-hover:text-accent transition-all">
                        <Mail className="h-5 w-5" />
                      </div>
                      <span className="font-bold">contact@vemat.ma</span>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
