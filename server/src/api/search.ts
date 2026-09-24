import { Router } from "express";
import { searchBlocks } from "../index/search.js";

export const searchRouter = Router();

searchRouter.get("/", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const results = searchBlocks(q);
  res.json({ results });
});
