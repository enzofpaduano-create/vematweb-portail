#!/usr/bin/env node
/**
 * Build ENGLISH Excel catalog files (one per machine) from the scraped GCS data.
 *
 * Output: ~/Desktop/VEMAT/excel spare parts ENGLISH/<English family>/<Machine>.xlsx
 *
 * Strategy:
 *   - Module hierarchy labels prefer node.name (parsed English fragment from
 *     Terex's mixed Italian/English originals). For vintage French catalogues
 *     (A-series, TCC, Lattice, RC where labelOriginal is in French) we apply
 *     a FR→EN dictionary on the original label, falling back to the raw label
 *     when no translation exists.
 *   - Part designations prefer p.name (already in English/Italian original).
 *
 * Vemat number rules (per machine, identical to the FR script):
 *   - Default: strip dots AND letters
 *   - Collision: strip dots only (preserves disambiguating letters)
 *
 * Run: cd artifacts/api-server && node scripts/build-excel-catalog-en.mjs
 */
import { Storage } from "@google-cloud/storage";
import ExcelJS from "exceljs";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

const KEY_PATH = resolve("secrets/gcs-key.json");
const BUCKET_NAME = "vemat-catalogues";
const OUT_ROOT = "/Users/enzopaduano/Desktop/VEMAT/excel spare parts ENGLISH";

const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
const storage = new Storage({ keyFilename: KEY_PATH, projectId: key.project_id });
const bucket = storage.bucket(BUCKET_NAME);

// ── Family mapping (English) ─────────────────────────────────────────────────
const FAMILY_FOLDER_EN = {
  TRT: "Telescopic cranes",
  RT: "Rough terrain cranes",
  A: "A-series cranes",
  RC: "RC-series cranes",
  TCC: "TCC-series cranes",
  Lattice: "Lattice cranes",
  Other: "Other",
};

function familyOf(slug) {
  const s = (slug || "").toLowerCase();
  if (s.startsWith("trt-")) return "TRT";
  if (s.startsWith("rt-") || s === "rt") return "RT";
  if (s.startsWith("a-") || /^a\d/.test(s)) return "A";
  if (s.startsWith("rc-") || /^rc\d/.test(s)) return "RC";
  if (s.startsWith("tcc-") || /^tcc\d/.test(s)) return "TCC";
  if (/^\d/.test(s)) return "Lattice";
  return "Other";
}

