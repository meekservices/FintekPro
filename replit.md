# FintekPro - Financial Services Platform

### Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It provides tools for portfolio management, real-time market data, and various financial services including stocks, mutual funds, IPOs, bonds, loans, and unlisted company trading. The platform aims to offer a secure solution for financial planning, incorporating features such as family collaboration, unified KYC compliance, AI-powered financial assistant, and an Unlisted Marketplace for trading unlisted company shares. Its goal is to empower users with advanced financial tools and insights, serving individual investors and financial advisors, with ambitions to become a leading digital financial ecosystem.

### User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

### System Architecture

#### UI/UX Decisions
The frontend uses React 18 with TypeScript, employing shadcn/ui components built on Radix UI. Styling is handled with Tailwind CSS and CSS custom properties for a modern, responsive design. Recharts is used for data visualization, and a mobile-first approach is maintained. A custom `ScrollableTabsList` is used for optimized mobile interaction and the `ScrollableTabsList` pattern is utilized for responsive tabbed navigation. All pages maintain a consistent three-part layout: Left Sidebar Navigation, Main Content Area, and Footer, with a collapsible, state-persisted sidebar. Reusable UI components like `LoadingState` and `EmptyState` are standardized across the platform.

#### Technical Implementations
The frontend leverages Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for form handling, all built with Vite. The backend uses Express.js with TypeScript, connected to a PostgreSQL database via Drizzle ORM. A RESTful API pattern is implemented with production-grade error handling and resilience infrastructure including AppError taxonomy, automatic retry utility, circuit breaker pattern, resilient client wrappers, and centralized error handling middleware. Authentication includes a simplified system with mandatory two-factor OTP verification (email/SMS) and unified login (email, mobile, or userId), utilizing Passport.js. PAN verification uses Cashfree Verification Suite API. Verified KYC profile display is integrated into the KYC dashboard, including real-time product eligibility based on a tiered KYC system. A duplicate detection and prevention system is implemented with Levenshtein fuzzy name matching, risk scoring, and PAN/email/mobile duplicate detection. The Admin portal includes a comprehensive user management system with full CRUD operations for users. A marketing automation platform is implemented with B2B lead prospecting, email campaigns (Zoho Campaigns), and WhatsApp broadcasts (AiSensy). A comprehensive Stakeholders Management System provides separate entity tables and backend APIs for partners, agents, and suppliers, with full CRUD operations, search/filtering, pagination, and shared Zod schema validation.

#### Environment Configuration
The platform uses environment-based auto-detection for API endpoints:
-   **Development Environment**: Automatically uses SANDBOX mode for Cashfree services (safe testing without affecting production APIs)
-   **Production Environment**: Automatically uses PRODUCTION mode when published
-   **Auto-Detection Logic**: Services check `CASHFREE_ENVIRONMENT` if explicitly set, otherwise fall back to `NODE_ENV` detection
-   **Credential Management**: Production credentials stored in production secrets vault, development uses sandbox credentials
-   **Graceful Degradation**: Development mode shows warnings for missing credentials instead of failing

#### Unlisted Marketplace
A SEBI/RBI-compliant Unlisted Marketplace for trading unlisted company shares with:
-   **Data Source Priority**: FintekPro internal database (primary) → MCA via Sandbox.co.in API (fallback). The system automatically falls back to MCA when internal data is unavailable.
-   **Price Suggestion Engine**: Multi-methodology weighted formula (35% landing price + 30% recent deals + 20% market feed + 15% intrinsic value) with automatic 10% risk discount for high debt or negative net worth.
-   **Deal Matching System**: Automatic matching of sell listings with buy requests, atomic transaction processing ensuring data consistency.
-   **Compliance Framework**: Red flag detection (negative net worth, high leverage, low liquidity, declining profitability) with risk scoring and deal blocking for high-risk companies.
-   **Admin Negotiation Console**: `/admin/unlisted/negotiations` shows seller/buyer prices, suggested midpoints, key financial metrics, and deal match scores.
-   **Automated Infrastructure**: Cron jobs for Probe42 financial data sync, price recalculation, and expired order cleanup.
-   **KYC-Based Eligibility**: Enhanced/Accredited KYC tier required for trading access.
-   **Frontend UI**: Browse companies, view company details, create sell listings, create buy requests.
-   **Data Quality Warnings**: UI displays source attribution and warnings when fallback data sources are used.

