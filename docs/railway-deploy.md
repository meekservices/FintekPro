# FintekPro — Railway Deployment Guide

## 1. Prerequisites

- Railway account with a project created
- Neon PostgreSQL database (`PRODUCTION_DATABASE_URL`) — use the existing Neon database, NOT the Helium dev DB
- All secrets from the Replit secrets panel copied to Railway environment variables

## 2. Code Changes Completed (already merged)

| File | Change |
|------|--------|
| `railway.toml` | Build/start commands, health check |
| `server/utils/app-url.ts` | `APP_URL` → `RAILWAY_PUBLIC_DOMAIN` → Replit → fallback |
| `server/index.ts` | CORS + CSRF: accept `*.railway.app` / `*.up.railway.app` |
| `server/index.ts` | CSP frame-ancestors: added `*.railway.app` |
| `server/services/agent-prospect-wizard-service.ts` | Replaced `fintekpro.replit.app` with `getAppBaseUrl()` |
| `server/services/digilockerService.ts` | Replaced `REPLIT_DOMAIN` with `APP_DOMAIN \|\| REPLIT_DOMAIN \|\| "fintekpro.com"` |
| `server/routes/partner/index.ts` | Replaced `REPLIT_DOMAINS`-based invite URL with `getAppBaseUrl()` |

## 3. Railway Environment Variables

Set ALL of these in Railway → Project → Variables.

### Required — Core

| Variable | Value / Notes |
|----------|---------------|
| `NODE_ENV` | `production` |
| `PORT` | Leave unset — Railway sets it automatically |
| `APP_URL` | `https://fintekpro.com` (or Railway app URL until custom domain is ready) |
| `APP_DOMAIN` | `fintekpro.com` |
| `SESSION_SECRET` | Strong random string (same as Replit secret) |
| `PYTHON_SERVICE_SECRET` | Copy from Replit secret |

### Required — Databases

| Variable | Value / Notes |
|----------|---------------|
| `PRODUCTION_DATABASE_URL` | Neon connection string (SSL) — existing production DB |
| `DATABASE_URL` | Can point to Neon too on Railway (Helium is unreachable from Railway) |

### Required — AI

| Variable | Value / Notes |
|----------|---------------|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI base URL |
| `AI_INTEGRATIONS_GOOGLE_API_KEY` | Gemini key |

### Required — BSE / MF

| Variable | Notes |
|----------|-------|
| `BSE_USER_ID` | |
| `BSE_MEMBER_ID` | |
| `BSE_PASSWORD` | |
| `BSE_PASS_KEY` | |
| `BSE_ENVIRONMENT` | `PROD` or `UAT` |
| `BSE_STAR_API_KEY` | |
| `BSE_STAR_API_URL` | |
| `BSE_STAR_MEMBER_ID` | |
| `BSE_STAR_USER_ID` | |
| `BSE_DIRECT_USER_ID` | |
| `BSE_DIRECT_MEMBER_ID` | |
| `BSE_DIRECT_PASSWORD` | |
| `BSE_DIRECT_ENVIRONMENT` | |
| `BSE_BOND_USER_ID` | |
| `BSE_BOND_MEMBER_ID` | |
| `BSE_BOND_PASSWORD` | |
| `BSE_BOND_ENVIRONMENT` | |
| `CAMS_API_KEY` | |
| `CAMS_BASE_URL` | |
| `CAMS_MEMBER_ID` | |
| `CAMS_PASSWORD` | |
| `CAMS_ENVIRONMENT` | |

### Required — KYC / Auth

| Variable | Notes |
|----------|-------|
| `AUTHBRIDGE_API_KEY` | |
| `AUTHBRIDGE_CLIENT_ID` | |
| `AUTHBRIDGE_CLIENT_SECRET` | |
| `AUTHBRIDGE_BASE_URL` | |
| `AUTHBRIDGE_ENVIRONMENT` | |
| `AUTHBRIDGE_ESIGN_API_KEY` | |
| `AUTHBRIDGE_ESIGN_CLIENT_ID` | |
| `AUTHBRIDGE_ESIGN_CLIENT_SECRET` | |
| `AUTHBRIDGE_ESIGN_BASE_URL` | |
| `AUTHBRIDGE_ESIGN_ENVIRONMENT` | |
| `DIGILOCKER_APP_ID` | |
| `DIGILOCKER_API_KEY` | |
| `DIGILOCKER_ORG_ID` | |
| `DIGILOCKER_CLIENT_ID` | |
| `CKYC_API_BASE_URL` | |
| `CKYC_API_KEY` | |
| `CKYC_API_SECRET` | |
| `CKYC_ENV_MODE` | `production` |
| `CKYC_PROVIDER_MODE` | |

### Required — Payments

| Variable | Notes |
|----------|-------|
| `CASHFREE_APP_ID` | |
| `CASHFREE_SECRET_KEY` | |
| `CASHFREE_ENVIRONMENT` | `PROD` or `TEST` |
| `STRIPE_SECRET_KEY` | |

### Required — Messaging (Twilio)

