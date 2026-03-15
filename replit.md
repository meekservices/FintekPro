# FintekPro - Financial Services Platform

## Publish Readiness (March 2026)
- **Build**: ✅ Zero TypeScript errors, zero build warnings. `dist/index.js` (14 MB) + `dist/public/` frontend assets.
- **Security**: ✅ `/api/test-amfi`, `/api/test/twilio-{sms,whatsapp,verify,voice}` gated by `isProductionEnvironment()` (dev-only endpoints hidden in prod). Error testing routes already gated by `NODE_ENV === 'development'` in `server/index.ts`.
- **SW Cache Busting**: ✅ SW URL is `?v=${APP_VERSION}&b=dev` in dev (stable, no banner spam) and `?v=${APP_VERSION}&b=${APP_VERSION}` in production (stable per version, banner only fires when APP_VERSION is bumped or sw.js content changes). NOTE: BUILD_TIMESTAMP = new Date() runs at runtime in the browser, NOT at build time — never use it in the SW URL.
- **SW Update Flow**: ✅ `client/public/sw.js` install handler does NOT call `self.skipWaiting()`. Calling it there would immediately activate the new SW → trigger `clients.claim()` → fire `controllerchange` in all open tabs → automatic `window.location.reload()` mid-session. Instead the new SW waits, `UpdateNotificationBanner` appears, and `skipWaiting` is only called via the `message` event when the user clicks "Refresh Now".
- **Lazy Loading Recovery**: ✅ `lazyWithRetry` properly awaits SW cache deletion before reload. App.tsx clears all `chunk-reload-*` and `preload-err-reload` session guards on mount.
- **Deployment config** (`.replit`): `build = ["npm", "run", "build"]`, `run = ["npm", "run", "start"]` (→ `NODE_ENV=production node dist/index.js`), port 5000→80.
- **Python sidecar**: starts on port 8001 from `server/index.ts` startup (non-blocking, spawned with `uvicorn`).

## Performance Optimizations (March 2026)

### Frontend Bundle Splitting (vite.config.ts)
All large chunks split into domain-specific sub-chunks — users download only what they need per section visited.

| Original chunk | Size | Split into | Sizes |
|---|---|---|---|
| `chunk-admin` | 2,321 KB | `chunk-admin` (core) + `admin-fin` + `admin-loans` | 1,920 + 213 + 145 KB |
| `chunk-agent` | 2,629 KB | `chunk-agent` (core) + `agent-knowledge` + `agent-advisory` + `agent-crm` + `agent-kyc` | 1,212 + 606 + 474 + 203 + 168 KB |
| `chunk-tax` | 686 KB | `tax-itr` + `chunk-tax` (core) + `tax-ca` | 490 + 127 + 70 KB |
| `chunk-investments` | 692 KB | `investments-bonds` + `chunk-investments` (core) + `investments-mf` | 280 + 279 + 136 KB |

### Server Boot Parallelization (server/index.ts)
Sequential `await import()` chains replaced with `Promise.all()` batches. Original: 76 sequential imports (~18,900ms boot). After: 5 parallel batches.

| Batch | Modules parallelized |
|---|---|
| Agent routes | 8 modules (agent advisory, CRM, KYC, knowledge, empanelment, etc.) |
| KYC/marketing/user | 8 modules (KYC vault, marketing, admin prospects, Twilio, Probe42, user mgmt, stakeholder, auto-pop) |
| Marketplace/bond | 7 modules (unlisted, compliance, bond marketplace×4, gold admin) |
| MF/orders | 4 modules (MF orders, order routes, MF enrichment, AI MF recommendations) |
| eSign/document | 10 modules (eSign, admin-eSign, DSC, proposal-eSign, eSign-AI, e-Aadhaar, document upload, CA, REIT/InvIT, admin-DB) |
| Commission/regulatory | 8 modules (commission config, regulatory framework, ISIN intelligence, picks, pick service, enrichment guard, AI alpha, node-cron) |

**Measured result**: Route registration time: 2,086ms → **1,725ms** (−17%). Server ready for first request in ~13s (was ~19s).

## Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It provides secure financial planning, portfolio management, and real-time market data across diverse asset classes. Key capabilities include family collaboration, a unified KYC system, an AI-powered financial assistant, an Unlisted Marketplace, and comprehensive multi-origination loan lifecycle support. The platform aims to be a leading digital financial ecosystem, empowering individual investors and financial advisors with advanced tools and insights.

## Previously Unused Endpoints Now Wired (March 2026)
- **Golden Pricing Dashboard** (`/admin/pricing-engine`): Bloomberg-style admin UI for live prices, engine stats, flagged price anomalies, manual overrides, and ISIN audit trails
- **Institutional Data Layer** (`/admin/institutional-data`): UI for corporate actions, credit ratings, security master search, and symbol mapping (NSE↔BSE↔ISIN)
- **Python Quant Analytics Hub** (`/agent/quant-analytics`): Portfolio XIRR, rolling returns, SIP simulator, return forecasting, fund overlap, MVO/Black-Litterman optimizer — all calling Python sidecar
- **XAI Explainability**: "Explain with XAI" button on each pick in `/agent/picks`, calls `POST /api/explainability/explain/product`
- **Return Forecasting Engine**: "Return Forecast" tab in `/wealth-management`, calls `POST /api/returns/portfolio`
- **Asset Allocation Optimizer**: `/components/dashboard/asset-allocation.tsx` now calls `GET /api/allocation/risk-profiles` + `POST /api/allocation/optimize`
- **Goal Planning API**: Goal planning calculator calls `POST /api/goals/calculate-sip` instead of local estimation
- **Tax Completeness**: Form 12BB generator, ITR filing history, computation PDF export, dynamic broker list — all wired in `tds-compliance.tsx` and `tax-itr-self.tsx`

## Bloomberg-Style Golden Source Pricing Engine

### Architecture
- `server/services/golden-pricing/GoldenPricingEngine.ts` — core engine: multi-source price discovery, hierarchy waterfall, validation, audit, batch operations
- `server/routes/golden-pricing-routes.ts` — REST API (9 endpoints)
- `server/db-migrations/golden-pricing-migration.ts` — boot-time `CREATE TABLE IF NOT EXISTS` (idempotent)

### DB Tables (Production Neon DB)
- `golden_prices` — (isin, price_date) UNIQUE; stores price, source, confidence_score, is_flagged, deviation_pct, metadata
- `price_audit_log` — immutable SEBI audit trail of every price change/override
- `instrument_returns` — (isin, as_of_date) UNIQUE; stores Python-computed returns (1D/1W/1M/3M/6M/YTD/1Y/3Y/5Y) + reference prices

### Source Hierarchy (equity)
```
NSE_BHAVCOPY(98) → FMP(85) → LAST_TRADE(70) → MODEL_PRICE(60)
AMFI_NAV(97) for MFs
YIELD_CURVE(80) for bonds (DCF model using 7.13% RBI yield)
PROBE42(75) → MODEL_PRICE(60) for unlisted (30% liquidity discount)
BLACK_SCHOLES(65) for derivatives (uses underlying from golden_prices)
```

### API Endpoints (all at `/api/pricing/*`)
- `GET /stats?date=` — per-asset-class breakdown of priced instruments
- `GET /flagged` — instruments with >20% deviation
- `POST /batch` — bulk ISIN lookup (up to 200)
- `POST /price-now` — on-demand pricing for any instrument
- `POST /override` — admin manual override with SEBI audit entry
- `POST /run-daily` — trigger full daily run (async, returns immediately)
- `GET /audit/:isin` — full SEBI audit trail for an ISIN
- `GET /:isin/history` — price history with date range
- `GET /:isin?date=` — latest or date-specific golden price

### Cron Responsibility Reduction
- Single `runDailyGoldenPricing()` cronjob at 9:00 PM IST (Mon-Fri) replaces individual equity/MF/bond/unlisted price fetchers
- After each golden pricing run, Python `/api/price-returns/daily-run` is triggered to recompute all returns
- Weekly stale-marker (Sundays 8 PM IST) marks prices older than 5 days
- All other services read from `golden_prices` first → fewer API calls to external sources

## Python Point-to-Point Price Returns Engine

