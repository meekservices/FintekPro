# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It provides a secure, integrated solution for financial planning, offering tools for portfolio management, real-time market data, and a comprehensive suite of financial services including stocks, mutual funds, IPOs, bonds, loans, and unlisted company trading. Key features include family collaboration, unified KYC compliance, an AI-powered financial assistant, and an Unlisted Marketplace. The platform aims to empower users with advanced financial tools and insights, serving individual investors and financial advisors, with ambitions to become a leading digital financial ecosystem.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, shadcn/ui (Radix UI), Tailwind CSS, and Recharts, with a mobile-first, responsive design. It features a `ScrollableTabsList`, a three-part layout (Left Sidebar Navigation, Main Content, Footer), and a collapsible, state-persisted sidebar. Reusable components like `LoadingState` and `EmptyState` ensure consistency.

### Technical Implementations
The frontend leverages Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation, all built with Vite. The backend is an Express.js application with TypeScript, utilizing PostgreSQL via Drizzle ORM, exposed through a RESTful API. Authentication includes mandatory two-factor OTP and unified login via Passport.js. The platform features comprehensive KYC with PAN verification, real-time product eligibility, and an Admin portal for user and marketing management.

The Unlisted Marketplace is SEBI/RBI-compliant, sourcing data from an internal database and Sandbox.co.in, including a multi-methodology price suggestion engine and atomic transaction-based deal matching. Trading requires Enhanced/Accredited KYC.

A Multi-Source Financial Data Enrichment System integrates Probe42, Finnhub, and Yahoo Finance with priority-based source selection, rate limit handling, and an AI guardrail system for cost reduction. An API cost optimization system minimizes external calls through request deduplication, AI response caching, and proactive cache warming.

A Historical NAV Data Service provides 10+ year historical data from MFAPI.in for portfolio metric calculations, supporting daily background refreshes and calculating metrics like Volatility, Max Drawdown, CAGR, and Sharpe Ratio.

An **ISIN-Based Instrument Search System** provides comprehensive ISIN lookup capabilities across all asset classes:
- **Database Column**: `isin` column in `mutual_funds` table with database index for efficient searching
- **Search Endpoints**: `/api/instruments/search`, `/api/mutual-funds/autocomplete` support ISIN alongside name/symbol
- **Price Lookup**: Single (`GET /api/instruments/price/:isin`) and bulk (`POST /api/instruments/prices`) endpoints
- **Multi-Source Search**: Queries `instrument_master`, `mutual_funds`, `bond_catalog`, and listed stocks
- **UI Components**: PortfolioEditor and FundAutocomplete components with ISIN search placeholders

The Corporate Treasury Management module is SEBI-compliant, with a configurable Maker-Checker workflow and a four-bucket allocation system. The Unified Tax & Compliance Module offers PAN-driven ITR filing, a Unified eSign Service, and Form 15CA/15CB support, with a Document Vault and RBAC with immutable audit logging.

External data integration includes a Financial Calendar and a Market Holiday Service. A Centralized Portfolio Import System (`unified-portfolio-import-service.ts`) supports diverse import sources (PDF/HTML, URL, API, manual) with a unified type system, normalization, and storage. It includes fund name normalization, ISIN extraction with checksum validation, AMFI lookup, and AI fallback for parsing.

A **PDF Parser v2 System** (`pdf-parser-v2.ts`) provides an intelligent next-generation PDF parsing engine with comprehensive capabilities across five implementation phases:

**Phase 1 - Foundation:**
- **Feature Flag System**: Configurable parser version (v1/v2/dual) with admin API controls at `/api/admin/parser/*`
- **Document Profiler**: SHA-256 fingerprinting, PDF type detection (CAS CAMS/KFINTECH, broker statements, aggregators), layout classification (tabular/semi-structured/narrative/mixed)
- **Dual-Run Mode**: Execute both parsers simultaneously for comparison and confidence scoring
- **Rollback Switch**: Emergency switch to force v1 usage when v2 issues are detected

