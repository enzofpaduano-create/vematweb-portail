import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Save, Plus, Trash2, Printer, CheckCircle2, Clock, Package, FileText, Search } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { AdminGuard } from "./AdminGuard";
import { RepairStatusBadge } from "@/components/espace-client/StatusBadge";
import { RepairTimeline } from "@/components/espace-client/StatusTimeline";
import { supabaseAdmin } from "@/lib/supabase";
import type { RepairRequest, Company, Chantier, Technician, RepairStatus } from "@/lib/database.types";
import { REPAIR_STATUSES } from "@/lib/database.types";
import {
  sendRepairScheduledEmail,
  sendRepairInProgressEmail,
  sendRepairCompletedEmail,
} from "@/lib/clientEmails";
import { useLang } from "@/i18n/I18nProvider";

interface ChecklistItem { id: string; label: string; done: boolean; }
interface ReportPart { id: string; reference: string; description: string; quantity: number; }
interface CatalogEntry { sku: string; name: string; source: string; }
interface VematCatalog { families: { products: { sku: string; title: string }[] }[] }
interface SupplierCatalog { supplier: string; categories: { products: { sku: string; title: string }[] }[] }

export default function AdminReparationDetail() {
  const { lang, t } = useLang();
  const { id } = useParams<{ id: string }>();
  const [repair, setRepair] = useState<RepairRequest | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [chantier, setChantier] = useState<Chantier | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    status: "en_attente" as RepairStatus,
    technician_id: "",
    scheduled_date: "",
    technician_notes: "",
  });

  // Checklist
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [savingChecklist, setSavingChecklist] = useState(false);

  // Manager parts
  const [managerParts, setManagerParts] = useState<ReportPart[]>([]);
  const [savingParts, setSavingParts] = useState(false);
  const [partSearch, setPartSearch] = useState("");
  const [partResults, setPartResults] = useState<CatalogEntry[]>([]);
  const [showPartDropdown, setShowPartDropdown] = useState(false);
  const [catalogData, setCatalogData] = useState<CatalogEntry[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const partSearchRef = useRef<HTMLInputElement>(null);

  const load = () => {
    Promise.all([
      supabaseAdmin.from("repair_requests").select("*, companies(*)").eq("id", id!).single(),
      supabaseAdmin.from("technicians").select("*").order("name"),
    ]).then(([r, techData]) => {
      const rep = r.data as (RepairRequest & { companies?: Company }) | null;
      if (rep) {
        setRepair(rep);
        setCompany(rep.companies ?? null);
        setForm({
          status: rep.status,
          technician_id: rep.technician_id ?? "",
          scheduled_date: rep.scheduled_date ?? "",
          technician_notes: rep.technician_notes ?? "",
        });
        setChecklist((rep.manager_checklist as unknown as ChecklistItem[]) ?? []);
        setManagerParts((rep.manager_parts as unknown as ReportPart[]) ?? []);
        if (rep.chantier_id) {
          supabaseAdmin.from("chantiers").select("*").eq("id", rep.chantier_id).single().then(({ data }) => setChantier(data));
        }
      }
      setTechnicians(techData.data ?? []);
      setLoading(false);
    });
  };
  useEffect(load, [id]);

  const handleSave = async () => {
    if (!repair) return;
    setSaving(true);
    setSaveError(null);
    const oldStatus = repair.status;
    const completedDate = form.status === "terminee" && !repair.completed_date
      ? new Date().toISOString().split("T")[0]
      : repair.completed_date;
    const { error } = await supabaseAdmin.from("repair_requests").update({
      status: form.status,
      technician_id: form.technician_id || null,
      scheduled_date: form.scheduled_date || null,
      technician_notes: form.technician_notes || null,
      completed_date: completedDate,
    }).eq("id", repair.id);
    if (error) { setSaving(false); setSaveError(error.message); return; }
    if (oldStatus !== form.status) {
      await supabaseAdmin.from("status_history").insert({
        entity_type: "reparation", entity_id: repair.id,
        old_status: oldStatus, new_status: form.status,
      });
      // Email automatique au client à chaque transition (cf. lib/clientEmails.ts).
      if (form.status === "planifiee") {
        const tech = technicians.find((tt) => tt.id === form.technician_id);
        await sendRepairScheduledEmail({
          repairId: repair.id,
          reference: repair.reference,
          scheduledDate: form.scheduled_date || null,
          technicianName: tech?.name ?? null,
        });
      } else if (form.status === "en_cours") {
        await sendRepairInProgressEmail({ repairId: repair.id, reference: repair.reference });
      } else if (form.status === "terminee") {
        await sendRepairCompletedEmail({ repairId: repair.id, reference: repair.reference });
      }
    }
    setSaving(false);
    load();
  };

  const saveChecklist = async (updated: ChecklistItem[]) => {
    setSavingChecklist(true);
    await supabaseAdmin.from("repair_requests").update({ manager_checklist: updated }).eq("id", id!);
    setSavingChecklist(false);
  };

  const loadCatalog = async () => {
    if (catalogLoaded) return;
    const entries: CatalogEntry[] = [];
    try {
      const vemat: VematCatalog = await fetch("/vemat-stock-catalog.json").then((r) => r.json());
      for (const fam of vemat.families)
        for (const p of fam.products)
          entries.push({ sku: p.sku, name: p.title, source: "Vemat" });
    } catch { /* silent */ }
    try {
      const jlg: SupplierCatalog = await fetch("/jlg-parts-catalog.json").then((r) => r.json());
      for (const cat of jlg.categories)
        for (const p of cat.products)
          entries.push({ sku: p.sku, name: p.title, source: "JLG" });
    } catch { /* silent */ }
    try {
      const terex: SupplierCatalog = await fetch("/terex-parts-catalog.json").then((r) => r.json());
      for (const cat of terex.categories)
        for (const p of cat.products)
          entries.push({ sku: p.sku, name: p.title, source: "Terex" });
    } catch { /* silent */ }
    setCatalogData(entries);
    setCatalogLoaded(true);
  };

  const handlePartSearchChange = async (q: string) => {
    setPartSearch(q);
    if (!catalogLoaded) await loadCatalog();
    if (q.trim().length < 2) { setPartResults([]); setShowPartDropdown(false); return; }
    const lower = q.toLowerCase();
    const results = catalogData
      .filter((e) => e.sku.toLowerCase().includes(lower) || e.name.toLowerCase().includes(lower))
      .slice(0, 10);
    setPartResults(results);
    setShowPartDropdown(results.length > 0);
  };

  const selectPartFromCatalog = (entry: CatalogEntry) => {
    const already = managerParts.find((p) => p.reference === entry.sku);
    if (already) {
      const updated = managerParts.map((p) => p.reference === entry.sku ? { ...p, quantity: p.quantity + 1 } : p);
      setManagerParts(updated);
      saveManagerParts(updated);
    } else {
      const updated = [...managerParts, { id: crypto.randomUUID(), reference: entry.sku, description: `[${entry.source}] ${entry.name}`, quantity: 1 }];
      setManagerParts(updated);
      saveManagerParts(updated);
    }
    setPartSearch("");
    setPartResults([]);
    setShowPartDropdown(false);
    partSearchRef.current?.focus();
  };

  const addManualPart = () => {
    const ref = partSearch.trim();
    if (!ref) return;
    const updated = [...managerParts, { id: crypto.randomUUID(), reference: ref, description: "", quantity: 1 }];
    setManagerParts(updated);
    saveManagerParts(updated);
    setPartSearch("");
    setPartResults([]);
    setShowPartDropdown(false);
  };

  const updateManagerPart = (partId: string, field: keyof ReportPart, value: string | number) => {
    const updated = managerParts.map((p) => p.id === partId ? { ...p, [field]: value } : p);
    setManagerParts(updated);
    saveManagerParts(updated);
  };

  const removeManagerPart = (partId: string) => {
    const updated = managerParts.filter((p) => p.id !== partId);
    setManagerParts(updated);
    saveManagerParts(updated);
  };

  const saveManagerParts = async (updated: ReportPart[]) => {
    setSavingParts(true);
    await supabaseAdmin.from("repair_requests").update({ manager_parts: updated }).eq("id", id!);
    setSavingParts(false);
  };

  const addChecklistItem = async () => {
    if (!newItem.trim()) return;
    const updated = [...checklist, { id: crypto.randomUUID(), label: newItem.trim(), done: false }];
    setChecklist(updated);
    setNewItem("");
    await saveChecklist(updated);
  };

  const removeChecklistItem = async (itemId: string) => {
    const updated = checklist.filter((i) => i.id !== itemId);
    setChecklist(updated);
    await saveChecklist(updated);
  };

  const printReport = () => {
    if (!repair) return;
    const tech = technicians.find((tech) => tech.id === repair.technician_id);
    const parts = (repair.report_parts as unknown as ReportPart[] | null)?.filter((p) => p.description) ?? [];
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport ${repair.reference}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 1.5cm; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; padding: 48px; font-size: 13px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 20px; margin-bottom: 28px; }
    .logo { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
    .ref { font-size: 20px; font-weight: 900; }
    .badge { display: inline-block; background: #d1fae5; color: #065f46; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-top: 4px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; color: #666; border-bottom: 1px solid #e5e5e5; padding-bottom: 6px; margin-bottom: 12px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field-label { font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
    .field-value { font-size: 13px; color: #111; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #888; padding: 6px 8px; border-bottom: 2px solid #e5e5e5; }
    td { padding: 8px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
    .checklist-item { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
    .check-box { width: 14px; height: 14px; border: 2px solid #ccc; border-radius: 3px; display: inline-block; flex-shrink: 0; }
    .check-box.done { background: #10b981; border-color: #10b981; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .signature-block { border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px; margin-top: 24px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 10px; color: #aaa; display: flex; justify-content: space-between; }
    .action-bar { position: fixed; top: 0; left: 0; right: 0; background: #fff; border-bottom: 1px solid #e5e5e5; padding: 10px 24px; display: flex; align-items: center; justify-content: space-between; z-index: 100; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
    .action-bar-hint { font-size: 12px; color: #888; }
    .btn-print { background: #111; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .btn-print:hover { background: #333; }
    .action-bar-spacer { height: 52px; }
    @media print {
      .action-bar, .action-bar-spacer { display: none !important; }
      body { padding: 0; }
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  </style>
</head>
<body>
  <div class="action-bar">
    <span class="action-bar-hint">Pour enregistrer en PDF : dans la boîte d'impression, sélectionnez <strong>Enregistrer en PDF</strong> comme destination.</span>
    <button class="btn-print" onclick="window.print()">Exporter PDF</button>
  </div>
  <div class="action-bar-spacer"></div>
  <div class="header">
    <div>
      <div class="logo">VEMAT GROUP</div>
      <div style="font-size:11px;color:#888;margin-top:2px;">Rapport d'intervention</div>
    </div>
    <div style="text-align:right">
      <div class="ref">${repair.reference}</div>
      <div class="badge">Terminée</div>
      ${repair.completed_date ? `<div style="font-size:11px;color:#888;margin-top:4px;">Le ${new Date(repair.completed_date + "T00:00:00").toLocaleDateString("fr-FR")}</div>` : ""}
    </div>
  </div>

  <div class="grid2" style="margin-bottom:24px">
    <div class="section" style="margin-bottom:0">
      <div class="section-title">Client</div>
      <div class="field-value">${company?.name ?? "—"}</div>
      ${company?.phone ? `<div style="color:#666;margin-top:2px">${company.phone}</div>` : ""}
    </div>
    <div class="section" style="margin-bottom:0">
      <div class="section-title">Technicien</div>
      <div class="field-value">${tech?.name ?? "—"}</div>
      ${repair.report_hours ? `<div style="color:#666;margin-top:2px">Durée : ${repair.report_hours}h</div>` : ""}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Équipement</div>
    <div class="field-value">${repair.equipment_type}${repair.equipment_brand ? ` · ${repair.equipment_brand}` : ""}${repair.equipment_model ? ` ${repair.equipment_model}` : ""}</div>
    ${repair.equipment_serial ? `<div style="color:#888;font-size:11px;font-family:monospace;margin-top:2px">S/N: ${repair.equipment_serial}</div>` : ""}
  </div>

  ${chantier ? `
  <div class="section">
    <div class="section-title">Localisation</div>
    <div class="field-value">${chantier.name}</div>
    ${chantier.address ? `<div style="color:#666">${chantier.address}, ${chantier.city ?? ""}</div>` : ""}
  </div>` : ""}

  <div class="section">
    <div class="section-title">Problème signalé</div>
    <div class="field-value">${repair.description}</div>
  </div>

  <div class="section">
    <div class="section-title">Travaux effectués</div>
    <div class="field-value" style="white-space:pre-line">${repair.report_work_done ?? "—"}</div>
  </div>

  ${parts.length ? `
  <div class="section">
    <div class="section-title">Pièces de rechange utilisées</div>
    <table>
      <thead><tr><th>Référence</th><th>Désignation</th><th style="text-align:right">Quantité</th></tr></thead>
      <tbody>${parts.map((p) => `<tr><td style="font-family:monospace;color:#666">${p.reference || "—"}</td><td>${p.description}</td><td style="text-align:right">${p.quantity}</td></tr>`).join("")}</tbody>
    </table>
  </div>` : ""}

  ${repair.report_observations ? `
  <div class="section">
    <div class="section-title">Observations & recommandations</div>
    <div class="field-value" style="white-space:pre-line">${repair.report_observations}</div>
  </div>` : ""}

  ${checklist.length ? `
  <div class="section">
    <div class="section-title">Checklist d'intervention</div>
    ${checklist.map((item) => `
      <div class="checklist-item">
        <div class="check-box ${item.done ? "done" : ""}"></div>
        <span style="${item.done ? "color:#888;text-decoration:line-through" : ""}">${item.label}</span>
      </div>`).join("")}
  </div>` : ""}

  <div class="signature-block">
    <div style="font-size:10px;font-weight:900;text-transform:uppercase;color:#888;margin-bottom:10px">Signature du technicien</div>
    <div style="font-size:14px;font-weight:700">${tech?.name ?? "—"}</div>
    <div style="color:#888;font-size:11px">${repair.report_submitted_at ? new Date(repair.report_submitted_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</div>
    <div style="margin-top:40px;border-top:1px solid #e5e5e5;width:200px;padding-top:6px;font-size:10px;color:#ccc">Signature</div>
  </div>

  <div class="footer">
    <span>Vemat Group — Document généré le ${new Date().toLocaleDateString("fr-FR")}</span>
    <span>${repair.reference}</span>
  </div>
  <script>window.addEventListener("load", () => setTimeout(() => window.print(), 300));</script>
</body>
</html>`);
    w.document.close();
  };

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <AdminGuard><AdminLayout><div className="p-8 text-zinc-400">{t("portal.common.loading")}</div></AdminLayout></AdminGuard>;
  if (!repair) return <AdminGuard><AdminLayout><div className="p-8 text-zinc-400">{t("portal.admin.repairNotFound")}</div></AdminLayout></AdminGuard>;

  const reportParts_ = (repair.report_parts as unknown as ReportPart[] | null)?.filter((p) => p.description) ?? [];
  const hasReport = !!repair.report_submitted_at;
  const isLocked = !!repair.report_locked;
  const tech = technicians.find((tech) => tech.id === repair.technician_id);

  const lockReport = async () => {
    await supabaseAdmin.from("repair_requests").update({ report_locked: true }).eq("id", repair.id);
    load();
  };

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-8 max-w-4xl">
          <Link href="/espace-manager/reparations"
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("portal.common.back")}
          </Link>

          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-zinc-900">{repair.reference}</h1>
                {repair.priority === "urgente" && (
                  <span className="text-xs font-black bg-red-100 text-red-600 px-2.5 py-1 rounded-full uppercase tracking-wider">{t("portal.dashboard.urgent")}</span>
                )}
              </div>
              <p className="text-zinc-500 text-sm mt-1">
                {company?.name} · {new Date(repair.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasReport && (
                <button onClick={printReport}
                  className="flex items-center gap-2 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 font-semibold text-sm px-4 py-2 rounded-lg transition-colors">
                  <Printer className="w-4 h-4" /> {t("portal.admin.downloadReport")}
                </button>
              )}
              {hasReport && !isLocked && (
                <button onClick={lockReport}
                  className="flex items-center gap-2 bg-zinc-900 text-white font-bold text-sm px-4 py-2 rounded-lg hover:bg-zinc-700 transition-colors">
                  <CheckCircle2 className="w-4 h-4" /> {t("portal.admin.closeMission")}
                </button>
              )}
              {isLocked && (
                <span className="flex items-center gap-1.5 text-xs font-black text-zinc-500 border border-zinc-200 px-3 py-2 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t("portal.admin.missionClosed")}
                </span>
              )}
              <RepairStatusBadge status={repair.status} />
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-zinc-100 p-6 mb-5">
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-5">{t("portal.admin.progress")}</h2>
            <RepairTimeline status={form.status} />
          </div>

          {/* Admin controls */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-5">
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-4">{t("portal.admin.interventionManagement")}</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.commercial_page.formStatus")}</label>
                <select value={form.status} onChange={set("status")}
                  className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent">
                  {REPAIR_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.admin.interventionDate")}</label>
                <input type="date" value={form.scheduled_date} onChange={set("scheduled_date")}
                  className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent" />
              </div>
            </div>

            {/* Tech assignment */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-2">{t("portal.admin.assignedTechnician")}</label>
              <div className="flex flex-wrap gap-3">
                {technicians.map((tech) => (
                  <button key={tech.id} type="button" onClick={() => setForm((f) => ({ ...f, technician_id: tech.id }))}
                    className={`flex items-center gap-2 border-2 rounded-xl px-4 py-3 transition-all ${form.technician_id === tech.id ? "border-accent bg-accent/5" : "border-zinc-200 hover:border-zinc-300"}`}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: tech.color }}>
                      {tech.name.split(" ").map((w) => w[0]).join("")}
                    </div>
                    <span className="text-sm font-semibold text-zinc-700">{tech.name}</span>
                  </button>
                ))}
                <button type="button" onClick={() => setForm((f) => ({ ...f, technician_id: "" }))}
                  className={`border-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${!form.technician_id ? "border-zinc-900 bg-zinc-50 text-zinc-700" : "border-zinc-200 text-zinc-400 hover:border-zinc-300"}`}>
                  {t("portal.common.none")}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.admin.clientNotes")}</label>
              <textarea value={form.technician_notes} onChange={set("technician_notes")} rows={3}
                placeholder={t("portal.admin.clientNotesPlaceholder")}
                className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent resize-none" />
            </div>

            {saveError && <p className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>}
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-accent text-accent-foreground font-bold text-sm px-5 py-2.5 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60">
              <Save className="w-4 h-4" />{saving ? t("portal.common.saving") : t("portal.common.save")}
            </button>
          </div>

          {/* ── Checklist préparation ── */}
          <div className="bg-white rounded-xl border border-zinc-100 p-6 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500">
                {t("portal.admin.techChecklist")}
              </h2>
              {checklist.length > 0 && (
                <span className="text-xs text-zinc-400">
                  {checklist.filter((i) => i.done).length}/{checklist.length} {t("portal.admin.completed")}
                  {savingChecklist && <span className="ml-2 text-zinc-300">{t("portal.common.saving")}...</span>}
                </span>
              )}
            </div>

            {checklist.length > 0 && (
              <div className="mb-4 divide-y divide-zinc-50 rounded-xl border border-zinc-100 overflow-hidden">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${item.done ? "bg-emerald-500 border-emerald-500" : "border-zinc-300"}`}>
                      {item.done && (
                        <svg viewBox="0 0 12 9" className="w-2.5 h-2" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1,4 4,8 11,1" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm flex-1 ${item.done ? "line-through text-zinc-400" : "text-zinc-800"}`}>{item.label}</span>
                    <button type="button" onClick={() => removeChecklistItem(item.id)}
                      className="text-zinc-300 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                placeholder={t("portal.admin.checklistPlaceholder")}
                className="flex-1 border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent" />
              <button type="button" onClick={addChecklistItem} disabled={!newItem.trim()}
                className="flex items-center gap-1.5 bg-zinc-900 text-white font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-40">
                <Plus className="w-4 h-4" /> {t("portal.common.add")}
              </button>
            </div>
          </div>

          {/* ── Pièces à préparer ── */}
          <div className="bg-white rounded-xl border border-zinc-100 p-6 mb-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500">{t("portal.admin.partsToPrepare")}</h2>
                <p className="text-xs text-zinc-400 mt-0.5">{t("portal.admin.partsToPrepareHint")}</p>
              </div>
              {savingParts && <span className="text-xs text-zinc-400">{t("portal.common.saving")}...</span>}
            </div>

            {/* Search input */}
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                ref={partSearchRef}
                value={partSearch}
                onChange={(e) => handlePartSearchChange(e.target.value)}
                onFocus={() => { if (partResults.length > 0) setShowPartDropdown(true); }}
                onBlur={() => setTimeout(() => setShowPartDropdown(false), 150)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (partResults.length > 0) selectPartFromCatalog(partResults[0]); else addManualPart(); } }}
                placeholder={t("portal.admin.searchPartPlaceholder")}
                className="w-full border border-zinc-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent"
              />
              {showPartDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
                  {partResults.map((entry) => (
                    <button
                      key={entry.sku}
                      onMouseDown={() => selectPartFromCatalog(entry)}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors text-left"
                    >
                      <Package className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 truncate">{entry.name}</p>
                        <p className="text-[10px] font-mono text-zinc-400">{entry.sku} · {entry.source}</p>
                      </div>
                    </button>
                  ))}
                  {partSearch.trim().length >= 2 && (
                    <button
                      onMouseDown={addManualPart}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors text-left border-t border-zinc-100"
                    >
                      <Plus className="w-4 h-4 text-accent shrink-0" />
                      <span className="text-sm font-semibold text-accent">{t("portal.admin.addManually")} "{partSearch.trim()}"</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Parts list */}
            {managerParts.length > 0 && (
              <div className="rounded-xl border border-zinc-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50">
                      <th className="text-left px-4 py-2.5 text-xs font-black uppercase text-zinc-400 tracking-wide">{t("portal.admin.reference")}</th>
                      <th className="text-left px-4 py-2.5 text-xs font-black uppercase text-zinc-400 tracking-wide">{t("portal.admin.designation")}</th>
                      <th className="text-right px-4 py-2.5 text-xs font-black uppercase text-zinc-400 tracking-wide w-20">{t("portal.common.qty")}</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {managerParts.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2.5">
                          <input
                            value={p.reference}
                            onChange={(e) => updateManagerPart(p.id, "reference", e.target.value)}
                            className="font-mono text-xs text-zinc-600 w-full bg-transparent border-b border-transparent focus:border-zinc-300 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            value={p.description}
                            onChange={(e) => updateManagerPart(p.id, "description", e.target.value)}
                            placeholder={t("portal.admin.designationPlaceholder")}
                            className="text-sm text-zinc-800 w-full bg-transparent border-b border-transparent focus:border-zinc-300 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <input
                            type="number"
                            min={1}
                            value={p.quantity}
                            onChange={(e) => updateManagerPart(p.id, "quantity", parseInt(e.target.value) || 1)}
                            className="w-14 text-right font-bold text-zinc-800 bg-transparent border-b border-transparent focus:border-zinc-300 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button onClick={() => removeManagerPart(p.id)} className="text-zinc-300 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {managerParts.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-4">{t("portal.admin.noPartsAdded")}</p>
            )}
          </div>

          {/* ── Rapport d'intervention ── */}
          {hasReport && (
            <div className={`bg-white rounded-xl overflow-hidden mb-5 border ${isLocked ? "border-zinc-300" : "border-emerald-200"}`}>
              <div className={`px-6 py-4 border-b border-zinc-100 flex items-center justify-between ${isLocked ? "bg-zinc-50" : "bg-emerald-50"}`}>
                <div className="flex items-center gap-2">
                  <FileText className={`w-4 h-4 ${isLocked ? "text-zinc-500" : "text-emerald-600"}`} />
                  <h2 className="text-sm font-black text-zinc-900">{t("portal.admin.interventionReport")}</h2>
                  {isLocked && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 bg-zinc-200 px-2 py-0.5 rounded-full">{t("portal.admin.closed")}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400">
                    {new Date(repair.report_submitted_at!).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <button onClick={printReport}
                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 transition-colors">
                    <Printer className="w-3.5 h-3.5" /> {t("portal.admin.print")}
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Tech + hours */}
                <div className="flex items-center gap-6">
                  {tech && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black" style={{ backgroundColor: tech.color }}>
                        {tech.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                      </div>
                      <span className="text-sm font-bold text-zinc-800">{tech.name}</span>
                    </div>
                  )}
                  {repair.report_hours && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Clock className="w-4 h-4 text-zinc-400" />
                      <span className="text-zinc-500">{t("portal.admin.duration")} :</span>
                      <span className="font-bold text-zinc-800">{repair.report_hours}h</span>
                    </div>
                  )}
                </div>

                {/* Work done */}
                {repair.report_work_done && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-1.5">{t("portal.admin.workDone")}</p>
                    <p className="text-sm text-zinc-700 whitespace-pre-line">{repair.report_work_done}</p>
                  </div>
                )}

                {/* Parts */}
                {reportParts_.length > 0 && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" /> {t("portal.admin.spareParts")}
                    </p>
                    <div className="rounded-xl border border-zinc-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-zinc-50">
                            <th className="text-left px-4 py-2.5 text-xs font-black uppercase text-zinc-400 tracking-wide">{t("portal.admin.reference")}</th>
                            <th className="text-left px-4 py-2.5 text-xs font-black uppercase text-zinc-400 tracking-wide">{t("portal.admin.designation")}</th>
                            <th className="text-right px-4 py-2.5 text-xs font-black uppercase text-zinc-400 tracking-wide">{t("portal.common.qty")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50">
                          {reportParts_.map((p, i) => (
                            <tr key={i}>
                              <td className="px-4 py-3 font-mono text-xs text-zinc-500">{p.reference || "—"}</td>
                              <td className="px-4 py-3 text-zinc-800">{p.description}</td>
                              <td className="px-4 py-3 text-right font-bold text-zinc-700">{p.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Observations */}
                {repair.report_observations && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-1.5">{t("portal.admin.observations")}</p>
                    <p className="text-sm text-zinc-600 whitespace-pre-line">{repair.report_observations}</p>
                  </div>
                )}

                {/* Tech photos */}
                {(() => {
                  const photos = (repair.tech_photos as unknown as { name: string; url: string; type: string }[] | null) ?? [];
                  if (!photos.length) return null;
                  return (
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" /> {t("portal.admin.techPhotos")} ({photos.length})
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {photos.map((p, i) => (
                          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                            className="aspect-square rounded-xl overflow-hidden border border-zinc-100 hover:border-accent/40 transition-colors">
                            <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Checklist recap */}
                {checklist.length > 0 && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {t("portal.admin.techChecklist")} — {checklist.filter((i) => i.done).length}/{checklist.length}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {checklist.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 text-sm">
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${item.done ? "text-emerald-500" : "text-zinc-300"}`}>
                            {item.done ? "✓" : "○"}
                          </div>
                          <span className={item.done ? "text-zinc-500" : "text-zinc-400"}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Client attachments */}
          {(() => {
            const atts = (repair.attachments as unknown as { name: string; url: string; type: string }[] | null) ?? [];
            if (!atts.length) return null;
            return (
              <div className="bg-white rounded-xl border border-zinc-100 p-6 mb-5">
                <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-4">{t("portal.admin.clientAttachments")} ({atts.length})</h2>
                <div className="grid grid-cols-4 gap-3">
                  {atts.map((a, i) => (
                    a.type.startsWith("image/") ? (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                        className="aspect-square rounded-xl overflow-hidden border border-zinc-100 hover:border-accent/40 transition-colors">
                        <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                        className="aspect-square rounded-xl border border-zinc-100 bg-zinc-50 hover:border-accent/40 flex flex-col items-center justify-center gap-1 p-2 transition-colors">
                        <FileText className="w-6 h-6 text-zinc-400" />
                        <p className="text-[9px] text-zinc-500 font-medium truncate w-full text-center px-1">{a.name}</p>
                      </a>
                    )
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Repair info */}
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-zinc-100 p-5">
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-3">{t("portal.admin.equipment")}</h2>
              <p className="font-bold text-zinc-900">{repair.equipment_type}</p>
              {repair.equipment_brand && <p className="text-sm text-zinc-600 mt-1">{repair.equipment_brand} {repair.equipment_model}</p>}
              {repair.equipment_serial && <p className="text-xs text-zinc-400 mt-1 font-mono">S/N: {repair.equipment_serial}</p>}
            </div>
            {chantier && (
              <div className="bg-white rounded-xl border border-zinc-100 p-5">
                <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-3">{t("portal.admin.worksite")}</h2>
                <p className="font-bold text-zinc-900">{chantier.name}</p>
                {chantier.address && <p className="text-sm text-zinc-500 mt-1">{chantier.address}, {chantier.city}</p>}
                {chantier.contact_name && <p className="text-sm text-zinc-500 mt-1">{t("portal.common.contact")} : {chantier.contact_name} {chantier.contact_phone}</p>}
              </div>
            )}
          </div>

          <div className="bg-zinc-50 rounded-xl border border-zinc-100 p-5 mt-5">
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-2">{t("portal.admin.problemDescription")}</h2>
            <p className="text-sm text-zinc-700 whitespace-pre-line">{repair.description}</p>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
