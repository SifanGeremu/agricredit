# AgriCredit Platform

**AgriCredit** is a full-stack agricultural fintech demo that connects **farmers**, **verified input vendors**, and **administrators** in one credit workflow: loan request → approval → **M-Pesa** disbursement to the vendor → delivery confirmation → **M-Pesa STK** repayment by the farmer—with credit scoring and group-level signals built in.

This project was built for **East Ethiopia’s largest Cursor hackathon**—a showcase of what teams can ship fast with **Cursor**, modern JavaScript tooling, and real-world integrations (Safaricom Ethiopia sandbox APIs).

---

## Why AgriCredit?

Smallholder farmers need affordable inputs (seed, fertilizer, tools) paid **directly to trusted vendors**, not as cash in hand. AgriCredit models that flow: money moves through the platform to suppliers, farmers receive goods, then repay through mobile money—so repayment capacity ties back to real agricultural use of credit.

---

## Features

| Area | What you get |
|------|----------------|
| **Roles** | Farmers, vendors, admins—JWT auth, role-based routes |
| **Loans** | Request, approve/reject, vendor selection, status pipeline |
| **M-Pesa (Ethiopia sandbox)** | STK push for repayment, B2C-style disburse to vendor wallet—aligned with Postman-style `apisandbox.safaricom.et` flows |
| **Repayment UX** | Farmer enters **M-Pesa phone** (same as Postman `PhoneNumber` / `PartyA`); optional mock mode for demos without live API calls |
| **Credit & groups** | Credit score updates on full repayment; group membership and performance signals |
| **Notifications** | In-app notifications for key events |

---

## Tech stack

| Layer | Technology |
|--------|------------|
| **Frontend** | React 19, Vite 6, TypeScript, Tailwind CSS v4, React Router, Motion |
| **Backend** | Node.js 18+, Express 4, JWT, express-validator |
| **Database** | MongoDB with **Prisma** ORM |
| **Payments** | Safaricom Ethiopia sandbox (configurable; Kenya Daraja URL supported in code paths) |

---

## Repository layout

```
agricredit-platform/
├── backend/          # REST API (Express + Prisma)
│   ├── prisma/       # Schema & Prisma client output
│   ├── controllers/
│   ├── routes/
│   ├── services/     # M-Pesa, credit, SMS simulator, etc.
│   └── data/seed.js  # Demo users + sample loan
├── frontend/         # Vite + React SPA
└── README.md         # You are here
```

---

## Prerequisites

- **Node.js** ≥ 18  
- **MongoDB** accessible via `DATABASE_URL`  
  - For local Prisma transactions, use a **replica set** (see `backend/.env.example` comments).  
- **npm** (or pnpm/yarn) for installs  

---

## Quick start

### 1. Clone and install

```bash
git clone <your-repo-url> agricredit-platform
cd agricredit-platform
```

**Backend**

```bash
cd backend
npm install
npm run generate
```

Copy env and fill secrets:

```bash
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET, M-Pesa sandbox keys (see backend/.env.example)
```

**Frontend**

```bash
cd ../frontend
npm install
cp .env.example .env
# VITE_API_URL defaults to http://localhost:4000
```

### 2. Database

Push the Prisma schema to MongoDB (from `backend/`):

```bash
npx prisma db push
```

### 3. Seed demo data

```bash
cd backend
npm run seed
```

### 4. Run

**Terminal A — API**

```bash
cd backend
npm run dev
# → http://localhost:4000  (see GET /health)
```

**Terminal B — UI**

```bash
cd frontend
npm run dev
# → http://localhost:3000
```

---

## Demo accounts

After `npm run seed`, every demo user uses the same password: **`demo1234`**

| Role | Phone | Notes |
|------|--------|--------|
| **Admin** | `1111111111` | Approves loans, disburses to vendor |
| **Vendor** | `2222222222` | Catalog, confirm delivery |
| **Farmer** | `3333333333` | Seeded with a **Delivered** loan for repayment demo |

More detail: `backend/TEST_LOGINS.txt`.

---

## M-Pesa configuration (summary)

All variables live in **`backend/.env`** (see **`backend/.env.example`**).

- **`MPESA_MOCK_MODE`** — `true` = no HTTP to Safaricom (Postman-shaped success for UI demos). `false` = real sandbox calls.  
- **`MPESA_STK_ALLOW_PHONE_MISMATCH`** — useful when demo login phones differ from your sandbox-registered **251…** SIM.  
- **Repayment body** — `POST /mpesa/repay` accepts `{ loanId, amount, phone? }`; `phone` drives STK **PartyA** / **PhoneNumber** when set.  
- **Callbacks** — configure `MPESA_STK_CALLBACK_URL` (and related URLs) in the developer portal; use **webhook.site** or your HTTPS URL for sandbox testing.  

**Disclaimer:** Sandbox credentials and flows are for **development and hackathon demos only**. Do not use default secrets in production; add compliance and security review before any real-money deployment.

---

## API overview

| Prefix | Purpose |
|--------|---------|
| `/auth` | Register, login |
| `/loan` | Loan request, vendor selection |
| `/user` | Farmer loans, catalog, group |
| `/vendors` | Browse vendors (farmer) |
| `/admin` | Loans, farmers, vendors, groups, disburse |
| `/vendor` | Vendor loans, products, delivery confirmation |
| `/mpesa` | Repay (STK), STK webhook, dev confirm (non-prod) |
| `/notifications` | User notifications |

Root **`GET /`** and **`GET /health`** confirm the API is up.

---

## Hackathon & Cursor

This codebase was created for **East Ethiopia’s biggest Cursor hackathon**—highlighting rapid iteration with **Cursor** on a realistic fintech vertical: **agricultural credit** and **mobile money** in the Ethiopian context. If you extend the project, keep env files out of git, rotate any exposed keys, and treat payment integrations as **sandbox-first**.

---

## Scripts reference

| Location | Command | Purpose |
|----------|---------|---------|
| `backend/` | `npm run dev` | Start API |
| `backend/` | `npm run seed` | Reset demo data |
| `backend/` | `npm run generate` | Prisma client |
| `frontend/` | `npm run dev` | Vite dev server (port 3000) |
| `frontend/` | `npm run build` | Production build |



---

**AgriCredit** — *Credit that reaches the soil.*
