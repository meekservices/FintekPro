# FintekPro Standard Operating Policy: Third-Party Partner & Broker API Governance (SOP-API v1.1)

**Document Code**: SOP-API-2026-01  
**Effective Date**: November 2026 (Updated: Angel One SmartAPI Partner Policy & NCDEX Governance)  
**Governing Authorities**: SEBI (Securities and Exchange Board of India), RBI (Reserve Bank of India), CERT-In (Indian Computer Emergency Response Team), US FINRA / SEC (via Alpaca clearing), and DPDP Act 2023  
**Statutory Desks**: Upstox Gateway Desk, KFintech IRIS Hub, Alpaca International Broker Desk, Smallcase Gateway Desk, Angel One SmartAPI Gateway Desk (NCDEX Commodity Segment)  
**Target Architecture**: Multi-Vendor Resilient API Engine (`server/services/instruments/multi-vendor-resolver.ts`)  

---

## 1. Statutory Mandate, Scope & Architectural Boundary

This Standard Operating Procedure (SOP) defines the non-negotiable operational, technological, and regulatory protocols governing all external third-party Application Programming Interfaces (APIs) connected to the FintekPro ecosystem. 

FintekPro interfaces with licensed institutional infrastructure providers across five critical asset and transaction domains:
1. **Upstox API v3 (RKSV Securities India Pvt. Ltd.)**: Primary licensed exchange market data feed and order routing gateway for Indian Listed Equities (NSE/BSE), Equity Derivatives (F&O), Commodities (MCX), Exchange Traded Funds (ETFs), Sovereign Gold Bonds (SGBs), and Benchmark Indices. Defaulting to API v3 endpoints with Market Price Protection (MPP) and GTT execution.
2. **KFintech IRIS Hub (KFin Technologies Ltd.)**: Primary Registrar & Transfer Agent (RTA) gateway for Mutual Funds (Direct & Regular schemes), Corporate Fixed Deposits, National Pension System (NPS), and Specialised Investment Funds (SIF/AIF).
3. **Alpaca Broker API (Alpaca Securities LLC / BMO Harris Bank N.A.)**: FINRA/SIPC registered clearing broker gateway powering US Equity & ETF trading, fractional share custody, and outward SWIFT wire funding for Indian residents under the **RBI Liberalised Remittance Scheme (LRS)**.
4. **Smallcase Gateway (Smallcase Technologies Pvt. Ltd.)**: Non-custodial basket transaction engine, model portfolio rebalancing bridge, and Demat Loan Against Securities (LAS) eligibility evaluator.
5. **Angel One SmartAPI (Angel One Ltd. - Member: NSE/BSE/MCX/NCDEX)**: Licensed agricultural commodity market data gateway providing real-time quotes, market depth, and historical candlestick feeds for Indian agricultural derivatives on the National Commodity & Derivatives Exchange (NCDEX `ncx_fo` segment) covering statutory inflation benchmarks (Jeera, Turmeric, Guar Seed, Cocudakl, Dhaniya, Castor Seed, Chana). Fills the critical asset coverage gap as Upstox does not support NCDEX.

---

## 2. Zero-Trust Credential Management & Secret Lifecycle

In strict compliance with **FintekPro Global Coding Rules (GCR v1.0)** and **SEBI CSCRF (Cybersecurity and Cyber Resilience Framework)**:

### 2.1 Storage & Access Isolation
- **No Hardcoded Secrets**: Plaintext API keys, secrets, tokens, or private certificates in code repositories, environment config files, or client-side bundles are strictly prohibited.
- **Google Cloud Secret Manager**: All production credentials reside exclusively in GCP Secret Manager under project `fintekpro` and are mounted into Cloud Run runtime memory via encrypted environment variables:
  - Upstox: `UPSTOX_ACCESS_TOKEN` / `UPSTOX_ANALYTICS_TOKEN`, `UPSTOX_TOKEN_ISSUED_AT`, `UPSTOX_TRADING_ACCESS_TOKEN`, `UPSTOX_CLIENT_ID`, `UPSTOX_API_KEY`, `UPSTOX_REDIRECT_URI`
  - IRIS: `IRIS_USERNAME`, `IRIS_PASSWORD`, `IRIS_TENANT_CODE`
  - Alpaca: `ALPACA_API_KEY`, `ALPACA_API_SECRET`, `ALPACA_ENV`
  - Smallcase: `SMALLCASE_GATEWAY_NAME`, `SMALLCASE_SECRET`
  - Angel One: `ANGEL_API_KEY`, `ANGEL_CLIENT_CODE`, `ANGEL_PIN`, `ANGEL_TOTP_SECRET`, `ANGEL_STATIC_IP`
