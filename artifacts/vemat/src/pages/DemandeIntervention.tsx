import { useState, useRef } from "react";
import { Link } from "wouter";
import {
  CheckCircle2, Loader2, ArrowLeft, Wrench,
  AlertTriangle, AlertOctagon, Minus,
  Paperclip, X, FileText,
} from "lucide-react";
import vematLogo from "@/assets/vemat-logo.png";
import { supabasePublic } from "@/lib/supabase";
import { sendInterventionEmail } from "@/lib/emailService";
import type { InterventionUrgency } from "@/lib/database.types";

function genRef() {
  return `INT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
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

const URGENCY_OPTIONS: {
  value: InterventionUrgency;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  border: string;
  bg: string;
}[] = [
  {
    value: "normale",
    label: "Normale",
    desc: "Intervention à planifier sous quelques jours",
    icon: Minus,
    color: "text-zinc-700",
    border: "border-zinc-400",
    bg: "bg-zinc-100",
  },
  {
    value: "urgente",
    label: "Urgente",
    desc: "Intervention requise dans les 24–48h",
    icon: AlertTriangle,
    color: "text-amber-600",
    border: "border-amber-500",
    bg: "bg-amber-50",
  },
  {
    value: "tres_urgente",
    label: "Très urgente",
    desc: "Arrêt de chantier / sécurité immédiate requise",
    icon: AlertOctagon,
    color: "text-accent",
    border: "border-accent",
    bg: "bg-accent/10",
  },
];

const MAX_FILES = 8;
const MAX_SIZE_MB = 10;

function FilePreviewItem({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = file.type.startsWith("image/");
  const [imgUrl] = useState(() => (isImage ? URL.createObjectURL(file) : null));
  const sizeMB = (file.size / 1024 / 1024).toFixed(1);

  return (
    <div className="relative group">
      {isImage && imgUrl ? (
        <div className="w-20 h-20 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50">
          <img src={imgUrl} alt={file.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-20 h-20 rounded-xl border border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center gap-1 px-1">
          <FileText className="w-7 h-7 text-accent flex-shrink-0" />
          <span className="text-[9px] text-zinc-500 w-full truncate text-center px-1">{file.name}</span>
        </div>
      )}
      <p className="text-[10px] text-zinc-500 text-center mt-1">{sizeMB} Mo</p>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-zinc-300 rounded-full flex items-center justify-center text-zinc-500 hover:text-accent hover:border-accent transition-colors shadow-sm"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function DemandeIntervention() {
  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState("");

  // Contact
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Machine
  const [machineType, setMachineType] = useState("");
  const [machineBrand, setMachineBrand] = useState("");
  const [machineModel, setMachineModel] = useState("");
  const [machineSerial, setMachineSerial] = useState("");
  const [machineYear, setMachineYear] = useState("");

  // Intervention
  const [problemDescription, setProblemDescription] = useState("");
  const [urgency, setUrgency] = useState<InterventionUrgency>("normale");
  const [location, setLocation] = useState("");

  // Attachments
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const valid = selected.filter((f) => {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) return false;
      if (!["image/jpeg", "image/png", "image/jpg", "application/pdf"].includes(f.type)) return false;
      return true;
    });
    setAttachmentFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(idx: number) {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const ref = genRef();

    // Upload attachments to Supabase Storage
    const attachmentUrls: string[] = [];
    for (const file of attachmentFiles) {
      const ext = file.name.split(".").pop() ?? "bin";
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `${ref}/${uniqueName}`;
      const { data: uploadData, error: uploadErr } = await supabasePublic.storage
        .from("intervention-files")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (!uploadErr && uploadData) {
        const { data: urlData } = supabasePublic.storage
          .from("intervention-files")
          .getPublicUrl(uploadData.path);
        attachmentUrls.push(urlData.publicUrl);
      }
    }

    const payload = {
      reference: ref,
      company_name: companyName.trim(),
      contact_name: contactName.trim(),
      contact_phone: contactPhone.trim(),
      contact_email: contactEmail.trim(),
      machine_type: machineType.trim(),
      machine_brand: machineBrand.trim() || null,
      machine_model: machineModel.trim() || null,
      machine_serial: machineSerial.trim() || null,
      machine_year: machineYear.trim() || null,
      problem_description: problemDescription.trim(),
      urgency,
      location: location.trim(),
      attachments: attachmentUrls,
      status: "nouveau",
    };

    const { error: dbError } = await supabasePublic
      .from("form_interventions")
      .insert(payload);

    if (dbError) {
      setError("Une erreur est survenue. Veuillez réessayer ou nous contacter directement.");
      setLoading(false);
      return;
    }

    // Send email notification (non-blocking)
    await sendInterventionEmail({
      reference: payload.reference,
      company_name: payload.company_name,
      contact_name: payload.contact_name,
      contact_phone: payload.contact_phone,
      contact_email: payload.contact_email,
      machine_type: payload.machine_type,
      machine_brand: payload.machine_brand ?? undefined,
      machine_model: payload.machine_model ?? undefined,
      machine_serial: payload.machine_serial ?? undefined,
      problem_description: payload.problem_description,
      urgency: payload.urgency,
      location: payload.location,
      attachments: attachmentUrls,
    });

    setReference(ref);
    setStep("success");
    setLoading(false);
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg text-center">
          <img src={vematLogo} alt="Vemat" className="h-20 md:h-24 mx-auto mb-10" />
          <div className="bg-white border border-zinc-200 rounded-2xl p-10 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-zinc-950 mb-2">Demande enregistrée !</h1>
            <p className="text-zinc-600 text-sm mb-6">
              Votre demande d'intervention a été transmise à notre équipe technique. Nous vous recontactons rapidement pour planifier l'intervention.
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
                onClick={() => {
                  setStep("form");
                  setCompanyName(""); setContactName(""); setContactPhone(""); setContactEmail("");
                  setMachineType(""); setMachineBrand(""); setMachineModel(""); setMachineSerial(""); setMachineYear("");
                  setProblemDescription(""); setUrgency("normale"); setLocation("");
                  setAttachmentFiles([]);
                }}
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

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/">
            <img src={vematLogo} alt="Vemat" className="h-20 md:h-24 mx-auto mb-6 cursor-pointer" />
          </Link>
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-full px-4 py-1.5 mb-4">
            <Wrench className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-bold text-accent uppercase tracking-widest">Demande d'intervention</span>
          </div>
          <h1 className="text-2xl font-black text-zinc-950">Signalez une panne ou un besoin d'entretien</h1>
          <p className="text-zinc-600 text-sm mt-2">Notre équipe SAV vous prend en charge rapidement.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Coordonnées */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-5">01 — Vos coordonnées</h2>
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

          {/* Section 2: Machine */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-5">02 — Identification de la machine</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <InputField label="Type de machine" value={machineType} onChange={setMachineType} placeholder="Grue à tour, Nacelle, Élévateur télescopique…" required />
              </div>
              <InputField label="Marque" value={machineBrand} onChange={setMachineBrand} placeholder="Tadano, JLG, Terex…" />
              <InputField label="Modèle" value={machineModel} onChange={setMachineModel} placeholder="TRT 50, 600AJ…" />
              <InputField label="N° de série" value={machineSerial} onChange={setMachineSerial} placeholder="Numéro de série constructeur" />
              <InputField label="Année de mise en service" value={machineYear} onChange={setMachineYear} placeholder="2019" type="number" />
            </div>
          </div>

          {/* Section 3: Urgence */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-5">
              03 — Niveau d'urgence <span className="text-accent">*</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {URGENCY_OPTIONS.map(({ value, label, desc, icon: Icon, color, border, bg }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setUrgency(value)}
                  className={`relative flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-all ${
                    urgency === value
                      ? `${bg} ${border} ${color} shadow-md`
                      : "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${urgency === value ? color : "text-zinc-500"}`} />
                  <p className={`text-sm font-bold ${urgency === value ? color : "text-zinc-700"}`}>{label}</p>
                  <p className="text-xs text-zinc-500 leading-snug">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Section 4: Description */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-5">04 — Description & localisation</h2>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-zinc-700">
                  Description du problème <span className="text-accent">*</span>
                </label>
                <textarea
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  placeholder="Décrivez la panne, le dysfonctionnement ou les travaux d'entretien à réaliser. Précisez les symptômes, les erreurs affichées, la fréquence du problème…"
                  rows={5}
                  required
                  className="bg-white border border-zinc-300 rounded-xl px-4 py-3 text-zinc-950 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
                />
              </div>
              <InputField
                label="Adresse d'intervention"
                value={location}
                onChange={setLocation}
                placeholder="Rue, ville, région"
                required
              />
            </div>
          </div>

          {/* Section 5: Pièces jointes */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500 mb-1">
              05 — Pièces jointes{" "}
              <span className="text-zinc-400 normal-case font-semibold tracking-normal">(optionnel)</span>
            </h2>
            <p className="text-xs text-zinc-500 mb-5">
              Photos de la panne, rapport de maintenance, bon de livraison… Formats acceptés : JPG, PNG, PDF · Max {MAX_SIZE_MB} Mo par fichier · {MAX_FILES} fichiers maximum
            </p>

            {/* File previews */}
            {attachmentFiles.length > 0 && (
              <div className="flex flex-wrap gap-4 mb-5">
                {attachmentFiles.map((file, idx) => (
                  <FilePreviewItem key={`${file.name}-${idx}`} file={file} onRemove={() => removeFile(idx)} />
                ))}
              </div>
            )}

            {/* Upload button */}
            {attachmentFiles.length < MAX_FILES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 border border-dashed border-zinc-300 hover:border-accent bg-zinc-50 hover:bg-accent/5 text-zinc-600 hover:text-accent text-sm font-semibold px-5 py-3 rounded-xl transition-all"
              >
                <Paperclip className="w-4 h-4" />
                {attachmentFiles.length === 0 ? "Ajouter des fichiers" : `Ajouter d'autres fichiers (${attachmentFiles.length}/${MAX_FILES})`}
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {error && (
            <div className="bg-accent/10 border border-accent/40 rounded-xl px-4 py-3 text-sm text-accent">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-60 text-white font-black text-sm px-6 py-4 rounded-xl transition-colors shadow-md shadow-accent/20"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Envoi en cours…</>
            ) : (
              "Envoyer ma demande d'intervention"
            )}
          </button>

          <p className="text-center text-xs text-zinc-500 pb-4">
            En soumettant ce formulaire, vous acceptez d'être contacté par l'équipe Vemat Group.
          </p>
        </form>
      </div>
    </div>
  );
}
