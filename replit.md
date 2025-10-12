# FintekPro - Financial Services Platform

## Overview

FintekPro is a comprehensive full-stack TypeScript financial services platform designed for personal finance and investment management. It provides tools for portfolio management, real-time market data tracking, and a wide array of financial services including stocks, mutual funds, IPOs, bonds, and loans. The platform aims to deliver a modern, robust, and secure solution for users to manage their investments and financial planning, including advanced features like family collaboration, a unified KYC compliance system, and an AI-powered financial assistant.

## User Preferences

I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
- **Framework**: React 18 with TypeScript
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **Charts**: Recharts for data visualization
- **Design Approach**: Mobile-first with responsive and adaptive layouts.
- **Responsive Tab Pattern**: Custom ScrollableTabsList component for optimal mobile UX with intelligent horizontal scrolling, navigation buttons, overflow detection, and smooth animations, implemented across all major pages.

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
- **Family Collaboration & Planning**: Shared financial groups, permission-based access, shared goals, combined net worth, and budget management.
- **Intelligent Tiered KYC System**: Progressive 3-tier KYC framework with SEBI Accredited Investor compliance:
  - **Tier 1 (Basic)**: PAN, Aadhaar, basic profile → Unlocks MF, equity cash (₹50K/day), IPOs, govt securities, FDs
  - **Tier 2 (Enhanced)**: Video KYC, income proof, risk assessment → Unlocks F&O, commodities, global trading, margin trading, unlimited equity
  - **Tier 3 (Accredited Investor)**: SEBI compliance (₹2Cr+ income OR ₹7.5Cr+ net worth OR ₹5Cr+ portfolio OR professional qualification) → Unlocks AIF, PMS, pre-IPO, private equity, offshore investments
  - Route-specific verification: Income route needs income docs, net worth needs CA cert, portfolio needs statements, professional needs credentials
  - Visual KYC Dashboard with product access matrix, tier progression, and smart upgrade prompts
  - Product access control middleware with upgrade recommendations on restricted products
- **Re-KYC Automation System**: Risk-based periodic KYC renewal with automated reminders and transaction permission linking.
- **Investment Proposal System**: Custom ID system, filtering, creation, and full CRUD support.
- **Financial Products Marketplace (Store Page)**: Slidable category tabs, real-time filtering, wishlist, cart, and product detail modals.
- **AI Chat Assistant System**: Integrated chatbot with Gemini AI, supporting various financial functions like portfolio summary, market data, order creation, and financial planning.
- **Dynamic Wealth Management Financial Analysis**: Aggregates real-time client financial data for intelligent investment recommendations, providing metrics like monthly income, obligations, investment capacity, and portfolio returns. Progressive Planning Flow tab order: Dashboard → AI Insights → Risk Profile → Goal Planning → Retirement → Credit Obligations.
- **Multi-Currency Support**: Comprehensive functionality for global investments including exchange rate service, database schema for currency rates, and UI components for currency selection and display.
- **Alert System**: Customizable alerts for market monitoring and spending tracking with various alert types, notification channels, and a background monitoring service.
- **Bank Account Penny Drop Verification**: Instant bank account validation system using Sandbox API with ₹1 test transactions, fuzzy name matching (80%+ threshold using Levenshtein distance), max 3 verification attempts per account, and comprehensive audit trail. Features include real-time status badges, name mismatch warnings with similarity scores, and automated attempt tracking.
- **Three-Tier Payment Gateway System**: Robust payment processing infrastructure with Cashfree (primary) → Stripe (secondary) → PhonePe (tertiary) fallback support.
  - **PhonePe Integration**: SHA256 signature-based authentication, PAY_PAGE instrument type for unified payment interface, comprehensive callback verification, and transaction lifecycle management
  - **Features**: Multi-gateway support in cart checkout and tax reminder subscriptions, status tracking with state mapping (COMPLETED/FAILED/CANCELLED/PENDING), gateway response auditing via JSONB storage, and automatic cache invalidation for downstream effects
  - **Security**: Server-side secret management, X-VERIFY header authentication, callback signature verification, and comprehensive compliance logging

## External Dependencies

### Third-Party APIs
- **Market Data Sources**: Real-time and historical market information providers.
- **BSE Star MFD API**: Mutual fund transaction processing (Buy/Sell, SIP, order tracking).
- **NSE NCB & BSE Bond API**: Government securities, corporate bond trading.
- **Bajaj Finance Integration**: EMI, loan, fixed deposit calculators, and eligibility checks.
- **Tata Capital Integration**: Personal, home, business loans, credit checks, CKYC, and GST verification.
- **exchangerate-api.com**: For live currency exchange rates.
- **Google Gemini API**: For AI Chat Assistant functionality.
- **Sandbox API**: For bank account penny drop verification with instant validation and fuzzy name matching.
- **Payment Gateways**:
  - **Cashfree**: Primary payment gateway for UPI, cards, and digital payments
  - **Stripe**: Secondary gateway for international card payments
  - **PhonePe**: Tertiary gateway for UPI, wallets, and net banking with SHA256 signature-based authentication

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
- **Nodemailer**: For email service integration.