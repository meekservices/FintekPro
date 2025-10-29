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
The frontend uses React 18 with TypeScript, employing shadcn/ui components built on Radix UI. Styling is handled with Tailwind CSS and CSS custom properties for a modern, responsive design. Recharts is used for data visualization, and a mobile-first approach is maintained, including a custom `ScrollableTabsList` for optimized mobile interaction.

### Technical Implementations
The frontend leverages Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for form handling, all built with Vite. The backend uses Express.js with TypeScript, connected to a PostgreSQL database via Drizzle ORM. A RESTful API pattern is implemented with centralized error handling. Authentication includes a simplified system with mandatory two-factor OTP verification (email/SMS/WhatsApp) and unified login (email, mobile, or userId), utilizing Passport.js. Secure password reset functionality uses the existing OTP infrastructure. PAN verification has migrated to Cashfree Verification Suite API. Verified KYC profile display is integrated into the KYC dashboard, including real-time product eligibility based on a tiered KYC system. Verified data from Smart KYC is automatically transferred to user and user profile tables.

### Feature Specifications
Key features include real-time portfolio and market data tracking, various financial calculators, and multi-asset support. The platform supports family collaboration with shared financial groups and permission-based access. An intelligent tiered KYC system (3-tier with SEBI Accredited Investor compliance) and an AI Chat Assistant powered by Google Gemini are integrated. Dynamic wealth management analysis, multi-currency support, and a customizable alert system enhance user experience. A financial product marketplace offers category tabs, filtering, wishlist, and cart functionalities. Robust payment processing is handled by Cashfree and PhonePe, with a unified order management system. Advanced features include an AI-powered expense tracking and budgeting system, BBPS-Expense integration for bill payments, and a regulation-compliant Client KYC Dashboard with a Product Eligibility Matrix and access control. A Partner Revenue Sharing System and an Agent Onboarding & Management System with tiered agents and secure Aadhaar verification are also implemented. Post-KYC, an Auto-Population System integrates with various data sources for automated financial data aggregation with multi-source consent management. A comprehensive Portfolio Analytics Engine provides XIRR/IRR calculations, CAGR analysis, automated asset allocation, algorithm-based risk profiling, and category performance tracking across multiple data sources.

### System Design Choices
The platform employs a subdomain-based portal architecture for Admin, Partner, and Client portals, ensuring isolated and customized experiences, security, and role-based access control. All pages maintain a consistent three-part layout: Left Sidebar Navigation, Main Content Area, and Footer, with a collapsible, state-persisted sidebar. The `ScrollableTabsList` pattern is utilized for responsive tabbed navigation. Admin Portal registration is entirely disabled for security. Backend API responses are standardized for consistency, and frontend error handling is updated for backward compatibility. Reusable UI components like `LoadingState` and `EmptyState` are standardized across the platform.

## Recent Improvements (October 2025)

### Platform-Wide UI/UX Consistency

**Loading State Standardization** (Oct 28): Complete migration to standardized LoadingState component across 15+ pages
- Migrated pages: Admin (whatsapp-setup, aml-monitoring, supplier-management, zoho-dashboard, zoho-logs), Financial services (mlds, ipo, pre-ipo, bonds, insurance, loans, icici-banking), Portfolio & family (family-dashboard, mutual-funds, portfolio)
- Replaced patterns: Custom Skeleton arrays, Loader2 spinners, animate-pulse divs → LoadingState component with 5 variants (card, list, table, form, stats)
- Component location: `client/src/components/LoadingState.tsx`

**API Response Standardization** (Oct 28): Major migration of server routes to use consistent apiResponse utilities
- Status: ~700 single-line error responses migrated across 802 endpoints (`server/utils/responses.ts`)
- Migrated patterns: `res.status(xxx).json({ error/message })` → `apiResponse.serverError/notFound/badRequest/unauthorized/forbidden(res, message)`
- Coverage: All simple single-line error patterns now use standardized format
- Server status: Compiles successfully, all services running without errors
- Remaining work: Multi-line and nested error handlers (~100+ complex patterns) to be migrated incrementally
- Frontend: Error parser (`client/src/lib/queryClient.ts`) updated with backward compatibility for both old and new response formats
- Next phase: Incremental migration of remaining complex error handlers while maintaining backward compatibility

### Duplicate Detection & Prevention System

