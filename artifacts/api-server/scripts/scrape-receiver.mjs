#!/usr/bin/env node
/**
 * Local HTTPS receiver that streams catalogue data straight to GCS.
 * Zero file ever touches the local disk — the request body is uploaded
 * to GCS via the Storage SDK and discarded as soon as the upload returns.
 *
 * Why HTTPS? The browser is on https://partsbook.terex.com — Chrome blocks
 * fetch() to plain http://localhost as mixed content. A self-signed HTTPS
 * cert solves it (the user accepts it once via "Advanced → Proceed").
 *
 * Endpoints:
 *   GET  /health                          → 200 "ok" (to accept the cert)
 *   POST /svg/<slug>/<filename>           → upload to gs://<bucket>/<slug>/schemas/<filename>
 *   POST /catalog/<slug>                  → upload JSON tree + update gs://<bucket>/index.json
 *   GET  /status                          → JSON of current bucket state
 *
 * Usage:
 *   node artifacts/api-server/scripts/scrape-receiver.mjs
 *   # Open in Chrome: https://localhost:8443/health → Advanced → Proceed (once)
 *
 * Run from repo root.
 */
import { createServer } from "node:https";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { Storage } from "@google-cloud/storage";

const PORT = Number(process.env.RECEIVER_PORT || 8443);
const BUCKET_NAME = process.env.GCS_BUCKET || "vemat-catalogues";
const KEY_PATH = resolve(process.cwd(), "artifacts/api-server/secrets/gcs-key.json");
const CERT_PATH = resolve(process.cwd(), "artifacts/api-server/secrets/local-https-cert.pem");
const KEY_HTTPS_PATH = resolve(process.cwd(), "artifacts/api-server/secrets/local-https-key.pem");

// ─── 1. Self-signed cert (auto-generated on first run) ────────────────────────
if (!existsSync(CERT_PATH) || !existsSync(KEY_HTTPS_PATH)) {
  console.log("⚙  Generating self-signed HTTPS cert (one-time)…");
  execSync(
    `openssl req -x509 -newkey rsa:2048 -nodes -days 825 -keyout ${KEY_HTTPS_PATH} -out ${CERT_PATH} -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`,
    { stdio: "inherit" },
  );
  console.log("   ✓ Cert written to", CERT_PATH);
}

// ─── 2. GCS client ────────────────────────────────────────────────────────────
if (!existsSync(KEY_PATH)) {
  console.error(`✗ GCS key not found at ${KEY_PATH}`);
  process.exit(1);
}
const gcsKey = JSON.parse(readFileSync(KEY_PATH, "utf8"));
const storage = new Storage({ keyFilename: KEY_PATH, projectId: gcsKey.project_id });
const bucket = storage.bucket(BUCKET_NAME);

// In-memory upload counters (per slug)
const stats = {};
function trackUpload(slug, kind, bytes) {
  stats[slug] ??= { svgs: 0, svgBytes: 0, catalogs: 0 };
  if (kind === "svg") {
    stats[slug].svgs++;
    stats[slug].svgBytes += bytes;
  } else if (kind === "catalog") {
    stats[slug].catalogs++;
  }
}

// ─── 3. Helpers ───────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "3600");
}

function readBody(req) {
  return new Promise((res, rej) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => res(Buffer.concat(chunks)));
    req.on("error", rej);
  });
}

function safeSlug(s) {
  return /^[a-z0-9-]+$/i.test(s) ? s : null;
}
function safeFilename(s) {
  // Allow alphanumerics, dot, dash, underscore, parentheses, percent (URL encoding).
  // Extensions kept in sync with the backend route (catalogues.ts) — vintage
  // Crespellano catalogues (A300/A350) sometimes serve BMP/WEBP rasters.
  return /^[A-Za-z0-9._()%-]+\.(svg(?:\.svg)?|png|jpe?g|gif|bmp|webp)$/i.test(s) ? s : null;
}

