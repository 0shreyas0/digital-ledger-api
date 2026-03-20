import express from "express";
import {
  createCategory,
  deleteCategory,
  getCategoriesByUserId,
} from "../controller/categoriesController.js";

const router = express.Router();

router.get("/:userId", getCategoriesByUserId);
router.post("/", createCategory);
router.delete("/:categoryId", deleteCategory);

export default router;
