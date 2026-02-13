# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It offers secure financial planning, portfolio management, and real-time market data across various asset classes. Key features include family collaboration, unified KYC, an AI-powered financial assistant, an Unlisted Marketplace, and multi-origination loan lifecycle support. The platform aims to empower individual investors and financial advisors with advanced tools and insights, establishing itself as a leading digital financial ecosystem.

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

The platform includes a SEBI/RBI-compliant Unlisted Marketplace with a multi-methodology price suggestion engine. A Multi-Source Financial Data Enrichment System integrates providers with priority-based source selection. An API cost optimization system minimizes external calls via request deduplication and AI response caching. A Centralized Portfolio Import System supports diverse import sources with a unified type system and AI fallback for parsing, including a `unified-pdf-parser.ts` for financial documents and `cas-statement-service.ts` for CAMS/KFintech CAS PDF parsing. A Unified Portfolio Storage System consolidates portfolio data, and a `unified-holdings-reader-service.ts` provides a single entry point for reading holdings. The platform includes a Capital Gains & Tax Optimization System.

FintekPro integrates a Comprehensive Zoho Ecosystem (CRM, Books, Campaigns, Meeting, Sign). It features a Profit-Optimized AI Recommendation Engine and a Unified AI Recommendation Engine. A Stock Enrichment System consolidates listed stocks, and an ISIN Intelligence Layer provides automatic instrument classification. The Agent Knowledge Hub provides market intelligence and a Gemini-powered Daily AI Market Brief Engine. A DB-First Stock Screener uses FMP with a 4-Tier Priority Queue Enrichment System and a derived metrics scoring engine.

The system supports SEBI/RBI-compliant payment handling, FEMA compliance, and international transaction management. It offers Offline & Slow-Internet Resilience via PWA capabilities. A DSA Multi-Financier Loan Routing System ensures RBI Digital Lending Directions 2025 compliance. A Bank OAuth Integration Infrastructure provides secure bank API connectivity. An MCA Integration System manages company financial data, and a Database-First Data Enrichment System optimizes access for unlisted shares.

A Builder Funding & Project Finance Module extends the DSA loan system with a DEVELOPER vertical and 8 sub-types, featuring a 10-step Project Finance Wizard and an Intelligent Lender Matching Engine.

A Multi-Level Partner Hierarchy System enables hierarchical partner onboarding with controlled delegation, commission waterfall, client ownership protection, and audit-ready compliance. A Partner Payout Statement Service provides transaction-level, auditable payout statements. A Commission Dispute & Reversal Engine handles disputes and reversals with full audit trails. The Partner Portal UI includes "Payout Statement," "How Earnings Work," and "Compliance & Disclosures" tabs.

The platform is undergoing service consolidation, including: UnifiedOrderNotificationService, Unified AI Recommendation Engine, Cache Services, MF Live Returns System, Benchmark Data Infrastructure (with AMFI and BSE parsers), and KYC Orchestrators (three-layer architecture with CKYC, Onboarding, and Workflow Orchestrators, extended with KYC Wizard v2). Enhancements include Proposal Builder enhancements, a Regulator-Grade PDF System, a Proposal Audit Trail System, a Database Enrichment Infrastructure, a MF Comprehensive Enrichment Pipeline, and a Lead Leakage Prevention & Detection System.

### System Design Choices
FintekPro uses a subdomain-based portal architecture for Admin, Partner, and Client portals with role-based access control. A Financial Metrics Engine provides 40+ derived ratios. It utilizes a Centralized Service Registry pattern for singleton management. A Staggered Startup System prevents resource contention, and Fast Boot Optimization ensures quick server responsiveness. A Regulatory Gaps Tracker monitors compliance across various regulators.

A Production Bootstrap & Self-Healing Data System provides automated, idempotent reference data seeding on every server startup, covering Market Indices, Feature Flags, Commodities, REITs, InvITs, Screener Stocks, and Bond Catalog. Zoho CRM Auto-Bootstrap provides `ZohoConnectionResolver.bootstrapFromEnvVars()` to auto-create Zoho CRM connections from environment variables.

## External Dependencies

### Third-Party APIs
- FMP (Financial Modeling Prep) - 41+ endpoints for stock fundamentals, ratios, DCF, analyst data, earnings, technical indicators
- Probe42 - Company intelligence and corporate data
- Finnhub - Real-time market data and news
- Yahoo Finance - Stock quotes and historical data
- BSE Star MFD API - Mutual fund transactions
- NSE NCB & BSE Bond API - Bond catalog and trading
- Bajaj Finance Integration - Loan processing
- Tata Capital Integration - Loan processing
- exchangerate-api.com - Currency exchange rates
- Google Gemini API - AI recommendations, market briefs, analysis
- OpenAI API - AI fallback for recommendations
- Cashfree Verification Suite API - KYC verification
- Sandbox.co.in API (MCA) - Company filings and MCA data
- AuthBridge CKYC API - Central KYC integration
- AuthBridge Aadhaar eSign API - Electronic signatures
- Protean (NSDL) Aadhaar eSign API - Electronic signatures
- Protean KRA API - KYC Registration Agency
- Cashfree (Payment Gateway, Payout API) - Payment processing
- PhonePe (Payment Gateway) - UPI payments
- Twilio - SMS, WhatsApp messaging
- Nodemailer - Email service
- AMFI Registry API - Mutual fund scheme data
- Turtlefin Insurance API - Insurance products
- CIBIL - Credit scoring
- Zoho CRM - Customer relationship management (auto-bootstrap)
- Zoho Books - Accounting and invoicing
- Zoho Campaigns - Email marketing
- Zoho Meeting - Video conferencing
- Zoho Sign - Digital signatures
- Alpha Vantage - Market data
- Polygon.io - US market data (flat files via S3)

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