// ── FR → EN dictionary (mirrors src/lib/partTranslations.ts on the front-end) ─
// Multi-word phrases first (longest match wins on the regex pass below).
const FR_EN_PHRASES = [
  // ── Catalogue + structural
  ["Catalogue de Pièces de Rechange", "Spare Parts Catalogue"],
  ["Catalogue pieces detachees", "Spare Parts Catalogue"],
  ["Pièces de service recommandées", "Recommended service parts"],
  ["Pièces recommandées", "Recommended parts"],
  // ── Modules vintage A/RC/TCC/Lattice (FR labels)
  ["Kit Filtres", "Filter Kit"],
  ["Kit de filtres", "Filter Kit"],
  ["Kit de fusibles", "Fuse Kit"],
  ["Kit de connecteurs", "Connector Kit"],
  ["Boîte de vitesses", "Gearbox"],
  ["Boite de vitesses", "Gearbox"],
  ["Moteur / Boîte de vitesses", "Engine / Gearbox"],
  ["Ponts Dromos", "Dromos axles"],
  ["Tourelle / installation électrique", "Turret / electrical"],
  ["Tourelle (superstructure)", "Turret (superstructure)"],
  ["Flèche télescopique", "Telescopic boom"],
  ["Flèche treillis", "Lattice boom"],
  ["Châssis porteur", "Carrier chassis"],
  ["Châssis", "Chassis"],
  ["Cabine et carrosserie", "Cab & bodywork"],
  ["Cabine", "Cab"],
  ["Essieu avant", "Front axle"],
  ["Essieu arrière", "Rear axle"],
  ["Essieux", "Axles"],
  ["Ensemble moteur-transmission", "Engine & transmission assembly"],
  ["Ensemble essieux", "Axle assembly"],
  ["Ensemble châssis porteur", "Carrier chassis assembly"],
  ["Composants moteur", "Engine components"],
  // ── Part designations (common French terms)
  ["Roue avant", "Front wheel"],
  ["Roue arrière", "Rear wheel"],
  ["Roue libre", "Free wheel"],
  ["Pont avant", "Front axle drive"],
  ["Pont arrière", "Rear axle drive"],
  ["Pompe à huile", "Oil pump"],
  ["Pompe à eau", "Water pump"],
  ["Pompe à carburant", "Fuel pump"],
  ["Pompe hydraulique", "Hydraulic pump"],
  ["Pompe à injection", "Injection pump"],
  ["Pompe à graisse", "Grease pump"],
  ["Pompe d'amorçage", "Priming pump"],
  ["Vérin de levage", "Lifting cylinder"],
  ["Vérin de direction", "Steering cylinder"],
  ["Vérin télescopique", "Telescopic cylinder"],
  ["Filtre à huile", "Oil filter"],
  ["Filtre à air", "Air filter"],
  ["Filtre à carburant", "Fuel filter"],
  ["Préfiltre à carburant", "Fuel prefilter"],
  ["Préfiltres", "Prefilters"],
  ["Préfiltre", "Prefilter"],
  ["Joint torique", "O-ring"],
  ["Joint plat", "Flat seal"],
  ["Joint d'huile", "Oil seal"],
  ["Joint d'étanchéité", "Sealing gasket"],
  ["Joint de culasse", "Cylinder head gasket"],
  ["Joint à lèvre", "Lip seal"],
  ["Joint de tige", "Rod seal"],
  ["Joint de piston", "Piston seal"],
  ["Bague d'étanchéité", "Sealing bushing"],
  ["Bague d'usure", "Wear bushing"],
  ["Roulement à billes", "Ball bearing"],
  ["Roulement à rouleaux", "Roller bearing"],
  ["Roulement de bielle", "Connecting rod bearing"],
  ["Coussinet de bielle", "Connecting rod bushing"],
  ["Boîtier de commande", "Control unit"],
  ["Capteur de pression", "Pressure sensor"],
  ["Capteur de température", "Temperature sensor"],
  ["Capteur de niveau", "Level sensor"],
  ["Tuyau hydraulique", "Hydraulic hose"],
  ["Tuyau d'aspiration", "Suction hose"],
  ["Tuyau de refoulement", "Discharge hose"],
  ["Tuyauterie de refoulement", "Pressure piping"],
  ["Plaque d'immatriculation", "License plate"],
  ["Plaque signalétique", "Nameplate"],
  ["Lampe de travail", "Work lamp"],
  ["Feu arrière", "Rear lamp"],
  ["Feu avant", "Front lamp"],
  ["Feu de position", "Position lamp"],
  ["Feu stop", "Stop lamp"],
  ["Phare avant", "Headlight"],
  ["Bouchon de réservoir", "Tank cap"],
  ["Bouchon de vidange", "Drain plug"],
  ["Couvercle de boîte", "Box cover"],
  ["Carter d'huile", "Oil pan"],
  ["Carter moteur", "Engine block"],
  ["Levier de commande", "Control lever"],
  ["Klaxon avertisseur", "Horn"],
  ["Volant de direction", "Steering wheel"],
  ["Pédale de frein", "Brake pedal"],
  ["Pédale d'accélérateur", "Accelerator pedal"],
  ["Pédale d'embrayage", "Clutch pedal"],
  ["Réservoir d'huile", "Oil tank"],
  ["Réservoir de carburant", "Fuel tank"],
  ["Réservoir d'eau", "Water tank"],
  ["Échappement complet", "Complete exhaust"],
  ["Tube d'échappement", "Exhaust pipe"],
  ["Pot d'échappement", "Muffler"],
  ["Boîte à fusibles", "Fuse box"],
  ["Faisceau électrique", "Wiring harness"],
  ["Câble de batterie", "Battery cable"],
  ["Coupe-batterie", "Battery cut-off"],
  ["Galet tendeur", "Tensioner pulley"],
  ["Courroie crantée", "Toothed belt"],
  ["Courroie trapézoïdale", "V-belt"],
  ["Vase d'expansion", "Expansion tank"],
  ["Radiateur d'huile", "Oil radiator"],
  ["Radiateur d'eau", "Water radiator"],
  ["Disque de frein", "Brake disc"],
  ["Plaquettes de frein", "Brake pads"],
  ["Mâchoire de frein", "Brake shoe"],
  ["Cylindre de frein", "Brake cylinder"],
  ["Pignon d'attaque", "Drive pinion"],
  ["Couronne dentée", "Ring gear"],
  ["Arbre de transmission", "Drive shaft"],
  ["Arbre à cames", "Camshaft"],
  ["Arbre intermédiaire", "Idler shaft"],
  ["Engrenage planétaire", "Planetary gear"],
  ["Embrayage complet", "Complete clutch"],
  ["Vilebrequin complet", "Complete crankshaft"],
  ["Bielle complète", "Complete connecting rod"],
  ["Piston complet", "Complete piston"],
  ["Segment de piston", "Piston ring"],
  ["Soupape d'admission", "Intake valve"],
  ["Soupape d'échappement", "Exhaust valve"],
  ["Culasse complète", "Complete cylinder head"],
  ["Démarreur électrique", "Electric starter"],
  ["Alternateur complet", "Complete alternator"],
  ["Bobine d'allumage", "Ignition coil"],
  ["Bougie d'allumage", "Spark plug"],
  ["Bougie de préchauffage", "Glow plug"],
  ["Injecteur complet", "Complete injector"],
  ["Cabine complète", "Complete cab"],
  ["Vitre latérale", "Side window"],
  ["Pare-brise avant", "Front windshield"],
  ["Pare-brise arrière", "Rear windshield"],
  ["Essuie-glace avant", "Front wiper"],
  ["Essuie-glace arrière", "Rear wiper"],
  ["Siège conducteur", "Operator seat"],
  ["Siège passager", "Passenger seat"],
  ["Tableau de bord", "Dashboard"],
  ["Centrale hydraulique", "Hydraulic power unit"],
  ["Distributeur hydraulique", "Hydraulic valve"],
  ["Bloc hydraulique", "Hydraulic block"],
  ["Câble de commande", "Control cable"],
  ["Tringle de commande", "Control rod"],
  ["Manomètre de pression", "Pressure gauge"],
  ["Bras oscillant", "Swing arm"],
  ["Bras de relevage", "Lifting arm"],
  ["Goupille de fixation", "Fixing pin"],
  ["Goupille fendue", "Split pin"],
  ["Boulon hexagonal", "Hex bolt"],
  ["Boulon de fixation", "Fixing bolt"],
  ["Vis à tête hexagonale", "Hex screw"],
  ["Écrou hexagonal", "Hex nut"],
  ["Écrou autobloquant", "Lock nut"],
  ["Rondelle plate", "Flat washer"],
  ["Rondelle d'arrêt", "Lock washer"],
  ["Indicateur de niveau", "Level indicator"],
  // ── Standalone words
  ["Joystick", "Joystick"],
  ["Levier", "Lever"],
  ["Volant", "Flywheel"],
  ["Pédale", "Pedal"],
  ["Capot", "Hood"],
  ["Cabine", "Cab"],
  ["Carrosserie", "Bodywork"],
  ["Tourelle", "Turret"],
  ["Flèche", "Boom"],
  ["Treuils", "Winches"],
  ["Treuil", "Winch"],
  ["Moteur", "Engine"],
  ["Transmission", "Transmission"],
  ["Embrayage", "Clutch"],
  ["Freins", "Brakes"],
  ["Frein", "Brake"],
  ["Direction", "Steering"],
  ["Suspension", "Suspension"],
  ["Pompes", "Pumps"],
  ["Pompe", "Pump"],
  ["Vérins", "Cylinders"],
  ["Vérin", "Cylinder"],
  ["Filtres", "Filters"],
  ["Filtre", "Filter"],
  ["Joints", "Seals"],
  ["Joint", "Seal"],
  ["Bagues", "Bushings"],
  ["Bague", "Bushing"],
  ["Roulements", "Bearings"],
  ["Roulement", "Bearing"],
  ["Coussinets", "Bushings"],
  ["Coussinet", "Bushing"],
  ["Capteurs", "Sensors"],
  ["Capteur", "Sensor"],
  ["Soupapes", "Valves"],
  ["Soupape", "Valve"],
  ["Vannes", "Valves"],
  ["Vanne", "Valve"],
  ["Distributeur", "Valve manifold"],
  ["Manomètre", "Gauge"],
  ["Indicateur", "Indicator"],
  ["Couvercle", "Cover"],
  ["Carter", "Housing"],
  ["Réservoir", "Tank"],
  ["Bouchons", "Plugs"],
  ["Bouchon", "Cap"],
  ["Tubes", "Tubes"],
  ["Tube", "Tube"],
  ["Tuyaux", "Hoses"],
  ["Tuyau", "Hose"],
  ["Tuyauterie", "Piping"],
  ["Conduites", "Lines"],
  ["Conduite", "Line"],
  ["Raccords", "Fittings"],
  ["Raccord", "Fitting"],
  ["Colliers", "Clamps"],
  ["Collier", "Clamp"],
  ["Câbles", "Cables"],
  ["Câble", "Cable"],
  ["Faisceau", "Harness"],
  ["Fils", "Wires"],
  ["Fil", "Wire"],
  ["Fiches", "Connectors"],
  ["Fiche", "Connector"],
  ["Connecteurs", "Connectors"],
  ["Connecteur", "Connector"],
  ["Prises", "Sockets"],
  ["Prise", "Socket"],
  ["Lampes", "Lamps"],
  ["Lampe", "Lamp"],
  ["Feux", "Lamps"],
  ["Feu", "Lamp"],
  ["Phares", "Headlights"],
  ["Phare", "Headlight"],
  ["Ampoules", "Bulbs"],
  ["Ampoule", "Bulb"],
  ["Klaxon", "Horn"],
  ["Avertisseur", "Buzzer"],
  ["Démarreur", "Starter"],
  ["Alternateur", "Alternator"],
  ["Batteries", "Batteries"],
  ["Batterie", "Battery"],
  ["Fusibles", "Fuses"],
  ["Fusible", "Fuse"],
  ["Relais", "Relay"],
  ["Bobine", "Coil"],
  ["Bougie", "Spark plug"],
  ["Injecteurs", "Injectors"],
  ["Injecteur", "Injector"],
  ["Radiateur", "Radiator"],
  ["Échangeur", "Exchanger"],
  ["Échappement", "Exhaust"],
  ["Silencieux", "Muffler"],
  ["Turbocompresseur", "Turbocharger"],
  ["Turbo", "Turbo"],
  ["Compresseur", "Compressor"],
  ["Vilebrequin", "Crankshaft"],
  ["Bielles", "Connecting rods"],
  ["Bielle", "Connecting rod"],
  ["Pistons", "Pistons"],
  ["Piston", "Piston"],
  ["Segments", "Rings"],
  ["Segment", "Ring"],
  ["Cylindres", "Cylinders"],
  ["Cylindre", "Cylinder"],
  ["Culasse", "Cylinder head"],
  ["Engrenages", "Gears"],
  ["Engrenage", "Gear"],
  ["Pignons", "Pinions"],
  ["Pignon", "Pinion"],
  ["Couronnes", "Ring gears"],
  ["Couronne", "Ring gear"],
  ["Arbres", "Shafts"],
  ["Arbre", "Shaft"],
  ["Axes", "Pins"],
  ["Axe", "Pin"],
  ["Goupilles", "Pins"],
  ["Goupille", "Pin"],
  ["Boulons", "Bolts"],
  ["Boulon", "Bolt"],
  ["Vis", "Screw"],
  ["Écrous", "Nuts"],
  ["Ecrous", "Nuts"],
  ["Écrou", "Nut"],
  ["Ecrou", "Nut"],
  ["Rondelles", "Washers"],
  ["Rondelle", "Washer"],
  ["Ressorts", "Springs"],
  ["Ressort", "Spring"],
  ["Chaînes", "Chains"],
  ["Chaîne", "Chain"],
  ["Chaine", "Chain"],
  ["Courroies", "Belts"],
  ["Courroie", "Belt"],
  ["Galets", "Pulleys"],
  ["Galet", "Pulley"],
  ["Poulies", "Pulleys"],
  ["Poulie", "Pulley"],
  ["Roues", "Wheels"],
  ["Roue", "Wheel"],
  ["Pneus", "Tires"],
  ["Pneu", "Tire"],
  ["Pneumatiques", "Tires"],
  ["Jantes", "Rims"],
  ["Jante", "Rim"],
  ["Disques", "Discs"],
  ["Disque", "Disc"],
  ["Plaquettes", "Pads"],
  ["Plaquette", "Pad"],
  ["Mâchoires", "Shoes"],
  ["Mâchoire", "Shoe"],
  ["Étriers", "Calipers"],
  ["Etriers", "Calipers"],
  ["Étrier", "Caliper"],
  ["Etrier", "Caliper"],
  ["Pédalier", "Pedal assembly"],
  ["Sièges", "Seats"],
  ["Siège", "Seat"],
  ["Vitres", "Windows"],
  ["Vitre", "Window"],
  ["Pare-brise", "Windshield"],
  ["Essuie-glace", "Wiper"],
  ["Tableau", "Panel"],
  ["Plaques", "Plates"],
  ["Plaque", "Plate"],
  ["Supports", "Brackets"],
  ["Support", "Bracket"],
  ["Pattes", "Brackets"],
  ["Patte", "Bracket"],
  ["Bras", "Arm"],
  ["Tringle", "Rod"],
  ["Tiges", "Rods"],
  ["Tige", "Rod"],
  ["Manchons", "Sleeves"],
  ["Manchon", "Sleeve"],
  ["Douilles", "Bushings"],
  ["Douille", "Bushing"],
  ["Réducteurs", "Reducers"],
  ["Réducteur", "Reducer"],
  ["Graisseurs", "Grease nipples"],
  ["Graisseur", "Grease nipple"],
  ["Composants", "Components"],
  ["Ensemble", "Assembly"],
  ["Kit", "Kit"],
  ["Accessoires", "Accessories"],
  ["Options", "Options"],
  ["Outils", "Tools"],
  ["Outillage", "Tooling"],
  ["Eau", "Water"],
  ["Huile", "Oil"],
  ["Carburant", "Fuel"],
  ["Air", "Air"],
  ["Pression", "Pressure"],
  ["Température", "Temperature"],
  ["Niveau", "Level"],
  ["Vitesse", "Speed"],
  ["Avant", "Front"],
  ["Arrière", "Rear"],
  ["Arriere", "Rear"],
  ["Gauche", "Left"],
  ["Droite", "Right"],
  ["Droit", "Right"],
  ["Haut", "Upper"],
  ["Bas", "Lower"],
  ["Supérieur", "Upper"],
  ["Inférieur", "Lower"],
  ["Inferieur", "Lower"],
  ["Superieur", "Upper"],
  ["Intérieur", "Inner"],
  ["Extérieur", "Outer"],
  ["Interieur", "Inner"],
  ["Exterieur", "Outer"],
  ["Long", "Long"],
  ["Court", "Short"],
  ["Grand", "Large"],
  ["Petit", "Small"],
  ["Complet", "Complete"],
  ["Complète", "Complete"],
  ["Complete", "Complete"],
  ["Avec", "With"],
  ["Sans", "Without"],
  ["Pour", "For"],
  ["Unidirectionnelle", "Unidirectional"],
  ["Unidirectionnel", "Unidirectional"],
  ["Bidirectionnelle", "Bidirectional"],
  ["Bidirectionnel", "Bidirectional"],
  ["Multidirectionnel", "Multidirectional"],
  ["Hexagonal", "Hexagonal"],
  ["Hexagonale", "Hexagonal"],
  ["Carré", "Square"],
  ["Carrée", "Square"],
  ["Rond", "Round"],
  ["Ronde", "Round"],
  ["Plat", "Flat"],
  ["Plate", "Flat"],
  ["Vertical", "Vertical"],
  ["Verticale", "Vertical"],
  ["Horizontal", "Horizontal"],
  ["Horizontale", "Horizontal"],
  ["Latéral", "Side"],
  ["Latérale", "Side"],
  ["Central", "Central"],
  ["Centrale", "Central"],
  ["Principale", "Main"],
  ["Auxiliaire", "Auxiliary"],
  ["Standard", "Standard"],
  ["Spécial", "Special"],
  ["Spéciale", "Special"],
  ["Optionnel", "Optional"],
  ["Optionnelle", "Optional"],
  ["Réglable", "Adjustable"],
  ["Variable", "Variable"],
  ["Fixe", "Fixed"],
  ["Démontable", "Removable"],
  ["Pieces detachees", "Spare parts"],
  ["Pièces", "Parts"],
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip accents/diacritics for matching (so "VERIN" matches "Vérin"). */
function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Sort by length DESC, then strip accents from pattern source so case- and
// accent-insensitive matching works (e.g. "VERIN" matches "Vérin").
const FR_EN_REGEXES = [...FR_EN_PHRASES]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([fr, en]) => [
    new RegExp("\\b" + escapeRe(stripAccents(fr)) + "\\b", "gi"),
    en,
  ]);

