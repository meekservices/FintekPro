# FintekPro - Financial Services Platform

### Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It offers tools for portfolio management, real-time market data, and various financial services including stocks, mutual funds, IPOs, bonds, loans, and unlisted company trading. The platform aims to provide a secure solution for financial planning, incorporating features such as family collaboration, unified KYC compliance, an AI-powered financial assistant, and an Unlisted Marketplace for trading unlisted company shares. Its goal is to empower users with advanced financial tools and insights, serving individual investors and financial advisors, with ambitions to become a leading digital financial ecosystem.

### User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

### System Architecture

#### UI/UX Decisions
The frontend uses React 18 with TypeScript, shadcn/ui components (built on Radix UI), Tailwind CSS for styling, and Recharts for data visualization, all with a mobile-first approach. It features a custom `ScrollableTabsList` for responsive navigation and a consistent three-part layout (Left Sidebar Navigation, Main Content Area, Footer) with a collapsible, state-persisted sidebar. Reusable UI components like `LoadingState` and `EmptyState` are standardized.

#### Technical Implementations
The frontend uses Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for form handling, built with Vite. The backend uses Express.js with TypeScript, PostgreSQL via Drizzle ORM, and a RESTful API with production-grade error handling (AppError taxonomy, retry utility, circuit breaker, resilient client wrappers). Authentication includes mandatory two-factor OTP (email/SMS) and unified login using Passport.js. PAN verification utilizes Cashfree Verification Suite API. KYC features include verified profile display, real-time product eligibility based on tiered KYC, and duplicate detection (Levenshtein fuzzy name matching, risk scoring, PAN/email/mobile detection). The Admin portal includes comprehensive user management. A marketing automation platform integrates B2B lead prospecting, email campaigns (Zoho Campaigns), and WhatsApp broadcasts (Twilio WhatsApp). A Stakeholders Management System provides CRUD operations and APIs for partners, agents, and suppliers with shared Zod schema validation.

The platform uses environment-based auto-detection for API endpoints (Development/Production) with graceful degradation for missing credentials.

The Unlisted Marketplace is SEBI/RBI-compliant, sourcing data from an internal database and MCA via Sandbox.co.in API as a fallback. It includes a multi-methodology price suggestion engine, an atomic transaction-based deal matching system, and a compliance framework with red flag detection and deal blocking. An Admin Negotiation Console facilitates deal management. Automated infrastructure includes cron jobs for data sync and order cleanup. Trading access requires Enhanced/Accredited KYC.

The Corporate Treasury Management module is SEBI-compliant, featuring a configurable Maker-Checker workflow for dual or single approvals. It uses a four-bucket allocation system (operating_cash, liquidity_buffer, short_term_parking, yield_accrual) for debt-only instruments, generating optimized proposals based on mandate constraints. Compliance controls include self-approval prevention and immutable audit trails.

A PAN-driven intelligent onboarding system auto-detects entity types (Individual, Company, HUF, Firm/LLP, AOP, Trust, BOI, Government, Local Authority, Artificial Juridical Person) and routes users to appropriate entity-specific flows. It includes product eligibility matrices and requires admin approval for non-individual entities.

The Unified Tax & Compliance Module is SEBI-compliant, offering PAN-driven ITR filing with a self-file wizard, CA-assisted filing, and a "Lock-Before-Pay" pattern to ensure complete returns before payment. Payment gating includes dynamic pricing and multiple methods. Verification methods include EVC via Aadhaar OTP, Bank EVC, Demat EVC, or DSC (both Hardware Token and Aadhaar eSign). A Unified eSign Service provides multi-provider abstraction supporting AuthBridge and Protean (NSDL) for legally valid electronic signatures under IT Act 2000. Admin can toggle between providers based on pricing (AuthBridge ~₹15/sign, Protean ~₹8/sign) with real-time configuration via the Admin portal. The service includes OTP-based authentication, certificate generation, full audit trail for compliance, and automatic provider detection based on transaction ID prefix. It supports Form 15CA/15CB with a Rule 37BB determination engine and CA approval workflows for international remittances. Tax notices are managed with auto-classification and expert assignment. A Document Vault provides PAN-linked, year-wise storage for tax documents. A CA Desk facilitates expert services, and an Agent Tax Dashboard manages cases. RBAC is implemented for various TaxRole types, and extensive audit logging with immutability controls ensures compliance.

An External Financial Calendar integrates multi-source external data from RBI, SEBI, NSE, and BSE for bond-related events. It features automatic and manual sync, source filtering, calendar export (iCal, subscription URL, Google Calendar), and detailed event dialogs for various bond instruments.

