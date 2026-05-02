# FinTrack — Personal Finance Tracker

A self-hosted personal finance app that runs entirely on your machine. Import your bank statements, track spending across accounts, visualize investments, and manage budgets — with all data stored locally in SQLite. Nothing leaves your computer.

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript) ![SQLite](https://img.shields.io/badge/SQLite-local-003B57?logo=sqlite) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Dashboard** — Monthly income vs. expenses, top spending categories, net worth trend, and automatic spending anomaly alerts (flags categories that spike vs. your 6-month average)
- **Transactions** — Full-text search across description, merchant, and category; date range filters; income/expense toggle; filtered totals
- **Roj-Med (Khata view)** — Traditional Gujarati daily ledger with Udhar / Jama / Baki columns and running balance anchored to real account balances
- **Accounts** — Manage checking, savings, credit, and investment accounts with inline balance editing
- **Card Breakdown** — Per-account spending analytics with monthly stacked bar charts
- **Investment Breakdown** — Platform-by-platform investment tracker (Robinhood, Apple GS Savings, DUB) with cumulative growth chart and consistency heatmap
- **Budgets** — Set monthly/yearly category budgets with live progress bars
- **Smart Upload** — Import CSV and PDF bank statements with automatic category inference (50+ keyword rules, deduplication across re-uploads)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Charts | Recharts (ComposedChart, AreaChart, PieChart) |
| Animations | Framer Motion |
| Backend | Express 5, TypeScript, tsx |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| State | TanStack Query v5 |

---

## Getting Started

### Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm** (comes with Node)

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/mitesh2205/fintrack.git
cd fintrack

# 2. Install dependencies
npm install

# 3. Create the database
npm run db:push

# 4. Start the development server
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

> The app runs on a single port — the Express server serves both the API and the React frontend.

---

## Importing Your Transactions

1. Go to **Upload** in the sidebar
2. Select the account the statement belongs to (create it first under **Accounts** if needed)
3. Upload a CSV or PDF bank statement

**Supported formats out of the box:**
- Chase Bank (checking CSV)
- Bank of America (checking CSV)
- Apple Card (CSV)
- Most banks that export standard CSV (Date, Description, Amount columns)
- PDF statements (text-based, not scanned images)

Re-uploading the same file is safe — the deduplication engine skips already-imported transactions while still allowing legitimate duplicate charges (e.g., two identical charges on the same day).

---

## Setting Account Balances

For the Roj-Med (Khata) view to show accurate running balances:

1. Go to **Accounts**
2. Click the pencil icon next to "Current Balance" on any checking or savings account
3. Enter your real balance and press Enter

This anchors the Baki column to your actual account balance.

---

## Project Structure

```
fintrack/
├── client/              # React frontend
│   └── src/
│       ├── pages/       # Dashboard, Transactions, Accounts, etc.
│       ├── components/  # AppShell, shadcn UI components
│       └── lib/         # Query client, utilities
├── server/              # Express backend
│   ├── index.ts         # Server entry point
│   ├── routes.ts        # All API endpoints
│   ├── storage.ts       # Drizzle ORM data layer
│   └── parsers.ts       # CSV/PDF parser + category inference
├── shared/
│   └── schema.ts        # Drizzle schema (accounts, transactions, budgets)
└── drizzle.config.ts    # DB config
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (frontend + backend on port 5000) |
| `npm run build` | Build for production |
| `npm start` | Run the production build |
| `npm run db:push` | Apply schema changes to SQLite |
| `npm run check` | TypeScript type check |

---

## Data & Privacy

All data is stored in `data.db` (SQLite) on your local machine. Nothing is sent to any server or third party. The `.gitignore` explicitly excludes `data.db` so your financial data is never accidentally committed to version control.

---

## Production Build

```bash
npm run build
npm start
```

The build outputs a single `dist/index.cjs` file that bundles the server and serves the compiled frontend as static assets.

---

## License

MIT — free to use, modify, and self-host.
