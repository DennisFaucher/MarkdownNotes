import { Router } from "express";
import { LANGUAGETOOL_LANGUAGE, LANGUAGETOOL_URL } from "../config.js";
import { getIgnoredSetLower } from "../vault/dictionary.js";

export const spellcheckRouter = Router();

export interface SpellMatch {
  offset: number;
  length: number;
  message: string;
  shortMessage: string;
  replacements: string[];
  issueType: string;
}

interface LtMatch {
  offset: number;
  length: number;
  message: string;
  shortMessage?: string;
  replacements?: { value: string }[];
  rule?: { issueType?: string };
}

spellcheckRouter.get("/", (_req, res) => {
  res.json({ enabled: Boolean(LANGUAGETOOL_URL) });
});

spellcheckRouter.post("/", async (req, res) => {
  if (!LANGUAGETOOL_URL) return res.json({ matches: [] });

  const text = typeof req.body?.text === "string" ? req.body.text : "";
  if (!text.trim()) return res.json({ matches: [] });

  const params = new URLSearchParams({ text, language: LANGUAGETOOL_LANGUAGE });
  let ltResponse: Response;
  try {
    ltResponse = await fetch(`${LANGUAGETOOL_URL}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
  } catch (err) {
    console.error("LanguageTool request failed", err);
    return res.json({ matches: [] });
  }

  if (!ltResponse.ok) {
    console.error(`LanguageTool returned ${ltResponse.status}`);
    return res.json({ matches: [] });
  }

  const body = (await ltResponse.json()) as { matches?: LtMatch[] };
  const ignored = await getIgnoredSetLower();
  const matches: SpellMatch[] = (body.matches ?? [])
    .filter((m) => !ignored.has(text.slice(m.offset, m.offset + m.length).toLowerCase()))
    .map((m) => ({
      offset: m.offset,
      length: m.length,
      message: m.message,
      shortMessage: m.shortMessage || m.message,
      replacements: (m.replacements ?? []).slice(0, 5).map((r) => r.value),
      issueType: m.rule?.issueType ?? "other",
    }));
  res.json({ matches });
});
