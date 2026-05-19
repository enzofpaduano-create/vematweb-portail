/**
 * Catégories de produits considérées comme "machines" (vs pièces de rechange).
 * Les demandes de devis sur ces catégories sont routées vers le commercial
 * (et visibles par la direction) — l'admin ne les voit pas dans AdminDemandes.
 *
 * ⚠️ Source unique de vérité : si tu ajoutes/retires une catégorie, modifie ici.
 * Utilisée par : AdminDemandes (filtre), CommercialVentes (leads), DGCommercial (leads).
 */
export const MACHINE_CATEGORIES = [
  "Grues",
  "Nacelles & plateformes élévatrices",
  "Élévateurs télescopiques",
  "Matériaux de construction",
] as const;

export type MachineCategory = (typeof MACHINE_CATEGORIES)[number];

export function isMachineCategory(category: string | null | undefined): boolean {
  return !!category && (MACHINE_CATEGORIES as readonly string[]).includes(category);
}
