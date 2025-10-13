# FintekPro - Financial Services Platform

## Overview

FintekPro is a comprehensive full-stack TypeScript financial services platform for personal finance and investment management. It offers tools for portfolio management, real-time market data, and a wide array of financial services including stocks, mutual funds, IPOs, bonds, and loans. The platform aims to provide a modern, robust, and secure solution for users to manage their investments and financial planning, incorporating advanced features like family collaboration, a unified KYC compliance system, and an AI-powered financial assistant.

## Recent Changes (Oct 13, 2025)

### Cashfree Aadhaar OTP Verification Integration
- **Integrated real Cashfree OKYC API** for Aadhaar verification in Smart KYC Onboarding
- Created `CashfreeAadhaarService` with two-step OTP flow:
  - `generateOTP()`: Sends OTP to Aadhaar-linked mobile (returns ref_id)
  - `verifyOTP()`: Validates OTP and retrieves complete Aadhaar holder details
- Updated KYC wizard routes to use Cashfree API instead of mock service
- Sandbox credentials configured: CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENVIRONMENT
- Returns comprehensive data: name, DOB, gender, father name, full address, mobile, email, photo
- Production-ready with proper error handling and response mapping
- **Fixed middleware role mismatch**: Added 'business_client' role to `requireClientOrHigher` middleware to support both individual and business client access to KYC wizard

### Fixed Layout Theme & UI Consistency
- **Established consistent layout pattern** across all pages with left sidebar navigation and footer
- All routes now use the unified `AppLayout` component (wrapping Router in App.tsx)
- **Updated ScrollableTabsList** to prevent tabs from sliding under navigation arrow buttons
  - Added dynamic padding (48px) when arrows are visible
  - Ensures tab content stays within visible area, not obscured by navigation buttons
- **Layout structure**: Left collapsible sidebar → Main content area → Footer
- All new pages will automatically inherit this layout theme

### TypeScript Error Resolution
- **Fixed all 583 TypeScript compilation errors** across server/storage.ts and server/routes.ts
- Added comprehensive type imports for Product, SupplierProduct, ChatSession, ChatMessage, ChatAction, ChatFunction, CurrencyRate, CkycNotificationTrigger, ApplicationDocument, ProductAccountPreference, ICICILoanApplication, ICICICreditScore, PortfolioComparison, ProductPerformanceMetric and all their Insert variants
- Application now compiles cleanly with zero TypeScript errors
- All runtime functionality verified and working correctly

## User Preferences

I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
- **Framework**: React 18 with TypeScript
- **UI Library**: shadcn/ui components built on Radix UI
- **Styling**: Tailwind CSS with CSS custom properties
- **Charts**: Recharts for data visualization
- **Design Approach**: Mobile-first, responsive, and adaptive layouts with a custom ScrollableTabsList component for optimal mobile UX.

### Layout Architecture (Fixed Theme)
FintekPro follows a consistent three-part layout structure across all pages:

1. **Left Sidebar Navigation** (`EnhancedNavigation` component)
   - Collapsible sidebar (toggle button in header)
   - Process flow-based navigation groups (Getting Started, Research & Planning, Products, Investing, Services, Tax, Family, etc.)
   - User profile section at top when authenticated
   - Quick action buttons (Cart with badge counter)
   - Bottom actions (Profile, Logout, Support)
   - State persisted in localStorage
   - Auto-shows/hides based on content

2. **Main Content Area**
   - Wrapped by `AppLayout` component at Router level (client/src/App.tsx)
   - Flexible container that takes remaining horizontal space
   - Padding and background styling for content separation
   - Contains all page-specific content

3. **Footer** (`Footer` component)
   - Process flow-organized links matching sidebar structure
   - Social media icons
   - Optional credit score widget for authenticated users
   - Copyright and compliance information

### ScrollableTabsList Pattern
For pages with tabbed navigation:
- Use `ScrollableTabsList` wrapper component around `TabsTrigger` elements
- Auto-displays left/right arrow navigation buttons when content overflows
- Dynamic padding (48px) prevents tab content from sliding under arrow buttons
- Gradient fade effects for visual continuity
- Mobile-optimized with touch-friendly controls
- Example usage:
  ```tsx
  <Tabs value={activeTab} onValueChange={setActiveTab}>
    <ScrollableTabsList>
      <TabsTrigger value="tab1">Tab 1</TabsTrigger>
      <TabsTrigger value="tab2">Tab 2</TabsTrigger>
    </ScrollableTabsList>
    <TabsContent value="tab1">...</TabsContent>
  </Tabs>
  ```

