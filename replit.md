# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It provides tools for portfolio management, real-time market data, and comprehensive financial services including stocks, mutual funds, IPOs, bonds, loans, and unlisted company trading. The platform aims to deliver a secure solution for financial planning, incorporating features such as family collaboration, unified KYC compliance, an AI-powered financial assistant, and an Unlisted Marketplace. Its goal is to empower users with advanced financial tools and insights, serving individual investors and financial advisors, with ambitions to become a leading digital financial ecosystem.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, shadcn/ui (Radix UI), Tailwind CSS, and Recharts, following a mobile-first approach. It features a responsive `ScrollableTabsList`, a consistent three-part layout (Left Sidebar Navigation, Main Content, Footer), and a collapsible, state-persisted sidebar. Standardized reusable components like `LoadingState` and `EmptyState` are used throughout.

### Technical Implementations
The frontend uses Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for form validation, powered by Vite. The backend is an Express.js application with TypeScript, utilizing PostgreSQL via Drizzle ORM and a RESTful API with robust error handling. Authentication includes mandatory two-factor OTP (email/SMS) and unified login via Passport.js. KYC features include PAN verification (Cashfree), verified profile display, real-time product eligibility based on tiered KYC, and duplicate detection using fuzzy matching and risk scoring. An Admin portal provides comprehensive user management. Marketing automation integrates B2B lead prospecting, email campaigns (Zoho Campaigns), and WhatsApp broadcasts (Twilio). A Stakeholders Management System offers CRUD operations and APIs for partners, agents, and suppliers with shared Zod schema validation.

The Unlisted Marketplace is SEBI/RBI-compliant, sourcing data from an internal database and Sandbox.co.in (MCA fallback). It features a multi-methodology price suggestion engine, an atomic transaction-based deal matching system, and a compliance framework with red flag detection. An Admin Negotiation Console facilitates deal management. Trading access requires Enhanced/Accredited KYC.

A Multi-Source Financial Data Enrichment System reduces API costs by integrating Probe42 (primary), Finnhub (secondary), and Yahoo Finance (tertiary) with priority-based source selection and rate limit handling. Key components include an Identity Confidence Engine for data quality, Finnhub integration with exponential backoff, metric-level source merging with full provenance tracking, a "Why This Number?" API for auditability, SEBI-compliant immutable audit logging, and AI guardrails to prevent low-quality data usage.

### API Cost Optimization System
A three-layer API cost optimization system minimizes external API calls:
- **Request Deduplication Service**: Prevents duplicate in-flight API calls by coalescing concurrent requests for the same resource. Tracks metrics on API calls saved and deduplication efficiency.
- **AI Response Cache Service**: Caches Gemini AI recommendations with content-based hashing and configurable TTLs per recommendation type (MF: 2hr, stocks: 30min, bonds: 4hr, portfolio analysis: 1hr). LRU eviction and estimated cost savings tracking.
- **Batch Company Enrichment**: Probe42 batch methods for multi-company fetches with concurrency limits (5 for details, 3 for financials) and 200-300ms delays between batches to respect rate limits.
- **Cache Admin Dashboard**: Unified monitoring endpoints at `/api/admin/cache/*` for deduplication metrics, AI cache stats, and overall cost savings summary.

The Corporate Treasury Management module is SEBI-compliant with a configurable Maker-Checker workflow, a four-bucket allocation system for debt-only instruments, and optimized proposals based on mandate constraints. Compliance controls include self-approval prevention and immutable audit trails.

A PAN-driven intelligent onboarding system auto-detects entity types and routes users to appropriate entity-specific flows, including product eligibility matrices and admin approval for non-individual entities.

The Unified Tax & Compliance Module is SEBI-compliant, offering PAN-driven ITR filing with a self-file wizard, CA-assisted filing, and a "Lock-Before-Pay" pattern. Payment gating includes dynamic pricing. Verification methods include EVC via Aadhaar OTP, Bank EVC, Demat EVC, or DSC. A Unified eSign Service provides multi-provider abstraction (AuthBridge, Protean) for legally valid electronic signatures, with admin toggling and full audit trails. It supports Form 15CA/15CB with a Rule 37BB determination engine and CA approval workflows. Tax notice management, a Document Vault, CA Desk, and Agent Tax Dashboard are included. RBAC is implemented for TaxRole types with extensive immutable audit logging.

An External Financial Calendar integrates multi-source data from RBI, SEBI, NSE, and BSE for bond-related events, featuring automatic/manual sync, source filtering, and calendar export.

A Market Holiday Service provides comprehensive holiday calendar data for Indian exchanges (NSE, BSE, MCX, NCDEX), including weekend detection, holiday-aware market status, special sessions, and order scheduling.

