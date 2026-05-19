import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  FileText, Wrench, Search, ChevronDown, ChevronRight, CheckCircle2,
  ArrowRight, RefreshCw, Phone, Mail, MapPin, Calendar, Hash, Building2, Paperclip,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { AdminGuard } from "./AdminGuard";
import { supabaseAdmin } from "@/lib/supabase";
import type { PublicDevisRequest, PublicInterventionRequest, FormDevisStatus, FormInterventionStatus, InterventionUrgency, Technician } from "@/lib/database.types";
import { isMachineCategory } from "@/lib/constants";
import { useLang } from "@/i18n/I18nProvider";

type Tab = "devis" | "interventions";

// ── Status helpers ────────────────────────────────────────────────────────────
function getDevisStatus(t: (k: string) => string): Record<FormDevisStatus, { label: string; color: string }> {
  return {
    nouveau: { label: t("portal.demandes.statusNew"), color: "bg-sky-100 text-sky-700" },
    traite: { label: t("portal.demandes.statusDone"), color: "bg-zinc-100 text-zinc-600" },
    converti: { label: t("portal.demandes.statusConverted"), color: "bg-emerald-100 text-emerald-700" },
  };
}

function getIntervStatus(t: (k: string) => string): Record<FormInterventionStatus, { label: string; color: string }> {
  return {
    nouveau: { label: t("portal.demandes.statusNew"), color: "bg-orange-100 text-orange-700" },
    traite: { label: t("portal.demandes.statusDone"), color: "bg-zinc-100 text-zinc-600" },
    cree: { label: t("portal.demandes.statusRepairCreated"), color: "bg-emerald-100 text-emerald-700" },
  };
}

function getUrgencyLabels(t: (k: string) => string): Record<InterventionUrgency, { label: string; color: string }> {
  return {
    normale: { label: t("portal.demandes.urgencyNormal"), color: "bg-zinc-100 text-zinc-600" },
    urgente: { label: t("portal.demandes.urgencyUrgent"), color: "bg-amber-100 text-amber-700" },
    tres_urgente: { label: t("portal.demandes.urgencyVeryUrgent"), color: "bg-red-100 text-red-700" },
  };
}

