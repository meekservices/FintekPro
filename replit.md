# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It provides tools for portfolio management, real-time market data, and various financial services including stocks, mutual funds, IPOs, bonds, and loans. The platform aims to offer a secure solution for financial planning, incorporating features such as family collaboration, unified KYC compliance, and an AI-powered financial assistant. Its goal is to empower users with advanced financial tools and insights, serving individual investors and financial advisors, with ambitions to become a leading digital financial ecosystem.

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
The frontend leverages Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for form handling, all built with Vite. The backend uses Express.js with TypeScript, connected to a PostgreSQL database via Drizzle ORM. A RESTful API pattern is implemented with centralized error handling. Authentication includes a simplified system with mandatory two-factor OTP verification (email/SMS/WhatsApp) and unified login (email, mobile, or userId), utilizing Passport.js. Secure password reset functionality uses the existing OTP infrastructure. **KYC verification has migrated from inactive Cashfree to Sandbox.co.in API** for PAN verification (Individual & Corporate), Aadhaar OKYC, Bank Account verification, and UPI verification. Verified KYC profile display is integrated into the KYC dashboard, including real-time product eligibility based on a tiered KYC system. Verified data from Smart KYC is automatically transferred to user and user profile tables. Backend API responses are standardized for consistency, and frontend error handling is updated for backward compatibility. A duplicate detection and prevention system is implemented with Levenshtein fuzzy name matching, risk scoring, and PAN/email/mobile duplicate detection. The Admin portal includes a comprehensive user management system with full CRUD operations for users. A marketing automation platform is implemented with B2B lead prospecting, email campaigns (Zoho Campaigns), and WhatsApp broadcasts (AiSensy). A comprehensive Stakeholders Management System provides separate entity tables and backend APIs for partners, agents, and suppliers (not just role-based user management), with full CRUD operations, search/filtering, pagination, and shared Zod schema validation contract across frontend, backend, and database layers to prevent schema drift.

### Feature Specifications
Key features include real-time portfolio and market data tracking, various financial calculators, multi-asset support, and family collaboration with shared financial groups and permission-based access. An intelligent tiered KYC system (3-tier with SEBI Accredited Investor compliance) and an AI Chat Assistant powered by Google Gemini are integrated. Dynamic wealth management analysis, multi-currency support, and a customizable alert system enhance user experience. A financial product marketplace offers category tabs, filtering, wishlist, and cart functionalities. Robust payment processing is handled by Cashfree and PhonePe, with a unified order management system. Advanced features include an AI-powered expense tracking and budgeting system, BBPS-Expense integration for bill payments, and a regulation-compliant Client KYC Dashboard with a Product Eligibility Matrix and access control. A Partner Revenue Sharing System and an Agent Onboarding & Management System with tiered agents and secure Aadhaar verification are also implemented. Post-KYC, an Auto-Population System integrates with various data sources for automated financial data aggregation with multi-source consent management. A comprehensive Portfolio Analytics Engine provides XIRR/IRR calculations, CAGR analysis, automated asset allocation, algorithm-based risk profiling, and category performance tracking across multiple data sources. A one-click Portfolio Rebalancing feature enables users to execute rebalance recommendations with transaction cost optimization (default 0.1% fee), filtering (skips transactions below user-defined minimum, default ₹1000), complete audit trail via rebalance_executions and rebalance_transactions tables, and real-time status tracking (pending, executing, completed, failed, partially_completed). User-configurable Rebalancing Preferences allow customization of tolerance thresholds (percentage drift before triggering rebalance alerts, default 5%), minimum transaction amounts (to reduce transaction costs, default ₹1000), transaction cost percentage (customizable fee, default 0.10%), auto-rebalance settings (automated execution when conditions are met), rebalancing frequency (monthly, quarterly, semi-annually, annually, or manual), and drift notifications (alerts when portfolio exceeds tolerance threshold). The rebalancing algorithm intelligently applies these preferences to filter recommendations and optimize execution costs.

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
- **Sandbox.co.in API** (PRIMARY KYC PROVIDER): Comprehensive KYC and tax compliance services including:
  - **KYC Services**: PAN verification (Individual & Corporate), Aadhaar OKYC (OTP-based), Bank Account verification (penny drop), UPI verification
  - **Income Tax APIs**: ITR filing, Form 16 processing, Tax P&L, Advance Tax calculation
  - **TDS APIs**: Form 24Q/26Q/27Q, e-filing, Form 16 generation, TCS calculation
  - **GST APIs**: E-invoice, E-way bill, GSTR filing and reconciliation
  - **Tax Payment APIs**: TDS payment, Advance Tax, Self Assessment Tax
- ~~**Cashfree Verification Suite API**~~: **INACTIVE** - Deprecated in favor of Sandbox.co.in for KYC verification
- **Payment Gateways**: Cashfree (primary), PhonePe (secondary)
- **Cashfree Payout API**: Vendor management, automated commission settlements
- **Twilio**: SMS OTP delivery
- **WhatsApp (whatsapp-web.js)**: WhatsApp OTP delivery
- **Nodemailer**: Email service integration
- **AMFI Registry API** (Simulated): ARN validation, EUIN verification for agent onboarding
- **Turtlefin Insurance API**: For insurance policy details and auto-population
- **CIBIL**: For loan liabilities auto-population
- **Probe42 Service**: B2B company search and financial data enrichment for marketing automation
- **Zoho Campaigns Service**: Email marketing platform integration
- **AiSensy Service**: WhatsApp Business API for template-based broadcasts

#### Recent API Migrations (November 2025)
**Cashfree to Sandbox.co.in KYC Migration**: Migrated all KYC verification services from inactive Cashfree Verification Suite API to fully functional Sandbox.co.in API. This migration includes:
- **Migrated Services**: sandbox-kyc-service.ts, kyc-workflow-orchestrator.ts, nri-kyc-service.ts, corporate-kyc-service.ts
- **Migrated Routes**: server/routes.ts and server/agent-routes.ts now use Sandbox for all Aadhaar OTP verification
- **Data Compatibility**: Sandbox refId stored in legacy cashfreeRefId database column for backwards compatibility
- **Breaking Change**: In-progress Cashfree verification sessions will fail (acceptable since Cashfree API is inactive)
- **Status Tracking**: Verification source changed from 'cashfree_okyc' to 'sandbox_okyc' for audit trail

#### Database Maintenance (November 2025)
**Schema Reconciliation Work**:
- **Schema Mismatches Fixed**: Corrected user_budgets (period_type → periodType, spent_amount → spentAmount) and cashfree_transactions (webhookReceivedAt type) to match database state
- **Manual Table Creation**: Created comprehensive_holdings and portfolio_snapshots tables via SQL (November 7, 2025) to unblock auto-population features for urgent republishing
- **Unique Constraints**: Temporarily removed `.unique()` from bbps_categories.categoryCode and bbps_billers.billerCode in schema.ts to bypass Drizzle migration prompts
- **Follow-up Required** (Post-Republish):
  - Reconcile 30+ missing unique constraints across schema.ts
  - Add back unique constraints to bbps_categories.categoryCode and bbps_billers.billerCode
  - Audit all table data for uniqueness violations before adding constraints
  - Re-enable full Drizzle db:push workflow for routine migrations
  - Consider generating SQL migration scripts for constraint additions to avoid interactive prompts

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