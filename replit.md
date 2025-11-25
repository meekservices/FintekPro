# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It provides tools for portfolio management, real-time market data, and various financial services including stocks, mutual funds, IPOs, bonds, loans, and unlisted company trading. The platform aims to offer a secure solution for financial planning, incorporating features such as family collaboration, unified KYC compliance, AI-powered financial assistant, and an Unlisted Marketplace for trading unlisted company shares. Its goal is to empower users with advanced financial tools and insights, serving individual investors and financial advisors, with ambitions to become a leading digital financial ecosystem.

## Recent Completions

### Smart KYC Wizard (November 25, 2025) - COMPLETE
**AI-Assisted KYC Verification Wizard** - Full 8-endpoint workflow for client onboarding
- ✅ `/api/kyc/wizard/start` - Initialize KYC verification session
- ✅ `/api/kyc/wizard/verify-pan` - PAN card verification with Cashfree Verification Suite
- ✅ `/api/kyc/wizard/check-kra-status` - KRA (KYC Registration Agency) status validation
- ✅ `/api/kyc/wizard/send-aadhaar-otp` - Aadhaar OTP generation for eKYC
- ✅ `/api/kyc/wizard/verify-aadhaar-otp` - Aadhaar OTP validation and verification
- ✅ `/api/kyc/wizard/risk-profiling` - SEBI-compliant risk assessment questionnaire
- ✅ `/api/kyc/wizard/compliance-signoff` - Final compliance review and approval
- ✅ `/api/kyc/wizard/complete` - Complete KYC process and update user tier
- ✅ Frontend accessible at `/onboarding` route with full wizard UI
- ✅ All endpoints protected with `requireClientOrHigher` authentication middleware
- ✅ Integration with NSDL CKYC, Tata Capital, and BSE Star for data validation
- ✅ DigiLocker auto-population support for verified documents

### Unlisted Marketplace (November 23, 2025) - COMPLETE
- ✅ Price Suggestion Engine (35% landing + 30% deals + 20% feed + 15% intrinsic, with 10% risk discount)
- ✅ Deal Matching & Atomic Transactions (all operations atomic for data integrity)
- ✅ Compliance & Red Flag Detection (negative networth, high D/E, low liquidity, declining profitability)
- ✅ Admin Negotiation Console (/admin/unlisted/negotiations with price comparison and match scoring)
- ✅ Automated Cron Jobs (Probe42 sync every 6hrs, price refresh every 12hrs, cleanup daily)
- ✅ Frontend Pages (browse, company details, create listings/requests)
- ✅ All Logout Buttons Fixed (header, admin, sidebar)
- ✅ Middleware Ordering Fixed (Vite serves frontend before error handlers)

### Loan Marketplace Database (November 25, 2025) - COMPLETE
- ✅ `loan_products` table created with all required columns (category, collateral_type, min/max age/income/tenure, etc.)
- ✅ `loan_providers` table created with provider_type, API capabilities, contact info
- ✅ `loan_requests` and `loan_applications_marketplace` tables operational
- ✅ `/api/marketplace/loan-products` endpoint functional
- ✅ `/api/marketplace/loan-providers` endpoint functional

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 with TypeScript, employing shadcn/ui components built on Radix UI. Styling is handled with Tailwind CSS and CSS custom properties for a modern, responsive design. Recharts is used for data visualization, and a mobile-first approach is maintained. A custom `ScrollableTabsList` is used for optimized mobile interaction and the `ScrollableTabsList` pattern is utilized for responsive tabbed navigation. All pages maintain a consistent three-part layout: Left Sidebar Navigation, Main Content Area, and Footer, with a collapsible, state-persisted sidebar. Reusable UI components like `LoadingState` and `EmptyState` are standardized across the platform.