**Complete End-to-End Implementation** (Oct 28): Production-ready duplicate client registration detection with full frontend-backend integration
- Service: `server/services/duplicateDetectionService.ts` with SQL-based detection using indexed joins (linear complexity)
- Features: Levenshtein fuzzy name matching, risk scoring, PAN/email/mobile duplicate detection with explicit boolean flags
- Database: Indexes added to users table (idx_users_email, idx_users_mobile, idx_users_pan_number) for performance
- Registration API: `/api/register` endpoint blocks PAN duplicates (409 error) and returns email/mobile warnings with boolean flags (panNumberMatch, emailMatch, mobileMatch)
- Agent Client API: `/api/agent/clients` endpoint includes same duplicate detection for agent-created clients
- Admin APIs: Duplicate listing, stats, check, and merge endpoints at `/api/admin/duplicates`, `/api/admin/duplicate-stats`, `/api/admin/check-duplicates`, `/api/admin/merge-accounts`
- Admin UI: Duplicate Management dashboard at `client/src/pages/admin/duplicate-management.tsx` with merge functionality
- Frontend Integration: DuplicateWarningDialog component in `client/src/pages/auth-page.tsx` with 3 actions: Login Instead, Link as Family Member, Continue Anyway
- Family Linking: POST `/api/users/:userId/link-family` endpoint for post-registration family account linking (after OTP verification)
- Design Choice: Email/mobile intentionally not unique in schema to allow family member sharing per regulatory requirements
- Merge Functionality: Deactivates duplicate accounts (does not transfer related data like transactions/portfolios) - honest messaging implemented
- Status: Production-ready with complete frontend-backend integration

### Authentication Security Enhancement

**Mandatory OTP Enforcement** (Oct 29): Critical security fix to ensure all login attempts require two-factor OTP verification
- Removed `/api/login/email` endpoint that allowed password-only login without OTP (security vulnerability)
- Removed `/api/login/mobile` endpoint that allowed password-only login without OTP (security vulnerability)
- All authentication now flows through `/api/login` (credentials validation + OTP sending) and `/api/login/verify-otp` (OTP verification + session creation)
- Unified login endpoint accepts email, mobile, or userId as identifier with automatic OTP delivery to appropriate channel
- OTP delivery channels: Email (via Nodemailer), SMS (via Twilio), WhatsApp (via whatsapp-web.js) with fallback logic
- Design enforcement: No user can complete authentication without verifying OTP, strengthening platform security
- Status: Production-ready, all login flows now require mandatory two-factor verification

### Marketing Automation System

**Complete Implementation** (Oct 29): Advanced marketing automation platform with B2B lead prospecting, email campaigns, and WhatsApp broadcasts
- **Database Schema**: 6 new tables created via SQL (marketing_campaigns, marketing_contacts, campaign_analytics, prospect_leads, lead_activities, client_intelligence)
- **Backend Services**: Three external API integrations with singleton pattern and error handling
  - Probe42 Service (`server/probe42-service.ts`): B2B company search with 2.8M Indian companies, financial data enrichment, lead scoring, Probe42 Score integration
  - Zoho Campaigns Service (`server/zoho-campaigns-service.ts`): Email marketing platform integration, list management, campaign creation, analytics sync
  - AiSensy Service (`server/aisensy-service.ts`): WhatsApp Business API for template-based broadcasts, delivery tracking, contact management
- **Backend Routes**: Comprehensive API at `server/marketing-routes.ts` with 25+ endpoints for campaigns, leads, contacts, analytics, and intelligence
  - Campaign CRUD operations, email/WhatsApp sending, scheduling, analytics sync
  - Lead prospecting with Probe42 filters (revenue, profit, score, location)
  - Contact management and segmentation
  - Client intelligence scoring and financial health analysis
- **Admin Frontend Pages**: 6 complete pages integrated into admin portal
  - Marketing Dashboard (`/admin/marketing-dashboard`): Campaign overview, performance stats, recent activity
  - Email Campaigns (`/admin/email-campaigns`): Zoho Campaigns integration, list management, send/schedule
  - WhatsApp Campaigns (`/admin/whatsapp-campaigns`): AiSensy template management, broadcast sending
  - Lead Prospecting (`/admin/lead-prospecting`): Probe42 company search with financial filters, lead import
  - Client Intelligence (`/admin/client-intelligence`): Verified client financial health from Probe42, investment potential scoring
  - Marketing Analytics (`/admin/marketing-analytics`): Cross-channel performance tracking with Recharts visualizations
- **Navigation**: Integrated into admin sidebar with 6 new menu items (TrendingUp, Mail, MessageSquare, Building2, Target, PieChart icons)
- **Known Technical Debt** (for future optimization):
  - Backend: apiResponse utilities not consistently applied (~23 instances), Zod validation not implemented for marketing routes
  - Frontend: QueryKey hierarchies need refinement (email/WhatsApp campaigns should include type suffix), forms lack zodResolver validation, some data-testid attributes missing
  - Shared types: Ad-hoc interfaces in pages instead of centralized schema types
  - Services: Error normalization could be improved, logging context for debugging
- **Status**: Functional and deployed with working navigation, all features operational. Technical debt items documented for incremental improvement.

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