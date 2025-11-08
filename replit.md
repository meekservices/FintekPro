# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It offers tools for portfolio management, real-time market data, and financial services including stocks, mutual funds, IPOs, bonds, and loans. The platform focuses on secure financial planning, family collaboration, unified KYC compliance, and an AI-powered financial assistant. It aims to empower individual investors and financial advisors with advanced financial tools and insights, with the ambition to become a leading digital financial ecosystem.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 with TypeScript, `shadcn/ui` (built on Radix UI), and Tailwind CSS for styling, maintaining a modern, responsive, and mobile-first design. Recharts is used for data visualization, and custom `ScrollableTabsList` components ensure optimized mobile interaction. A consistent three-part layout (Left Sidebar, Main Content, Footer) with a collapsible, state-persisted sidebar is used across all pages. Reusable UI components like `LoadingState` and `EmptyState` are standardized.

### Technical Implementations
The frontend leverages Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for form validation, all built with Vite. The backend is an Express.js with TypeScript application, connected to a PostgreSQL database via Drizzle ORM, implementing a RESTful API with centralized error handling. Authentication includes simplified login (email, mobile, or userId) with mandatory two-factor OTP verification (email/SMS/WhatsApp) via Passport.js. Secure password reset utilizes the existing OTP infrastructure.

**Production Authentication Security** (November 2025): 
1. **Client-Side Guards**: KYC wizard implements authentication checks via `useAuth()` hook before rendering, with automatic `/login` redirect for unauthenticated users. Data fetching deferred until authentication confirmed via `enabled: !!user` flag.
2. **Session Security**: Session regeneration implemented in both OAuth (Replit) and local authentication flows with fresh CSRF token generation after successful login, preventing session fixation attacks.
3. **Rate Limiting**: Comprehensive rate limiting (5 requests per 15 minutes) applied to 9 authentication endpoints: login, register, OTP send/verify, password reset, preventing brute force attacks.
4. **OTP Hardening**: OTPs stored with scrypt hashing (not plaintext), 5-attempt limit per OTP with auto-increment counter, strict server-side expiration checks, and automatic deletion after successful verification or max attempts exceeded.
5. **User Enumeration Prevention**: All authentication error messages return identical "Invalid credentials" responses across all failure paths (no user found, multiple accounts, wrong password) to prevent account enumeration attacks.
6. **Error Handling**: Process-level handlers for uncaught exceptions and unhandled rejections to prevent silent crashes. Express error middleware logs errors instead of re-throwing to avoid process termination from background job failures.
7. **PAN Verification**: The `/api/kyc/wizard/verify-pan` endpoint derives customer full name from persisted user profile data (firstName, middleName, lastName) for Sandbox.co.in PAN API integration.
8. **CSRF Protection** (November 8, 2025): End-to-end implementation with session-scoped tokens, dedicated `/api/csrf-token` endpoint, automatic frontend integration via queryClient, retry logic on validation failure, and smart webhook exemptions (Cashfree, Zoho, PhonePe, AA callbacks). Architect-verified PASS.
9. **Production Configurations** (November 8, 2025): Database connection pooling (20 max connections prod/10 dev, 30s idle timeout, 10s connect timeout), HTTP server timeouts (65s keep-alive, 66s headers, 120s request timeout), CORS whitelist-based validation, and XSS input sanitization. Architect-verified PASS.
10. **Winston Logger Integration** (November 8, 2025): Structured JSON logging in production, daily log rotation with 14-day retention, 200+ console statements migrated in 5 critical services (KYC workflow orchestrator, payment execution bridge, auto-population orchestrator, account aggregator, reminder scheduler).

**KYC Priority Workflow System**: A production-grade state machine orchestrator implements a 4-tier verification fallback chain: CKYC Lookup (fastest) → KRA eKYC (5 agencies parallel) → Video KYC (HyperVerge/SignDesk) → Manual KYC (final fallback). The system uses persistent state tracking via `kyc_workflows` table (status, currentMethod, attemptedMethods, lock mechanism) and detailed audit logging via `kyc_verification_attempts` table (correlationId, outcome, latencyMs, responseCode, errorDetails). KRA eKYC service queries 5 agencies in parallel (CAMS, CVL, KFintech, NSE, NDML) with agency-specific adapters, data normalization, conflict resolution, and proper error propagation (distinguishes transport failures from logical not-found). Video KYC service integrates HyperVerge (primary) and SignDesk (fallback) with session creation, webhook signature verification (HMAC-SHA256), AI checks parsing (liveness, face match, document verification), and biometric hash storage. Early exit optimization terminates workflow upon first successful verification. All KYC data is encrypted and tokenized before vault storage. Distributed locking prevents concurrent workflows per user.

