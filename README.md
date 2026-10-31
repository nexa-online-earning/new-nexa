# NEXA EARN — Production Full-Stack Application

> **React 19 + TypeScript + Tailwind CSS + Supabase PostgreSQL + Cloudflare Pages & Workers + Android APK**

NEXA EARN is a fintech-grade earning platform built with React, TypeScript, Tailwind CSS, Supabase Auth and PostgreSQL with strict Row Level Security (RLS), Cloudflare Pages & Workers server-authoritative API proxy, and Capacitor Android packaging.

---

## 💎 Architecture & Security Overview

1. **Frontend**: React SPA built with Vite, Tailwind CSS, and mobile-first responsive UX with dark velvet `#070B14` canvas, `#6D28D9` purple brand accents, and `#00C995` emerald/gold highlights.
2. **Database & Auth**: Supabase PostgreSQL with strict Row Level Security (RLS), atomic row-locking (`FOR UPDATE`), and BEFORE UPDATE triggers preventing unauthorized client modification of balances, spins, roles, or tiers.
3. **Cloudflare Serverless Worker**: Privileged server-authoritative API (`cloudflare/worker.js` and `functions/api/[[catchall]].js`) that enforces:
   - Supabase JWT Bearer token authentication on all protected endpoints.
   - Caller UID ownership verification (users can never trigger spins, withdrawals, or task rewards for other accounts).
   - Server-side Administrator verification for all approvals, bonuses, and ledger overrides.
   - Absolute protection of `SUPABASE_SECRET_KEY` / service-role key (never exposed to browser bundles or GitHub).
4. **Zero Device-Lock Restrictions**:
   - Multiple accounts can be registered and used on the same mobile device.
   - Smooth logout and account switching.
   - The restrictive "Device Locked: This NEXA EARN account is bound to another authorized device" error has been completely eradicated.
5. **Continuous Deployment**: Ready for 1-click deployment on Cloudflare Pages and GitHub.

---

## 📋 Exact Business Rules & Specifications

### 1. Registration Bonus (Instagram)
- Registration requires only Email and Password (WhatsApp optional).
- Promotional message (Urdu):
  `"ابھی اکاؤنٹ بناؤ، انسٹاگرام پر اپنے اکاؤنٹ کی UID سینڈ کریں اور حاصل کریں 50 PKR سے 500 PKR تک کا رجسٹریشن بونس۔"`
- Credited by administrator through the Admin Bonus Panel with duplicate protection.

### 2. Referral System (Without Investment)
- Referring user receives **PKR 30** credited automatically upon administrator approval of WhatsApp verification.
- Unverified registrations cannot generate referral bonuses; duplicate verification is prevented.

### 3. Initial Spins Milestone
- Reaching **10 verified referrals** unlocks an initial package of **5 Lucky Spins**.
- Guaranteed server reward sum: **PKR 900 to PKR 1,000** (e.g. PKR 950).

### 4. Shared 8-Slice Spin Wheel
- Slices: `PKR 50`, `PKR 60`, `PKR 75`, `PKR 100`, `PKR 150`, `PKR 200`, `PKR 300`, `PKR 500`.
- Documented probabilities: ~80% PKR 50, ~1% PKR 500, remainder distributed.
- Spins executed via server-authoritative RPC with atomic balance crediting and ledger entries.

### 5. Premium Membership Upgrade
- Price: **PKR 500** via Easypaisa or JazzCash QR / mobile account.
- Status set to Pending until administrator verifies TRX/TID.
- Qualifying referring user automatically receives a **PKR 200 commission** upon approval.

### 6. Daily Tasks
- 4 Active Daily Tasks:
  1. Poll Completion (Unlocked for Premium)
  2. Watch Ads (Admin unlocked)
  3. Watch Videos (Admin unlocked)
  4. Ad Clicks (Admin unlocked)
- Users without investment automatically unlock daily tasks upon reaching **20 qualifying verified referrals**.
- Completed via server RPC `complete_daily_task` with once-per-day enforcement.

