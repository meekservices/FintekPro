# FintekPro Python Analytics Service

Pandas/SciPy/sklearn-powered analytics running alongside the main Node.js portal.
Deploy this as a **separate Replit project** (always-on VM) — the main portal proxies to it transparently.

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

Every request must carry a short-lived JWT issued by the main portal (same `SESSION_SECRET`).
The main portal injects this automatically via the proxy client.

## Deploy Steps

1. **Create a new Replit project** → choose **Python** template
2. **Copy the contents** of `services/python/` into the new project root
   (all files: `main.py`, `auth.py`, `database.py`, `requirements.txt`, `.replit`, `routes/`)
3. **Add these environment secrets** to the new project:

   | Secret | Value |
   |--------|-------|
   | `PRODUCTION_DATABASE_URL` | Same Neon/Postgres connection string as the main portal |
   | `SESSION_SECRET` | Same secret as the main portal (used for JWT verification) |

4. **Publish the new project as an Always-On VM**
   - In the new project: click Deploy → choose **Reserved VM (Always-On)**
   - ⚠️ Do NOT use Autoscale — this service needs to stay running continuously
   - The deployment run command is already configured in `.replit`

5. **Copy the deployed URL** — it will look like:
   `https://fintekpro-python.your-username.replit.app`

6. **Back in the main FintekPro project**, add this environment secret:

   | Secret | Value |
   |--------|-------|
   | `PYTHON_SERVICE_URL` | `https://fintekpro-python.your-username.replit.app` |

7. **Redeploy the main portal** — it will log:
   `ℹ️ [Python] Production mode — using external service at https://...`

8. **Verify** — call `GET /api/python/health` on the main portal; it should return `status: "ok"` with the full capability list.

## Local Dev

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Calling from Main Portal (without deploying)

Hit `GET /api/python/health` on the main portal — it returns a `not_configured` status with instructions when `PYTHON_SERVICE_URL` is not set.
