#!/usr/bin/env node
/**
 * Build the MASTER spare-parts database — one row per unique Terex part
 * across all 49 catalogues. Designed as the seed for the Vemat parts DB.
 *
 * Output: ~/Desktop/VEMAT/database atlascom terex/Database PDR Vemat.xlsx
 *
 * Dedup key:    Terex part number (the canonical, stable identifier)
 * Vemat number: derived globally (strip dots+letters; on collision strip dots only)
 * Family/Sub:   most common across machines containing this part
 * Machines:     comma-separated list of all machines containing this Terex P/N
 *
 * Run: cd artifacts/api-server && node scripts/build-master-database.mjs
 */
import { Storage } from "@google-cloud/storage";
import ExcelJS from "exceljs";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

const KEY_PATH = resolve("secrets/gcs-key.json");
const BUCKET_NAME = "vemat-catalogues";
const OUT_DIR = "/Users/enzopaduano/Desktop/VEMAT/database atlascom terex";
const OUT_FILE = "Database PDR Vemat.xlsx";
const STOCK_PATH = "/Users/enzopaduano/Desktop/vematweb-v2/artifacts/vemat/public/vemat-stock-catalog.json";

const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
const storage = new Storage({ keyFilename: KEY_PATH, projectId: key.project_id });
const bucket = storage.bucket(BUCKET_NAME);

// ── Vemat number derivation (global) ─────────────────────────────────────────
function stripAll(pn) {
  return (pn || "").replace(/[^0-9]/g, "");
}
function stripDotsOnly(pn) {
  return (pn || "").replace(/\./g, "");
}

// ── Tree walk ─────────────────────────────────────────────────────────────────
function collectParts(tree, machineLabel) {
  const out = []; // {famille, sousFamille, partNumber, name, nameFR, qty, version, remarks, machine}
  function walk(node, ancestors) {
    const path = [...ancestors, node];
    if (Array.isArray(node.parts) && node.parts.length > 0) {
      const labels = path
        .slice(1)
        .map((n) => (n.labelFR || n.name || n.code || "").trim())
        .filter(Boolean);
      const famille = labels[0] || "";
      const sousFamille = labels[1] || "";
      for (const p of node.parts) {
        if (!p.partNumber || !p.partNumber.trim()) continue;
        out.push({
          famille,
          sousFamille,
          partNumber: p.partNumber.trim(),
          name: (p.name || "").trim(),
          nameFR: (p.nameFR || "").trim(),
          qty: (p.qty || "").trim(),
          version: (p.version || "").trim(),
          remarks: (p.remarks || "").trim(),
          machine: machineLabel,
        });
      }
    }
    for (const c of node.children || []) walk(c, path);
  }
  walk(tree, []);
  return out;
}

// ── Aggregate: Map<terexPN, aggregate> ───────────────────────────────────────
function aggregate(allOccurrences) {
  const byPN = new Map();
  for (const o of allOccurrences) {
    let agg = byPN.get(o.partNumber);
    if (!agg) {
      agg = {
        partNumber: o.partNumber,
        familleCounts: new Map(),
        sousFamilleCounts: new Map(),
        nameCounts: new Map(),
        nameFRCounts: new Map(),
        versionCounts: new Map(),
        remarksCounts: new Map(),
        machines: new Set(),
      };
      byPN.set(o.partNumber, agg);
    }
    if (o.famille) agg.familleCounts.set(o.famille, (agg.familleCounts.get(o.famille) || 0) + 1);
    if (o.sousFamille) agg.sousFamilleCounts.set(o.sousFamille, (agg.sousFamilleCounts.get(o.sousFamille) || 0) + 1);
    if (o.name) agg.nameCounts.set(o.name, (agg.nameCounts.get(o.name) || 0) + 1);
    if (o.nameFR) agg.nameFRCounts.set(o.nameFR, (agg.nameFRCounts.get(o.nameFR) || 0) + 1);
    if (o.version) agg.versionCounts.set(o.version, (agg.versionCounts.get(o.version) || 0) + 1);
    if (o.remarks) agg.remarksCounts.set(o.remarks, (agg.remarksCounts.get(o.remarks) || 0) + 1);
    agg.machines.add(o.machine);
  }
  return byPN;
}

