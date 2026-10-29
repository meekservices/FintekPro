# FintekPro Data Correctness & Pricing Integrity Policy (DCP v1.0)

**Standard Version**: DCP-1.0.0  
**Effective Date**: October 2026  
**Applies To**: All Microservices, Scheduled Workers, Frontend Views, APIs, Data Providers, and AI Advisory Engines  
**Regulatory Governance**: SEBI (Investment Advisers) Regulations, 2013 (Reg 15 & 19), SEBI (Research Analysts) Regulations, 2014, and FintekPro GCR v1.0 / FASP-AI v1.0

---

## 1. Executive Summary & Objective

FintekPro serves SEBI-registered Investment Advisors (RIAs), Chartered Accountants (CAs), and Mutual Fund Distributors (MFDs). Wealth advisory decisions, tax liability computations, and client portfolio valuations depend directly on the absolute factual correctness and temporal freshness of market prices, NAVs, yields, and corporate fundamentals.

This policy defines non-negotiable rules governing data acquisition, ingestion, validation, fallback handling, and UI presentation across all asset classes (Equities, Bullion, Fixed Income, Commodities, Derivatives, and Mutual Funds).

---

## 2. Core Policies

### Rule 1: Strict Ban on Synthetic & Fabricated Production Data (Zero-Synthetic Mandate)
- **Production Ban**: In any production environment (`NODE_ENV === "production"`), the generation or display of synthetic, mock, or randomized (`Math.random()`) pricing data is **strictly prohibited**.
- **No Silent Faking**: If an upstream provider (e.g. Upstox, IndianAPI, NSE, MCX, AMFI) is unavailable, rate-limited (HTTP 429), or experiencing downtime:
  - The system must **never** fabricate arbitrary prices to mask the outage.
  - The service must return an explicit, structured error:
    ```json
    {
      "success": false,
      "error": {
        "error_code": "DATA_PROVIDER_UNAVAILABLE",
        "message": "Real-time quote temporarily unavailable from licensed feed",
        "retryable": true
      }
    }
    ```
  - If a cached End-Of-Day (EOD) or last-known-good price is returned as a resilience measure, it **must** carry explicit provenance flags (`is_stale: true`, `source: "CACHE_EOD"`, `as_of: "<timestamp>"`). It must never be presented as "Live".

---

### Rule 2: Mandatory Source Provenance & Lineage Metadata
Every pricing and financial metric output from controllers, background workers, or analytical engines must include complete provenance metadata:

```typescript
interface DataCorrectnessMeta {
  engine_version: string;        // e.g. "golden-pricing@2.1.0"
  calculation_timestamp: string; // ISO 8601 UTC timestamp
  data_source: string;           // e.g. "UPSTOX_LICENSED", "AMFI_OFFICIAL", "COMEX_FUTURES_CHART"
  price_type: "LTP" | "BID_ASK_MID" | "SETTLEMENT" | "NAV" | "DERIVED_PARITY";
  market_status: "OPEN" | "CLOSED" | "DELAYED_15M" | "EOD";
  confidence_score: number;      // 0.00 to 1.00 (e.g. Upstox Tick = 1.0; EOD Cache = 0.85)
  is_stale: boolean;
}
```

---

### Rule 3: Dynamic Validation Limits (No Stale Static Clamps)
- **The Outlier Trap**: Hardcoded, static price ceilings (e.g., `price <= 3800` for Gold or `price <= 120000` for MCX Gold) are banned. When macro bull runs occur, static ceilings silently discard valid market transactions and force erroneous fallbacks.
- **Dynamic Guardrails**: All sanity validation must be relative:
  - **Equity**: Price must fall within the exchange-defined daily circuit limit ($\pm 5\%$, $\pm 10\%$, or $\pm 20\%$ of previous close).
  - **Commodities & Forex**: Ticks must fall within $\pm 25\%$ of the 5-day rolling average or previous settlement price.
  - **Mutual Funds**: Day-over-day NAV changes exceeding $\pm 12\%$ trigger an anomaly quarantine and human audit flag before ingestion.

---

### Rule 4: Qualitative & Quantitative Badge Consistency
Visual badges and qualitative ratings (`Bullish`, `Bearish`, `Neutral`, `Elevated Risk`, `Benign`) must strictly match the quantitative metrics on the same view:
- **No Directional Inversions**: An asset with a negative daily change (e.g., Natural Gas at `-0.85%`) can **never** be decorated with a green `Bullish` badge.
- **Deterministic Trend Formula**:
  $$\Delta \% \le -1.5\% \implies \mathbf{Bearish}$$
  $$-1.5\% < \Delta \% \le -0.3\% \implies \mathbf{Neutral \text{ (Pullback)}}$$
  $$-0.3\% < \Delta \% < +0.3\% \implies \mathbf{Neutral \text{ (Consolidation)}}$$
  $$+0.3\% \le \Delta \% < +1.5\% \implies \mathbf{Bullish}$$
  $$\Delta \% \ge +1.5\% \implies \mathbf{Strongly\ Bullish}$$

---

### Rule 5: Dual-Market Parity & Explainability (e.g. MCX vs. Global CFD)
When displaying dual-market reference instruments (such as domestic Indian commodities vs. international benchmarks like COMEX / ICE):
1. **Explicit Units**: Always display the currency and measurement unit explicitly (`₹ / 10g`, `₹ / 1kg`, `$ / oz`, `$ / bbl`).
2. **Formula Transparency**: When deriving landed domestic prices from international dollar quotes:
   $$\text{MCX Landed Price} = (\text{Global USD Spot} \times \text{USD/INR Rate}) \times (1 + \text{Customs Duty} + \text{AIDC}) \times (1 + \text{GST})$$
   The active USD/INR rate and applicable statutory duty rates must be exposed in the explainability layer.

---

### Rule 6: Layered Failover Order for Pricing Engines
When fetching quotes or valuations, services must adhere to the strict Golden Pricing hierarchy:
1. **Tier 1 (Priority 1 — 98% Confidence)**: Licensed Real-Time Exchange Feed (Upstox API v2 for NSE/BSE/MCX).
2. **Tier 2 (Priority 2 — 88% Confidence)**: Institutional Secondary Provider (IndianAPI.in Growth Plan).
3. **Tier 3 (Priority 3 — 80% Confidence)**: Official Aggregators / Clearing Houses (AMFI for NAVs, CCIL/FBIL for G-Secs, CMX/ICE for global futures).
4. **Tier 4 (Last Resort — 70% Confidence)**: Distributed Redis Cache (EOD Bhavcopy with `is_stale: true` flag).

---

## 3. Enforcement & Verification

1. **Pre-Commit Lint Checks**: Every new service or route touching financial pricing must pass static analysis (`npm run check` and `npm run lint:changed`).
2. **Automated Anomaly Detection**: `pricing-anomaly-watcher` runs every 15 minutes during market hours (09:00 - 23:30 IST) to compare ingested prices against live market feeds. Any divergence $> 3.5\%$ fires an automated Slack/webhook ops alert.
3. **Non-Compliance Remedy**: Any code discovered emitting synthetic numbers or unflagged stale data in production will be rejected and reverted immediately.

---

*FintekPro Engineering & Compliance Council*
