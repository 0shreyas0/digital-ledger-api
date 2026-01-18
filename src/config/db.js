import {neon} from "@neondatabase/serverless"

import "dotenv/config";

// Creates SQL connection using our DB URL
export const sql = neon(process.env.DATABASE_URL);

export async function initDB() {
    try {
        await sql`CREATE TABLE IF NOT EXISTS Transactions(
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            amount DECIMAL(10, 2) NOT NULL,
            category VARCHAR(255) NOT NULL,
            created_at DATE NOT NULL DEFAULT CURRENT_DATE
        )`;
    // here DECIMAL(10,2) means fixed point no. with 10 digits total, 2 digits after the decimal point
    // so 99999999.99 is the max value (eight 9s then decimal poit then two 9s)
    console.log("Database initialised successfully.");

    } catch (error) {
        console.log("Error initialising DB", error);
        process.exit(1); // status code 1 means failure and 0 means success
    }
}