# Sutra: run and deployment guide

Hi, I'm Manvith. This file tells you how to open my project, log in, run it yourself, and how it is deployed. If anything here doesn't work, please tell me at manvithknm54@gmail.com and I'll fix it quickly.

| | |
|---|---|
| **Live app** | https://sutra-azure.vercel.app |
| **API health check** | https://sutra-daro.onrender.com/api/health |
| **Repository** | https://github.com/manvithknm54/Sutra |

> **A note on speed.** The API runs on a free tier. If nobody has used it for a while, the first request can take up to a minute while it wakes up. I keep a pinger on it during the review, but if the first page is slow, please give it a moment and refresh once.

---

## 1. Demo logins

The password for both accounts is `Sutra@2026`. On the login page there are also two "quick fill" buttons for these accounts.

| Role | Email | What to look at |
|---|---|---|
| Office admin | `admin@sutra.demo` | Dashboard, Fees, Marks (moderate and lock), At risk, Alerts, Ask Sutra, Students (guardian consent), Masters |
| Faculty | `sanjay@sutra.demo` | My Classes, Attendance (works offline), Marks (enter and submit), At risk (your mentees) |

All data is synthetic. No real student or guardian information is in this project.

---

## 2. A five-minute tour (if you are short on time)

1. **Faculty, attendance.** Sign in as `sanjay@sutra.demo`, open **Attendance** and pick Data Structures. Everyone starts as Present. Tap two or three students to mark them absent and press **Submit attendance**. It shows how many seconds it took.
2. **Offline.** In Chrome DevTools, open the Network tab and choose **Offline**. Mark another period and submit. The top-right chip says it is saved on the device. Switch back to Online and watch it change to **All synced**. (Open the class once while online first, so the class list is saved on the device.)
3. **Faculty, marks.** Open **Marks**, then the sheet that is still in Draft. Type `11` in a mark out of 10 and you get an instant error. Fill in any missing marks and submit it for moderation.
4. **Office admin, moderation.** Sign in as `admin@sutra.demo` (a private window works well), open the submitted sheet, press **Add moderation**, give a reason, then **Complete moderation** and **Lock marks**. Open **Audit log** to see every step, and **Export CSV** after the lock.
5. **Fees.** Open **Fees**. Ankit Panda has ₹45,000 due and is marked Critical (more than 60 days overdue). Click him, create a **Payment link**, open it in a private window and pay. Watch the admin screen update by itself, then open the receipt.
6. **At risk.** Open **At risk** and click a student. Every flag lists its reasons in plain words, and a flag only creates a mentor task.
7. **Ask Sutra.** Try *How many third-year students are below 75% attendance this month?* You will see exactly how it understood the question and the structured query behind it.
8. **Consent.** In **Students**, find a student marked *Minor · consent pending*, record consent, then look at **Alerts**.

Tip: in the demo data, the 2024 batch is in its **third** year for the 2026–27 term, so Ask Sutra's second-year questions will say that no batch is in year 2. That is deliberate, and it is explained in the design document.

---

## 3. Run it locally

You need Node 20 or newer and a PostgreSQL database. A free Neon project works well.

```bash
git clone https://github.com/manvithknm54/Sutra.git
cd Sutra

# API
cd server
npm install
cp .env.example .env          # on Windows: copy .env.example .env
# fill in DATABASE_URL, DIRECT_URL and JWT_SECRET (see section 4)
npx prisma migrate deploy
npm run seed                  # demo data, takes a few seconds
npm run dev                   # API on http://localhost:4000

# App (in a second terminal)
cd ../client
npm install
echo VITE_DEMO=true > .env.local
npm run dev                   # app on http://localhost:5173
```

Then open http://localhost:5173 and use the demo logins above.

**Tests:** `cd server && npm test` runs the unit tests for the business rules.

**Offline check:** service workers only run in a production build, so use `cd client && npm run build && npm run preview` (it opens on port 4173), then switch the browser to Offline in DevTools.

**Reset the demo data at any time:** `cd server && npm run seed`.

---

## 4. Environment variables (names only, no values)

| Name | Where | What it is for |
|---|---|---|
| `DATABASE_URL` | server | PostgreSQL connection string (the pooled one on Neon) |
| `DIRECT_URL` | server | PostgreSQL connection string for migrations (the direct one on Neon) |
| `JWT_SECRET` | server | Signs the sign-in cookie. Use 32 or more random characters |
| `CLIENT_ORIGIN` | server | The public address of the app. Payment links are built from it. Use only the address, no path |
| `NODE_ENV` | server | Set to `production` on the host |
| `SEED_PASSWORD` | server, optional | Password the seed gives the demo accounts. Defaults to the one above |
| `ANTHROPIC_API_KEY` | server, optional | Lets an AI model interpret questions in Ask Sutra. Without it, a rule-based parser answers, and a badge on every answer says which one ran |
| `AI_MODEL` | server, optional | Overrides the model name |
| `CACHE_TTL_MS` | server, optional | Lifetime of the dashboard cache. Leave unset for 5 seconds, `0` turns it off |
| `VITE_DEMO` | client | Shows the demo quick-fill buttons on the login page |

No secrets are committed. `server/.env.example` lists the names only.

---

## 5. How it is deployed

| Part | Where | How |
|---|---|---|
| Database | Neon PostgreSQL, Singapore | Pooled and direct connection strings |
| API | Render web service, root folder `server` | Build: `npm install && npx prisma generate && npx prisma migrate deploy`. Start: `node src/index.js`. Health check: `/api/health` |
| App | Vercel, root folder `client`, Vite preset | `client/vercel.json` forwards `/api/*` to the API and sends every other path to the app |

I put the API behind Vercel's forwarding on purpose. The browser only ever talks to one domain, so the sign-in cookie stays first-party and is not blocked as a third-party cookie.

Every push to `main` redeploys both services.

---

## 6. What is simulated (as the brief allows)

- **Payments.** The payment link and the payment page work end to end, but no real money moves. Each payment creates a real receipt and ledger entry.
- **Parent messages.** English and Odia messages are written to the **Alerts** log and shown in a preview. Nothing is sent by SMS or WhatsApp.
- **Exports.** The brief gives no university or Tally template, so both exports are generic CSV files.
- **Odia text.** It has not been reviewed by a native speaker yet.

## 7. Known limits

- **Cold starts.** After idle time the free API takes a moment to wake up (see the note at the top).
- **Scheduled jobs.** The daily alert and risk sweeps only run while the API is awake. The same checks also run after relevant changes, so the data stays correct.
- **Live updates.** Screens update by themselves through a live connection. If the hosting proxy cuts that connection, the browser reconnects, and screens also refresh when you return to the tab and every 30 seconds.
- **Offline scope.** Offline works for taking attendance. Marks, fees and the rest need a connection, and the app must be opened once online before it can work offline.
- **Scope.** The full list of what I built, what I left out and why is in the technical design document.
