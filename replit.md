# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It offers secure financial planning, portfolio management, and real-time market data across various asset classes. Key features include family collaboration, unified KYC, an AI-powered financial assistant, an Unlisted Marketplace, and multi-origination loan lifecycle support. The platform aims to empower individual investors and financial advisors with advanced tools and insights, establishing itself as a leading digital financial ecosystem.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## Testing Policy — Single Central Test Account
- **test@fintekpro.com** is the ONLY test account for all FintekPro testing.
- Password: `Test@123456`, OTP: `123456` (fixed for tester role).
- Roles: superadmin, admin, partner, agent, client, user, tester.
- All dev fallbacks use id `central-test-user` and email `test@fintekpro.com`.
- Do NOT create additional demo/test user IDs (demo-user-1, demo@partner.com, admin-dev-1, etc.).
- Scripts: `server/seed-test-user.ts` creates/resets the central account; `create-admin-user.ts` and `update-admin-password.ts` both redirect to `seedTestUser()`.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, shadcn/ui (Radix UI), Tailwind CSS, and Recharts, designed for mobile-first responsiveness. It features a `ScrollableTabsList`, a three-part layout (Left Sidebar Navigation, Main Content, Footer), and a collapsible, state-persisted sidebar. Consistent `LoadingState` and `EmptyState` components are used.

### Technical Implementations
The frontend leverages Vite, Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation. The backend is an Express.js application with TypeScript, using PostgreSQL via Drizzle ORM, exposed through a RESTful API. Authentication includes mandatory two-factor OTP, unified login via Passport.js, and comprehensive KYC with PAN verification. An Admin portal is also part of the system.

The platform includes a SEBI/RBI-compliant Unlisted Marketplace with a multi-methodology price suggestion engine. A Multi-Source Financial Data Enrichment System integrates providers with priority-based source selection. An API cost optimization system minimizes external calls via request deduplication and AI response caching. A Centralized Portfolio Import System supports diverse import sources with a unified type system and AI fallback for parsing, including a `unified-pdf-parser.ts` for financial documents. A `cas-statement-service.ts` handles CAMS/KFintech CAS PDF parsing with a FIFO Lot Ledger. A Unified Portfolio Storage System consolidates portfolio data, and a `unified-holdings-reader-service.ts` provides a single entry point for reading holdings. The platform includes a Capital Gains & Tax Optimization System.

FintekPro integrates a Comprehensive Zoho Ecosystem (CRM, Books, Campaigns, Meeting, Sign). It features a Profit-Optimized AI Recommendation Engine and a Unified AI Recommendation Engine. A Stock Enrichment System consolidates listed stocks, and an ISIN Intelligence Layer provides automatic instrument classification. The Agent Knowledge Hub provides market intelligence and a Gemini-powered Daily AI Market Brief Engine.

The system supports SEBI/RBI-compliant payment handling, FEMA compliance, and international transaction management. It offers Offline & Slow-Internet Resilience via PWA capabilities. A DSA Multi-Financier Loan Routing System ensures RBI Digital Lending Directions 2025 compliance. A Bank OAuth Integration Infrastructure provides secure bank API connectivity. An MCA Integration System manages company financial data, and a Database-First Data Enrichment System optimizes access for unlisted shares.

A **Builder Funding & Project Finance Module** extends the DSA loan system with a DEVELOPER vertical and 8 sub-types (BUILDER_FUNDING, PROJECT_FUNDING, CONSTRUCTION_FINANCE, LRD, LAND_FINANCE, INVENTORY_FINANCE, MEZZANINE, BRIDGE). It features a 10-step Project Finance Wizard with a funding structure calculator and credit summary with a 10-rule scoring engine. An **Intelligent Lender Matching Engine** (`POST /api/developer-finance/match-lenders`) provides credit-desk–grade auto-shortlisting of banks/NBFCs/AIFs across 5 lender categories, scoring each lender against 9 criteria.

A **Multi-Level Partner Hierarchy System** enables hierarchical partner onboarding (Partner → Sub-Partner → Agent) with controlled delegation, commission waterfall, client ownership protection, and audit-ready compliance. A **Partner Payout Statement Service** (`partner-statement-service.ts`) provides transaction-level, auditable payout statements. A **Commission Dispute & Reversal Engine** (`commission-dispute-service.ts`) handles commission disputes and reversals with full audit trails. The **Partner Portal UI** includes "Payout Statement," "How Earnings Work," and "Compliance & Disclosures" tabs.

