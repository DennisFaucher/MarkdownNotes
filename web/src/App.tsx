import { useEffect } from "react";
import { Sidebar } from "./layout/Sidebar";
import { TabBar } from "./layout/TabBar";
import { TopBar } from "./layout/TopBar";
import { MainPane } from "./layout/MainPane";
import { CalendarPicker } from "./views/CalendarPicker";
import { SearchModal } from "./views/SearchModal";
import { useUiStore } from "./state/useUiStore";
import { getCurrentDocId } from "./editor/currentDoc";
import { FindReplaceBar } from "./editor/FindReplaceBar";
import { useGlobalCut } from "./editor/useGlobalCut";
import { useGlobalIndent } from "./editor/useGlobalIndent";
import { useGlobalDelete } from "./editor/useGlobalDelete";
import { useLiveSync } from "./editor/useLiveSync";
import { spellcheckStatus } from "./sync/api";

export function App() {
  const theme = useUiStore((s) => s.theme);
  useGlobalCut();
  useGlobalIndent();
  useGlobalDelete();
  useLiveSync();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    spellcheckStatus()
      .then((r) => useUiStore.getState().setSpellcheckEnabled(r.enabled))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useUiStore.getState().toggleSearch();
      }
      // Only takes over Cmd/Ctrl+F when there's an actual doc to scope it to
      // (a page/journal-day tab, or a day in the Journals feed you've clicked
      // into) — otherwise falls through to the browser's own in-page find.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f" && getCurrentDocId()) {
        e.preventDefault();
        useUiStore.getState().toggleFindReplace();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="mn-app">
      <Sidebar />
      <div className="mn-content-column">
        <TabBar />
        <TopBar />
        <MainPane />
      </div>
      <SearchModal />
      <CalendarPicker />
      <FindReplaceBar />
    </div>
  );
}
