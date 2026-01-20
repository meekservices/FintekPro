# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It provides tools for portfolio management, real-time market data, and comprehensive financial services including stocks, mutual funds, IPOs, bonds, loans, and unlisted company trading. The platform aims to deliver a secure solution for financial planning, incorporating features such as family collaboration, unified KYC compliance, an AI-powered financial assistant, and an Unlisted Marketplace. Its goal is to empower users with advanced financial tools and insights, serving individual investors and financial advisors, with ambitions to become a leading digital financial ecosystem.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## Pending Features (January 19, 2026)
- **New Prospect Automation Workflow** - When agent adds a new prospect:
  - Notifications (email/SMS confirmation)
  - Zoho CRM auto-sync
  - Auto-generate follow-up tasks
  - Initial lead scoring based on potential value
  - Assignment rules routing
  - Welcome email to prospect

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, shadcn/ui (Radix UI), Tailwind CSS, and Recharts, designed with a mobile-first approach. It features a responsive `ScrollableTabsList`, a consistent three-part layout (Left Sidebar Navigation, Main Content, Footer), and a collapsible, state-persisted sidebar. Reusable components like `LoadingState` and `EmptyState` are standardized.

### Technical Implementations
The frontend uses Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation, powered by Vite. The backend is an Express.js application with TypeScript, utilizing PostgreSQL via Drizzle ORM and a RESTful API. Authentication includes mandatory two-factor OTP and unified login via Passport.js. The platform features comprehensive KYC including PAN verification, real-time product eligibility, and duplicate detection. An Admin portal provides user management and marketing automation.

The Unlisted Marketplace is SEBI/RBI-compliant, sourcing data from an internal database and Sandbox.co.in, featuring a multi-methodology price suggestion engine, atomic transaction-based deal matching, and a compliance framework. Trading access requires Enhanced/Accredited KYC.

A Multi-Source Financial Data Enrichment System reduces API costs by integrating Probe42 (primary), Finnhub (secondary), and Yahoo Finance (tertiary) with priority-based source selection, rate limit handling, and an AI guardrail system. An API cost optimization system minimizes external API calls through request deduplication, AI response caching, and proactive cache warming.

A Historical NAV Data Service provides 10+ year historical data for portfolio metric calculations, sourcing from MFAPI.in with append-only storage and daily background refreshes. It calculates real metrics like Volatility, Max Drawdown, CAGR, and Sharpe Ratio, with graceful fallback to estimation.

The Corporate Treasury Management module is SEBI-compliant, with a configurable Maker-Checker workflow, a four-bucket allocation system, and optimized proposals.

The Unified Tax & Compliance Module is SEBI-compliant, offering PAN-driven ITR filing, a Unified eSign Service, and Form 15CA/15CB support. It includes tax notice management, a Document Vault, and RBAC with immutable audit logging.

External data integration includes a Financial Calendar (RBI, SEBI, NSE, BSE) and a Market Holiday Service. A Portfolio Import System is available.

A **Unified Portfolio Storage System** consolidates portfolio data for both prospects/leads and registered clients:
- **Unified Tables**: `portfolios` and `portfolioHoldings` tables serve both prospect and client portfolios
- **Source Tracking**: Portfolio source field tracks origin: 'manual', 'uploaded', 'cas_fetch', 'pan_fetch', 'broker_sync'
- **Holdings Source Tracking**: Each holding has a `source` field tracking its origin independently (manual, uploaded, cas_fetch, pan_fetch, broker_sync)
- **Refresh Observability**: `lastFetchStatus` (pending/success/failed/skipped) and `lastFetchError` fields track all refresh outcomes
- **Prospect Support**: Added `prospectId`, `sourceFileName`, `lastFetchedAt`, `isVerified` fields to portfolios table
- **Enhanced Holdings**: `portfolioHoldings` includes name, isin, currentValue, investedValue, productType, folioNumber, broker, confidenceScore, source
- **Dual-Write Compatibility**: Portfolio imports write to both JSONB fields and unified tables during migration
- **KYC Completion Flow**: Transfers prospect portfolios to verified user accounts, marks as verified, triggers background BSE STAR CAS refresh
- **CAS Refresh**: Asynchronous background refresh using transaction-safe atomic updates; replaces MF holdings with authoritative CAS data while preserving non-MF holdings; sets source='cas_fetch' and updates status fields
- **Status Transitions**: All refresh paths update status (skipped for missing PAN/user/DOB, failed for CAS errors, success for completed)
- **API Endpoints**: `/api/agent/prospects/:id/portfolio/unified` for unified prospect portfolio data

The platform includes real-time portfolio/market data, financial calculators, multi-asset support, family collaboration, a 3-tier KYC system, and an AI Chat Assistant (Google Gemini).

A Comprehensive Zoho Ecosystem Integration spans Zoho CRM, Books, Campaigns, Meeting, and Sign on India data centers. Zoho CRM acts as the single source of truth for lead management with a two-way sync. Zoho Books handles commission invoicing, Zoho Campaigns manages email marketing, Zoho Meeting facilitates client consultations, and Zoho Sign manages e-signatures for KYC and agreements.

