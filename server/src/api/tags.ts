import { Router } from "express";
import { getBlocksForTag, listTags } from "../index/search.js";

export const tagsRouter = Router();

tagsRouter.get("/", (_req, res) => {
  res.json({ tags: listTags() });
});

tagsRouter.get("/:tag", (req, res) => {
  const blocks = getBlocksForTag(req.params.tag);
  res.json({ tag: req.params.tag, blocks });
});