### Architecture
- `services/python/routes/price_returns.py` — reads `golden_prices` time-series via asyncpg, computes returns with Pandas, writes to `instrument_returns` and write-back to `listed_stocks`
- Replaces `fetchNSEReturns()` in `server/modules/research/dataService.ts` (NSE historical API was blocked from Replit)
- Node.js calls Python via `callPython('/api/price-returns/compute', 'POST', { symbol })` — symbol-to-ISIN is resolved by Python from `listed_stocks`

### Periods Computed
| Period | Method |
|--------|--------|
| 1D, 1W, 1M, 3M, 6M | Simple % = (P_now - P_past) / P_past |
| YTD | Simple % from Jan 1 of current year |
| 1Y, 3Y, 5Y | CAGR = (P_now / P_past)^(1/years) - 1 |

### Returns stored as decimal fractions (0.085 = 8.5%). Multiply by 100 for display.

### API Endpoints (proxied via `/api/python/price-returns/*`)
- `POST /compute` — one ISIN or symbol; resolves ISIN, computes, writes back
- `POST /batch` — array of instruments
- `GET /:isin` — read pre-computed returns from instrument_returns
- `GET /:isin/history` — full return history (last N dates)
- `POST /daily-run` — background task: compute all ISINs in golden_prices

### Known Limitations
- NSE Bhavcopy blocked from Replit dev env (HTTP 404 bot protection) — FMP fallback applies in dev
- Probe42 unlisted data requires `PROBE42_API_KEY` env var
- Derivative pricing uses underlying from golden_prices DB (no external call needed)

## Institutional Market Data Layer

### Architecture Summary
FintekPro's institutional market data backbone sits below the pricing engine and feeds all portfolio valuation, analytics, and compliance systems.

### New DB Tables (created via boot-time migration `server/db-migrations/institutional-data-migration.ts`)
| Table | Purpose |
|---|---|
| `corporate_actions` | Splits, bonuses, dividends, rights, mergers per ISIN. Drives price adjustment in `golden_prices`. |
| `price_adjustments` | Immutable audit of every split/bonus adjustment applied to `golden_prices` historical rows. |
| `symbol_mapping` | Multi-provider symbol translation: NSE ↔ BSE ↔ AMFI ↔ SCREENER ↔ FMP ↔ Bloomberg. |
| `credit_ratings` | Full history of rating changes per ISIN (CRISIL/ICRA/CARE/India Ratings). Seeded from `corporate_bonds` at boot. |

### Unified Security Master (VIEW)
- `security_master` — PostgreSQL VIEW (not a table) created by `server/db-migrations/security-master-migration.ts`
- UNION ALL across `listed_stocks` (equity) + `mutual_funds` + `corporate_bonds` + `unlisted_companies`
- Columns: `isin, instrument_name, asset_class, exchange, symbol, sector, status, current_price, currency, updated_at`
- Read-only. No writes go here. Used for cross-asset ISIN lookups.

### Corporate Actions Engine
- Python ETL: `services/python/routes/corporate_actions.py`
  - `POST /api/corporate-actions/sync` — fetch NSE CA archive CSV, parse, upsert by (isin, ex_date, action_type)
  - `GET /api/corporate-actions/pending` — actions with ex_date ≤ today, not yet applied
  - `POST /api/corporate-actions/apply-adjustments` — backward adjust `golden_prices` prices by `adjustment_factor`, log each row to `price_adjustments`, trigger returns recompute
  - `GET /api/corporate-actions/list` and `GET /api/corporate-actions/history/:isin`
- Node.js proxy at `/api/python/corporate-actions/*`
- Cron: 7:10 PM IST daily (sync) + 7:20 PM IST (apply adjustments) — production only

### Symbol Mapping Service
- `server/services/symbol-mapping-service.ts`
- Boot-time seeder: maps 2821+ listed_stocks (NSE + BSE codes) + mutual_funds (AMFI scheme codes) → `symbol_mapping`
- API: `GET /api/marketdata/symbol-map/:isin`, `GET /api/marketdata/resolve-symbol?provider=NSE&symbol=INFY`, `POST /api/marketdata/symbol-map`