### Creating New Pages
All new pages automatically inherit the FintekPro layout theme:
1. Create page component in `client/src/pages/`
2. Add route in `client/src/App.tsx` within the appropriate route section
3. Page will automatically be wrapped with AppLayout (sidebar + footer)
4. Use ScrollableTabsList for any tabbed navigation within the page
5. Add navigation link to EnhancedNavigation sidebar groups if needed

### Technical Implementations
- **Frontend**: Wouter for routing, TanStack Query for state management, React Hook Form with Zod for forms, Vite for building.
- **Backend**: Express.js with TypeScript, PostgreSQL with Drizzle ORM, Drizzle Kit for migrations, Connect-pg-simple for session management, RESTful API pattern, centralized error handling.
- **Authentication**: Simplified authentication system with mandatory two-factor OTP verification. Users register with email, mobile, and password - system auto-generates unique userId (FTP001234 format). Unified login accepts email/mobile/userId + password, then sends OTP via email/SMS/WhatsApp for mandatory verification before session creation. Traditional local auth strategies with Passport.js for credential validation, multi-channel OTP delivery (Email via Nodemailer, SMS via Twilio, WhatsApp fallback).
- **Data Storage**: PostgreSQL (Neon serverless driver) with Drizzle ORM for type-safe queries. Schemas for Users, Portfolios, Watchlists, Market data caching, and Asset allocation.

### Feature Specifications
- **Portfolio & Market Data**: Real-time tracking, asset allocation, live quotes, charts, and news.
- **Financial Calculators**: SIP, EMI, retirement, and tax calculators.
- **Multi-Asset Support**: Equities, bonds, mutual funds, IPOs, alternative investments.
- **Family Collaboration**: Shared financial groups, permission-based access, shared goals, combined net worth, and budget management.
- **Intelligent Tiered KYC System**: Progressive 3-tier KYC framework with SEBI Accredited Investor compliance, including visual dashboard, product access matrix, and re-KYC automation.
- **Investment Proposal System**: Custom ID system, filtering, creation, and full CRUD support.
- **Financial Products Marketplace**: Slidable category tabs, real-time filtering, wishlist, cart, and product detail modals.
- **AI Chat Assistant System**: Integrated chatbot with Gemini AI for financial functions (portfolio summary, market data, order creation, planning).
- **Dynamic Wealth Management Analysis**: Aggregates real-time financial data for intelligent investment recommendations, including income, obligations, investment capacity, and portfolio returns.
- **Multi-Currency Support**: Comprehensive functionality for global investments with exchange rate service and UI components.
- **Alert System**: Customizable alerts for market monitoring and spending tracking.
- **Bank Account Penny Drop Verification**: Instant bank account validation using Sandbox API with ₹1 test transactions, fuzzy name matching, and attempt tracking.
- **Three-Tier Payment Gateway System**: Robust processing with Cashfree (primary), Stripe (secondary), and PhonePe (tertiary) fallback, including SHA256 signature-based authentication for PhonePe.
- **Unified Order Management System**: Centralized tracking across all product types (MF, AIF, PMS, Bonds, Equity, IPOs, FDs, Loans) with lifecycle management, document generation, and secure API endpoints.
- **Payment-to-Execution Bridge Service**: Automated orchestration connecting payment callbacks to order execution systems, supporting partial payments, enhanced idempotency, and fraud prevention.
- **AIF Order Execution Service**: Automated Alternative Investment Fund processing with SEBI accredited investor validation (Tier 3 KYC), partial payment model, automated subscription agreement generation, and document management.
- **AI-Powered Expense Tracking & Budgeting System**: Intelligent personal finance management with automated categorization (Gemini AI), real-time budget tracking, customizable alerts, and AI-generated spending insights.
- **BBPS-Expense Integration**: Seamless bill payment integration with automatic expense tracking. When users pay bills through BBPS (Bharat Bill Payment System), expenses are automatically created and categorized (utilities, entertainment, insurance, etc.). Features smart category mapping, budget tracking updates, and unified transaction history across manual expenses and bill payments.

## External Dependencies

### Third-Party APIs
- **Market Data Sources**: Real-time and historical market information.
- **BSE Star MFD API**: Mutual fund transaction processing.
- **NSE NCB & BSE Bond API**: Government securities, corporate bond trading.
- **Bajaj Finance Integration**: EMI, loan, fixed deposit calculators, eligibility checks.
- **Tata Capital Integration**: Loans, credit checks, CKYC, GST verification.
- **exchangerate-api.com**: Live currency exchange rates.
- **Google Gemini API**: AI Chat Assistant.
- **Sandbox API**: Bank account penny drop verification.
- **Payment Gateways**: Cashfree, Stripe, PhonePe.
- **Twilio**: SMS OTP delivery (manually configured via secrets, not using Replit connector).
- **WhatsApp (whatsapp-web.js)**: WhatsApp OTP delivery as fallback.

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
- **Nodemailer**: Email service integration.