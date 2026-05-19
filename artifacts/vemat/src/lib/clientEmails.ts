/**
 * Pipeline d'emails automatiques envoyés au CLIENT lors des changements de statut
 * (commande, réparation). Contrairement à `emailService.ts` qui notifie l'équipe
 * Vemat à chaque nouvelle demande, ce module sert à informer le client du suivi
 * de SA demande après soumission.
 *
 * ⚠️ ÉTAT ACTUEL : pipeline scaffoldée. L'envoi réel passe pour l'instant par
 *   `submitToWeb3Forms` qui n'envoie qu'à l'adresse Vemat liée à la clé. Le
 *   sujet est préfixé `[À FAIRE SUIVRE → {client_email}]` pour qu'on puisse
 *   transférer manuellement en attendant. Pour un envoi automatique au client,
 *   il faudra brancher un vrai service (Resend / SendGrid / Mailgun) :
 *   remplacer `submitToWeb3Forms` par un appel `resend.emails.send({ to: ... })`
 *   à un seul endroit (fonction `dispatch` ci-dessous) — toutes les call-sites
 *   sont déjà correctes et n'auront pas besoin d'être modifiées.
 *
 * Pour ajouter un nouveau type d'email : créer une fonction `sendXxx` qui
 * construit subject+body et appelle `dispatch`.
 */

import { supabaseAdmin } from "./supabase";

const WEB3FORMS_KEY = import.meta.env.VITE_WEB3FORMS_KEY as string | undefined;

// ─── Dispatch (point d'entrée unique pour swap futur Resend/SendGrid) ────────
async function dispatch(params: {
  to: string;          // email client destinataire (futur)
  toName?: string;     // nom client (futur)
  subject: string;
  body: string;
}) {
  if (!WEB3FORMS_KEY) return;
  // TODO: remplacer par un vrai service email (Resend, SendGrid…) qui envoie à `params.to`.
  // Pour l'instant : envoi à Vemat avec préfixe pour transfert manuel.
  const subjectPrefixed = `[À FAIRE SUIVRE → ${params.to}] ${params.subject}`;
  try {
    await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: subjectPrefixed,
        message: `Destinataire prévu : ${params.toName ?? ""} <${params.to}>\n\n${params.body}`,
        from_name: "Vemat — Suivi client (auto)",
        botcheck: "",
      }),
    });
  } catch {
    // Fail silently — le changement de statut en BDD reste source de vérité.
  }
}

// ─── Helpers : récupération du contact client depuis l'ID commande / répa ───
//
// Les tables `devis_requests` / `repair_requests` ne stockent pas le contact
// directement — il faut remonter au formulaire d'origine via `converted_to_*`.
async function getOrderClient(orderId: string): Promise<{ email: string; name: string } | null> {
  const { data } = await supabaseAdmin
    .from("form_devis")
    .select("contact_email, contact_name")
    .eq("converted_to_order_id", orderId)
    .maybeSingle();
  if (!data?.contact_email) return null;
  return { email: data.contact_email, name: data.contact_name ?? "" };
}

async function getRepairClient(repairId: string): Promise<{ email: string; name: string } | null> {
  const { data } = await supabaseAdmin
    .from("form_interventions")
    .select("contact_email, contact_name")
    .eq("converted_to_repair_id", repairId)
    .maybeSingle();
  if (!data?.contact_email) return null;
  return { email: data.contact_email, name: data.contact_name ?? "" };
}

// ─── Templates COMMANDES ─────────────────────────────────────────────────────
// TODO: l'utilisateur affinera les wordings. Garder signature stable.

export async function sendOrderQuoteSentEmail(params: {
  orderId: string;
  reference: string;
  amount?: number | null;
}) {
  const client = await getOrderClient(params.orderId);
  if (!client) return;
  const amountStr = params.amount ? `${params.amount.toLocaleString("fr-FR")} MAD` : "—";
  await dispatch({
    to: client.email,
    toName: client.name,
    subject: `Votre devis ${params.reference} est disponible`,
    body: `Bonjour ${client.name},\n\nVotre devis ${params.reference} d'un montant de ${amountStr} vient d'être préparé par notre équipe. Vous le recevrez par retour de mail.\n\nL'équipe Vemat Group`,
  });
}

