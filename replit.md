# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform designed for personal finance and investment management. Its core purpose is to provide secure financial planning, portfolio management, and real-time market data across diverse asset classes. Key capabilities include family collaboration, a unified KYC system, an AI-powered financial assistant, an Unlisted Marketplace, and comprehensive multi-origination loan lifecycle support. The platform aims to be a leading digital financial ecosystem, empowering individual investors and financial advisors with advanced tools and insights.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.
Never build duplicate engines — always upgrade existing ones in place. No parallel systems doing the same work.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, shadcn/ui (Radix UI), Tailwind CSS, and Recharts, ensuring a mobile-first and responsive design. It features a `ScrollableTabsList`, a three-part layout (Left Sidebar Navigation, Main Content, Footer), and a collapsible, state-persisted sidebar. Consistent `LoadingState` and `EmptyState` components are used. A Multi-Portal Brand Segregation System dynamically brands portals using a `PortalType` enum, SVG logos, and a `PortalThemeProvider.tsx`.

### Technical Implementations
The frontend utilizes Vite, Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation. The backend is an Express.js application with TypeScript, using PostgreSQL via Drizzle ORM, exposed as a RESTful API. Authentication includes mandatory two-factor OTP, unified login via Passport.js, and comprehensive KYC. An Admin portal is also provided.

The platform includes a SEBI/RBI-compliant Unlisted Marketplace with a multi-methodology price suggestion engine. A Multi-Source Financial Data Enrichment System integrates providers with priority-based source selection and API cost optimization. A Centralized Portfolio Import System supports diverse sources with a unified type system and AI fallback for document parsing. A Unified Portfolio Storage System consolidates data, alongside a Capital Gains & Tax Optimization System.

FintekPro integrates with the Zoho Ecosystem (CRM, Books, Campaigns, Meeting, Sign) via a production-ready two-way sync system featuring conflict resolution, distributed sync locks, idempotency guards, a dead-letter queue, and configurable sync controls. It incorporates a Profit-Optimized AI Recommendation Engine and a Unified AI Recommendation Engine. A Stock Enrichment System consolidates listed stocks, and an ISIN Intelligence Layer provides automatic instrument classification. The Agent Knowledge Hub offers market intelligence and a Gemini-powered Daily AI Market Brief Engine. A DB-First Stock Screener uses a Multi-Provider Data Registry with a 4-Tier Priority Queue Enrichment System and a derived metrics scoring engine. An Admin Provider Health Dashboard monitors provider status.

The system supports SEBI/RBI-compliant payment handling, FEMA compliance, international transaction management, and offers Offline & Slow-Internet Resilience via PWA capabilities. A DSA Multi-Financier Loan Routing System ensures RBI Digital Lending Directions 2025 compliance. A Bank OAuth Integration Infrastructure provides secure bank API connectivity, and an MCA Integration System manages company financial data.

A Builder Funding & Project Finance Module extends the DSA loan system with a DEVELOPER vertical, 8 sub-types, a 10-step Project Finance Wizard, and an Intelligent Lender Matching Engine. A Banker Contacts Directory (`banker_contacts` table) stores financier name, DSA code, product names (array), banker name, phone, email, with Excel import support, bidirectional Zoho CRM sync, and agent search (3-char minimum) + CRUD. Global contacts (agentId="system") are shared across all agents via Excel import. The directory is accessible from the Banker Directory tab in the loan apply page.

A Multi-Level Partner Hierarchy System enables hierarchical partner onboarding, commission waterfall, and client ownership protection. A Partner Payout Statement Service provides auditable statements, and a Commission Dispute & Reversal Engine handles disputes.

A Multi-Bank Account System supports up to 5 bank accounts per user, compliant with SEBI/AMFI circulars, including penny-drop verification and KYC integration. Service consolidation includes UnifiedOrderNotificationService, Cache Services, MF Live Returns System, Benchmark Data Infrastructure, and a three-layer KYC Orchestrators. Enhancements include Proposal Builder features (Strategy-Locked Advisor-Controlled System with Fair Backtesting), a Regulator-Grade PDF System, a Proposal Audit Trail System, a Database Enrichment Infrastructure, a MF Comprehensive Enrichment Pipeline, and a Lead Leakage Prevention & Detection System.

A Consolidated MF Metrics System uses `mutual_fund_metrics` as the canonical store for all calculated financial ratios (sharpe, sortino, stddev, maxDrawdown, returns, CAGR, SIP returns, capture ratios, VaR, portfolio characteristics) tracked per fiscal year (FY25-26 format). The `mutual_funds` table remains the lightweight catalog (NAV, basic returns, fund info). Both `MutualFundMetricsService` and the MF Comprehensive Enrichment Pipeline write to `mutual_fund_metrics` via upsert on (scheme_code, fiscal_year). Read queries use LEFT JOIN with COALESCE fallback to `mutual_funds` columns during transition.

The Proposal Builder includes: AI_DRIVEN/MANUAL allocation mode, strategy snapshot locking, fair backtesting, portfolio difference summary, AI allocation override prevention, strategy integrity validation, and forced new version on allocation change after lock. All proposal-related endpoints are protected with `requireAgent` middleware. Frontend components include `StrategyAllocationPanel` with Strategy Allocation, Fair Backtest, and Portfolio Comparison tabs.

