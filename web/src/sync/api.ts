import type { ApiDoc } from "../types/block";

export class SaveConflictError extends Error {
  constructor(public currentVersion: string) {
    super("save conflict");
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}));
      throw new SaveConflictError(body.currentVersion ?? "");
    }
    throw new Error(`request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function fetchJournals(before?: string, limit = 14): Promise<{ days: ApiDoc[] }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", before);
  return fetch(`/api/journals?${params}`).then((r) => json(r));
}

export function fetchPage(title: string): Promise<ApiDoc> {
  return fetch(`/api/pages/${encodeURIComponent(title)}`).then((r) => json(r));
}

export function fetchAllPages(): Promise<{ pages: { id: string; title: string }[] }> {
  return fetch("/api/pages").then((r) => json(r));
}

export function fetchJournalDay(dateIso: string): Promise<ApiDoc> {
  return fetch(`/api/journals/${dateIso}`).then((r) => json(r));
}

export interface SearchResult {
  blockId: string;
  path: string;
  pageTitle: string;
  pageKind: "journal" | "page";
  snippet: string;
  topContent: string;
  depth: number;
}

export function searchNotes(query: string): Promise<{ results: SearchResult[] }> {
  return fetch(`/api/search?q=${encodeURIComponent(query)}`).then((r) => json(r));
}

export function fetchTags(): Promise<{ tags: { tag: string; count: number }[] }> {
  return fetch("/api/tags").then((r) => json(r));
}

export interface TaggedBlock {
  blockId: string;
  path: string;
  pageTitle: string;
  pageKind: "journal" | "page";
  content: string;
  topContent: string;
  depth: number;
}

export function fetchTag(tag: string): Promise<{ tag: string; blocks: TaggedBlock[] }> {
  return fetch(`/api/tags/${encodeURIComponent(tag)}`).then((r) => json(r));
}

export interface TodoItem {
  path: string;
  blockIndex: number;
  marker: string;
  content: string;
  topContent: string;
  depth: number;
  pageTitle: string;
  pageKind: "journal" | "page";
  category: string | null;
}

export function fetchTodos(): Promise<{ todos: TodoItem[] }> {
  return fetch("/api/todos").then((r) => json(r));
}

export function toggleTodo(path: string, blockIndex: number): Promise<{ marker: string }> {
  return fetch("/api/todos/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, blockIndex }),
  }).then((r) => json(r));
}

export interface SaveBody {
  preLines: string[];
  blocks: {
    depth: number;
    bulletEmpty: boolean;
    firstLine: string;
    contLines: { raw: boolean; text: string }[];
  }[];
  hadTrailingNewline: boolean;
  baseVersion: string;
}

function docUrl(doc: { kind: "journal" | "page"; id: string }): string {
  // journal doc ids are "YYYY_MM_DD" (filename-shaped); the route takes "YYYY-MM-DD"
  return doc.kind === "journal" ? `/api/journals/${doc.id.replace(/_/g, "-")}` : `/api/pages/${encodeURIComponent(doc.id)}`;
}

export function saveDoc(
  doc: { kind: "journal" | "page"; id: string },
  body: SaveBody,
): Promise<{ version: string }> {
  return fetch(docUrl(doc), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json(r));
}

/** "Keep my version": moves whatever's on disk into a .conflict-<ISO>.md
 *  sibling server-side and returns version:"" so the next save lands clean. */
export function resolveConflict(doc: { kind: "journal" | "page"; id: string }): Promise<{ version: string }> {
  return fetch(`${docUrl(doc)}/resolve-conflict`, { method: "POST" }).then((r) => json(r));
}

export function checkSync(docs: { docId: string; kind: "journal" | "page" }[]): Promise<{ hashes: Record<string, string | null> }> {
  return fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docs }),
  }).then((r) => json(r));
}

export interface SpellMatch {
  offset: number;
  length: number;
  message: string;
  shortMessage: string;
  replacements: string[];
  issueType: string;
}

export function spellcheckStatus(): Promise<{ enabled: boolean }> {
  return fetch("/api/spellcheck").then((r) => json(r));
}

export function checkSpelling(text: string): Promise<{ matches: SpellMatch[] }> {
  return fetch("/api/spellcheck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).then((r) => json(r));
}

export function uploadAsset(file: Blob): Promise<{ path: string }> {
  return fetch("/api/assets", {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  }).then((r) => json(r));
}

export function addToDictionary(word: string): Promise<{ words: string[] }> {
  return fetch("/api/dictionary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  }).then((r) => json(r));
}
