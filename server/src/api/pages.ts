import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Router } from "express";
import { PAGES_DIR } from "../config.js";
import { filenameToPageTitle, isSafePageTitle, pageTitleToFilename } from "../vault/files.js";
import { emptyDoc, loadPage } from "../vault/read.js";
import { ConflictError, preserveAsConflictCopy, savePage } from "../vault/write.js";
import { fromApiBlocks, isValidSaveBody, toApiDoc } from "./dto.js";

export const pagesRouter = Router();

// A page's id is always its plain (decoded) title — Express already decodes
// :id from the URL, so no further encode/decode step happens here. Clients
// percent-encode only when building the URL itself.

// GET /api/pages — a plain directory listing for the "All pages" nav item.
// No search index needed for this; that arrives with the SQLite index in M2.
pagesRouter.get("/", async (_req, res) => {
  let entries: string[] = [];
  try {
    entries = await readdir(PAGES_DIR);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  const pages = entries
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const title = filenameToPageTitle(f);
      return { id: title, title };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
  res.json({ pages });
});

pagesRouter.get("/:id", async (req, res) => {
  const title = req.params.id;
  if (!isSafePageTitle(title)) return res.status(400).json({ error: "invalid page id" });
  const loaded = (await loadPage(join(PAGES_DIR, pageTitleToFilename(title)))) ?? emptyDoc();
  res.json(toApiDoc(title, title, "page", loaded));
});

pagesRouter.put("/:id", async (req, res) => {
  const title = req.params.id;
  if (!isSafePageTitle(title)) return res.status(400).json({ error: "invalid page id" });
  if (!isValidSaveBody(req.body)) return res.status(400).json({ error: "invalid body" });

  try {
    const { version } = await savePage(join(PAGES_DIR, pageTitleToFilename(title)), {
      preLines: req.body.preLines,
      blocks: fromApiBlocks(req.body.blocks),
      hadTrailingNewline: req.body.hadTrailingNewline,
      baseVersion: req.body.baseVersion,
    });
    res.json({ version });
  } catch (err) {
    if (err instanceof ConflictError) {
      return res.status(409).json({ error: err.message, currentVersion: err.currentVersion });
    }
    throw err;
  }
});

// User explicitly chose "keep my version" after an external-change conflict:
// move whatever's currently on disk into a .conflict-<ISO>.md sibling (never
// discarded) and hand back version:"" so the client's next save lands clean.
pagesRouter.post("/:id/resolve-conflict", async (req, res) => {
  const title = req.params.id;
  if (!isSafePageTitle(title)) return res.status(400).json({ error: "invalid page id" });
  await preserveAsConflictCopy(join(PAGES_DIR, pageTitleToFilename(title)));
  res.json({ version: "" });
});
