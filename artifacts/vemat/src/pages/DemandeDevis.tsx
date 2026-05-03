import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import {
  CheckCircle2, ChevronDown, Loader2, ArrowLeft, FileText, ShoppingCart, X, Package, Wrench,
} from "lucide-react";
import vematLogo from "@/assets/vemat-logo.png";
import { supabasePublic } from "@/lib/supabase";
import { sendDevisEmail } from "@/lib/emailService";
import { catalog, type CategorySlug } from "@/data/products";

const CATEGORY_LABELS: Record<CategorySlug, string> = {
  grues: "Grues",
  nacelles: "Nacelles & plateformes élévatrices",
  elevateurs: "Élévateurs télescopiques",
  construction: "Matériaux de construction",
};

function genRef() {
  return `DEV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
}

type CartItem = { sku: string; title: string; brand: string; quantity: number };

// ── Field components ──────────────────────────────────────────────────────────

function SelectField({
  label,
  value,
  onChange,
  children,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-zinc-700">
        {label}{required && <span className="text-accent ml-1">*</span>}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-950 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent pr-10"
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
      </div>
    </div>
  );
}

function InputField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-zinc-700">
        {label}{required && <span className="text-accent ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-950 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DemandeDevis() {
  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState("");

  // Cart pre-fill (from Pièces de rechange)
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("vemat_devis_cart");
    if (saved) {
      try { setCartItems(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  // true = "pièces de rechange" mode, false = "machine/équipement" mode
  const fromCart = cartItems.length > 0;

  // Contact
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Machine picker (only used in machine mode)
  const [category, setCategory] = useState<CategorySlug | "">("");
  const [subCatSlug, setSubCatSlug] = useState("");
  const [modelName, setModelName] = useState("");
  const [quantity, setQuantity] = useState("1");

  // Shared details
  const [location, setLocation] = useState("");
  const [desiredDate, setDesiredDate] = useState("");
  const [notes, setNotes] = useState("");

  const subCategories = useMemo(
    () => (category ? catalog[category] ?? [] : []),
    [category]
  );

  const models = useMemo(() => {
    if (!subCatSlug) return [];
    const sub = subCategories.find((s) => s.slug === subCatSlug);
    return sub?.models ?? [];
  }, [subCatSlug, subCategories]);

  const selectedSub = subCategories.find((s) => s.slug === subCatSlug);

  function handleCategoryChange(v: string) {
    setCategory(v as CategorySlug | "");
    setSubCatSlug("");
    setModelName("");
  }

  function handleSubCatChange(v: string) {
    setSubCatSlug(v);
    setModelName("");
  }

  function resetForm() {
    setStep("form");
    setCompanyName(""); setContactName(""); setContactPhone(""); setContactEmail("");
    setCategory(""); setSubCatSlug(""); setModelName(""); setQuantity("1");
    setLocation(""); setDesiredDate(""); setNotes("");
    setCartItems([]);
    localStorage.removeItem("vemat_devis_cart");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const ref = genRef();

    // Build notes: cart items (if any) + user notes
    const cartNote = cartItems.length > 0
      ? `Pièces de rechange sélectionnées :\n${cartItems.map(i => `- ${i.title} (${i.sku}) x${i.quantity}`).join("\n")}`
      : "";
    const fullNotes = [cartNote, notes.trim()].filter(Boolean).join("\n\n");

    const payload = {
      reference: ref,
      company_name: companyName.trim(),
      contact_name: contactName.trim(),
      contact_phone: contactPhone.trim(),
      contact_email: contactEmail.trim(),
      // In cart mode, mark as spare parts; in machine mode, use the catalog selection
      product_category: fromCart
        ? "Pièces de rechange"
        : (category ? CATEGORY_LABELS[category] : null),
      product_brand: fromCart ? null : (selectedSub?.title.fr ?? null),
      product_model: fromCart ? null : (modelName || null),
      quantity: fromCart
        ? cartItems.reduce((sum, i) => sum + i.quantity, 0) || 1
        : (parseInt(quantity) || 1),
      cart_items: cartItems.length > 0 ? cartItems : null,
      location: location.trim() || null,
      desired_date: desiredDate || null,
      notes: fullNotes || null,
      status: "nouveau",
    };

    const { error: dbError } = await supabasePublic
      .from("form_devis")
      .insert(payload);

    if (dbError) {
      setError("Une erreur est survenue. Veuillez réessayer ou nous contacter directement.");
      setLoading(false);
      return;
    }

    // Send email notification (non-blocking)
    await sendDevisEmail({
      ...payload,
      product_category: payload.product_category ?? undefined,
      product_brand: payload.product_brand ?? undefined,
      product_model: payload.product_model ?? undefined,
      location: payload.location ?? undefined,
      desired_date: payload.desired_date ?? undefined,
      notes: payload.notes ?? undefined,
    });

    // Clear the cart from localStorage now that it's submitted
    localStorage.removeItem("vemat_devis_cart");

    setReference(ref);
    setStep("success");
    setLoading(false);
  }

  // ── Success screen ──────────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg text-center">
          <img src={vematLogo} alt="Vemat" className="h-20 md:h-24 mx-auto mb-10" />
          <div className="bg-white border border-zinc-200 rounded-2xl p-10 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-zinc-950 mb-2">Demande envoyée !</h1>
            <p className="text-zinc-600 text-sm mb-6">
              Nous avons bien reçu votre demande de devis. Notre équipe vous contactera dans les plus brefs délais.
            </p>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl px-6 py-4 mb-8">
              <p className="text-xs text-zinc-500 mb-1">Référence de votre demande</p>
              <p className="text-2xl font-black text-zinc-950 font-mono tracking-wider">{reference}</p>
              <p className="text-xs text-zinc-500 mt-1">Conservez cette référence pour tout suivi</p>
            </div>
            <div className="space-y-3">
              <Link href="/">
                <div className="flex items-center justify-center gap-2 w-full bg-accent hover:bg-accent/90 text-white font-bold text-sm px-5 py-3 rounded-xl transition-colors cursor-pointer">
                  <ArrowLeft className="w-4 h-4" />
                  Retour au site Vemat
                </div>
              </Link>
              <button
                onClick={resetForm}
                className="w-full text-zinc-500 hover:text-zinc-950 text-sm py-2 transition-colors"
              >
                Soumettre une autre demande
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/">
            <img src={vematLogo} alt="Vemat" className="h-20 md:h-24 mx-auto mb-6 cursor-pointer" />
          </Link>
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-full px-4 py-1.5 mb-4">
            {fromCart
              ? <><Package className="w-3.5 h-3.5 text-accent" /><span className="text-xs font-bold text-accent uppercase tracking-widest">Devis pièces de rechange</span></>
              : <><FileText className="w-3.5 h-3.5 text-accent" /><span className="text-xs font-bold text-accent uppercase tracking-widest">Demande de devis</span></>
            }
          </div>
          <h1 className="text-2xl font-black text-zinc-950">
            {fromCart ? "Récapitulatif de votre panier" : "Obtenez un devis personnalisé"}
          </h1>
          <p className="text-zinc-600 text-sm mt-2">
            {fromCart
              ? "Vérifiez vos pièces puis remplissez vos coordonnées. Notre équipe vous répond sous 24h."
              : "Sélectionnez l'équipement souhaité. Notre équipe vous répond sous 24h."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── MODE A: PIÈCES DE RECHANGE (cart) ─────────────────────────── */}
          {fromCart && (
            <div className="bg-white border border-accent/30 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-accent" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-accent">Pièces sélectionnées</h2>
                </div>
                <span className="text-xs text-zinc-600 bg-zinc-100 rounded-full px-2.5 py-0.5 font-semibold">
                  {cartItems.length} référence{cartItems.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={item.sku} className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-950 font-semibold truncate">{item.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{item.brand} · Réf. {item.sku} · Qté : {item.quantity}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCartItems((prev) => prev.filter((i) => i.sku !== item.sku))}
                      className="text-zinc-400 hover:text-accent transition-colors flex-shrink-0"
                      aria-label="Retirer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              {cartItems.length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-2">
                  Panier vide. <Link href="/pieces-de-rechange" className="text-accent hover:underline font-semibold">Retourner au catalogue</Link>
                </p>
              )}
            </div>
          )}

          {/* ── MODE B: MACHINE / ÉQUIPEMENT ──────────────────────────────── */}
          {!fromCart && (
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-5">
                <Wrench className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">01 — Machine / équipement souhaité</h2>
              </div>
              <div className="space-y-4">
                <SelectField label="Catégorie" value={category} onChange={handleCategoryChange} required>
                  <option value="">— Sélectionnez une catégorie —</option>
                  {(Object.keys(CATEGORY_LABELS) as CategorySlug[]).map((k) => (
                    <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
                  ))}
                </SelectField>

                {category && (
                  <SelectField label="Type / Gamme" value={subCatSlug} onChange={handleSubCatChange}>
                    <option value="">— Sélectionnez un type —</option>
                    {subCategories.map((s) => (
                      <option key={s.slug} value={s.slug}>{s.title.fr}</option>
                    ))}
                  </SelectField>
                )}

                {subCatSlug && models.length > 0 && (
                  <SelectField label="Modèle" value={modelName} onChange={setModelName}>
                    <option value="">— Sélectionnez un modèle (optionnel) —</option>
                    {models.map((m) => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                  </SelectField>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-zinc-700">
                    Quantité <span className="text-accent ml-1">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    required
                    className="bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent w-32"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── COORDONNÉES (both modes) ───────────────────────────────────── */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-5">
              {fromCart ? "01" : "02"} — Vos coordonnées
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <InputField label="Société" value={companyName} onChange={setCompanyName} placeholder="Nom de votre entreprise" required />
              </div>
              <InputField label="Nom & Prénom" value={contactName} onChange={setContactName} placeholder="Mohamed El Fassi" required />
              <InputField label="Téléphone" type="tel" value={contactPhone} onChange={setContactPhone} placeholder="+212 6 XX XX XX XX" required />
              <div className="sm:col-span-2">
                <InputField label="Adresse email" type="email" value={contactEmail} onChange={setContactEmail} placeholder="contact@votre-societe.ma" required />
              </div>
            </div>
          </div>

          {/* ── INFORMATIONS COMPLÉMENTAIRES (both modes) ─────────────────── */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-5">
              {fromCart ? "02" : "03"} — Informations complémentaires
            </h2>
            <div className="space-y-4">
              <InputField label="Localisation / Chantier" value={location} onChange={setLocation} placeholder="Casablanca, Maroc" />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-zinc-700">Date souhaitée</label>
                <input
                  type="date"
                  value={desiredDate}
                  onChange={(e) => setDesiredDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-zinc-700">Notes / Précisions</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    fromCart
                      ? "Informations supplémentaires sur votre commande, délai souhaité…"
                      : "Durée de location souhaitée, contraintes de chantier, spécifications particulières…"
                  }
                  rows={4}
                  className="bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-950 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-accent/10 border border-accent/40 rounded-xl px-4 py-3 text-sm text-accent">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (fromCart && cartItems.length === 0)}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-60 text-white font-black text-sm px-6 py-4 rounded-xl transition-colors shadow-md shadow-accent/20"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Envoi en cours…</>
              : "Envoyer ma demande de devis"
            }
          </button>

          <p className="text-center text-xs text-zinc-500 pb-4">
            En soumettant ce formulaire, vous acceptez d'être contacté par l'équipe Vemat Group.
          </p>
        </form>
      </div>
    </div>
  );
}
