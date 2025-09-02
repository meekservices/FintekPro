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
- **September 2025**: Fixed TypeScript errors in IPO analysis page (Calculator icon imports and date formatting issues)
- **September 2025**: Researched and confirmed absence of official Bajaj Finance public API
- **September 2025**: Installed financial calculation libraries (financial, financejs) for accurate financial computations
- **September 2025**: Created comprehensive Bajaj Finance API integration with EMI, personal loan, business loan, FD, insurance, and SIP calculators
- **September 2025**: Built interactive Bajaj Finance web interface at /bajaj-finance with tabbed calculator sections
- **September 2025**: Researched Tata Capital APIs and created complete integration with retail and commercial API capabilities
- **September 2025**: Implemented Tata Capital API with comprehensive loan calculators, KYC verification, and financial services
- **September 2025**: Built interactive Tata Capital web interface at /tata-capital with advanced loan calculation tools
- **September 2025**: Completely removed probe42 integration from the entire system including API routes, components, and all references

## Financial Institution Integrations

### Bajaj Finance Integration
- **API Services**: EMI Calculator, Personal Loan, Business Loan, Fixed Deposit, Two Wheeler Loan, Insurance Premium, SIP Calculator, Loan Eligibility Checker
- **Interface**: Complete web interface at `/bajaj-finance` with tabbed calculator sections
- **Implementation**: Custom API simulation using published rates and calculation methods

### Tata Capital Integration  
- **API Services**: Personal Loan, Home Loan, Business Loan, Used Car Loan, Loan Against Property, Loan Against Securities, Credit Eligibility Check, GST Verification, Bank Statement Analysis, CKYC Verification
- **Interface**: Professional web interface at `/tata-capital` with comprehensive loan calculation tools
- **Implementation**: Based on official Tata Capital API catalogue with retail and commercial services

### Technical Implementation Notes
- Both integrations use financial calculation libraries (financial, financejs) for accurate computations
- APIs simulate official services using published rates and calculation methods from respective institutions
- No official public developer APIs are available from either institution
- Custom implementations provide equivalent functionality to official services