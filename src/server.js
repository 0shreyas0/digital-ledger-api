import express from "express";
import dotenv from "dotenv";
import { initDB } from "./config/db.js";
import rateLimiter from "./middleware/rateLimiter.js";

import transactionsRoute from './routes/transactionsRoute.js'

dotenv.config();

const app = express(); // created an express app

// middleware
app.use(rateLimiter);

app.use(express.json());

// our custom simple middleware
// app.use((req, res, next) => {
//     console.log("We hit a req, Heres the method:", req.method);
//     next();

// })

const PORT = process.env.PORT || 5001; // alias the PORT

// app.get("/health-check", (req, res) => {
//     res.send("Its working")
// }) // created a route

app.use("/api/transactions", transactionsRoute);

initDB().then(() => {
    app.listen(PORT, () => {
        console.log("Server is up and running on PORT:", PORT);
    }); // log that
});