### 7. Official Withdrawal Schedule & Exact Fees
| Withdrawal Amount | Fee | Net Payable | Eligibility |
| :--- | :--- | :--- | :--- |
| **PKR 42** | PKR 7 | PKR 35 | Without Investment & Premium |
| **PKR 210** | PKR 5 | PKR 205 | Premium Only |
| **PKR 595** | PKR 90 | PKR 505 | Premium Only |
| **PKR 1,205** | PKR 205 | PKR 1,000 | Premium Only |
| **PKR 5,500** | PKR 500 | PKR 5,000 | Premium Only |

- Minimum requirement: **10 qualifying verified referrals**.
- Single active withdrawal rule: Maximum 1 pending/processing withdrawal per account.
- Non-premium user warning if selecting > PKR 42:
  `"42 سے زیادہ رقم نکلوانے کے لیے آپ کو Premium Membership لینی ہوگی۔"`

### 8. Weekly Leaderboard
- Top 10 users ranked by verified referral counts.
- Cash rewards claimable only by eligible Premium users.

### 9. Multi-Account Support on Mobile
- Multiple accounts can register and log in on the same mobile phone.
- No device-binding lockouts or hardware blocks.
- Account security is isolated by Supabase Auth and database RLS.

---

## 🛠️ Step-by-Step Deployment Instructions

### Step 1: Supabase Setup (Database & Authentication)
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **Project Settings** -> **API** to note your **Project URL**, **anon public key**, and **service_role secret key**.
3. Go to the **SQL Editor** in the Supabase Dashboard.
4. Execute the migration files in numerical order:
   - `supabase/migrations/20261018000000_nexa_earn_schema.sql` (Tables, indexes, base RLS)
   - `supabase/migrations/20261018000001_nexa_earn_functions.sql` (Core functions and triggers)
   - `supabase/migrations/20261018000002_nexa_earn_spins_and_withdrawals.sql` (Financial RPCs and device unbinding)
   - `supabase/migrations/20261018000003_security_hardening.sql` (Anti-tampering triggers, atomic row-locking, admin RPCs)
5. In **Authentication** -> **URL Configuration**, set your Site URL to your Cloudflare Pages domain (e.g. `https://nexa-earn.pages.dev`).

### Step 2: Push to GitHub
1. Initialize git and commit:
   ```bash
   git init
   git add .
   git commit -m "feat: complete NEXA EARN production release"
   git remote add origin https://github.com/<your-username>/nexa-earn.git
   git push -u origin main
   ```
2. Note: `.env` and sensitive files are strictly excluded by `.gitignore`.

### Step 3: Cloudflare Pages Deployment (Recommended Frontend)
1. In the [Cloudflare Dashboard](https://dash.cloudflare.com):
   - Go to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
   - Select your `nexa-earn` GitHub repository.
2. Configure **Build Settings**:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Configure **Environment Variables** (in Cloudflare Pages dashboard under Settings -> Environment variables):
   - `VITE_SUPABASE_URL` = `https://<your-project>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<your-supabase-anon-key>`
   - `SUPABASE_URL` = `https://<your-project>.supabase.co`
   - `SUPABASE_SECRET_KEY` = `<your-supabase-service-role-secret>`
   - `ADMIN_INITIAL_EMAIL` = `rrdd8397@gmail.com`
4. Click **Save and Deploy**. Cloudflare Pages will build the static assets (with `public/_redirects` routing support) and activate the serverless API functions automatically.

### Step 4: Standalone Cloudflare Worker API Deployment (Optional)
If deploying the API as an independent microservice:
```bash
cd cloudflare
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler deploy
```

---

## 🧪 Testing & Verification

Run the comprehensive automated test suite locally:
```bash
npm run test
```
Or open the Admin Portal in the browser and navigate to the **Automated Tests** tab to execute the full interactive verification suite (28 business and security rules).
