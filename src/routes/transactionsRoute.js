import express from "express";
import {
    getTransactionsByUserId,
    createTransaction,
    deleteTransaction,
    getSummaryByUserId,
    updateTransaction,
} from "../controller/transactionsController.js";

const router = express.Router();

router.get("/summary/:userId", getSummaryByUserId);
router.get("/:userId", getTransactionsByUserId);
router.post("/", createTransaction);
router.put("/:id", updateTransaction);
router.delete("/:id", deleteTransaction);

export default router;