#### Corporate Treasury Management
A SEBI-compliant Corporate Treasury module for managing corporate idle cash with:
-   **Maker-Checker Workflow**: Configurable dual-approval system per mandate. Mandates with `maker_checker_enabled=true` (default) require separate maker and checker approvals. Mandates with `maker_checker_enabled=false` allow single-approval execution.
-   **Approval Flow Gating**: Backend validates approval requests against mandate configuration. Single-approval endpoint rejects requests for dual-approval mandates with audit logging.
-   **Treasury Buckets**: Four-bucket allocation system (operating_cash, liquidity_buffer, short_term_parking, yield_accrual) with debt-only instruments (overnight funds, liquid funds, ultra-short-term funds).
-   **Proposal Generation**: Auto-generates optimized allocations respecting mandate constraints (max_duration_days, max_credit_risk).
-   **Frontend Gating**: UI correctly routes to single-approval vs maker/checker endpoints based on `isSingleApprovalMode(proposal)` helper that checks both status and `makerCheckerEnabled` field.
-   **Compliance Controls**: Self-approval prevention (checker cannot be same as maker), bypass attempt logging, immutable audit trails.

#### PAN-Driven Intelligent Onboarding
A PAN-first intelligent onboarding system that auto-detects entity type and routes users to appropriate flows:
-   **Entity Type Detection**: PAN 4th character determines entity type (P=Individual, C=Company, H=HUF, F=Firm/LLP, A=AOP, T=Trust, B=BOI, G=Government, L=Local Authority, J=Artificial Juridical Person).
-   **Smart Mode**: Auto-detects entity type from PAN and routes to appropriate onboarding flow with entity-specific steps.
-   **Manual Mode**: Allows users to manually select entity type with PAN validation to ensure 4th character matches selected type.
-   **Entity-Specific Flows**: Different onboarding steps per entity type:
    - Individual: PAN → Aadhaar → Data Collection → Risk Profiling → Compliance Signoff
    - HUF: HUF Details (Karta verification) → PAN → Data Collection → Risk Profiling → Compliance Signoff
    - Corporate: Corporate Details (CIN, Board Resolution) → Document Upload → Signatory Verification → Bank → Treasury Setup
    - Firm/LLP: Firm Details (LLPIN) → Document Upload → Signatory Verification → Bank → Treasury Setup
    - Trust/AOP/BOI: Trust Details → Document Upload → Signatory Verification → Bank → Treasury Setup
-   **Product Eligibility Matrix**: Entity types have different product access (Individual: all products; Corporate/Firm/Trust: Treasury only).
-   **Approval Workflow**: Non-individual entities require admin approval after document verification.
-   **PAN Utilities**: Shared utilities in `shared/pan-utils.ts` for PAN validation, type detection, and entity classification.

#### External Financial Calendar Integration
A comprehensive bond calendar with multi-source external data integration:
-   **Data Sources**: RBI (G-Sec auctions, SGB issuances), SEBI (regulatory announcements), NSE (bond listings, issuances, coupon payments, maturities), BSE (bond platform announcements).
-   **Automatic Sync**: Cron-based scheduled sync from all external sources with manual sync trigger option.
-   **Source Filtering**: UI filters by data source (RBI/SEBI/NSE/BSE/Internal) and event type (auctions, issuances, maturities, coupon payments).
-   **Calendar Export**: iCal (.ics) file download for import into calendar apps, subscription URL for live updates, Google Calendar integration per event.
-   **Event Detail Dialog**: Comprehensive event information with quick actions (download event iCal, add to Google Calendar).
-   **Instrument Coverage**: G-Secs, T-Bills, SDLs, SGBs, NCDs, Corporate Bonds, Infrastructure Bonds, Tax-Free Bonds, 54EC Capital Gains Bonds.

