# FinTrack — Feature Build Tracker

> Three features. Pakko Gujarati edition. Every rupee with a destination, no surprises.

---

## Status Legend
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done

---

## Feature 1 — Recurring Detection + Subscription Audit
> Auto-detect fixed monthly outflows. Know your floor. Kill the leaks.

**Page:** `/subscriptions` — "Fixed Costs" in nav

### How it works
- Group transactions by normalized merchant name
- Flag as recurring if: appears in 2+ distinct months, amount is consistent (±10%), interval ~30 days
- Rank by annualized cost (monthly × 12)
- Show: name, amount, last charged, next expected, annualized cost, months detected
- Highlight: charges that increased vs prior period

### Parts
- [ ] **1A** — Server: `/api/analytics/recurring` endpoint (detect + score recurring transactions)
- [ ] **1B** — Client: `Subscriptions.tsx` page (audit table, sorted by annual cost)
- [ ] **1C** — Wire: Add "Fixed Costs" to AppShell nav + route in App.tsx

---

## Feature 2 — Goal Buckets
> Every rupee with a destination. Down payment. Diwali gold. India trip. Parents' medical.

**Page:** `/goals` — "Goals" in nav

### How it works
- New `goals` table in DB: name, targetAmount, savedAmount, deadline, icon, color
- Monthly contribution needed = (target - saved) / months remaining
- Progress bar + months-to-go countdown
- Add/Edit/Delete goals via modal
- Manual "add savings" button to mark money saved toward a goal

### Parts
- [ ] **2A** — Schema: Add `goals` table to `shared/schema.ts`, run `db:push`
- [ ] **2B** — Storage: Add Goals CRUD to `IStorage`, `DrizzleStorage`, `MemStorage`
- [ ] **2C** — Routes: GET / POST / PATCH / DELETE `/api/goals`
- [ ] **2D** — Client: `Goals.tsx` page (goal cards, progress, add/edit modal)
- [ ] **2E** — Wire: Add "Goals" to AppShell nav + route in App.tsx

---

## Feature 3 — Cash Flow Forecast
> See your money before it moves. 30 / 60 / 90 day projection per account.

**Page:** `/forecast` — "Forecast" in nav  
**Also:** Widget on Dashboard (next 30 days, compact)

### How it works
- Pull recurring transactions detected by Feature 1
- Seed with current account balances (already stored)
- Walk forward day by day: add expected income events, subtract expected expense events
- Show projected balance curve per account
- Flag any day where balance dips below a safe floor ($500 default, configurable)
- Color bands: green (safe), amber (watch), red (danger)

### Parts
- [ ] **3A** — Server: `/api/analytics/cashflow?days=90` endpoint (recurring → projected events → daily balances)
- [ ] **3B** — Client: `Forecast.tsx` page (area chart with danger zones, event timeline below)
- [ ] **3C** — Dashboard: Add compact 30-day forecast card between KPIs and Spending Signals
- [ ] **3D** — Wire: Add "Forecast" to AppShell nav + route in App.tsx

---

## Build Order
```
1A → 1B → 1C   (Recurring/Subscriptions — standalone, no deps)
2A → 2B → 2C → 2D → 2E   (Goals — standalone)
3A → 3B → 3C → 3D   (Forecast — uses recurring data from Feature 1)
```

Features 1 and 2 can run in parallel. Feature 3 starts after 1A is done.

---

*Last updated: May 2026*