- **IAM Principle of Least Privilege**: Access to API secret versions is granted strictly to the Cloud Run runtime service account (`fintekpro-app@fintekpro.iam.gserviceaccount.com`). Developer and CI/CD IAM accounts possess no read access to production API keys.

### 2.2 Periodic & Emergency Credential Rotation
1. **Scheduled 90-Day Rotation**: API keys, passwords, and webhook secrets must be rotated every 90 calendar days according to the FintekPro Security Calendar.
2. **Emergency Revocation (< 15 Minutes)**: In the event of suspected token leakage or anomalous API activity:
   - The Security Officer triggers immediate revocation in the provider partner portal.
   - Updated credentials are deployed to GCP Secret Manager via:
     ```bash
     gcloud secrets versions add <SECRET_NAME> --data-file=- <<< "<NEW_SECRET_VALUE>"
     ```
   - Cloud Run automatically loads the `:latest` version on the next request or via container restart.

---

## 3. Provider Authentication & Token Lifecycle SOP

```mermaid
sequenceDiagram
    autonumber
    participant Scheduler as Background Cron / Worker
    participant SecretMgr as GCP Secret Manager
    participant App as FintekPro Gateway Service
    participant Partner as Partner API (Upstox/IRIS/Alpaca/Smallcase/AngelOne)

    Note over App,Partner: Daily Token Lifecycle & Pre-Market Verification
    Scheduler->>App: 08:30 AM IST Pre-Market Trigger
    App->>SecretMgr: Fetch Active Token / Credentials
    App->>Partner: Authenticate / Test Ping / Fetch Quote
    alt Auth Success (HTTP 200)
        Partner-->>App: OK (Valid Session)
        App->>Scheduler: Service Health = HEALTHY
    else Token Expired / Auth Failure (HTTP 401/403)
        Partner-->>App: Error (Invalid / Expired Token)
        App->>Partner: Execute OAuth 2.0 Refresh / Re-login
        Partner-->>App: New Access Token
        App->>SecretMgr: Persist Updated Token (:latest)
        App->>Scheduler: Auto-Healed & Verified
    end
```

### 3.1 Upstox API v3 & Triangulated Token Architecture

FintekPro enforces a strict three-tier token lifecycle ensuring separation of market data ingestion, institutional treasury trading, and non-custodial client demat execution:

1. **Tier 1: System Analytics Token (`UPSTOX_ANALYTICS_TOKEN` / `UPSTOX_ACCESS_TOKEN`)**:
   - **Scope**: Read-only exchange quotes (NSE/BSE/MCX), Option Greeks, EOD bhavcopy, and V3 WebSocket binary protobuf feeds.
   - **Validity**: Long-lived Developer Analytics Token (1-year validity; current production token valid through August 2027).
   - **Lifecycle SOP**: Zero daily interactive login required. Monitored via automated age-check; proactive alerts fire 30 days prior to annual rotation.

2. **Tier 2: Institutional Treasury & OMS Token (`UPSTOX_TRADING_ACCESS_TOKEN`)**:
   - **Scope**: Secondary market sovereign debt (G-Secs, T-Bills, SDLs, SGBs) and model portfolio treasury routing.
   - **Validity**: Daily enterprise OAuth session expiring at 03:30 AM IST.
   - **Pre-Market Renewal SOP (08:30 AM IST)**:
     - Automated cron checks token validity via `upstoxMarketDataService.isReady()`.
     - Re-authenticates via institutional service credentials if token expired, updating Secret Manager `:latest`.

