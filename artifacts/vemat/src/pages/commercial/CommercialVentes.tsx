import { useEffect, useState, useMemo } from "react";
import { Plus, X, Check, Pencil, Trash2, TrendingUp, Search, Upload, FileText, Download } from "lucide-react";
import { CommercialLayout } from "./CommercialLayout";
import { useCommercialAuth } from "@/contexts/CommercialAuthContext";
import { supabaseCommercial } from "@/lib/supabase";
import type { CommercialSale, PublicDevisRequest, SaleStatus } from "@/lib/database.types";
import { catalog } from "@/data/products";
import { MACHINE_CATEGORIES } from "@/lib/constants";
import { useLang } from "@/i18n/I18nProvider";

const CATEGORY_LABELS: Record<string, string> = {
  grues: "Grues", nacelles: "Nacelles & Plateformes", elevateurs: "Élévateurs Télescopiques", construction: "Construction",
};

const ALL_MACHINES = Object.entries(catalog).flatMap(([cat, subcats]) =>
  subcats.flatMap((sub) => sub.models.map((m) => ({ brand: m.brand, model: m.name, category: cat, categoryLabel: CATEGORY_LABELS[cat] ?? cat, sub: sub.title.fr })))
);

function getSaleStatuses(t: (k: string) => string): { value: SaleStatus; label: string; color: string }[] {
  return [
    { value: "devis",        label: t("portal.commercial_page.saleStatuses.devis"),        color: "text-zinc-400 bg-zinc-800 border-zinc-700" },
    { value: "bon_commande", label: t("portal.commercial_page.saleStatuses.bon_commande"), color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    { value: "facture",      label: t("portal.commercial_page.saleStatuses.facture"),      color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
    { value: "paye",         label: t("portal.commercial_page.saleStatuses.paye"),         color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  ];
}

const emptyForm = () => ({ client_name: "", machine_brand: "", machine_model: "", machine_category: "", quantity: 1, invoice_amount: "", invoice_date: "", status: "devis" as SaleStatus, notes: "" });

function generateRef() { return `VNT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`; }

export default function CommercialVentes() {
  const { lang, t } = useLang();
  const SALE_STATUSES = getSaleStatuses(t);
  const { commercial } = useCommercialAuth();
  const [sales, setSales] = useState<CommercialSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editSale, setEditSale] = useState<CommercialSale | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [machineSearch, setMachineSearch] = useState("");
  const [showMachineList, setShowMachineList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [incomingDevis, setIncomingDevis] = useState<PublicDevisRequest[]>([]);
  const [convertingLead, setConvertingLead] = useState<string | null>(null);

  const load = async () => {
    if (!commercial) return;
    setLoading(true);
    const { data } = await supabaseCommercial.from("commercial_sales")
      .select("*").eq("commercial_id", commercial.id).order("created_at", { ascending: false });
    setSales(data ?? []);
    const { data: leads } = await supabaseCommercial.from("form_devis").select("*")
      .in("product_category", MACHINE_CATEGORIES as unknown as string[])
      .neq("status", "converti")
      .order("created_at", { ascending: false });
    setIncomingDevis((leads ?? []) as PublicDevisRequest[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [commercial]);

  const filteredMachines = useMemo(() => {
    if (!machineSearch.trim()) return ALL_MACHINES.slice(0, 20);
    const q = machineSearch.toLowerCase();
    return ALL_MACHINES.filter((m) => m.brand.toLowerCase().includes(q) || m.model.toLowerCase().includes(q) || m.categoryLabel.toLowerCase().includes(q)).slice(0, 30);
  }, [machineSearch]);

  const openCreate = () => { setEditSale(null); setForm(emptyForm()); setMachineSearch(""); setFileToUpload(null); setShowForm(true); };
  const openEdit = (s: CommercialSale) => {
    setEditSale(s);
    setForm({ client_name: s.client_name, machine_brand: s.machine_brand ?? "", machine_model: s.machine_model ?? "", machine_category: s.machine_category ?? "", quantity: s.quantity, invoice_amount: s.invoice_amount ? String(s.invoice_amount) : "", invoice_date: s.invoice_date ?? "", status: s.status, notes: s.notes ?? "" });
    setMachineSearch(s.machine_model ? `${s.machine_brand} ${s.machine_model}` : "");
    setFileToUpload(null);
    setShowForm(true);
  };

  const selectMachine = (m: typeof ALL_MACHINES[0]) => {
    setForm((f) => ({ ...f, machine_brand: m.brand, machine_model: m.model, machine_category: m.category }));
    setMachineSearch(`${m.brand} ${m.model}`);
    setShowMachineList(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commercial || !form.client_name) return;
    setSaving(true);
    let fileUrl = editSale?.invoice_file_url ?? null;
    if (fileToUpload) {
      const path = `invoices/${commercial.id}/${Date.now()}_${fileToUpload.name}`;
      const { data: up } = await supabaseCommercial.storage.from("commercial-invoices").upload(path, fileToUpload, { upsert: true });
      if (up) fileUrl = up.path;
    }
    const payload: Partial<CommercialSale> = {
      commercial_id: commercial.id,
      client_name: form.client_name,
      machine_brand: form.machine_brand || null,
      machine_model: form.machine_model || null,
      machine_category: form.machine_category || null,
      quantity: form.quantity,
      invoice_amount: form.invoice_amount ? Number(form.invoice_amount) : null,
      invoice_date: form.invoice_date || null,
      invoice_file_url: fileUrl,
      status: form.status,
      notes: form.notes || null,
    };
    let error;
    if (editSale) {
      ({ error } = await supabaseCommercial.from("commercial_sales").update(payload).eq("id", editSale.id));
    } else {
      ({ error } = await supabaseCommercial.from("commercial_sales").insert({ ...payload, reference: generateRef() }));
    }
    setSaving(false);
    if (error) { alert(`Erreur: ${error.message}`); return; }
    setShowForm(false);
    setEditSale(null);
    load();
  };

  const handleDelete = async (s: CommercialSale) => {
    if (!confirm(t("portal.commercial_page.confirmDeleteSale"))) return;
    await supabaseCommercial.from("commercial_sales").delete().eq("id", s.id);
    setShowForm(false);
    load();
  };

  const createSaleFromLead = async (devis: PublicDevisRequest) => {
    if (!commercial) return;
    setConvertingLead(devis.id);
    try {
      const ref = `VNT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const { data: newSale } = await supabaseCommercial.from("commercial_sales").insert({
        commercial_id: commercial.id,
        reference: ref,
        client_name: devis.company_name,
        machine_brand: devis.product_brand ?? null,
        machine_model: devis.product_model ?? null,
        machine_category: devis.product_category ?? null,
        quantity: devis.quantity ?? 1,
        invoice_amount: null,
        invoice_date: null,
        status: "devis" as SaleStatus,
        notes: devis.notes ?? null,
      }).select("id").single();
      if (newSale) {
        await supabaseCommercial.from("form_devis").update({
          status: "converti",
          converted_to_sale_id: newSale.id,
        } as any).eq("id", devis.id);
        setIncomingDevis((prev) => prev.filter((d) => d.id !== devis.id));
        load();
      }
    } finally {
      setConvertingLead(null);
    }
  };

  const openInvoice = async (s: CommercialSale) => {
    if (!s.invoice_file_url) return;
    const { data } = await supabaseCommercial.storage.from("commercial-invoices").createSignedUrl(s.invoice_file_url, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const filtered = statusFilter === "all" ? sales : sales.filter((s) => s.status === statusFilter);
  const totalCA = sales.filter((s) => ["facture", "paye"].includes(s.status)).reduce((sum, s) => sum + (s.invoice_amount ?? 0), 0);

  return (
    <CommercialLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">{t("portal.commercial_page.salesTitle")}</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {sales.length} {sales.length !== 1 ? t("portal.commercial_page.salesPlural") : t("portal.commercial_page.sale")} · {t("portal.commercial_page.billedCA")} : {totalCA > 0 ? `${totalCA.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} MAD` : "—"}
            </p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> {t("portal.commercial_page.newSale")}
          </button>
        </div>

        {/* Affaires entrantes */}
        {incomingDevis.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <h2 className="text-sm font-black text-white uppercase tracking-widest">{t("portal.commercial_page.incomingLeads")}</h2>
              <span className="text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">{incomingDevis.length}</span>
            </div>
            <div className="space-y-2">
              {incomingDevis.map((d) => (
                <div key={d.id} className="bg-zinc-900 border border-purple-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs text-zinc-500">{d.reference}</span>
                      <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full">{t("portal.commercial_page.newBadge")}</span>
                    </div>
                    <p className="text-sm font-bold text-white">{d.company_name}</p>
                    <p className="text-xs text-zinc-400">{d.product_category}{d.product_brand ? ` · ${d.product_brand}` : ""}{d.product_model ? ` ${d.product_model}` : ""} · Qté {d.quantity}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-zinc-500">{d.contact_name}</p>
                      <p className="text-xs text-zinc-600">{new Date(d.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB")}</p>
                    </div>
                    <button
                      onClick={() => createSaleFromLead(d)}
                      disabled={convertingLead === d.id}
                      className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {convertingLead === d.id ? t("portal.commercial_page.creating") : t("portal.commercial_page.createSale")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status filter */}
        <div className="flex items-center gap-2 mb-5">
          {[{ value: "all", label: t("portal.commercial_page.allSales") }, ...SALE_STATUSES].map((s) => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${statusFilter === s.value ? "bg-sky-600 border-sky-600 text-white" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}>
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl py-16 text-center">
            <TrendingUp className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">{t("portal.commercial_page.noSales")}</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-5 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("portal.common.reference")}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("portal.common.client")}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("portal.commercial_page.machine")}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("portal.common.amount")}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("portal.common.date")}</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t("portal.common.status")}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((s) => {
                  const st = SALE_STATUSES.find((x) => x.value === s.status) ?? SALE_STATUSES[0];
                  return (
                    <tr key={s.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-5 py-4 font-mono text-xs text-zinc-400">{s.reference ?? "—"}</td>
                      <td className="px-5 py-4 font-semibold text-white">{s.client_name}</td>
                      <td className="px-5 py-4 text-zinc-400">{[s.machine_brand, s.machine_model].filter(Boolean).join(" ") || "—"}</td>
                      <td className="px-5 py-4 font-bold text-white">{s.invoice_amount ? `${s.invoice_amount.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} MAD` : "—"}</td>
                      <td className="px-5 py-4 text-zinc-400 text-xs">{s.invoice_date ? new Date(s.invoice_date + "T00:00:00").toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB") : "—"}</td>
                      <td className="px-5 py-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {s.invoice_file_url && (
                            <button onClick={() => openInvoice(s)} className="text-zinc-600 hover:text-sky-400 transition-colors p-1" title={t("portal.commercial_page.downloadInvoice")}>
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => openEdit(s)} className="text-zinc-600 hover:text-zinc-300 transition-colors p-1">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sale form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
              <h3 className="font-black text-white">{editSale ? t("portal.commercial_page.editSale") : t("portal.commercial_page.newSale")}</h3>
              <button onClick={() => { setShowForm(false); setEditSale(null); }} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Machine search */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">{t("portal.commercial_page.formMachine")}</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input
                    value={machineSearch}
                    onChange={(e) => { setMachineSearch(e.target.value); setShowMachineList(true); setForm((f) => ({ ...f, machine_brand: "", machine_model: "", machine_category: "" })); }}
                    onFocus={() => setShowMachineList(true)}
                    placeholder={t("portal.commercial_page.formMachinePlaceholder")}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500"
                  />
                  {showMachineList && filteredMachines.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-20 max-h-52 overflow-y-auto">
                      {filteredMachines.map((m, i) => (
                        <button key={i} type="button" onMouseDown={() => selectMachine(m)}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-zinc-700 transition-colors flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{m.brand} {m.model}</p>
                            <p className="text-xs text-zinc-500">{m.categoryLabel}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {form.machine_brand && (
                  <p className="text-xs text-sky-400 mt-1.5">✓ {form.machine_brand} {form.machine_model} · {CATEGORY_LABELS[form.machine_category] ?? form.machine_category}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">{t("portal.commercial_page.formBuyer")} *</label>
                <input value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} required
                  placeholder={t("portal.commercial_page.formBuyerPlaceholder")} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">{t("portal.commercial_page.formInvoiceAmount")}</label>
                  <input type="number" value={form.invoice_amount} onChange={(e) => setForm((f) => ({ ...f, invoice_amount: e.target.value }))}
                    placeholder="0" min={0} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">{t("portal.commercial_page.formInvoiceDate")}</label>
                  <input type="date" value={form.invoice_date} onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">{t("portal.common.quantity")}</label>
                  <input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                    min={1} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">{t("portal.common.status")}</label>
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as SaleStatus }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500">
                    {SALE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">{t("portal.commercial_page.formInvoiceFile")}</label>
                <label className="flex items-center gap-3 bg-zinc-800 border border-dashed border-zinc-600 hover:border-sky-500 rounded-lg px-4 py-3 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm text-zinc-400">{fileToUpload ? fileToUpload.name : editSale?.invoice_file_url ? t("portal.commercial_page.replaceFile") : t("portal.commercial_page.addFile")}</span>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setFileToUpload(e.target.files?.[0] ?? null)} />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">{t("portal.common.notes")}</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
                  placeholder={t("portal.commercial_page.formNotesPlaceholder")} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-sky-500 resize-none" />
              </div>

              <div className="flex gap-3 pt-1">
                {editSale && (
                  <button type="button" onClick={() => handleDelete(editSale)}
                    className="flex items-center gap-1.5 text-xs font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" /> {t("portal.common.delete")}
                  </button>
                )}
                <button type="button" onClick={() => { setShowForm(false); setEditSale(null); }}
                  className="flex-1 border border-zinc-700 text-zinc-400 font-bold py-2.5 rounded-xl hover:bg-zinc-800 transition-colors text-sm">
                  {t("portal.common.cancel")}
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-black py-2.5 rounded-xl transition-colors disabled:opacity-60 text-sm">
                  <Check className="w-4 h-4" /> {saving ? "..." : t("portal.common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </CommercialLayout>
  );
}
