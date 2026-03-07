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

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, shadcn/ui (Radix UI), Tailwind CSS, and Recharts, ensuring a mobile-first and responsive design. It features a `ScrollableTabsList`, a three-part layout (Left Sidebar Navigation, Main Content, Footer), a collapsible, state-persisted sidebar, and consistent `LoadingState` and `EmptyState` components. A Multi-Portal Brand Segregation System dynamically brands portals using a `PortalType` enum, SVG logos, and a `PortalThemeProvider.tsx`.

### Technical Implementations
The frontend utilizes Vite, Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation. The backend is an Express.js application with TypeScript, using PostgreSQL via Drizzle ORM, exposed as a RESTful API. Authentication includes mandatory two-factor OTP, unified login via Passport.js, and comprehensive KYC. An Admin portal is also provided.

FintekPro incorporates an AMFI Subscription Sync System, a Regulatory Investability Service, and an AI MF recommendation service. Payment and callback services use a centralized `getAppBaseUrl()` for production domain resolution. The platform includes a SEBI Feb 26, 2026 Circular Compliance System with taxonomy versioning, an upgraded SEBI Category Engine, True-to-Label Naming Compliance, Lifecycle Glide Path Validator, Compliance State Machine, and SEBI Scheme-to-Scheme Overlap Service. It features a SEBI/RBI-compliant Unlisted Marketplace with a multi-methodology price suggestion engine and an Institutional-Grade Unlisted Equity Lifecycle. Other key systems include Multi-Source Financial Data Enrichment, Centralized Portfolio Import, Unified Portfolio Storage with Capital Gains & Tax Optimization, and integration with the Zoho Ecosystem (CRM, Books, Campaigns, Meeting, Sign) via a two-way sync system.

The platform includes a Profit-Optimized AI Recommendation Engine, a Unified AI Recommendation Engine, Stock Enrichment System, ISIN Intelligence Layer, Agent Knowledge Hub, Gemini-powered Daily AI Market Brief Engine, and a DB-First Stock Screener. It supports SEBI/RBI-compliant payment handling, FEMA compliance, international transaction management, Offline & Slow-Internet Resilience via PWA, a DSA Multi-Financier Loan Routing System (RBI Digital Lending Directions 2025 compliant), Bank OAuth Integration Infrastructure, and an MCA Integration System. A Builder Funding & Project Finance Module extends the DSA loan system with a DEVELOPER vertical, a 10-step Project Finance Wizard, and an Intelligent Lender Matching Engine, complemented by a Banker Contacts Directory.

A Multi-Level Partner Hierarchy System enables hierarchical partner onboarding, commission waterfall, and client ownership protection, supported by a Partner Payout Statement Service and a Commission Dispute & Reversal Engine. A Multi-Bank Account System supports up to 5 bank accounts per user with penny-drop verification. Core services include UnifiedOrderNotificationService, Cache Services, MF Live Returns System, Benchmark Data Infrastructure, and a three-layer KYC Orchestrators. Enhancements include Proposal Builder features (Strategy-Locked Advisor-Controlled System with Fair Backtesting), a Regulator-Grade PDF System, a Proposal Audit Trail System, a Database Enrichment Infrastructure, a MF Comprehensive Enrichment Pipeline, and a Lead Leakage Prevention & Detection System.

A **Tax-Loss Harvesting Engine** proactively scans portfolios for loss positions based on materiality filters, calculates potential tax savings, suggests equivalent replacement funds from different AMCs, and generates `TAX_LOSS_HARVEST` recommendations. This engine is integrated into the rebalancing recommendations and reflected in the Proposal Wizard. The **Proposal Builder Alpha Engine** (Fresh Investment Suggestions) has been upgraded to a 4-layer alpha generation system: DB-First MF Fund Discovery, `daily_picks` Integration for diverse instruments, Anti-Overdiversification Cap, and Existing Holdings Overlap Guard. The AI Stock Pick of the Day service now routes through the `unifiedAIRecommendationEngine` (OpenAI primary, Gemini fallback).

FintekPro's Agent Portal includes 5 BuildWealth-inspired advisor tools: Investment Baskets, SIP Health Monitor, Portfolio Drift Monitor, Order-on-Behalf Console, and Market Alert Center. A Consolidated MF Metrics System strictly separates `mutual_funds` and `mutual_fund_metrics` for data integrity. The Proposal Builder includes AI_DRIVEN/MANUAL allocation, strategy snapshot locking, fair backtesting, and validation. An AI Alpha Engine provides a regime-aware, backtest-validated, Sharpe-optimized system for "Pick of the Day." A Formalized KYC Engine provides priority-based provider selection with automatic fallback routing, including a KYC Providers Registry and an Immutable Audit Trail. A Scheme Master Governance System provides ISIN-based fund identification with DB-driven transaction eligibility rules.

### Service Mesh Architecture (Phase 1)
FintekPro uses a **dual-auth, zero-disruption service mesh** to split heavy domains into independent deployable micro-services. The main portal issues short-lived JWTs that micro-services validate, maintaining the main portal's existing session/cookie/Passport auth. Routes transparently proxy to micro-services when respective environment variables (`<SERVICE>_SERVICE_URL`) are set, falling back to local in-process execution otherwise, enabling zero-downtime migration. Deployed service packages live in `services/`, e.g., `services/insurance/` for `ins.fintekpro.com`.

**Python Analytics Service** (`services/python/`) — FastAPI + pandas/scipy sidecar for compute-heavy work:
- Portfolio summary with pandas (asset allocation, AMC breakdown, gain/loss)
- FIFO capital gains engine (STCG/LTCG split, tax estimate, per-lot detail)
- XIRR calculation (arbitrary cashflows or auto-fetched from DB)
- Rolling returns (1Y/3Y/5Y CAGR from NAV history)
- AMC-breakdown for agents (AUM, trail estimate, client count)
- Proxy client: `server/clients/python-client.ts` | Routes: `server/routes/python-proxy.ts`
- Activate: set `PYTHON_SERVICE_URL=<deployed URL>` — all `/api/python/*` routes proxy transparently
- Deploy: copy `services/python/` to a new Python Replit repl; set `PRODUCTION_DATABASE_URL` + `SESSION_SECRET`

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