Basic KYC verification is handled by Sandbox.co.in API for PAN, Aadhaar OKYC, Bank Account, and UPI verification, with real-time product eligibility based on a tiered KYC system. Verified KYC data is automatically transferred to user profiles. Backend API responses are standardized, and frontend error handling is updated for backward compatibility. A duplicate detection system uses Levenshtein fuzzy matching and PAN/email/mobile checks. The Admin portal features comprehensive user management (CRUD). A marketing automation platform integrates B2B lead prospecting, email campaigns (Zoho Campaigns), and WhatsApp broadcasts (AiSensy). A Stakeholders Management System provides separate entity management for partners, agents, and suppliers with shared Zod schema validation.

A comprehensive Payment Execution Bridge handles all 7 product types with a feature-flagged rollout: Mutual Funds (BSE Star API), Loans (multi-lender processing), Bonds (NSE NCB & BSE Bond API), AIF, Equity/IPO/FD (manual processing fallback). Security enhancements include PAN/DOB ownership verification to prevent unauthorized data access, HMAC validation for Zoho Webhooks, and per-user rate limiting for critical endpoints. A Tax Expert Service Entitlement system verifies user eligibility for complimentary ITR filing. An Admin endpoint facilitates CKYC Duplicate Account Merging, consolidating user data and deactivating duplicate accounts with audit logging.

**Agent/EUIN Mapping System** (November 8, 2025): Production-ready mutual fund commission tracking system ensures correct ARN/EUIN attribution for all orders. The `AgentSelectionService` implements intelligent agent resolution: checks `agentClientMapping` table for client-specific assignments → resolves agent from both `agents` and `customer_care_agents` tables → falls back to default agent (marked with `isDefault` flag) when no mapping exists. Historical commission integrity is preserved via immutable snapshots: `agentId`, `arnCode`, and `euinNumber` are captured in `unified_orders` table at order creation time, ensuring AMC audit compliance even when agents are reassigned. Admin API endpoints (`GET/POST /api/admin/agents/default`) enable default agent configuration. The system supports: referral-based agent assignment (URL parameter `?agent_id=XXX`), manual admin reassignment, automatic EUIN selection for BSE Star API integration, and complete audit trail for regulatory compliance. Architect-verified PASS.

Key features include real-time portfolio/market data, financial calculators, multi-asset support, family collaboration with permission-based access, a 3-tier intelligent KYC system (with SEBI Accredited Investor compliance), and an AI Chat Assistant (Google Gemini). Dynamic wealth management analysis, multi-currency support, and a customizable alert system are included. A financial product marketplace offers category tabs, filtering, wishlist, and cart functionalities. Payment processing is handled by Cashfree and PhonePe, with a unified order management system. Advanced features include AI-powered expense tracking, BBPS-Expense integration, and a regulation-compliant Client KYC Dashboard with a Product Eligibility Matrix and access control. A Partner Revenue Sharing System and an Agent Onboarding & Management System with tiered agents and secure Aadhaar verification are implemented. Post-KYC, an Auto-Population System integrates various data sources for automated financial data aggregation with multi-source consent. A Portfolio Analytics Engine provides XIRR/IRR, CAGR, automated asset allocation, risk profiling, and category performance tracking. A one-click Portfolio Rebalancing feature allows executing rebalance recommendations with transaction cost optimization, filtering, and real-time status tracking, supported by user-configurable preferences for tolerance thresholds, minimum transaction amounts, transaction cost percentage, auto-rebalance settings, frequency, and drift notifications.

### System Design Choices
The platform utilizes a subdomain-based portal architecture for Admin, Partner, and Client portals, ensuring isolated experiences, security, and role-based access. Admin Portal registration is disabled.

## External Dependencies

### Third-Party APIs
- **Market Data Sources**: Real-time and historical market information.
- **BSE Star MFD API**: Mutual fund transaction processing.
- **NSE NCB & BSE Bond API**: Government securities and corporate bond trading.
- **Bajaj Finance Integration**: Calculators and eligibility checks.
- **Tata Capital Integration**: Loans, credit checks, CKYC, GST verification.
- **exchangerate-api.com**: Live currency exchange rates.
- **Google Gemini API**: AI Chat Assistant.
- **Sandbox.co.in API**: Comprehensive KYC and tax compliance services (PAN verification, Aadhaar OKYC, Bank Account/UPI verification, Income Tax APIs, TDS APIs, GST APIs, Tax Payment APIs).
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