# FintekPro Insurance Service

Standalone micro-service that powers `ins.fintekpro.com`.  
Handles Turtlefin policy data, IRDAI suitability assessments, and insurance holdings.

## Architecture

```
Main Portal (fintekpro.com)
  │
  ├─ GET /api/auth/service-token  ← issues a 15-min JWT
  │                                  (signed with SESSION_SECRET)
  │
  └─ /api/insurance-holdings      ─┐
     /api/insurance/suitability-*  ┼─► ins.fintekpro.com  (this service)
     /api/products/*               ┘   verifies JWT, talks to Neon DB + Turtlefin
```

## Deployment (new Repl)

1. Create a new Repl → **Node.js** template.
2. Copy this `services/insurance/` directory into it (or clone the repo and set root to this folder).
3. Run `npm install`.
4. Create a `.env` file (copy `.env.example`) and fill in:
   - `SERVICE_JWT_SECRET` — **must match** `SESSION_SECRET` from the main portal's environment
   - `DATABASE_URL` — same Neon DB connection string as the main portal
   - `TURTLEFIN_API_KEY` / `TURTLEFIN_API_SECRET` (if you have them; sandbox works without them)
5. Set the Repl's custom domain to `ins.fintekpro.com`.
6. Start: `npm run dev` (development) or `npm start` (production after `npm run build`).

## Activating the Proxy in the Main Portal

Once this service is running, set one env var in the main portal:

```
INSURANCE_SERVICE_URL=https://ins.fintekpro.com
```

All insurance API calls in the main portal will immediately route to this service.  
**No frontend changes required.** The switch is fully transparent.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /api/insurance/suitability-assessment | Create assessment |
| GET | /api/insurance/suitability-assessment/:id | Get assessment |
| GET | /api/insurance/suitability-assessment/client/:clientId | List by client |
| POST | /api/insurance/suitability-assessment/:id/acknowledge | Acknowledge |
| GET | /api/insurance-holdings | List user's holdings |
| POST | /api/insurance-holdings | Add holding |
| PATCH | /api/insurance-holdings/:id | Update holding |
| DELETE | /api/insurance-holdings/:id | Delete holding |
| GET | /api/products/search | Turtlefin quote search |
| POST | /api/products/kyc-search | Policy search by KYC |

## Authentication

All endpoints (except `/health`) require:
```
Authorization: Bearer <service-token>
```
The main portal automatically attaches this header via `server/clients/insurance-client.ts`.  
For direct calls, first fetch a token: `GET /api/auth/service-token` (main portal, logged in).
