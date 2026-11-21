# FintekPro Standard Operating Procedure: Synthetic Data & Synthetic Calculation Governance (SOP-SDCG-01)

**SOP Reference**: SOP-SDCG-01  
**Version**: 1.0.0  
**Effective Date**: November 2026  
**Review Cycle**: Semi-Annual  
**Owner**: FintekPro Quantitative Engineering & Regulatory Compliance Council  
**Applies To**: All Microservices, Pricing Engines, Data Pipelines, Cron Workers, Frontend Interfaces, and AI Advisory Models  
**Governing Regulations**: 
- SEBI (Investment Advisers) Regulations, 2013 (Regulations 15, 19, and Code of Conduct)
- SEBI (Research Analysts) Regulations, 2014
- RBI Financial Benchmark India Pvt Ltd (FBIL) Benchmark Governance Framework
- FintekPro Global Coding Rules (GCR v1.0) & Financial Advisory System Protocol (FASP-AI v1.0)
- FintekPro Data Correctness Policy (DCP v2.0)

---

## 1. Objective & Policy Foundation

FintekPro provides institutional-grade digital infrastructure for SEBI-registered Investment Advisers (RIAs), Chartered Accountants (CAs), and Mutual Fund Distributors (MFDs). Wealth advisory recommendations, portfolio valuations, derivative risk assessments, and tax liability computations rely directly on the absolute factual correctness and authentic lineage of financial figures.

### The Zero-Synthetic Mandate
FintekPro maintains a **Zero-Tolerance Policy** towards:
1. **Synthetic Data**: Any price, yield, NAV, volume, or macroeconomic metric that is fabricated, mocked, randomized (`Math.random()`), projected without explicit scenario labels, or sourced from speculative future fallbacks.
2. **Synthetic Calculations**: Any mathematical operation that invents, approximates, or shortcuts real market prices using arbitrary scalar multipliers, unverified proxy factors, fake currency cross calculations, or ad-hoc heuristic formulas rather than direct licensed feed bindings or canonical quantitative equations.

---

## 2. Typology of Prohibited Synthetic Constructs

The following constructs are strictly categorized as **Non-Compliant Violations** across all codebases:

| Violation Code | Construct Type | Description | Prohibited Pattern Example | Compliant Alternative |
|---|---|---|---|---|
| `SYN_001` | **Magic Scalar Multiplier** | Multiplying an underlying cash index by a fixed arithmetic scalar to simulate a futures/forward instrument. | `nifty * 1.0016` to represent GIFT Nifty | Query licensed real-time quote for GIFT Nifty directly from NSE IFSC / Upstox feed. |
| `SYN_002` | **Proxy Scaling** | Multiplying an ETF or fund by an arbitrary ratio to simulate a major index price. | `SPY * 10` for S&P 500, `QQQ * 41.5` for Nasdaq 100 | Query canonical index symbols (`^GSPC`, `^NDX`, `^DJI`) directly from live market API. |
| `SYN_003` | **Synthetic Forex Cross** | Multiplying or dividing USD/INR by fixed ratios to approximate other currencies. | `usdInr * 1.085` for EUR/INR, `usdInr / 154.20` for JPY/INR | Bind directly to published official FBIL Reference Rates (`eurInr`, `gbpInr`, `jpyInr`). |
| `SYN_004` | **Speculative Future Fallback** | Hardcoding future-dated speculative prices as fallback data in software constants. | `usdInr: 94.8606`, `goldMcx: 141255`, `silverMcx: 187200` | Bind fallbacks strictly to last verified settled exchange Bhavcopy / official FBIL fixing. |
| `SYN_005` | **Unverified Spread Synthetics** | Adding arbitrary basis points to an overnight rate without published term benchmark data. | `miborOvernight + 0.15` to represent 1-month MIBOR | Direct binding to FBIL Term MIBOR benchmarks (14-day, 1-month, 3-month published rates). |
| `SYN_006` | **Randomized/Mock Production Data** | Generating pseudo-ticks or price changes using stochastic/random routines in production. | `price * (1 + (Math.random() - 0.5) * 0.02)` | Return structured `DATA_PROVIDER_UNAVAILABLE` error or last verified EOD cache with `is_stale: true`. |
| `SYN_007` | **Ad-Hoc Valuation Heuristics** | Using cooked-up linear approximations to mask missing financial variables. | Ad-hoc linear Greeks, ungrounded WACC estimations | Fail gracefully with structured error if required canonical model inputs are missing. |

