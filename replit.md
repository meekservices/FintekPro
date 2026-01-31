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