**Phase 2 - Layout & Semantic Intelligence:**
- **Layout Segmentation**: Page zoning (header/body/footer), AMC block detection, multi-page continuation handling
- **Semantic Block Detection**: ISIN/folio/scheme detection with version-tolerant matching, investor info extraction
- **Transaction Intelligence**: Multi-line row handling, transaction type classification (purchase/SIP/switch/redemption/dividend), unit balance validation

**Phase 3 - Holdings & Purchase Dates:**
- **Purchase Date Engine**: Switch-In treated as fresh purchase, SIP first date resolution, unresolved date flagging
- **Holding Lots Builder**: FIFO/LIFO lot building from transactions with lot-level tracking (active/partial/redeemed status)
- **Summary PDF Detection**: Aggregator detection (Wealthy, MFCentral), `requires_enrichment` flagging with source suggestions

**Phase 4 - Confidence & Learning:**
- **Confidence Scoring**: Weighted scoring (ISIN match 25%, date resolution 20%, value accuracy 20%, source quality 20%, unit balance 15%)
- **Learning Store**: Pattern storage for successful parses, similarity matching for new documents

**Phase 5 - Observability:**
- **Structured Logging**: Event-based logging (parse_start, parse_complete, parse_error, enrichment_needed, pattern_matched)
- **Parsing Metrics**: Dashboard metrics (success rate, avg parse time, by PDF type, enrichment count, pattern match rate)
- **Error Tracking**: Error summary with fingerprint, PDF type, and error details
- **Audit Trail**: Comprehensive parsing history in `pdf_parsing_audit_trail` table

A Unified Portfolio Storage System consolidates portfolio data for prospects and clients, tracking sources and refresh statuses, and supporting prospect-to-client transitions. It includes asynchronous background CAS refreshes with transaction-safe atomic updates.

The platform includes real-time portfolio/market data, financial calculators, multi-asset support, family collaboration, a 3-tier KYC system, and an AI Chat Assistant (Google Gemini).

A Comprehensive Zoho Ecosystem Integration covers Zoho CRM, Books, Campaigns, Meeting, and Sign, with Zoho CRM as the single source of truth.

The Profit-Optimized AI Recommendation Engine provides multi-mode recommendations (Conservative, Balanced, Growth-Optimized) with deterministic numeric scoring and suitability scores, including agent governance and A/B testing. A Database-Driven Recommendation Products System manages investment product catalogs for AI proposals. A Unified AI Recommendation Engine (`unified-ai-recommendation-engine.ts`) centralizes AI-powered investment analysis across nine product categories, offering product-agnostic analysis, ranking, multi-model fallback, response caching, performance tracking, and KYC compliance.

A Stock Enrichment System consolidates 2,800+ NSE/BSE listed stocks into 12 broad sectors. An ISIN Intelligence Layer provides automatic instrument classification from Indian and international ISINs.

A **Pick of the Day** feature provides daily investment recommendations across nine asset categories for agents, with AI-generated rationale and performance tracking. The Agent Knowledge Hub provides market intelligence and client communication tools, including a Gemini-powered Daily AI Market Brief Engine.

The platform implements comprehensive SEBI/RBI-compliant payment handling, including HMAC Signature Verification, Client Money Segregation, Daily Reconciliation, and Trustee Escrow Validation. FEMA Compliance & International Transaction Management includes RBI Purpose Code Validation, LRS Limit Tracking, TCS Calculation Engine, and RBI A2 Form Generation.

Offline & Slow-Internet Resilience is achieved through PWA capabilities including a Global Network State Manager, Service Worker, Draft Auto-Save Engine, and Action Queue & Sync Engine.

A DSA Multi-Financier Loan Routing System enables multi-bank loan applications with RBI Digital Lending Directions 2025 compliance, featuring a credit engine and Key Facts Statement (KFS) generation. A DSA Bank Eligibility Matrix System provides configurable bank-specific eligibility rules.