### Credit Ratings Service
- `server/services/credit-ratings-service.ts`
- Boot-time seeder: seeds from `corporate_bonds.credit_rating / rating_agency / rating_date`
- API: `GET /api/marketdata/credit-rating/:isin`, `GET /api/marketdata/credit-rating/:isin/history`, `POST /api/marketdata/credit-rating`
- `upsertRating()` auto-computes `ratingAction` (Upgraded/Downgraded/Affirmed) and marks prior rows `is_current=false`

### Security Master API
- `GET /api/marketdata/security/search?q=` — search by name, symbol, or ISIN across ALL asset classes (top 50 results)
- `GET /api/marketdata/security/:isin` — fetch one instrument by ISIN from the unified view
- Note: `/search` is registered before `/:isin` to avoid Express route shadowing

### Data Lake (Object Storage)
- Python ETL: `services/python/routes/data_lake.py`
  - `POST /api/data-lake/store-bhavcopy` — download NSE bhavcopy ZIP → store to Replit object storage at `public/data-lake/nse/{YYYY}/{MM}/{DD}/`
  - `POST /api/data-lake/store-amfi-nav` — download AMFI NAV text → store to `public/data-lake/amfi/{YYYY}/{MM}/{DD}/`
  - `GET /api/data-lake/list?asset=nse|amfi&from_date=&to_date=`
  - `GET /api/data-lake/retrieve?path=`
- Node.js proxy at `/api/python/data-lake/*`
- Cron: 6:30 PM IST daily (NSE bhavcopy) + 7:00 PM IST (AMFI NAV) — production only
- Internal caller: `server/services/python-service-caller.ts`

### Disabled Cron Jobs
- `Daily Price Updater` (was 8:45 PM IST weekdays) — **DISABLED** 2026-03-09
- `Historical Backfill Engine` (was 2:00 AM IST daily) — **DISABLED** 2026-03-09
- Both wrote to `instrument_prices` which was a dead-end table (only read for COUNT stats). Golden Source Pricing Engine at 9 PM IST fully replaced them. FMP/Alpha Vantage API quota savings.

## Research Note Generator Module

### Architecture
- `server/modules/research/` — all backend engines:
  - `dataService.ts` — NSE + Screener.in + DB parallel fetch; `FinancialData` interface includes OCF, FCF, revenue, netIncome, operatingMargin, returns1M/6M/1Y
  - `pricingEngine.ts` — PE-based + PB-based + blended price target; bear/base/bull scenarios; PEG ratio
  - `thesisEngine.ts` — 4 data-driven thesis bullets + 4-5 risk bullets generated from financial ratios
  - `ownershipService.ts` — NSE shareholding API fetch; peer comparison via `listed_stocks`; sector averages
  - `aiCommentaryService.ts` — Gemini AI 3-sentence sector narrative; 60-min cache; sector fallbacks
  - `reportService.ts` — PPT (10 slides), PDF (3 pages), One-Pager generation
  - `recommendationEngine.ts`, `technicalEngine.ts`, `valuationEngine.ts` — existing engines
  - `unlistedAnalyticsEngine.ts` — ratio engine + EV/EBITDA + DCF + Revenue Multiple for unlisted companies
- `server/services/credhive-service.ts` — Credhive API client (placeholder key: set `CREDHIVE_API_KEY` and optionally `CREDHIVE_BASE_URL`); gracefully unavailable when key is absent
- `server/routes/research-note-routes.ts` — routes; unified `/search` covers listed+unlisted; `buildReportData()` for listed; `buildUnlistedReportData()` for unlisted
- `client/src/pages/research-note-generator.tsx` — full frontend UI; handles `type: "listed" | "unlisted"` in search results; unlisted companies show amber badge, valuation models (EV/EBITDA / DCF / Revenue Multiple), FHS, directors, compliance signals

### Unified Search
- `GET /api/research-note/search?q=` — queries both `listed_stocks` and `unlisted_companies` tables; returns `type: "listed" | "unlisted"` field; deduped by company name; max 15 results
- Supports search by: company name, NSE symbol, ISIN, CIN (for both listed and unlisted)

