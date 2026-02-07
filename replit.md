# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It offers secure financial planning, portfolio management, and real-time market data across various asset classes including stocks, mutual funds, IPOs, bonds, and unlisted company trading. Key features include family collaboration, unified KYC, an AI-powered financial assistant, and an Unlisted Marketplace. The platform aims to empower individual investors and financial advisors with advanced tools and insights, establishing itself as a leading digital financial ecosystem with multi-origination loan lifecycle support.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, shadcn/ui (Radix UI), Tailwind CSS, and Recharts, designed for mobile-first responsiveness. It features a `ScrollableTabsList`, a three-part layout (Left Sidebar Navigation, Main Content, Footer), and a collapsible, state-persisted sidebar. Consistent `LoadingState` and `EmptyState` components are used.

### Technical Implementations
The frontend leverages Vite, Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation. The backend is an Express.js application with TypeScript, using PostgreSQL via Drizzle ORM, exposed through a RESTful API. Authentication includes mandatory two-factor OTP, unified login via Passport.js, and comprehensive KYC with PAN verification. An Admin portal is also part of the system.

The platform includes a SEBI/RBI-compliant Unlisted Marketplace with a multi-methodology price suggestion engine and atomic transaction-based deal matching, requiring Enhanced/Accredited KYC. A Multi-Source Financial Data Enrichment System integrates providers with priority-based source selection, rate limit handling, and AI guardrails for cost optimization. An API cost optimization system minimizes external calls via request deduplication, AI response caching, and proactive cache warming. A Historical NAV Data Service provides 10+ year data. An ISIN-Based Instrument Search System offers comprehensive lookup. The Corporate Treasury Management module is SEBI-compliant with a configurable Maker-Checker workflow. The Unified Tax & Compliance Module offers PAN-driven ITR filing, a Unified eSign Service, Form 15CA/15CB support, a Document Vault, and RBAC.

A Centralized Portfolio Import System supports diverse import sources (PDF/HTML, CSV, Excel, URL, API, manual) with a unified type system, normalization, storage, and AI fallback for parsing. This includes a `unified-pdf-parser.ts` for parsing various financial documents, detecting document types, performing layout analysis, semantic data extraction, and building holding lots with confidence scoring. A specialized `cas-statement-service.ts` handles CAMS/KFintech CAS PDF parsing with a FIFO Lot Ledger for transaction normalization and lot creation, a Tax & Exit Load module for capital gains calculations, and an Agent-Safe Import UX, based on a "LOT-FIRST Architecture." A Tiered Fallback Parser handles incomplete CAS parsing.

A Unified Portfolio Storage System consolidates portfolio data for prospects and registered users, using bifurcated storage. A `unified-holdings-reader-service.ts` provides a single entry point for reading holdings. The platform includes a Capital Gains & Tax Optimization System for tax planning, grandfathering benefits, exit load lookups, tax-efficient sell advice, and indexation benefit calculations.

The platform integrates a Comprehensive Zoho Ecosystem (CRM, Books, Campaigns, Meeting, Sign) with Zoho CRM as the single source of truth. It features a Profit-Optimized AI Recommendation Engine with deterministic scoring and agent governance, and a Unified AI Recommendation Engine for centralized investment analysis. A Stock Enrichment System consolidates listed stocks into sectors, and an ISIN Intelligence Layer provides automatic instrument classification. "Pick of the Day" offers daily investment recommendations with AI-generated rationale. The Agent Knowledge Hub provides market intelligence and a Gemini-powered Daily AI Market Brief Engine.

The system supports SEBI/RBI-compliant payment handling, FEMA compliance, and international transaction management. It offers Offline & Slow-Internet Resilience via PWA capabilities. A DSA Multi-Financier Loan Routing System ensures RBI Digital Lending Directions 2025 compliance with a credit engine and KFS generation, supported by a DSA Bank Eligibility Matrix System. A Bank OAuth Integration Infrastructure provides secure bank API connectivity. An MCA Integration System manages company financial data, and a Database-First Data Enrichment System optimizes access for unlisted shares.

A **Builder Funding & Project Finance Module** extends the DSA loan system with a DEVELOPER vertical (loan_vertical enum: RETAIL/MSME/DEVELOPER) and 8 sub-types (BUILDER_FUNDING, PROJECT_FUNDING, CONSTRUCTION_FINANCE, LRD, LAND_FINANCE, INVENTORY_FINANCE, MEZZANINE, BRIDGE). Backed by 7 new database tables (developer_projects, project_land_details, project_approvals, project_cashflows, developer_financials, loan_disbursement_tranches, bank_product_appetite), it provides a 10-step Project Finance Wizard (`project-finance-wizard.tsx`) covering developer info, project details, land details, approvals, financials, cashflow projection, funding structure calculator (LTV/LTC/leverage/EMI), credit summary with 10-rule scoring engine (DSCR, IRR, promoter contribution, approval status, etc.), disbursement milestone planning, and bank selection based on product appetite. The backend (`developer-finance-routes.ts`) includes RBAC enforcement (agent/credit_manager/admin roles) and a compliance-check endpoint validating RERA, land title, and financial readiness before submission. The admin DSA dashboard supports filtering by loan_vertical.

