import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, MapPin, Phone, Wrench, AlertTriangle, CheckCircle2,
  PlayCircle, Plus, Trash2, ChevronRight, FileText, Clock, Package,
  Camera, ImageIcon, X,
} from "lucide-react";
import { TechnicienLayout } from "./TechnicienLayout";
import { useTechnicienAuth } from "@/contexts/TechnicienAuthContext";
import { supabaseTech } from "@/lib/supabase";
import type { RepairRequest, Company, Chantier, RepairStatus } from "@/lib/database.types";
import { sendRepairInProgressEmail, sendRepairCompletedEmail } from "@/lib/clientEmails";

interface ChecklistItem { id: string; label: string; done: boolean; }
interface Attachment { name: string; url: string; type: string; }
interface ReportPart { id: string; reference: string; description: string; quantity: number; }

type Mission = RepairRequest & { company?: Company; chantier?: Chantier };

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: "En attente",  color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  planifiee:  { label: "Planifiée",   color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30" },
  en_cours:   { label: "En cours",    color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  terminee:   { label: "Terminée",    color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/30" },
  annulee:    { label: "Annulée",     color: "text-zinc-500",   bg: "bg-zinc-800 border-zinc-700" },
};

const emptyPart = (): ReportPart => ({
  id: crypto.randomUUID(), reference: "", description: "", quantity: 1,
});

export default function TechnicienMission() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { technician } = useTechnicienAuth();
  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [managerParts, setManagerParts] = useState<ReportPart[]>([]);
  const [techPhotos, setTechPhotos] = useState<Attachment[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [reportPhotos, setReportPhotos] = useState<Attachment[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const reportPhotoInputRef = useRef<HTMLInputElement>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportParts, setReportParts] = useState<ReportPart[]>([emptyPart()]);
  const [reportHours, setReportHours] = useState("");
  const [reportWorkDone, setReportWorkDone] = useState("");
  const [reportObservations, setReportObservations] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data } = await supabaseTech
      .from("repair_requests")
      .select("*, companies(*), chantiers(*)")
      .eq("id", id)
      .single();
    if (data) {
      const m = { ...data, company: data.companies, chantier: data.chantiers };
      setMission(m);
      setChecklist((data.manager_checklist as ChecklistItem[]) ?? []);
      setAttachments((data.attachments as Attachment[]) ?? []);
      setManagerParts((data.manager_parts as ReportPart[]) ?? []);
      setTechPhotos((data.tech_photos as Attachment[]) ?? []);
      const parts = data.report_parts as ReportPart[];
      setReportParts(parts?.length ? parts : [emptyPart()]);
      setReportHours(data.report_hours?.toString() ?? "");
      setReportWorkDone(data.report_work_done ?? "");
      setReportObservations(data.report_observations ?? "");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const updateStatus = async (newStatus: RepairStatus) => {
    if (!mission) return;
    setSaving(true);
    await supabaseTech.from("repair_requests").update({ status: newStatus }).eq("id", mission.id);
    if (newStatus === "en_cours") {
      await sendRepairInProgressEmail({ repairId: mission.id, reference: mission.reference });
    }
    setSaving(false);
    setMission((m) => m ? { ...m, status: newStatus } : m);
  };

  const toggleChecklistItem = async (itemId: string) => {
    if (!mission) return;
    const updated = checklist.map((i) => i.id === itemId ? { ...i, done: !i.done } : i);
    setChecklist(updated);
    await supabaseTech.from("repair_requests").update({ manager_checklist: updated }).eq("id", mission.id);
  };

  const submitReport = async () => {
    if (!mission || !reportWorkDone.trim()) return;
    setSubmitting(true);
    const alreadyDone = mission.status === "terminee";
    const mergedPhotos = [...techPhotos, ...reportPhotos];
    await supabaseTech.from("repair_requests").update({
      ...(alreadyDone ? {} : { status: "terminee", completed_date: new Date().toISOString().split("T")[0] }),
      report_parts: reportParts.filter((p) => p.description.trim()),
      report_hours: reportHours ? parseFloat(reportHours) : null,
      report_work_done: reportWorkDone.trim(),
      report_observations: reportObservations.trim() || null,
      report_submitted_at: new Date().toISOString(),
      ...(reportPhotos.length > 0 ? { tech_photos: mergedPhotos } : {}),
    }).eq("id", mission.id);
    if (!alreadyDone) {
      const { data: { session } } = await supabaseTech.auth.getSession();
      if (session?.user) {
        await supabaseTech.from("notifications").insert({
          user_id: session.user.id,
          title: `Mission terminée : ${mission.reference}`,
          message: `${technician?.name ?? "Technicien"} a soumis le rapport — ${mission.company?.name ?? "—"} · ${mission.equipment_type}`,
          read: false,
          type: "mission_complete",
          link: `/espace-manager/reparations/${mission.id}`,
        });
      }
      await sendRepairCompletedEmail({ repairId: mission.id, reference: mission.reference });
    }
    if (reportPhotos.length > 0) setTechPhotos(mergedPhotos);
    setReportPhotos([]);
    setSubmitting(false);
    setShowReport(false);
    await load();
  };

  const addPart = () => setReportParts((p) => [...p, emptyPart()]);
  const removePart = (pid: string) => setReportParts((p) => p.filter((x) => x.id !== pid));
  const updatePart = (pid: string, field: keyof ReportPart, value: string | number) =>
    setReportParts((p) => p.map((x) => x.id === pid ? { ...x, [field]: value } : x));

  const uploadPhotos = async (fileList: FileList | null, target: "field" | "report") => {
    if (!fileList || !mission) return;
    setUploadingPhoto(true);
    const uploaded: Attachment[] = [];
    for (const file of Array.from(fileList)) {
      const path = `${mission.id}/tech/${Date.now()}_${file.name}`;
      const { error } = await supabaseTech.storage.from("repair-photos").upload(path, file);
      if (!error) {
        const { data } = supabaseTech.storage.from("repair-photos").getPublicUrl(path);
        uploaded.push({ name: file.name, url: data.publicUrl, type: file.type });
      }
    }
    if (target === "field") {
      const updated = [...techPhotos, ...uploaded];
      setTechPhotos(updated);
      await supabaseTech.from("repair_requests").update({ tech_photos: updated }).eq("id", mission.id);
    } else {
      setReportPhotos((prev) => [...prev, ...uploaded]);
    }
    setUploadingPhoto(false);
  };

  if (loading) return <TechnicienLayout><div className="text-zinc-600 text-center py-24">Chargement...</div></TechnicienLayout>;
  if (!mission) return <TechnicienLayout><div className="text-zinc-600 text-center py-24">Mission introuvable.</div></TechnicienLayout>;

  const st = STATUS_CONFIG[mission.status] ?? STATUS_CONFIG.en_attente;
  const isActive = !["terminee", "annulee"].includes(mission.status);
  const isDone = mission.status === "terminee";
  const doneCount = checklist.filter((i) => i.done).length;
  const reportParts_ = mission.report_parts as ReportPart[] | null;
  const hasReport = !!mission.report_submitted_at;
  const isLocked = !!mission.report_locked;

  const openEditReport = () => {
    // Pre-fill modal with existing report data
    const existing = reportParts_ ?? [];
    setReportParts(existing.length ? existing.map((p) => ({ ...p })) : [emptyPart()]);
    setReportHours(mission.report_hours?.toString() ?? "");
    setReportWorkDone(mission.report_work_done ?? "");
    setReportObservations(mission.report_observations ?? "");
    setShowReport(true);
  };

  return (
    <TechnicienLayout>
      <div className="p-8 max-w-3xl">
        {/* Back */}
        <button onClick={() => navigate("/espace-technicien/missions")}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-200 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-black text-white">{mission.reference}</h1>
              {mission.priority === "urgente" && (
                <span className="flex items-center gap-1 text-xs font-black bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full border border-red-500/30">
                  <AlertTriangle className="w-3 h-3" />URGENT
                </span>
              )}
            </div>
            <p className="text-zinc-500 text-sm">
              {mission.company?.name ?? "—"} ·{" "}
              {mission.scheduled_date
                ? new Date(mission.scheduled_date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
                : "Non planifiée"}
            </p>
          </div>
          <span className={`text-sm font-bold px-3 py-1.5 rounded-full border ${st.bg} ${st.color}`}>{st.label}</span>
        </div>

        {/* Actions */}
        {(mission.status === "planifiee" || mission.status === "en_attente") && (
          <button onClick={() => updateStatus("en_cours")} disabled={saving}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-black px-6 py-3 rounded-xl mb-5 transition-colors disabled:opacity-60">
            <PlayCircle className="w-5 h-5" /> Démarrer l'intervention
          </button>
        )}
        {mission.status === "en_cours" && (
          <button onClick={() => setShowReport(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-black px-6 py-3 rounded-xl mb-5 transition-colors">
            <FileText className="w-5 h-5" /> Soumettre le rapport de fin
          </button>
        )}
        {isDone && (
          <div className={`flex items-center gap-3 rounded-xl px-5 py-4 mb-5 border ${isLocked ? "bg-zinc-800/60 border-zinc-700" : "bg-emerald-500/10 border-emerald-500/30"}`}>
            <CheckCircle2 className={`w-5 h-5 shrink-0 ${isLocked ? "text-zinc-500" : "text-emerald-400"}`} />
            <div className="flex-1">
              <p className={`text-sm font-bold ${isLocked ? "text-zinc-400" : "text-emerald-400"}`}>
                {isLocked ? "Mission clôturée par le manager" : "Intervention terminée"}
              </p>
              {mission.completed_date && (
                <p className="text-xs text-zinc-500">Le {new Date(mission.completed_date + "T00:00:00").toLocaleDateString("fr-FR")}</p>
              )}
            </div>
            {hasReport && !isLocked && (
              <button onClick={openEditReport}
                className="flex items-center gap-1.5 text-xs font-bold text-orange-400 hover:text-orange-300 border border-orange-500/30 hover:border-orange-400/50 px-3 py-1.5 rounded-lg transition-colors shrink-0">
                <FileText className="w-3.5 h-3.5" /> Modifier le rapport
              </button>
            )}
          </div>
        )}

        {/* Checklist */}
        {checklist.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-black text-white">Checklist préparation</h2>
              </div>
              <span className="text-xs text-zinc-500">{doneCount}/{checklist.length} complétés</span>
            </div>
            <div className="divide-y divide-zinc-800">
              {checklist.map((item) => (
                <button key={item.id} type="button"
                  onClick={() => isActive && toggleChecklistItem(item.id)}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${isActive ? "hover:bg-zinc-800/50 cursor-pointer" : "cursor-default"}`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${item.done ? "bg-emerald-500 border-emerald-500" : "border-zinc-600"}`}>
                    {item.done && (
                      <svg viewBox="0 0 12 9" className="w-3 h-2.5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1,4 4,8 11,1" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm ${item.done ? "text-zinc-500 line-through" : "text-zinc-200"}`}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Manager parts */}
        {managerParts.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-black text-white">Pièces à prendre</h2>
              </div>
              <span className="text-xs text-zinc-500">{managerParts.length} pièce{managerParts.length > 1 ? "s" : ""}</span>
            </div>
            <div className="divide-y divide-zinc-800">
              {managerParts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{p.description || p.reference}</p>
                    {p.description && p.reference && (
                      <p className="text-[10px] font-mono text-zinc-600 mt-0.5">{p.reference}</p>
                    )}
                  </div>
                  <span className="text-xs font-bold text-zinc-500 shrink-0">×{p.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tech photos upload */}
        {!isLocked && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-black text-white">Photos de réparation</h2>
              </div>
              <div className="flex items-center gap-2">
                {uploadingPhoto && <span className="text-xs text-zinc-500 animate-pulse">Upload...</span>}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="flex items-center gap-1.5 text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter
                </button>
                <input ref={photoInputRef} type="file" multiple accept="image/*" className="hidden"
                  onChange={(e) => uploadPhotos(e.target.files, "field")} />
              </div>
            </div>
            {techPhotos.length > 0 ? (
              <div className="p-4 grid grid-cols-3 gap-3">
                {techPhotos.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
                    className="aspect-square rounded-xl overflow-hidden border border-zinc-700 hover:border-orange-500/50 transition-colors">
                    <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            ) : (
              <button type="button" onClick={() => photoInputRef.current?.click()}
                className="w-full p-6 flex flex-col items-center gap-2 text-zinc-700 hover:text-zinc-500 transition-colors">
                <ImageIcon className="w-8 h-8" />
                <span className="text-xs font-semibold">Aucune photo · Cliquer pour ajouter</span>
              </button>
            )}
          </div>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-4">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-black text-white">Documents client</h2>
              <span className="ml-auto text-xs text-zinc-500">{attachments.length} fichier{attachments.length > 1 ? "s" : ""}</span>
            </div>
            <div className="divide-y divide-zinc-800">
              {attachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-800/50 transition-colors">
                  <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-400" />
                  </div>
                  <span className="text-sm text-zinc-200 flex-1 truncate">{a.name}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Location */}
        {mission.chantier ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-black text-white">Localisation</h2>
            </div>
            <p className="text-sm font-bold text-zinc-200">{mission.chantier.name}</p>
            {(mission.chantier.address || mission.chantier.city) && (
              <p className="text-xs text-zinc-500 mt-1">{[mission.chantier.address, mission.chantier.city].filter(Boolean).join(", ")}</p>
            )}
            {mission.chantier.gps_lat && mission.chantier.gps_lng && (
              <a href={`https://maps.google.com/?q=${mission.chantier.gps_lat},${mission.chantier.gps_lng}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors">
                <MapPin className="w-3 h-3" /> Ouvrir dans Google Maps
              </a>
            )}
            {mission.chantier.contact_name && (
              <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-zinc-600" />
                <span className="text-xs text-zinc-400">{mission.chantier.contact_name}</span>
                {mission.chantier.contact_phone && (
                  <a href={`tel:${mission.chantier.contact_phone}`} className="text-xs font-bold text-orange-400 hover:text-orange-300 ml-1">
                    {mission.chantier.contact_phone}
                  </a>
                )}
              </div>
            )}
          </div>
        ) : mission.company?.phone ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-black text-white">Contact client</h2>
            </div>
            <p className="text-sm text-zinc-200">{mission.company.name}</p>
            <a href={`tel:${mission.company.phone}`} className="text-xs font-bold text-orange-400 mt-1 block">{mission.company.phone}</a>
          </div>
        ) : null}

        {/* Equipment + Problem */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-3.5 h-3.5 text-zinc-600" />
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">Équipement</h2>
            </div>
            <p className="font-bold text-white">{mission.equipment_type}</p>
            {mission.equipment_brand && <p className="text-sm text-zinc-400 mt-1">{mission.equipment_brand} {mission.equipment_model}</p>}
            {mission.equipment_serial && <p className="text-xs text-zinc-600 font-mono mt-1">S/N: {mission.equipment_serial}</p>}
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">Problème signalé</h2>
            <p className="text-sm text-zinc-300 leading-relaxed">{mission.description}</p>
          </div>
        </div>

        {/* Report summary (if done) */}
        {isDone && hasReport && (
          <div className={`bg-zinc-900 rounded-xl overflow-hidden border ${isLocked ? "border-zinc-700" : "border-emerald-500/20"}`}>
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
              <FileText className={`w-4 h-4 ${isLocked ? "text-zinc-500" : "text-emerald-400"}`} />
              <h2 className="text-sm font-black text-white">Rapport d'intervention</h2>
              {isLocked && (
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">Clôturé</span>
              )}
              <span className="ml-auto text-xs text-zinc-500">
                {new Date(mission.report_submitted_at!).toLocaleDateString("fr-FR")}
              </span>
              {!isLocked && (
                <button onClick={openEditReport}
                  className="flex items-center gap-1 text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors">
                  Modifier →
                </button>
              )}
            </div>
            <div className="p-5 space-y-4">
              {mission.report_hours && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm text-zinc-400">Durée :</span>
                  <span className="text-sm font-bold text-white">{mission.report_hours}h</span>
                </div>
              )}
              {mission.report_work_done && (
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Travaux effectués</p>
                  <p className="text-sm text-zinc-300">{mission.report_work_done}</p>
                </div>
              )}
              {reportParts_?.filter((p) => p.description).length ? (
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Pièces utilisées</p>
                  <div className="space-y-1.5">
                    {reportParts_.filter((p) => p.description).map((p, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="text-zinc-600 font-mono text-xs w-20 shrink-0">{p.reference || "—"}</span>
                        <span className="text-zinc-300 flex-1">{p.description}</span>
                        <span className="text-zinc-500 shrink-0">×{p.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {mission.report_observations && (
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Observations</p>
                  <p className="text-sm text-zinc-400">{mission.report_observations}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Report Modal ── */}
      {showReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl my-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800">
              <div>
                <h2 className="font-black text-white text-lg">{hasReport ? "Modifier le rapport" : "Rapport d'intervention"}</h2>
                <p className="text-zinc-500 text-sm">{mission.reference} · {mission.company?.name}</p>
              </div>
              <button onClick={() => setShowReport(false)} className="text-zinc-500 hover:text-zinc-300 text-2xl leading-none transition-colors">×</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Hours */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">
                  <Clock className="w-3.5 h-3.5" /> Heures travaillées *
                </label>
                <input type="number" step="0.5" min="0" max="24"
                  value={reportHours} onChange={(e) => setReportHours(e.target.value)}
                  placeholder="ex: 3.5"
                  className="w-32 bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500" />
              </div>

              {/* Work done */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">Travaux effectués *</label>
                <textarea value={reportWorkDone} onChange={(e) => setReportWorkDone(e.target.value)}
                  placeholder="Décrivez les travaux réalisés..."
                  rows={4}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 resize-none placeholder:text-zinc-600" />
              </div>

              {/* Parts */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-zinc-400">
                    <Package className="w-3.5 h-3.5" /> Pièces de rechange utilisées
                  </label>
                  <div className="flex items-center gap-3">
                    {managerParts.length > 0 && reportParts.every((p) => !p.description && !p.reference) && (
                      <button type="button"
                        onClick={() => setReportParts(managerParts.map((p) => ({ ...p, id: crypto.randomUUID() })))}
                        className="flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-orange-400 transition-colors border border-zinc-700 rounded-lg px-2.5 py-1 hover:border-orange-500/40">
                        ↩ Pré-remplir depuis les pièces prévues
                      </button>
                    )}
                    <button type="button" onClick={addPart}
                      className="flex items-center gap-1.5 text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-[110px_1fr_56px_28px] gap-2 text-[10px] font-black uppercase text-zinc-600 px-1">
                    <span>Référence</span><span>Désignation</span><span className="text-center">Qté</span><span></span>
                  </div>
                  {reportParts.map((part) => (
                    <div key={part.id} className="grid grid-cols-[110px_1fr_56px_28px] gap-2 items-center">
                      <input value={part.reference} onChange={(e) => updatePart(part.id, "reference", e.target.value)}
                        placeholder="REF-001"
                        className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 placeholder:text-zinc-600" />
                      <input value={part.description} onChange={(e) => updatePart(part.id, "description", e.target.value)}
                        placeholder="Filtre à huile..."
                        className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 placeholder:text-zinc-600" />
                      <input type="number" min="1" value={part.quantity}
                        onChange={(e) => updatePart(part.id, "quantity", parseInt(e.target.value) || 1)}
                        className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-orange-500 text-center" />
                      <button type="button" onClick={() => removePart(part.id)}
                        className="text-zinc-600 hover:text-red-400 transition-colors flex items-center justify-center">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observations */}
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">
                  Observations & recommandations
                </label>
                <textarea value={reportObservations} onChange={(e) => setReportObservations(e.target.value)}
                  placeholder="Anomalies constatées, suivi recommandé..."
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 resize-none placeholder:text-zinc-600" />
              </div>

              {/* Report photos */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-zinc-400">
                    <Camera className="w-3.5 h-3.5" /> Photos du rapport
                  </label>
                  <button type="button" onClick={() => reportPhotoInputRef.current?.click()} disabled={uploadingPhoto}
                    className="flex items-center gap-1.5 text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50">
                    <Plus className="w-3.5 h-3.5" /> Ajouter
                  </button>
                  <input ref={reportPhotoInputRef} type="file" multiple accept="image/*" className="hidden"
                    onChange={(e) => uploadPhotos(e.target.files, "report")} />
                </div>
                {reportPhotos.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {reportPhotos.map((p, i) => (
                      <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-zinc-700">
                        <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setReportPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center hidden group-hover:flex">
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button type="button" onClick={() => reportPhotoInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-zinc-700 rounded-xl p-4 flex items-center justify-center gap-2 text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 transition-colors text-xs font-semibold">
                    <Camera className="w-4 h-4" /> Joindre des photos à ce rapport
                  </button>
                )}
              </div>

              {/* Technician signature line */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black shrink-0"
                  style={{ backgroundColor: technician?.color ?? "#f97316" }}>
                  {technician?.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{technician?.name}</p>
                  <p className="text-xs text-zinc-500">Technicien · {new Date().toLocaleDateString("fr-FR")}</p>
                </div>
              </div>

              {!reportWorkDone.trim() && (
                <p className="text-xs text-red-400">Les champs marqués * sont obligatoires</p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowReport(false)}
                  className="flex-1 border border-zinc-700 text-zinc-400 font-bold py-3 rounded-xl hover:bg-zinc-800 transition-colors">
                  Annuler
                </button>
                <button type="button" onClick={submitReport}
                  disabled={submitting || !reportWorkDone.trim() || !reportHours}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-black py-3 rounded-xl transition-colors disabled:opacity-50">
                  <CheckCircle2 className="w-5 h-5" />
                  {submitting ? "Enregistrement..." : hasReport ? "Enregistrer les modifications" : "Soumettre et terminer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TechnicienLayout>
  );
}