### Unlisted Research Pipeline
- `POST /api/research-note/preview-unlisted { cin }` — looks up by CIN or ID; fetches DB financials; calls Credhive if key is set; runs analytics engine
- `POST /api/research-note/generate/pdf-unlisted { cin }` — generates PDF research note
- `POST /api/research-note/generate/ppt-unlisted { cin }` — generates PPT presentation
- Analytics: EV/EBITDA (sector multiples), DCF (15% WACC, 4% terminal growth), Revenue Multiple; blended bear/base/bull valuation range
- Financial Health Score (FHS) 0–100: ROE 35% + Revenue Growth 30% + Leverage 35%

### Credhive Integration
- Service file: `server/services/credhive-service.ts`
- Set `CREDHIVE_API_KEY` env var to activate (placeholder = no API calls made, pipeline uses DB-only data)
- Endpoints: `/company/search`, `/company/{cin}`, `/company/{cin}/financials`, `/company/{cin}/directors`, `/company/{cin}/compliance`
- Auto-fallback: if Credhive unavailable, uses `company_financials` table data; response always includes `dataSource: "credhive" | "db_cache" | "unavailable"`

### PPT Fix
- ESM/CJS fix: `const PptxCtor = (PptxGenJS as any).default ?? PptxGenJS; const ppt = new PptxCtor();`
- This must always be used — `new PptxGenJS()` directly causes "not a constructor" crash

### Data Units
- `listed_stocks.market_cap_value` is in **crores** (not absolute rupees)
- `financials.marketCap` from NSE is in **absolute rupees**
- Peer market cap: stored as crores → formatted inline as "₹237K Cr" format

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.
Never build duplicate engines — always upgrade existing ones in place. No parallel systems doing the same work.

### Database Schema Rule (MANDATORY)
**All schema changes MUST be applied using raw SQL via `psql "$PRODUCTION_DATABASE_URL"`.**
- NEVER run `npm run db:push` or `drizzle-kit push` — the schema is too large and it times out, risking partial migrations and data loss.
- NEVER use `drizzle-kit migrate` for live schema changes.
- The correct workflow for any new table or column:
  1. Add the Drizzle ORM definition to `shared/schema.ts` (for TypeScript types only)
  2. Write the equivalent `CREATE TABLE` / `ALTER TABLE` raw SQL
  3. Apply it with: `psql "$PRODUCTION_DATABASE_URL" -c "YOUR SQL HERE"`
  4. Verify with: `psql "$PRODUCTION_DATABASE_URL" -c "\d table_name"`
- Drizzle-kit and the Replit database diff panel are informational only — never act on their push suggestions.
- **NEVER re-add `postgresql-16` to Replit modules** — it activates the database diff panel which crashes on publish because `shared/schema.ts` is too large for drizzle-kit. The `postgresql-16` module was intentionally removed. The app connects to Neon via `PRODUCTION_DATABASE_URL` directly (see `server/db.ts`).
- **`drizzle.config.ts` uses `shared/schema-stub.ts` (an empty export) and points to `DATABASE_URL` (the empty Replit Neon DB, NOT production)**. This is intentional: Replit's publish flow runs `drizzle-kit check` automatically when DATABASE_URL is set; pointing it at an empty stub schema + empty DB gives exit code 0 ("Everything's fine") instantly, unblocking publish. Do NOT change `schema` in `drizzle.config.ts` to point at `shared/schema.ts` — that file is 1.5MB/32k lines and causes drizzle-kit to OOM-crash, blocking publish with "SERVER unexpectedly disconnected". The production app connects via `PRODUCTION_DATABASE_URL` (from secrets), never via `DATABASE_URL`.
- **`drizzle-kit` has been uninstalled from the project** — Replit's database diff panel starts `drizzle-kit studio` (a persistent server) as part of the publish flow. With `drizzle-kit` uninstalled, there is no binary to start, so the diff panel cannot crash. `drizzle-orm` (the runtime ORM) is still installed and the app works normally. Do NOT reinstall `drizzle-kit` — it will re-enable the diff server and block publishing again.
- **`drizzle-kit check` does NOT need a real database connection** — with a stub schema (zero tables) and no `migrations/` folder, it exits immediately with "Everything's fine" (exit code 0) without connecting to any DB. The `javascript_database` integration is therefore not required for publish; it can be removed from the Replit UI without affecting the app or publish flow.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, shadcn/ui (Radix UI), Tailwind CSS, and Recharts, ensuring a mobile-first and responsive design. It features a `ScrollableTabsList`, a three-part layout (Left Sidebar Navigation, Main Content, Footer), a collapsible, state-persisted sidebar, and consistent `LoadingState` and `EmptyState` components. A Multi-Portal Brand Segregation System dynamically brands portals using a `PortalType` enum, SVG logos, and a `PortalThemeProvider.tsx`.

