# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It offers secure financial planning, portfolio management, and real-time market data across various asset classes. Key features include family collaboration, unified KYC, an AI-powered financial assistant, an Unlisted Marketplace, and multi-origination loan lifecycle support. The platform aims to empower individual investors and financial advisors with advanced tools and insights, establishing itself as a leading digital financial ecosystem.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.
Never build duplicate engines — always upgrade existing ones in place. No parallel systems doing the same work.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, shadcn/ui (Radix UI), Tailwind CSS, and Recharts, designed for mobile-first responsiveness. It features a `ScrollableTabsList`, a three-part layout (Left Sidebar Navigation, Main Content, Footer), and a collapsible, state-persisted sidebar. Consistent `LoadingState` and `EmptyState` components are used. A Multi-Portal Brand Segregation System provides portal-specific branding (logos, colors, taglines) via a `PortalType` enum, dynamically generated SVG logos, and a `PortalThemeProvider.tsx`.

### Technical Implementations
The frontend leverages Vite, Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation. The backend is an Express.js application with TypeScript, using PostgreSQL via Drizzle ORM, exposed through a RESTful API. Authentication includes mandatory two-factor OTP, unified login via Passport.js, and comprehensive KYC. An Admin portal is included.

The platform includes a SEBI/RBI-compliant Unlisted Marketplace with a multi-methodology price suggestion engine. A Multi-Source Financial Data Enrichment System integrates providers with priority-based source selection, and an API cost optimization system minimizes external calls. A Centralized Portfolio Import System supports diverse import sources with a unified type system and AI fallback for parsing financial documents. A Unified Portfolio Storage System consolidates portfolio data. The platform includes a Capital Gains & Tax Optimization System.

FintekPro integrates a Comprehensive Zoho Ecosystem (CRM, Books, Campaigns, Meeting, Sign) with a production-ready two-way sync system featuring per-field authority conflict resolution, distributed sync locks, idempotency guards, a dead-letter queue, and configurable sync controls. It features a Profit-Optimized AI Recommendation Engine and a Unified AI Recommendation Engine. A Stock Enrichment System consolidates listed stocks, and an ISIN Intelligence Layer provides automatic instrument classification. The Agent Knowledge Hub provides market intelligence and a Gemini-powered Daily AI Market Brief Engine. A DB-First Stock Screener uses a Multi-Provider Data Registry with a 4-Tier Priority Queue Enrichment System and a derived metrics scoring engine. An Admin Provider Health Dashboard monitors provider status and API usage.

The system supports SEBI/RBI-compliant payment handling, FEMA compliance, and international transaction management. It offers Offline & Slow-Internet Resilience via PWA capabilities. A DSA Multi-Financier Loan Routing System ensures RBI Digital Lending Directions 2025 compliance. A Bank OAuth Integration Infrastructure provides secure bank API connectivity. An MCA Integration System manages company financial data.

A Builder Funding & Project Finance Module extends the DSA loan system with a DEVELOPER vertical, 8 sub-types, a 10-step Project Finance Wizard, and an Intelligent Lender Matching Engine. A Multi-Level Partner Hierarchy System enables hierarchical partner onboarding with controlled delegation, commission waterfall, and client ownership protection. A Partner Payout Statement Service provides transaction-level, auditable payout statements, and a Commission Dispute & Reversal Engine handles disputes and reversals.

A Multi-Bank Account System supports up to 5 bank accounts per user, compliant with SEBI/AMFI circulars, including penny-drop verification and KYC engine integration.

Service consolidation includes: UnifiedOrderNotificationService, Unified AI Recommendation Engine, Cache Services, MF Live Returns System, Benchmark Data Infrastructure, and KYC Orchestrators (three-layer architecture). Enhancements include Proposal Builder enhancements (Strategy-Locked Advisor-Controlled System with Fair Backtesting), a Regulator-Grade PDF System, a Proposal Audit Trail System, a Database Enrichment Infrastructure, a MF Comprehensive Enrichment Pipeline, and a Lead Leakage Prevention & Detection System.

