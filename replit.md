# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform aimed at personal finance and investment management. It offers a secure, integrated solution for financial planning, portfolio management, and real-time market data across various asset classes including stocks, mutual funds, IPOs, bonds, and unlisted company trading. Key features include family collaboration, unified KYC compliance, an AI-powered financial assistant, and an Unlisted Marketplace. The platform's vision is to empower individual investors and financial advisors with advanced tools and insights, becoming a leading digital financial ecosystem with multi-origination loan lifecycle support.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, shadcn/ui (Radix UI), Tailwind CSS, and Recharts. It emphasizes a mobile-first, responsive design with a `ScrollableTabsList`, a three-part layout (Left Sidebar Navigation, Main Content, Footer), and a collapsible, state-persisted sidebar. Reusable `LoadingState` and `EmptyState` components ensure consistency.

### Technical Implementations
The frontend uses Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation, powered by Vite. The backend is an Express.js application with TypeScript, utilizing PostgreSQL via Drizzle ORM, exposed through a RESTful API. Authentication includes mandatory two-factor OTP and unified login via Passport.js, alongside comprehensive KYC with PAN verification and an Admin portal.

The Unlisted Marketplace is SEBI/RBI-compliant, featuring a multi-methodology price suggestion engine and atomic transaction-based deal matching, requiring Enhanced/Accredited KYC. A Multi-Source Financial Data Enrichment System integrates various providers with priority-based source selection, rate limit handling, and AI guardrails for cost optimization. An API cost optimization system minimizes external calls through request deduplication, AI response caching, and proactive cache warming. A Historical NAV Data Service provides 10+ year data for portfolio metrics. An ISIN-Based Instrument Search System offers comprehensive lookup across asset classes. The Corporate Treasury Management module is SEBI-compliant with a configurable Maker-Checker workflow. The Unified Tax & Compliance Module offers PAN-driven ITR filing, a Unified eSign Service, Form 15CA/15CB support, a Document Vault, and RBAC.

A Centralized Portfolio Import System supports diverse import sources (PDF/HTML, CSV, Excel, URL, API, manual) with a unified type system, normalization, storage, and AI fallback for parsing. This includes a `unified-pdf-parser.ts` for parsing various financial documents, detecting document types (17+ providers), performing layout analysis, semantic data extraction, and building holding lots with confidence scoring. A specialized `cas-statement-service.ts` handles CAMS/KFintech CAS PDF parsing with a FIFO Lot Ledger for transaction normalization and lot creation, a Tax & Exit Load module for capital gains calculations, and an Agent-Safe Import UX. The CAS parsing follows a "LOT-FIRST Architecture" where holdings are derived from individual tax lots. A Tiered Fallback Parser handles incomplete CAS parsing, prioritizing incompleteness over false precision.

A Unified Portfolio Storage System consolidates portfolio data for prospects and registered users, using bifurcated storage (JSON for prospects, `comprehensiveHoldings` table for registered clients). A `unified-holdings-reader-service.ts` provides a single entry point for reading holdings. The platform includes a Capital Gains & Tax Optimization System for tax planning, grandfathering benefits, exit load lookups, tax-efficient sell advice, and indexation benefit calculations.

The platform integrates a Comprehensive Zoho Ecosystem (CRM, Books, Campaigns, Meeting, Sign) with Zoho CRM as the single source of truth. It features a Profit-Optimized AI Recommendation Engine with deterministic scoring and agent governance. A Unified AI Recommendation Engine centralizes AI-powered investment analysis. A Stock Enrichment System consolidates listed stocks into sectors, and an ISIN Intelligence Layer provides automatic instrument classification. "Pick of the Day" offers daily investment recommendations with AI-generated rationale. The Agent Knowledge Hub provides market intelligence and a Gemini-powered Daily AI Market Brief Engine.

The system supports SEBI/RBI-compliant payment handling, FEMA compliance, and international transaction management. It offers Offline & Slow-Internet Resilience via PWA capabilities. A DSA Multi-Financier Loan Routing System ensures RBI Digital Lending Directions 2025 compliance with a credit engine and KFS generation, supported by a DSA Bank Eligibility Matrix System. A Bank OAuth Integration Infrastructure provides secure bank API connectivity. An MCA Integration System manages company financial data, and a Database-First Data Enrichment System optimizes access for unlisted shares.