#### Feature Specifications
Key features include real-time portfolio and market data tracking, various financial calculators, multi-asset support, and family collaboration with shared financial groups and permission-based access. An intelligent tiered KYC system (3-tier with SEBI Accredited Investor compliance) and an AI Chat Assistant powered by Google Gemini are integrated. Dynamic wealth management analysis, multi-currency support, and a customizable alert system enhance user experience. A financial product marketplace offers category tabs, filtering, wishlist, and cart functionalities, with KYC-based product eligibility gating. Robust payment processing is handled by Cashfree and PhonePe, with a unified order management system. Advanced features include an AI-powered expense tracking and budgeting system, BBPS-Expense integration for bill payments, and a regulation-compliant Client KYC Dashboard with a Product Eligibility Matrix and access control. A Partner Revenue Sharing System and an Agent Onboarding & Management System with tiered agents and secure Aadhaar verification are also implemented. Post-KYC, an Auto-Population System integrates with various data sources for automated financial data aggregation with multi-source consent management. A comprehensive Portfolio Analytics Engine provides XIRR/IRR calculations, CAGR analysis, automated asset allocation, algorithm-based risk profiling, and category performance tracking across multiple data sources. A 17-step KYC onboarding workflow orchestrator manages the complete compliance journey with auto-skip logic, dependency validation, comprehensive state machine, and SEBI-compliant risk profiling with manipulation prevention. The Unlisted Marketplace integrates with Probe42 for real-time financial analytics and multi-methodology price suggestions.

#### System Design Choices
The platform employs a subdomain-based portal architecture for Admin, Partner, and Client portals, ensuring isolated and customized experiences, security, and role-based access control. Admin Portal registration is entirely disabled for security.

### External Dependencies

#### Third-Party APIs
-   **Market Data Sources**: For real-time and historical market information.
-   **BSE Star MFD API**: Mutual fund transaction processing.
-   **NSE NCB & BSE Bond API**: Government securities and corporate bond trading.
-   **Bajaj Finance Integration**: Calculators and eligibility checks.
-   **Tata Capital Integration**: Loans, credit checks, CKYC, GST verification.
-   **exchangerate-api.com**: Live currency exchange rates.
-   **Google Gemini API**: AI Chat Assistant.
-   **Cashfree Verification Suite API**: PAN verification and Aadhaar OKYC verification.
-   **Sandbox.co.in API**: PAN verification, ITR filing functionality.
-   **AuthBridge CKYC API**: CKYC Fetch.
-   **Protean KRA API**: KRA Verification.
-   **Payment Gateways**: Cashfree (primary), PhonePe (secondary).
-   **Cashfree Payout API**: Vendor management, automated commission settlements.
-   **Twilio**: SMS OTP delivery.
-   **Nodemailer**: Email service integration.
-   **AMFI Registry API** (Simulated): ARN validation, EUIN verification for agent onboarding.
-   **Turtlefin Insurance API**: For insurance policy details and auto-population.
-   **CIBIL**: For loan liabilities auto-population.
-   **Probe42 Service**: B2B company search and financial data enrichment for unlisted marketplace and marketing automation.
-   **Zoho Campaigns Service**: Email marketing platform integration.
-   **AiSensy Service**: WhatsApp Business API for template-based broadcasts.

#### Database Services
-   **Neon Database**: Serverless PostgreSQL hosting.

#### UI/UX Libraries
-   **Radix UI**: Accessible UI primitives.
-   **Tailwind CSS**: Utility-first CSS framework.
-   **Lucide Icons**: Icon library.
-   **Recharts**: Declarative charting library.

#### Utility Libraries
-   **Date-fns**: Date utility.
-   **Class Variance Authority**: Variant-based component APIs.
-   **Zod**: TypeScript-first schema validation.
-   **Nanoid**: URL-safe unique ID generator.