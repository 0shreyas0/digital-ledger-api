import { neon } from "@neondatabase/serverless";
import "dotenv/config";

export const sql = neon(process.env.DATABASE_URL);

export async function initDB() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS categories (
        category_id VARCHAR(50) PRIMARY KEY,
        category VARCHAR(50) NOT NULL,
        user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE
      )
    `;

    await sql`
      ALTER TABLE categories
      ADD COLUMN IF NOT EXISTS icon VARCHAR(50) NOT NULL DEFAULT 'pricetag-outline'
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS categories_user_id_category_key
      ON categories (user_id, category)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        transaction_id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        category_id VARCHAR(50) NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        date DATE NOT NULL,
        description VARCHAR(250) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('Income', 'Expense'))
      )
    `;

    await sql`
      CREATE OR REPLACE VIEW transaction_details AS
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
    `;

    await sql`
      CREATE OR REPLACE VIEW user_summaries AS
      SELECT
        user_id,
        COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type = 'Expense' THEN amount ELSE 0 END), 0) AS total_expenses,
        COALESCE(SUM(CASE WHEN type = 'Income' THEN amount ELSE -amount END), 0) AS total_balance
      FROM transactions
      GROUP BY user_id
    `;

    console.log("Database initialised successfully.");
  } catch (error) {
    console.log("Error initialising DB", error);
    process.exit(1);
  }
}
