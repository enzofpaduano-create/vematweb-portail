import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ShoppingCart, Wrench, Clock, AlertTriangle, CalendarDays, ArrowRight, CheckCircle2, UserCheck, Package, Truck, FileText, Inbox } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { AdminGuard } from "./AdminGuard";
import { RepairStatusBadge } from "@/components/espace-client/StatusBadge";
import { supabaseAdmin } from "@/lib/supabase";
import type { DevisRequest, RepairRequest, Company, Technician } from "@/lib/database.types";
import { sendOrderInDeliveryEmail } from "@/lib/clientEmails";
import { useLang } from "@/i18n/I18nProvider";

type RepairWithCompany = RepairRequest & { company?: Company };
type OrderWithCompany = DevisRequest & { company?: Company };

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getPipeline(t: (k: string) => string) {
  return [
    {
      key: "en_traitement" as const,
      label: t("portal.dashboard.pipeline.enTraitement"),
      sublabel: t("portal.dashboard.pipeline.actionRequired"),
      dot: "bg-blue-400",
      badge: "bg-blue-100 text-blue-700",
      colBg: "bg-blue-50/60",
      actionRequired: true,
    },
    {
      key: "devis_envoye" as const,
      label: t("portal.dashboard.pipeline.devisEnvoye"),
      sublabel: t("portal.dashboard.pipeline.devisEnvoyeSub"),
      dot: "bg-violet-400",
      badge: "bg-violet-100 text-violet-700",
      colBg: "",
      actionRequired: false,
    },
    {
      key: "commande_payee" as const,
      label: t("portal.dashboard.pipeline.commandePayee"),
      sublabel: t("portal.dashboard.pipeline.actionRequired"),
      dot: "bg-emerald-400",
      badge: "bg-emerald-100 text-emerald-700",
      colBg: "bg-emerald-50/60",
      actionRequired: true,
    },
    {
      key: "en_livraison" as const,
      label: t("portal.dashboard.pipeline.enLivraison"),
      sublabel: t("portal.dashboard.pipeline.enTransit"),
      dot: "bg-orange-400",
      badge: "bg-orange-100 text-orange-700",
      colBg: "",
      actionRequired: false,
    },
  ];
}

