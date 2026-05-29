import express from "express";
import {
  createTag,
  deleteTag,
  getTagsByUserId,
  editTag,
} from "../controller/tagsController.js";

const router = express.Router();

router.get("/:userId", getTagsByUserId);
router.post("/", createTag);
router.put("/:tagId", editTag);
router.delete("/:tagId", deleteTag);

export default router;
