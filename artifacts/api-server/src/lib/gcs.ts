import { Storage } from "@google-cloud/storage";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { logger } from "./logger";

/**
 * Google Cloud Storage client.
 *
 * Two ways to provide credentials:
 *  - GCS_KEY_PATH=./secrets/gcs-key.json   (local dev)
 *  - GCS_KEY_JSON='{"type":"service_account",...}'  (prod, base64 or raw JSON)
 *
 * Required env: GCS_BUCKET
 */

const bucketName = process.env.GCS_BUCKET;

if (!bucketName) {
  logger.warn("GCS_BUCKET not set — catalogue routes will return 503");
}

let storage: Storage | null = null;

function getStorage(): Storage {
  if (storage) return storage;

  const keyPath = process.env.GCS_KEY_PATH;
  const keyJson = process.env.GCS_KEY_JSON;

  if (keyJson) {
    // Prod: credentials passed via env var (raw JSON or base64)
    let parsed: Record<string, unknown>;
    try {
      const raw = keyJson.trim().startsWith("{")
        ? keyJson
        : Buffer.from(keyJson, "base64").toString("utf8");
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`GCS_KEY_JSON could not be parsed: ${(err as Error).message}`);
    }
    storage = new Storage({ credentials: parsed, projectId: parsed.project_id as string });
    logger.info({ msg: "GCS configured via GCS_KEY_JSON" });
    return storage;
  }

  if (keyPath) {
    const absPath = resolve(process.cwd(), keyPath);
    if (!existsSync(absPath)) {
      throw new Error(`GCS_KEY_PATH points to ${absPath} but file does not exist`);
    }
    const parsed = JSON.parse(readFileSync(absPath, "utf8"));
    storage = new Storage({ keyFilename: absPath, projectId: parsed.project_id });
    logger.info({ msg: "GCS configured via GCS_KEY_PATH", path: absPath });
    return storage;
  }

  throw new Error(
    "No GCS credentials found. Set GCS_KEY_PATH (local) or GCS_KEY_JSON (prod).",
  );
}

export function getBucket() {
  if (!bucketName) throw new Error("GCS_BUCKET env var is required");
  return getStorage().bucket(bucketName);
}

export function isGcsConfigured(): boolean {
  return Boolean(bucketName) && Boolean(process.env.GCS_KEY_PATH || process.env.GCS_KEY_JSON);
}

/** Get JSON object from GCS, parsed. Returns null on 404. */
export async function getJson<T>(objectPath: string): Promise<T | null> {
  const file = getBucket().file(objectPath);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buf] = await file.download();
  return JSON.parse(buf.toString("utf8")) as T;
}

/** Stream an object from GCS to an Express response. Returns false on 404. */
export async function streamToResponse(
  objectPath: string,
  res: import("express").Response,
  contentType: string,
): Promise<boolean> {
  const file = getBucket().file(objectPath);
  const [exists] = await file.exists();
  if (!exists) return false;

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, max-age=300"); // 5 min cache (private = browser only, not CDN)

  await new Promise<void>((resolveStream, rejectStream) => {
    file
      .createReadStream()
      .on("error", rejectStream)
      .on("end", () => resolveStream())
      .pipe(res);
  });
  return true;
}
