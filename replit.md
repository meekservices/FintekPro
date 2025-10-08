# FintekPro - Financial Services Platform

## Overview

FintekPro is a comprehensive full-stack TypeScript financial services platform. It offers portfolio management, market data tracking, investment tools, and a range of financial services including stocks, mutual funds, IPOs, bonds, and loans. The platform aims to provide a modern and robust solution for personal finance and investment management.

## System Architecture

### UI/UX Decisions
- **Framework**: React 18 with TypeScript
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Charts**: Recharts for data visualization
- **Design Approach**: Mobile-first with responsive and adaptive layouts.
- **Responsive Tab Pattern**: Horizontal scrollable tabs (overflow-x-auto) with flex-shrink-0 applied site-wide to prevent overlap on mobile devices. Implemented across 10+ pages including loans, banking, bonds, markets, and store pages.

### Technical Implementations
- **Frontend**:
    - Routing: Wouter
    - State Management: TanStack Query (React Query)
    - Form Handling: React Hook Form with Zod validation
    - Build Tool: Vite
- **Backend**:
    - Framework: Express.js with TypeScript
    - Database: PostgreSQL with Drizzle ORM
    - Schema Management: Drizzle Kit for migrations
    - Session Management: Connect-pg-simple for PostgreSQL session storage
    - API Pattern: RESTful API
    - Error Handling: Centralized middleware
- **Data Storage**:
    - Primary Database: PostgreSQL via Neon serverless driver
    - ORM: Drizzle ORM for type-safe queries
    - Schema: Users, Portfolios, Watchlists, Market data caching, Asset allocation.

### Feature Specifications
- **Portfolio Management**: Real-time tracking, asset allocation, rebalancing.
- **Market Data Integration**: Live quotes, charts, and news.
- **Financial Calculators**: SIP, EMI, retirement, and tax calculators.
- **Multi-Asset Support**: Equities, bonds, mutual funds, IPOs, alternative investments.
- **Family Collaboration & Planning** (In Progress):
    - Shared family financial groups for couples and households
    - Permission-based access control (owner, admin, member, view-only)
    - Shared portfolios with granular permissions (view, contribute, trade, manage)
    - Family goals tracking (shared and individual goals with contribution tracking)
    - Combined family net worth dashboard
    - Family budget management with alerts
    - Activity logging for all family financial actions
    - Discussion threads for collaborative financial decisions
- **KYC Compliance System**:
    - **MANDATORY FULL KYC POLICY**: ALL financial transactions (stocks, mutual funds, IPOs, bonds) require Full KYC verification regardless of transaction amount.
    - **No Tiered System**: Basic KYC tier has been deprecated. Full KYC is the baseline requirement for all transactions.
    - **Enhanced KYC**: Reserved only for high-value transactions (>₹10 lakh) or special regulatory requirements (NRI status, PEP, etc.).
    - **Unified Compliance**: Consistent KYC requirements across all asset classes ensure regulatory adherence and simplified user experience.
    - **UI Warning Banners**: Amber-colored KYC warning banners displayed on all trading pages (bonds, stocks, mutual funds, IPOs) to inform users of Full KYC requirement.
    - AML screening, audit logging, and regulatory adherence (SEBI, RBI, PMLA, FATCA/CRS).
- **Re-KYC Automation System**:
    - Risk-based periodic KYC renewal (10yr, 8yr, 2yr) with automated reminders (60/30/15 days).
    - Transaction permissions linked to KYC status.
    - Daily cron jobs for reminders and reporting.
- **Investment Proposal System**: Custom ID system (AI-, AGENT-, CLIENT-), filtering, creation dialog, cart integration, and full CRUD support.
- **Financial Products Marketplace (Store Page)**:
    - Slidable category tabs with real-time filtering: All Products, Investment Products, Global Products, Insurance, Banking Products, Professional Services.
    - Product count badges showing filtered results per category.
    - Integrated wishlist, cart functionality, and product detail modals.
    - Featured products, top performers, and hot deals sections with advanced sorting and search.

