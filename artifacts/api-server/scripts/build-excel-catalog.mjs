#!/usr/bin/env node
/**
 * Build Excel catalog files (one per machine) from the scraped GCS data.
 *
 * For every machine in gs://vemat-catalogues/index.json, reads its catalog.json,
 * walks the tree, collects all parts, and writes a formatted .xlsx to:
 *   ~/Desktop/VEMAT/excel machines pdr/<Famille>/<Machine>.xlsx
 *
 * Columns:
 *   Famille | Sous-famille | Chemin | Pos | N° Terex | N° Vemat | Désignation | Désignation FR | Qté | Remarques
 *
 * Vemat number rules (per machine):
 *   - Default: strip dots AND letters from Terex part number
 *     `09.0682.1336.CRE` → `0906821336`
 *   - Collision: if 2+ distinct originals collapse to the same stripped form,
 *     keep their letters but still strip dots
 *     `09.0682.1336.CRE` & `09.0682.1336.AAA` → `0906821336CRE` & `0906821336AAA`
 *
 * Run: cd artifacts/api-server && node scripts/build-excel-catalog.mjs
 */
import { Storage } from "@google-cloud/storage";
import ExcelJS from "exceljs";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

const KEY_PATH = resolve("secrets/gcs-key.json");
const BUCKET_NAME = "vemat-catalogues";
const OUT_ROOT = "/Users/enzopaduano/Desktop/VEMAT/excel machines pdr";

const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
const storage = new Storage({ keyFilename: KEY_PATH, projectId: key.project_id });
const bucket = storage.bucket(BUCKET_NAME);

// ── Family mapping (mirrors artifacts/vemat/src/lib/cataloguesFamilies.ts) ──
const FAMILY_FOLDER = {
  TRT: "Grues télescopiques",
  RT: "Grues tout-terrain",
  A: "Grues série A",
  RC: "Grues série RC",
  TCC: "Grues série TCC",
  Lattice: "Grues à treillis",
  Other: "Autres",
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

// ── Vemat number derivation with collision detection ─────────────────────────
function stripAll(partNumber) {
  return (partNumber || "").replace(/[^0-9]/g, "");
}
function stripDotsOnly(partNumber) {
  return (partNumber || "").replace(/\./g, "");
}

/**
 * Compute Vemat number for each part in a list, handling collisions.
 * Returns Map<originalPartNumber, vematNumber>.
 */
function buildVematMap(allParts) {
  // Group originals by their stripped form
  const groups = new Map(); // stripped → Set<original>
  for (const p of allParts) {
    const orig = (p.partNumber || "").trim();
    if (!orig) continue;
    const stripped = stripAll(orig);
    if (!stripped) continue;
    if (!groups.has(stripped)) groups.set(stripped, new Set());
    groups.get(stripped).add(orig);
  }

  // Build the final mapping
  const map = new Map(); // original → vemat
  for (const p of allParts) {
    const orig = (p.partNumber || "").trim();
    if (!orig) continue;
    const stripped = stripAll(orig);
    if (!stripped) {
      map.set(orig, "");
      continue;
    }
    const peers = groups.get(stripped);
    if (peers.size === 1) {
      // Unique → strip dots and letters
      map.set(orig, stripped);
    } else {
      // Collision → keep letters, strip dots only
      map.set(orig, stripDotsOnly(orig));
    }
  }
  return map;
}

// ── Tree walk: collect leaves with their family path ──────────────────────────
function collectParts(tree) {
  const rows = []; // {famille, sousFamille, chemin, pos, partNumber, version, name, nameFR, qty, remarks}
  function walk(node, ancestors) {
    const path = [...ancestors, node];
    if (Array.isArray(node.parts) && node.parts.length > 0) {
      // depth 1 = first level under root
      const depthLabels = path
        .slice(1) // drop root
        .map((n) => (n.labelFR || n.name || n.code || "").trim())
        .filter(Boolean);
      const famille = depthLabels[0] || "";
      const sousFamille = depthLabels[1] || "";
      const chemin = depthLabels.slice(2).join(" / ");
      for (const p of node.parts) {
        rows.push({
          famille,
          sousFamille,
          chemin,
          nodeCode: node.code,
          nodeName: node.labelFR || node.name || "",
          pos: p.pos || "",
          partNumber: p.partNumber || "",
          version: p.version || "",
          name: p.name || "",
          nameFR: p.nameFR || "",
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
async function writeMachineExcel(machineLabel, slug, brand, rows, outPath) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Vemat — Terex Crespellano scraper";
  wb.created = new Date();

  // Excel forbids these in sheet names: * ? : \ / [ ] — also 31-char limit
  const safeSheetName = machineLabel.replace(/[*?:\\/\[\]]/g, "-").slice(0, 31);
  const ws = wb.addWorksheet(safeSheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = [
    { header: "Famille",        key: "famille",      width: 26 },
    { header: "Sous-famille",   key: "sousFamille",  width: 36 },
    { header: "Chemin détaillé", key: "chemin",      width: 40 },
    { header: "Code module",    key: "nodeCode",     width: 14 },
    { header: "Module",         key: "nodeName",     width: 32 },
    { header: "Pos",            key: "pos",          width: 7 },
    { header: "N° Terex",       key: "partNumber",   width: 20 },
    { header: "N° Vemat",       key: "vemat",        width: 18 },
    { header: "Version",        key: "version",      width: 10 },
    { header: "Désignation",    key: "name",         width: 40 },
    { header: "Désignation FR", key: "nameFR",       width: 40 },
    { header: "Qté",            key: "qty",          width: 6  },
    { header: "Remarques",      key: "remarks",      width: 16 },
  ];

  // Header style
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern", pattern: "solid",
    fgColor: { argb: "FF0F172A" }, // zinc-900
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 22;

  // Compute Vemat numbers
  const vematMap = buildVematMap(rows);

  // Stable sort: Famille → Sous-famille → Chemin → Pos (numeric-aware)
  const posKey = (s) => {
    const n = parseFloat((s || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 9999999;
  };
  rows.sort((a, b) => {
    return (
      a.famille.localeCompare(b.famille, "fr") ||
      a.sousFamille.localeCompare(b.sousFamille, "fr") ||
      a.chemin.localeCompare(b.chemin, "fr") ||
      posKey(a.pos) - posKey(b.pos) ||
      a.partNumber.localeCompare(b.partNumber, "fr")
    );
  });

  for (const r of rows) {
    ws.addRow({
      ...r,
      vemat: vematMap.get(r.partNumber.trim()) || "",
    });
  }

  // Banded rows (light grey alternating)
  for (let i = 2; i <= ws.rowCount; i++) {
    if (i % 2 === 0) {
      ws.getRow(i).fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: "FFF8FAFC" }, // zinc-50
      };
    }
  }

  // Auto filter on header
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: ws.columns.length },
  };

  // Number columns alignment
  ["pos", "qty"].forEach((k) => {
    const col = ws.getColumn(k);
    col.alignment = { horizontal: "center", vertical: "middle" };
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

  // Group machines by family folder
  const byFolder = new Map();
  for (const m of idx.machines) {
    const fam = familyOf(m.slug);
    const folder = FAMILY_FOLDER[fam];
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

        // Sanitize filename
        const safeName = m.label.replace(/[/\\?%*:|"<>]/g, "-");
        const outFile = join(folderPath, `${safeName}.xlsx`);
        await writeMachineExcel(m.label, m.slug, m.brand, rows, outFile);
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
