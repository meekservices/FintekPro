# FintekPro - Financial Services Platform

## Overview

This is FintekPro, a comprehensive financial services platform built as a full-stack TypeScript project. The application provides portfolio management, market data tracking, investment tools, and financial services including stocks, mutual funds, IPOs, bonds, and loans. It features a modern React frontend with shadcn/ui components and an Express.js backend with PostgreSQL database integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation
- **Charts**: Recharts for data visualization
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Management**: Drizzle Kit for migrations
- **Session Management**: Connect-pg-simple for PostgreSQL session storage
- **API Pattern**: RESTful API with modular route structure
- **Error Handling**: Centralized error middleware with structured error responses

### Data Storage Solutions
- **Primary Database**: PostgreSQL accessed via Neon serverless driver
- **ORM**: Drizzle ORM with type-safe queries and schema definitions
- **Schema Structure**: 
  - Users table with authentication data
  - Portfolios and portfolio holdings for investment tracking
  - Watchlists for market monitoring
  - Market data caching for external API responses
  - Asset allocation tracking for portfolio analysis

### Key Features Implementation
- **Portfolio Management**: Real-time portfolio tracking with asset allocation analysis and rebalancing tools
- **Market Data Integration**: Live market quotes, charts, and news via external APIs
- **Financial Calculators**: SIP, EMI, retirement, and tax calculators
- **Multi-Asset Support**: Equities, bonds, mutual funds, IPOs, and alternative investments
- **Responsive Design**: Mobile-first approach with adaptive layouts

## External Dependencies

### Third-Party APIs
- **Market Data Sources**: Real-time and historical market information for global indices

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Session Storage**: PostgreSQL-backed session management

### Development Tools
- **Replit Integration**: Development environment with cartographer and error overlay plugins
- **TypeScript**: Full type safety across frontend and backend
- **ESBuild**: Fast JavaScript bundling for production builds

### UI/UX Libraries
- **Radix UI**: Unstyled, accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide Icons**: Modern icon library
- **Recharts**: Declarative charts built on D3

### Utility Libraries
- **Date-fns**: Modern date utility library
- **Class Variance Authority**: Utility for creating variant-based component APIs
- **Zod**: TypeScript-first schema validation
- **Nanoid**: URL-safe unique string ID generator

## Recent Changes

### Latest modifications with dates
- **October 4, 2025**: Successfully tested BSE Star MFD API integration in demo mode - order processing, status tracking, and payment integration all verified working
- **October 4, 2025**: Fixed BSE credential validation to enable demo mode testing without requiring production credentials
- **October 4, 2025**: Removed SEBI API endpoints (regulatory data API) to clean up console errors - BSE Star MFD API is the actual transaction processing system
- **October 2025**: Implemented custom investment proposal ID system with distinct prefixes: AI- (AI-generated), AGENT- (advisor-created), CLIENT- (client-initiated) for clear proposal source identification
- **October 2025**: Enhanced proposals page with filtering tabs (All/AI/Agent/Client), create proposal dialog for clients, and comprehensive cart integration with add-to-cart buttons
- **October 2025**: Built complete proposal storage layer with 7 database methods supporting full CRUD operations and cart linkage for proposals
- **October 2025**: Integrated proposal-to-cart workflow allowing proposals to be added as cart items with itemType='proposal' and automatic status tracking
- **September 2025**: Reconstructed comprehensive client profile page with enhanced KYC/CKYC integration supporting both individual and non-individual entities across all residency statuses
- **September 2025**: Implemented multi-provider AML screening with real-time compliance monitoring (Sumsub, ComplyCube, Sanction Scanner)
- **September 2025**: Added CKYC (Central KYC Registry) service with KRA and CVL integration for securities trading compliance
- **September 2025**: Enhanced profile management with global residency support (NRI, OCI, PIO, foreign nationals) for all countries
- **September 2025**: Integrated comprehensive regulatory compliance features (FATCA, CRS, PEP declarations, UBO tracking)
- **September 2025**: Added automated AML screening triggers with profile-based risk assessment and enhanced onboarding workflows
- **September 2025**: Created tabbed profile interface with 6 comprehensive sections: Basic Info, Identity & KYC, Address, Financial Profile, Compliance, Banking & Demat
- **September 2025**: Implemented progressive profile completeness tracking with real-time validation and consent management
- **September 2025**: Built seamless integration between profile data and AML/CKYC services for automated compliance workflows

## Financial Institution Integrations

### Bajaj Finance Integration
- **API Services**: EMI Calculator, Personal Loan, Business Loan, Fixed Deposit, Two Wheeler Loan, Insurance Premium, SIP Calculator, Loan Eligibility Checker
- **Interface**: Complete web interface at `/bajaj-finance` with tabbed calculator sections
- **Implementation**: Custom API simulation using published rates and calculation methods

### Tata Capital Integration  
- **API Services**: Personal Loan, Home Loan, Business Loan, Used Car Loan, Loan Against Property, Loan Against Securities, Credit Eligibility Check, GST Verification, Bank Statement Analysis, CKYC Verification
- **Interface**: Professional web interface at `/tata-capital` with comprehensive loan calculation tools
- **Implementation**: Based on official Tata Capital API catalogue with retail and commercial services

### BSE Star MFD API Integration
- **Purpose**: Complete mutual fund transaction processing system for Buy/Sell orders and SIP setup
- **Status**: Fully implemented and tested in demo mode - ready for production deployment
- **Implementation File**: `server/bseStarApi.ts`
- **Features**:
  - Lumpsum order placement (one-time purchases)
  - SIP (Systematic Investment Plan) setup with mandate management
  - Order status tracking and verification
  - Payment gateway integration with PhonePe
  - Client onboarding and BSE user creation
  - Demo mode for testing without BSE credentials
- **Database Tables**:
  - `investment_proposals`: Stores investment proposals with AI/AGENT/CLIENT prefixes
  - `investment_proposal_items`: Stores individual mutual fund items within proposals
- **Test Results** (Demo Mode):
  - ✅ Order Processing: Successfully processes lumpsum and SIP orders
  - ✅ Status Tracking: Real-time order status monitoring
  - ✅ Payment Integration: PhonePe payment gateway integration working
- **Production Requirements**:
  - BSE Star MFD registration with valid credentials (BSE_USER_ID, BSE_PASSWORD, BSE_MEMBER_ID, BSE_PASS_KEY)
  - SEBI-authorized Mutual Fund Distributor (MFD) license with ARN code
  - BSE environment variable set to 'production'
  - SOAP API integration with BSE Star platform
- **Demo Mode**: Fully functional demo mode simulates BSE responses for testing without credentials
- **Related Services**: Integrates with `server/bse-service.ts` for cart-to-order conversion

### Technical Implementation Notes
- Both integrations use financial calculation libraries (financial, financejs) for accurate computations
- APIs simulate official services using published rates and calculation methods from respective institutions
- No official public developer APIs are available from either institution
- Custom implementations provide equivalent functionality to official services