---

## 3. Allowed vs. Forbidden Practices Matrix

### 3.1 Allowed Practices (Canonical Financial Operations)
1. **Direct Licensed Binding**: Ingesting raw prices directly from licensed exchange gateways (Upstox API v2 for NSE/BSE/MCX, IndianAPI.in for official feeds).
2. **Official Benchmark Publications**: Directly consuming daily published fixings from statutory benchmark administrators (FBIL, CCIL, AMFI, RBI, US Federal Reserve).
3. **Statutory Parity Formulas**: Computing landed domestic commodity prices from international dollar quotes strictly using official statutory duty structures:
   $$\text{MCX Landed Price} = (\text{Global Spot (USD/oz)} \times \text{USD/INR Rate} \times 0.321507) \times (1 + \text{Customs} + \text{AIDC}) \times (1 + \text{GST})$$
   *Requirement*: All input variables (Spot, USD/INR, Customs %, AIDC %, GST %) must be explicitly exposed in the explainability metadata block.
4. **Canonical Macro Equations**: Computing canonical derived metrics where all inputs are authentic, published macroeconomic figures:
   $$\text{Real Yield} = \text{10Y G-Sec Benchmark Yield} - \text{Published CPI Inflation Rate}$$
5. **Settled EOD Bhavcopy Caching**: Serving yesterday's verified exchange closing price during upstream feed outages, provided it is explicitly tagged with `source: "CACHE_EOD"`, `is_stale: true`, and the verified settlement timestamp.

### 3.2 Forbidden Practices (Strictly Banned)
1. **No Pseudo-Quotes**: Never compute an artificial "live" price when an API fails.
2. **No Secret Multipliers**: No inline constants or scaling factors without peer-reviewed or statutory citations.
3. **No Unchecked Fallbacks**: Fallback snapshots must never contain unverified forward predictions.
4. **No Silent Swallowing**: If a data provider returns empty or malformed data, never invent replacement numbers.

---

## 4. Layered Failover Waterfall & Quarantine Protocol

When a pricing engine, service, or client view queries financial metrics, execution must strictly follow the **Four-Tier Golden Pricing Waterfall**:

```
[Incoming Price Request]
         │
         ▼
[ Tier 1: Real-Time Licensed Feed (Upstox API v2 / IndianAPI.in) ]
         │  ── Success (Confidence: 98%) ──► [ Output Live Quote ]
         ▼  (Failure / 429 / Outage)
[ Tier 2: Official Statutory Publisher (FBIL, CCIL, AMFI) ]
         │  ── Success (Confidence: 90%) ──► [ Output Published Fixing ]
         ▼  (Failure / Non-Operating Hour)
[ Tier 3: Distributed EOD Bhavcopy Cache (Redis / Postgres) ]
         │  ── Success (Confidence: 80%) ──► [ Output Settled EOD Cache (is_stale: true) ]
         ▼  (Cache Miss)
[ Tier 4: Canonical Verified Baseline Snapshot ]
         │  ── Success (Confidence: 75%) ──► [ Output Baseline with DATA_ANOMALY banner ]
         ▼  (Validation Error)
[ FAIL-CLOSED: Return Structured Error ]
   { "error_code": "DATA_PROVIDER_UNAVAILABLE", "retryable": true }
   (NEVER SYNTHESIZE OR FABRICATE)
```

### Quarantine Standards
If any received or cached metric breaches the sanity audit corridor:
- **Gold MCX**: Outside `₹55,000 – ₹95,000 / 10g`
- **Silver MCX**: Outside `₹65,000 – ₹1,15,000 / 1kg`
- **USD/INR**: Outside `₹78.00 – ₹89.00`
- **Real Yield Gap**: $|(\text{10Y Yield} - \text{CPI}) - \text{Real Yield}| > 0.15\%$

The metric is **immediately quarantined**:
1. It is flagged with violation code `CORRIDOR_BREACH` or `SYNTHETIC_CALCULATION_DETECTED`.
2. The UI renders the **Actionable Data Quality Anomaly Banner** warning the user.
3. The automated self-healing worker is dispatched to crawl the official exchange repository.

