import express from "express";
import {
  createCategory,
  deleteCategory,
  getCategoriesByUserId,
  editCategory,
} from "../controller/categoriesController.js";

const router = express.Router();

router.get("/:userId", getCategoriesByUserId);
router.post("/", createCategory);
router.put("/:categoryId", editCategory);
router.delete("/:categoryId", deleteCategory);

export default router;