The Proposal Builder Upgrade (Feb 2026) adds: AI_DRIVEN/MANUAL allocation mode selection, strategy snapshot locking (immutable once locked), fair backtesting with common-period alignment (no tactical reallocation/AI reweighting/period optimization), portfolio difference summary (allocationDelta, riskMetricDelta, costDelta, concentrationDelta), AI allocation override prevention, strategy integrity validation, and forced new version on allocation change after lock. All endpoints protected with requireAgent middleware. Frontend: StrategyAllocationPanel component with 3 tabs (Strategy Allocation, Fair Backtest, Portfolio Comparison) integrated into Step 5 of the proposal builder.

An AI Alpha Engine, implemented natively in TypeScript, provides a regime-aware, backtest-validated, Sharpe-optimized system for "Pick of the Day." It includes a Core Analytics Module with 24 quantitative methods, a Walk-Forward Backtesting Engine, a Market Regime Detection Engine, and a Portfolio Optimization Engine.

A Formalized KYC Engine (`server/services/kyc-orchestration-engine.ts`) provides priority-based provider selection with automatic fallback routing, including a KYC Providers Registry, a Provider Priority System, Product Configuration, Identity Token Service, DPDP Consent Layer, and an Immutable Audit Trail.

A Scheme Master Governance System (`server/services/scheme-governance-service.ts`) provides ISIN-based fund identification with DB-driven transaction eligibility rules, including `scheme_rename_log`, `scheme_transaction_rules`, `proposal_audit_log`, and `proposal_versions`.

### System Design Choices
FintekPro uses a subdomain-based portal architecture for Admin, Partner, Agent, and Client portals with role-based access control. Session-based portal validation prevents cross-portal session reuse, and a `portal_access_log` table provides an audit trail. A Financial Metrics Engine provides 40+ derived ratios. It utilizes a Centralized Service Registry pattern for singleton management. A Staggered Startup System prevents resource contention, and Fast Boot Optimization ensures quick server responsiveness. A Regulatory Gaps Tracker monitors compliance.

A Production Bootstrap & Self-Healing Data System provides automated, idempotent reference data seeding on every server startup, covering Market Indices, Feature Flags, Commodities, REITs, InvITs, Screener Stocks, and Bond Catalog. Zoho CRM Auto-Bootstrap provides `ZohoConnectionResolver.bootstrapFromEnvVars()` to auto-create Zoho CRM connections from environment variables.

### Central Engine Registry — MANDATORY for All Future Features

