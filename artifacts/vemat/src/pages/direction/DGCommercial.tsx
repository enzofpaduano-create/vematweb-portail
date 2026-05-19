import { useEffect, useState, useMemo } from "react";
import { Plus, X, Check, Pencil, Trash2, CalendarDays, TrendingUp, ChevronLeft, ChevronRight, Search, Target, Users, FileText } from "lucide-react";
import { DGLayout } from "./DGLayout";
import { supabaseDG } from "@/lib/supabase";
import type { Commercial, CommercialEvent, CommercialMeetingReport, CommercialSale, CommercialTarget, PublicDevisRequest, SaleStatus } from "@/lib/database.types";
import { catalog } from "@/data/products";
import { MACHINE_CATEGORIES } from "@/lib/constants";
import { useLang } from "@/i18n/I18nProvider";

// ── Helpers ─────────────────────────────────────────────────────────────────
const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const MONTHS_SHORT_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function startOfWeek(d: Date) { const r = new Date(d); const day = r.getDay(); r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day)); r.setHours(0,0,0,0); return r; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function toDateStr(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

const CATEGORY_LABELS: Record<string, string> = { grues: "Grues", nacelles: "Nacelles & Plateformes", elevateurs: "Élévateurs Télescopiques", construction: "Construction" };
const ALL_MACHINES = Object.entries(catalog).flatMap(([cat, subcats]) =>
  subcats.flatMap((sub) => sub.models.map((m) => ({ brand: m.brand, model: m.name, category: cat, categoryLabel: CATEGORY_LABELS[cat] ?? cat })))
);

function getEventTypes(t: (k: string) => string) {
  return [
    { value: "visite",  label: t("portal.commercial_page.eventTypes.visite"),  color: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
    { value: "reunion", label: t("portal.commercial_page.eventTypes.reunion"), color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    { value: "appel",   label: t("portal.commercial_page.eventTypes.appel"),   color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    { value: "autre",   label: t("portal.commercial_page.eventTypes.autre"),   color: "bg-zinc-700 text-zinc-400 border-zinc-600" },
  ];
}

function getSaleStatuses(t: (k: string) => string): { value: SaleStatus; label: string; color: string }[] {
  return [
    { value: "devis",        label: t("portal.commercial_page.saleStatuses.devis"),        color: "text-zinc-400 bg-zinc-800 border-zinc-700" },
    { value: "bon_commande", label: t("portal.commercial_page.saleStatuses.bon_commande"), color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    { value: "facture",      label: t("portal.commercial_page.saleStatuses.facture"),      color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
    { value: "paye",         label: t("portal.commercial_page.saleStatuses.paye"),         color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  ];
}

function generateRef() { return `VNT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`; }

type SaleWithCommercial = CommercialSale & { commercial?: Commercial };
type EventWithCommercial = CommercialEvent & { commercial?: Commercial };

// ── Component ────────────────────────────────────────────────────────────────
export default function DGCommercial() {
  const { lang, t } = useLang();
  const EVENT_TYPES = getEventTypes(t);
  const SALE_STATUSES = getSaleStatuses(t);
  const DAYS = lang === "fr" ? DAYS_FR : DAYS_EN;
  const MONTHS = lang === "fr" ? MONTHS_FR : MONTHS_EN;
  const MONTHS_SHORT = lang === "fr" ? MONTHS_SHORT_FR : MONTHS_SHORT_EN;
  const [tab, setTab] = useState<"demandes" | "planning" | "ventes" | "rapports" | "objectifs">("demandes");
  const [commercials, setCommerciaux] = useState<Commercial[]>([]);
  const [events, setEvents] = useState<EventWithCommercial[]>([]);
  const [sales, setSales] = useState<SaleWithCommercial[]>([]);
  const [targets, setTargets] = useState<CommercialTarget[]>([]);
  const [loading, setLoading] = useState(true);

  // Planning state
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedCommercial, setSelectedCommercial] = useState<string>("all");
  const [showEventForm, setShowEventForm] = useState(false);
  const [editEvent, setEditEvent] = useState<EventWithCommercial | null>(null);
  const [eventForm, setEventForm] = useState({ commercial_id: "", title: "", type: "visite" as CommercialEvent["type"], client_name: "", date: "", start_time: "", end_time: "", location: "", notes: "" });

  // Ventes state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [saleSearch, setSaleSearch] = useState("");
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [editSale, setEditSale] = useState<SaleWithCommercial | null>(null);
  const [saleForm, setSaleForm] = useState({ commercial_id: "", client_name: "", machine_brand: "", machine_model: "", machine_category: "", quantity: 1, invoice_amount: "", invoice_date: "", status: "devis" as SaleStatus, notes: "" });
  const [machineSearch, setMachineSearch] = useState("");
  const [showMachineList, setShowMachineList] = useState(false);
  const [saving, setSaving] = useState(false);

  // Save error state
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reports state
  const [reports, setReports] = useState<(CommercialMeetingReport & { commercial?: Commercial })[]>([]);
  const [reportCommercialFilter, setReportCommercialFilter] = useState("all");
  const [reportValidFilter, setReportValidFilter] = useState<"all" | "pending" | "validated">("all");
  const [dgComments, setDgComments] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState<string | null>(null);

  // Machine devis (incoming quotes for machines)
  const [machineDevis, setMachineDevis] = useState<PublicDevisRequest[]>([]);
  const [devisFilter, setDevisFilter] = useState<"all" | "nouveau" | "traite" | "converti">("nouveau");
  const [convertingDevis, setConvertingDevis] = useState<string | null>(null);
  const [devisAssignTo, setDevisAssignTo] = useState<Record<string, string>>({});

  // Objectifs state
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [targetMonth, setTargetMonth] = useState(new Date().getMonth() + 1);
  const [targetForm, setTargetForm] = useState<Record<string, string>>({});

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const loadAll = async () => {
    setLoading(true);
    const [c, ev, s, tgData, rp] = await Promise.all([
      supabaseDG.from("commercials").select("*").order("name"),
      supabaseDG.from("commercial_events").select("*, commercials(*)").order("date").order("start_time"),
      supabaseDG.from("commercial_sales").select("*, commercials(*)").order("created_at", { ascending: false }),
      supabaseDG.from("commercial_targets").select("*"),
      supabaseDG.from("commercial_meeting_reports").select("*, commercials(*)").order("date", { ascending: false }),
    ]);
    setCommerciaux(c.data ?? []);
    setEvents((ev.data ?? []).map((e: CommercialEvent & { commercials?: Commercial }) => ({ ...e, commercial: e.commercials })));
    setSales((s.data ?? []).map((sale: CommercialSale & { commercials?: Commercial }) => ({ ...sale, commercial: sale.commercials })));
    setTargets(tgData.data ?? []);
    setReports((rp.data ?? []).map((r: CommercialMeetingReport & { commercials?: Commercial }) => ({ ...r, commercial: r.commercials })));
    const { data: md } = await supabaseDG.from("form_devis").select("*")
      .in("product_category", MACHINE_CATEGORIES as unknown as string[])
      .order("created_at", { ascending: false });
    setMachineDevis((md ?? []) as PublicDevisRequest[]);
    // Init target form
    const tf: Record<string, string> = {};
    (tgData.data ?? []).forEach((tg: CommercialTarget) => { tf[tg.commercial_id] = String(tg.target_amount); });
    setTargetForm(tf);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  // ── Planning ─────────────────────────────────────────────────────────────
  const weekEventsFiltered = useMemo(() => {
    const from = toDateStr(weekStart), to = toDateStr(addDays(weekStart, 6));
    return events.filter((e) => e.date >= from && e.date <= to && (selectedCommercial === "all" || e.commercial_id === selectedCommercial));
  }, [events, weekStart, selectedCommercial]);

  const eventsForDay = (d: Date) => weekEventsFiltered.filter((e) => e.date === toDateStr(d));

  const weekLabel = () => {
    const a = days[0], b = days[6];
    if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
    return `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`;
  };

  const openEventCreate = (date?: string) => {
    setEditEvent(null);
    setEventForm({ commercial_id: selectedCommercial !== "all" ? selectedCommercial : (commercials[0]?.id ?? ""), title: "", type: "visite", client_name: "", date: date ?? "", start_time: "", end_time: "", location: "", notes: "" });
    setShowEventForm(true);
  };

  const openEventEdit = (ev: EventWithCommercial) => {
    setEditEvent(ev);
    setEventForm({ commercial_id: ev.commercial_id, title: ev.title, type: ev.type, client_name: ev.client_name ?? "", date: ev.date, start_time: ev.start_time ?? "", end_time: ev.end_time ?? "", location: ev.location ?? "", notes: ev.notes ?? "" });
    setShowEventForm(true);
  };

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title || !eventForm.date || !eventForm.commercial_id) return;
    setSaving(true);
    setSaveError(null);
    const payload = { ...eventForm, client_name: eventForm.client_name || null, start_time: eventForm.start_time || null, end_time: eventForm.end_time || null, location: eventForm.location || null, notes: eventForm.notes || null };
    const { error } = editEvent
      ? await supabaseDG.from("commercial_events").update(payload).eq("id", editEvent.id)
      : await supabaseDG.from("commercial_events").insert(payload);
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setShowEventForm(false); setEditEvent(null); loadAll();
  };

  const deleteEvent = async (ev: EventWithCommercial) => {
    if (!confirm(t("portal.dg.confirmDeleteEvent"))) return;
    await supabaseDG.from("commercial_events").delete().eq("id", ev.id);
    setShowEventForm(false); loadAll();
  };

  // ── Sales ──────────────────────────────────────────────────────────────────
  const filteredMachines = useMemo(() => {
    if (!machineSearch.trim()) return ALL_MACHINES.slice(0, 20);
    const q = machineSearch.toLowerCase();
    return ALL_MACHINES.filter((m) => m.brand.toLowerCase().includes(q) || m.model.toLowerCase().includes(q)).slice(0, 30);
  }, [machineSearch]);

  const filteredSales = useMemo(() => {
    let list = sales;
    if (statusFilter !== "all") list = list.filter((s) => s.status === statusFilter);
    if (saleSearch.trim()) { const q = saleSearch.toLowerCase(); list = list.filter((s) => s.client_name.toLowerCase().includes(q) || (s.machine_model ?? "").toLowerCase().includes(q) || (s.reference ?? "").toLowerCase().includes(q)); }
    return list;
  }, [sales, statusFilter, saleSearch]);

  const openSaleCreate = () => {
    setEditSale(null);
    setSaveError(null);
    setSaleForm({ commercial_id: commercials[0]?.id ?? "", client_name: "", machine_brand: "", machine_model: "", machine_category: "", quantity: 1, invoice_amount: "", invoice_date: "", status: "devis", notes: "" });
    setMachineSearch(""); setShowSaleForm(true);
  };

  const openSaleEdit = (s: SaleWithCommercial) => {
    setEditSale(s);
    setSaleForm({ commercial_id: s.commercial_id, client_name: s.client_name, machine_brand: s.machine_brand ?? "", machine_model: s.machine_model ?? "", machine_category: s.machine_category ?? "", quantity: s.quantity, invoice_amount: s.invoice_amount ? String(s.invoice_amount) : "", invoice_date: s.invoice_date ?? "", status: s.status, notes: s.notes ?? "" });
    setMachineSearch(s.machine_model ? `${s.machine_brand} ${s.machine_model}` : "");
    setShowSaleForm(true);
  };

  const saveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleForm.client_name || !saleForm.commercial_id) return;
    setSaving(true);
    setSaveError(null);
    const payload = { commercial_id: saleForm.commercial_id, client_name: saleForm.client_name, machine_brand: saleForm.machine_brand || null, machine_model: saleForm.machine_model || null, machine_category: saleForm.machine_category || null, quantity: saleForm.quantity, invoice_amount: saleForm.invoice_amount ? Number(saleForm.invoice_amount) : null, invoice_date: saleForm.invoice_date || null, status: saleForm.status, notes: saleForm.notes || null };
    const { error } = editSale
      ? await supabaseDG.from("commercial_sales").update(payload).eq("id", editSale.id)
      : await supabaseDG.from("commercial_sales").insert({ ...payload, reference: generateRef() });
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setShowSaleForm(false); setEditSale(null); loadAll();
  };

  const deleteSale = async (s: SaleWithCommercial) => {
    if (!confirm(t("portal.commercial_page.confirmDeleteSale"))) return;
    await supabaseDG.from("commercial_sales").delete().eq("id", s.id);
    setShowSaleForm(false); loadAll();
  };

  const validateReport = async (reportId: string) => {
    setValidating(reportId);
    await supabaseDG.from("commercial_meeting_reports").update({
      validated_by_dg: true,
      dg_comment: dgComments[reportId] || null,
    } as any).eq("id", reportId);
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, validated_by_dg: true, dg_comment: dgComments[reportId] || null } : r));
    setValidating(null);
  };

  const createSaleFromDevis = async (devis: PublicDevisRequest, commercialId: string) => {
    if (!commercialId) return;
    setConvertingDevis(devis.id);
    try {
      const ref = `VNT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const { data: newSale } = await supabaseDG.from("commercial_sales").insert({
        commercial_id: commercialId,
        reference: ref,
        client_name: devis.company_name,
        machine_brand: devis.product_brand ?? null,
        machine_model: devis.product_model ?? null,
        machine_category: devis.product_category ?? null,
        quantity: devis.quantity ?? 1,
        invoice_amount: null,
        invoice_date: null,
        status: "devis",
        notes: devis.notes ?? null,
      }).select("id").single();
      if (newSale) {
        await supabaseDG.from("form_devis").update({
          status: "converti",
          converted_to_sale_id: newSale.id,
        } as any).eq("id", devis.id);
        setMachineDevis((prev) => prev.map((d) => d.id === devis.id ? { ...d, status: "converti" as const, converted_to_sale_id: newSale.id } : d));
      }
    } finally {
      setConvertingDevis(null);
    }
  };

  const selectMachine = (m: typeof ALL_MACHINES[0]) => {
    setSaleForm((f) => ({ ...f, machine_brand: m.brand, machine_model: m.model, machine_category: m.category }));
    setMachineSearch(`${m.brand} ${m.model}`); setShowMachineList(false);
  };

  // ── Targets ──────────────────────────────────────────────────────────────
  const saveTarget = async (commercialId: string) => {
    const amount = Number(targetForm[commercialId] ?? 0);
    const existing = targets.find((tg) => tg.commercial_id === commercialId && tg.year === targetYear && tg.month === targetMonth);
    if (existing) { await supabaseDG.from("commercial_targets").update({ target_amount: amount }).eq("id", existing.id); }
    else { await supabaseDG.from("commercial_targets").insert({ commercial_id: commercialId, year: targetYear, month: targetMonth, target_amount: amount }); }
    loadAll();
  };

  const totalCA = sales.filter((s) => ["facture", "paye"].includes(s.status)).reduce((sum, s) => sum + (s.invoice_amount ?? 0), 0);

  return (
    <DGLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-zinc-900">{t("portal.dg.commercialSpace")}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {t("portal.dg.commercialSubtitle")} · {t("portal.dg.total")} CA : <span className="font-bold text-zinc-800">{totalCA > 0 ? `${totalCA.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} MAD` : "—"}</span>
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1 mb-6 w-fit">
          {([[  "demandes", t("portal.dg.tabRequests"), FileText], ["planning", t("portal.dg.tabPlanning"), CalendarDays], ["ventes", t("portal.dg.tabSales"), TrendingUp], ["rapports", t("portal.dg.tabReports"), Users], ["objectifs", t("portal.dg.tabTargets"), Target]] as const).map(([v, label, Icon]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* ── DEMANDES MACHINES TAB ── */}
        {tab === "demandes" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm text-zinc-500">{t("portal.dg.machineDevisSubtitle")}</p>
              </div>
              <div className="flex items-center gap-2">
                {([["nouveau", t("portal.dg.devisNew")], ["traite", t("portal.dg.devisProcessed")], ["converti", t("portal.dg.devisConverted")], ["all", t("portal.common.all")]] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setDevisFilter(v)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${devisFilter === v ? "bg-purple-600 border-purple-600 text-white" : "border-zinc-200 text-zinc-500 hover:border-zinc-300"}`}>
                    {label}
                    {v !== "all" && (
                      <span className="ml-1.5 opacity-70">{machineDevis.filter((d) => d.status === v).length}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 bg-white border border-zinc-100 rounded-xl animate-pulse" />)}</div>
            ) : (() => {
              const filtered = machineDevis.filter((d) => devisFilter === "all" || d.status === devisFilter);
              if (filtered.length === 0) return (
                <div className="bg-white border border-zinc-100 rounded-xl py-14 text-center">
                  <FileText className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                  <p className="text-zinc-400 text-sm">{t("portal.dg.noMachineDevis")}</p>
                </div>
              );
              return (
                <div className="space-y-3">
                  {filtered.map((d) => (
                    <div key={d.id} className={`bg-white border rounded-xl p-5 ${d.status === "nouveau" ? "border-purple-200 bg-purple-50/20" : "border-zinc-100"}`}>
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-zinc-400">{d.reference}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              d.status === "nouveau" ? "bg-purple-100 border-purple-200 text-purple-700"
                              : d.status === "converti" ? "bg-emerald-100 border-emerald-200 text-emerald-700"
                              : "bg-zinc-100 border-zinc-200 text-zinc-500"
                            }`}>
                              {d.status === "nouveau" ? t("portal.dg.devisNew") : d.status === "traite" ? t("portal.dg.devisProcessed") : t("portal.dg.devisConverted")}
                            </span>
                          </div>
                          <p className="font-bold text-zinc-900">{d.company_name}</p>
                          <p className="text-xs text-zinc-500">{d.contact_name} · {d.contact_phone}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-zinc-800">{d.product_category}</p>
                          {(d.product_brand || d.product_model) && (
                            <p className="text-xs text-zinc-500">{[d.product_brand, d.product_model].filter(Boolean).join(" ")}</p>
                          )}
                          <p className="text-xs text-zinc-400 mt-0.5">{t("portal.common.qty")} : {d.quantity}</p>
                        </div>
                      </div>

                      {d.notes && (
                        <p className="text-xs text-zinc-500 italic mb-3 bg-zinc-50 rounded-lg px-3 py-2">{d.notes}</p>
                      )}

                      {d.status !== "converti" && (
                        <div className="flex items-center gap-2 pt-3 border-t border-zinc-100">
                          <select
                            value={devisAssignTo[d.id] ?? ""}
                            onChange={(e) => setDevisAssignTo((prev) => ({ ...prev, [d.id]: e.target.value }))}
                            className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                          >
                            <option value="">— {t("portal.dg.assignToCommercial")} —</option>
                            {commercials.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <button
                            onClick={() => createSaleFromDevis(d, devisAssignTo[d.id] ?? "")}
                            disabled={!devisAssignTo[d.id] || convertingDevis === d.id}
                            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            {convertingDevis === d.id ? t("portal.commercial_page.creating") : t("portal.commercial_page.createSale")}
                          </button>
                        </div>
                      )}

                      {d.status === "converti" && (
                        <div className="flex items-center gap-2 pt-3 border-t border-zinc-100">
                          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> {t("portal.dg.convertedToSale")}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── PLANNING TAB ── */}
        {tab === "planning" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <select value={selectedCommercial} onChange={(e) => setSelectedCommercial(e.target.value)}
                  className="border border-zinc-200 rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 focus:outline-none focus:border-purple-500">
                  <option value="all">{t("portal.dg.allCommercials")}</option>
                  {commercials.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEventCreate()} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors">
                  <Plus className="w-4 h-4" /> {t("portal.dg.addEvent")}
                </button>
                <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="text-xs font-bold border border-zinc-200 text-zinc-500 px-3 py-2 rounded-lg hover:bg-zinc-50">{t("portal.dg.today")}</button>
                <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden">
                  <button onClick={() => setWeekStart((d) => addDays(d, -7))} className="p-2 hover:bg-zinc-50 text-zinc-400 border-r border-zinc-200"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-sm font-bold text-zinc-700 px-4 min-w-48 text-center">{weekLabel()}</span>
                  <button onClick={() => setWeekStart((d) => addDays(d, 7))} className="p-2 hover:bg-zinc-50 text-zinc-400 border-l border-zinc-200"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {days.map((day, i) => {
                const dayEvs = eventsForDay(day);
                const isToday = toDateStr(day) === toDateStr(today);
                const isPast = day < today;
                return (
                  <div key={i} className={`rounded-xl border overflow-hidden ${isToday ? "border-purple-300 bg-purple-50/50" : isPast ? "border-zinc-100 opacity-60" : "border-zinc-100"}`}>
                    <div className={`px-5 py-3 flex items-center justify-between border-b ${isToday ? "border-purple-200 bg-purple-50" : "border-zinc-100 bg-zinc-50"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`text-center min-w-[36px] ${isToday ? "text-purple-600" : isPast ? "text-zinc-400" : "text-zinc-700"}`}>
                          <p className="text-[10px] font-black uppercase tracking-widest">{DAYS[i]}</p>
                          <p className="text-xl font-black leading-none mt-0.5">{day.getDate()}</p>
                        </div>
                        {isToday && <span className="text-[10px] font-black text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">{t("portal.dg.today")}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {dayEvs.length > 0 && <span className="text-xs text-zinc-400 font-semibold">{dayEvs.length} {dayEvs.length > 1 ? t("portal.commercial_page.eventsToday") : t("portal.commercial_page.eventToday")}</span>}
                        <button onClick={() => openEventCreate(toDateStr(day))} className="text-zinc-400 hover:text-purple-600 transition-colors p-1"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    {loading ? (
                      <div className="px-5 py-3 text-zinc-400 text-sm">—</div>
                    ) : dayEvs.length === 0 ? (
                      <div className="px-5 py-4 text-center text-zinc-400 text-sm">{t("portal.commercial_page.noEventsToday")}</div>
                    ) : (
                      <div className="divide-y divide-zinc-50">
                        {dayEvs.map((ev) => {
                          const et = EVENT_TYPES.find((et) => et.value === ev.type) ?? EVENT_TYPES[3];
                          const com = commercials.find((c) => c.id === ev.commercial_id);
                          return (
                            <div key={ev.id} className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-zinc-50">
                              <div className="flex items-start gap-3 min-w-0">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${et.color}`}>{et.label}</span>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-zinc-900">{ev.title}</p>
                                  {ev.client_name && <p className="text-xs text-zinc-500">{ev.client_name}</p>}
                                  {com && (
                                    <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: com.color }} />
                                      {com.name}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <button onClick={() => { openEventEdit(ev); setSaveError(null); }} className="text-zinc-300 hover:text-zinc-600 shrink-0 p-1"><Pencil className="w-3.5 h-3.5" /></button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── VENTES TAB ── */}
        {tab === "ventes" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                  <input value={saleSearch} onChange={(e) => setSaleSearch(e.target.value)} placeholder={t("portal.dg.searchClientMachine")}
                    className="border border-zinc-200 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-700 focus:outline-none focus:border-purple-500 w-56" />
                </div>
                <div className="flex items-center gap-1">
                  {[{ value: "all", label: t("portal.common.all") }, ...SALE_STATUSES].map((s) => (
                    <button key={s.value} onClick={() => setStatusFilter(s.value)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${statusFilter === s.value ? "bg-purple-600 border-purple-600 text-white" : "border-zinc-200 text-zinc-500 hover:border-zinc-300"}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={openSaleCreate} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors">
                <Plus className="w-4 h-4" /> {t("portal.dg.addSale")}
              </button>
            </div>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-white border border-zinc-100 rounded-xl animate-pulse" />)}</div>
            ) : (
              <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="text-left px-5 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">{t("portal.dg.commercial")}</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">{t("portal.common.client")}</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">{t("portal.dg.machineCol")}</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">{t("portal.common.amount")}</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">{t("portal.common.date")}</th>
                      <th className="text-left px-5 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider">{t("portal.common.status")}</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {filteredSales.length === 0 ? (
                      <tr><td colSpan={7} className="px-5 py-10 text-center text-zinc-400 text-sm">{t("portal.commercial_page.noSales")}</td></tr>
                    ) : filteredSales.map((s) => {
                      const st = SALE_STATUSES.find((x) => x.value === s.status) ?? SALE_STATUSES[0];
                      const com = commercials.find((c) => c.id === s.commercial_id);
                      return (
                        <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-5 py-3">
                            {com ? (
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-black" style={{ backgroundColor: com.color }}>
                                  {com.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                                </span>
                                <span className="text-xs text-zinc-600">{com.name}</span>
                              </div>
                            ) : "—"}
                          </td>
                          <td className="px-5 py-3 font-semibold text-zinc-900">{s.client_name}</td>
                          <td className="px-5 py-3 text-zinc-500">{[s.machine_brand, s.machine_model].filter(Boolean).join(" ") || "—"}</td>
                          <td className="px-5 py-3 font-bold text-zinc-900">{s.invoice_amount ? `${s.invoice_amount.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} MAD` : "—"}</td>
                          <td className="px-5 py-3 text-zinc-500 text-xs">{s.invoice_date ? new Date(s.invoice_date + "T00:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB") : "—"}</td>
                          <td className="px-5 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span></td>
                          <td className="px-5 py-3">
                            <button onClick={() => openSaleEdit(s)} className="text-zinc-300 hover:text-zinc-600 p-1"><Pencil className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── RAPPORTS TAB ── */}
        {tab === "rapports" && (
          <div>
            {/* Filters */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <select
                value={reportCommercialFilter}
                onChange={(e) => setReportCommercialFilter(e.target.value)}
                className="border border-zinc-200 rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 focus:outline-none focus:border-purple-500"
              >
                <option value="all">{t("portal.dg.allCommercials")}</option>
                {commercials.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex gap-1">
                {([["all", t("portal.common.all")], ["pending", t("portal.dg.reportPending")], ["validated", t("portal.dg.reportValidated")]] as const).map(([v, label]) => (
                  <button key={v} onClick={() => setReportValidFilter(v)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${reportValidFilter === v ? "bg-purple-600 border-purple-600 text-white" : "border-zinc-200 text-zinc-500 hover:border-zinc-300"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-zinc-400 ml-auto">
                {reports.filter((r) => !r.validated_by_dg).length} {t("portal.dg.awaitingValidation")}
              </span>
            </div>

            {/* Report list */}
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-white border border-zinc-100 rounded-xl animate-pulse" />)}</div>
            ) : (() => {
              const filtered = reports.filter((r) => {
                if (reportCommercialFilter !== "all" && r.commercial_id !== reportCommercialFilter) return false;
                if (reportValidFilter === "pending" && r.validated_by_dg) return false;
                if (reportValidFilter === "validated" && !r.validated_by_dg) return false;
                return true;
              });
              if (filtered.length === 0) return (
                <div className="bg-white border border-zinc-100 rounded-xl py-14 text-center">
                  <FileText className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
                  <p className="text-zinc-400 text-sm">{t("portal.commercial_page.noReports")}</p>
                </div>
              );
              const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
                positif:       { label: t("portal.commercial_page.outcomeLabels.positif"),       color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                neutre:        { label: t("portal.commercial_page.outcomeLabels.neutre"),        color: "text-blue-600 bg-blue-50 border-blue-200" },
                negatif:       { label: t("portal.commercial_page.outcomeLabels.negatif"),       color: "text-red-600 bg-red-50 border-red-200" },
                a_recontacter: { label: t("portal.commercial_page.outcomeLabels.a_recontacter"), color: "text-orange-600 bg-orange-50 border-orange-200" },
              };
              return (
                <div className="space-y-3">
                  {filtered.map((r) => {
                    const oc = r.outcome ? OUTCOME_LABELS[r.outcome] : null;
                    const com = commercials.find((c) => c.id === r.commercial_id);
                    return (
                      <div key={r.id} className={`bg-white border rounded-xl p-5 transition-colors ${r.validated_by_dg ? "border-zinc-100" : "border-amber-200 bg-amber-50/30"}`}>
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <p className="font-bold text-zinc-900 text-sm">{r.client_name}</p>
                              {oc && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${oc.color}`}>{oc.label}</span>}
                              {r.validated_by_dg ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  <Check className="w-3 h-3" /> {t("portal.dg.validated")}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  {t("portal.dg.reportPending")}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-400">
                              {com && (
                                <span className="flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: com.color }} />
                                  {com.name}
                                </span>
                              )}
                              <span>·</span>
                              <span>{new Date(r.date + "T00:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
                            </div>
                          </div>
                        </div>

                        {r.summary && <p className="text-sm text-zinc-600 whitespace-pre-line mb-2 leading-relaxed">{r.summary}</p>}
                        {r.next_step && (
                          <p className="text-xs text-zinc-500 italic mb-2">→ {r.next_step}</p>
                        )}

                        {/* Already validated: show DG comment */}
                        {r.validated_by_dg && r.dg_comment && (
                          <div className="mt-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                            <p className="text-xs text-purple-700"><span className="font-bold">{t("portal.dg.dgComment")} :</span> {r.dg_comment}</p>
                          </div>
                        )}

                        {/* Not yet validated: show validation form */}
                        {!r.validated_by_dg && (
                          <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2">
                            <textarea
                              value={dgComments[r.id] ?? ""}
                              onChange={(e) => setDgComments((prev) => ({ ...prev, [r.id]: e.target.value }))}
                              placeholder={t("portal.dg.dgCommentPlaceholder")}
                              rows={2}
                              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-purple-500 resize-none"
                            />
                            <button
                              onClick={() => validateReport(r.id)}
                              disabled={validating === r.id}
                              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
                            >
                              <Check className="w-3.5 h-3.5" />
                              {validating === r.id ? t("portal.dg.validating") : t("portal.dg.validateReport")}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── OBJECTIFS TAB ── */}
        {tab === "objectifs" && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <label className="text-sm font-bold text-zinc-600">{t("portal.dg.month")} :</label>
              <select value={targetMonth} onChange={(e) => setTargetMonth(Number(e.target.value))} className="border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:border-purple-500">
                {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
              <select value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} className="border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:border-purple-500">
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="space-y-4">
              {commercials.filter((com) => com.title !== "Directeur Général" && !com.name.toLowerCase().includes("domenico")).map((com) => {
                const tg = targets.find((t) => t.commercial_id === com.id && t.year === targetYear && t.month === targetMonth);
                const comSales = sales.filter((s) => s.commercial_id === com.id && ["facture", "paye"].includes(s.status) && s.invoice_date?.startsWith(`${targetYear}-${String(targetMonth).padStart(2, "0")}`));
                const ca = comSales.reduce((sum, s) => sum + (s.invoice_amount ?? 0), 0);
                const target = Number(targetForm[com.id] ?? tg?.target_amount ?? 0);
                const progress = target > 0 ? Math.min((ca / target) * 100, 100) : 0;
                return (
                  <div key={com.id} className="bg-white border border-zinc-100 rounded-xl p-5">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black" style={{ backgroundColor: com.color }}>
                          {com.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-zinc-900">{com.name}</p>
                          <p className="text-xs text-zinc-500">{com.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-zinc-500">{t("portal.dg.targetMAD")}</label>
                          <input type="number" value={targetForm[com.id] ?? ""} min={0}
                            onChange={(e) => setTargetForm((f) => ({ ...f, [com.id]: e.target.value }))}
                            className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:border-purple-500" />
                        </div>
                        <button onClick={() => saveTarget(com.id)} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors">
                          <Check className="w-3.5 h-3.5" /> {t("portal.common.save")}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-zinc-500">CA {MONTHS[targetMonth - 1]} {targetYear}</span>
                      <span className="font-bold text-zinc-900">{ca > 0 ? `${ca.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} MAD` : "—"}{target > 0 ? ` / ${target.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} MAD` : ""}</span>
                    </div>
                    {target > 0 && (
                      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${progress >= 100 ? "bg-emerald-500" : progress >= 70 ? "bg-sky-500" : "bg-orange-400"}`} style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Event form modal */}
      {showEventForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-zinc-100">
              <h3 className="font-black text-zinc-900">{editEvent ? t("portal.dg.editEvent") : t("portal.dg.newEvent")}</h3>
              <button onClick={() => { setShowEventForm(false); setEditEvent(null); setSaveError(null); }} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveEvent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.dg.commercial")} *</label>
                <select value={eventForm.commercial_id} onChange={(e) => setEventForm((f) => ({ ...f, commercial_id: e.target.value }))} required
                  className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500">
                  <option value="">— {t("portal.dg.choose")} —</option>
                  {commercials.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.dg.eventTitle")} *</label>
                <input value={eventForm.title} onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))} required
                  className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.dg.eventType")}</label>
                  <select value={eventForm.type} onChange={(e) => setEventForm((f) => ({ ...f, type: e.target.value as CommercialEvent["type"] }))}
                    className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500">
                    {EVENT_TYPES.map((et) => <option key={et.value} value={et.value}>{et.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.common.date")} *</label>
                  <input type="date" value={eventForm.date} onChange={(e) => setEventForm((f) => ({ ...f, date: e.target.value }))} required
                    className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.dg.startTime")}</label>
                  <input type="time" value={eventForm.start_time} onChange={(e) => setEventForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.dg.endTime")}</label>
                  <input type="time" value={eventForm.end_time} onChange={(e) => setEventForm((f) => ({ ...f, end_time: e.target.value }))}
                    className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.common.client")}</label>
                <input value={eventForm.client_name} onChange={(e) => setEventForm((f) => ({ ...f, client_name: e.target.value }))}
                  className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
              </div>
              {saveError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>}
              <div className="flex gap-3 pt-1">
                {editEvent && (
                  <button type="button" onClick={() => deleteEvent(editEvent)} className="flex items-center gap-1.5 text-xs font-bold text-red-500 border border-red-200 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> {t("portal.common.delete")}
                  </button>
                )}
                <button type="button" onClick={() => { setShowEventForm(false); setEditEvent(null); setSaveError(null); }} className="flex-1 border border-zinc-200 text-zinc-600 font-bold py-2.5 rounded-xl hover:bg-zinc-50 text-sm">{t("portal.common.cancel")}</button>
                <button type="submit" disabled={saving} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-black py-2.5 rounded-xl disabled:opacity-60 text-sm">{saving ? "..." : t("portal.common.save")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale form modal */}
      {showSaleForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-zinc-100 sticky top-0 bg-white">
              <h3 className="font-black text-zinc-900">{editSale ? t("portal.commercial_page.editSale") : t("portal.commercial_page.newSale")}</h3>
              <button onClick={() => { setShowSaleForm(false); setEditSale(null); }} className="text-zinc-400 hover:text-zinc-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveSale} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.dg.commercial")} *</label>
                <select value={saleForm.commercial_id} onChange={(e) => setSaleForm((f) => ({ ...f, commercial_id: e.target.value }))} required
                  className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500">
                  <option value="">— {t("portal.dg.choose")} —</option>
                  {commercials.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.commercial_page.formMachine")}</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                  <input value={machineSearch} onChange={(e) => { setMachineSearch(e.target.value); setShowMachineList(true); setSaleForm((f) => ({ ...f, machine_brand: "", machine_model: "", machine_category: "" })); }}
                    onFocus={() => setShowMachineList(true)} placeholder={t("portal.dg.searchCatalog")}
                    className="w-full border border-zinc-200 rounded-lg pl-9 pr-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
                  {showMachineList && filteredMachines.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-zinc-200 rounded-xl shadow-xl z-20 max-h-44 overflow-y-auto">
                      {filteredMachines.map((m, i) => (
                        <button key={i} type="button" onMouseDown={() => selectMachine(m)}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-zinc-50 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900">{m.brand} {m.model}</p>
                            <p className="text-xs text-zinc-400">{m.categoryLabel}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {saleForm.machine_brand && <p className="text-xs text-purple-600 mt-1.5 font-semibold">✓ {saleForm.machine_brand} {saleForm.machine_model}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.common.client")} *</label>
                <input value={saleForm.client_name} onChange={(e) => setSaleForm((f) => ({ ...f, client_name: e.target.value }))} required
                  className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.commercial_page.formInvoiceAmount")}</label>
                  <input type="number" value={saleForm.invoice_amount} onChange={(e) => setSaleForm((f) => ({ ...f, invoice_amount: e.target.value }))} min={0}
                    className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.commercial_page.formInvoiceDate")}</label>
                  <input type="date" value={saleForm.invoice_date} onChange={(e) => setSaleForm((f) => ({ ...f, invoice_date: e.target.value }))}
                    className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.commercial_page.formStatus")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {SALE_STATUSES.map((s) => (
                    <button key={s.value} type="button" onClick={() => setSaleForm((f) => ({ ...f, status: s.value }))}
                      className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors ${saleForm.status === s.value ? "bg-purple-100 border-purple-300 text-purple-700" : "border-zinc-200 text-zinc-500 hover:border-zinc-300"}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              {saveError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>}
              <div className="flex gap-3 pt-1">
                {editSale && (
                  <button type="button" onClick={() => deleteSale(editSale)} className="flex items-center gap-1.5 text-xs font-bold text-red-500 border border-red-200 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> {t("portal.common.delete")}
                  </button>
                )}
                <button type="button" onClick={() => { setShowSaleForm(false); setEditSale(null); setSaveError(null); }} className="flex-1 border border-zinc-200 text-zinc-600 font-bold py-2.5 rounded-xl hover:bg-zinc-50 text-sm">{t("portal.common.cancel")}</button>
                <button type="submit" disabled={saving} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-black py-2.5 rounded-xl disabled:opacity-60 text-sm">{saving ? "..." : t("portal.common.save")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DGLayout>
  );
}
