import { create } from "zustand";
import { apiBlockToEditorBlock } from "../editor/derive";
import type { ApiDoc, EditorBlock, EditorDoc } from "../types/block";

const UNDO_LIMIT = 50;

interface DocStoreState {
  docs: Record<string, EditorDoc>;
  undoStacks: Record<string, EditorBlock[][]>;

  setDoc: (doc: ApiDoc) => void;
  /** Applies a pure blocks-array mutator. Structural ops push an undo snapshot first. */
  updateBlocks: (docId: string, mutate: (blocks: EditorBlock[]) => EditorBlock[], structural: boolean) => void;
  setSaving: (docId: string, saving: boolean) => void;
  markSaved: (docId: string, version: string) => void;
  replaceWithServerVersion: (doc: ApiDoc) => void;
  undo: (docId: string) => boolean;
  setConflict: (docId: string, conflict: boolean) => void;
  /** After "keep my version": the path's old content was just moved aside
   *  server-side, so treat it as freshly-cleared (baseVersion "") for the
   *  next save, and drop the conflict flag now that it's been resolved. */
  beginConflictResolution: (docId: string) => void;
}

export const useDocStore = create<DocStoreState>((set, get) => ({
  docs: {},
  undoStacks: {},

  setDoc: (doc) =>
    set((state) => {
      if (state.docs[doc.id]) return {}; // already loaded/being edited; don't clobber local state
      return {
        docs: {
          ...state.docs,
          [doc.id]: {
            id: doc.id,
            title: doc.title,
            kind: doc.kind,
            preLines: doc.preLines,
            hadTrailingNewline: doc.hadTrailingNewline,
            version: doc.version,
            blocks: doc.blocks.map(apiBlockToEditorBlock),
            dirty: false,
            saving: false,
            loadedAt: Date.now(),
            conflict: false,
          },
        },
      };
    }),

  updateBlocks: (docId, mutate, structural) =>
    set((state) => {
      const doc = state.docs[docId];
      if (!doc) return {};
      const undoStacks = { ...state.undoStacks };
      if (structural) {
        const stack = [...(undoStacks[docId] ?? []), doc.blocks];
        undoStacks[docId] = stack.slice(-UNDO_LIMIT);
      }
      return {
        docs: { ...state.docs, [docId]: { ...doc, blocks: mutate(doc.blocks), dirty: true } },
        undoStacks,
      };
    }),

  setSaving: (docId, saving) =>
    set((state) => {
      const doc = state.docs[docId];
      if (!doc) return {};
      return { docs: { ...state.docs, [docId]: { ...doc, saving } } };
    }),

  markSaved: (docId, version) =>
    set((state) => {
      const doc = state.docs[docId];
      if (!doc) return {};
      return {
        docs: {
          ...state.docs,
          [docId]: {
            ...doc,
            version,
            dirty: false,
            saving: false,
            blocks: doc.blocks.map((b) => ({ ...b, dirty: false, originalContLines: sourceToContLines(b.source), originalBulletEmpty: b.source === "" })),
          },
        },
      };
    }),

  replaceWithServerVersion: (doc) =>
    set((state) => ({
      docs: {
        ...state.docs,
        [doc.id]: {
          id: doc.id,
          title: doc.title,
          kind: doc.kind,
          preLines: doc.preLines,
          hadTrailingNewline: doc.hadTrailingNewline,
          version: doc.version,
          blocks: doc.blocks.map(apiBlockToEditorBlock),
          dirty: false,
          saving: false,
          loadedAt: Date.now(),
          conflict: false,
        },
      },
    })),

  setConflict: (docId, conflict) =>
    set((state) => {
      const doc = state.docs[docId];
      if (!doc) return {};
      return { docs: { ...state.docs, [docId]: { ...doc, conflict } } };
    }),

  beginConflictResolution: (docId) =>
    set((state) => {
      const doc = state.docs[docId];
      if (!doc) return {};
      return { docs: { ...state.docs, [docId]: { ...doc, conflict: false, version: "" } } };
    }),

  undo: (docId) => {
    const stack = get().undoStacks[docId];
    if (!stack || stack.length === 0) return false;
    const prevBlocks = stack[stack.length - 1];
    set((state) => ({
      docs: { ...state.docs, [docId]: { ...state.docs[docId], blocks: prevBlocks, dirty: true } },
      undoStacks: { ...state.undoStacks, [docId]: stack.slice(0, -1) },
    }));
    return true;
  },
}));

function sourceToContLines(source: string): { raw: boolean; text: string }[] {
  const lines = source.split("\n");
  return lines.slice(1).map((text) => ({ raw: false, text }));
}