---

## 5. Automated Sentinel & CI/CD Enforcement

### 5.1 Static Code Analysis Gateways
All pull requests and commits are subject to automated AST and regex checks in CI/CD:
- Regex checks scanning for prohibited multiplier patterns:
  - `/\*\s*1\.00\d+/` (e.g. `nifty * 1.0016`)
  - `/\*\s*(10|41\.5|40)\b/` on market tickers
  - `/\*\s*1\.08\d+/` on forex pairs
  - `/\+\s*0\.1\d+/` on interest rate benchmarks
- Disallowance of `Math.random()` in any path under `server/services/`, `server/core/`, or `server/routes/`.

### 5.2 Runtime Sentinel Monitoring
The `KnowledgeHubAutoHealSentinel` runs continuously in production and verifies every active market snapshot:
- **Rule 1**: Outdated date check.
- **Rule 2**: Extreme Gold/Silver corridor anomaly check.
- **Rule 3**: Unrealistic USD/INR corridor check.
- **Rule 4**: Top stock mover sanity check (Nifty 50 constituents within daily bands).
- **Rule 5**: Real yield formula parity check ($10\text{Y Yield} - \text{CPI} = \text{Real Yield}$).
- **Rule 6**: Synthetic calculation detection check (ensuring no hardcoded proxy markers exist in the snapshot).

If any violation occurs, `qualityScore` is downgraded below `95%`, triggering the incident remediation workflow.

---

## 6. Incident Remediation & Auto-Healing Workflow

```
[Sentinel Detects Breach]
         │
         ├──► 1. Log Structured Telemetry: { event: "DATA_ANOMALY_TRIGGERED", violation_code }
         ├──► 2. Degrade Quality Score & Update UI with Actionable Anomaly Banner
         │
         ▼
[Auto-Heal Sentinel Dispatch]
         │
         ├──► Query Upstox Licensed EOD Gateway for authentic bhavcopy
         ├──► Invalidate corrupted in-memory and Redis cache keys
         ├──► Scrub legacy corrupted figures using regex scrubber
         ├──► Persist authentic snapshot with new engine_version & ISO timestamp
         │
         ▼
[UI Self-Healing]
         │
         └──► User/Admin clicks "⚡ Auto-Heal & Re-Sync" OR Sentinel heals automatically
              UI re-renders with fresh authentic data and "LIVE SETTLED (SSOT)" badge
```

---

## 7. RACI Governance Matrix

| Role | Responsibility |
|---|---|
| **Quantitative Strategist** | Validates that all mathematical formulas derive strictly from peer-reviewed financial economics or statutory circulars. Sign-off required for any new pricing equation. |
| **Data Platform Engineer** | Implements direct feed bindings; enforces strict typing and fail-closed error handling; prevents any hardcoded multipliers in production services. |
| **Compliance Officer (SEBI RIA PO)** | Reviews semi-annual audit logs; verifies that all client-facing reports and advisory recommendations maintain complete data provenance and zero synthetic footprints. |
| **Autonomous Sentinel (AAGE / Auto-Heal)** | Monitors production feeds 24/7; quarantines out-of-band data; initiates autonomous re-sync from primary clearing archives. |

---

## 8. Audit Trail & Annual Compliance Certification

1. **Immutable Logging**: All pricing outputs, sentinel audit reports, and auto-heal events are permanently logged in Cloud Logging and BigQuery with retention of not less than 5 years (as required under SEBI RIA Regulation 19).
2. **Explainability Metadata**: Every pricing response served by FintekPro exposes:
   - `engine_version`
   - `calculation_timestamp`
   - `sources_used`
   - `feed_provenance` (`LIVE SETTLED (SSOT)` / `CACHED EOD` / `OFFICIAL BENCHMARK`)
   - `formula_applied` (where canonical math is involved)
3. **Annual Certification**: The Engineering Council and Compliance Officer conduct a semi-annual review of all pricing engines to certify 100% adherence to this SOP.

---

*FintekPro Quantitative Engineering & Regulatory Compliance Council*  
*Approved and Enforced under FintekPro GCR v1.0 & FASP-AI v1.0*
