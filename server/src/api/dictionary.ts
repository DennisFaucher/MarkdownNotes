import { Router } from "express";
import { addIgnoredWord, listIgnoredWords } from "../vault/dictionary.js";

export const dictionaryRouter = Router();

dictionaryRouter.get("/", async (_req, res) => {
  res.json({ words: await listIgnoredWords() });
});

dictionaryRouter.post("/", async (req, res) => {
  const word = typeof req.body?.word === "string" ? req.body.word : "";
  if (!word.trim()) {
    res.status(400).json({ error: "word is required" });
    return;
  }
  res.json({ words: await addIgnoredWord(word) });
});
