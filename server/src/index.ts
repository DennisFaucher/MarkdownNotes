import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { ASSETS_DIR, PORT } from "./config.js";
import { journalsRouter } from "./api/journals.js";
import { pagesRouter } from "./api/pages.js";
import { searchRouter } from "./api/search.js";
import { tagsRouter } from "./api/tags.js";
import { spellcheckRouter } from "./api/spellcheck.js";
import { dictionaryRouter } from "./api/dictionary.js";
import { assetsRouter } from "./api/assets.js";
import { syncRouter } from "./api/sync.js";
import { todosRouter } from "./api/todos.js";
import { openIndex } from "./index/db.js";
import { rebuildIndex } from "./index/build.js";
import { startWatcher } from "./vault/watcher.js";

async function main() {
  openIndex();
  await rebuildIndex();
  startWatcher();

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/journals", journalsRouter);
  app.use("/api/pages", pagesRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/tags", tagsRouter);
  app.use("/api/spellcheck", spellcheckRouter);
  app.use("/api/dictionary", dictionaryRouter);
  app.use("/api/assets", assetsRouter);
  app.use("/api/sync", syncRouter);
  app.use("/api/todos", todosRouter);
  // Uploaded images are served from here (../assets/... references in
  // markdown resolve to /assets/... at the HTTP root, one level up from
  // either journals/ or pages/, matching the vault's on-disk layout).
  app.use("/assets", express.static(ASSETS_DIR));

  // Serve the built SPA in production (single container, no CORS to configure).
  // In dev, the Vite dev server runs separately and proxies /api here instead.
  const webDist = join(fileURLToPath(new URL(".", import.meta.url)), "../../web/dist");
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.use((_req, res) => res.sendFile(join(webDist, "index.html")));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

  app.listen(PORT, () => {
    console.log(`MarkdownNotes server listening on :${PORT}`);
  });
}

main().catch((err) => {
  console.error("failed to start", err);
  process.exit(1);
});