## Email Service Integration
- **Email Provider**: Custom SMTP integration using support@fintekpro.com
- **Implementation**: Nodemailer-based email service (server/email-service.ts)
- **Features**:
  - Password reset OTP emails with professional HTML templates
  - General notification emails
  - Configured via environment variables: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS
  - Graceful fallback to console logging when SMTP not configured
- **Usage**: Integrated with forgot password flow and notification service

## Recent Changes (October 8, 2025)
- **Authentication System Fix**: Resolved dual auth session conflicts
  - **Root Cause**: Both Replit OAuth and local email/password auth were initializing separate session middleware, causing "doctype is not a valid token" errors
  - **Solution**: Modified `setupAuth()` in server/auth.ts to only configure Passport strategies without re-initializing session/passport (already done by setupReplitAuth)
  - **Removed**: Duplicate session initialization and serialize/deserialize methods from local auth
  - **Result**: Email/password authentication now working correctly alongside Replit OAuth
  - **Admin Credentials**: sangram@fintekpro.com / Kamini@321 (Mobile: 7795048528)
  - **Technical Details**: Shared PostgreSQL session store (connect-pg-simple), unified Passport serialization for both OAuth and local auth

## Recent Changes (October 7, 2025)
- **AI Chat Assistant System (MVP Complete)**: Implemented comprehensive chatbot with Gemini AI integration
  - **Database Schema**: Created 4 tables (chat_sessions, chat_messages, chat_functions, chat_actions) with moderation flags and portfolio linking
  - **Function Registry**: Built 12+ callable functions across categories:
    - Portfolio: getUserPortfolioSummary, getUserPortfolioHoldings, getRecentTransactions, getGoalProgress
    - Market: getMarketSnapshot, searchSecurityInfo
    - Transactions: createEquityOrder (with confirmation), createMutualFundOrder (with confirmation), rebalancePortfolio (with confirmation)
    - Utility: suggestRiskAdjustment, getTaxImplications
    - Profile: getUserProfileSummary
  - **ChatOrchestrator Service**: Handles session management, context loading, Gemini API integration, function calling, and transaction confirmation workflow
  - **API Routes**: Full CRUD with requireAuth middleware (/api/chat/sessions, /api/chat/messages, /api/chat/actions)
  - **React UI**: Message bubbles, input handling, confirmation dialogs at /chat
  - **MVP Status**: Core functionality working. Future enhancements planned:
    1. Streaming responses with SSE/websocket for real-time assistant output
    2. Enhanced multi-action confirmation UX with full transaction details
    3. Session history hydration (welcome message on load)

## Recent Changes (October 6, 2025)
- **TypeScript Error Resolution**: Fixed all TypeScript errors in CKYC verification and profile pages:
  - Added proper type definitions (CkycRecord, CkycDocument, ComplianceStatus)
  - Fixed API request format to use body wrapper
  - Added null/undefined safety checks
  - Transformed CKYC form submission to use correct schema field names (panNumber, aadharNumber, annualIncome, status, etc.)
  - Fixed userId prop propagation to ReCKYCWorkflow component
- **CKYC Form Completion**: Added missing required fields to complete the CKYC onboarding form:
  - Added city, state, and pincode input fields in a 3-column grid layout
  - Implemented smart form initialization using useEffect that merges existing CKYC data without overwriting user edits
  - Updated submission handler to include all required schema fields
  - Form now properly handles both new CKYC submissions and updates to existing records

## Known Technical Debt
- **CKYC Notification Methods**: Methods `createCkycNotificationTrigger` and `updateCkycNotificationStatus` are defined in IStorage interface but implementations are commented out in DatabaseStorage class. The notification-service.ts uses these methods, causing TypeScript errors. This is non-blocking for core functionality but should be addressed in future refactoring.

## External Dependencies

### Third-Party APIs
- **Market Data Sources**: Real-time and historical market information.
- **BSE Star MFD API**: Mutual fund transaction processing (Buy/Sell, SIP, order tracking, PhonePe integration).
- **NSE NCB & BSE Bond API**: Government securities, corporate bond trading, and direct market access.
- **Bajaj Finance Integration**: EMI, loan, fixed deposit calculators, and eligibility checks.
- **Tata Capital Integration**: Personal, home, business loans, credit checks, CKYC, and GST verification.

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