# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It provides secure financial planning, portfolio management, and real-time market data across diverse asset classes. Key capabilities include family collaboration, a unified KYC system, an AI-powered financial assistant, an Unlisted Marketplace, and comprehensive multi-origination loan lifecycle support. The platform aims to be a leading digital financial ecosystem, empowering individual investors and financial advisors with advanced tools and insights.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.
Never build duplicate engines — always upgrade existing ones in place. No parallel systems doing the same work.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, shadcn/ui (Radix UI), Tailwind CSS, and Recharts, ensuring a mobile-first and responsive design. It features a `ScrollableTabsList`, a three-part layout (Left Sidebar Navigation, Main Content, Footer), a collapsible, state-persisted sidebar, and consistent `LoadingState` and `EmptyState` components. A Multi-Portal Brand Segregation System dynamically brands portals using a `PortalType` enum, SVG logos, and a `PortalThemeProvider.tsx`.

### Technical Implementations
The frontend utilizes Vite, Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation. The backend is an Express.js application with TypeScript, using PostgreSQL via Drizzle ORM, exposed as a RESTful API. Authentication includes mandatory two-factor OTP, unified login via Passport.js, and comprehensive KYC. An Admin portal is also provided.

FintekPro incorporates an AMFI Subscription Sync System (`amfi-subscription-sync-service.ts`) that derives per-fund lumpsum/SIP eligibility dynamically from mfapi.in scheme metadata (close-ended → CLOSED, discontinued → DISCONTINUED, open-ended → OPEN), writing results to `scheme_transaction_rules`. The `RegulatoryInvestabilityService` defaults overseas investment flags to `false` (open) and uses the DB as the live gate instead of a hardcoded blanket freeze. The AI MF recommendation service (`ai-mf-recommendation-service.ts`) uses `isFundInvestableAsync()` (DB-driven, per-fund) instead of the legacy sync check. The `LEGACY_PURCHASE_RESTRICTED_FUNDS` hardcoded array (renamed from `PURCHASE_RESTRICTED_FUNDS`) is retained only as a DB-unreachable fallback with a warning log. Admin endpoints `POST/GET /api/admin/subscription-sync/trigger|status` allow manual sync triggering. Boot-time sync runs on production. Payment/callback services (`bbpsService`, `cashfree-service`, `phonepe-service`, `unlisted-escrow-service`, `twilio-voice-service`) now use centralized `getAppBaseUrl()` from `server/utils/app-url.ts` which correctly resolves `REPLIT_DOMAINS` in production instead of falling back to `http://localhost:5000`.

FintekPro incorporates a SEBI Feb 26, 2026 Circular Compliance System with features like taxonomy versioning, an upgraded SEBI Category Engine, True-to-Label Naming Compliance, Lifecycle Glide Path Validator, Compliance State Machine, and SEBI Scheme-to-Scheme Overlap Service. It includes a SEBI/RBI-compliant Unlisted Marketplace with a multi-methodology price suggestion engine, an Institutional-Grade Unlisted Equity Lifecycle (valuation governance, append-only valuation history, client disclosure log, enrichment staleness engine, quarterly cron-driven staleness sweep, admin health dashboard at `GET /api/unlisted/admin/health`), a Multi-Source Financial Data Enrichment System, a Centralized Portfolio Import System, and a Unified Portfolio Storage System with a Capital Gains & Tax Optimization System.

The platform integrates with the Zoho Ecosystem (CRM, Books, Campaigns, Meeting, Sign) via a production-ready two-way sync system with conflict resolution, distributed sync locks, idempotency guards, and a dead-letter queue. It also features a Profit-Optimized AI Recommendation Engine, a Unified AI Recommendation Engine, a Stock Enrichment System, an ISIN Intelligence Layer, an Agent Knowledge Hub, a Gemini-powered Daily AI Market Brief Engine, and a DB-First Stock Screener.

