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

    let queryText = `
      SELECT
        t.transaction_id AS id,
        t.transaction_id,
        t.user_id,
        t.category_id,
        t.description AS title,
        t.description,
        c.category,
        c.icon,
        CASE
          WHEN t.type = 'Expense' THEN -t.amount
          ELSE t.amount
        END AS amount,
        t.type,
        t.date AS created_at,
        t.date
      FROM transactions t
      INNER JOIN categories c ON t.category_id = c.category_id
      WHERE t.user_id = $1
    `;

    const params = [userId];
    let paramCount = 1;

    if (startDate) {
      paramCount++;
      queryText += ` AND t.date >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      queryText += ` AND t.date <= $${paramCount}`;
      params.push(endDate);
    }

    if (categories) {
      const categoryList = categories.split(',').map(c => c.trim());
      paramCount++;
      queryText += ` AND c.category = ANY($${paramCount})`;
      params.push(categoryList);
    }

    if (minAmount) {
      paramCount++;
      queryText += ` AND t.amount >= $${paramCount}`;
      params.push(minAmount);
    }

    if (maxAmount) {
      paramCount++;
      queryText += ` AND t.amount <= $${paramCount}`;
      params.push(maxAmount);
    }

    if (search) {
      paramCount++;
      queryText += ` AND (t.description ILIKE $${paramCount} OR c.category ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (type) {
      paramCount++;
      queryText += ` AND t.type = $${paramCount}`;
      params.push(type);
    }

    queryText += ` ORDER BY t.date DESC, t.transaction_id DESC`;

    const transactions = await sql(queryText, params);

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
      SELECT
        t.transaction_id AS id,
        t.transaction_id,
        t.user_id,
        t.category_id,
        t.description AS title,
        t.description,
        c.category,
        c.icon,
        CASE
          WHEN t.type = 'Expense' THEN -t.amount
          ELSE t.amount
        END AS amount,
        t.type,
        t.date AS created_at,
        t.date
      FROM transactions t
      INNER JOIN categories c ON t.category_id = c.category_id
      WHERE t.transaction_id = ${normalizedTransactionId}
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

    let queryText = `
      SELECT
        COALESCE(SUM(CASE WHEN t.type = 'Income' THEN t.amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN t.type = 'Expense' THEN t.amount ELSE 0 END), 0) AS expenses,
        COALESCE(
          SUM(
            CASE
              WHEN t.type = 'Income' THEN t.amount
              ELSE -t.amount
            END
          ),
          0
        ) AS balance
      FROM transactions t
      INNER JOIN categories c ON t.category_id = c.category_id
      WHERE t.user_id = $1
    `;

    const params = [userId];
    let paramCount = 1;

    if (startDate) {
      paramCount++;
      queryText += ` AND t.date >= $${paramCount}`;
      params.push(startDate);
    }
    if (endDate) {
      paramCount++;
      queryText += ` AND t.date <= $${paramCount}`;
      params.push(endDate);
    }
    if (categories) {
      const categoryList = categories.split(',').map(c => c.trim());
      paramCount++;
      queryText += ` AND c.category = ANY($${paramCount})`;
      params.push(categoryList);
    }
    if (minAmount) {
      paramCount++;
      queryText += ` AND t.amount >= $${paramCount}`;
      params.push(minAmount);
    }
    if (maxAmount) {
      paramCount++;
      queryText += ` AND t.amount <= $${paramCount}`;
      params.push(maxAmount);
    }
    if (search) {
      paramCount++;
      queryText += ` AND (t.description ILIKE $${paramCount} OR c.category ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    if (type) {
      paramCount++;
      queryText += ` AND t.type = $${paramCount}`;
      params.push(type);
    }

    const summaryResult = await sql(queryText, params);
    res.status(200).json(summaryResult[0]);
  } catch (error) {
    console.log("Error getting the transaction summary:", error);
    res.status(500).json({ 
      message: "Internal server error",
      error: error.message
    });
  }
}
