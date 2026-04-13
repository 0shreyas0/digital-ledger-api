import crypto from "crypto";
import { sql } from "../config/db.js";

const DEFAULT_CATEGORY_ICON = "pricetag-outline";

function normalizeUserDetails({ userId, username, email }) {
  const safeUserId = String(userId).trim();
  const safeEmail = String(email || `${safeUserId}@local.digital-ledger`).trim();
  const fallbackUsername = safeEmail.split("@")[0] || `user_${safeUserId.slice(0, 8)}`;

  return {
    username: String(username || fallbackUsername).trim().slice(0, 50),
    email: safeEmail.slice(0, 100),
  };
}

async function ensureUser({ userId, username, email }) {
  const userDetails = normalizeUserDetails({ userId, username, email });

  await sql`
    INSERT INTO users (user_id, username, email)
    VALUES (${userId}, ${userDetails.username}, ${userDetails.email})
    ON CONFLICT (user_id) DO UPDATE
    SET
      username = EXCLUDED.username,
      email = EXCLUDED.email
  `;
}

async function ensureCategory({ userId, category, categoryId, icon }) {
  if (categoryId) {
    const categories = await sql`
      SELECT category_id, icon
      FROM categories
      WHERE category_id = ${categoryId} AND user_id = ${userId}
    `;

    if (categories.length > 0) {
      return categories[0].category_id;
    }
  }

  const existingCategories = await sql`
    SELECT category_id, icon
    FROM categories
    WHERE user_id = ${userId} AND category = ${category}
    LIMIT 1
  `;

  if (existingCategories.length > 0) {
    return existingCategories[0].category_id;
  }

  const generatedCategoryId = categoryId || `cat_${crypto.randomUUID()}`;
  const normalizedIcon = String(icon || DEFAULT_CATEGORY_ICON).trim();

  await sql`
    INSERT INTO categories (category_id, category, user_id, icon)
    VALUES (${generatedCategoryId}, ${category}, ${userId}, ${normalizedIcon})
  `;

  return generatedCategoryId;
}

export async function getTransactionsByUserId(req, res) {
  try {
    const { userId } = req.params;
    const { 
      startDate, 
      endDate, 
      categories, 
      minAmount, 
      maxAmount, 
      search, 
      type 
    } = req.query;

    console.log(`Fetching transactions for user: ${userId} with filters:`, req.query);

    const transactions = await sql`
      SELECT *
      FROM transaction_details
      WHERE user_id = ${userId}
      ${startDate ? sql`AND date >= ${startDate}` : sql``}
      ${endDate ? sql`AND date <= ${endDate}` : sql``}
      ${categories ? sql`AND category = ANY(${categories.split(',').map(c => c.trim())})` : sql``}
      ${minAmount ? sql`AND ABS(amount) >= ${minAmount}` : sql``}
      ${maxAmount ? sql`AND ABS(amount) <= ${maxAmount}` : sql``}
      ${search ? sql`AND (description ILIKE ${`%${search}%`} OR category ILIKE ${`%${search}%`})` : sql``}
      ${type ? sql`AND type = ${type}` : sql``}
      ORDER BY date DESC, transaction_id DESC
    `;

    console.log(`Successfully fetched ${transactions.length} transactions.`);
    res.status(200).json(transactions);
  } catch (error) {
    console.log("Error getting the transactions:", error);
    res.status(500).json({ 
      message: "Internal server error", 
      error: error.message 
    });
  }
}

export async function createTransaction(req, res) {
  try {
    const {
      transaction_id,
      user_id,
      category_id,
      amount,
      date,
      description,
      title,
      type,
      category,
      category_icon,
      username,
      email,
      user_email,
    } = req.body;

    if (!user_id || amount === undefined || (!description && !title) || !category) {
      return res.status(400).json({
        message: "user_id, amount, category and title/description are required.",
      });
    }

    const parsedAmount = Number.parseFloat(amount);

    if (Number.isNaN(parsedAmount) || parsedAmount === 0) {
      return res.status(400).json({ message: "Amount must be a non-zero number." });
    }

    const normalizedType = type || (parsedAmount < 0 ? "Expense" : "Income");
    const normalizedAmount = Math.abs(parsedAmount).toFixed(2);
    const normalizedDescription = String(description || title).trim().slice(0, 250);
    const normalizedDate = date || new Date().toISOString().slice(0, 10);
    const normalizedCategory = String(category).trim().slice(0, 50);
    const normalizedTransactionId = transaction_id || `txn_${crypto.randomUUID()}`;

    if (!["Income", "Expense"].includes(normalizedType)) {
      return res.status(400).json({ message: "Type must be Income or Expense." });
    }

    await ensureUser({
      userId: user_id,
      username,
      email: email || user_email,
    });

    const normalizedCategoryId = await ensureCategory({
      userId: user_id,
      category: normalizedCategory,
      categoryId: category_id,
      icon: category_icon,
    });

    await sql`
      INSERT INTO transactions (
        transaction_id,
        user_id,
        category_id,
        amount,
        date,
        description,
        type
      )
      VALUES (
        ${normalizedTransactionId},
        ${user_id},
        ${normalizedCategoryId},
        ${normalizedAmount},
        ${normalizedDate},
        ${normalizedDescription},
        ${normalizedType}
      )
    `;

    const createdTransactions = await sql`
      SELECT *
      FROM transaction_details
      WHERE transaction_id = ${normalizedTransactionId}
    `;

    res.status(201).json(createdTransactions[0]);
  } catch (error) {
    console.log("Error creating the transation:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function deleteTransaction(req, res) {
  try {
    const { id } = req.params;
    const result = await sql`
      DELETE FROM transactions
      WHERE transaction_id = ${id}
      RETURNING transaction_id
    `;

    if (result.length === 0) {
      return res.status(404).json({ message: "Transaction not found." });
    }

    res.status(200).json({ message: "Transaction deleted succesfully." });
  } catch (error) {
    console.log("Error deleting the transation:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getSummaryByUserId(req, res) {
  try {
    const { userId } = req.params;
    const { 
      startDate, 
      endDate, 
      categories, 
      minAmount, 
      maxAmount, 
      search, 
      type 
    } = req.query;

    console.log(`Calculating summary for user: ${userId} with filters:`, req.query);

    const summaryResult = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'Income' THEN ABS(amount) ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'Expense' THEN ABS(amount) ELSE 0 END), 0) AS expenses,
        COALESCE(SUM(amount), 0) AS balance
      FROM transaction_details
      WHERE user_id = ${userId}
      ${startDate ? sql`AND date >= ${startDate}` : sql``}
      ${endDate ? sql`AND date <= ${endDate}` : sql``}
      ${categories ? sql`AND category = ANY(${categories.split(',').map(c => c.trim())})` : sql``}
      ${minAmount ? sql`AND ABS(amount) >= ${minAmount}` : sql``}
      ${maxAmount ? sql`AND ABS(amount) <= ${maxAmount}` : sql``}
      ${search ? sql`AND (description ILIKE ${`%${search}%`} OR category ILIKE ${`%${search}%`})` : sql``}
      ${type ? sql`AND type = ${type}` : sql``}
    `;
    
    // Fallback to zero values if no result is returned
    const finalSummary = summaryResult[0] || { 
      income: 0, 
      expenses: 0, 
      balance: 0 
    };

    console.log(`Summary calculated:`, finalSummary);
    res.status(200).json(finalSummary);
  } catch (error) {
    console.log("Error getting the transaction summary:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error.message
    });
  }
}
