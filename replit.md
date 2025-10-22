# FintekPro - Financial Services Platform

## Overview
FintekPro is a comprehensive full-stack TypeScript financial services platform designed for personal finance and investment management. It offers robust tools for portfolio management, real-time market data, and a wide array of financial services including stocks, mutual funds, IPOs, bonds, and loans. The platform aims to provide a modern, secure solution for financial planning, incorporating features such as family collaboration, a unified KYC compliance system, and an AI-powered financial assistant. Its business vision is to empower users with advanced financial tools and insights, catering to both individual investors and financial advisors, with ambitions to expand into a leading full-service digital financial ecosystem.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
The platform utilizes React 18 with TypeScript for the frontend, employing shadcn/ui components built on Radix UI for its user interface. Styling is managed with Tailwind CSS and CSS custom properties, ensuring a modern and responsive design. Recharts is used for data visualization, and a mobile-first approach is maintained across all layouts, including a custom `ScrollableTabsList` for optimized mobile interaction.

### Technical Implementations
The frontend leverages Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for form handling, all built with Vite. The backend is developed using Express.js with TypeScript, connected to a PostgreSQL database via Drizzle ORM and Drizzle Kit for migrations. A RESTful API pattern is implemented with centralized error handling. Authentication includes a simplified system with mandatory two-factor OTP verification (email/SMS/WhatsApp) and unified login supporting email, mobile, or userId, utilizing Passport.js. Data is stored in PostgreSQL (Neon serverless driver), with Drizzle ORM ensuring type-safe queries and schemas for various financial entities.

### Feature Specifications
Key features include real-time portfolio and market data tracking, various financial calculators (SIP, EMI, retirement, tax), and multi-asset support (equities, bonds, mutual funds, IPOs, alternative investments). The platform supports family collaboration with shared financial groups and permission-based access. An intelligent tiered KYC system (3-tier with SEBI Accredited Investor compliance) and an AI Chat Assistant powered by Google Gemini are integrated. Dynamic wealth management analysis, multi-currency support, and a customizable alert system enhance user experience. Financial product marketplace features slidable category tabs, filtering, wishlist, and cart functionalities. Robust payment processing is handled by a dual payment gateway system (Cashfree and PhonePe), and a unified order management system with a payment-to-execution bridge ensures seamless transaction workflows. Advanced features include an AI-powered expense tracking and budgeting system with automated categorization, BBPS-Expense integration for bill payments, and a regulation-compliant Client KYC Dashboard with a Product Eligibility Matrix and access control middleware. A comprehensive Partner Revenue Sharing System and an Agent Onboarding & Management System with tiered agent levels, secure Aadhaar verification (Cashfree OKYC API), and hierarchical commission distribution are also implemented. Post-KYC, an Auto-Population System integrates with various data sources (e.g., Turtlefin Insurance API, CIBIL) for automated financial data aggregation with multi-source consent management.

### System Design Choices
The platform employs a subdomain-based portal architecture, providing isolated and customized experiences for different user types: Admin Portal (admin.fintekpro.com), Partner Portal (partner.fintekpro.com), and Client Portal (fintekpro.com). This architecture ensures security and role-based access control. All pages maintain a consistent three-part layout: Left Sidebar Navigation, Main Content Area, and Footer, with a collapsible, state-persisted sidebar. The `ScrollableTabsList` pattern is utilized for responsive tabbed navigation.

## External Dependencies

### Third-Party APIs
- **Market Data Sources**: For real-time and historical market information.
- **BSE Star MFD API**: Mutual fund transaction processing.
- **NSE NCB & BSE Bond API**: Government securities and corporate bond trading.
- **Bajaj Finance Integration**: Calculators and eligibility checks.
- **Tata Capital Integration**: Loans, credit checks, CKYC, GST verification.
- **exchangerate-api.com**: Live currency exchange rates.
- **Google Gemini API**: AI Chat Assistant.
- **Cashfree OKYC API**: Aadhaar verification.
- **Sandbox API**: Bank account penny drop verification.
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