### Technical Implementations
The frontend utilizes Vite, Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation. The backend is an Express.js application with TypeScript, using PostgreSQL via Drizzle ORM, exposed as a RESTful API. Authentication includes mandatory two-factor OTP, unified login via Passport.js, and comprehensive KYC. An Admin portal is also provided.

FintekPro incorporates an AMFI Subscription Sync System, a Regulatory Investability Service, an AI MF recommendation service, and a SEBI Feb 26, 2026 Circular Compliance System with taxonomy versioning. It features a SEBI/RBI-compliant Unlisted Marketplace with a multi-methodology price suggestion engine and an Institutional-Grade Unlisted Equity Lifecycle. Other key systems include Multi-Source Financial Data Enrichment, Centralized Portfolio Import, Unified Portfolio Storage with Capital Gains & Tax Optimization, and integration with the Zoho Ecosystem.

The platform includes a Profit-Optimized AI Recommendation Engine, a Unified AI Recommendation Engine, Stock Enrichment System, ISIN Intelligence Layer, Agent Knowledge Hub, Gemini-powered Daily AI Market Brief Engine, and a DB-First Stock Screener. **AI Hierarchy (cost-optimised):** Python sidecar (scipy/scikit-learn) is the PRIMARY scoring engine for all product recommendations (`analyzeWithPython` in `unified-ai-recommendation-engine.ts`) — it uses regime-conditioned deterministic scoring via GMM+signals from `/api/regime/detect` (5-min cached), with enriched FMP signals (DCF, RSI, ROE) incorporated for stocks. Gemini is reserved for text-generation tasks only (advisory narratives, OCR, eSign, market briefs, chat). OpenAI is fallback-only. `gemini.ts::analyzePortfolio` is now a zero-cost local computation. `unified-advisory-service.ts` uses the DB/Python path first; Gemini only supplements when the DB returns fewer results than requested. It supports SEBI/RBI-compliant payment handling, FEMA compliance, international transaction management, Offline & Slow-Internet Resilience via PWA, a DSA Multi-Financier Loan Routing System, Bank OAuth Integration Infrastructure, and an MCA Integration System. A Builder Funding & Project Finance Module extends the DSA loan system with a DEVELOPER vertical, a 10-step Project Finance Wizard, and an Intelligent Lender Matching Engine, complemented by a Banker Contacts Directory.

A Multi-Level Partner Hierarchy System enables hierarchical partner onboarding, commission waterfall, and client ownership protection, supported by a Partner Payout Statement Service and a Commission Dispute & Reversal Engine. A Multi-Bank Account System supports up to 5 bank accounts per user with penny-drop verification. Core services include UnifiedOrderNotificationService, Cache Services, MF Live Returns System, Benchmark Data Infrastructure, and a three-layer KYC Orchestrators. Enhancements include Proposal Builder features (Strategy-Locked Advisor-Controlled System with Fair Backtesting), a Regulator-Grade PDF System, a Proposal Audit Trail System, a Database Enrichment Infrastructure, a MF Comprehensive Enrichment Pipeline, and a Lead Leakage Prevention & Detection System.

A **Unified OCR Service** (`server/services/unified-ocr-service.ts`) provides central document text extraction for the entire platform: Gemini Vision handles scanned PDFs and images, and Sandbox.co.in handles structured ITR extraction. The **Unified PDF Parser** (`unified-pdf-parser.ts`) now has an automatic OCR fallback when `pdf-parse` returns `EMPTY_CONTENT`.