An **Intelligent Lender Matching Engine** (`POST /api/developer-finance/match-lenders`) provides credit-desk–grade auto-shortlisting of 20 banks/NBFCs/AIFs (30 appetite entries) across 5 lender categories (PSU_BANK, PRIVATE_BANK, HFC, NBFC, AIF_PLATFORM). The engine scores each lender against 9 criteria (loan sub-type, project stage, ticket size, city, DSCR, LTV, promoter contribution, track record, credit desk rules) and produces match scores (STRONG/MODERATE/WEAK), category-grouped qualified lenders, and disqualified lenders with reasons. Credit desk rules enforce: PSU banks only for under-construction+, private banks require 2+ completed projects, land finance restricted to NBFCs/AIFs, PSU banks hidden if DSCR<1.2, LRD specialists prioritized for near-completion. The wizard auto-triggers matching on entering Step 10 (Bank Selection) with a visual dashboard showing summary stats, color-coded category badges, match percentages, and expandable disqualified lender list.

### System Design Choices
FintekPro uses a subdomain-based portal architecture for Admin, Partner, and Client portals with role-based access control. A Financial Metrics Engine provides 40+ derived ratios. It utilizes a Centralized Service Registry pattern for singleton management. A Staggered Startup System prevents resource contention, and Fast Boot Optimization ensures quick server responsiveness. A Regulatory Gaps Tracker monitors compliance across various regulators.

### Service Consolidation Architecture
The platform is undergoing service consolidation, including:
- **UnifiedOrderNotificationService**: Centralized order notification handling for all asset types with asset-type routing and unified email/SMS initialization.
- **Unified AI Recommendation Engine**: Single entry point for all AI-powered investment recommendations, primarily using Gemini with OpenAI as fallback.
- **Cache Services**: Three overlapping cache layers (`unified-data-cache-service.ts`, `investment-cache-service.ts`, `investment-data-cache.ts`) for various data types.
- **MF Live Returns System**: Replaces static MF returns with live CAGR calculations from MFAPI historical NAV data, featuring async database fallback, in-memory cache with fuzzy name matching, and a daily refresh scheduler. It also calculates risk-adjusted return metrics (Sharpe Ratio, Sortino Ratio, Standard Deviation, Max Drawdown) and benchmark-relative metrics (Alpha, Beta, Treynor Ratio, Information Ratio).
- **Benchmark Data Infrastructure**: Manages market index historical data, fund-to-benchmark mapping, and daily ingestion of index data.
- **AMFI Benchmark Auto-Parser**: Automatic scheme-level benchmark extraction from AMFI data with normalization, confidence scoring, and admin conflict resolution.
- **BSE Benchmark Parsing Extension**: Extended benchmark system with BSE index support (SENSEX, BSE100, BSE200, BSE500, BSE_LARGEMID, BSE_MIDCAP, BSE_SMALLCAP). Features deterministic precedence rules (Manual > AMFI > BSE > Category), confidence matrix scoring, and SEBI-compliant mf_benchmark_lineage audit trail for source transitions. Admin UI includes color-coded source badges (Manual/AMFI/BSE/Category) and BSE conflict resolution interface.
- **KYC Orchestrators**: A three-layer architecture comprising CKYC Orchestrator, Onboarding Orchestrator (17-step state machine), and Workflow Orchestrator for verification and vault operations.
- **Proposal Builder Enhancements**: Production-grade enhancements for investment advisory proposals including `Phase Validation Gates` (9-phase workflow), a `What-If Simulator` (static and interactive modes), `Goal-Aware Benchmark Mapping` (20+ default mappings), `SIP Source Attribution` (tracking origin of SIP recommendations), `Verdict Normalizer` (enforcing single BUY/HOLD/SELL verdict per instrument), `Report Dependency Resolver` (auto-enabling/disabling sections based on data), and a `Label Registry` (standardizing proposal-related text).
- **Regulator-Grade PDF System**: Production-ready PDF generation with 20 sections (cover page, TOC, executive summary, portfolio overview, recommendations, capital gains, exit load, tax impact, rebalancing/SIP, health score, expense analysis, risk heat map, benchmark comparison, what-if scenarios, dividend projection, priority recommendations, growth projection, disclaimers, advisor declaration), dynamic TOC with page resolution, SHA256 hash embedding, and conditional section rendering.
- **Proposal Audit Trail System**: Comprehensive audit logging with 13 event types (PROSPECT_SELECTED, RISK_PROFILE_SET, HOLDINGS_IMPORTED, ANALYSIS_RUN, VERDICT_FINALIZED, SIP_GENERATED, REPORT_SECTION_TOGGLED, BENCHMARK_OVERRIDDEN, PDF_GENERATED, PDF_DOWNLOADED, PROPOSAL_APPROVED, PROPOSAL_REJECTED, CLIENT_ACKNOWLEDGED), blockchain-style SHA256 checksum chaining for tamper detection, PAN hashing for privacy, role-based override logging with mandatory reason field (agent/admin/compliance), 8-year retention policy, and regulator-ready JSON+CSV export.
- **Database Enrichment Infrastructure**: CLI tool (`server/scripts/run-database-enrichment.ts`) providing batch enrichment operations and reporting. Commands: `report` (gap analysis), `mf` (MF returns sync), `mf-extended` (TER/AUM from MFAPI+GitHub CSV), `stocks` (PE/EPS from Yahoo Finance with sector fallback), `unlisted` (buy/sell pricing from financials or sector defaults), `all` (full batch). Current coverage: 54.6% MF expense ratios, 99.3% stock PE ratios, 100% unlisted pricing. Related services: `MFReturnsSyncService`, `MFExtendedEnrichmentService`, `StockFinancialEnrichmentService`, `DataEnrichmentScheduler` (5 AM IST daily).

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
- Alpha Vantage (replaced IEX Cloud)

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