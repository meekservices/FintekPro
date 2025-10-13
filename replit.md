# FintekPro - Financial Services Platform

## Overview

FintekPro is a comprehensive full-stack TypeScript financial services platform for personal finance and investment management. It offers tools for portfolio management, real-time market data, and a wide array of financial services including stocks, mutual funds, IPOs, bonds, and loans. The platform aims to provide a modern, robust, and secure solution for users to manage their investments and financial planning, incorporating advanced features like family collaboration, a unified KYC compliance system, and an AI-powered financial assistant.

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