| Domain | Central Engine | File | Use For |
|---|---|---|---|
| AI Recommendations | Unified AI Recommendation Engine | `unified-ai-recommendation-engine.ts` | ALL AI-powered analysis, scoring, rationale generation across all asset classes. Provides `runPrompt()` for delegated AI calls with caching, model fallback (Gemini→OpenAI→rules), tracking, and A/B testing. |
| AI Alpha / Pick of Day | AI Alpha Engine Cluster | `ai-analytics-engine.ts` + `ai-ml-scoring-engine.ts` + `ai-regime-detection-engine.ts` + `ai-backtesting-engine.ts` + `ai-feedback-engine.ts` + `ai-xai-engine.ts` | Quantitative scoring, market regime detection, backtesting, explainability |
| Profit-Optimized Scoring | Profit-Optimized Scoring Engine | `profit-optimized-scoring-engine.ts` | Revenue-optimized product ranking |
| Commission | Commission Waterfall Engine | `commission-waterfall-engine.ts` | ALL commission calculations across partner hierarchy |
| Tax | Tax Orchestrator | `tax-orchestrator.ts` | ALL tax calculations, capital gains, harvest optimization |
| Risk | Risk Suitability Engine | `risk-suitability-engine.ts` | ALL risk assessment, client-product suitability matching |
| KYC | KYC Orchestration Engine | `kyc-orchestration-engine.ts` | ALL KYC verification with priority-based provider selection and fallback |
| Rebalancing | Rebalancing Engine | `rebalancing-engine.ts` | Indian market portfolio rebalancing. |
| US Rebalancing | US Rebalancing Engine | `us-rebalancing-engine.ts` | US market portfolio rebalancing |
| Portfolio Import | Unified Portfolio Import Service | `unified-portfolio-import-service.ts` | ALL portfolio import/parsing from any source |
| Financial Metrics | Financial Metrics Calculator | `financial-metrics-calculator.ts` | ALL derived financial ratios (40+ metrics) |
| Proposals | Proposal Execution Engine + Proposal Orchestrator | `proposal-execution-engine.ts` + `proposal-orchestrator.ts` | Proposal generation, execution, what-if analysis |
| Goal Planning | Goal Planning Engine | `goal-planning-engine.ts` | Financial goal modeling |
| SIP Simulation | SIP Simulator Engine | `sip-simulator-engine.ts` | SIP projection and analysis |
| Return Forecasting | Return Forecasting Engine | `return-forecasting-engine.ts` | Return projection across asset classes |
| Investable Surplus | Investable Surplus Engine | `investable-surplus-engine.ts` | Client investable surplus calculation |
| Overlap Analysis | Overlap Intelligence Engine | `overlap-intelligence-engine.ts` | Portfolio overlap detection across MF holdings |
| Fund Classification | MF SEBI Category Engine | `mf-sebi-category-engine.ts` | SEBI category classification for mutual funds |
| Screener | Screener Query Engine + Derived Metrics Engine | `screener/screener-query-engine.ts` + `screener/derived-metrics-engine.ts` | Stock screening with derived scoring |
| Fixed Income | Fixed Income Status Engine | `fixed-income-status-engine.ts` | Bond/NCD status tracking and lifecycle |
| Corporate Treasury | Corporate Treasury Engine | `corporate-treasury-engine.ts` | Corporate treasury management |
| Explainability | Explainability Engine | `explainability-engine.ts` | AI decision explainability |
| Signal Orchestration | Signal Orchestrator | `signal-orchestrator.ts` | POTD vs Rebalancing signal conflict resolution with governance matrix, tolerance bands, audit trail |
| Charge Classification | Instrument Charge Taxonomy | `shared/types/instrument-charges.ts` | ChargeType enum, instrument-to-charge mapping, exit load eligibility checks. All exit load logic MUST use `isMutualFund()` guard. |

### Instrument Charge Classification Matrix

Exit load is a SEBI-regulated charge applicable ONLY to open-ended Mutual Fund schemes. All other exit-like penalties have distinct classifications. Reference: `shared/types/instrument-charges.ts`

| Instrument | ChargeType | Regulator | Notes |
|---|---|---|---|
| Mutual Fund (MF) | EXIT_LOAD | SEBI | Varies by scheme/category. Enforced in exit-load-status & exit-load-calendar APIs. |
| ELSS (Tax Saver MF) | LOCK_IN | SEBI | 3-year mandatory lock-in. No percentage-based exit load. |
| Stock / Equity | NONE | SEBI | No exit load. STT + brokerage only. |
| ETF | NONE | SEBI | Exchange-traded. No exit load. |
| Bond / NCD | NONE | SEBI/RBI | No exit load. May have lock-in period. |
| FD | PREMATURE_WITHDRAWAL_PENALTY | RBI | Premature penalty, not exit load. |
| SGB (Gold Bond) | LOCK_IN | RBI | 5-year lock-in, early exit after yr 5. |
| Digital Gold | NONE | — | No exit load. Spread/premium applies. |
| PMS | CONTRACTUAL_EXIT_FEE | SEBI | Fund manager-specific. Not standardized. |
| AIF | CONTRACTUAL_EXIT_FEE | SEBI | Lock-in per PPM terms. |
| Insurance / ULIP | SURRENDER_CHARGE | IRDAI | Surrender charges, not exit load. |
| REIT | NONE | SEBI | Exchange-traded. No exit load. |
| InvIT | NONE | SEBI | Exchange-traded. No exit load. |
| MLD | LOCK_IN | SEBI | Listed but illiquid. Lock-in per issue. |
| IPO | NONE | SEBI | Post-listing: exchange-traded. |
| Unlisted Equity | NONE | — | No exit load. Illiquidity premium. |

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