A Portfolio Import System allows users to import existing portfolios from external sources like Wealthy.in. Features include secure URL validation (SSRF-protected), HTML parsing with Cheerio, automatic extraction of mutual fund holdings (fund name, units, NAV, returns, folio numbers), and storage in the external_holdings table with source tracking. The import supports 25+ mutual funds per import with transaction history preservation.

An Admin Prospect Dashboard provides centralized oversight of all prospects across agents. Features include consolidated metrics for B2B leads and individual prospects, searchable/filterable tables, prospect creation and assignment dialogs, bulk lead assignment with reason tracking, assignment history, and Zoho CRM lead import with automatic deduplication. API endpoints at `/api/admin/prospects/*` handle metrics, filtering, CRUD, and Zoho integration.

Key features include real-time portfolio/market data, financial calculators, multi-asset support, family collaboration, a 3-tier KYC system (SEBI Accredited Investor compliant), and an AI Chat Assistant (Google Gemini). Zoho CRM integrates for agent and prospect management. A Partner Agent Dashboard tracks P&L and performance. Partner CA Management handles onboarding and revenue share. Agent Payout Dashboard shows earnings and payout requests. Admin Payout Management provides bulk approvals. Fresh Investment Discovery offers AI-curated opportunities. Client Smart Proposals allow manual portfolio entry and AI recommendations. Dynamic wealth management analysis, multi-currency support, customizable alerts, and a financial product marketplace with KYC-based eligibility are provided. Payment processing uses Cashfree and PhonePe. Advanced features include AI-powered expense tracking, BBPS-Expense integration, a regulation-compliant Client KYC Dashboard, Partner Revenue Sharing, and Agent Onboarding/Management with Aadhaar verification. A Post-KYC Auto-Population System integrates with data sources for automated financial data aggregation. A Portfolio Analytics Engine performs XIRR/IRR, CAGR, automated asset allocation, algorithm-based risk profiling, and category tracking. A 17-step KYC onboarding workflow orchestrator manages the compliance journey. The Unlisted Marketplace integrates with Probe42 for analytics and price suggestions.

The Profit-Optimized AI Recommendation Engine provides multi-mode recommendations (Conservative, Balanced, Growth-Optimized) with deterministic numeric scoring. A Suitability Score (S) considers risk match, time horizon, liquidity, and regulatory eligibility. An Upside Score (U) is calculated per asset class using product-specific methodologies. Final scores are weighted by mode. Agent governance includes mode selection, override controls with reason logging, and immutable audit trails. An A/B testing framework with experiment assignment and safety kill switch is included. Client-facing disclosure banners and risk footers ensure SEBI compliance.

The Agent Knowledge Hub provides comprehensive market intelligence, product knowledge, and client communication tools. Features include a Gemini-powered Daily AI Market Brief Engine, Product Knowledge Cards for various financial instruments, Client Explanation Templates with AI-powered simplification, an optional certification system for agent self-improvement, SEBI-compliant immutable audit logging, and Admin Content Governance with version control. IEX Cloud is integrated for global market insights.

### Offline & Slow-Internet Resilience (SEBI-Compliant)
The platform implements PWA capabilities for offline and low-connectivity resilience:
- **Global Network State Manager**: Detects online/offline/slow states.
- **PWA Service Worker**: Caches static assets (cache-first) and APIs (network-first, critical operations never cached).
- **Draft Auto-Save Engine**: IndexedDB-based persistence with AES encryption, auto-save intervals, and checksum verification.
- **Action Queue & Sync Engine**: Queues offline actions with idempotency keys and background sync.
- **Backend Execution Guardrails**: Blocks critical operations (trades, payments) when offline.
- **Adaptive Low-Data Mode**: Disables non-essential UI elements for slow connections.
- **Role-Based Offline RBAC**: Restricts offline actions (execute, pay, trade, submit); only view/draft/analyze allowed.
- **User Communication Layer**: Provides network status banners and sync indicators.
- **Immutable Audit Logs**: Append-only with SHA-256 chain verification and boot-time integrity checks.

### System Design Choices
The platform uses a subdomain-based portal architecture for Admin, Partner, and Client portals, ensuring isolated experiences, security, and role-based access control. Admin Portal registration is disabled.

## External Dependencies

### Third-Party APIs
- Market Data Sources (Probe42, Finnhub, Yahoo Finance)
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
- Twilio (SMS OTP, WhatsApp Service)
- Nodemailer (Email service)
- AMFI Registry API (Simulated)
- Turtlefin Insurance API
- CIBIL
- Zoho Campaigns Service
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