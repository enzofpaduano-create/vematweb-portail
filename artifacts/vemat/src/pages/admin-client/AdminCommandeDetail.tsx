import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Upload, Save, CreditCard, Truck, ExternalLink, Camera } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { AdminGuard } from "./AdminGuard";
import { OrderStatusBadge } from "@/components/espace-client/StatusBadge";
import { OrderTimeline } from "@/components/espace-client/StatusTimeline";
import { supabaseAdmin } from "@/lib/supabase";
import type { DevisRequest, Company, OrderStatus, OrderItem } from "@/lib/database.types";
import { ORDER_STATUSES } from "@/lib/database.types";
import {
  sendOrderQuoteSentEmail,
  sendOrderPaidEmail,
  sendOrderInDeliveryEmail,
  sendOrderDeliveredEmail,
  sendOrderCancelledEmail,
} from "@/lib/clientEmails";
import { useLang } from "@/i18n/I18nProvider";

export default function AdminCommandeDetail() {
  const { lang, t } = useLang();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<DevisRequest | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Main fields
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<OrderStatus>("en_traitement");
  const [amount, setAmount] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editableItems, setEditableItems] = useState<OrderItem[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Payment tracking
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);
  const paymentProofRef = useRef<HTMLInputElement>(null);

  // ── Delivery & BL
  const [deliveryDate, setDeliveryDate] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [blFile, setBlFile] = useState<File | null>(null);
  const [blUrl, setBlUrl] = useState<string | null>(null);
  const [savingBl, setSavingBl] = useState(false);
  const blRef = useRef<HTMLInputElement>(null);

  const load = () => {
    supabaseAdmin.from("devis_requests").select("*, companies(*)").eq("id", id!).single()
      .then(({ data }) => {
        if (!data) return;
        const o = data as DevisRequest & { companies?: Company };
        setOrder(o);
        setCompany(o.companies ?? null);
        setStatus(o.status);
        setAmount(o.quote_amount?.toString() ?? "");
        setEditableItems((o.items as unknown as OrderItem[]) ?? []);
        // Payment
        setPaymentDate((o as any).payment_date ?? "");
        setPaymentProofUrl((o as any).payment_proof_url ?? null);
        // Delivery
        setDeliveryDate((o as any).delivery_date ?? "");
        setCarrier((o as any).carrier ?? "");
        setTrackingNumber((o as any).tracking_number ?? "");
        setBlUrl((o as any).bl_url ?? null);
        setLoading(false);
      });
  };
  useEffect(load, [id]);

  // ── Save: main commande section
  const handleSave = async () => {
    if (!order) return;
    setSaving(true);
    let pdfUrl = order.quote_pdf_url;

    if (pdfFile) {
      setUploading(true);
      const path = `${order.company_id}/${order.id}/${pdfFile.name}`;
      await supabaseAdmin.storage.from("quotes").upload(path, pdfFile, { upsert: true });
      pdfUrl = path;
      setUploading(false);
    }

    const oldStatus = order.status;
    await supabaseAdmin.from("devis_requests").update({
      status,
      quote_amount: amount ? parseFloat(amount) : null,
      quote_pdf_url: pdfUrl,
      items: editableItems as unknown as import("@/lib/database.types").Json,
    }).eq("id", order.id);

    if (oldStatus !== status) {
      await supabaseAdmin.from("status_history").insert({
        entity_type: "devis",
        entity_id: order.id,
        old_status: oldStatus,
        new_status: status,
      });
      // Email automatique au client à chaque transition de statut (cf. lib/clientEmails.ts).
      const amountNum = amount ? parseFloat(amount) : null;
      if (status === "devis_envoye") {
        await sendOrderQuoteSentEmail({ orderId: order.id, reference: order.reference, amount: amountNum });
      } else if (status === "commande_payee") {
        await sendOrderPaidEmail({ orderId: order.id, reference: order.reference });
      } else if (status === "en_livraison") {
        await sendOrderInDeliveryEmail({ orderId: order.id, reference: order.reference, carrier: order.carrier ?? null, trackingNumber: order.tracking_number ?? null });
      } else if (status === "livree") {
        await sendOrderDeliveredEmail({ orderId: order.id, reference: order.reference });
      } else if (status === "annulee") {
        await sendOrderCancelledEmail({ orderId: order.id, reference: order.reference });
      }
    }

    setSaving(false);
    setPdfFile(null);
    load();
  };

  // ── Save: payment section
  const handleSavePayment = async () => {
    if (!order) return;
    setSavingPayment(true);
    let finalProofUrl = paymentProofUrl;

    if (paymentProofFile) {
      const path = `${order.company_id}/${order.id}/payment-${paymentProofFile.name}`;
      await supabaseAdmin.storage.from("quotes").upload(path, paymentProofFile, { upsert: true });
      const { data: pub } = supabaseAdmin.storage.from("quotes").getPublicUrl(path);
      finalProofUrl = pub.publicUrl;
      setPaymentProofUrl(finalProofUrl);
      setPaymentProofFile(null);
    }

    await (supabaseAdmin.from("devis_requests") as any).update({
      payment_date: paymentDate || null,
      payment_proof_url: finalProofUrl,
    }).eq("id", order.id);

    setSavingPayment(false);
  };

  // ── Save: BL / delivery section
  const handleSaveBL = async () => {
    if (!order) return;
    setSavingBl(true);
    let finalBlUrl = blUrl;

    if (blFile) {
      const path = `${order.company_id}/${order.id}/bl-${blFile.name}`;
      await supabaseAdmin.storage.from("quotes").upload(path, blFile, { upsert: true });
      const { data: pub } = supabaseAdmin.storage.from("quotes").getPublicUrl(path);
      finalBlUrl = pub.publicUrl;
      setBlUrl(finalBlUrl);
      setBlFile(null);
    }

    await (supabaseAdmin.from("devis_requests") as any).update({
      delivery_date: deliveryDate || null,
      carrier: carrier || null,
      tracking_number: trackingNumber || null,
      bl_url: finalBlUrl,
    }).eq("id", order.id);

    setSavingBl(false);
  };

  if (loading) return <AdminGuard><AdminLayout><div className="p-8 text-zinc-400">{t("portal.common.loading")}</div></AdminLayout></AdminGuard>;
  if (!order) return <AdminGuard><AdminLayout><div className="p-8 text-zinc-400">{t("portal.admin.orderNotFound")}</div></AdminLayout></AdminGuard>;

  const updateItemPrice = (i: number, value: string) => {
    setEditableItems((prev) => prev.map((it, idx) => idx === i ? { ...it, unit_price: value ? parseFloat(value) : undefined } : it));
  };

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-8 max-w-4xl">
          <Link href="/espace-manager/commandes" className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("portal.admin.backToOrders")}
          </Link>

          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-zinc-900">{order.reference}</h1>
              <p className="text-zinc-500 text-sm mt-1">{company?.name} · {new Date(order.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-zinc-100 p-6 mb-5">
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-5">{t("portal.admin.progress")}</h2>
            <OrderTimeline status={order.status} />
          </div>

          {/* ── Gestion de la commande ── */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-5">
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-4">{t("portal.admin.orderManagement")}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.commercial_page.formStatus")}</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}
                  className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent">
                  {ORDER_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {t(`portal.orders.statusLabels.${s.value}`) || s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.admin.quoteAmount")}</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex: 15000"
                  className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.admin.quotePdf")}</label>
                <div className="flex items-center gap-3">
                  <input ref={fileRef} type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} className="hidden" />
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 border border-zinc-200 text-zinc-600 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-zinc-50 transition-colors">
                    <Upload className="w-4 h-4" /> {pdfFile ? pdfFile.name : t("portal.admin.choosePdf")}
                  </button>
                  {order.quote_pdf_url && !pdfFile && <span className="text-xs text-emerald-600 font-semibold">✓ {t("portal.admin.pdfUploaded")}</span>}
                </div>
              </div>
              <button onClick={handleSave} disabled={saving || uploading}
                className="flex items-center gap-2 bg-accent text-accent-foreground font-bold text-sm px-5 py-2.5 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60">
                <Save className="w-4 h-4" />
                {uploading ? t("portal.admin.uploadingPdf") : saving ? t("portal.common.saving") : t("portal.admin.saveChanges")}
              </button>
            </div>
          </div>

          {/* ── Suivi du paiement ── */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500">{t("portal.admin.paymentTracking")}</h2>
              {paymentProofUrl && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{t("portal.admin.proofSaved")}</span>}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.admin.paymentDate")}</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.admin.paymentProof")}</label>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    ref={paymentProofRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => setPaymentProofFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => paymentProofRef.current?.click()}
                    className="flex items-center gap-2 border border-zinc-200 text-zinc-600 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-zinc-50 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    {paymentProofFile ? paymentProofFile.name : t("portal.admin.choosePhotoOrPdf")}
                  </button>
                  {paymentProofUrl && !paymentProofFile && (
                    <a
                      href={paymentProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-500 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />{t("portal.admin.viewProof")}
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={handleSavePayment}
                disabled={savingPayment}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {savingPayment ? t("portal.common.saving") : t("portal.admin.savePayment")}
              </button>
            </div>
          </div>

          {/* ── Livraison & Bon de livraison ── */}
          <div className="bg-white rounded-xl border border-zinc-200 p-6 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="w-4 h-4 text-orange-500" />
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500">{t("portal.admin.deliveryAndBl")}</h2>
              {blUrl && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{t("portal.admin.blSaved")}</span>}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.admin.deliveryDate")}</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.admin.carrier")}</label>
                  <input
                    type="text"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                    placeholder="Ex: DHL, CTM Messageries…"
                    className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.admin.trackingNumber")}</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Ex: 1Z999AA10123456784"
                  className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wide mb-1.5">{t("portal.admin.blPhoto")}</label>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    ref={blRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => setBlFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => blRef.current?.click()}
                    className="flex items-center gap-2 border border-zinc-200 text-zinc-600 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-zinc-50 transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    {blFile ? blFile.name : t("portal.admin.chooseBlFile")}
                  </button>
                  {blUrl && !blFile && (
                    <a
                      href={blUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-500 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />{t("portal.admin.viewBl")}
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={handleSaveBL}
                disabled={savingBl}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {savingBl ? t("portal.common.saving") : t("portal.admin.saveDelivery")}
              </button>
            </div>
          </div>

          {/* ── Articles demandés ── */}
          {editableItems.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-100 p-6 mb-5">
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-1">{t("portal.admin.requestedItems")} ({editableItems.length})</h2>
              <p className="text-xs text-zinc-400 mb-4">{t("portal.admin.enterUnitPrice")}</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-zinc-100">
                  <th className="text-left pb-2 text-xs text-zinc-500 font-semibold">{t("portal.admin.reference")}</th>
                  <th className="text-left pb-2 text-xs text-zinc-500 font-semibold">{t("portal.admin.description")}</th>
                  <th className="text-right pb-2 text-xs text-zinc-500 font-semibold">{t("portal.common.qty")}</th>
                  <th className="text-right pb-2 text-xs text-zinc-500 font-semibold">{t("portal.admin.unitPrice")}</th>
                  <th className="text-right pb-2 text-xs text-zinc-500 font-semibold">{t("portal.admin.total")}</th>
                </tr></thead>
                <tbody className="divide-y divide-zinc-50">
                  {editableItems.map((item, i) => (
                    <tr key={i}>
                      <td className="py-3 font-mono text-xs text-zinc-700">{item.part_number || "—"}</td>
                      <td className="py-3 text-zinc-700">{item.description || "—"}</td>
                      <td className="py-3 text-right font-bold text-zinc-900">{item.quantity}</td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unit_price ?? ""}
                          onChange={(e) => updateItemPrice(i, e.target.value)}
                          placeholder="0.00"
                          className="w-28 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-sm text-right focus:outline-none focus:border-accent"
                        />
                      </td>
                      <td className="py-3 text-right text-zinc-700 font-semibold">
                        {item.unit_price ? `${(item.unit_price * item.quantity).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} MAD` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {editableItems.some((i) => i.unit_price) && (
                  <tfoot>
                    <tr className="border-t border-zinc-200">
                      <td colSpan={4} className="pt-3 text-sm font-semibold text-zinc-600 text-right">{t("portal.admin.estimatedTotal")}</td>
                      <td className="pt-3 text-right font-black text-zinc-900">
                        {editableItems.reduce((s, i) => s + (i.unit_price ? i.unit_price * i.quantity : 0), 0).toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} MAD
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {order.notes && (
            <div className="bg-zinc-50 rounded-xl border border-zinc-100 p-5">
              <h2 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-2">{t("portal.admin.clientNotes")}</h2>
              <p className="text-sm text-zinc-700 whitespace-pre-line">{order.notes}</p>
            </div>
          )}
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
