import crypto from "crypto";
import { sql } from "../config/db.js";

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

export async function getTagsByUserId(req, res) {
  try {
    const { userId } = req.params;

    const tags = await sql`
      SELECT
        tg.tag_id,
        tg.tag_name,
        tg.color,
        COUNT(tt.transaction_id)::INT AS transaction_count
      FROM tags tg
      LEFT JOIN transaction_tags tt ON tt.tag_id = tg.tag_id
      WHERE tg.user_id = ${userId}
      GROUP BY tg.tag_id, tg.tag_name, tg.color
      ORDER BY LOWER(tg.tag_name) ASC
    `;

    res.status(200).json(tags);
  } catch (error) {
    console.log("Error getting the tags:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function createTag(req, res) {
  try {
    const { user_id, tag_name, color, username, email, user_email } = req.body;

    if (!user_id || !tag_name?.trim()) {
      return res.status(400).json({ message: "user_id and tag_name are required." });
    }

    const normalizedTagName = String(tag_name).trim().slice(0, 50);
    const normalizedColor = String(color || "#3b82f6").trim().slice(0, 7);

    await ensureUser({
      userId: user_id,
      username,
      email: email || user_email,
    });

    const existingTags = await sql`
      SELECT tag_id, tag_name, color
      FROM tags
      WHERE user_id = ${user_id} AND LOWER(tag_name) = LOWER(${normalizedTagName})
      LIMIT 1
    `;

    if (existingTags.length > 0) {
      return res.status(409).json({ message: "Tag already exists." });
    }

    const tagId = `tag_${crypto.randomUUID()}`;

    await sql`
      INSERT INTO tags (tag_id, tag_name, color, user_id)
      VALUES (${tagId}, ${normalizedTagName}, ${normalizedColor}, ${user_id})
    `;

    res.status(201).json({
      tag_id: tagId,
      tag_name: normalizedTagName,
      color: normalizedColor,
      transaction_count: 0,
    });
  } catch (error) {
    console.log("Error creating the tag:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function deleteTag(req, res) {
  try {
    const { tagId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "userId query parameter is required." });
    }

    const deletedTags = await sql`
      DELETE FROM tags
      WHERE tag_id = ${tagId} AND user_id = ${userId}
      RETURNING tag_id
    `;

    if (deletedTags.length === 0) {
      return res.status(404).json({ message: "Tag not found." });
    }

    res.status(200).json({ message: "Tag deleted successfully." });
  } catch (error) {
    console.log("Error deleting the tag:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function editTag(req, res) {
  try {
    const { tagId } = req.params;
    const { user_id, tag_name, color } = req.body;

    if (!user_id || !tag_name?.trim()) {
      return res.status(400).json({ message: "user_id and tag_name are required." });
    }

    const normalizedTagName = String(tag_name).trim().slice(0, 50);
    const normalizedColor = String(color || "#3b82f6").trim().slice(0, 7);

    const existingTags = await sql`
      SELECT tag_id
      FROM tags
      WHERE user_id = ${user_id} AND LOWER(tag_name) = LOWER(${normalizedTagName}) AND tag_id != ${tagId}
      LIMIT 1
    `;

    if (existingTags.length > 0) {
      return res.status(409).json({ message: "A tag with this name already exists." });
    }

    const updatedTags = await sql`
      UPDATE tags
      SET tag_name = ${normalizedTagName}, color = ${normalizedColor}
      WHERE tag_id = ${tagId} AND user_id = ${user_id}
      RETURNING tag_id, tag_name, color
    `;

    if (updatedTags.length === 0) {
      return res.status(404).json({ message: "Tag not found." });
    }

    // Get current transaction count to return the full object shape
    const countQuery = await sql`
      SELECT COUNT(transaction_id)::INT AS transaction_count
      FROM transaction_tags
      WHERE tag_id = ${tagId}
    `;

    res.status(200).json({
      ...updatedTags[0],
      transaction_count: countQuery[0].transaction_count
    });
  } catch (error) {
    console.log("Error updating the tag:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