### System Design Choices
FintekPro uses a subdomain-based portal architecture for Admin, Partner, and Client portals with role-based access control. A Financial Metrics Engine provides 40+ derived ratios. It utilizes a Centralized Service Registry pattern for singleton management. A Staggered Startup System prevents resource contention, and Fast Boot Optimization ensures quick server responsiveness. A Regulatory Gaps Tracker monitors compliance across various regulators.

### Service Consolidation Architecture
The platform is undergoing service consolidation to reduce code duplication:
- **UnifiedOrderNotificationService** (`server/services/unified-order-notification-service.ts`): Centralized order notification handling for all asset types (bonds, mutual funds, unlisted shares, US stocks) with asset-type routing and unified email/SMS initialization. Provides helper methods (notifyBondOrder, notifyMutualFundOrder, etc.) for type-safe calls. Includes backward-compatible method signatures (sendOrderStatusNotification, sendOrderNotification) for drop-in replacement.
- **Unified AI Recommendation Engine** (`server/services/unified-ai-recommendation-engine.ts`): Single entry point for all AI-powered investment recommendations with Gemini (primary) and OpenAI (fallback). Note: Asset-specific routes (stock, bond, commodity) still use individual services - future work to consolidate.
- **Cache Services**: Three overlapping cache layers exist: `unified-data-cache-service.ts` (company/verification data), `investment-cache-service.ts` (market data/AI rationales), `investment-data-cache.ts` (product catalog with stale-while-revalidate). Future consolidation opportunity identified.
- **MF Live Returns System** (`server/services/mf-returns-sync-service.ts`, `mf-returns-scheduler.ts`): Replaces static curated MF returns with live CAGR calculations from MFAPI historical NAV data. Features async database fallback (sanitizeFundForDisplayAsync), in-memory cache with fuzzy name matching, daily 7 AM IST refresh scheduler, and exponential backoff for rate limiting. Proposal paths (generateRebalancingRecommendations, generateFreshInvestmentSuggestions) now use await getFundsFromCategorySanitizedAsync() for DB-backed returns lookup.
- **MF Financial Ratios Engine**: The mf-returns-sync-service calculates risk-adjusted return metrics from historical NAV data:
  - **Calculated from NAV data**: Sharpe Ratio, Sortino Ratio, Standard Deviation, Max Drawdown (uses 6% risk-free rate based on India 10-year G-Sec, 252 trading days for annualization)
  - **Benchmark-relative metrics**: Alpha, Beta, Treynor Ratio, Information Ratio (calculated from aligned NAV/index time series)
  - Database columns: `alpha`, `beta`, `sharpe_ratio`, `sortino_ratio`, `standard_deviation`, `treynor_ratio`, `information_ratio`, `max_drawdown`, `alpha_available`, `beta_available`, `treynor_available`, `information_ratio_available` in mutual_funds table
  - Admin dashboard (`/admin/mf-enrichment`) displays all available metrics with benchmark coverage stats
  - Admin benchmark management (`/admin/mf-benchmarks`) for index data sync, fund-benchmark mapping, and metrics recompute
  - Investment proposal cards show comprehensive fund metrics including ISIN, TER, AUM, and all calculated ratios with explanatory tooltips
- **Benchmark Data Infrastructure**: Market index historical data for relative metrics calculation:
  - `market_indices` table: Stores benchmark index metadata (NIFTY 50, NIFTY Midcap 150, NIFTY Bank, etc.)
  - `market_index_nav` table: Daily close values and returns for each index from Yahoo Finance
  - `mf_benchmark_map` table: Fund-to-benchmark mapping with confidence scoring (0-1.0, min 0.70 for calculation)
  - `benchmark-sync-service.ts`: Daily ingestion of index data from Yahoo Finance
  - `mf-benchmark-mapping-service.ts`: Auto-mapping based on fund category (Large Cap → NIFTY50, Mid Cap → NIFTY Midcap 150, etc.)
  - `mf-relative-metrics-engine.ts`: Rolling time-series alignment and Alpha/Beta/Treynor/IR calculation
- **KYC Orchestrators**: Three-layer architecture: CKYC Orchestrator (provider resolution), Onboarding Orchestrator (17-step state machine), Workflow Orchestrator (verification/vault operations). These are intentionally layered, not duplicates.
- **Navigation**: The Help pillar provides Support, FAQs, and Contact functionality - no duplicate sidebar buttons needed.

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