export default function AdminDashboard() {
  const { lang, t } = useLang();
  const PIPELINE = getPipeline(t);
  const [activeOrders, setActiveOrders] = useState<OrderWithCompany[]>([]);
  const [repairs, setRepairs] = useState<RepairWithCompany[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [newDevisCount, setNewDevisCount] = useState(0);
  const [newIntervCount, setNewIntervCount] = useState(0);

  const todayStr = toDateStr(new Date());

  const load = () => {
    Promise.all([
      supabaseAdmin
        .from("devis_requests")
        .select("*, companies(*)")
        .not("status", "in", '("livree","annulee")')
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("repair_requests").select("*, companies(*)").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("technicians").select("*").order("name"),
      supabaseAdmin.from("form_devis").select("id").eq("status", "nouveau"),
      supabaseAdmin.from("form_interventions").select("id").eq("status", "nouveau"),
    ]).then(([o, r, tech, fd, fi]) => {
      setActiveOrders(
        (o.data ?? []).map((x: DevisRequest & { companies?: Company }) => ({ ...x, company: x.companies }))
      );
      setRepairs(
        (r.data ?? []).map((rep: RepairRequest & { companies?: Company }) => ({ ...rep, company: rep.companies }))
      );
      setTechnicians(tech.data ?? []);
      setNewDevisCount((fd.data ?? []).length);
      setNewIntervCount((fi.data ?? []).length);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  // Realtime: update pipeline instantly when orders change
  useEffect(() => {
    const channel = supabaseAdmin
      .channel("dashboard-pipeline")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "devis_requests" }, (payload) => {
        const updated = payload.new as DevisRequest;
        if (["livree", "annulee"].includes(updated.status)) {
          setActiveOrders((prev) => prev.filter((o) => o.id !== updated.id));
        } else {
          setActiveOrders((prev) =>
            prev.map((o) => o.id === updated.id ? { ...o, ...updated } : o)
          );
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "devis_requests" }, async (payload) => {
        const newOrder = payload.new as DevisRequest;
        if (["livree", "annulee"].includes(newOrder.status)) return;
        const { data: company } = await supabaseAdmin.from("companies").select("*").eq("id", newOrder.company_id).single();
        setActiveOrders((prev) => [{ ...newOrder, company: company ?? undefined }, ...prev]);
      })
      .subscribe();
    return () => { supabaseAdmin.removeChannel(channel); };
  }, []);

  const activeRepairs = repairs.filter((r) => !["terminee", "annulee"].includes(r.status));
  const todayRepairs = repairs.filter((r) => r.scheduled_date === todayStr && !["terminee", "annulee"].includes(r.status));
  const urgentRepairs = repairs.filter((r) => r.priority === "urgente" && !["terminee", "annulee"].includes(r.status));
  const reportsToValidate = repairs.filter((r) => r.report_submitted_at && !r.report_locked);
  const actionsRequired = activeOrders.filter((o) => o.status === "en_traitement" || o.status === "commande_payee").length;

  const lockReport = async (repair: RepairWithCompany) => {
    setLocking(repair.id);
    await supabaseAdmin.from("repair_requests").update({ report_locked: true, status: "terminee" }).eq("id", repair.id);
    setRepairs((prev) => prev.map((r) => r.id === repair.id ? { ...r, report_locked: true, status: "terminee" } : r));
    setLocking(null);
  };

  const sendOrder = async (order: OrderWithCompany) => {
    setSending(order.id);
    await supabaseAdmin.from("devis_requests").update({ status: "en_livraison" }).eq("id", order.id);
    await supabaseAdmin.from("status_history").insert({
      entity_type: "devis",
      entity_id: order.id,
      old_status: "commande_payee",
      new_status: "en_livraison",
    });
    // Email automatique au client (cf. lib/clientEmails.ts).
    await sendOrderInDeliveryEmail({
      orderId: order.id,
      reference: order.reference,
      carrier: order.carrier ?? null,
      trackingNumber: order.tracking_number ?? null,
    });
    setActiveOrders((prev) =>
      prev.map((o) => o.id === order.id ? { ...o, status: "en_livraison" as const } : o)
    );
    setSending(null);
  };

  const stats = [
    { icon: Package, label: t("portal.dashboard.actionsRequired"), value: actionsRequired, color: "text-emerald-600 bg-emerald-50", href: "/espace-manager/commandes" },
    { icon: ShoppingCart, label: t("portal.dashboard.activeOrders"), value: activeOrders.length, color: "text-blue-600 bg-blue-50", href: "/espace-manager/commandes" },
    { icon: AlertTriangle, label: t("portal.dashboard.urgentActive"), value: urgentRepairs.length, color: "text-red-600 bg-red-50", href: "/espace-manager/reparations" },
    { icon: Wrench, label: t("portal.dashboard.activeRepairs"), value: activeRepairs.length, color: "text-orange-600 bg-orange-50", href: "/espace-manager/reparations" },
  ];

  const techById = (id: string | null) => id ? technicians.find((tech) => tech.id === id) ?? null : null;

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-black text-zinc-900">{t("portal.dashboard.title")}</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {new Date().toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {stats.map(({ icon: Icon, label, value, color, href }) => (
              <Link key={label} href={href} className="bg-white rounded-xl border border-zinc-100 p-5 hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-black text-zinc-900">{loading ? "—" : value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
              </Link>
            ))}
          </div>

          {/* ── Demandes entrantes ── */}
          <div className="bg-white rounded-xl border border-zinc-100 px-5 py-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-zinc-400" />
                  <h2 className="font-bold text-sm text-zinc-900">{t("portal.dashboard.incomingRequests")}</h2>
                </div>
                <div className="flex items-center gap-5 border-l border-zinc-100 pl-5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-sm text-zinc-600">{t("portal.dashboard.quotes")}</span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                      !loading && newDevisCount > 0 ? "bg-sky-100 text-sky-700" : "bg-zinc-100 text-zinc-400"
                    }`}>
                      {loading ? "·" : newDevisCount}
                    </span>
                    {!loading && newDevisCount > 0 && (
                      <span className="text-[11px] font-semibold text-sky-500">{newDevisCount > 1 ? t("portal.dashboard.newPlural") : t("portal.dashboard.newSingular")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-sm text-zinc-600">{t("portal.dashboard.sav")}</span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                      !loading && newIntervCount > 0 ? "bg-orange-100 text-orange-700" : "bg-zinc-100 text-zinc-400"
                    }`}>
                      {loading ? "·" : newIntervCount}
                    </span>
                    {!loading && newIntervCount > 0 && (
                      <span className="text-[11px] font-semibold text-orange-500">{newIntervCount > 1 ? t("portal.dashboard.newPluralF") : t("portal.dashboard.newSingularF")}</span>
                    )}
                  </div>
                </div>
              </div>
              <Link href="/espace-manager/demandes" className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                {t("portal.dashboard.manageRequests")} <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* ── Pipeline commandes ── */}
          <div className="bg-white rounded-xl border border-zinc-100 mb-6 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-zinc-400" />
                <h2 className="font-bold text-zinc-900 text-sm">{t("portal.dashboard.orderPipeline")}</h2>
              </div>
              <Link href="/espace-manager/commandes" className="flex items-center gap-1 text-xs text-accent font-semibold hover:underline">
                {t("portal.dashboard.allOrders")} <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-4 divide-x divide-zinc-100 min-h-[160px]">
              {PIPELINE.map((stage) => {
                const stageOrders = activeOrders.filter((o) => o.status === stage.key);
                return (
                  <div key={stage.key} className={`flex flex-col ${stage.actionRequired && stageOrders.length > 0 ? stage.colBg : ""}`}>
                    {/* Column header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${stage.dot}`} />
                        <div>
                          <p className="text-xs font-bold text-zinc-800 leading-none">{stage.label}</p>
                          {stage.actionRequired && stageOrders.length > 0 && (
                            <p className="text-[9px] font-semibold text-zinc-400 mt-0.5 uppercase tracking-wide">{stage.sublabel}</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${stageOrders.length > 0 ? stage.badge : "bg-zinc-100 text-zinc-400"}`}>
                        {loading ? "·" : stageOrders.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 p-3 space-y-2">
                      {loading ? (
                        <div className="text-xs text-zinc-300 text-center py-6">{t("portal.common.loading")}</div>
                      ) : stageOrders.length === 0 ? (
                        <div className="text-xs text-zinc-300 text-center py-6">{t("portal.dashboard.none")}</div>
                      ) : (
                        <>
                          {stageOrders.slice(0, 4).map((o) => (
                            <div key={o.id} className="bg-white rounded-lg border border-zinc-200 p-3 shadow-sm hover:shadow transition-shadow">
                              <Link href={`/espace-manager/commandes/${o.id}`}>
                                <p className="text-xs font-black text-zinc-900 hover:text-accent transition-colors">{o.reference}</p>
                                <p className="text-[10px] text-zinc-400 truncate mt-0.5">{o.company?.name ?? "—"}</p>
                                {o.quote_amount ? (
                                  <p className="text-[10px] font-bold text-zinc-600 mt-1">{o.quote_amount.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB")} MAD</p>
                                ) : (
                                  <p className="text-[10px] text-zinc-300 mt-1 italic">{t("portal.dashboard.noAmount")}</p>
                                )}
                              </Link>

                              {stage.key === "en_traitement" && (
                                <Link
                                  href={`/espace-manager/commandes/${o.id}`}
                                  className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded-md transition-colors"
                                >
                                  <FileText className="w-3 h-3" />
                                  {t("portal.dashboard.prepareQuote")}
                                </Link>
                              )}

                              {stage.key === "commande_payee" && (
                                <button
                                  onClick={() => sendOrder(o)}
                                  disabled={sending === o.id}
                                  className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-700 px-2 py-1.5 rounded-md transition-colors disabled:opacity-50"
                                >
                                  <Truck className="w-3 h-3" />
                                  {sending === o.id ? t("portal.dashboard.inProgress") : t("portal.dashboard.markShipping")}
                                </button>
                              )}
                            </div>
                          ))}
                          {stageOrders.length > 4 && (
                            <Link
                              href="/espace-manager/commandes"
                              className="block text-center text-[10px] text-zinc-400 hover:text-zinc-600 font-semibold py-1"
                            >
                              +{stageOrders.length - 4} {t("portal.dashboard.more")} →
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Aujourd'hui ── */}
          <div className="bg-white rounded-xl border border-zinc-100 mb-6 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-accent" />
                <h2 className="font-bold text-zinc-900 text-sm">{t("portal.dashboard.todayInterventions")}</h2>
                {!loading && todayRepairs.length > 0 && (
                  <span className="text-xs font-bold bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                    {todayRepairs.length}
                  </span>
                )}
              </div>
              <Link href="/espace-manager/calendrier" className="flex items-center gap-1 text-xs text-accent font-semibold hover:underline">
                {t("portal.dashboard.seeCalendar")} <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {loading ? (
              <div className="px-5 py-8 text-center text-sm text-zinc-400">{t("portal.common.loading")}</div>
            ) : todayRepairs.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-zinc-400">{t("portal.dashboard.noInterventionToday")}</div>
            ) : (
              <div className="divide-y divide-zinc-50">
                {todayRepairs.map((r) => {
                  const tech = techById(r.technician_id ?? null);
                  return (
                    <Link key={r.id} href={`/espace-manager/reparations/${r.id}`}
                      className="flex items-center gap-5 px-5 py-4 hover:bg-zinc-50 transition-colors">
                      {tech ? (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
                          style={{ backgroundColor: tech.color }}>
                          {tech.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
                          <span className="text-xs text-zinc-400">?</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-900">{r.reference}</span>
                          {r.priority === "urgente" && (
                            <span className="flex items-center gap-0.5 text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full uppercase">
                              <AlertTriangle className="w-2.5 h-2.5" />{t("portal.dashboard.urgent")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 truncate">
                          {r.company?.name ?? "—"} · {r.equipment_type}
                          {tech ? ` · ${tech.name}` : ` · ${t("portal.dashboard.unassigned")}`}
                        </p>
                      </div>
                      <RepairStatusBadge status={r.status} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Rapports à valider ── */}
          {(loading || reportsToValidate.length > 0) && (
            <div className="bg-white rounded-xl border border-zinc-100 mb-6 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
                <CheckCircle2 className="w-4 h-4 text-amber-500" />
                <h2 className="font-bold text-zinc-900 text-sm">{t("portal.dashboard.reportsToValidate")}</h2>
                {!loading && reportsToValidate.length > 0 && (
                  <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {reportsToValidate.length}
                  </span>
                )}
              </div>
              {loading ? (
                <div className="px-5 py-6 text-center text-sm text-zinc-400">{t("portal.common.loading")}</div>
              ) : (
                <div className="divide-y divide-zinc-50">
                  {reportsToValidate.map((r) => {
                    const tech = techById(r.technician_id ?? null);
                    return (
                      <div key={r.id} className="flex items-center gap-5 px-5 py-4">
                        {tech ? (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
                            style={{ backgroundColor: tech.color }}>
                            {tech.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
                            <span className="text-xs text-zinc-400">?</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Link href={`/espace-manager/reparations/${r.id}`}
                              className="text-sm font-bold text-zinc-900 hover:text-accent transition-colors">
                              {r.reference}
                            </Link>
                            {r.priority === "urgente" && (
                              <span className="flex items-center gap-0.5 text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full uppercase">
                                <AlertTriangle className="w-2.5 h-2.5" />{t("portal.dashboard.urgent")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 truncate">
                            {r.company?.name ?? "—"} · {r.equipment_type}
                            {tech ? ` · ${tech.name}` : ""}
                          </p>
                          {r.report_submitted_at && (
                            <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {t("portal.dashboard.submittedOn")} {new Date(r.report_submitted_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/espace-manager/reparations/${r.id}`}
                            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors">
                            {t("portal.dashboard.seeReport")}
                          </Link>
                          <button
                            onClick={() => lockReport(r)}
                            disabled={locking === r.id}
                            className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 border border-emerald-200"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            {locking === r.id ? t("portal.dashboard.inProgress") : t("portal.dashboard.closeMission")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Réparations récentes ── */}
          <div className="bg-white rounded-xl border border-zinc-100">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h2 className="font-bold text-zinc-900 text-sm">{t("portal.dashboard.recentRepairs")}</h2>
              <Link href="/espace-manager/reparations" className="text-xs text-accent font-semibold hover:underline">{t("portal.dashboard.manage")} →</Link>
            </div>
            <div className="divide-y divide-zinc-50">
              {loading ? (
                <div className="px-5 py-8 text-center text-sm text-zinc-400">{t("portal.common.loading")}</div>
              ) : activeRepairs.slice(0, 6).map((r) => {
                const tech = techById(r.technician_id ?? null);
                return (
                  <Link key={r.id} href={`/espace-manager/reparations/${r.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-900">{r.reference}</p>
                        {r.priority === "urgente" && (
                          <span className="text-[9px] font-black uppercase bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{t("portal.dashboard.urgent")}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span>{r.equipment_type}</span>
                        {tech && (
                          <><span>·</span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: tech.color }} />
                            {tech.name.split(" ")[0]}
                          </span></>
                        )}
                      </div>
                    </div>
                    <RepairStatusBadge status={r.status} />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
