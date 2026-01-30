# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform designed for personal finance and investment management. It provides a secure, integrated solution for financial planning, portfolio management, and real-time market data across various asset classes including stocks, mutual funds, IPOs, bonds, and unlisted company trading. The platform includes features such as family collaboration, unified KYC compliance, an AI-powered financial assistant, and an Unlisted Marketplace. FintekPro aims to empower individual investors and financial advisors with advanced tools and insights, with the vision of becoming a leading digital financial ecosystem.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, shadcn/ui (Radix UI), Tailwind CSS, and Recharts, emphasizing a mobile-first, responsive design. It features a `ScrollableTabsList`, a three-part layout (Left Sidebar Navigation, Main Content, Footer), and a collapsible, state-persisted sidebar. Reusable components like `LoadingState` and `EmptyState` ensure consistency across the application.

### Technical Implementations
The frontend uses Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation, all powered by Vite. The backend is an Express.js application with TypeScript, utilizing PostgreSQL via Drizzle ORM, exposed through a RESTful API. Authentication includes mandatory two-factor OTP and unified login via Passport.js. Comprehensive KYC with PAN verification and an Admin portal are integrated.

The Unlisted Marketplace is SEBI/RBI-compliant, sourcing data from internal and external databases, featuring a multi-methodology price suggestion engine and atomic transaction-based deal matching. Trading requires Enhanced/Accredited KYC.

A Multi-Source Financial Data Enrichment System integrates various providers with priority-based source selection, rate limit handling, and an AI guardrail for cost optimization. An API cost optimization system minimizes external calls through request deduplication, AI response caching, and proactive cache warming. A Historical NAV Data Service provides 10+ year historical data for portfolio metric calculations, supporting daily refreshes.

An ISIN-Based Instrument Search System offers comprehensive ISIN lookup capabilities across all asset classes through dedicated search endpoints and UI components. The Corporate Treasury Management module is SEBI-compliant with a configurable Maker-Checker workflow. The Unified Tax & Compliance Module offers PAN-driven ITR filing, a Unified eSign Service, and Form 15CA/15CB support, with a Document Vault and RBAC.

A Centralized Portfolio Import System supports diverse import sources (PDF/HTML, CSV, Excel, URL, API, manual) with a unified type system, normalization, and storage, including AI fallback for parsing. The `unified-portfolio-import-service.ts` provides centralized import methods:
- `importFromPDF()`: PDF broker statements and CAS statements
- `importFromHTML()`: HTML portfolio exports
- `importFromCSV()`: CSV files with flexible column detection (supports 10+ header variations)
- `importFromExcel()`: Excel files (.xlsx, .xls) using the xlsx package
- `importFromURL()`: URL-based portfolio imports (Wealthy.in, etc.)

CSV/Excel import features flexible column detection supporting:
- Names: name, scheme, fund, security, stock, scrip
- Symbols: symbol, ticker, scrip code, nse, bse
- Quantities: quantity, qty, units, shares
- Prices: avg, average, cost, price, nav, buy price
- Types: type, asset, category, product
- Dates: date, purchase date, buy date

A **Unified PDF Parser** (`unified-pdf-parser.ts`) provides a single entry point for all PDF parsing operations, combining text extraction, document profiling, semantic data extraction, and holding lots building. Features include:
- Document type detection for 17+ providers (brokers: Zerodha, Groww, ICICI Direct, HDFC, Kotak, Upstox, Angel One, 5Paisa, Motilal Oswal, Axis Direct, IIFL, Sharekhan; aggregators: MF Central, INDmoney, Kuvera, ET Money, Paytm Money)
- Layout analysis with page zone detection and AMC block identification
- Semantic extraction of holdings, transactions, and investor information
- Purchase date resolution from transaction history
- Holding lots builder for SIP lot tracking and LTCG/STCG calculations
- Confidence scoring with component breakdown
- Pattern learning from successful parses
- Parsing metrics and observability

A **CAS Statement Service** (`cas-statement-service.ts`) provides specialized CAMS/KFintech CAS PDF parsing with comprehensive advisory features:
- **Epic 1 - Parsing Core**: ISIN+Folio+Demat anchored scheme block segmentation, multi-line valuation extraction (handles pdf-parse output format), strict 0.5% reconciliation guardrail using pre-enrichment values
- **Epic 2 - FIFO Lot Ledger** (`fifo-lot-ledger-service.ts`): Transaction normalization (ignores metadata rows), lot creation from purchases, FIFO consumption from redemptions, closing balance reconciliation
- **Epic 3 - Tax & Exit Load** (`lot-tax-calculator-service.ts`): Asset classification (Equity/Debt/Hybrid/Gold/International), lot-level STCG/LTCG calculation with correct holding period thresholds, exit load simulation
- **Epic 4 - Agent-Safe Import UX**: Per-holding confidence scores, warnings metadata, `/api/cas-statement/audit-view` endpoint, `/api/cas-statement/tax-analysis` endpoint (gated on reconciliation success)
- **Epic 5 - Regression Tests** (`cas-parser-regression-test.ts`): Golden CAS fixtures, format variance tests (single-line, multi-line, demat, multi-folio), date parsing tests

