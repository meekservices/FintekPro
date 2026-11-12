# FintekPro Global Coding Rules (GCR v1.1 + FASP-AI v1.0)
**Effective Date:** March 2026  
**Audience:** All Engineers, Contributors, CI/CD Pipelines, and AI Agents  
**Authority:** Architectural & Compliance Committee  

---

## 1. Cost & Performance Optimization Mandate (GCR v1.1)

All architectural proposals, infrastructure modifications, and code generated for FintekPro **MUST prioritarily recommend cost- and performance-optimized solutions**. 

Before proposing any new cloud resource, tier upgrade, or external API consumption, every solution must satisfy the **Three-Pillar Optimization Assessment**:

| Pillar | Requirement | Standard |
| :--- | :--- | :--- |
| **1. Performance Optimization** | Sub-50ms engine latencies; <15ms cached lookups | Enforce composite & trigram indexes, stream processing, and pre-computed EOD metrics. |
| **2. Cost Optimization** | Zero-waste infrastructure; minimize cloud & vendor API bills | Exhaust native database capabilities (advisory locks, in-memory TTL caching, connection reuse) before provisioning new paid GCP or third-party services. |
| **3. Regulatory Simplicity** | 100% SEBI, RBI, and CERT-In compliant | Ensure solutions do not introduce unnecessary audit surface areas, external dependencies, or security overhead. |

### Practical Cost-Performance Directives:
1. **Serverless Scale-to-Zero & Ephemeral Jobs**:
   - Heavy batch data ingestion (AMFI NAVs, stock synchronizations, MCA filings) must run on ephemeral Cloud Run Jobs or Cloud Schedulers rather than long-running, over-provisioned web instances.
2. **Third-Party API Billing Protection**:
   - Every external call to billable APIs (Upstox, IRIS KFintech, Cashfree, Probe42, Twilio) must pass through a local deduplication and caching gate to prevent duplicate billable hits.
3. **Database Efficiency Over Raw Hardware**:
   - Resolve query bottlenecks through precise indexing (`pg_trgm`, compound B-Trees) and query optimization before suggesting vertical instance scaling.
4. **Active Redis Architecture (Post-Activation Mode)**:
   - In accordance with `docs/REDIS_ACTIVATION_AND_INFRASTRUCTURE_POLICY.md`, **Google Cloud Memorystore for Redis is ACTIVATED and LIVE in production**.
   - All AI advisory services, recommendation engines, and rate limiters MUST actively leverage the shared Redis tier (`distributedCache`, `getSharedRedis`, `aiResponseCacheService`) as Tier 1 for cross-pod AI inference caching, prompt deduplication, distributed sliding-window rate limiting, and real-time market regime distribution.
   - Statutory compliance is preserved: PostgreSQL remains the immutable system of record for SEBI/RBI audit trails (`ai_advisory_outputs`, `portfolio_ai_decisions`), while Redis provides sub-15ms cross-pod acceleration.
   - Graceful fallback: If Redis times out (>150ms) or is unreachable, the system automatically degrades to in-process memory LRU and PostgreSQL without interrupting user advisory flows.

---

## 2. Core Architecture & Layering

- **Strict Layered Separation**: `/api` (routing & HTTP validation) $\rightarrow$ `/services` (business logic) $\rightarrow$ `/core` (mathematical engines) $\rightarrow$ `/data` (storage adapters) $\rightarrow$ `/utils`.
- **Zero Business Logic in Routes**: API route handlers must only parse/validate input and delegate to service modules.
- **ORM-Only Database Access**: Never access the database directly from controllers; use Drizzle ORM exclusively. No raw SQL mutations.
- **Stateless Operations**: All application pods must remain stateless. Distributed locks and state reside in Cloud SQL or configured distributed backends.
- **Idempotency & Retries**: All write operations (orders, payments, KYC submissions) must require idempotency keys and support safe, idempotent retries.

---

## 3. Financial Logic & Valuation Integrity

- **Deterministic Financial Calculations**: Same input $\rightarrow$ Same output ALWAYS. No hidden randomness or stochastic simulation without a fixed seed.
- **Audit Metadata on Financial Outputs**: Every calculation output must include `engine_version`, `calculation_timestamp`, and an explainability block exposing inputs and formulas applied.
- **Zero-Synthetic Data Mandate**: In production, financial recommendations and pricing must derive strictly from authentic partner feeds (AMFI, NSE, BSE, Upstox).

---

## 4. Security & Data Protection

- **Zero Trust Input Validation**: Validate all inputs using Zod or typed schemas; sanitize all outputs.
- **Zero Secrets in Source Code**: Never hardcode API keys, tokens, or credentials. All secrets resolve through GCP Secret Manager.
- **Masking & Encryption**: PAN, Aadhaar, bank accounts, and personal identifiers must be masked in application logs and encrypted at rest using Cloud KMS.

---

## 5. Observability & Self-Healing

- **Structured Telemetry**: Every engine and service must emit structured logs: `{ event, user_id, latency_ms, status }`.
- **Structured Error Schema**: All errors must follow: `{ error_code, message, retryable }`.
- **Graceful Degradation**: If an external data provider fails, the system must fall back to the next pricing waterfall tier (e.g., Live WS $\rightarrow$ EOD Close) without crashing the user session.

---

## 6. AI Advisory System (FASP-AI v1.0)

- **Decision Support System Only**: AI never autonomously executes trades, investments, or statutory filings. Final action requires user or registered advisor (RIA) authorization.
- **Prohibition on Return Guarantees**: AI must NEVER promise financial returns or use deterministic profit language.
- **Suitability Grounding**: Every recommendation must be strictly grounded in the client's `risk_profile`, `investment_horizon`, and `user_segment`.

---

## 7. Frontend Theme & Design Token Standards (GCR UI v1.0)

- **Zero Hardcoded Palette Shells**: Layout headers, sidebars, cards, and root containers must never use static dark or light classes (`bg-slate-900`, `bg-gray-900`, `bg-black`, static dark gradients). Always use semantic tokens: `bg-background`, `bg-card`, `bg-secondary/30`, `border-border` with reactive `dark:` modifiers.
- **Saturated Badge Contrast Mandate**: Never apply `text-foreground` over saturated colored backgrounds (e.g. `bg-blue-600`, `bg-emerald-600`, `bg-purple-600`). Use explicit `text-white` on solid saturated fills, or theme-tinted pairs (`bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300`).
- **Card Contrast**: Avoid borderless cards (`border-0`). Use `border border-border/80 bg-card text-card-foreground shadow-sm` to maintain clarity and visual hierarchy across both modes.
- **Universal Header Theme Controls**: All portal layouts (`AppLayout`, `AgentLayout`, `TopNavLayout`) must expose `<ThemeToggle />` in the primary top header.
- **Dual-Theme Verification Gate**: All new pages, components, and widgets must be validated in both Light and Dark themes before merge and deployment.