The system supports SEBI/RBI-compliant payment handling, FEMA compliance, international transaction management, Offline & Slow-Internet Resilience via PWA, a DSA Multi-Financier Loan Routing System (RBI Digital Lending Directions 2025 compliant), a Bank OAuth Integration Infrastructure, and an MCA Integration System. A Builder Funding & Project Finance Module extends the DSA loan system with a DEVELOPER vertical, a 10-step Project Finance Wizard, and an Intelligent Lender Matching Engine. A Banker Contacts Directory is included for managing financier details.

A Multi-Level Partner Hierarchy System enables hierarchical partner onboarding, commission waterfall, and client ownership protection, complemented by a Partner Payout Statement Service and a Commission Dispute & Reversal Engine. A Multi-Bank Account System supports up to 5 bank accounts per user with penny-drop verification. Core services include UnifiedOrderNotificationService, Cache Services, MF Live Returns System, Benchmark Data Infrastructure, and a three-layer KYC Orchestrators. Enhancements include Proposal Builder features (Strategy-Locked Advisor-Controlled System with Fair Backtesting), a Regulator-Grade PDF System, a Proposal Audit Trail System, a Database Enrichment Infrastructure, a MF Comprehensive Enrichment Pipeline, and a Lead Leakage Prevention & Detection System.

A **Tax-Loss Harvesting Engine** (`scanTaxLossHarvestingOpportunities()` in `agent-prospect-wizard-service.ts`) proactively scans the entire portfolio for loss positions (not just those already being sold for other reasons). Materiality filter: unrealised loss > ₹10,000 AND > 3% of invested cost. For each qualifying position it: calculates STCG (20%) / LTCG (12.5%) / Slab (30%) tax saving plus 4% cess, estimates exit load (1% for equity < 1 year, else 0), computes net harvest benefit, queries the live `mutual_funds` table for an equivalent fund from a different AMC as the replacement suggestion, and generates a `TAX_LOSS_HARVEST` recommendation. The engine is called after the Alpha Engine step inside `generateRebalancingRecommendations()`. `calculateTaxSummary()` now accepts harvest recs as a second parameter and returns `harvestedLosses`, `estimatedTaxSaving`, `netHarvestBenefit`, `harvestDetails`, and `netRebalancingCostAfterHarvest`. Step 9 of the Proposal Wizard renders TAX_LOSS_HARVEST cards with an indigo border, "TAX HARVEST" badge, and a full detail panel (unrealised loss, tax type, tax saving, replacement fund). Step 10 shows a full Tax-Loss Harvesting Benefit section with per-position table and net savings summary.