A **Bank OAuth Integration Infrastructure** provides secure bank API connectivity:
- **Bank Credentials Vault Service**: AES-256-GCM encrypted credential storage with environment isolation (sandbox/production)
- **Bank Token Management Service**: OAuth 2.0 token lifecycle with auto-refresh (5 min before expiry), circuit breaker pattern (3 failures → 60s cooldown)
- **Bank API Rate Limiter**: Token bucket algorithm with per-bank configuration (default 60/min, ICICI 100/min, Bajaj 120/min) and operation weights (submit=5, upload=3, status=1)
- **Bank API Audit Service**: RBI-compliant transaction logging with 180-day retention, request hashing, and sensitive data redaction
- **Database Tables**: `bank_credentials_vault`, `bank_oauth_tokens`, `bank_api_audit_logs`

An **MCA Integration System** provides comprehensive company financial data management, including direct payment processing for 14 MCA fee types with Zoho Books auto-sync, financial data backfill, and an auto-refresh scheduler. A **Database-First Data Enrichment System** for unlisted shares implements a tiered data access pattern, checking local data before API calls, with staleness detection and auto-refresh scheduling for cost optimization.

### System Design Choices
The platform utilizes a subdomain-based portal architecture for Admin, Partner, and Client portals, ensuring isolated experiences and role-based access control. A **Financial Metrics Engine** provides comprehensive 40+ derived ratios for investment analysis with multi-year historical tracking across various asset classes.

### Service Architecture Guidelines
FintekPro uses a **Centralized Service Registry** pattern to prevent duplicate service initialization and ensure consistent singleton management. Key patterns include Singleton Services (lazy initialization), One-Time Logging for warnings, and predefined Service Categories (e.g., `DATA_PROVIDER`, `AI_SERVICE`, `INTEGRATION`).

A **Staggered Startup System** prevents resource contention and 502 errors during server initialization:
- **Cron Job Staggering**: Background sync jobs (REIT/InvIT, MF NAV, AIF NAV, PMS NAV, Commodity, Exit Load) start 30 seconds apart
- **External API Service Delays**: Bond Catalog (5s), Currency Exchange (10s), Financial Data Scheduler (15s) are delayed to allow the server to become responsive before making heavy external API calls
- **Error Monitoring**: Request latency tracking logs slow requests (>1000ms) for performance analysis

A **Fast Boot Optimization** ensures the server starts accepting requests within ~200ms instead of waiting 30-40 seconds for full initialization:
- **Early Listen**: Server starts listening on port 5000 immediately after auth setup (~200ms)
- **Boot State Tracking**: Global `bootState` object tracks: serverListening, authReady, routesReady, cronJobsReady
- **Boot-in-Progress Middleware**: Returns 503 with "Server is starting up" message for API requests during boot, while whitelisting health, auth, and CSRF endpoints
- **Background Route Registration**: Routes continue registering asynchronously while server already accepts health check requests
- **Health Endpoints**: `/api/health` and `/api/ready` return boot status immediately, preventing 502 errors from load balancers
- **Graceful Degradation**: Non-critical services initialize after server is responsive

### Regulatory Compliance Infrastructure
A comprehensive **Regulatory Gaps Tracker** monitors compliance across SEBI, RBI, IRDAI, MCA, and ITD regulators, with all 10 tracked items completed. This includes Consent Audit Trail (DPDPA 2023), AI Advisory Risk Disclosure (SEBI AI/ML Guidelines), Key Facts Statement for Loans (RBI), RIA Registration Validation (SEBI IA Regulations), Insurance Suitability Assessment (IRDAI), Beneficial Ownership Disclosure (MCA), Overseas Investment Limit Tracking (FEMA LRS), Client Money Segregation Audit (SEBI), and SEBI SCORES Integration.

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