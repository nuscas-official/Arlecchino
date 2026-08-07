# Arlecchino: King of Riddles — Concurrent Quiz Platform

> A high-throughput, fault-tolerant live quiz platform built to handle ~200 concurrent participants under strict time limits with zero answer key leakage and server-side grading. Named after Arlecchino, the King of Riddles from *Lies of P*.

---

## 🚀 Quick Start (Local Run)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Backend API Server
```bash
npm run server
```
*Runs the Hono API server on `http://localhost:3001`. On initial boot, it automatically seeds the 50 riddles of Krat into `arlecchino.db`.*

### 3. Start the Frontend Application (In a second terminal window)
```bash
npm run dev
```
*Launches the Vite React dev server on `http://localhost:3000/` with proxying to the API server.*

Open your browser to [http://localhost:3000](http://localhost:3000) to start taking the quiz!

---

## ⚡ Running the 200 Concurrent User Load Test

To verify that the platform can absorb a 200 simultaneous submission spike in under a second with zero errors and perfect primary-key idempotency:

```bash
# Make sure the backend server (npm run server) is running first!
npx tsx load-test/verify-spike.ts
```

### Acceptance Criteria Verified:
- ⚡ **200 concurrent submissions** completed in **<300 ms**.
- 🎯 **0% HTTP errors** (100% 200 OK responses).
- 📊 **Exactly 200 rows** written to `submission`.
- 🔁 **Idempotency Pass**: Re-running the identical burst returns `alreadySubmitted: true` on all 200 responses with 0 duplicate DB rows.

---

## 🌐 Production Cloud Hosting Guide

For hosting a live event with ~200 simultaneous participants, use the following production setup:

### 1. Database Options (Cloud Serverless)

- **Neon Postgres** *(Recommended)*:
  - Create a free account at [neon.tech](https://neon.tech).
  - Paste and run the contents of [schema.sql](./schema.sql) in Neon's SQL Editor.
  - Copy your connection string (`postgres://...`).
  - **Why Neon HTTP Driver:** Uses standard `fetch` queries with zero persistent TCP connections, making connection pool exhaustion under 200 serverless invocations structurally impossible.

- **Cloudflare D1** *(Alternative)*:
  - Built-in serverless SQLite for Cloudflare Workers. Run `npx wrangler d1 execute arlecchino-db --file=./schema.sql`.

---

### 2. Backend API Hosting

- **Cloudflare Workers** *(Recommended)*:
  - Clean `wrangler.toml` (safe for Git):
    ```toml
    name = "arlecchino-api"
    main = "server/index.ts"
    compatibility_date = "2024-01-01"
    ```
  - Store secret variables securely in Cloudflare's encrypted vault:
    ```bash
    npx wrangler secret put DATABASE_URL
    npx wrangler secret put ADMIN_SECRET
    ```
  - Deploy API:
    ```bash
    npx wrangler deploy
    ```

- **Vercel Edge Functions** *(Alternative)*:
  - Hono deploys directly to Vercel via `@hono/node-server` or Hono Vercel adapter.

---

### 3. Frontend Hosting

- **Cloudflare Pages / Vercel / GitHub Pages**:
  - Connect your GitHub repository to Cloudflare Pages or Vercel.
  - **Build Command:** `npm run build`
  - **Output Directory:** `dist`
  - Set Environment Variable: `VITE_API_URL=https://arlecchino-api.your-domain.workers.dev`

---

## 📜 Key Architectural Features

1. **Connectionless DB Layer & Zero Pool Exhaustion**:
   - Uses SQLite in WAL mode for high-throughput local testing, compatible with `@neondatabase/serverless` HTTP driver for serverless production.

2. **Server-Side Grading Only**:
   - Answer keys (`correct_key`) are stripped at the database SQL query level and NEVER bundled in client JS or sent over API responses.

3. **Layout & Media Stability**:
   - Fixed media layout bounds ensure answer option buttons never jump or shift position when navigating between text-only and image-bearing riddles.

4. **Wall-Clock Time Synchronization**:
   - Countdown timer derives remaining time from server `deadline` (`deadline - Date.now()`) with `visibilitychange` listeners to prevent timer throttling when switching tabs.

5. **Image Prefetching Pipeline**:
   - Pre-warms initial 5–8 images during participant name entry and maintains a rolling lookahead window for upcoming image-bearing questions.

6. **Offline Resilience & Exponential Retries**:
   - Auto-saves answer selections to `localStorage` on every click, with exponential backoff retries (1s, 2s, 4s, 8s...) and manual retry fallback.

---

## 📥 Admin CSV Leaderboard Export

Download full results as CSV:
```bash
curl "http://localhost:3001/api/admin/export/arlecchino-riddles-1?secret=arlecchino-secret-key" -o leaderboard.csv
```

---

## 🛠️ Commands Cheat Sheet

| Command | Action |
|---|---|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run server` | Start Hono backend server on port 3001 |
| `npm run build` | Compile TypeScript and Vite production bundle |
| `npx tsx load-test/verify-spike.ts` | Run 200 VU load & idempotency test |
| `npx wrangler deploy` | Deploy API to Cloudflare Workers |