| Variable | Notes |
|----------|-------|
| `TWILIO_ACCOUNT_SID` | |
| `TWILIO_AUTH_TOKEN` | |
| `TWILIO_PHONE_NUMBER` | |
| `TWILIO_WHATSAPP_NUMBER` | |
| `TWILIO_VERIFY_SERVICE_SID` | |
| `TWILIO_MESSAGING_SERVICE_SID` | |
| `TWILIO_VOICE_NUMBER` | |
| `TWILIO_PRIMARY_PHONE` | |
| All `TWILIO_WA_TEMPLATE_*` vars | WhatsApp template SIDs |

### Required — Zoho

| Variable | Notes |
|----------|-------|
| `ZOHO_CLIENT_ID` | |
| `ZOHO_CLIENT_SECRET` | |
| `ZOHO_REFRESH_TOKEN` | |
| `ZOHO_ORGANIZATION_ID` | |
| `ZOHO_BOOKS_ORGANIZATION_ID` | |
| `ZOHO_REDIRECT_URI` | Update to Railway/custom domain URL |
| `ZOHO_DATACENTER` | |
| `ZOHO_CONNECTION_ID` | |
| `ZOHO_SYNC_ENABLED` | `true` |
| `ZOHO_WEBHOOK_SECRET` | |
| `ZOHO_ZSOID` | |
| `ZOHO_CAMPAIGNS_ACCESS_TOKEN` | |

### Required — Email / SMS

| Variable | Notes |
|----------|-------|
| `EMAIL_HOST` | |
| `SMTP_HOST` | |
| `SMS_API_KEY` | |
| `SMS_SENDER_ID` | |
| `SMS_TEMPLATE_ID` | |
| `COMPLIANCE_HEAD_EMAIL` | |
| `COMPLIANCE_MANAGER_EMAIL` | |

### Required — Market Data

| Variable | Notes |
|----------|-------|
| `ALPHA_VANTAGE_API_KEY` | |
| `APY_API_KEY` | |
| `APY_API_URL` | |
| `ALPACA_API_KEY` | |
| `ALPACA_SECRET_KEY` | |
| `ALPACA_BASE_URL` | |
| `CRUNCHBASE_API_KEY` | |

### Required — Account Aggregator (AA)

| Variable | Notes |
|----------|-------|
| `AA_API_KEY` | |
| `AA_ENVIRONMENT` | |
| `SETU_CLIENT_ID` | |
| `SETU_CLIENT_SECRET` | |
| `SETU_AA_BASE_URL` | |
| `SETU_FIU_ENTITY_ID` | |

### Required — Other Services

| Variable | Notes |
|----------|-------|
| `TAXCLOUD_API_KEY` | |
| `TAXCLOUD_BASE_URL` | |
| `TAXCLOUD_ENVIRONMENT` | |
| `COMPLYCUBE_API_KEY` | |
| `SUMSUB_API_KEY` | |
| `SHUFTI_PRO_API_KEY` | |
| `CREDHIVE_API_KEY` | |
| `CREDHIVE_BASE_URL` | |
| `VKYC_API_KEY` | |
| `VKYC_BASE_URL` | |
| `TRUTHSCREEN_USERNAME` | |
| `TRUTHSCREEN_PASSWORD` | |
| `TRUTHSCREEN_BASE_URL` | |
| `CVL_KRA_API_URL` | |
| `CERSAI_API_KEY` | |
| `CERSAI_BASE_URL` | |
| `BBPS_API_KEY` | |
| `BBPS_API_URL` | |
| `BBPS_MERCHANT_ID` | |
| `SANDBOX_BASE_URL` | |
| `SANDBOX_ENVIRONMENT` | |
| `SANDBOX_ERI_USER_ID` | |
| `SANDBOX_ERI_PASSWORD` | |
| `SANDBOX_WEBHOOK_SECRET` | |
| `TURTLEFIN_API_KEY` | |
| `TURTLEFIN_API_SECRET` | |
| `DSC_TSA_URL` | |

### Optional — Feature Flags

| Variable | Default | Notes |
|----------|---------|-------|
| `CKYC_ALLOW_FALLBACK` | `false` | |
| `DISABLE_LEGACY_LOAN_APIS` | `false` | |
| `USE_SANDBOX_TAX_API` | `false` | Set to `false` in production |
| `AUDIT_INTEGRITY_CHECK_INTERVAL_MINUTES` | `60` | |

## 4. Custom Domain (DNS)

Once the Railway service is deployed and running:

1. Railway → Settings → Domains → Add custom domain
2. Add: `fintekpro.com`, `www.fintekpro.com`, `admin.fintekpro.com`, `agent.fintekpro.com`, `partner.fintekpro.com`
3. Update your DNS CNAME records to point to Railway's provided target
4. SSL is provisioned automatically by Railway

## 5. Health Check

Railway will hit `GET /api/health` every 30 s. The server returns `200 OK` when up.

## 6. Build Notes

- Build command uses `NODE_OPTIONS='--max-old-space-size=2048'` to prevent Vite OOM during the frontend bundling step
- `scripts/start-production.sh` handles Python service startup with TCP health-check; the TCP check for Helium (port 5432 on localhost) will gracefully skip on Railway since there is no local Postgres — prod DB is Neon

## 7. Critical Warning — Databases

**NEVER** use "Copy development database to production" in Replit.
The Helium dev DB has no enrichment data and would overwrite the live Neon database.

On Railway, `DATABASE_URL` and `PRODUCTION_DATABASE_URL` can both point to **Neon**.
The enrichment worker writes always go through `server/db-production.ts` regardless.
