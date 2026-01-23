# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform designed for personal finance and investment management. It offers tools for portfolio management, real-time market data, and a comprehensive suite of financial services including stocks, mutual funds, IPOs, bonds, loans, and unlisted company trading. The platform aims to provide a secure and integrated solution for financial planning, incorporating features such as family collaboration, unified KYC compliance, an AI-powered financial assistant, and an Unlisted Marketplace. Its primary goal is to empower users with advanced financial tools and insights, serving individual investors and financial advisors, with ambitions to become a leading digital financial ecosystem.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, shadcn/ui (Radix UI), Tailwind CSS, and Recharts, adopting a mobile-first, responsive design. It features a `ScrollableTabsList`, a consistent three-part layout (Left Sidebar Navigation, Main Content, Footer), and a collapsible, state-persisted sidebar. Standardized reusable components like `LoadingState` and `EmptyState` ensure consistency.

### Technical Implementations
The frontend uses Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation, all powered by Vite. The backend is an Express.js application with TypeScript, utilizing PostgreSQL via Drizzle ORM, exposed through a RESTful API. Authentication includes mandatory two-factor OTP and unified login via Passport.js. The platform features comprehensive KYC with PAN verification, real-time product eligibility, and duplicate detection. An Admin portal manages users and marketing automation.

The Unlisted Marketplace is SEBI/RBI-compliant, sourcing data from an internal database and Sandbox.co.in. It includes a multi-methodology price suggestion engine, atomic transaction-based deal matching, and a compliance framework. Trading requires Enhanced/Accredited KYC.

A Multi-Source Financial Data Enrichment System integrates Probe42, Finnhub, and Yahoo Finance with priority-based source selection, rate limit handling, and an AI guardrail system to reduce API costs. An API cost optimization system further minimizes external calls through request deduplication, AI response caching, and proactive cache warming.

A Historical NAV Data Service provides 10+ year historical data from MFAPI.in for portfolio metric calculations, supporting daily background refreshes and calculating metrics like Volatility, Max Drawdown, CAGR, and Sharpe Ratio.

The Corporate Treasury Management module is SEBI-compliant, featuring a configurable Maker-Checker workflow, a four-bucket allocation system, and optimized proposals. The Unified Tax & Compliance Module offers PAN-driven ITR filing, a Unified eSign Service, and Form 15CA/15CB support, with a Document Vault and RBAC with immutable audit logging.

External data integration includes a Financial Calendar and a Market Holiday Service. A Portfolio Import System is also available.

A **Unified Portfolio Storage System** consolidates portfolio data for prospects and clients using unified `portfolios` and `portfolioHoldings` tables. It tracks portfolio and holding sources, refresh statuses, and supports prospect-to-client transitions upon KYC completion. The system includes asynchronous background CAS refreshes with transaction-safe atomic updates and unified holdings + transactions sync, supporting various transaction types.

The platform includes real-time portfolio/market data, financial calculators, multi-asset support, family collaboration, a 3-tier KYC system, and an AI Chat Assistant (Google Gemini).

A Comprehensive Zoho Ecosystem Integration covers Zoho CRM, Books, Campaigns, Meeting, and Sign, with Zoho CRM as the single source of truth for lead management.

The Profit-Optimized AI Recommendation Engine provides multi-mode recommendations (Conservative, Balanced, Growth-Optimized) with deterministic numeric scoring and suitability scores, including agent governance and A/B testing. A Database-Driven Recommendation Products System manages investment product catalogs for AI proposals, with an Admin UI for CRUD operations and a caching service.

A **Unified AI Recommendation Engine** (`unified-ai-recommendation-engine.ts`) provides a centralized facade for all AI-powered investment analysis across 9 product categories: Stocks, Mutual Funds, AIF, PMS, Bonds, Commodities, REITs, Derivatives, and Unlisted Securities. Key features include:
- **Product-Agnostic Analysis**: `analyzeProduct()` with AI scoring, confidence levels, and risk-profile mapping
- **Ranking & Recommendations**: `rankProducts()` and `generateRecommendation()` with client profile matching
- **Multi-Model Fallback**: Gemini AI (primary) with OpenAI fallback for resilience
- **Response Caching**: Integrated with `ai-response-cache-service.ts` to minimize API costs
- **Performance Tracking**: Connected to `ai-recommendation-tracking-service.ts` for accuracy metrics
- **KYC Compliance**: Automatic regulatory guardrails based on client KYC tier
- **AI-Enhanced Rebalancing**: `aiEnhancedRebalancingService` wraps rule-based rebalancing with AI product suggestions
- **Recommendation Catalog Sync**: Auto-sync top performers from AIF/PMS master data to recommendation products

