import crypto from "crypto";
import { sql } from "../config/db.js";

const ALLOWED_CATEGORY_ICONS = new Set([
  "pricetag-outline",
  "fast-food-outline",
  "cart-outline",
  "car-outline",
  "film-outline",
  "receipt-outline",
  "cash-outline",
  "fitness-outline",
  "airplane-outline",
  "home-outline",
  "medical-outline",
  "school-outline",
  "gift-outline",
  "basket-outline",
  "phone-portrait-outline",
  "shirt-outline",
]);

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

function normalizeIcon(icon) {
  const normalizedIcon = String(icon || DEFAULT_CATEGORY_ICON).trim();
  return ALLOWED_CATEGORY_ICONS.has(normalizedIcon)
    ? normalizedIcon
    : DEFAULT_CATEGORY_ICON;
}

export async function getCategoriesByUserId(req, res) {
  try {
    const { userId } = req.params;

    const categories = await sql`
      SELECT
        c.category_id,
        c.category,
        c.icon,
        COUNT(t.transaction_id)::INT AS transaction_count
      FROM categories c
      LEFT JOIN transactions t ON t.category_id = c.category_id
      WHERE c.user_id = ${userId}
      GROUP BY c.category_id, c.category, c.icon
      ORDER BY LOWER(c.category) ASC
    `;

    res.status(200).json(categories);
  } catch (error) {
    console.log("Error getting the categories:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function createCategory(req, res) {
  try {
    const { user_id, category, icon, username, email, user_email } = req.body;

    if (!user_id || !category?.trim()) {
      return res.status(400).json({ message: "user_id and category are required." });
    }

    const normalizedCategory = String(category).trim().slice(0, 50);
    const normalizedIcon = normalizeIcon(icon);

    await ensureUser({
      userId: user_id,
      username,
      email: email || user_email,
    });

    const existingCategories = await sql`
      SELECT category_id, category, icon
      FROM categories
      WHERE user_id = ${user_id} AND LOWER(category) = LOWER(${normalizedCategory})
      LIMIT 1
    `;

    if (existingCategories.length > 0) {
      return res.status(409).json({ message: "Category already exists." });
    }

    const categoryId = `cat_${crypto.randomUUID()}`;

    await sql`
      INSERT INTO categories (category_id, category, user_id, icon)
      VALUES (${categoryId}, ${normalizedCategory}, ${user_id}, ${normalizedIcon})
    `;

    res.status(201).json({
      category_id: categoryId,
      category: normalizedCategory,
      icon: normalizedIcon,
      transaction_count: 0,
    });
  } catch (error) {
    console.log("Error creating the category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function deleteCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "userId query parameter is required." });
    }

    const usedCategories = await sql`
      SELECT COUNT(*)::INT AS transaction_count
      FROM transactions
      WHERE category_id = ${categoryId} AND user_id = ${userId}
    `;

    if (usedCategories[0]?.transaction_count > 0) {
      return res.status(409).json({
        message: "Cannot delete category with existing transactions.",
      });
    }

    const deletedCategories = await sql`
      DELETE FROM categories
      WHERE category_id = ${categoryId} AND user_id = ${userId}
      RETURNING category_id
    `;

    if (deletedCategories.length === 0) {
      return res.status(404).json({ message: "Category not found." });
    }

    res.status(200).json({ message: "Category deleted successfully." });
  } catch (error) {
    console.log("Error deleting the category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
