import { resolve } from "node:path";

export const VAULT_PATH = resolve(process.env.VAULT_PATH ?? "./vault");
export const JOURNALS_DIR = resolve(VAULT_PATH, "journals");
export const PAGES_DIR = resolve(VAULT_PATH, "pages");
export const ASSETS_DIR = resolve(VAULT_PATH, "assets");
export const PORT = Number(process.env.PORT ?? 3000);
export const DB_PATH = resolve(process.env.DB_PATH ?? "./data/index.sqlite");

// A self-hosted (or the public) LanguageTool server's base URL, e.g.
// "https://languagetool.example.com/v2" — the trailing "/check" is appended
// by the spellcheck route. Undefined disables spellcheck entirely rather than
// falling back to some third-party default: this app shouldn't silently send
// note content to an external service the user didn't explicitly configure.
export const LANGUAGETOOL_URL = process.env.LANGUAGETOOL_URL?.replace(/\/$/, "");
export const LANGUAGETOOL_LANGUAGE = process.env.LANGUAGETOOL_LANGUAGE ?? "en-US";
