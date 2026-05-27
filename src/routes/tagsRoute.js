import express from "express";
import {
  createTag,
  deleteTag,
  getTagsByUserId,
} from "../controller/tagsController.js";

const router = express.Router();

router.get("/:userId", getTagsByUserId);
router.post("/", createTag);
router.delete("/:tagId", deleteTag);

export default router;
