# AgriCredit Backend

Production-style Node.js API for the AgriCredit hackathon: farmers request credit, admins approve and disburse to **vendors**, vendors confirm delivery, farmers repay via M-Pesa (sandbox + simulated fallback).

## Stack

- Node.js (ESM), Express.js  
- Prisma ORM + MongoDB  
- JWT + bcryptjs  
- M-Pesa Daraja sandbox (optional; falls back to simulated success)  

## Setup

1. **MongoDB** — Create a cluster on [MongoDB Atlas](https://www.mongodb.com/atlas) (or run MongoDB locally).

2. **Environment**

   ```bash
   cd backend
   cp .env.example .env
   ```

   Set `DATABASE_URL` and a strong `JWT_SECRET`.

3. **Install & database**

   This repo includes **`.npmrc`** with `ignore-scripts=true` so `npm install` does **not** run `@prisma/client`’s postinstall (that step often triggers **EPERM** on Windows / OneDrive under `node_modules\.prisma`). You **must** generate the client yourself:

   ```bash
   cd backend
   npm install
   npm run generate
   npx prisma db push
   ```

   One-liner (fresh `node_modules`): **`npm run setup`** (= `npm install` + `npm run generate`).

4. **Seed demo data** (admin, farmers, vendors, groups, sample loans)

   ```bash
   npm run seed
   ```

5. **Run**

   ```bash
   node index.js
   ```

   API default: `http://localhost:4000`  
   Health: `GET /health`

### Windows: `EPERM` / `rename` on `query_engine-windows.dll.node`

**`.npmrc`** disables install scripts so `@prisma/client` no longer auto-runs `prisma generate` into `node_modules\.prisma`. Always run **`npm run generate`** after **`npm install`**.

If `npm run generate` still fails: confirm **`prisma/schema.prisma`** has `output = "./generated/client"`, stop all `node` processes, pause OneDrive for this folder, or clone outside OneDrive (e.g. `C:\dev\agricredit-platform`).

## Demo accounts (after seed)

| Role   | Phone         | Password  |
|--------|---------------|-----------|
| Admin  | 254700000001  | Demo123!  |
| Farmer | 254700000010–014 | Demo123! |
| Vendor | 254710000001–002 | Demo123! |

## API overview

All protected routes need:

```http
Authorization: Bearer <JWT>
```

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Farmer register (`name`, `phone`, `nationalId` 12 digits, `password`) |
| POST | `/auth/login` | `phone`, `password` → JWT |

### Farmer (`role: user`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/loan/request` | `amount`, `purpose` — auto credit decision; blocks if active loan exists |
| POST | `/loan/select-vendor` | `loanId`, `vendorId` — approved loans only |
| GET | `/user/loans` | Own loans |
| GET | `/vendors` | Verified vendors |
| POST | `/mpesa/repay` | `loanId`, `amount` — **delivered** loans only; full repay → +20 credit |

### Admin (`role: admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/loans` | All loans |
| POST | `/admin/loan/:id/approve` | Pending → approved; sets `dueDate` +3 months |
| POST | `/admin/loan/:id/reject` | Body: optional `reason` |
| POST | `/admin/loan/:id/disburse` | M-Pesa to vendor wallet; status → `disbursed` |
| POST | `/admin/vendors` | Create vendor user + profile (`name`, `phone`, `walletNumber`, `password`) |
| GET | `/admin/vendors` | All vendors |
| GET | `/admin/stats` | Counts |

### Vendor (`role: vendor`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/vendor/loans` | Loans assigned to this vendor only |
| POST | `/vendor/loan/:id/confirm-delivery` | `disbursed` → `delivered` (ownership validated) |

## Business rules (summary)

- **National ID**: exactly 12 digits; unique with phone.  
- **One active loan**: cannot request if status is `pending`, `approved`, `disbursed`, or `delivered`.  
- **Credit at request**: `<50` rejected; `50–70` pending; `>70` auto-`approved` with `dueDate` +3 months.  
- **Ownership**: farmers see only their loans; vendors only assigned loans; admin sees all.  
- **Repayment**: M-Pesa call is attempted; on failure, **simulated success** still logs a `Transaction` row.  
- **SMS demo**: check server console for simulated SMS on approve, disburse, full repay.  

## Example flow (curl)

Replace `TOKEN` after login.

```bash
# Login (farmer)
curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"254700000012\",\"password\":\"Demo123!\"}"

# Request loan
curl -s -X POST http://localhost:4000/loan/request \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d "{\"amount\":5000,\"purpose\":\"Seeds\"}"
```

## Project layout

```
backend/
  index.js
  controllers/
  routes/
  services/        # mpesaService, creditService, group assignment, SMS sim
  middleware/      # auth, role, validation, errorHandler
  prisma/schema.prisma
  data/seed.js
  lib/prisma.js
```

## M-Pesa

**Demo / hackathon only** — use the sandbox and Postman-style collections for demonstrations, not production. Live M-Pesa requires proper registration, credentials, and compliance.

Integrated for **Ethiopia sandbox** (`https://apisandbox.safaricom.et`): OAuth `GET /v1/token/generate`, **B2C v2** disbursement, **STK Push v3** repayment (aligned with the official Postman-style collection). If `MPESA_BASE_URL` is set to **Kenya** `https://sandbox.safaricom.co.ke`, the service uses Daraja paths (`/oauth/v1/generate`, B2C v1, STK v1).

**`.env` (see `.env.example`):** `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY` (STK), `MPESA_INITIATOR_NAME`, `MPESA_SECURITY_CREDENTIAL` (B2C), `MPESA_CALLBACK_URL` (and optional `MPESA_RESULT_URL`, `MPESA_QUEUE_TIMEOUT_URL`, `MPESA_STK_CALLBACK_URL`). Use **international MSISDN** without `+` (e.g. `2517…` in ET sandbox).

### Using your Postman STK JSON (push prompt)

- `POST /mpesa/stk/push` forwards the exact STK payload JSON (the same shape as Postman `.../stkpush/v3/processrequest`) and returns the Safaricom response fields (`CheckoutRequestID`, etc).
- It always uses backend OAuth (`MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET`) even if the client sends an `Authorization` header.

### Reusing the Postman JSON inside `/mpesa/repay`

If you want the normal loan repayment endpoint (`POST /mpesa/repay`) to reuse all the fields from your Postman JSON (MerchantRequestID, TransactionDesc, ReferenceData, etc), set:

- `MPESA_STK_PAYLOAD_TEMPLATE_JSON` = your Postman C2B/STK JSON body (as a single JSON string)
- `MPESA_STK_TEMPLATE_KEEP_PASSWORD_TIMESTAMP=true` if you also want to keep the template’s `Password` + `Timestamp` (default is to compute fresh ones from `MPESA_PASSKEY`)

`/mpesa/repay` will still override the dynamic values per request: `Amount`, `PartyA`, `PhoneNumber`, `CallBackURL`, and `AccountReference` (unique reference used to finalize repayment on callback).

If the sandbox call fails or keys are missing, the API still returns success for demos and **records** `Transaction` rows.