function translateFrToEn(text) {
  if (!text) return "";
  let out = text;
  for (const [re, en] of FR_EN_REGEXES) {
    // Build an accent-stripped view of the same length, so match indices align
    const ascii = stripAccents(out);
    let result = "";
    let last = 0;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(ascii)) !== null) {
      result += out.slice(last, m.index);
      result += en;
      last = m.index + m[0].length;
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    result += out.slice(last);
    out = result;
  }
  return out;
}

/** Pick the best English label for a tree node. */
function nodeEnLabel(n) {
  // Prefer the English fragment parsed by parseLabel when present
  const name = (n.name || "").trim();
  if (name.length > 2 && /[A-Za-z]/.test(name)) return name;
  // Otherwise translate the original (vintage FR labels)
  const orig = (n.labelOriginal || n.labelFR || "").trim();
  if (!orig) return n.code || "";
  return translateFrToEn(orig);
}

/** Pick the best English designation for a part. */
function partEnLabel(p) {
  // p.name is the original Terex value — usually English/Italian, but for
  // some parts Terex stored it in French ("BAGUE", "Gauche joystick").
  // Run the dictionary so French words become English; already-English text
  // passes through unchanged.
  return translateFrToEn((p.name || p.nameFR || "").trim());
}

// ── Vemat number derivation (same as FR script) ──────────────────────────────
function stripAll(pn) {
  return (pn || "").replace(/[^0-9]/g, "");
}
function stripDotsOnly(pn) {
  return (pn || "").replace(/\./g, "");
}
function buildVematMap(allParts) {
  const groups = new Map();
  for (const p of allParts) {
    const orig = (p.partNumber || "").trim();
    if (!orig) continue;
    const stripped = stripAll(orig);
    if (!stripped) continue;
    if (!groups.has(stripped)) groups.set(stripped, new Set());
    groups.get(stripped).add(orig);
  }
  const map = new Map();
  for (const p of allParts) {
    const orig = (p.partNumber || "").trim();
    if (!orig) continue;
    const stripped = stripAll(orig);
    if (!stripped) {
      map.set(orig, "");
      continue;
    }
    const peers = groups.get(stripped);
    if (peers.size === 1) map.set(orig, stripped);
    else map.set(orig, stripDotsOnly(orig));
  }
  return map;
}