3. **Tier 3: Client Segregated Demat OAuth Token (`indian_broker_accounts.access_token`)**:
   - **Scope**: Execution within client-owned demat account at Upstox.
   - **Validity**: Session-bound; expires strictly at trading day close (**15:30 IST**) or 24 hours max.
   - **SEBI FASP-AI Mandate**: No autonomous algorithmic trading without client confirmation. Client grants explicit daily consent via 3-legged OAuth dialog (`/api/upstox/oauth/connect`).

### 3.1.1 Upstox API v3 Upgrade Protocol & Execution Guardrails
- **Default V3 OMS Routing**: All equity, derivative, and debt orders route to `https://api.upstox.com/v3/order/place` (and `v3/order/modify`, `v3/order/cancel`).
- **Market Price Protection (MPP)**: Configured via `market_protection` (percentage buffer, default `0` for broker automated protection). Prevents fill execution spikes on illiquid strikes.
- **Good-Til-Triggered (GTT)**: Native stop-loss and entry order support via `/order/gtt/place`.
- **Freeze-Limit Auto-Slicing**: Large institutional baskets automatically pass `slice: true` to prevent rejection at exchange quantity thresholds.

### 3.2 KFintech IRIS Hub
- **Session Duration**: IRIS tokens expire every 60 minutes.
- **Heartbeat & Re-login SOP**:
  1. Handled by [`iris-service.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/iris-service.ts).
  2. The service maintains an in-memory session token with a 5-minute pre-expiry buffer.
  3. Upon receipt of HTTP 401/403, the client re-authenticates automatically using tenant credentials and retries the original request transparently (zero user impact).

### 3.3 Alpaca Broker API
- **Authentication**: Stateless HMAC request headers (`APCA-API-KEY-ID` and `APCA-API-SECRET-KEY`).
- **Endpoint Routing**:
  - Live Trading & Custody: `https://broker-api.alpaca.markets/v1`
  - Market Data (IEX/SIP): `https://data.alpaca.markets/v2`
- **Environment Parity**: Staging environments connect to Alpaca Sandbox (`https://broker-api.sandbox.alpaca.markets/v1`). Production connects strictly to Live Trading with dual-approval key issuance.

### 3.4 Smallcase Gateway
- **Transaction Model**: Smallcase Gateway employs a **Server-Side Generated Transaction Model**. The client browser SDK never communicates directly with Smallcase without a server-signed JWT.
- **JWT Signing Specification**:
  - Algorithm: `HS256` signed using `SMALLCASE_SECRET`.
  - Token Expiration: Strict 15-minute TTL (`exp = now + 900`).
  - User Claims: `sub = smallcaseAuthId` for connected users; guest payloads for unlinked users.
- **Zero-Storage of Broker Passwords**: FintekPro never receives, stores, or processes client broker credentials. Broker authentication occurs strictly inside the Smallcase Gateway SDK.

### 3.5 Angel One SmartAPI Partner & Publisher Installation, Auth & Upgrade Policy SOP

FintekPro interfaces with Angel One SmartAPI (`https://apiconnect.angelone.in`) to ingest agricultural commodity derivative data on NCDEX (`ncx_fo` segment), closing the critical asset coverage gap as Upstox does not support NCDEX.

#### 3.5.1 Installation & Package Policy (Node.js & Python SDKs)
1. **Official SDKs**:
   - **Node.js / TypeScript**: Official npm package is `smartapi-javascript`. Fresh installation: `npm i smartapi-javascript`. Upgrade command: `npm i smartapi-javascript@latest`.
   - **Python**: Official PyPI package is `smartapi-python`. Fresh installation: `pip install smartapi-python`. Upgrade command: `pip install smartapi-python --upgrade` (with peer dependencies: `pyotp`, `logzero`, `websocket-client`, `pycryptodome`).
2. **FintekPro Sovereign Zero-Dependency Native Architecture**:
   - In accordance with **FintekPro Global Coding Rules (GCR v1.0)** and supply-chain security standards, FintekPro implements a sovereign native HTTP adapter ([`angel-one-adapter.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/adapters/angel-one-adapter.ts)) using Axios and Node.js native `crypto`.
   - **RFC 6238 TOTP Engine**: Dynamically calculates 6-digit TOTP codes from `ANGEL_TOTP_SECRET` using standard Base32 decoding and HMAC-SHA1 without external unvetted dependencies (`pyotp` or unverified wrappers).
3. **SDK Upgrade Cadence & Version Review Policy**:
   - The Engineering Desk conducts quarterly reviews of upstream Angel One developer releases (`angel-one/smartapi-javascript`).
   - If breaking schema changes occur (e.g. SmartAPI v2 protocol revisions, new header signing algorithms, or endpoint deprecations), the native adapter is updated and validated against the Vitest suite ([`angel-one-ncdex.test.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/tests/angel-one-ncdex.test.ts)).

#### 3.5.2 Regulatory Mandate: Static Public IP Whitelisting (SEBI / NSE Guidelines)
- **Mandatory Static IP Whitelisting**: In strict alignment with SEBI circulars and NSE/NCDEX algorithmic and broker gateway guidelines, all programmatic sessions and API order operations **must originate from a pre-registered, whitelisted public static IP address**. Requests originating from dynamic or unwhitelisted residential/cloud IPs are rejected with HTTP 403 / auth error.
- **SmartAPI Dashboard IP Registration**:
  - Up to 5 Static Public IPs can be mapped per API Key on the Angel One SmartAPI developer portal (`smartapi.angelone.in`).
  - The production static IP (`ANGEL_STATIC_IP`, default `8.231.118.86`) is bound to the Cloud Run egress gateway / Cloud NAT.
  - Every outbound API request passes this value in the `X-ClientPublicIP` header.

#### 3.5.3 Two-Factor Authentication (2FA) via RFC 6238 TOTP
- **SMS OTP Deprecation**: Traditional SMS OTPs are fully deprecated and non-compliant for programmatic access.
- **Automated TOTP Handshake**:
  - The login payload pairs `clientcode: ANGEL_CLIENT_CODE`, `password: ANGEL_PIN`, and dynamically generated `totp: generateTOTP(ANGEL_TOTP_SECRET)`.
  - Step size: 30 seconds.
- **CERT-In NTP Clock Drift Enforcement**: Server clocks on Cloud Run must maintain clock drift $\le \pm 50\text{ms}$ with `time.google.com` / `time.nic.in`. Any drift exceeding 25 seconds causes `AB1050` ("Invalid TOTP") handshake rejection by the Angel One gateway.

#### 3.5.4 Partner Auth Endpoints, Header Specification & Token Lifecycle
1. **Authentication Endpoint**: `POST https://apiconnect.angelone.in/rest/auth/partner/v1/loginByPassword` (or `/rest/auth/angelbroking/user/v1/loginByPassword`).
2. **Mandatory Headers**:
   - `Content-Type: application/json`
   - `Accept: application/json`
   - `X-UserType: USER`
   - `X-SourceID: WEB`
   - `X-ClientLocalIP: 127.0.0.1`
   - `X-ClientPublicIP: <ANGEL_STATIC_IP>`
   - `X-MACAddress: 02:00:00:00:00:00`
   - `X-PrivateKey: <ANGEL_API_KEY>`
3. **Session Token Expiration & Caching**:
   - `jwtToken`: Lifetime of **24 hours**. Cached in-memory and proactively refreshed when remaining validity is $< 5\text{ minutes}$.
   - Subsequent calls pass `Authorization: Bearer <jwtToken>`.
   - `refreshToken`: Stored for non-interactive token renewal.
   - `feedToken`: Stored for binary WebSocket market depth streaming.

---

## 4. Rate Limiting, Throttling & Circuit Breakers

To protect partner endpoints and prevent platform-wide cascading failures, all outgoing calls must route through the FintekPro Throttling Layer:

| Provider | Burst Limit | Sustained Cap | Backoff Policy | Circuit Breaker Threshold |
| :--- | :--- | :--- | :--- | :--- |
| **Upstox Market Data** | 50 req/s | 25 req/s | Exponential (50ms $\rightarrow$ 200ms $\rightarrow$ 800ms) | 5 failures in 10s $\rightarrow$ Open 30s |
| **Upstox OMS (Orders)** | 15 req/s | 10 req/s | Exponential + Jitter | 3 consecutive failures $\rightarrow$ Open 60s |
| **KFintech IRIS Hub** | 20 req/s | 15 req/s | 2 retries, 500ms backoff | 5 failures in 15s $\rightarrow$ Open 45s |
| **Alpaca Market Data** | 250 req/min | 200 req/min | 2 retries, 1000ms backoff | 4 failures in 20s $\rightarrow$ Open 60s |
| **Alpaca Broker API** | 120 req/min | 100 req/min | Fail immediately (No blind retries) | 3 failures in 30s $\rightarrow$ Open 120s |
| **Smallcase Gateway** | 60 req/min | 50 req/min | 2 retries, 300ms backoff | 5 failures in 20s $\rightarrow$ Open 30s |
| **Angel One Market Quotes (ncx_fo)** | 10 req/s | 5 req/s | Exponential (100ms $\rightarrow$ 400ms $\rightarrow$ 1200ms) | 4 failures in 10s $\rightarrow$ Open 30s |
| **Angel One Historical Data** | 3 req/s | 1 req/s | 2 retries, 500ms backoff | 3 failures in 15s $\rightarrow$ Open 60s |
| **Angel One Order OMS (if active)** | 10 req/s | 5 req/s | Fail immediately (No blind retries - TOPS cap) | 3 failures in 20s $\rightarrow$ Open 60s |

### Circuit Breaker States
1. **CLOSED (Normal)**: All traffic passes to the primary partner API. Latency and error counters tracked.
2. **OPEN (Tripped)**: When error rate exceeds threshold ($\ge 50\%$ over evaluation window), the breaker trips. Requests immediately fail over to the secondary fallback without hitting the partner network.
3. **HALF-OPEN (Recovery Probe)**: After the timeout window elapses, a single probe request is permitted through. If successful, the breaker resets to `CLOSED`; if it fails, the timeout doubles.

---

## 5. Self-Healing Failover & Degraded Mode Operations

In accordance with **FintekPro Self-Healing Rules**: *"Never crash the full system — return partial results with a warning and fail over to secondary providers."*

```mermaid
flowchart TD
    REQ["Incoming Quote Request<br/>(Symbol / ISIN)"] --> ROUTE{"Asset Class & Region?"}

    ROUTE -->|IN Equities, ETFs, MCX| U_P["1. Upstox API v2 (Primary)"]
    U_P -->|Success| RESP["200 OK Live Quote"]
    U_P -->|Timeout / 429 / 5xx| U_F1["2. NSE/BSE Bhavcopy Cache"]
    U_F1 -->|Success| RESP_WARN["200 OK (Cached / Stale Warning)"]
    U_F1 -->|Fail| U_F2["3. instrument_master.last_price"]
    U_F2 --> RESP_WARN

    ROUTE -->|Mutual Funds| I_P["1. KFintech IRIS Hub (Primary)"]
    I_P -->|Success| RESP
    I_P -->|Timeout / Fail| I_F["2. AMFI / MFAPI Feed (Backup)"]
    I_F -->|Success| RESP_WARN
    I_F -->|Fail| I_F2["3. mutual_funds.nav (Local DB)"]
    I_F2 --> RESP_WARN

    ROUTE -->|US Equities & ETFs| A_P["1. Alpaca Market Data (Primary)"]
    A_P -->|Success| RESP
    A_P -->|Unconfigured / Key Missing / Fail| A_F["2. Yahoo Finance Fallback"]
    A_F -->|Success| RESP_WARN
    A_F -->|Fail| A_F2["3. instrument_master.last_price"]
    A_F2 --> RESP_WARN

    ROUTE -->|NCDEX Agricultural Commodities| AO_P["1. Angel One SmartAPI ncx_fo (Primary)"]
    AO_P -->|Success| RESP
    AO_P -->|403 / Timeout / Fail| AO_F1["2. PostgreSQL commodities Table Cache (EOD)"]
    AO_F1 -->|Success| RESP_WARN
    AO_F1 -->|Fail| AO_F2["3. Institutional Bhavcopy Baseline (7 Commodities)"]
    AO_F2 --> RESP_WARN
```

---

## 6. Regulatory Guardrails & Fiduciary Execution Rules

### 6.1 Non-Autonomous Execution (FASP-AI v1.0 Mandate)
- **Zero Autonomous Trading**: No AI algorithm, scheduled job, or automated webhook may place trades without explicit, non-delegated client confirmation.
- **Advisor & Client Approvals**: Model portfolio rebalances require explicit client approval (via SMS/WhatsApp OTP or authenticated app confirmation) or licensed RIA/CA sign-off.

### 6.2 Upstox Order Routing & SEBI Risk Guardrails
1. **Idempotency**: Every order submission generates a deterministic idempotency key (`ORDER_REQ_{userId}_{isin}_{timestamp}`) preventing duplicate executions on transient network retries.
2. **Pre-Trade Margin Verification**: Order routing checks available funds and DP holding balances before dispatching orders to the Upstox OMS.
3. **Non-Custodial Broker Execution**: FintekPro functions purely as a technology interface. Client funds and securities remain with Upstox / CDSL / NSDL.

### 6.3 KFintech IRIS & SEBI NAV Cut-off Guardrails
1. **Universal NAV Cut-off Enforcement**:
   - Liquid & Overnight Schemes: **1:30 PM IST**
   - Equity, Debt, and Hybrid Schemes: **3:00 PM IST**
2. **Post-Cut-Off Handling**: Orders authorized post-cutoff are assigned an immutable audit timestamp and queued for next-business-day execution (`T+1`).

### 6.4 Alpaca & RBI FEMA LRS Compliance
1. **Cash-Only Enforcement**: Under RBI Liberalised Remittance Scheme rules (max \$250,000 per financial year), Indian residents cannot trade on margin, execute short sales, or trade crypto assets. [`AlpacaKycMapper`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/alpaca/onboarding/alpacaKycMapper.ts) strictly restricts accounts to `enabled_assets: ["us_equity"]`.
2. **International SWIFT Wire Clearing Protocol**:
   - Beneficiary Bank: BMO Harris Bank N.A. (Chicago, IL, USA)
   - Remittance Reference (Field 70): Mandatory inclusion of the investor's unique Alpaca Account Number (`APCA-...`).
   - Purpose Code: Mandatory Form A2 submission under RBI Purpose Code **`S0001`** (Indian investment in equity shares abroad).

### 6.5 Smallcase Demat Lending (LAS) Guardrails
1. **SEBI/RBI Loan-to-Value (LTV) Caps**: Loan against listed equity shares is capped at **50% of the approved portfolio valuation** in strict compliance with RBI Master Directions.
2. **Pledge / Depository Lien Marking**: Loan disbursals remain locked until an irrevocable electronic pledge confirmation is acknowledged by NSDL or CDSL.

### 6.6 Angel One NCDEX & SEBI Algo Trading / Static IP Guardrails
1. **Strict Market Ingestion Scope**: The Angel One SmartAPI connection is provisioned strictly for agricultural commodity inflation benchmarking, NCDEX spot-futures basis tracking, and derivative analytics (`ncx_fo` segment).
2. **Zero Autonomous Algorithmic Order Routing (FASP-AI v1.0 Mandate)**: In compliance with SEBI algo directives and FintekPro advisory rules, no autonomous trade execution or programmatic position entry may take place through Angel One without explicit, non-delegated client confirmation and licensed advisor sign-off.
3. **SEBI Static IP & TOPS Compliance**:
   - In accordance with SEBI retail algo guidelines, all programmatic traffic must originate strictly from the whitelisted Cloud Run static egress IP (`ANGEL_STATIC_IP`).
   - Order placement frequency (if OMS capabilities are activated in future releases) is bound to the Threshold Order Per Second (TOPS) statutory cap of **10 OPS**.
   - All requests must carry deterministic idempotency keys (`ORDER_REQ_{userId}_{symbolToken}_{timestamp}`) and pre-trade margin verification.

---

## 7. Audit Logging, Data Privacy & Time Synchronization

1. **Structured Log Standard**: Every external partner call must emit structured JSON logs:
   ```json
   {
     "event": "PARTNER_API_CALL",
     "provider": "upstox",
     "endpoint": "/v2/market-quote/quotes",
     "http_status": 200,
     "latency_ms": 142,
     "status": "success",
     "idempotency_key": "QUOTE_INF204KB14I2_1730951234",
     "timestamp": "2026-11-07T03:48:20.142Z"
   }
   ```
2. **Mandatory PII Masking (DPDP Act 2023)**:
   - Permanent Account Number (PAN): Mask characters 6 through 8 (`ABCDE****F`).
   - Bank Account Numbers: Mask all except last 4 digits (`******1234`).
   - Passwords, OAuth tokens, and client secrets: Omitted entirely from logs.
3. **NTP Time Synchronization (CERT-In Compliance)**:
   - Server clocks on Cloud Run and Cloud SQL sync continuously with the National Physical Laboratory (NPL) NIC NTP pool (`time.nic.in` / `time.google.com`).
   - Maximum allowable clock drift: **$\le \pm 50\text{ms}$**.
4. **Log Retention**: Audit trails of order submissions, API responses, and financial ledger modifications are preserved for a minimum statutory period of **5 years** (SEBI / PMLA mandate).

---

## 8. Incident Management, Alerting & Partner Escalation Matrix

### 8.1 Incident Severity Levels
- **Severity 1 (Critical Partner Outage)**: Primary market data or order routing partner offline during live market hours (09:15 AM – 03:30 PM IST).
  - *Action*: Automatic failover to secondary provider. PagerDuty alert to Lead Systems Engineer within 60 seconds.
- **Severity 2 (Degraded Performance / Latency $> 2000\text{ms}$)**: High latency or sporadic HTTP 429 rate limit errors.
  - *Action*: Circuit breaker trips to HALF-OPEN. Cache TTL doubled temporarily.
- **Severity 3 (Non-Critical Sync Error)**: Nightly master sync batch job failure.
  - *Action*: Automated retry with 15-minute backoff. Slack alert to `#dev-ops`.

### 8.2 Partner Escalation Directory

| Provider | Primary NOC / Support Desk | Escalation Level 2 (Technical) | Escalation Level 3 (Management) |
| :--- | :--- | :--- | :--- |
| **Upstox API Team** | `api-support@upstox.com` | Partner Engineering Lead | Head of Institutional Alliances |
| **KFintech IRIS Desk** | `iris.support@kfintech.com` | Institutional Solutions Head | Chief Technology Officer |
| **Alpaca Broker Operations** | `broker-support@alpaca.markets` | API Integration Specialist | VP, Global Clearing & Partnerships |
| **Smallcase Gateway** | `gateway-support@smallcase.com` | Developer Relations Manager | VP, Engineering |
| **Angel One SmartAPI Desk** | `smartapi@angelbroking.com` / `api-support@angelone.in` | Developer Relations Lead | Head of Technology & Alliances |

---

## 9. Regulatory Review & Audit Cadence

This Standard Operating Procedure is reviewed and re-certified on a **semi-annual basis** by the FintekPro Compliance Council and the Principal Officer to incorporate emerging regulatory circulars from SEBI, RBI, and partner broker technical revisions.

---

## 10. Deprecation & Delinking Addendum: External CRM Services (Zoho CRM)

As of November 2026, **all third-party CRM connections (specifically Zoho CRM) are formally delinked, deprecated, and retired** under FintekPro Policy `POL-CRM-2026-01`:

1. **System of Record (SoR)**: FintekPro Native CRM Engine (`lead_registry`, `agent_leads`, `prospect_clients`, `prospect_proposals`) is the exclusive, sovereign System of Record for all non-client lead pipelines, corporate director wealth scores, and KYC onboarding conversions.
2. **Data Isolation & DPDP Sovereignty**: To prevent unneeded third-party exposure of customer PAN, liquid net worth, and investment intent, no prospect or client PII shall be synchronised to external CRM SaaS vendors.
3. **Route & Interface Retirement**: `/agent/crm` navigation links have been eliminated from all agent layouts and redirected to the unified Lead Pipeline (`/agent/leads`). All active acquisition workflows operate natively within FintekPro.

*Document Approved by*: FintekPro Legal, Regulatory & Technology Council  
*Distribution*: Engineering, Product, Compliance, Operations, and RIA Advisory Desks  

