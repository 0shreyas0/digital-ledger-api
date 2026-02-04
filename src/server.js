import express from "express";
import dotenv from "dotenv";
import { initDB } from "./config/db.js";
import rateLimiter from "./middleware/rateLimiter.js";

import transactionsRoute from "./routes/transactionsRoute.js";

import job from "./config/cron.js";

dotenv.config();

const app = express(); // created an express app

if (process.env.NODE_ENV === "production") job.start();


import cors from "cors";

// middleware
app.use(cors());
app.use(rateLimiter);

app.use(express.json());

// our custom simple middleware
// app.use((req, res, next) => {
//     console.log("We hit a req, Heres the method:", req.method);
//     next();

// })

const PORT = process.env.PORT || 5001; // alias the PORT

app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok" });
}); // created a route

app.use("/api/transactions", transactionsRoute);

initDB().then(() => {
    app.listen(PORT, () => {
        console.log("Server is up and running on PORT:", PORT);
    }); // log that
});