The **Proposal Builder Alpha Engine** (Step 11 — Fresh Investment Suggestions) has been upgraded to a 4-layer alpha generation system: **(1) DB-First MF Fund Discovery** — queries the live `mutual_funds` table (15K+ schemes) per SEBI category + risk profile, sorted by 3Y returns and CRISIL risk-adjusted score, replacing the old 60-fund hardcoded catalog; **(2) daily_picks Integration** — for listed stocks, bonds, REITs, ETFs, and unlisted instruments, AI-curated `daily_picks` (status='live') are used as primary source with target price, stop-loss, and AI rationale; **(3) Anti-Overdiversification Cap** — hard limit of 6/8/10 total instruments based on investment size (≤₹5L/≤₹25L/>₹25L), categories processed in descending allocation order; **(4) Existing Holdings Overlap Guard** — subcategory keyword extraction from existing holdings prevents duplicate exposure (e.g., won't suggest a new small cap fund if client already holds one). The **AI Stock Pick of the Day** service now routes through the `unifiedAIRecommendationEngine` (OpenAI primary, Gemini fallback) for per-stock Gemini analysis instead of a flat rule-based 18% target formula. **SEBI category keyword mappings** (`SEBI_CATEGORY_MAP`) defined in `agent-prospect-wizard-service.ts` drive DB queries: equity keywords like 'Flexi Cap Fund', 'Mid Cap Fund', 'Small Cap Fund', etc. Helper functions: `getDbFundsForCategory()` and `getDailyPicksForCategory()`.

FintekPro's Agent Portal now includes 5 BuildWealth-inspired advisor tools: **Investment Baskets** (`/agent/baskets`) — agent-curated thematic portfolios ("Wealthy Ideas") with CRUD, instrument add/remove, allocation validation, and WhatsApp share; **SIP Health Monitor** (`/agent/sip-health`) — cross-client SIP status dashboard with lapsed/expiring/active grouping and one-click WhatsApp renewal; **Portfolio Drift Monitor** (`/agent/portfolio-drift`) — detects asset allocation drift vs risk profile targets with colour-coded drift scores and expandable breakdown; **Order-on-Behalf Console** (new "For Clients" tab in `/agent/orders`) — agent places MF/stock orders for clients with consent checkbox, amber warning banner, and full order history; **Market Alert Center** (`/agent/market-alerts`) — scans all client holdings for moves ≥2.5%, groups by gainer/decliner, per-client WhatsApp contact button, 15-minute cache. Schema: `agent_baskets` and `agent_basket_items` tables created directly via SQL (drizzle-kit push times out on large schema). Routes: `server/routes/agent-baskets.ts`, `server/routes/agent-sip-health.ts`, `server/routes/agent-portfolio-drift.ts`, `server/routes/agent-client-orders.ts`, `server/routes/agent-market-alerts.ts`.

A Consolidated MF Metrics System strictly separates `mutual_funds` (API-fetched fields) and `mutual_fund_metrics` (calculated/derived fields per fiscal year) to avoid duplicate columns and ensure data integrity. The Proposal Builder includes AI_DRIVEN/MANUAL allocation, strategy snapshot locking, fair backtesting, portfolio difference summary, AI allocation override prevention, strategy integrity validation, and forced new version on allocation change after lock. An AI Alpha Engine, natively in TypeScript, provides a regime-aware, backtest-validated, Sharpe-optimized system for "Pick of the Day." A Formalized KYC Engine provides priority-based provider selection with automatic fallback routing, including a KYC Providers Registry, Provider Priority System, Product Configuration, Identity Token Service, DPDP Consent Layer, and an Immutable Audit Trail. A Scheme Master Governance System provides ISIN-based fund identification with DB-driven transaction eligibility rules.

### Service Mesh Architecture (Phase 1)
FintekPro uses a **dual-auth, zero-disruption service mesh** to split heavy domains into independent deployable micro-services. The main portal issues short-lived JWTs (`GET /api/auth/service-token`, 15-min, signed with `SESSION_SECRET`) that each micro-service validates. The main portal's existing session/cookie/Passport auth is never touched. Routes in the main portal stay identical to the frontend — they proxy transparently to the micro-service when `<SERVICE>_SERVICE_URL` env var is set; when it is not set they fall through to the local in-process fallback. This means zero downtime migration: deploy the service, then flip the env var.

**Deployed service packages** live in `services/`:
- `services/insurance/` — `ins.fintekpro.com` — Turtlefin policy data, IRDAI suitability assessments, insurance holdings. Activate by setting `INSURANCE_SERVICE_URL=https://ins.fintekpro.com` on the main portal.

**Key files**: `server/utils/service-token.ts` (JWT issue/verify), `server/clients/insurance-client.ts` (proxy), `server/auth.ts` (`GET /api/auth/service-token`).

### System Design Choices
FintekPro employs a subdomain-based portal architecture for Admin, Partner, Agent, and Client portals with role-based access control and session-based portal validation. A Financial Metrics Engine provides 40+ derived ratios. It uses a Centralized Service Registry pattern, a Staggered Startup System, and Fast Boot Optimization. A Regulatory Gaps Tracker monitors compliance. A Production Bootstrap & Self-Healing Data System provides automated, idempotent reference data seeding on every server startup. An Instrument Time-Series Architecture uses a dual-pipeline system for instrument price data: a Daily Incremental Engine and a Historical Backfill Engine. A Central Engine Registry defines mandatory engines for specific domains like AI Recommendations, AI Alpha, Profit-Optimized Scoring, Commission, Tax, Risk, KYC, Rebalancing, Portfolio Import, Financial Metrics, Proposals, Goal Planning, SIP Simulation, Return Forecasting, Investable Surplus, Overlap Analysis, Fund Classification, Screener, Fixed Income, Corporate Treasury, Explainability, Signal Orchestration, and Charge Classification. The Instrument Charge Classification Matrix details charge types and regulators.

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