async function uploadSvg(slug, filename, body) {
  // Determine content-type from filename extension
  const ext = (filename.match(/\.([a-z]+)$/i) || [])[1]?.toLowerCase() || 'svg';
  const contentType = ({
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
  })[ext] || 'application/octet-stream';
  const file = bucket.file(`${slug}/schemas/${filename}`);
  await file.save(body, { contentType, resumable: false });
}

async function uploadCatalog(slug, jsonText) {
  // Parse to validate + grab stats
  const data = JSON.parse(jsonText);
  await bucket
    .file(`${slug}/catalog.json`)
    .save(jsonText, { contentType: "application/json", resumable: false });

  // Update index.json
  const indexFile = bucket.file("index.json");
  let index = { machines: [] };
  const [exists] = await indexFile.exists();
  if (exists) {
    const [buf] = await indexFile.download();
    try {
      index = JSON.parse(buf.toString("utf8"));
    } catch {
      index = { machines: [] };
    }
  }
  const entry = {
    slug,
    label: data.machine || slug.toUpperCase(),
    brand: data.brand || "Terex Crespellano",
    scrapedAt: data.scrapedAt || new Date().toISOString(),
    nodeCount: data.stats?.nodes ?? 0,
    schemaCount: data.stats?.withSvg ?? 0,
    partCount: data.stats?.parts ?? 0,
  };
  index.machines = (index.machines || []).filter((m) => m.slug !== slug);
  index.machines.push(entry);
  index.machines.sort((a, b) => a.label.localeCompare(b.label));
  await indexFile.save(JSON.stringify(index, null, 2), {
    contentType: "application/json",
    resumable: false,
  });
  return entry;
}

// ─── 4. HTTPS server ──────────────────────────────────────────────────────────
const tlsOpts = {
  cert: readFileSync(CERT_PATH),
  key: readFileSync(KEY_HTTPS_PATH),
};

const server = createServer(tlsOpts, async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // GET /health
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok\n");
      return;
    }

    // GET /status — JSON of receiver state
    if (req.method === "GET" && req.url === "/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          { bucket: BUCKET_NAME, projectId: gcsKey.project_id, stats },
          null,
          2,
        ),
      );
      return;
    }

    // POST /svg/<slug>/<filename>
    let m = req.url.match(/^\/svg\/([^/]+)\/([^/]+)$/);
    if (req.method === "POST" && m) {
      const slug = safeSlug(decodeURIComponent(m[1]));
      const filename = safeFilename(decodeURIComponent(m[2]));
      if (!slug || !filename) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "bad slug or filename" }));
        return;
      }
      const body = await readBody(req);
      await uploadSvg(slug, filename, body);
      trackUpload(slug, "svg", body.length);
      const total = stats[slug];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, bytes: body.length, totalSvgs: total.svgs }));
      console.log(`   ↑ ${slug}/${filename}  (${(body.length / 1024).toFixed(1)} KB)  [#${total.svgs}]`);
      return;
    }

    // POST /catalog/<slug>
    m = req.url.match(/^\/catalog\/([^/]+)$/);
    if (req.method === "POST" && m) {
      const slug = safeSlug(decodeURIComponent(m[1]));
      if (!slug) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "bad slug" }));
        return;
      }
      const body = await readBody(req);
      const entry = await uploadCatalog(slug, body.toString("utf8"));
      trackUpload(slug, "catalog", body.length);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, entry }));
      console.log(`✅ ${slug}/catalog.json uploaded — ${entry.nodeCount} nodes, ${entry.schemaCount} schemas, ${entry.partCount} parts`);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "not found" }));
  } catch (err) {
    console.error("✗ Request failed:", err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message || "server error" }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log(`🚀 scrape-receiver ready on https://localhost:${PORT}/`);
  console.log(`   → bucket: gs://${BUCKET_NAME}/`);
  console.log("");
  console.log(`First-time setup (one-time):`);
  console.log(`   1. Open https://localhost:${PORT}/health in Chrome`);
  console.log(`   2. Click "Advanced" → "Proceed to localhost (unsafe)"`);
  console.log(`   3. You should see "ok"`);
  console.log("");
  console.log(`Receiving uploads… (Ctrl+C to stop)`);
});