### Technical Implementations
The frontend leverages Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for form handling, all built with Vite. The backend uses Express.js with TypeScript, connected to a PostgreSQL database via Drizzle ORM. A RESTful API pattern is implemented with **production-grade error handling and resilience infrastructure**: AppError taxonomy with 10 specialized error classes, automatic retry utility with exponential backoff and jitter, circuit breaker pattern (CLOSED→OPEN→HALF_OPEN state machine), resilient client wrapper for external APIs, centralized error handling middleware with structured logging and unique traceIds, and user-friendly error messages with recovery options. Frontend error handling includes ApiError class, smart retry logic (queries retry 408/429/5xx, mutations retry 5xx/429), and enhanced ErrorBoundary with traceId display. Resilient service wrappers are available for Cashfree, BSE, KFintech, and Gemini APIs with configurable resilience profiles (CRITICAL: 5 retries/45s timeout, STANDARD: 3 retries/30s timeout). Authentication includes a simplified system with mandatory two-factor OTP verification (email/SMS) and unified login (email, mobile, or userId), utilizing Passport.js. Password-based login and mobile OTP login are the only supported authentication methods. Secure password reset functionality uses the existing OTP infrastructure. PAN verification has migrated to Cashfree Verification Suite API. Verified KYC profile display is integrated into the KYC dashboard, including real-time product eligibility based on a tiered KYC system. Verified data from Smart KYC is automatically transferred to user and user profile tables. Backend API responses are standardized for consistency, and frontend error handling is updated for backward compatibility. A duplicate detection and prevention system is implemented with Levenshtein fuzzy name matching, risk scoring, and PAN/email/mobile duplicate detection. The Admin portal includes a comprehensive user management system with full CRUD operations for users. A marketing automation platform is implemented with B2B lead prospecting, email campaigns (Zoho Campaigns), and WhatsApp broadcasts (AiSensy). A comprehensive Stakeholders Management System provides separate entity tables and backend APIs for partners, agents, and suppliers (not just role-based user management), with full CRUD operations, search/filtering, pagination, and shared Zod schema validation contract across frontend, backend, and database layers to prevent schema drift.

### Unlisted Marketplace (NEW)
A SEBI/RBI-compliant Unlisted Marketplace for trading unlisted company shares with:
- **Price Suggestion Engine**: Multi-methodology weighted formula (35% landing price + 30% recent deals + 20% market feed + 15% intrinsic value) with automatic 10% risk discount for high debt (D/E > 2) or negative networth
- **Deal Matching System**: Automatic matching of sell listings with buy requests, atomic transaction processing ensuring data consistency
- **Compliance Framework**: Red flag detection (negative networth, high leverage, low liquidity, declining profitability) with risk scoring (0-100) and deal blocking for high-risk companies
- **Admin Negotiation Console**: /admin/unlisted/negotiations shows seller/buyer prices, suggested midpoints, key financial metrics (ROE, ROCE, D/E ratios), deal match scores
- **Automated Infrastructure**: Cron jobs for Probe42 financial data sync (every 6 hours), price recalculation (every 12 hours), and expired order cleanup (daily)
- **KYC-Based Eligibility**: Enhanced/Accredited KYC tier required for trading access
- **Frontend UI**: Browse companies (/unlisted/browse), view company details (/unlisted/company/:id), create sell listings (/unlisted/sell), create buy requests (/unlisted/buy)