Key features include real-time portfolio/market data, financial calculators, multi-asset support, family collaboration, a tiered KYC system (3-tier with SEBI Accredited Investor compliance), and an AI Chat Assistant (Google Gemini). Dynamic wealth management analysis, multi-currency support, customizable alerts, and a financial product marketplace with KYC-based eligibility are provided. Payment processing is handled by Cashfree and PhonePe. Advanced features include AI-powered expense tracking, BBPS-Expense integration, a regulation-compliant Client KYC Dashboard, Partner Revenue Sharing, and Agent Onboarding/Management with Aadhaar verification. Post-KYC, an Auto-Population System integrates with data sources for automated financial data aggregation with multi-source consent. A Portfolio Analytics Engine performs XIRR/IRR, CAGR analysis, automated asset allocation, algorithm-based risk profiling, and category performance tracking. A 17-step KYC onboarding workflow orchestrator manages the compliance journey with auto-skip logic and SEBI-compliant risk profiling. The Unlisted Marketplace integrates with Probe42 for financial analytics and price suggestions.

The Profit-Optimized AI Recommendation Engine provides multi-mode recommendations (Conservative, Balanced, Growth-Optimized) with deterministic numeric scoring. A Suitability Score (S) uses risk match (35%), time horizon (25%), liquidity (20%), and regulatory eligibility (20%) as gates. An Upside Score (U) is calculated per asset class using product-specific methodologies (e.g., momentum, valuation, sector for stocks; yield, credit quality, duration for bonds). Final scores are weighted by mode: Conservative (85% S / 15% U), Balanced (70% S / 30% U), Growth-Optimized (55% S / 45% U). Agent governance includes mode selection, override controls with mandatory reason logging, and immutable audit trails. An A/B testing framework with experiment assignment, metrics collection, and safety kill switch ensures controlled rollout. Client-facing disclosure banners and mandatory risk footers maintain SEBI compliance.

#### Offline & Slow-Internet Resilience (SEBI-Compliant)
The platform implements comprehensive offline and low-connectivity resilience with PWA capabilities:
- **Global Network State Manager**: Real-time detection of online/offline/slow states with health check endpoint (2-second response guarantee)
- **PWA Service Worker**: App shell caching with cache-first strategy for static assets and network-first for APIs; critical operations never cached
- **Draft Auto-Save Engine**: IndexedDB-based persistence with AES encryption, 5-second auto-save intervals, and checksum verification
- **Action Queue & Sync Engine**: Queues offline actions with idempotency keys, max 3 retries, and background sync on reconnection
- **Backend Execution Guardrails**: Express middleware blocks execution of trades, payments, submissions, and consent capture when offline
- **Adaptive Low-Data Mode**: Disables animations, removes shadows/gradients, and hides decorative images for slow connections
- **Role-Based Offline RBAC**: Matrix blocks execute/pay/trade/submit actions offline for all roles; only view/draft/analyze allowed
- **User Communication Layer**: Non-dismissible network banners when offline, compliance disclosures, and sync status indicators
- **Immutable Audit Logs**: Append-only with SHA-256 chain verification, database-persisted checksums, and boot-time integrity checks

#### System Design Choices
The platform utilizes a subdomain-based portal architecture for Admin, Partner, and Client portals, ensuring isolated experiences, security, and role-based access control. Admin Portal registration is disabled.

### External Dependencies

#### Third-Party APIs
-   Market Data Sources
-   BSE Star MFD API
-   NSE NCB & BSE Bond API
-   Bajaj Finance Integration
-   Tata Capital Integration
-   exchangerate-api.com
-   Google Gemini API
-   Cashfree Verification Suite API
-   Sandbox.co.in API
-   AuthBridge CKYC API
-   AuthBridge Aadhaar eSign API
-   Protean (NSDL) Aadhaar eSign API
-   Protean KRA API
-   Cashfree (Payment Gateway)
-   PhonePe (Payment Gateway)
-   Cashfree Payout API
-   Twilio (SMS OTP)
-   Nodemailer (Email service)
-   AMFI Registry API (Simulated)
-   Turtlefin Insurance API
-   CIBIL
-   Probe42 Service
-   Zoho Campaigns Service
-   Twilio WhatsApp Service

#### Database Services
-   Neon Database (PostgreSQL)

#### UI/UX Libraries
-   Radix UI
-   Tailwind CSS
-   Lucide Icons
-   Recharts

#### Utility Libraries
-   Date-fns
-   Class Variance Authority
-   Zod
-   Nanoid