A Stock Enrichment System consolidates 2,800+ NSE/BSE listed stocks into 12 broad sectors, using Probe42, NSE/BSE, and Finnhub. An ISIN Intelligence Layer provides automatic instrument classification from Indian and international ISINs, with prefix detection, deep INE resolution, edge case handling, multi-region support, and ISO 6166 Checksum Validation.

A **Pick of the Day** feature provides daily investment recommendations across nine asset categories for agents, with AI-generated rationale, tracking fields (price at recommendation, target, stoploss), status tracking, scoring algorithms, and performance statistics.

The Agent Knowledge Hub provides market intelligence, product knowledge, and client communication tools, including a Gemini-powered Daily AI Market Brief Engine and Client Explanation Templates.

The platform implements comprehensive SEBI/RBI-compliant payment handling, including HMAC Signature Verification, Client Money Segregation, Daily Reconciliation, and Trustee Escrow Validation. FEMA Compliance & International Transaction Management includes RBI Purpose Code Validation, LRS Limit Tracking, TCS Calculation Engine, and RBI A2 Form Generation.

Offline & Slow-Internet Resilience is achieved through PWA capabilities including a Global Network State Manager, Service Worker, Draft Auto-Save Engine, and Action Queue & Sync Engine.

A DSA Multi-Financier Loan Routing System enables multi-bank loan applications with RBI Digital Lending Directions 2025 compliance, featuring a credit engine matching applicants to partner banks and generating Key Facts Statements (KFS). A DSA Bank Eligibility Matrix System provides configurable bank-specific eligibility rules and priority-based bank recommendations. A Commission Reconciliation Automation System automates payment tracking, matching, and dispute handling.

An **MCA Integration System** provides comprehensive company financial data management, including direct payment processing for 14 MCA fee types with Zoho Books auto-sync, financial data backfill from MCA filings, an auto-refresh scheduler, and per-field coverage tracking for 12 financial metrics.

### System Design Choices
The platform utilizes a subdomain-based portal architecture for Admin, Partner, and Client portals, ensuring isolated experiences, security, and role-based access control.

A **Financial Metrics Engine** provides comprehensive 40+ derived ratios for investment analysis with multi-year historical tracking across various asset classes (Stocks, Mutual Funds, Bonds, REITs/InvITs). It includes Valuation Ratios, Profitability Metrics, Growth Metrics, Quality Scores, and Leverage Ratios, sourcing data from Probe42 and Finnhub.

### Regulatory Compliance Infrastructure

A comprehensive **Regulatory Gaps Tracker** in the admin compliance dashboard monitors compliance across SEBI, RBI, IRDAI, MCA, and ITD regulators. Current compliance status (10/10 completed - 100%):

**Completed Compliance Items (10/10 - 100%):**
1. **Consent Audit Trail (DPDPA 2023)** - ConsentAuditService provides immutable consent tracking for user privacy choices with API endpoints for bulk consent recording and audit retrieval.
2. **AI Advisory Risk Disclosure (SEBI AI/ML Guidelines)** - AIAdvisoryDisclosure reusable component with compact/full/inline variants integrated across all AI recommendation pages.
3. **Key Facts Statement for Loans (RBI/2022-23/111)** - KFS Generator Service produces standardized loan disclosures including APR calculations, fee breakdowns, EMI schedules, cooling-off period information, and grievance redressal mechanisms.
4. **RIA Registration Validation (SEBI IA Regulations 2013)** - RIA Validation Service checks Investment Adviser registration status, scope of advice, and maintains validation audit logs.
5. **Insurance Suitability Assessment (IRDAI 2024)** - Insurance Suitability Service conducts mandatory suitability assessments before insurance recommendations with financial profiling, health assessment, and product matching.
6. **Beneficial Ownership Disclosure (MCA SBO Rules 2018)** - Beneficial Ownership Service tracks Significant Beneficial Owners for entity clients with compliance status monitoring and form filing tracking.
7. **Overseas Investment Limit Tracking (FEMA LRS)** - Real-time LRS quota tracking.
8. **Client Money Segregation Audit (SEBI)** - Quarterly reconciliation framework.
9. **SEBI SCORES Integration (SEBI Circular SEBI/HO/OIAE/IGRD/CIR/P/2023/155)** - Full investor grievance management system with complaint submission, 30-day SLA tracking, status workflow (submitted → acknowledged → under_review → resolved → closed), escalation handling, and audit trail. Integrated into admin compliance dashboard.

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