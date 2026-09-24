import { Router } from "express";
import { resolve, sep } from "node:path";
import { VAULT_PATH } from "../config.js";
import { getOpenTodos } from "../index/search.js";
import { toggleBlockMarker, BlockNotFoundError } from "../vault/toggleMarker.js";

export const todosRouter = Router();

todosRouter.get("/", (_req, res) => {
  res.json({ todos: getOpenTodos() });
});

/** The path always comes from our own GET /api/todos response in practice,
 *  but a toggle request never trusts a client-supplied path without
 *  confirming it can't escape the vault root via "..". */
function resolveVaultPath(relPath: unknown): string | null {
  if (typeof relPath !== "string" || relPath.length === 0) return null;
  const abs = resolve(VAULT_PATH, relPath);
  if (abs !== VAULT_PATH && !abs.startsWith(VAULT_PATH + sep)) return null;
  return abs;
}

todosRouter.post("/toggle", async (req, res) => {
  const absPath = resolveVaultPath(req.body?.path);
  const blockIndex = req.body?.blockIndex;
  if (!absPath || typeof blockIndex !== "number") {
    res.status(400).json({ error: "invalid path or blockIndex" });
    return;
  }
  try {
    res.json(await toggleBlockMarker(absPath, blockIndex));
  } catch (err) {
    if (err instanceof BlockNotFoundError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});
