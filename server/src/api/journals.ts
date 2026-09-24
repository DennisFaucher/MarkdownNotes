import { join } from "node:path";
import { Router } from "express";
import { JOURNALS_DIR } from "../config.js";
import { formatJournalTitle, journalFilename, journalIdFromDate } from "../vault/files.js";
import { emptyDoc, loadPage } from "../vault/read.js";
import { ConflictError, preserveAsConflictCopy, savePage } from "../vault/write.js";
import { fromApiBlocks, isValidSaveBody, toApiDoc } from "./dto.js";

export const journalsRouter = Router();

function parseDateParam(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// GET /api/journals?before=YYYY-MM-DD&limit=7
// Returns `limit` consecutive calendar days ending the day before `before`
// (or today, if omitted), newest first. Days with no file yet come back as
// empty drafts so the feed always shows a continuous run of date sections.
journalsRouter.get("/", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 14), 1), 60);
  const beforeParam = typeof req.query.before === "string" ? parseDateParam(req.query.before) : null;
  const before = beforeParam ? startOfDay(beforeParam) : startOfDay(new Date(Date.now() + 24 * 3600 * 1000));

  const days: Awaited<ReturnType<typeof toApiDoc>>[] = [];
  for (let i = 0; i < limit; i++) {
    const date = new Date(before);
    date.setDate(date.getDate() - 1 - i);
    const filename = journalFilename(date);
    const loaded = (await loadPage(join(JOURNALS_DIR, filename))) ?? emptyDoc();
    days.push(toApiDoc(journalIdFromDate(date), formatJournalTitle(date), "journal", loaded));
  }
  res.json({ days });
});

journalsRouter.get("/:date", async (req, res) => {
  const date = parseDateParam(req.params.date);
  if (!date) return res.status(400).json({ error: "invalid date, expected YYYY-MM-DD" });
  const loaded = (await loadPage(join(JOURNALS_DIR, journalFilename(date)))) ?? emptyDoc();
  res.json(toApiDoc(journalIdFromDate(date), formatJournalTitle(date), "journal", loaded));
});

journalsRouter.put("/:date", async (req, res) => {
  const date = parseDateParam(req.params.date);
  if (!date) return res.status(400).json({ error: "invalid date, expected YYYY-MM-DD" });
  if (!isValidSaveBody(req.body)) return res.status(400).json({ error: "invalid body" });

  try {
    const { version } = await savePage(join(JOURNALS_DIR, journalFilename(date)), {
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
journalsRouter.post("/:date/resolve-conflict", async (req, res) => {
  const date = parseDateParam(req.params.date);
  if (!date) return res.status(400).json({ error: "invalid date, expected YYYY-MM-DD" });
  await preserveAsConflictCopy(join(JOURNALS_DIR, journalFilename(date)));
  res.json({ version: "" });
});
