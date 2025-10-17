# FintekPro - Financial Services Platform

## Overview
FintekPro is a comprehensive full-stack TypeScript financial services platform for personal finance and investment management. It provides tools for portfolio management, real-time market data, and a wide array of financial services including stocks, mutual funds, IPOs, bonds, and loans. The platform aims to offer a modern, robust, and secure solution for managing investments and financial planning, incorporating features like family collaboration, a unified KYC compliance system, and an AI-powered financial assistant.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
- **Frameworks**: React 18 with TypeScript.
- **UI Library**: shadcn/ui components built on Radix UI.
- **Styling**: Tailwind CSS with CSS custom properties.
- **Charts**: Recharts for data visualization.
- **Design Approach**: Mobile-first, responsive, and adaptive layouts, utilizing a custom `ScrollableTabsList` component for optimized mobile user experience.

### Technical Implementations
- **Frontend**: Wouter for routing, TanStack Query for state management, React Hook Form with Zod for forms, Vite for building.
- **Backend**: Express.js with TypeScript, PostgreSQL with Drizzle ORM and Drizzle Kit for migrations, Connect-pg-simple for session management, RESTful API pattern, centralized error handling.
- **Authentication**: Simplified system with mandatory two-factor OTP verification (email/SMS/WhatsApp). Unified login accepts email/mobile/userId. Uses Passport.js for credential validation.
- **Data Storage**: PostgreSQL (Neon serverless driver) with Drizzle ORM for type-safe queries and schemas for various financial entities.

### Feature Specifications
- **Portfolio & Market Data**: Real-time tracking, asset allocation, live quotes, charts, and news.
- **Financial Calculators**: SIP, EMI, retirement, and tax calculators.
- **Multi-Asset Support**: Equities, bonds, mutual funds, IPOs, alternative investments.
- **Family Collaboration**: Shared financial groups, permission-based access, and combined net worth management.
- **Intelligent Tiered KYC System**: Progressive 3-tier KYC with SEBI Accredited Investor compliance and re-KYC automation.
- **Investment Proposal System**: Custom ID generation, filtering, creation, and CRUD operations.
- **Financial Products Marketplace**: Slidable category tabs, real-time filtering, wishlist, cart, and product detail modals.
- **AI Chat Assistant System**: Integrated chatbot powered by Gemini AI for financial queries and tasks.
- **Dynamic Wealth Management Analysis**: Aggregates real-time financial data for investment recommendations.
- **Multi-Currency Support**: Comprehensive functionality for global investments with exchange rate services.
- **Alert System**: Customizable alerts for market monitoring and spending.
- **Bank Account Penny Drop Verification**: Instant bank account validation using sandbox API.
- **Dual Payment Gateway System**: India-focused payment processing with Cashfree (primary) and PhonePe (secondary) for robust payment redundancy.
- **Unified Order Management System**: Centralized tracking across all product types with lifecycle management and document generation.
- **Payment-to-Execution Bridge Service**: Automated orchestration connecting payment callbacks to order execution.
- **AIF Order Execution Service**: Automated Alternative Investment Fund processing with SEBI accredited investor validation.
- **AI-Powered Expense Tracking & Budgeting System**: Intelligent personal finance management with automated categorization (Gemini AI), real-time budget tracking, and spending insights.
- **BBPS-Expense Integration**: Seamless bill payment integration with automatic expense tracking and categorization.
- **Client KYC Dashboard**: Regulation-compliant user dashboard displaying UID, KYC tier badge, verification status, product eligibility matrix with lock/unlock indicators, and tier upgrade CTAs.
- **Product Eligibility Matrix**: SEBI/RBI/PMLA-compliant matrix defining KYC tier requirements for 16 product categories including mutual funds, equities, derivatives, bonds, insurance, and alternative investments.
- **Product Access Control Middleware**: Tier-based access enforcement with SEBI-compliant transaction limits (₹50,000 annual limit for basic-tier mutual funds), automated upgrade prompts, and regulatory compliance logging.

### System Design Choices
- **Admin Portal**: Separate subdomain-based admin portal (admin.fintekpro.com) with triple-layer security (subdomain, authentication, role authorization). Includes AdminLayout, API configuration, and system monitoring.
  - **Stakeholder Management**: Comprehensive dashboard for managing clients, partners, agents, and vendors with advanced filtering, search, and real-time data
  - **KYC & Compliance Hub**: Review and approve KYC submissions, bulk actions, document verification, and compliance alerts
  - **Financial Operations Dashboard**: Complete financial oversight with order management, payment tracking (Cashfree/PhonePe), revenue analytics, refund processing, and payment reconciliation
  - **API & Integration Control Center** (In Progress): Webhook logging, API usage tracking, integration health monitoring, and key management for all 3rd party services
- **Consistent Layout**: All pages follow a three-part layout: Left Sidebar Navigation (`EnhancedNavigation`), Main Content Area (`AppLayout`), and Footer (`Footer`). The sidebar is collapsible, process flow-based, and state-persisted.
- **ScrollableTabsList Pattern**: Ensures tabbed navigation is responsive and user-friendly, with dynamic padding to prevent content overlap with navigation arrows.

## External Dependencies

### Third-Party APIs
- **Market Data Sources**: For real-time and historical market information.
- **BSE Star MFD API**: Mutual fund transaction processing.
- **NSE NCB & BSE Bond API**: Government securities and corporate bond trading.
- **Bajaj Finance Integration**: EMI, loan, fixed deposit calculators, eligibility checks.
- **Tata Capital Integration**: Loans, credit checks, CKYC, GST verification.
- **exchangerate-api.com**: Live currency exchange rates.
- **Google Gemini API**: AI Chat Assistant.
- **Cashfree OKYC API**: Aadhaar verification.
- **Sandbox API**: Bank account penny drop verification.
- **Payment Gateways**: Cashfree (primary), PhonePe (secondary) - India-compliant payment processing.
- **Twilio**: SMS OTP delivery.
- **WhatsApp (whatsapp-web.js)**: WhatsApp OTP delivery.
- **Nodemailer**: Email service integration.

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