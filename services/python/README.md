# FintekPro Python Analytics Service

Pandas/SciPy-powered analytics running alongside the main Node.js portal.
Deploy this as a **separate Replit repl** — the main portal proxies to it transparently.

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

## Authentication

Every request must carry a short-lived JWT issued by the main portal (same `SESSION_SECRET`).
The main portal injects this automatically via the proxy client.

## Deploy Steps

1. Create a new Replit repl → **Python** template
2. Copy contents of `services/python/` into it
3. Add environment secrets:
   - `PRODUCTION_DATABASE_URL` — same Neon connection string as the main portal
   - `SESSION_SECRET` — same secret as the main portal (for JWT verification)
4. Run the repl — it auto-installs requirements and starts on port 8000
5. Copy the deployed URL (e.g. `https://fintekpro-python.your-username.replit.app`)
6. On the **main portal**, add env secret: `PYTHON_SERVICE_URL=<that URL>`
7. Done — all `/api/python/*` routes in the main portal now proxy to Python

## Local Dev

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Calling from Main Portal (without deploying)

Hit `GET /api/python/health` on the main portal — it returns a `not_configured` status with instructions when `PYTHON_SERVICE_URL` is not set.
