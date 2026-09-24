import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { VAULT_PATH } from "../config.js";

// Lives in the vault (not the disposable SQLite index) so a personal
// dictionary survives restarts and travels with the vault like everything
// else — e.g. across machines via Resilio Sync.
const DICTIONARY_PATH = join(VAULT_PATH, ".markdownnotes", "dictionary.json");

let words: string[] | null = null; // original casing, in the order added

async function load(): Promise<string[]> {
  if (words) return words;
  try {
    const raw = await readFile(DICTIONARY_PATH, "utf8");
    const parsed = JSON.parse(raw) as { words?: unknown };
    words = Array.isArray(parsed.words) ? parsed.words.filter((w): w is string => typeof w === "string") : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    words = [];
  }
  return words;
}

async function persist(list: string[]): Promise<void> {
  await mkdir(dirname(DICTIONARY_PATH), { recursive: true });
  const tmpPath = `${DICTIONARY_PATH}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, JSON.stringify({ words: list }, null, 2), "utf8");
  await rename(tmpPath, DICTIONARY_PATH);
}

export async function listIgnoredWords(): Promise<string[]> {
  const list = await load();
  return [...list].sort((a, b) => a.localeCompare(b));
}

export async function addIgnoredWord(word: string): Promise<string[]> {
  const trimmed = word.trim();
  const list = await load();
  if (trimmed && !list.some((w) => w.toLowerCase() === trimmed.toLowerCase())) {
    words = [...list, trimmed];
    await persist(words);
  }
  return listIgnoredWords();
}

/** Lowercased lookup set for filtering spellcheck matches — case-insensitive,
 *  so adding "AINE" also silences a stray lowercase "aine". */
export async function getIgnoredSetLower(): Promise<Set<string>> {
  const list = await load();
  return new Set(list.map((w) => w.toLowerCase()));
}