### System Design Choices
FintekPro uses a subdomain-based portal architecture for Admin, Partner, and Client portals with role-based access control. A Financial Metrics Engine provides 40+ derived ratios. It utilizes a Centralized Service Registry pattern for singleton management. A Staggered Startup System prevents resource contention, and Fast Boot Optimization ensures quick server responsiveness. A Regulatory Gaps Tracker monitors compliance across various regulators.

### Service Consolidation Architecture
The platform is undergoing service consolidation, including:
- **UnifiedOrderNotificationService**: Centralized order notification handling.
- **Unified AI Recommendation Engine**: Single entry point for all AI-powered investment recommendations.
- **Cache Services**: Three overlapping cache layers for various data types.
- **MF Live Returns System**: Replaces static MF returns with live CAGR calculations, including risk-adjusted return metrics and benchmark-relative metrics.
- **Benchmark Data Infrastructure**: Manages market index historical data, fund-to-benchmark mapping, and daily ingestion of index data. This includes an **AMFI Benchmark Auto-Parser** and a **BSE Benchmark Parsing Extension**.
- **KYC Orchestrators**: A three-layer architecture comprising CKYC, Onboarding, and Workflow Orchestrators. Extended with KYC Wizard v2 including: Video KYC Infrastructure (`kyc-video-service.ts`), Maker-Checker Workflow Engine (`kyc-maker-checker-service.ts`), Rejection/Dispute/Re-KYC Flow (`kyc-rejection-service.ts`), Product Eligibility Rule Engine (`kyc-product-eligibility-service.ts`), SEBI/RBI Audit Pack Generator (`kyc-audit-pack-service.ts`), Webhook + Async Retry Framework with DLQ (`kyc-webhook-service.ts`), Environment & Provider Control Flags (`kyc-environment-service.ts`), AES-256-GCM Encryption for Aadhaar/PAN (`kyc-encryption-service.ts`), Rate Limiting with auto-lock (`kyc-rate-limiter-service.ts`). Routes in `server/routes/kyc/v2-extensions.ts`. Frontend pages: `/admin/kyc-v2-management` (6-tab admin console), `/product-eligibility`, `/kyc-rejections`. DB tables: `kyc_video_sessions`, `kyc_approvals`, `kyc_rejection_events`, `kyc_product_eligibility_rules`, `kyc_audit_packs`, `kyc_webhook_events`, `kyc_rate_limit_counters`.
- **Proposal Builder Enhancements**: Production-grade enhancements for investment advisory proposals including `Phase Validation Gates`, a `What-If Simulator`, and `Goal-Aware Benchmark Mapping`.
- **Regulator-Grade PDF System**: Production-ready PDF generation with 20 sections, dynamic TOC, SHA256 hash embedding, and conditional section rendering.
- **Proposal Audit Trail System**: Comprehensive audit logging with blockchain-style SHA256 checksum chaining for tamper detection, PAN hashing, and role-based override logging.
- **Database Enrichment Infrastructure**: CLI tool providing batch enrichment operations for MF, stocks, and unlisted data.
- **MF Comprehensive Enrichment Pipeline**: 5-phase SEBI-compliant mutual fund data enrichment with GitHub CSV AUM/category (Phase 1), ExtendedData JSONB extraction (Phase 2), MFAPI metadata sub-category/launch date (Phase 3), MFAPI returns & financial ratios (Phase 4), and category-based defaults (Phase 5). All enrichment changes are logged to `mf_enrichment_audit_logs` with enrichmentRunId for full traceability. AUM history tracked in `mf_aum_history` with anomaly detection (>20% flagged). SEBI Category Rules Engine (`mf-sebi-category-engine.ts`) seeds 37 official SEBI MF categorization rules from circular SEBI/HO/IMD/DF3/CIR/P/2017/114 into `mf_category_rules`. Internal MF APIs at `/api/funds/*` (list, detail, category filter, AUM history, audit logs, SEBI rules, null stats). Admin enrichment routes at `/api/admin/enrichment/mf/*` (comprehensive stats/progress/run, SEBI rules seed, category stats, audit logs, validate categories). DB tables: `mf_enrichment_audit_logs`, `mf_aum_history`, `mf_category_rules`.

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
- Alpha Vantage

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