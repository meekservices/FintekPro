# FintekPro - Financial Services Platform

## Overview

FintekPro is a comprehensive full-stack TypeScript financial services platform. It offers portfolio management, market data tracking, investment tools, and a range of financial services including stocks, mutual funds, IPOs, bonds, and loans. The platform aims to provide a modern and robust solution for personal finance and investment management.

## User Preferences

Preferred communication style: Simple, everyday language.

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