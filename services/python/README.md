# FintekPro Python Analytics Service

FastAPI micro-service providing Pandas / SciPy / scikit-learn powered analytics alongside the main Node.js portal. The main portal proxies all `/api/python/*` and `/api/ml/*` requests to this service transparently.

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health + capability list |
| GET | `/api/analytics/portfolio-summary` | Holdings summary, asset allocation, AMC breakdown |
| GET | `/api/analytics/capital-gains` | FIFO capital gains (STCG/LTCG) with tax estimate |
| GET | `/api/analytics/amc-breakdown` | Agent-level AMC AUM + trail estimate |
| POST | `/api/quant/xirr` | XIRR from arbitrary cashflows |
| GET | `/api/quant/portfolio-xirr` | XIRR from user's actual transactions |
| GET | `/api/quant/rolling-returns` | 1Y/3Y/5Y CAGR from NAV history |
| POST | `/api/ml/train` | Train gradient boosting / random forest model |
| POST | `/api/ml/score` | Score new data against trained model |
| POST | `/api/regime/detect` | Gaussian Mixture Model regime detection |
| POST | `/api/portfolio/optimize` | Mean-variance optimization (MVO / Black-Litterman) |
| POST | `/api/fixed-income/bond-analytics` | YTM, duration, convexity |
| POST | `/api/factor-model/fund-factor-regression` | Fama-French style factor regression |
| GET | `/api/market-data/quotes` | Live quotes via yfinance |

## Authentication

Every request must carry a short-lived JWT (15 min) issued by the main Node.js portal, signed with the shared `PYTHON_SERVICE_SECRET`. The main portal injects this automatically via `server/clients/python-client.ts`.

---

## Deploy to Railway

This is deployed as a **separate Railway service** within the same project, communicating with the main Node.js service via Railway's private internal network — no public internet hop, no extra cost.

### Step 1 — Add a new service in Railway

1. Open your Railway project dashboard.
2. Click **+ New Service** → **GitHub Repo**.
3. Select the same repository as the main portal.
4. Under **Settings → Source**, set **Root Directory** to `services/python`.
5. Railway auto-detects Python from `requirements.txt` and builds with Nixpacks.

### Step 2 — Set environment variables on the Python service

In Railway → Python service → **Variables**, add:

| Variable | Value |
|----------|-------|
| `PRODUCTION_DATABASE_URL` | Same Neon/Postgres connection string as the main service |
| `PYTHON_SERVICE_SECRET` | Same value as `SESSION_SECRET` on the main service |

> **Only these two are required.** `PORT` is injected automatically by Railway.

### Step 3 — Deploy and get the private domain

1. Click **Deploy** on the Python service.
2. Wait for the healthcheck at `/health` to pass — allow up to 3 minutes for the scikit-learn cold start.
3. Go to **Settings → Networking → Private Domain**.
   - It will look like: `fintekpro-python.railway.internal`
   - Private domains are reachable only from other services in the same Railway project (free, no public traffic).

### Step 4 — Set PYTHON_SERVICE_URL on the main service

In Railway → **main Node.js service** → **Variables**, add:

| Variable | Value |
|----------|-------|
| `PYTHON_SERVICE_URL` | `http://fintekpro-python.railway.internal` |

> Use `http://` (not `https://`) for Railway private networking. No TLS needed for internal traffic.

### Step 5 — Redeploy the main service

Trigger a redeploy. The boot log will confirm:

```
ℹ️ [Python] Production mode — using external service at http://fintekpro-python.railway.internal
```

Verify by calling `GET /api/python/health` on the main portal — it should return `status: "ok"` with the full capability list.

---

## Local Development

The main portal's development supervisor starts this automatically on port 8001 when `PYTHON_SERVICE_URL` is not set. No manual setup needed for local dev.

To run standalone:

```bash
cd services/python
pip install -r requirements.txt
cp .env.example .env          # fill in PRODUCTION_DATABASE_URL and PYTHON_SERVICE_SECRET
uvicorn main:app --reload --port 8001
```

---

## Troubleshooting

### 502 errors in main service logs + circuit breaker opens

`PYTHON_SERVICE_URL` is set but the Python service is not yet running (still starting up, or healthcheck failed). The circuit breaker opens after 5 consecutive 502s and pauses all Python calls for 2 minutes automatically — the rest of the app continues normally. Once the Python service is healthy, the circuit resets on the next probe.

### "PYTHON_SERVICE_SECRET not configured on Python service"

The `PYTHON_SERVICE_SECRET` env var is missing on the Python Railway service. Add it in Railway → Python service → Variables (same value as `SESSION_SECRET` on the main service).

### Healthcheck timeout on cold start

scikit-learn's first import takes 30–60 seconds. `healthcheckTimeout = 180` in `railway.toml` covers this. If it still times out, increase the value.