function pickMostCommon(map) {
  let best = "";
  let bestCount = 0;
  for (const [v, c] of map) {
    if (c > bestCount || (c === bestCount && v.localeCompare(best) < 0)) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

// Sort machines so families stay together (TRT block, A block, RC, TCC, RT, Lattice)
function familyOrderKey(label) {
  if (label.startsWith("TRT")) return 0;
  if (label.startsWith("A") && /^A\d/.test(label)) return 1;
  if (label.startsWith("RC")) return 2;
  if (label.startsWith("TCC")) return 3;
  if (label.startsWith("RT")) return 4;
  if (/^\d/.test(label)) return 5;
  return 9;
}
function sortMachines(set) {
  return [...set].sort((a, b) => {
    const fa = familyOrderKey(a);
    const fb = familyOrderKey(b);
    if (fa !== fb) return fa - fb;
    return a.localeCompare(b, "fr", { numeric: true });
  });
}

// ── Vemat numbering with global collision detection ──────────────────────────
function buildVematMap(uniqueTerexNumbers) {
  const groups = new Map(); // stripped → Set<terexPN>
  for (const pn of uniqueTerexNumbers) {
    const stripped = stripAll(pn);
    if (!stripped) continue;
    if (!groups.has(stripped)) groups.set(stripped, new Set());
    groups.get(stripped).add(pn);
  }
  const map = new Map();
  for (const pn of uniqueTerexNumbers) {
    const stripped = stripAll(pn);
    if (!stripped) {
      map.set(pn, "");
      continue;
    }
    const peers = groups.get(stripped);
    if (peers.size === 1) map.set(pn, stripped);
    else map.set(pn, stripDotsOnly(pn));
  }
  return map;
}

// ── Excel writer ─────────────────────────────────────────────────────────────
async function writeMaster(rows, outPath) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Vemat — Terex Crespellano scraper";
  wb.created = new Date();

  const ws = wb.addWorksheet("Database PDR Vemat", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = [
    { header: "Source",          key: "source",      width: 14 },
    { header: "Famille",         key: "famille",     width: 28 },
    { header: "Sous-famille",    key: "sousFamille", width: 36 },
    { header: "N° Vemat",        key: "vemat",       width: 18 },
    { header: "N° Terex",        key: "partNumber",  width: 22 },
    { header: "Désignation FR",  key: "nameFR",      width: 42 },
    { header: "Désignation EN",  key: "name",        width: 42 },
    { header: "Version",         key: "version",     width: 10 },
    { header: "Remarques",       key: "remarks",     width: 18 },
    { header: "Stock Vemat",     key: "stock",       width: 12 },
    { header: "Nb machines",     key: "machineCount", width: 12 },
    { header: "Machines",        key: "machines",    width: 80 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern", pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 24;

  for (const r of rows) ws.addRow(r);

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

  ["machineCount", "stock"].forEach((k) => {
    ws.getColumn(k).alignment = { horizontal: "center", vertical: "middle" };
  });
  // Wrap long machine list
  ws.getColumn("machines").alignment = { wrapText: false, vertical: "middle" };
  // Color-code rows by source — Terex (default), Stock-only (light yellow)
  for (let i = 2; i <= ws.rowCount; i++) {
    const src = ws.getRow(i).getCell("source").value;
    if (src === "Stock only") {
      ws.getRow(i).fill = {
        type: "pattern", pattern: "solid",
        fgColor: { argb: "FFFEF3C7" }, // amber-100
      };
    }
  }

  await wb.xlsx.writeFile(outPath);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`📦 Output: ${OUT_DIR}/${OUT_FILE}`);
  mkdirSync(OUT_DIR, { recursive: true });

  const [idxBuf] = await bucket.file("index.json").download();
  const idx = JSON.parse(idxBuf.toString("utf8"));
  console.log(`📋 ${idx.machines.length} machines in index`);

  // 1. Collect all part occurrences
  const allOccurrences = [];
  for (const m of idx.machines) {
    try {
      const [buf] = await bucket.file(`${m.slug}/catalog.json`).download();
      const data = JSON.parse(buf.toString("utf8"));
      const occ = collectParts(data.tree, m.label);
      allOccurrences.push(...occ);
      console.log(`   ✓ ${m.label.padEnd(20)} ${occ.length.toString().padStart(5)} part occurrences`);
    } catch (err) {
      console.error(`   ✗ ${m.label}: ${err.message}`);
    }
  }
  console.log(`\n📊 Total occurrences: ${allOccurrences.length}`);

  // 2. Aggregate by Terex P/N
  const byPN = aggregate(allOccurrences);
  console.log(`📊 Unique Terex part numbers: ${byPN.size}`);

  // 3. Compute Vemat numbers globally
  const vematMap = buildVematMap([...byPN.keys()]);
  let collisions = 0;
  // Detect rows that collide on stripped form (kept letters)
  const strippedCount = new Map();
  for (const v of vematMap.values()) {
    if (!v) continue;
    strippedCount.set(v, (strippedCount.get(v) || 0) + 1);
  }
  for (const [v, c] of strippedCount) if (c > 1) collisions++;
  console.log(`📊 Vemat collisions resolved (kept letters): ${collisions}`);

  // 4. Load Vemat stock catalog (existing site data) and index by SKU
  const stockBySku = new Map(); // sku → {qty, title, familyName, model}
  try {
    const stock = JSON.parse(readFileSync(STOCK_PATH, "utf8"));
    for (const fam of stock.families) {
      for (const p of fam.products) {
        const sku = (p.sku || "").trim();
        if (!sku) continue;
        stockBySku.set(sku, {
          qty: p.quantity || 0,
          title: (p.title || "").trim(),
          familyName: fam.name || "",
          familyCode: fam.code || "",
          model: p.model || "",
        });
      }
    }
    console.log(`📦 Vemat stock SKUs loaded: ${stockBySku.size}`);
  } catch (err) {
    console.warn(`⚠ Could not load stock: ${err.message}`);
  }

  // 5. Build Terex-source rows (with stock qty if matched)
  const rows = [];
  const matchedSkus = new Set();
  for (const [pn, agg] of byPN) {
    const machinesSorted = sortMachines(agg.machines);
    const vemat = vematMap.get(pn) || "";
    const stockEntry = vemat ? stockBySku.get(vemat) : null;
    if (stockEntry) matchedSkus.add(vemat);
    rows.push({
      source:        "Terex",
      famille:       pickMostCommon(agg.familleCounts),
      sousFamille:   pickMostCommon(agg.sousFamilleCounts),
      vemat,
      partNumber:    pn,
      nameFR:        pickMostCommon(agg.nameFRCounts),
      name:          pickMostCommon(agg.nameCounts),
      version:       pickMostCommon(agg.versionCounts),
      remarks:       pickMostCommon(agg.remarksCounts),
      stock:         stockEntry ? stockEntry.qty : "",
      machineCount:  agg.machines.size,
      machines:      machinesSorted.join(", "),
    });
  }
  console.log(`📊 Terex parts with Vemat stock match: ${matchedSkus.size}`);

  // 6. Append stock-only rows (SKUs that don't match any Terex Vemat number)
  let stockOnly = 0;
  for (const [sku, s] of stockBySku) {
    if (matchedSkus.has(sku)) continue;
    rows.push({
      source:        "Stock only",
      famille:       s.familyName,
      sousFamille:   "",
      vemat:         sku,
      partNumber:    "",
      nameFR:        s.title,
      name:          "",
      version:       "",
      remarks:       "",
      stock:         s.qty,
      machineCount:  s.model ? 1 : 0,
      machines:      s.model || "",
    });
    stockOnly++;
  }
  console.log(`📊 Stock-only rows added: ${stockOnly}`);

  // 7. Sort: Source (Terex first) → Famille → Sous-famille → Vemat
  const sourceOrder = (s) => (s === "Terex" ? 0 : 1);
  rows.sort((a, b) => {
    return (
      sourceOrder(a.source) - sourceOrder(b.source) ||
      a.famille.localeCompare(b.famille, "fr") ||
      a.sousFamille.localeCompare(b.sousFamille, "fr") ||
      (a.vemat || "").localeCompare(b.vemat || "", "fr", { numeric: true }) ||
      a.partNumber.localeCompare(b.partNumber, "fr")
    );
  });

  // 8. Write
  await writeMaster(rows, join(OUT_DIR, OUT_FILE));
  console.log(`\n✅ Wrote ${rows.length} rows → ${OUT_DIR}/${OUT_FILE}`);
  console.log(`   • Terex parts: ${rows.filter(r => r.source === "Terex").length}`);
  console.log(`   • Stock only:  ${rows.filter(r => r.source === "Stock only").length}`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
