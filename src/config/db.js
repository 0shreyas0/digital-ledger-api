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

    console.log("Database initialised successfully.");
  } catch (error) {
    console.log("Error initialising DB", error);
    process.exit(1);
  }
}
