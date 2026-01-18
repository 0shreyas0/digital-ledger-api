import express from "express";
import {
    getTransactionsByUserId,
    createTransaction,
    deleteTransaction,
    getSummaryByUserId,
} from "../controller/transactionsController.js";

const router = express.Router();

router.get("/:userId", getTransactionsByUserId);
router.post("/", createTransaction);
router.delete("/:id", deleteTransaction);
router.get("/summary/:userId", getSummaryByUserId);

export default router;
