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

A Centralized Portfolio Import System supports diverse import sources (PDF/HTML, URL, API, manual) with a unified type system, normalization, and storage, including AI fallback for parsing. An intelligent PDF Parser v2 system processes documents through phased implementation, including document profiling, layout segmentation, semantic block detection, purchase date engine, holding lots builder, confidence scoring, learning store, and comprehensive observability. The v2 parser now supports 17 provider detection patterns including major brokers (Zerodha, Groww, ICICI Direct, HDFC, Kotak, Upstox, Angel One, 5Paisa, Motilal Oswal, Axis Direct, IIFL, Sharekhan) and aggregators (MF Central, INDmoney, Kuvera, ET Money, Paytm Money), each with calibrated confidence scores. The holding lots output from v2 parser flows through to the unified storage layer, enabling accurate SIP lot tracking for LTCG/STCG calculations.

A Unified Portfolio Storage System consolidates portfolio data for prospects and registered users, ensuring data consistency between the AI Advisory engine and Proposal Builder. This includes bifurcated storage strategies for prospect and registered user portfolios, with migration support.

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