export async function sendOrderPaidEmail(params: {
  orderId: string;
  reference: string;
}) {
  const client = await getOrderClient(params.orderId);
  if (!client) return;
  await dispatch({
    to: client.email,
    toName: client.name,
    subject: `Paiement reçu — commande ${params.reference}`,
    body: `Bonjour ${client.name},\n\nNous confirmons la réception de votre paiement pour la commande ${params.reference}. Votre commande est en cours de préparation.\n\nL'équipe Vemat Group`,
  });
}

export async function sendOrderInDeliveryEmail(params: {
  orderId: string;
  reference: string;
  carrier?: string | null;
  trackingNumber?: string | null;
}) {
  const client = await getOrderClient(params.orderId);
  if (!client) return;
  const tracking = [params.carrier, params.trackingNumber].filter(Boolean).join(" — ");
  await dispatch({
    to: client.email,
    toName: client.name,
    subject: `Commande ${params.reference} en livraison`,
    body: `Bonjour ${client.name},\n\nVotre commande ${params.reference} est en cours d'acheminement.${tracking ? `\nTransporteur : ${tracking}` : ""}\n\nL'équipe Vemat Group`,
  });
}

export async function sendOrderDeliveredEmail(params: {
  orderId: string;
  reference: string;
}) {
  const client = await getOrderClient(params.orderId);
  if (!client) return;
  await dispatch({
    to: client.email,
    toName: client.name,
    subject: `Commande ${params.reference} livrée`,
    body: `Bonjour ${client.name},\n\nVotre commande ${params.reference} a été livrée. N'hésitez pas à nous contacter pour toute question.\n\nL'équipe Vemat Group`,
  });
}

export async function sendOrderCancelledEmail(params: {
  orderId: string;
  reference: string;
  reason?: string;
}) {
  const client = await getOrderClient(params.orderId);
  if (!client) return;
  await dispatch({
    to: client.email,
    toName: client.name,
    subject: `Commande ${params.reference} annulée`,
    body: `Bonjour ${client.name},\n\nVotre commande ${params.reference} a été annulée.${params.reason ? `\nMotif : ${params.reason}` : ""}\n\nL'équipe Vemat Group`,
  });
}

// ─── Templates RÉPARATIONS ───────────────────────────────────────────────────
// TODO: à brancher dans les écrans technicien / admin réparations le moment venu.

export async function sendRepairScheduledEmail(params: {
  repairId: string;
  reference: string;
  scheduledDate?: string | null;
  technicianName?: string | null;
}) {
  const client = await getRepairClient(params.repairId);
  if (!client) return;
  await dispatch({
    to: client.email,
    toName: client.name,
    subject: `Intervention ${params.reference} planifiée`,
    body: `Bonjour ${client.name},\n\nVotre demande d'intervention ${params.reference} a été planifiée${params.scheduledDate ? ` au ${params.scheduledDate}` : ""}${params.technicianName ? ` (technicien : ${params.technicianName})` : ""}.\n\nL'équipe Vemat Group`,
  });
}

export async function sendRepairInProgressEmail(params: {
  repairId: string;
  reference: string;
}) {
  const client = await getRepairClient(params.repairId);
  if (!client) return;
  await dispatch({
    to: client.email,
    toName: client.name,
    subject: `Intervention ${params.reference} en cours`,
    body: `Bonjour ${client.name},\n\nNotre technicien est intervenu sur votre demande ${params.reference}. L'intervention est en cours.\n\nL'équipe Vemat Group`,
  });
}

export async function sendRepairCompletedEmail(params: {
  repairId: string;
  reference: string;
}) {
  const client = await getRepairClient(params.repairId);
  if (!client) return;
  await dispatch({
    to: client.email,
    toName: client.name,
    subject: `Intervention ${params.reference} terminée`,
    body: `Bonjour ${client.name},\n\nL'intervention sur votre matériel (${params.reference}) est terminée. Le rapport de visite vous sera transmis par votre interlocuteur Vemat.\n\nL'équipe Vemat Group`,
  });
}