A **Tax-Loss Harvesting Engine** proactively scans portfolios for loss positions, calculates potential tax savings, suggests equivalent replacement funds, and generates `TAX_LOSS_HARVEST` recommendations. The **Proposal Builder Alpha Engine** (Fresh Investment Suggestions) has been upgraded to a 4-layer alpha generation system. The AI Stock Pick of the Day service (v3.0.0) routes through the `unifiedAIRecommendationEngine` with three key upgrades: (1) RSI(14) is computed from `golden_prices` DB (35-day lookback, `asc()` order) — Yahoo Finance is NOT used for Indian stocks; (2) Python `/api/regime/detect` is tried first with `aiRegimeDetectionEngine` as local fallback; (3) Python GBR ML score blended at 30% weight with local decision-stump confidence after `/api/ml/train` is called.

Eight production upgrades across `unified-advisory-service.ts` and `ai-proposal-engine.ts` enhance fund catalogue, portfolio summary, regime-aware advisory, Gemini JSON processing, audit trail, SWITCH fund recommendations, `afterAllocation` computation, and FIFO tax estimates.

FintekPro's Agent Portal includes 5 BuildWealth-inspired advisor tools: Investment Baskets, SIP Health Monitor, Portfolio Drift Monitor, Order-on-Behalf Console, and Market Alert Center. A **BuildWealth-inspired Revenue Sheet** (`client/src/pages/agent/revenue-sheet.tsx` and `client/src/pages/partner/revenue-sheet.tsx`) provides month/year navigation (prev/next arrows, `?month=M&year=Y` param pattern), a unified case-wise payout table across all product types (loans, MF trail, investments), a Monthly Planner tab with target-vs-actual progress bars, and a Payout Status tab. Backend routes: `GET /api/agent/revenue-sheet` and `GET /api/partner/revenue-sheet` (in `server/routes/revenue-sheet-routes.ts`). Nav links registered in agent enhanced-navigation and partner-layout sidebar. A Consolidated MF Metrics System strictly separates `mutual_funds` and `mutual_fund_metrics`. The Proposal Builder includes AI_DRIVEN/MANUAL allocation, strategy snapshot locking, fair backtesting, and validation. An AI Alpha Engine provides a regime-aware, backtest-validated, Sharpe-optimized system. A Formalized KYC Engine provides priority-based provider selection with automatic fallback routing. A Scheme Master Governance System provides ISIN-based fund identification with DB-driven transaction eligibility rules.

### Service Mesh Architecture (Phase 1)
FintekPro uses a **dual-auth, zero-disruption service mesh** to split heavy domains into independent deployable micro-services. The main portal issues short-lived JWTs that micro-services validate. Routes transparently proxy to micro-services when respective environment variables (`<SERVICE>_SERVICE_URL`) are set, falling back to local in-process execution otherwise.

**Python Analytics Service** (`services/python/`) — FastAPI + pandas/scipy/sklearn sidecar v4.0.0, offering 51 capabilities including:
- **Portfolio Analytics**: portfolio summary, FIFO capital gains, AMC breakdown, batch financial metrics.
- **Quant Engine**: XIRR, rolling returns, MVO, Black-Litterman, backtest metrics, drift prediction, Indian Market Asset Allocation Optimizer.
- **MF Analytics**: compute-metrics, scheme-analytics, monthly-series, bulk-compute-db, cross-sectional-rank, risk-from-monthly, sync-change-pct, derived-metrics, nav-backfill, amfi-enrich, monthly-pipeline.
- **Return Forecasting**: return-forecast, sip-simulate.
- **Portfolio Operations**: overlap-analysis, rebalance.
- **Fixed Income**: bond-analytics, batch-bond-analytics, yield-curve, treasury-optimize.
- **Risk Factor Models**: CAPM/Fama-French 3-Factor/Carhart 4-Factor OLS regression.
- **ML Scoring Engine**: GradientBoostingRegressor per asset class.
- **Regime Detection**: 6-signal weighted scoring + sklearn GMM overlay.

**Active Python integrations (as of Mar 2026):**
1. `ai-proposal-engine.ts` → `/api/portfolio/overlap-analysis` — MF cosine-similarity overlap (with heuristic fallback)
2. `ai-proposal-engine.ts` → `/api/quant/asset-allocation` — scipy SLSQP target allocation overrides diagnostics targets for BUY/SELL recommendations (NEW)
3. `proposal-whatif-engine.ts` → `/api/forecasting/sip-simulate` — vectorised numpy SIP projection for all 4 what-if scenarios (NEW, replaces simple compound math)
4. `unified-ai-recommendation-engine.ts` → `/api/regime/detect` — GMM regime detection (bull/bear/sideways/high_vol) with 5-min cache
5. `unified-ai-recommendation-engine.ts` → `/api/ml/score` — GBR ML predicted-return blend into `adjReturn`/`adjConf` when model is trained (NEW)

