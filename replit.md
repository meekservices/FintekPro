# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform designed for personal finance and investment management. It provides tools for portfolio management, real-time market data, and access to various financial services including stocks, mutual funds, IPOs, bonds, and loans. The platform emphasizes secure financial planning, family collaboration, unified KYC compliance, and an AI-powered financial assistant. Its goal is to equip individual investors and financial advisors with advanced tools and insights, aspiring to become a leading digital financial ecosystem.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, TypeScript, `shadcn/ui` (Radix UI), and Tailwind CSS for a modern, responsive, mobile-first design. Recharts handles data visualization, and custom `ScrollableTabsList` components optimize mobile interaction. A consistent three-part layout (Left Sidebar, Main Content, Footer) with a collapsible, state-persisted sidebar is used. Reusable UI components like `LoadingState` and `EmptyState` are standardized.

### Technical Implementations
The frontend uses Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation, all powered by Vite. The backend is an Express.js (TypeScript) application, connected to a PostgreSQL database via Drizzle ORM, providing a RESTful API with centralized error handling. Authentication supports simplified login (email, mobile, userId) with mandatory two-factor OTP verification (email/SMS/WhatsApp) via Passport.js, and secure password reset leveraging the OTP infrastructure. Production authentication includes client-side guards, session regeneration with fresh CSRF tokens, comprehensive rate limiting (5 requests per 15 minutes) on critical endpoints with intelligent admin bypass, scrypt-hashed OTP storage with attempt limits and expiration, and user enumeration prevention via generic error messages. Process-level error handlers prevent silent crashes, and input sanitization is implemented. End-to-end CSRF protection uses session-scoped tokens, and database connection pooling, HTTP server timeouts, and CORS whitelist-based validation are configured for production. Winston logger is integrated for structured JSON logging and daily rotation. Session and CSRF cookies use `SameSite=Lax` for improved browser compatibility while maintaining secure and httpOnly flags.

A production-grade state machine orchestrates a 4-tier KYC Priority Workflow System: CKYC Lookup → KRA eKYC (5 agencies parallel) → Video KYC (HyperVerge/SignDesk) → Manual KYC. It features persistent state tracking, detailed audit logging, agency-specific adapters, data normalization, and early exit optimization. All KYC data is encrypted and tokenized. Sandbox.co.in API (with live production keys) handles basic KYC verification for PAN, Aadhaar OKYC, Bank Account, and UPI. Aadhaar type definitions are consolidated in `server/services/kyc/aadhaar-types.ts` for consistency across services. Backup API options (Digilocker OAuth 2.0, Setu OKYC REST API) are researched and available for implementation if primary API fails. KYC sessions include automatic cleanup of expired sessions (30-minute expiry), user-controlled session management with dialog-based resume/cancel options, and race condition prevention through database-level unique constraints. A duplicate detection system uses fuzzy matching. The Admin portal offers user management. A Payment Execution Bridge handles 7 product types, with security enhancements like PAN/DOB ownership verification and HMAC validation. An Agent/EUIN Mapping System ensures correct ARN/EUIN attribution for mutual fund orders, utilizing intelligent agent resolution, immutable snapshots for historical commission integrity, and administrative controls for default agent configuration.

Key features include real-time portfolio/market data, financial calculators, multi-asset support, family collaboration with permission-based access, a 3-tier intelligent KYC system with SEBI Accredited Investor compliance, and an AI Chat Assistant (Google Gemini). Dynamic wealth management analysis, multi-currency support, and a customizable alert system are included. A financial product marketplace offers category tabs, filtering, wishlist, and cart. Payment processing uses Cashfree and PhonePe with a unified order management system. Advanced features include AI-powered expense tracking, BBPS-Expense integration, a regulation-compliant Client KYC Dashboard, a Partner Revenue Sharing System, and an Agent Onboarding & Management System. Post-KYC, an Auto-Population System aggregates financial data. A Portfolio Analytics Engine provides XIRR/IRR, CAGR, automated asset allocation, risk profiling, and category performance tracking. A one-click Portfolio Rebalancing feature allows executing recommendations with transaction cost optimization and user-configurable preferences.

### System Design Choices
The platform uses a subdomain-based portal architecture for Admin, Partner, and Client portals to ensure isolated experiences, security, and role-based access. Admin Portal registration is disabled.

## External Dependencies

### Third-Party APIs
- **Market Data Sources**: Real-time and historical market information.
- **BSE Star MFD API**: Mutual fund transaction processing.
- **NSE NCB & BSE Bond API**: Government securities and corporate bond trading.
- **Bajaj Finance Integration**: Calculators and eligibility checks.
- **Tata Capital Integration**: Loans, credit checks, CKYC, GST verification.
- **exchangerate-api.com**: Live currency exchange rates.
- **Google Gemini API**: AI Chat Assistant.
- **Sandbox.co.in API** (Primary): KYC and tax compliance (PAN, Aadhaar OKYC, Bank Account/UPI verification, Income Tax, TDS, GST, Tax Payments) with live production keys.
- **Digilocker API** (Backup Option): OAuth 2.0-based e-Aadhaar verification via government platform.
- **Setu OKYC API** (Backup Option): OTP-based Aadhaar verification with REST API integration.
- **Cashfree (primary) & PhonePe (secondary)**: Payment Gateways.
- **Cashfree Payout API**: Vendor management, automated commission settlements.
- **Twilio**: SMS OTP delivery.
- **WhatsApp (whatsapp-web.js)**: WhatsApp OTP delivery.
- **Nodemailer**: Email service integration.
- **AMFI Registry API** (Simulated): ARN validation, EUIN verification.
- **Turtlefin Insurance API**: Insurance policy details and auto-population.
- **CIBIL**: Loan liabilities auto-population.
- **Probe42 Service**: B2B company search and financial data enrichment.
- **Zoho Campaigns Service**: Email marketing platform.
- **AiSensy Service**: WhatsApp Business API.

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting.

### UI/UX Libraries
- **Radix UI**: Accessible UI primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide Icons**: Icon library.
- **Recharts**: Declarative charting library.

### Utility Libraries
- **Date-fns**: Date utility.
- **Class Variance Authority**: Variant-based component APIs.
- **Zod**: TypeScript-first schema validation.
- **Nanoid**: URL-safe unique ID generator.