An AI Alpha Engine, implemented natively in TypeScript, provides a regime-aware, backtest-validated, Sharpe-optimized system for "Pick of the Day" with a Core Analytics Module, Walk-Forward Backtesting Engine, Market Regime Detection Engine, and Portfolio Optimization Engine.

A Formalized KYC Engine (`server/services/kyc-orchestration-engine.ts`) provides priority-based provider selection with automatic fallback routing, including a KYC Providers Registry, Provider Priority System, Product Configuration, Identity Token Service, DPDP Consent Layer, and an Immutable Audit Trail.

A Scheme Master Governance System (`server/services/scheme-governance-service.ts`) provides ISIN-based fund identification with DB-driven transaction eligibility rules, including `scheme_rename_log`, `scheme_transaction_rules`, `proposal_audit_log`, and `proposal_versions`.

### System Design Choices
FintekPro employs a subdomain-based portal architecture for Admin, Partner, Agent, and Client portals with role-based access control. Session-based portal validation prevents cross-portal session reuse, audited by a `portal_access_log` table. A Financial Metrics Engine provides 40+ derived ratios. It uses a Centralized Service Registry pattern for singleton management, a Staggered Startup System for resource management, and Fast Boot Optimization. A Regulatory Gaps Tracker monitors compliance.

A Production Bootstrap & Self-Healing Data System provides automated, idempotent reference data seeding on every server startup for Market Indices, Feature Flags, Commodities, REITs, InvITs, Screener Stocks, and Bond Catalog. Zoho CRM Auto-Bootstrap automatically creates Zoho CRM connections from environment variables.

An Instrument Time-Series Architecture (`server/services/instrument-time-series/`) uses a dual-pipeline system for instrument price data: a Daily Incremental Engine fetches previous day close/NAV, and a Historical Backfill Engine performs one-time 5-year historical data ingestion. Both use the existing DataProviderRegistry for multi-provider fallback, idempotent inserts, job audit logging, and a retry queue with exponential backoff. Admin endpoints provide manual triggers and status dashboards.

A Central Engine Registry defines mandatory engines for specific domains:
- **AI Recommendations**: `Unified AI Recommendation Engine` (`unified-ai-recommendation-engine.ts`) for all AI-powered analysis, scoring, and rationale generation.
- **AI Alpha / Pick of Day**: `AI Alpha Engine Cluster` (`ai-analytics-engine.ts`, etc.) for quantitative scoring, regime detection, backtesting, and explainability.
- **Profit-Optimized Scoring**: `Profit-Optimized Scoring Engine` (`profit-optimized-scoring-engine.ts`) for revenue-optimized product ranking.
- **Commission**: `Commission Waterfall Engine` (`commission-waterfall-engine.ts`) for all commission calculations.
- **Tax**: `Tax Orchestrator` (`tax-orchestrator.ts`) for all tax calculations and harvest optimization.
- **Risk**: `Risk Suitability Engine` (`risk-suitability-engine.ts`) for risk assessment and suitability matching.
- **KYC**: `KYC Orchestration Engine` (`kyc-orchestration-engine.ts`) for all KYC verification.
- **Rebalancing**: `Rebalancing Engine` (`rebalancing-engine.ts`) and `US Rebalancing Engine` (`us-rebalancing-engine.ts`) for portfolio rebalancing.
- **Portfolio Import**: `Unified Portfolio Import Service` (`unified-portfolio-import-service.ts`) for all portfolio import/parsing.
- **Financial Metrics**: `Financial Metrics Calculator` (`financial-metrics-calculator.ts`) for all derived financial ratios.
- **Proposals**: `Proposal Execution Engine` and `Proposal Orchestrator` for generation, execution, and what-if analysis.
- **Goal Planning**: `Goal Planning Engine` (`goal-planning-engine.ts`) for financial goal modeling.
- **SIP Simulation**: `SIP Simulator Engine` (`sip-simulator-engine.ts`) for SIP projection.
- **Return Forecasting**: `Return Forecasting Engine` (`return-forecasting-engine.ts`) for return projection.
- **Investable Surplus**: `Investable Surplus Engine` (`investable-surplus-engine.ts`) for client investable surplus calculation.
- **Overlap Analysis**: `Overlap Intelligence Engine` (`overlap-intelligence-engine.ts`) for portfolio overlap detection.
- **Fund Classification**: `MF SEBI Category Engine` (`mf-sebi-category-engine.ts`) for mutual fund classification.
- **Screener**: `Screener Query Engine` and `Derived Metrics Engine` (`screener/screener-query-engine.ts`, `screener/derived-metrics-engine.ts`) for stock screening.
- **Fixed Income**: `Fixed Income Status Engine` (`fixed-income-status-engine.ts`) for bond/NCD tracking.
- **Corporate Treasury**: `Corporate Treasury Engine` (`corporate-treasury-engine.ts`) for corporate treasury management.
- **Explainability**: `Explainability Engine` (`explainability-engine.ts`) for AI decision explainability.
- **Signal Orchestration**: `Signal Orchestrator` (`signal-orchestrator.ts`) for signal conflict resolution.
- **Charge Classification**: `Instrument Charge Taxonomy` (`shared/types/instrument-charges.ts`) for charge classification and exit load eligibility.

The `Instrument Charge Classification Matrix` details charge types and regulators for various instruments, emphasizing that EXIT_LOAD is specific to Mutual Funds.

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