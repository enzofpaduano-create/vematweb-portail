#!/usr/bin/env node
/**
 * One-shot: migrate the existing TRT 35 catalogue (extracted from git into
 * /tmp/trt35-source) to GCS at gs://vemat-catalogues/trt-35/.
 *
 * Steps:
 *   1. Read /tmp/trt35-source/catalog.json
 *   2. Strip the legacy "/data/terex-trt35-deep/schemas/" prefix from every
 *      `svgFile` field — keep just the filename, e.g. "04.0235.0115.svg"
 *   3. Upload the rewritten catalog.json to gs://vemat-catalogues/trt-35/catalog.json
 *   4. Upload every SVG from /tmp/trt35-source/schemas/ to
 *      gs://vemat-catalogues/trt-35/schemas/<filename>
 *   5. Update gs://vemat-catalogues/index.json with the trt-35 entry
 *
 * Run:
 *   node artifacts/api-server/scripts/migrate-trt35.mjs
 *
 * Reads creds from artifacts/api-server/secrets/gcs-key.json
 */
import { Storage } from "@google-cloud/storage";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, basename, join } from "node:path";

const SOURCE_DIR = "/tmp/trt35-source";
const SLUG = "trt-35";
const BUCKET_NAME = "vemat-catalogues";

const KEY_PATH = resolve(
  process.cwd(),
  "artifacts/api-server/secrets/gcs-key.json",
);
const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
const storage = new Storage({ keyFilename: KEY_PATH, projectId: key.project_id });
const bucket = storage.bucket(BUCKET_NAME);

console.log(`📦 Migrating ${SLUG} → gs://${BUCKET_NAME}/${SLUG}/`);

// ── 1. Read + rewrite catalog.json ──────────────────────────────────────────
const catalog = JSON.parse(readFileSync(join(SOURCE_DIR, "catalog.json"), "utf8"));
let svgRewrites = 0;
function stripPrefix(node) {
  if (node.svgFile && typeof node.svgFile === "string") {
    const file = basename(node.svgFile);
    if (file !== node.svgFile) {
      node.svgFile = file;
      svgRewrites++;
    }
  }
  for (const c of node.children || []) stripPrefix(c);
}
stripPrefix(catalog.tree);
console.log(`   ✓ Rewrote ${svgRewrites} svgFile paths → bare filenames`);

// ── 2. Upload catalog.json ───────────────────────────────────────────────────
await bucket.file(`${SLUG}/catalog.json`).save(
  JSON.stringify(catalog, null, 2),
  { contentType: "application/json", resumable: false },
);
console.log(`   ✓ Uploaded ${SLUG}/catalog.json`);

// ── 3. Upload all SVGs (parallel, batched) ──────────────────────────────────
const schemasDir = join(SOURCE_DIR, "schemas");
const svgFiles = readdirSync(schemasDir).filter((f) => f.endsWith(".svg"));
console.log(`   ▸ Uploading ${svgFiles.length} SVG files…`);

const BATCH = 16; // 16 parallel uploads
let done = 0;
for (let i = 0; i < svgFiles.length; i += BATCH) {
  const slice = svgFiles.slice(i, i + BATCH);
  await Promise.all(
    slice.map(async (filename) => {
      const localPath = join(schemasDir, filename);
      const buf = readFileSync(localPath);
      await bucket.file(`${SLUG}/schemas/${filename}`).save(buf, {
        contentType: "image/svg+xml",
        resumable: false,
      });
      done++;
      process.stdout.write(`\r   ${done}/${svgFiles.length}…`);
    }),
  );
}
process.stdout.write(`\r   ✓ Uploaded ${done} SVG files\n`);

// ── 4. Update index.json ─────────────────────────────────────────────────────
const indexFile = bucket.file("index.json");
let index = { machines: [] };
try {
  const [exists] = await indexFile.exists();
  if (exists) {
    const [buf] = await indexFile.download();
    index = JSON.parse(buf.toString("utf8"));
  }
} catch (e) {
  console.warn(`   ⚠ Could not read existing index.json: ${e.message}`);
}

const entry = {
  slug: SLUG,
  label: "TRT 35",
  brand: "Terex Crespellano",
  scrapedAt: catalog.scrapedAt,
  nodeCount: catalog.stats?.nodes ?? 0,
  schemaCount: catalog.stats?.withSvg ?? 0,
  partCount: catalog.stats?.parts ?? 0,
};
index.machines = (index.machines || []).filter((m) => m.slug !== SLUG);
index.machines.push(entry);
index.machines.sort((a, b) => a.label.localeCompare(b.label));

await indexFile.save(JSON.stringify(index, null, 2), {
  contentType: "application/json",
  resumable: false,
});
console.log(`   ✓ Updated index.json (${index.machines.length} machine(s))`);

console.log(`\n✅ Migration complete — gs://${BUCKET_NAME}/${SLUG}/ ready`);
