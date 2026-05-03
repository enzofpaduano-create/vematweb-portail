import { Router, type IRouter } from "express";
import { requireCatalogueAccess } from "../middlewares/requireCatalogueAccess";
import { getJson, isGcsConfigured, streamToResponse } from "../lib/gcs";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Catalogue index — list of available machines.
 * Reads `gs://vemat-catalogues/index.json`.
 *
 *   { machines: [{ slug, label, brand, scrapedAt, nodeCount, schemaCount, partCount }] }
 */
type CatalogueIndex = {
  machines: Array<{
    slug: string;
    label: string;
    brand: string;
    scrapedAt: string;
    nodeCount?: number;
    schemaCount?: number;
    partCount?: number;
  }>;
};

router.get("/catalogues", requireCatalogueAccess, async (_req, res, next) => {
  try {
    if (!isGcsConfigured()) {
      res.status(503).json({ error: "Catalogue storage not configured" });
      return;
    }
    const index = await getJson<CatalogueIndex>("index.json");
    res.json(index ?? { machines: [] });
  } catch (err) {
    next(err);
  }
});

/**
 * Catalogue tree for a specific machine.
 * Reads `gs://vemat-catalogues/<slug>/catalog.json`.
 */
router.get("/catalogues/:slug", requireCatalogueAccess, async (req, res, next) => {
  try {
    if (!isGcsConfigured()) {
      res.status(503).json({ error: "Catalogue storage not configured" });
      return;
    }
    const slug = String(req.params.slug ?? "");
    if (!/^[a-z0-9-]+$/i.test(slug)) {
      res.status(400).json({ error: "Invalid machine slug" });
      return;
    }
    const tree = await getJson<unknown>(`${slug}/catalog.json`);
    if (!tree) {
      res.status(404).json({ error: `No catalogue for machine '${slug}'` });
      return;
    }
    res.json(tree);
  } catch (err) {
    next(err);
  }
});

/**
 * SVG schema proxy.
 * Streams `gs://vemat-catalogues/<slug>/schemas/<filename>` to the client.
 */
router.get("/catalogues/:slug/svg/:filename", requireCatalogueAccess, async (req, res, next) => {
  try {
    if (!isGcsConfigured()) {
      res.status(503).json({ error: "Catalogue storage not configured" });
      return;
    }
    const slug = String(req.params.slug ?? "");
    const filename = String(req.params.filename ?? "");

    if (!/^[a-z0-9-]+$/i.test(slug)) {
      res.status(400).json({ error: "Invalid machine slug" });
      return;
    }
    // Allow alphanumerics, dot, dash, underscore — typical SVG filenames
    // Allow common image formats (vintage Crespellano catalogues serve PNG)
    const extMatch = filename.match(/\.(svg|png|jpe?g|gif|bmp|webp)$/i);
    if (!/^[A-Za-z0-9._()-]+\.(svg|png|jpe?g|gif|bmp|webp)$/i.test(filename)) {
      res.status(400).json({ error: "Invalid schema filename" });
      return;
    }
    const ext = extMatch![1].toLowerCase();
    const contentType = ({
      svg: "image/svg+xml; charset=utf-8",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      bmp: "image/bmp",
      webp: "image/webp",
    })[ext] || "application/octet-stream";

    const found = await streamToResponse(
      `${slug}/schemas/${filename}`,
      res,
      contentType,
    );
    if (!found) {
      res.status(404).json({ error: "SVG not found" });
    }
  } catch (err) {
    logger.error({ err }, "SVG stream failed");
    next(err);
  }
});

export default router;
