import { Router, raw } from "express";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ASSETS_DIR } from "../config.js";

export const assetsRouter = Router();

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

// Raw binary body, not JSON — an uploaded image is sent as the request body
// directly with its real Content-Type, not base64-wrapped in a JSON field.
assetsRouter.post("/", raw({ type: () => true, limit: "25mb" }), async (req, res) => {
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    res.status(400).json({ error: "empty upload" });
    return;
  }
  const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim();
  const ext = EXT_BY_MIME[contentType] ?? "png";

  await mkdir(ASSETS_DIR, { recursive: true });
  const filename = `image_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
  await writeFile(join(ASSETS_DIR, filename), body);

  res.json({ path: `assets/${filename}` });
});