// ── Row: Devis ────────────────────────────────────────────────────────────────
function DevisRow({ item, onMarkDone }: {
  item: PublicDevisRequest;
  onMarkDone: (id: string, status: FormDevisStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [, setLocation] = useLocation();
  const { lang, t } = useLang();
  const DEVIS_STATUS = getDevisStatus(t);
  const s = DEVIS_STATUS[item.status];

  const createCommandeFromDevis = async () => {
    setCreating(true);
    try {
      // 1. Find or create company
      const { data: existingCompany } = await supabaseAdmin
        .from("companies")
        .select("id")
        .ilike("name", item.company_name)
        .maybeSingle();

      let companyId: string;
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const { data: newCompany, error: compError } = await supabaseAdmin
          .from("companies")
          .insert({ name: item.company_name, rc: null, ice: null, address: null, city: null, country: "MA", phone: item.contact_phone || null })
          .select("id")
          .single();
        if (compError || !newCompany) { setCreating(false); return; }
        companyId = newCompany.id;
      }

      // 2. Build order items — use cart_items JSON if available (pièces de rechange)
      const orderItems = item.cart_items && item.cart_items.length > 0
        ? item.cart_items.map((ci) => ({
            part_number: ci.sku,
            description: `${ci.title}${ci.brand ? ` — ${ci.brand}` : ""}`,
            quantity: ci.quantity,
          }))
        : item.product_model
        ? [{ part_number: "", description: [item.product_category, item.product_brand, item.product_model].filter(Boolean).join(" — "), quantity: item.quantity ?? 1 }]
        : item.product_category
        ? [{ part_number: "", description: item.product_category, quantity: item.quantity ?? 1 }]
        : [];

      // 3. Create devis_request
      const now = new Date();
      const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const rand = String(Math.floor(1000 + Math.random() * 9000));
      const reference = `CMD-${ymd}-${rand}`;

      const { data: newOrder, error: orderError } = await supabaseAdmin
        .from("devis_requests")
        .insert({
          company_id: companyId,
          reference,
          status: "en_traitement",
          notes: item.notes ?? "",
          items: orderItems as unknown as import("@/lib/database.types").Json,
        })
        .select("id")
        .single();

      if (orderError || !newOrder) { setCreating(false); return; }

      // 4. Mark form_devis as converted + link to new order
      await supabaseAdmin
        .from("form_devis")
        .update({ status: "converti", converted_to_order_id: newOrder.id } as Record<string, unknown>)
        .eq("id", item.id);
      onMarkDone(item.id, "converti");

      // 5. Navigate to new order detail
      setLocation(`/espace-manager/commandes/${newOrder.id}`);
    } catch (err) {
      console.error("Erreur création commande:", err);
      setCreating(false);
    }
  };

  return (
    <div className={`border-b border-zinc-100 last:border-0 transition-colors ${item.status === "nouveau" ? "bg-sky-50/40" : "bg-white"}`}>
      {/* Header row */}
      <button
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm font-bold text-zinc-800">{item.reference}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
          </div>
          <p className="text-sm text-zinc-600 mt-0.5 truncate">
            <span className="font-semibold">{item.company_name}</span>
            {item.contact_name && <span className="text-zinc-400"> · {item.contact_name}</span>}
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
          {item.product_brand && (
            <p className="text-xs text-zinc-500">{item.product_brand} {item.product_model && `· ${item.product_model}`}</p>
          )}
          <p className="text-xs text-zinc-400">
            {new Date(item.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />}
      </button>

      {/* Expanded details */}
      {open && (
        <div className="px-5 pb-5 bg-zinc-50 border-t border-zinc-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
            {/* Contact */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t("portal.demandes.contactSection")}</p>
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />{item.company_name}
              </div>
              {item.contact_name && (
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <Hash className="w-3.5 h-3.5 text-zinc-400 shrink-0" />{item.contact_name}
                </div>
              )}
              {item.contact_phone && (
                <a href={`tel:${item.contact_phone}`} className="flex items-center gap-2 text-sm text-sky-600 hover:underline">
                  <Phone className="w-3.5 h-3.5 shrink-0" />{item.contact_phone}
                </a>
              )}
              {item.contact_email && (
                <a href={`mailto:${item.contact_email}`} className="flex items-center gap-2 text-sm text-sky-600 hover:underline">
                  <Mail className="w-3.5 h-3.5 shrink-0" />{item.contact_email}
                </a>
              )}
            </div>

            {/* Machine */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t("portal.demandes.machineSection")}</p>
              {item.product_category && (
                <div className="text-sm text-zinc-700">{item.product_category}</div>
              )}
              {item.product_brand && (
                <div className="text-sm font-semibold text-zinc-800">{item.product_brand}</div>
              )}
              {item.product_model && (
                <div className="text-sm text-zinc-700">{t("portal.demandes.modelLabel")} : {item.product_model}</div>
              )}
              <div className="text-sm text-zinc-700">{t("portal.demandes.quantityLabel")} : <span className="font-bold">{item.quantity}</span></div>
            </div>

            {/* Details */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t("portal.demandes.detailsSection")}</p>
              {item.location && (
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />{item.location}
                </div>
              )}
              {item.desired_date && (
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  {new Date(item.desired_date).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </div>
              )}
              {item.notes && (
                <p className="text-sm text-zinc-600 italic">{item.notes}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-zinc-200">
            {item.status === "nouveau" && (
              <button
                onClick={() => onMarkDone(item.id, "traite")}
                className="flex items-center gap-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />{t("portal.demandes.markDone")}
              </button>
            )}
            {item.status !== "converti" && (
              <button
                onClick={createCommandeFromDevis}
                disabled={creating}
                className="flex items-center gap-1.5 bg-accent hover:bg-accent/80 text-accent-foreground text-xs font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                {creating ? t("portal.demandes.creating") : t("portal.demandes.createOrder")}
              </button>
            )}
            {item.status === "converti" && item.converted_to_order_id && (
              <button
                onClick={() => setLocation(`/espace-manager/commandes/${item.converted_to_order_id}`)}
                className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-3 py-2 rounded-lg transition-colors hover:bg-emerald-100"
              >
                <ArrowRight className="w-3.5 h-3.5" />{t("portal.demandes.viewCreatedOrder")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Row: Intervention ─────────────────────────────────────────────────────────
function InterventionRow({ item, onMarkDone, technicians }: {
  item: PublicInterventionRequest;
  onMarkDone: (id: string, status: FormInterventionStatus) => void;
  technicians: Technician[];
}) {
  const [open, setOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [, setLocation] = useLocation();
  const { lang, t } = useLang();
  const INTERV_STATUS = getIntervStatus(t);
  const URGENCY_LABELS = getUrgencyLabels(t);
  const s = INTERV_STATUS[item.status];
  const u = URGENCY_LABELS[item.urgency];

  const createReparationFromIntervention = async () => {
    setCreating(true);
    try {
      // 1. Find or create company
      const { data: existingCompany } = await supabaseAdmin
        .from("companies")
        .select("id")
        .ilike("name", item.company_name)
        .maybeSingle();

      let companyId: string;
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const { data: newCompany, error: compError } = await supabaseAdmin
          .from("companies")
          .insert({ name: item.company_name, rc: null, ice: null, address: null, city: null, country: "MA", phone: item.contact_phone || null })
          .select("id")
          .single();
        if (compError || !newCompany) { setCreating(false); return; }
        companyId = newCompany.id;
      }

      // 2. Map urgency to priority
      const priority = item.urgency === "normale" ? "normale" : "urgente";

      // 3. Generate reference
      const now = new Date();
      const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
      const rand = String(Math.floor(1000 + Math.random() * 9000));
      const reference = `REP-${ymd}-${rand}`;

      // 4. Create repair_request
      const { data: newRepair, error: repError } = await supabaseAdmin
        .from("repair_requests")
        .insert({
          company_id: companyId,
          reference,
          equipment_type: item.machine_type,
          equipment_brand: item.machine_brand ?? null,
          equipment_model: item.machine_model ?? null,
          equipment_serial: item.machine_serial ?? null,
          description: item.problem_description,
          priority,
          status: "en_attente",
          technician_id: technicianId || null,
          scheduled_date: scheduledDate || null,
          manager_checklist: [],
          manager_parts: [],
          attachments: item.attachments ?? [],
          report_parts: [],
          tech_photos: [],
        })
        .select("id")
        .single();

      if (repError || !newRepair) { setCreating(false); return; }

      // 5. Mark form_interventions as converted + link
      await supabaseAdmin
        .from("form_interventions")
        .update({ status: "cree", converted_to_repair_id: newRepair.id } as Record<string, unknown>)
        .eq("id", item.id);
      onMarkDone(item.id, "cree");

      // 6. Navigate to new repair
      setLocation(`/espace-manager/reparations/${newRepair.id}`);
    } catch (err) {
      console.error("Erreur création réparation:", err);
      setCreating(false);
    }
  };

  return (
    <div className={`border-b border-zinc-100 last:border-0 transition-colors ${item.status === "nouveau" ? "bg-orange-50/40" : "bg-white"}`}>
      <button
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm font-bold text-zinc-800">{item.reference}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${u.color}`}>{u.label}</span>
          </div>
          <p className="text-sm text-zinc-600 mt-0.5 truncate">
            <span className="font-semibold">{item.company_name}</span>
            {item.machine_type && <span className="text-zinc-400"> · {item.machine_type}</span>}
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
          {item.location && <p className="text-xs text-zinc-500">{item.location}</p>}
          <p className="text-xs text-zinc-400">
            {new Date(item.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 bg-zinc-50 border-t border-zinc-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
            {/* Contact */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t("portal.demandes.contactSection")}</p>
              <div className="flex items-center gap-2 text-sm text-zinc-700">
                <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />{item.company_name}
              </div>
              {item.contact_name && (
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <Hash className="w-3.5 h-3.5 text-zinc-400 shrink-0" />{item.contact_name}
                </div>
              )}
              {item.contact_phone && (
                <a href={`tel:${item.contact_phone}`} className="flex items-center gap-2 text-sm text-sky-600 hover:underline">
                  <Phone className="w-3.5 h-3.5 shrink-0" />{item.contact_phone}
                </a>
              )}
              {item.contact_email && (
                <a href={`mailto:${item.contact_email}`} className="flex items-center gap-2 text-sm text-sky-600 hover:underline">
                  <Mail className="w-3.5 h-3.5 shrink-0" />{item.contact_email}
                </a>
              )}
            </div>

            {/* Machine */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t("portal.demandes.machineSection")}</p>
              <div className="text-sm font-semibold text-zinc-800">{item.machine_type}</div>
              {item.machine_brand && <div className="text-sm text-zinc-700">{t("portal.demandes.brandLabel")} : {item.machine_brand}</div>}
              {item.machine_model && <div className="text-sm text-zinc-700">{t("portal.demandes.modelLabel")} : {item.machine_model}</div>}
              {item.machine_serial && <div className="text-sm text-zinc-700">{t("portal.demandes.serialLabel")} : {item.machine_serial}</div>}
              {item.machine_year && <div className="text-sm text-zinc-700">{t("portal.demandes.commissionLabel")} : {item.machine_year}</div>}
            </div>

            {/* Intervention */}
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t("portal.demandes.interventionSection")}</p>
              {item.location && (
                <div className="flex items-start gap-2 text-sm text-zinc-700">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />{item.location}
                </div>
              )}
              {item.problem_description && (
                <p className="text-sm text-zinc-600">{item.problem_description}</p>
              )}
            </div>
          </div>

          {/* Attachments */}
          {item.attachments && item.attachments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-1.5">
                <Paperclip className="w-3 h-3" />{t("portal.demandes.attachments")} ({item.attachments.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {item.attachments.map((url, idx) => {
                  const isPdf = url.toLowerCase().includes(".pdf");
                  const filename = url.split("/").pop()?.split("?")[0] ?? `Fichier ${idx + 1}`;
                  return (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-500 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      {isPdf ? <FileText className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
                      {filename.length > 24 ? `${filename.slice(0, 22)}…` : filename}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-zinc-200">
            {item.status === "nouveau" && (
              <button
                onClick={() => onMarkDone(item.id, "traite")}
                className="flex items-center gap-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />{t("portal.demandes.markDone")}
              </button>
            )}
            {item.status !== "cree" && (
              <button
                onClick={() => setShowCreateForm((v) => !v)}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                {showCreateForm ? t("portal.common.cancel") : t("portal.demandes.createRepair")}
              </button>
            )}
            {item.status === "cree" && item.converted_to_repair_id && (
              <button
                onClick={() => setLocation(`/espace-manager/reparations/${item.converted_to_repair_id}`)}
                className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-3 py-2 rounded-lg transition-colors hover:bg-emerald-100"
              >
                <ArrowRight className="w-3.5 h-3.5" />{t("portal.demandes.viewCreatedRepair")}
              </button>
            )}
          </div>

          {/* Inline creation form */}
          {showCreateForm && item.status !== "cree" && (
            <div className="mt-4 bg-white border border-orange-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-orange-500">{t("portal.demandes.planningTitle")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1">{t("portal.demandes.dateLabel")}</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-1">{t("portal.demandes.technicianLabel")}</label>
                  <select
                    value={technicianId}
                    onChange={(e) => setTechnicianId(e.target.value)}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                  >
                    <option value="">{t("portal.demandes.noTechnician")}</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>{tech.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={createReparationFromIntervention}
                disabled={creating}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                {creating ? t("portal.demandes.creating") : t("portal.demandes.confirmCreate")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminDemandes() {
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>("devis");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FormDevisStatus | FormInterventionStatus | "all">("nouveau");
  const [devisItems, setDevisItems] = useState<PublicDevisRequest[]>([]);
  const [interventionItems, setInterventionItems] = useState<PublicInterventionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDevisCount, setNewDevisCount] = useState(0);
  const [newIntervCount, setNewIntervCount] = useState(0);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [devisRes, intervRes, techRes] = await Promise.all([
      supabaseAdmin.from("form_devis").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("form_interventions").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("technicians").select("*").order("name"),
    ]);
    const d = (devisRes.data ?? []) as PublicDevisRequest[];
    const i = (intervRes.data ?? []) as PublicInterventionRequest[];
    setDevisItems(d);
    setInterventionItems(i);
    setTechnicians((techRes.data ?? []) as Technician[]);
    setNewDevisCount(d.filter((x) => x.status === "nouveau").length);
    setNewIntervCount(i.filter((x) => x.status === "nouveau").length);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time subscription
  useEffect(() => {
    const ch1 = supabaseAdmin.channel("form-devis-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "form_devis" }, loadData)
      .subscribe();
    const ch2 = supabaseAdmin.channel("form-interventions-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "form_interventions" }, loadData)
      .subscribe();
    return () => { supabaseAdmin.removeChannel(ch1); supabaseAdmin.removeChannel(ch2); };
  }, [loadData]);

  async function markDevisDone(id: string, status: FormDevisStatus) {
    await supabaseAdmin.from("form_devis").update({ status }).eq("id", id);
    setDevisItems((prev) => prev.map((x) => x.id === id ? { ...x, status } : x));
    setNewDevisCount((c) => status === "nouveau" ? c + 1 : Math.max(0, c - 1));
  }

  async function markIntervDone(id: string, status: FormInterventionStatus) {
    await supabaseAdmin.from("form_interventions").update({ status }).eq("id", id);
    setInterventionItems((prev) => prev.map((x) => x.id === id ? { ...x, status } : x));
    setNewIntervCount((c) => status === "nouveau" ? c + 1 : Math.max(0, c - 1));
  }

  const q = search.toLowerCase().trim();

  // Manager only handles spare parts (pièces de rechange)
  const filteredDevis = devisItems.filter((d) => {
    if (isMachineCategory(d.product_category)) return false;
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    const matchSearch = !q || [d.reference, d.company_name, d.contact_name, d.contact_email, d.product_model].some(
      (v) => v?.toLowerCase().includes(q)
    );
    return matchStatus && matchSearch;
  });

  const filteredInterv = interventionItems.filter((i) => {
    const matchStatus = statusFilter === "all" || i.status === statusFilter;
    const matchSearch = !q || [i.reference, i.company_name, i.contact_name, i.contact_email, i.machine_type, i.machine_model].some(
      (v) => v?.toLowerCase().includes(q)
    );
    return matchStatus && matchSearch;
  });

  const devisStatusFilters = [
    { value: "all", label: t("portal.demandes.filterAll") },
    { value: "nouveau", label: t("portal.demandes.filterNew") },
    { value: "traite", label: t("portal.demandes.filterDone") },
    { value: "converti", label: t("portal.demandes.filterConverted") },
  ];
  const intervStatusFilters = [
    { value: "all", label: t("portal.demandes.filterAll") },
    { value: "nouveau", label: t("portal.demandes.filterNewInterv") },
    { value: "traite", label: t("portal.demandes.filterDoneInterv") },
    { value: "cree", label: t("portal.demandes.statusRepairCreated") },
  ];

  const currentFilters = tab === "devis" ? devisStatusFilters : intervStatusFilters;

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-black text-zinc-900">{t("portal.demandes.title")}</h1>
              <p className="text-sm text-zinc-500 mt-0.5">{t("portal.demandes.subtitle")}</p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {t("portal.common.refresh")}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => { setTab("devis"); setStatusFilter("nouveau"); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                tab === "devis"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300"
              }`}
            >
              <FileText className="w-4 h-4" />
              {t("portal.demandes.tabQuotes")}
              {newDevisCount > 0 && (
                <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                  tab === "devis" ? "bg-white/20 text-white" : "bg-sky-100 text-sky-700"
                }`}>
                  {newDevisCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { setTab("interventions"); setStatusFilter("nouveau"); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                tab === "interventions"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300"
              }`}
            >
              <Wrench className="w-4 h-4" />
              {t("portal.demandes.tabInterventions")}
              {newIntervCount > 0 && (
                <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                  tab === "interventions" ? "bg-white/20 text-white" : "bg-orange-100 text-orange-700"
                }`}>
                  {newIntervCount}
                </span>
              )}
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("portal.demandes.searchPlaceholder")}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white"
              />
            </div>
            <div className="flex gap-1.5">
              {currentFilters.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value as FormDevisStatus | FormInterventionStatus | "all")}
                  className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                    statusFilter === value
                      ? "bg-zinc-900 text-white"
                      : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-zinc-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-sm">{t("portal.demandes.loadingText")}</span>
              </div>
            ) : tab === "devis" ? (
              filteredDevis.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="w-10 h-10 text-zinc-200 mb-3" />
                  <p className="text-sm font-bold text-zinc-400">{t("portal.demandes.noQuotes")}</p>
                  <p className="text-xs text-zinc-300 mt-1">
                    {statusFilter !== "all" ? t("portal.demandes.tryChangeFilter") : t("portal.demandes.formsWillAppear")}
                  </p>
                </div>
              ) : (
                filteredDevis.map((item) => (
                  <DevisRow key={item.id} item={item} onMarkDone={markDevisDone} />
                ))
              )
            ) : (
              filteredInterv.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Wrench className="w-10 h-10 text-zinc-200 mb-3" />
                  <p className="text-sm font-bold text-zinc-400">{t("portal.demandes.noInterventions")}</p>
                  <p className="text-xs text-zinc-300 mt-1">
                    {statusFilter !== "all" ? t("portal.demandes.tryChangeFilter") : t("portal.demandes.formsWillAppear")}
                  </p>
                </div>
              ) : (
                filteredInterv.map((item) => (
                  <InterventionRow key={item.id} item={item} onMarkDone={markIntervDone} technicians={technicians} />
                ))
              )
            )}
          </div>

          {/* Count footer */}
          {!loading && (
            <p className="text-xs text-zinc-400 text-right mt-2">
              {tab === "devis"
                ? `${filteredDevis.length} ${filteredDevis.length !== 1 ? t("portal.demandes.displayCountPlural") : t("portal.demandes.displayCount")}`
                : `${filteredInterv.length} ${filteredInterv.length !== 1 ? t("portal.demandes.displayCountPlural") : t("portal.demandes.displayCount")}`
              }
            </p>
          )}
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