The Profit-Optimized AI Recommendation Engine provides multi-mode recommendations (Conservative, Balanced, Growth-Optimized) with deterministic numeric scoring and suitability scores. It includes agent governance and an A/B testing framework.

A Database-Driven Recommendation Products System manages investment product catalogs for AI-powered proposal generation, storing listed stocks, unlisted stocks, REITs, and InvITs with risk profiles and expected returns. An Admin UI allows CRUD operations and bulk status updates, with a caching service for performance.

A Stock Enrichment System consolidates 2,800+ NSE/BSE listed stocks into 12 broad sectors, utilizing Probe42, NSE/BSE, and Finnhub for data enrichment.

An ISIN Intelligence Layer provides automatic instrument classification from Indian and international ISINs with multi-region support. Features include:
- **Prefix Detection**: INF (MF), INE (Equity/Debt), INS (Govt Securities), INV (AIF), INX (Derivatives)
- **Deep INE Resolution**: Differentiates equity, NCD, MLD, AT1 bonds, and convertibles
- **Edge Case Handling**: MLDs, AT1 bonds, SGBs, convertibles, perpetual instruments
- **Multi-Region Support**: 24 countries across APAC, EMEA, and Americas with regulator mapping
- **ISO 6166 Checksum Validation**: Luhn algorithm for ISIN integrity verification
- **Coverage Dashboard**: Real-time ISIN and region coverage statistics by table and asset class
- **API Endpoints**: /api/isin/detect, /api/isin/validate, /api/isin/checksum/verify, /api/isin/coverage

A **Pick of the Day** feature provides daily investment recommendations for agents with AI-generated rationale:
- **Asset Categories**: Listed Stocks, Mutual Funds, Bonds, Unlisted Companies, Global Stocks, ETFs, REITs/InvITs, Fixed Deposits, SGBs (9 categories total)
- **Tracking Fields**: Date of recommendation, price at recommendation, target price, stoploss price, current price
- **Status Tracking**: live, target_hit, stoploss_hit, expired
- **AI Rationale**: Gemini-powered investment rationale generation with template fallback
- **Scoring Algorithms**: Deterministic scoring using analyst ratings, returns, P/E ratios, CRISIL ratings, credit ratings
- **Target/Stoploss**: Stocks (15%/8%), MFs (12%/5%), Bonds (8%/3%), Unlisted (25%/15%), ETFs (10%/5%), SGBs (8%/3%), REITs (12%/6%)
- **Validity Periods**: Stocks (30d), MFs (90d), Bonds (180d), Unlisted (365d), SGBs (365d), REITs (180d)
- **Performance Stats**: Hit rate, average return, category-wise statistics
- **Frontend**: Dashboard widget + dedicated /agent/picks page with filtering and history
- **Admin Interface**: CRUD operations at /admin/picks with product search autocomplete (auth-protected)
- **API Endpoints**: /api/picks/today, /api/picks/live, /api/picks/history, /api/picks/stats, /api/picks/generate, /api/picks/admin/*, /api/picks/search/products

The Agent Knowledge Hub provides market intelligence, product knowledge, and client communication tools, including a Gemini-powered Daily AI Market Brief Engine and Client Explanation Templates.

The platform implements comprehensive SEBI/RBI-compliant payment handling, including HMAC Signature Verification, Client Money Segregation, Daily Reconciliation, and Trustee Escrow Validation.

FEMA Compliance & International Transaction Management includes RBI Purpose Code Validation, LRS Limit Tracking, TCS Calculation Engine, and RBI A2 Form Generation.

Offline & Slow-Internet Resilience is achieved through PWA capabilities including a Global Network State Manager, Service Worker, Draft Auto-Save Engine, and Action Queue & Sync Engine.

A DSA Multi-Financier Loan Routing System enables multi-bank loan applications with RBI Digital Lending Directions 2025 compliance. It features a credit engine matching applicants to 7 partner banks using multiple routing strategies (parallel, waterfall, priority_first) and generates Key Facts Statements (KFS).

A DSA Bank Eligibility Matrix System provides configurable bank-specific eligibility rules, evaluating multi-criteria factors and offering priority-based bank recommendations.

A Commission Reconciliation Automation System automates payment tracking and matching, supporting payment statement uploads, auto-matching, and dispute handling.

### System Design Choices
The platform utilizes a subdomain-based portal architecture for Admin, Partner, and Client portals, ensuring isolated experiences, security, and role-based access control.

## External Dependencies

### Third-Party APIs
- Probe42
- Finnhub
- Yahoo Finance
- BSE Star MFD API
- NSE NCB & BSE Bond API
- Bajaj Finance Integration
- Tata Capital Integration
- exchangerate-api.com
- Google Gemini API
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
- AMFI Registry API (Simulated)
- Turtlefin Insurance API
- CIBIL
- Zoho CRM
- Zoho Books
- Zoho Campaigns
- Zoho Meeting
- Zoho Sign
- IEX Cloud

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