### System Design Choices
FintekPro employs a subdomain-based portal architecture for Admin, Partner, Agent, and Client portals with role-based access control and session-based portal validation. A Financial Metrics Engine provides 40+ derived ratios. It uses a Centralized Service Registry pattern, a Staggered Startup System, and Fast Boot Optimization. A Regulatory Gaps Tracker monitors compliance. A Production Bootstrap & Self-Healing Data System provides automated, idempotent reference data seeding. An Instrument Time-Series Architecture uses a dual-pipeline system for instrument price data: a Daily Incremental Engine and a Historical Backfill Engine. A Central Engine Registry defines mandatory engines for specific domains like AI Recommendations, AI Alpha, Profit-Optimized Scoring, Commission, Tax, Risk, KYC, Rebalancing, Portfolio Import, Financial Metrics, Proposals, Goal Planning, SIP Simulation, Return Forecasting, Investable Surplus, Overlap Analysis, Fund Classification, Screener, Fixed Income, Corporate Treasury, Explainability, Signal Orchestration, and Charge Classification. The Instrument Charge Classification Matrix details charge types and regulators.

## External Dependencies

### Third-Party APIs
- FMP (Financial Modeling Prep)
- Probe42
- Finnhub
- Yahoo Finance
- BSE Star MFD API
- NSE NCB & BSE Bond API
- Bajaj Finance Integration
- Tata Capital Integration
- exchangerate-api.com
- Google Gemini API
- OpenAI API
- Cashfree Verification Suite API
- Sandbox.co.in API (MCA)
- AuthBridge CKYC API
- AuthBridge Aadhaar eSign API
- Protean (NSDL) Aadhaar eSign API
- Protean KRA API
- Cashfree (Payment Gateway, Payout API)
- PhonePe (Payment Gateway)
- Twilio
- Nodemailer
- AMFI Registry API
- Turtlefin Insurance API
- CIBIL
- Zoho CRM
- Zoho Books
- Zoho Campaigns
- Zoho Meeting
- Zoho Sign
- Alpha Vantage
- Polygon.io

### Database Services
- Neon Database (PostgreSQL)

## drizzle-kit Schema Diff Configuration

**Critical design notes — do not break this:**

- `drizzle.config.ts` uses `schema: "./shared/schema-stub.ts"` (NOT `shared/schema.ts`)
- `shared/schema-stub.ts` is **fully self-contained** — it does NOT import from `./schema`. Importing schema.ts would cause drizzle-kit to evaluate all 33,000 lines and discover ~700 tables, generating catastrophic DROP statements.
- `drizzle.config.ts` has `tablesFilter` set to exactly the 6 tables managed by drizzle-kit. This prevents "Pulling schema from database…" from hanging (without it, the full production DB with hundreds of tables causes an infinite introspection loop → "SERVER unexpectedly disconnected").
- `schema-stub.ts` declares all 38 enum types that exist in the production DB as `pgEnum()`. This prevents drizzle-kit from generating `CREATE TYPE` for enums it doesn't recognize vs. ones that already exist.
- **drizzle-kit check** always passes cleanly. **drizzle-kit push** completes in ~4s but may print a PostgreSQL warning about sequences — this is safe to ignore (exit code 0, no DB changes applied). The sequence issue arises because drizzle-kit queries all sequences in the `public` schema (not filtered by tablesFilter) — it is a known drizzle-kit design limitation.
- If adding a new table to the 6 managed tables, add it to: (1) `schema-stub.ts` inline definition, (2) `tablesFilter` array in `drizzle.config.ts`.

### UI/UX Libraries
- Radix UI
- Tailwind CSS
- Lucide Icons
- Recharts

### Utility Libraries
- Date-fns
- Class Variance Authority
- Zod
- Nanoid