// ── Tree walk ────────────────────────────────────────────────────────────────
function collectParts(tree) {
  const rows = [];
  function walk(node, ancestors) {
    const path = [...ancestors, node];
    if (Array.isArray(node.parts) && node.parts.length > 0) {
      const depthLabels = path.slice(1).map(nodeEnLabel).filter(Boolean);
      const family = depthLabels[0] || "";
      const subFamily = depthLabels[1] || "";
      const detailedPath = depthLabels.slice(2).join(" / ");
      for (const p of node.parts) {
        rows.push({
          family,
          subFamily,
          detailedPath,
          moduleCode: node.code || "",
          moduleName: nodeEnLabel(node),
          pos: p.pos || "",
          partNumber: p.partNumber || "",
          version: p.version || "",
          designation: partEnLabel(p),
          qty: p.qty || "",
          remarks: p.remarks || "",
        });
      }
    }
    for (const c of node.children || []) walk(c, path);
  }
  walk(tree, []);
  return rows;
}

// ── Excel writer ─────────────────────────────────────────────────────────────
async function writeMachineExcel(machineLabel, rows, outPath) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Vemat — Terex Crespellano scraper";
  wb.created = new Date();

  const safeSheetName = machineLabel.replace(/[*?:\\/\[\]]/g, "-").slice(0, 31);
  const ws = wb.addWorksheet(safeSheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = [
    { header: "Family",          key: "family",        width: 26 },
    { header: "Sub-family",      key: "subFamily",     width: 36 },
    { header: "Detailed path",   key: "detailedPath",  width: 40 },
    { header: "Module code",     key: "moduleCode",    width: 14 },
    { header: "Module",          key: "moduleName",    width: 32 },
    { header: "Pos",             key: "pos",           width: 7  },
    { header: "Terex P/N",       key: "partNumber",    width: 20 },
    { header: "Vemat P/N",       key: "vemat",         width: 18 },
    { header: "Version",         key: "version",       width: 10 },
    { header: "Designation",     key: "designation",   width: 44 },
    { header: "Qty",             key: "qty",           width: 6  },
    { header: "Remarks",         key: "remarks",       width: 16 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern", pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 22;

  const vematMap = buildVematMap(rows);

  const posKey = (s) => {
    const n = parseFloat((s || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 9999999;
  };
  rows.sort((a, b) => {
    return (
      a.family.localeCompare(b.family, "en") ||
      a.subFamily.localeCompare(b.subFamily, "en") ||
      a.detailedPath.localeCompare(b.detailedPath, "en") ||
      posKey(a.pos) - posKey(b.pos) ||
      a.partNumber.localeCompare(b.partNumber, "en")
    );
  });

  for (const r of rows) {
    ws.addRow({
      ...r,
      vemat: vematMap.get(r.partNumber.trim()) || "",
    });
  }

  for (let i = 2; i <= ws.rowCount; i++) {
    if (i % 2 === 0) {
      ws.getRow(i).fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
    }
  }

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: ws.columns.length },
  };

  ["pos", "qty"].forEach((k) => {
    ws.getColumn(k).alignment = { horizontal: "center", vertical: "middle" };
  });

  await wb.xlsx.writeFile(outPath);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`📦 Output dir: ${OUT_ROOT}`);
  mkdirSync(OUT_ROOT, { recursive: true });

  const [idxBuf] = await bucket.file("index.json").download();
  const idx = JSON.parse(idxBuf.toString("utf8"));
  console.log(`📋 ${idx.machines.length} machines in index`);

  const byFolder = new Map();
  for (const m of idx.machines) {
    const fam = familyOf(m.slug);
    const folder = FAMILY_FOLDER_EN[fam];
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(m);
  }

  let totalRows = 0;
  let machinesDone = 0;

  for (const [folder, machines] of byFolder) {
    const folderPath = join(OUT_ROOT, folder);
    mkdirSync(folderPath, { recursive: true });
    console.log(`\n📁 ${folder} (${machines.length} machines)`);

    for (const m of machines) {
      try {
        const [buf] = await bucket.file(`${m.slug}/catalog.json`).download();
        const data = JSON.parse(buf.toString("utf8"));
        const rows = collectParts(data.tree);
        const safeName = m.label.replace(/[/\\?%*:|"<>]/g, "-");
        const outFile = join(folderPath, `${safeName}.xlsx`);
        await writeMachineExcel(m.label, rows, outFile);
        totalRows += rows.length;
        machinesDone++;
        console.log(`   ✓ ${m.label.padEnd(20)} ${rows.length.toString().padStart(5)} parts → ${safeName}.xlsx`);
      } catch (err) {
        console.error(`   ✗ ${m.label}: ${err.message}`);
      }
    }
  }

  console.log(`\n✅ Done — ${machinesDone}/${idx.machines.length} machines, ${totalRows} parts total`);
  console.log(`   View: ${OUT_ROOT}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