### Feature Specifications
Key features include real-time portfolio and market data tracking, various financial calculators, multi-asset support, and family collaboration with shared financial groups and permission-based access. An intelligent tiered KYC system (3-tier with SEBI Accredited Investor compliance) and an AI Chat Assistant powered by Google Gemini are integrated. Dynamic wealth management analysis, multi-currency support, and a customizable alert system enhance user experience. A financial product marketplace offers category tabs, filtering, wishlist, and cart functionalities, with **KYC-based product eligibility gating** enforcing access restrictions (Basic tier: mutual funds regular/equity cash limited/IPO retail/govt securities; Enhanced tier: direct MF/unlimited equity/derivatives/commodities/global trading/bonds/NCDs; Accredited Investor tier: AIF/PMS/pre-IPO/private equity/structured products). Robust payment processing is handled by Cashfree and PhonePe, with a unified order management system. Advanced features include an AI-powered expense tracking and budgeting system, BBPS-Expense integration for bill payments, and a regulation-compliant Client KYC Dashboard with a Product Eligibility Matrix and access control. A Partner Revenue Sharing System and an Agent Onboarding & Management System with tiered agents and secure Aadhaar verification are also implemented. Post-KYC, an Auto-Population System integrates with various data sources for automated financial data aggregation with multi-source consent management. A comprehensive Portfolio Analytics Engine provides XIRR/IRR calculations, CAGR analysis, automated asset allocation, algorithm-based risk profiling, and category performance tracking across multiple data sources. A **17-step KYC onboarding workflow orchestrator** manages the complete compliance journey (PAN → KRA → Aadhaar → CKYC → UCC → Bank → Mandate → Risk Profile → Compliance → Approval) with auto-skip logic for optional steps, dependency validation, comprehensive state machine with progress tracking, and SEBI-compliant risk profiling with manipulation prevention. The **Unlisted Marketplace** integrates with Probe42 for real-time financial analytics and multi-methodology price suggestions with exact weighted formulas.

### System Design Choices
The platform employs a subdomain-based portal architecture for Admin, Partner, and Client portals, ensuring isolated and customized experiences, security, and role-based access control. Admin Portal registration is entirely disabled for security.

## External Dependencies

### Third-Party APIs
- **Market Data Sources**: For real-time and historical market information.
- **BSE Star MFD API**: Mutual fund transaction processing.
- **NSE NCB & BSE Bond API**: Government securities and corporate bond trading.
- **Bajaj Finance Integration**: Calculators and eligibility checks.
- **Tata Capital Integration**: Loans, credit checks, CKYC, GST verification.
- **exchangerate-api.com**: Live currency exchange rates.
- **Google Gemini API**: AI Chat Assistant.
- **Cashfree Verification Suite API**: PAN verification and Aadhaar OKYC verification.
- **Sandbox.co.in API**: Reserved for ITR filing functionality.
- **Payment Gateways**: Cashfree (primary), PhonePe (secondary).
- **Cashfree Payout API**: Vendor management, automated commission settlements.
- **Twilio**: SMS OTP delivery.
- **WhatsApp (whatsapp-web.js)**: WhatsApp OTP delivery.
- **Nodemailer**: Email service integration.
- **AMFI Registry API** (Simulated): ARN validation, EUIN verification for agent onboarding.
- **Turtlefin Insurance API**: For insurance policy details and auto-population.
- **CIBIL**: For loan liabilities auto-population.
- **Probe42 Service**: B2B company search and financial data enrichment for unlisted marketplace and marketing automation.
- **Zoho Campaigns Service**: Email marketing platform integration.
- **AiSensy Service**: WhatsApp Business API for template-based broadcasts.

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

## Application Status
- ✅ **Build**: Complete and running on port 5000
- ✅ **Frontend**: Served via Vite dev server with hot reload
- ✅ **Backend**: Express.js running with all services initialized
- ✅ **Database**: PostgreSQL connected via Drizzle ORM
- ✅ **Authentication**: Email+password and mobile OTP + Passport.js
- ✅ **Unlisted Marketplace**: Full feature set implemented
- ✅ **Admin Portal**: Accessible via admin subdomain with negotiation console
- ✅ **Cron Jobs**: Automated tasks running (Probe42 sync, price refresh, cleanup)
- ✅ **Error Handling**: Production-grade with structured logging and traceIds

## Testing Instructions
1. Visit the main app at your Replit project URL
2. Create account or login with OTP
3. Complete KYC to reach Enhanced/Accredited tier
4. Navigate to Unlisted section
5. Browse companies and create listings/requests
6. Admin can visit `/admin/unlisted/negotiations` to view negotiations and compliance data
