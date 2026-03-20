<div align="center">
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Express.js-API-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/Neon-Postgres-0085FF?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Upstash-Rate_Limit-black?style=for-the-badge&logo=upstash&logoColor=white" />
  <img src="https://img.shields.io/badge/Cron-Keep_Alive-444?style=for-the-badge" />

  <h1>Digital Ledger Backend</h1>
  <p>Express API for transactions, categories, database initialization, and request protection.</p>
</div>

---

<div align="center">
  <table>
    <tr>
      <td align="center"><strong>Runtime</strong><br />Node.js</td>
      <td align="center"><strong>Framework</strong><br />Express</td>
      <td align="center"><strong>Database</strong><br />Neon Postgres</td>
      <td align="center"><strong>Rate Limiting</strong><br />Upstash Redis</td>
    </tr>
  </table>
</div>

## Overview

This directory contains the backend API for Digital Ledger. It initializes the database schema, exposes transaction and category endpoints, applies rate limiting, and runs a scheduled keep-alive request in production.

## Features

- REST API for transactions and categories
- Automatic database table creation at startup
- Neon serverless PostgreSQL integration
- Upstash Redis rate limiting middleware
- Cron-based keep-alive job in production
- Health check endpoint for uptime monitoring

## Tech Stack

- Node.js
- Express `^5.2.1`
- `@neondatabase/serverless`
- `@upstash/redis`
- `@upstash/ratelimit`
- `dotenv`
- `cron`

## Requirements

- Node.js 18+
- npm
- Neon database URL
- Upstash Redis REST URL and token

## Environment Setup

Create `backend/.env`:

```env
PORT=5001
DATABASE_URL=your_neon_postgres_url
UPSTASH_REDIS_REST_URL=your_upstash_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
NODE_ENV=development
API_URL=http://localhost:5001/api/health
```

Notes:

- `DATABASE_URL` is required for startup because the API initializes the schema on boot.
- `API_URL` is used by the cron job in production to ping the server every 14 minutes.
- The current rate limiter uses a shared key for all requests, so all users count against the same limit.

## Run Locally

Install dependencies:

```bash
npm install
```

Start in development:

```bash
npm run dev
```

Start in production mode:

```bash
npm run start
```

Server defaults to:

```text
http://localhost:5001
```

Health check:

```text
GET /api/health
```

## API Routes

### Transactions

- `GET /api/transactions/:userId`
- `GET /api/transactions/summary/:userId`
- `POST /api/transactions`
- `DELETE /api/transactions/:id`

### Categories

- `GET /api/categories/:userId`
- `POST /api/categories`
- `DELETE /api/categories/:categoryId?userId=...`

## Project Structure

```text
src/config/        Database, Upstash, and cron setup
src/controller/    Route handlers and input normalization
src/middleware/    Express middleware
src/routes/        API route definitions
src/server.js      App bootstrap and server startup
```

## Deployment Notes

- Set `NODE_ENV=production` to enable the cron keep-alive job.
- Point `API_URL` to your deployed health endpoint, for example `https://your-api-host/api/health`.
- Keep `DATABASE_URL` and Upstash credentials server-side only.
