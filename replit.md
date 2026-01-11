# FintekPro - Financial Services Platform

## Overview
FintekPro is a full-stack TypeScript financial services platform for personal finance and investment management. It provides tools for portfolio management, real-time market data, and comprehensive financial services including stocks, mutual funds, IPOs, bonds, loans, and unlisted company trading. The platform aims to deliver a secure solution for financial planning, incorporating features such as family collaboration, unified KYC compliance, an AI-powered financial assistant, and an Unlisted Marketplace. Its goal is to empower users with advanced financial tools and insights, serving individual investors and financial advisors, with ambitions to become a leading digital financial ecosystem.

## User Preferences
I want iterative development.
I prefer detailed explanations.
Ask before making major changes.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture

### UI/UX Decisions
The frontend uses React 18, TypeScript, shadcn/ui (Radix UI), Tailwind CSS, and Recharts, following a mobile-first approach. It features a responsive `ScrollableTabsList`, a consistent three-part layout (Left Sidebar Navigation, Main Content, Footer), and a collapsible, state-persisted sidebar. Reusable components like `LoadingState` and `EmptyState` are standardized.

### Technical Implementations
The frontend leverages Wouter for routing, TanStack Query for state management, and React Hook Form with Zod for validation, powered by Vite. The backend is an Express.js application with TypeScript, utilizing PostgreSQL via Drizzle ORM and a RESTful API. Authentication includes mandatory two-factor OTP and unified login via Passport.js. KYC features include PAN verification, verified profile display, real-time product eligibility, and duplicate detection. An Admin portal provides user management. Marketing automation integrates B2B lead prospecting, email campaigns, and WhatsApp broadcasts. A Stakeholders Management System offers CRUD operations and APIs.

The Unlisted Marketplace is SEBI/RBI-compliant, sourcing data from an internal database and Sandbox.co.in. It features a multi-methodology price suggestion engine, an atomic transaction-based deal matching system, and a compliance framework. An Admin Negotiation Console facilitates deal management. Trading access requires Enhanced/Accredited KYC.

A Multi-Source Financial Data Enrichment System reduces API costs by integrating Probe42 (primary), Finnhub (secondary), and Yahoo Finance (tertiary) with priority-based source selection and rate limit handling. Key components include an Identity Confidence Engine, metric-level source merging, a "Why This Number?" API for auditability, SEBI-compliant immutable audit logging, and AI guardrails.

A comprehensive API cost optimization system minimizes external API calls through: Request Deduplication, AI Response Cache, Batch Company Enrichment, Unified Stock Price Service, Company Data Auto-Refresh Scheduler, Onboarding Cache, Proactive Cache Warming, and a Cache Admin Dashboard for monitoring.

The Corporate Treasury Management module is SEBI-compliant with a configurable Maker-Checker workflow, a four-bucket allocation system, and optimized proposals. Compliance controls include self-approval prevention and immutable audit trails. A PAN-driven intelligent onboarding system auto-detects entity types and routes users to appropriate flows.

The Unified Tax & Compliance Module is SEBI-compliant, offering PAN-driven ITR filing with a self-file wizard, CA-assisted filing, and a "Lock-Before-Pay" pattern. A Unified eSign Service provides multi-provider abstraction for legally valid electronic signatures. It supports Form 15CA/15CB with a Rule 37BB determination engine. Tax notice management, a Document Vault, CA Desk, and Agent Tax Dashboard are included. RBAC is implemented with extensive immutable audit logging.

An External Financial Calendar integrates multi-source data from RBI, SEBI, NSE, and BSE. A Market Holiday Service provides comprehensive holiday calendar data for Indian exchanges. A Portfolio Import System allows users to import existing portfolios from external sources. An Admin Prospect Dashboard provides centralized oversight of all prospects.

Key features include real-time portfolio/market data, financial calculators, multi-asset support, family collaboration, a 3-tier KYC system, and an AI Chat Assistant (Google Gemini). Zoho CRM serves as the single source of truth for agent lead management, with a simplified agent portal (6 categories, 16 menu items) and automatic proposal sync back to Zoho. Partner/Agent dashboards track P&L and performance. Fresh Investment Discovery offers AI-curated opportunities. Client Smart Proposals allow manual portfolio entry and AI recommendations. Dynamic wealth management analysis, multi-currency support, customizable alerts, and a financial product marketplace with KYC-based eligibility are provided. Payment processing uses Cashfree and PhonePe. Advanced features include AI-powered expense tracking, BBPS-Expense integration, a regulation-compliant Client KYC Dashboard, Partner Revenue Sharing, and Agent Onboarding/Management. A Post-KYC Auto-Population System integrates with data sources. A Portfolio Analytics Engine performs XIRR/IRR, CAGR, automated asset allocation, algorithm-based risk profiling, and category tracking. A 17-step KYC onboarding workflow orchestrator manages the compliance journey.

The Profit-Optimized AI Recommendation Engine provides multi-mode recommendations (Conservative, Balanced, Growth-Optimized) with deterministic numeric scoring, suitability scores, and upside scores. Agent governance includes mode selection, override controls with reason logging, and immutable audit trails. An A/B testing framework is included. Client-facing disclosure banners and risk footers ensure SEBI compliance.

The Agent Knowledge Hub provides comprehensive market intelligence, product knowledge, and client communication tools. Features include a Gemini-powered Daily AI Market Brief Engine, Product Knowledge Cards, Client Explanation Templates, an optional certification system, SEBI-compliant immutable audit logging, and Admin Content Governance. IEX Cloud is integrated for global market insights.

The platform implements comprehensive SEBI/RBI-compliant payment handling, including HMAC Signature Verification for webhooks, Client Money Segregation, a Daily Reconciliation System, External Remittance Tracking, MF Batch Credential Validator, DIS Verification Service, and Trustee Escrow Validation. Compliance Persistence Tables maintain 8-year retention.

FEMA Compliance & International Transaction Management includes RBI Purpose Code Validation, LRS Limit Tracking, TCS Calculation Engine, RBI A2 Form Generation, and AD Bank Certificate Management. Integration points include Form 15CA/15CB, payment gateways, and Zoho Books.

Offline & Slow-Internet Resilience is achieved through PWA capabilities: Global Network State Manager, PWA Service Worker, Draft Auto-Save Engine, Action Queue & Sync Engine, Backend Execution Guardrails, Adaptive Low-Data Mode, Role-Based Offline RBAC, and User Communication Layer. Immutable Audit Logs are maintained.

### System Design Choices
The platform uses a subdomain-based portal architecture for Admin, Partner, and Client portals, ensuring isolated experiences, security, and role-based access control.

## External Dependencies

### Third-Party APIs
- Probe42
- Finnhub
- Yahoo Finance
- BSE Star MFD API
- NSE NCB & BSE Bond API
- Bajaj Finance Integration
- Tata Capital Integration
- exchangerate-api.com
- Google Gemini API
- Cashfree Verification Suite API
- Sandbox.co.in API (MCA)
- AuthBridge CKYC API
- AuthBridge Aadhaar eSign API
- Protean (NSDL) Aadhaar eSign API
- Protean KRA API
- Cashfree (Payment Gateway, Payout API)
- PhonePe (Payment Gateway)
- Twilio
- Nodemailer
- AMFI Registry API (Simulated)
- Turtlefin Insurance API
- CIBIL
- Zoho Campaigns Service
- IEX Cloud

### Database Services
- Neon Database (PostgreSQL)

### UI/UX Libraries
- Radix UI
- Tailwind CSS
- Lucide Icons
- Recharts

### Utility Libraries
- Date-fns
- Class Variance Authority
- Zod
- Nanoid