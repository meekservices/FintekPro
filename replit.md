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

**Portfolio Analytics Engine** (NEW): Comprehensive financial analytics system providing portfolio-level insights:
- **XIRR/IRR Calculations**: Newton-Raphson method implementation for calculating Extended Internal Rate of Return across irregular cash flows, supporting accurate return calculations for SIPs, lump sum investments, and mixed portfolios
- **CAGR Analysis**: Compound Annual Growth Rate calculations for individual holdings and category-level performance tracking
- **Asset Allocation**: Automated classification and percentage distribution across 7 asset classes (Equity, Debt, Gold, Real Estate, Retirement, Cash, Insurance) with real-time rebalancing recommendations
- **Risk Profiling**: Algorithm-based risk scoring (0-100) with classification into Conservative/Moderate/Aggressive/Very Aggressive profiles based on equity exposure
- **Category Performance**: Granular performance tracking by asset class, investment type (MF, Demat, EPF, NPS, APY), with returns percentages and absolute gains
- **Multi-Source Aggregation**: Unified analytics across all 8 data sources (MF via BSE STAR, Demat via NSDL/CDSL, EPF, NPS, APY, Bank, Insurance, Loans)

### System Design Choices
The platform employs a subdomain-based portal architecture, providing isolated and customized experiences for different user types: Admin Portal (admin.fintekpro.com), Partner Portal (partner.fintekpro.com), and Client Portal (fintekpro.com). This architecture ensures security and role-based access control. All pages maintain a consistent three-part layout: Left Sidebar Navigation, Main Content Area, and Footer, with a collapsible, state-persisted sidebar. The `ScrollableTabsList` pattern is utilized for responsive tabbed navigation.

**Admin Portal Security** (2025-10-24): Registration is completely disabled on the admin portal to prevent unauthorized account creation. Implementation includes:
- Frontend: Registration tab hidden via `isAdminPortal` flag from `useSubdomain` hook
- Backend: Hostname validation on all registration endpoints (`/api/register`, `/api/register/verify-otp`, `/api/register/resend-otp`) using normalized lowercase hostname with x-forwarded-host priority
- Security: All blocked registration attempts are logged with hostname and IP address for monitoring and compliance auditing

### Code Consistency & Best Practices (2025-10-25)

**Backend API Response Pattern**: Standardized response utilities (`server/utils/responses.ts`) ensure consistent API responses across all endpoints:
- **Success Responses**: Use `apiResponse.success(data, message?)` for 200 OK responses
  ```typescript
  return res.json(apiResponse.success(userData, "User profile updated successfully"));
  ```
- **Error Responses**: Use dedicated helpers for common error scenarios:
  - `apiResponse.error(message, statusCode?)` - General error with custom status
  - `apiResponse.badRequest(message)` - 400 Bad Request
  - `apiResponse.unauthorized(message?)` - 401 Unauthorized (default: "Unauthorized")
  - `apiResponse.forbidden(message?)` - 403 Forbidden (default: "Forbidden")
  - `apiResponse.notFound(message?)` - 404 Not Found (default: "Resource not found")
  - `apiResponse.serverError(message?)` - 500 Internal Server Error
  ```typescript
  if (!user) return res.status(404).json(apiResponse.notFound("User not found"));
  if (!hasPermission) return res.status(403).json(apiResponse.forbidden());
  ```
- **Validation Errors**: Use `apiResponse.formatValidationError(error)` for Zod validation errors
  ```typescript
  const result = insertUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json(apiResponse.formatValidationError(result.error));
  }
  ```
- **Response Format**: All responses follow `{ success: boolean, data?: any, error?: string, validationErrors?: array }`

**Frontend Error Handling**: Updated `client/src/lib/queryClient.ts` with backward-compatible error parsing:
- Extracts `error` or `message` fields from JSON responses
- Maintains compatibility with legacy `{ message }` responses
- Automatically throws errors with descriptive messages for failed requests

**Reusable UI Components** (2025-10-25):
- **LoadingState** (`client/src/components/LoadingState.tsx`): Skeleton-based loading component with 5 variants:
  - `card` - Grid of card skeletons (default 3 columns)
  - `list` - Stacked list item skeletons
  - `table` - Table row skeletons
  - `form` - Form field skeletons
  - `stats` - Stats card skeletons
  ```typescript
  {isLoading ? <LoadingState variant="card" count={6} /> : renderData()}
  ```
- **EmptyState** (`client/src/components/EmptyState.tsx`): Standardized empty state with icon, title, description, and optional CTA
  ```typescript
  <EmptyState 
    icon={Building2} 
    title="No Data Available" 
    description="Your data will appear here"
    actionLabel="Add New"
    onAction={() => handleAdd()}
  />
  ```

**Migration Status**:
- ✅ `server/auth.ts` - 100 endpoints migrated to apiResponse pattern
- ✅ `client/src/lib/queryClient.ts` - Error parser updated with backward compatibility
- ✅ Loading states replaced in: `loans.tsx`, `ipo.tsx`, `insurance.tsx`, `bonds.tsx`
- ⏳ `server/routes.ts` - Deferred for incremental feature-based migration to avoid high-risk bulk edits

## Production Blockers

### Auto-Population KYC Vault Decryption (CRITICAL)
**Status**: Blocked - Requires vault decryption implementation

The auto-population orchestrator's `getKYCData()` method currently returns stubbed PII (`STUB_PAN_${userId}`, mock names, etc.) which causes all production API calls to fail. This affects:
- BSE STAR CAS (mutual fund holdings) - Returns authentication errors with stub PANs
- NSDL/CDSL demat integration - Will fail PAN validation  
- CIBIL loan fetching - Requires real PAN/DOB/mobile
- Insurance policy lookups - Needs valid identification

**Required Actions**:
1. Implement encryption service integration in `getKYCData()` to decrypt:
   - tokenizedPan → real PAN using format-preserving detokenization
   - encryptedFullName, encryptedDateOfBirth, encryptedMobile, encryptedEmail using AES-256-GCM
2. Add vault access audit logging to kycAuditLogs table (purpose: 'auto_population')
3. Implement proper key rotation support and in-memory-only decryption
4. Test all auto-population sources against production APIs with real (test) credentials
5. Add feature flag to prevent production use until vault decryption is complete

**Dependencies**: Encryption service, Key management system, Audit logging framework

## External Dependencies

### Third-Party APIs
- **Market Data Sources**: For real-time and historical market information.
- **BSE Star MFD API**: Mutual fund transaction processing via CAS (Consolidated Account Statement).
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