CAS parsing architecture:
1. Parse text from PDF using unified-pdf-parser
2. Extract investor info, Portfolio Summary, and scheme blocks
3. Calculate pre-enrichment summary for strict reconciliation
4. Perform reconciliation against CAS Portfolio Summary (0.5% threshold)
5. Enrich holdings from database (updates NAVs with current values)
6. Build FIFO lot ledger from transactions
7. Return comprehensive result with confidence scores and warnings

Test runner: `npx tsx server/tests/run-cas-tests.ts` or `/api/cas-statement/run-tests` (dev mode only)

A Unified Portfolio Storage System consolidates portfolio data for prospects and registered users, ensuring data consistency between the AI Advisory engine and Proposal Builder. The architecture follows a bifurcated storage pattern:
- **Prospects**: Holdings stored in `prospectClients.currentPortfolio` JSON field
- **Registered clients (post-KYC)**: Holdings stored in `comprehensiveHoldings` table

Key services:
- `unified-holdings-reader-service.ts`: Single entry point for reading holdings - routes to correct storage based on client type
- `kyc-portfolio-migration-service.ts`: Handles KYC completion flow - migrates prospect data to comprehensiveHoldings, clears prospect holdings, enables auto-sync
- `aa-consent-routes.ts`: Account Aggregator consent management with RBI-compliant audit trail

Auto-sync flow for registered clients: consent granted → clear existing holdings (prevents duplicates) → fetch from AA → store with ISIN+folioNumber duplicate check → update consent timestamp. Import staging UI (`ImportedHoldingsReview.tsx`) allows users to review, approve, edit, or reject individual holdings before final sync to comprehensiveHoldings.

A **Capital Gains & Tax Optimization System** (`proposal-capital-gains-service.ts`, `capital-gains.ts`) provides comprehensive tax planning:
- LTCG/STCG thresholds: Equity 365 days, pre-Apr 2023 debt 1095 days (with indexation), post-Apr 2023 debt 730 days, gold/silver 730 days
- Grandfathering benefit using actual Jan 31, 2018 NAV (for equity purchased before Feb 2018)
- Exit load lookup by ISIN from database with calendar view showing upcoming exit-load-free dates
- Tax-efficient sell advice API with SELL_NOW/WAIT_FOR_LTCG/WAIT_FOR_EXIT_LOAD recommendations
- Indexation benefit calculator for debt funds purchased before April 2023 with CII data through 2025-26
- ITR Schedule CG export with ESTIMATE/ACTUAL modes for tax filing (sections A1, A2, B, C)
- What-if redemption simulator for tax impact analysis

The platform integrates a Comprehensive Zoho Ecosystem covering CRM, Books, Campaigns, Meeting, and Sign, with Zoho CRM as the single source of truth. A Profit-Optimized AI Recommendation Engine provides multi-mode recommendations with deterministic numeric scoring, agent governance, and A/B testing. A Unified AI Recommendation Engine centralizes AI-powered investment analysis across nine product categories.

A Stock Enrichment System consolidates NSE/BSE listed stocks into broad sectors, and an ISIN Intelligence Layer provides automatic instrument classification. A "Pick of the Day" feature offers daily investment recommendations with AI-generated rationale. The Agent Knowledge Hub provides market intelligence and a Gemini-powered Daily AI Market Brief Engine.

The platform implements SEBI/RBI-compliant payment handling, FEMA compliance, and international transaction management. Offline & Slow-Internet Resilience is achieved through PWA capabilities. A DSA Multi-Financier Loan Routing System enables multi-bank loan applications with RBI Digital Lending Directions 2025 compliance, featuring a credit engine and KFS generation. A DSA Bank Eligibility Matrix System provides configurable bank-specific eligibility rules.

A Bank OAuth Integration Infrastructure provides secure bank API connectivity, including encrypted credential storage, token management, API rate limiting, and RBI-compliant audit logging. An MCA Integration System provides company financial data management with direct payment processing and Zoho Books auto-sync. A Database-First Data Enrichment System for unlisted shares implements a tiered data access pattern for cost optimization.

### System Design Choices
The platform utilizes a subdomain-based portal architecture for Admin, Partner, and Client portals with role-based access control. A Financial Metrics Engine provides 40+ derived ratios for investment analysis. FintekPro uses a Centralized Service Registry pattern for singleton management. A Staggered Startup System prevents resource contention during server initialization, and a Fast Boot Optimization ensures the server accepts requests quickly while non-critical services initialize in the background. A Regulatory Gaps Tracker monitors compliance across SEBI, RBI, IRDAI, MCA, and ITD regulators.

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