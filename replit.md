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
The frontend leverages Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for form handling, all built with Vite. The backend uses Express.js with TypeScript, connected to a PostgreSQL database via Drizzle ORM. A RESTful API pattern is implemented with centralized error handling. Authentication includes a simplified system with mandatory two-factor OTP verification (email/SMS/WhatsApp) and unified login (email, mobile, or userId), utilizing Passport.js. Secure password reset functionality uses the existing OTP infrastructure. PAN verification has migrated to Cashfree Verification Suite API. Verified KYC profile display is integrated into the KYC dashboard, including real-time product eligibility based on a tiered KYC system. Verified data from Smart KYC is automatically transferred to user and user profile tables. Backend API responses are standardized for consistency, and frontend error handling is updated for backward compatibility. A duplicate detection and prevention system is implemented with Levenshtein fuzzy name matching, risk scoring, and PAN/email/mobile duplicate detection. The Admin portal includes a comprehensive user management system with full CRUD operations for users. A marketing automation platform is implemented with B2B lead prospecting, email campaigns (Zoho Campaigns), and WhatsApp broadcasts (AiSensy). A comprehensive Stakeholders Management System provides separate entity tables and backend APIs for partners, agents, and suppliers (not just role-based user management), with full CRUD operations, search/filtering, pagination, and shared Zod schema validation contract across frontend, backend, and database layers to prevent schema drift.

### Feature Specifications
Key features include real-time portfolio and market data tracking, various financial calculators, multi-asset support, and family collaboration with shared financial groups and permission-based access. An intelligent tiered KYC system (3-tier with SEBI Accredited Investor compliance) and an AI Chat Assistant powered by Google Gemini are integrated. Dynamic wealth management analysis, multi-currency support, and a customizable alert system enhance user experience. A financial product marketplace offers category tabs, filtering, wishlist, and cart functionalities, with **KYC-based product eligibility gating** enforcing access restrictions (Basic tier: mutual funds regular/equity cash limited/IPO retail/govt securities; Enhanced tier: direct MF/unlimited equity/derivatives/commodities/global trading/bonds/NCDs; Accredited Investor tier: AIF/PMS/pre-IPO/private equity/structured products). Robust payment processing is handled by Cashfree and PhonePe, with a unified order management system. Advanced features include an AI-powered expense tracking and budgeting system, BBPS-Expense integration for bill payments, and a regulation-compliant Client KYC Dashboard with a Product Eligibility Matrix and access control. A Partner Revenue Sharing System and an Agent Onboarding & Management System with tiered agents and secure Aadhaar verification are also implemented. Post-KYC, an Auto-Population System integrates with various data sources for automated financial data aggregation with multi-source consent management. A comprehensive Portfolio Analytics Engine provides XIRR/IRR calculations, CAGR analysis, automated asset allocation, algorithm-based risk profiling, and category performance tracking across multiple data sources. A **17-step KYC onboarding workflow orchestrator** manages the complete compliance journey (PAN → KRA → Aadhaar → CKYC → UCC → Bank → Mandate → Risk Profile → Compliance → Approval) with auto-skip logic for optional steps (CKYC upload/status when KRA finds existing records), dependency validation treating skipped steps as satisfied prerequisites, comprehensive state machine with progress tracking and tier calculation, and SEBI-compliant risk profiling with manipulation prevention.

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
- **Probe42 Service**: B2B company search and financial data enrichment for marketing automation.
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