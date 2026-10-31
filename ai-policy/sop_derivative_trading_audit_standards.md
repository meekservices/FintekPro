# Standard Operating Procedures (SOP): Derivative Trading
## FintekPro Statutory Compliance & Audit Standards (SOP-DERIVATIVES-v1.0)

---

### 1. Document Control & Regulatory Mandate

* **Document Code:** `FINTEK-SOP-DERIVATIVES-2026-V1`
* **Applicability:** All Operations, Compliance Officers, SEBI-registered Investment Advisers (RIA), Portfolio Managers, Algo Trading Operators, System Architects, and Engineers within the FintekPro Platform who deal with Futures & Options (F&O) products — including NSE/BSE equity derivatives, index derivatives, commodity F&O, and structured derivative overlays within PMS and AIF mandates.
* **Governing Regulatory Authorities:**
  * **SEBI:** Index Derivatives Framework — Circular `SEBI/HO/MRD/POD1/CIR/P/2024/132` (effective Feb 2025)
  * **SEBI:** F&O Eligibility Criteria & Lot Size Revisions — Circular `SEBI/HO/MRD/TP/P/CIR/2024/131`
  * **SEBI (Investment Advisers) Regulations, 2013** — Regulation 17 (Suitability), Regulation 19 (Record Maintenance)
  * **SEBI (Portfolio Managers) Regulations, 2020** — Permitted Asset Universe (Regulation 22 & 23)
  * **SEBI (AIF) Regulations, 2012 (as amended 2024)** — Cat III Leverage Cap: max 200% gross exposure
  * **SEBI (Broker) Regulations, 1992** — Client Code Modification, Pre-trade Margin Collection
  * **RBI FEMA Notification 20(R)/2017-RB** — FII/FPI derivative position limits
  * **BSE/NSE Circulars** — Position Limits, ELM, VaR margin computation
  * **PMLA 2002 (as amended)** — Client identity & beneficial ownership verification before derivative account activation

> [!IMPORTANT]
> FintekPro is a SEBI-registered **Investment Adviser (RIA)**. Derivatives access is a **Decision Support System ONLY** — the platform recommends, analyzes, and audits derivative positions. FintekPro **NEVER autonomously executes derivative orders without explicit client confirmation and pre-trade risk gate clearance.**

---

### 2. SEBI Index Derivatives Framework (Effective Feb 2025)

As per Circular `SEBI/HO/MRD/POD1/CIR/P/2024/132`:

| Parameter | Specification |
| :--- | :--- |
| **Weekly Expiry Indices Permitted** | NIFTY 50 (NSE) & SENSEX (BSE) ONLY |
| **Discontinued Weekly Expiry** | BANKNIFTY, FINNIFTY, MIDCPNIFTY, BANKEX (monthly contracts only) |
| **Minimum Contract Size** | ₹15,00,000 per contract (lot value floor) |
| **Cash Margin Requirement** | ≥ 50% of margin must be in cash or cash equivalents |
| **Expiry Day ELM Surcharge** | +2% Extreme Loss Margin on all short index options on expiry day |
| **Position Limit (Index F&O - Client)** | 15% of open interest or ₹500 Cr, whichever is lower |
| **Position Limit (Stock F&O - Client)** | 1% of free-float market cap of underlying |
| **Upfront Margin Collection** | 100% SPAN + Exposure margin must be collected before order placement |

**Lot Sizes (FintekPro Reference — as of Oct 2026):**

| Index | NSE Lot Size |
| :--- | :--- |
| NIFTY 50 | 75 units |
| BANKNIFTY | 30 units |
| FINNIFTY | 65 units |
| MIDCPNIFTY | 120 units |
| SENSEX (BSE) | 20 units |

> [!WARNING]
> Lot sizes are revised by SEBI every 6 months. FintekPro must fetch real-time lot sizes from NSE/BSE API before every strategy recommendation. Hard-coded lot sizes are a compliance violation if stale beyond 30 days.

---

### 3. Client Suitability & Eligibility Gate (Pre-Trade)

#### Step 1: Risk Profile Eligibility Check

Derivative products are **high-risk instruments**. Before any F&O strategy recommendation or analysis is shown:

1. **Risk Profile Gate:**
   - Only clients with `riskProfile = "aggressive"` or `riskProfile = "very_aggressive"` may access F&O strategy builder and options chain.
   - `conservative` and `moderate` profiles → restricted to viewing educational content only; all execution functions disabled.
   - `investment_horizon < 3 months` → Short-dated options permitted only (weekly/monthly expiry).

2. **Derivative Experience Declaration:**
   - Client must have completed the SEBI-mandated **F&O Suitability Questionnaire** during onboarding.
   - Minimum prior F&O experience: 1 year (documented in KYC notes).

3. **Net Worth Floor (SEBI Broker Regulation):**
   - Derivatives segment requires proof of net worth ≥ ₹5,00,000 in securities or bank assets (per SEBI/NCDE broker norms).

4. **Margin Sufficiency Pre-Check:**
   - Before any order recommendation, system must verify: `available_margin ≥ (SPAN_margin + exposure_margin) × 1.1` (10% buffer).
   - If insufficient: display margin shortfall alert; block execution path.

#### Step 2: Product Suitability Matrix

| Strategy Category | Min Risk Profile | Net Worth Req. | Max Capital Allocation | Horizon |
| :--- | :--- | :--- | :--- | :--- |
| Covered Call (CE selling against long equity) | Moderate+ | ₹2 Lakh | 30% of portfolio | Any |
| Protective Put (PE buy for hedging) | Moderate+ | ₹2 Lakh | 5% of portfolio (cost) | Short–Medium |
| Bull/Bear Call/Put Spread | Aggressive | ₹5 Lakh | 10% of portfolio | Short |
| Long Straddle / Long Strangle | Aggressive | ₹5 Lakh | 5% of portfolio | Short |
| Iron Condor / Butterfly | Aggressive | ₹5 Lakh | 10% of portfolio | Short |
| Short Strangle / Short Straddle | Very Aggressive | ₹10 Lakh | 5% of portfolio | Weekly only |
| Naked Call / Put Short | Very Aggressive | ₹25 Lakh | 2% of portfolio | Not recommended |
| Futures (Long/Short) | Very Aggressive | ₹10 Lakh | 15% of portfolio | Monthly |

> [!CAUTION]
> **Naked short options (uncovered writing)** carry theoretically unlimited loss. FintekPro must display a mandatory SEBI-style risk disclosure in the UI before allowing a short naked position to be simulated. Such positions require additional advisor override confirmation.

---

### 4. Pre-Trade Compliance Checks (F&O Order Gate)

Every derivative order recommendation must pass ALL of the following gates before an order is surfaced:

```
[GATE 1] Client KYC & SEBI F&O Eligibility Active?
    → Check: KYC status = VERIFIED; F&O segment activated at broker
[GATE 2] Risk Profile Suitability Match
    → Check: riskProfile ∈ {aggressive, very_aggressive} for naked/complex strategies
[GATE 3] Weekly Expiry Compliance (SEBI Circular 2024/132)
    → Check: if isWeeklyExpiry → symbol ∈ {NIFTY, SENSEX}
[GATE 4] Lot Size & Contract Value Check
    → Check: contract_value = lot_size × spot_price ≥ ₹15,00,000
[GATE 5] Margin Adequacy Check
    → Check: available_margin ≥ SPAN + Exposure + ELM_surcharge (if expiry day)
[GATE 6] Position Limit Check
    → Check: new_position_size ≤ (15% of OI) OR (₹500 Cr) — whichever lower
[GATE 7] Cash Margin Composition
    → Check: cash_component / total_margin ≥ 50%
[GATE 8] Black Swan / Circuit Breaker
    → Check: if market_volatility_sigma ≥ 10 → suspend all short premium recommendations
[GATE 9] Duplicate/Idempotency Check
    → Check: idempotency_key unique for 24h window
```

All gate outcomes must be **logged immutably** with:
```json
{
  "event": "DERIVATIVE_PRETRADE_GATE_CHECK",
  "user_id": "<client_id>",
  "gates_passed": [...],
  "gates_failed": [...],
  "final_outcome": "ALLOWED | BLOCKED",
  "strategy": "<strategy_name>",
  "symbol": "<NSE_symbol>",
  "timestamp": "<ISO8601>",
  "engine_version": "FASP-AI-v3.1-ALGO"
}
```

---

### 5. Order Execution & Broker Routing Standards

#### Order Type Policy

| Order Type | Permitted? | Condition |
| :--- | :--- | :--- |
| Limit (DAY) | ✅ Yes | Default for all F&O recommendations |
| Market Order | ⚠️ Limited | Only during high-liquidity pre-market (09:15–09:30); advisor must override |
| IOC (Immediate or Cancel) | ✅ Yes | For spread legs to avoid leg risk |
| GTC (Good Till Cancelled) | ❌ No | F&O positions cannot carry overnight-only intent without review |
| Cover Order (CO) | ✅ Yes | With mandatory stop-loss leg |

#### Multi-Leg Strategy Execution Sequencing

For multi-leg strategies (spreads, condors, straddles), execution order must follow:

1. **Sell legs FIRST** (to collect premium / release margin)
2. **Buy legs SECOND** (reduce net margin requirement)
3. Both legs must use **IOC or same-second DAY limit** to minimize leg risk
4. If any leg fails: **system must automatically attempt reversal of filled leg** within 30 seconds and log `STRATEGY_LEG_REVERSAL_ATTEMPTED`

#### Slippage Tolerance (NSE/BSE Tick-Level)

- Tick size: ₹0.05 for equity options; ₹0.25 for index options
- Max slippage allowed: **0.5%** from mid-price for liquid contracts (Nifty, BankNifty)
- Max slippage allowed: **1.5%** for illiquid stock options
- Orders beyond slippage tolerance must be flagged: `SLIPPAGE_EXCEEDED — requires manual confirmation`

---

### 6. Post-Trade Monitoring & Risk Management

#### Real-Time Risk Monitoring (MTM)

During market hours, the system must monitor:

1. **Mark-to-Market (MTM) P&L** — computed every 5 minutes against live option premium
2. **Delta Exposure** — portfolio net delta must stay within pre-approved bounds per risk profile
3. **Theta Decay Alert** — for long option positions, alert if theta decay > 20% of premium paid/day
4. **Vega Risk Alert** — if implied volatility changes > 5% (absolute), show impact on open positions
5. **Drawdown Monitor** — if strategy MTM loss > **50% of max risk** defined at inception → generate `DERIVATIVE_RISK_ALERT` and notify advisor

#### Margin Call Protocol

| Margin Status | Action |
| :--- | :--- |
| Margin utilization ≤ 80% | Normal — no action |
| Margin utilization 80–90% | Warning alert to client & advisor |
| Margin utilization > 90% | Auto-trigger advisor call request; block new positions |
| Margin utilization ≥ 100% | `MARGIN_CALL_TRIGGERED` — position square-off recommendation issued (human approval required) |

> [!CAUTION]
> FintekPro MUST NEVER autonomously square off derivative positions due to a margin call. The system must issue the recommendation and notification; **the final square-off execution requires explicit client or advisor confirmation.**

---

### 7. SEBI 5-Year Audit Trail Requirements (Reg 19)

All the following events must be stored immutably for **minimum 5 years** (Reg 19(1)(d)):

| Event | Table | Retention |
| :--- | :--- | :--- |
| Client suitability assessment for F&O | `compliance_audit_logs` | 5 years |
| Pre-trade gate check results (all 9 gates) | `order_lifecycle_events` | 5 years |
| Strategy recommendation with confidence score | `portfolio_ai_decisions` | 5 years |
| Order placement (any leg) with broker order ID | `unified_orders` + `order_lifecycle_events` | 5 years |
| Margin adequacy check result at T0 | `order_lifecycle_events` | 5 years |
| MTM risk alerts | `compliance_audit_logs` | 5 years |
| Expiry / settlement instructions | `portfolio_transactions` | 5 years |
| Square-off instructions & advisor confirmation | `order_lifecycle_events` | 5 years |
| SEBI weekly expiry compliance gate decision | `compliance_audit_logs` | 5 years |

**Audit Log Schema (FASP-AI Compliant):**
```json
{
  "event": "DERIVATIVE_ORDER_SUBMITTED",
  "user_id": "<client_id>",
  "advisor_id": "<advisor_id>",
  "strategy": "Bull Call Spread",
  "symbol": "NIFTY",
  "expiry": "2026-10-31",
  "legs": [
    { "type": "call", "action": "buy", "strike": 24500, "qty": 75, "premium": 120 },
    { "type": "call", "action": "sell", "strike": 24600, "qty": 75, "premium": 65 }
  ],
  "max_risk": 4125,
  "max_reward": 3375,
  "confidence_score": 72,
  "risk_profile": "aggressive",
  "factors_considered": ["market_regime", "iv_rank", "dte", "delta_range"],
  "model_version": "FASP-AI-v3.1-ALGO",
  "engine_version": "FASP-AI-v3.1-ALGO",
  "calculation_timestamp": "<ISO8601>",
  "disclaimer": "⚠️ F&O trading involves substantial risk of loss...",
  "sebi_gate_status": "PASSED",
  "broker_order_ids": ["ORD-001", "ORD-002"],
  "idempotency_key": "DRV-20261031-A1B2C3",
  "latency_ms": 230,
  "status": "submitted"
}
```

---

### 8. AI Advisory Compliance (FASP-AI v1.0 & v3.1)

FintekPro's derivative strategy engine is a **Decision Support System ONLY**. Every AI output must include:

1. **`recommendation`** — Strategy name + directional view
2. **`confidence_score`** — 0–100 (strategies < 55% confidence → downgraded to "watch only")
3. **`factors_considered`** — Market regime, IV rank, DTE, delta, risk profile
4. **`risk_reward_ratio`** — Explicit max risk & max reward in INR
5. **`model_version`** — Current engine version string
6. **`calculation_timestamp`** — ISO 8601 UTC
7. **`disclaimer`** — Mandatory SEBI-style risk warning (see Section 9)

**Confidence Thresholds:**

| Confidence Score | Action |
| :--- | :--- |
| ≥ 70% | Recommendation surfaced with full strategy detail |
| 55–69% | Surfaced with `⚠️ Moderate Confidence` warning banner |
| < 55% | Downgraded to "Watch / Informational" — execution button disabled |
| Any score + Black Swan | All execution blocked; advisory only |

---

### 9. Mandatory Disclaimers

All derivative-related UI screens, API responses, and PDF reports must include:

> **⚠️ SEBI Derivative Risk Disclosure (Mandatory):**
> Futures & Options (F&O) trading involves substantial risk of loss and is not suitable for all investors. Losses can exceed the premium invested. Leverage amplifies both profits and losses. Past performance of strategy signals does not guarantee future results. This analysis is generated by an AI Decision Support System and does NOT constitute financial advice, a buy/sell recommendation, or a guarantee of returns. FintekPro is a SEBI-registered Investment Adviser (RIA). All F&O positions require your explicit confirmation. Consult your advisor before acting. Market conditions can change rapidly. Capital at risk.

Additionally for short premium strategies:

> **⚠️ Unlimited Loss Risk:** Short naked call positions carry theoretically unlimited loss potential. SEBI Circular 2024/132 requires adequate margin at all times. Failure to maintain margin may result in automatic square-off by your broker.

---

### 10. GCR Enforcement Checklist (FintekPro Engineering)

| Check | Status Required |
| :--- | :--- |
| `requireAuth` middleware on all `/api/derivatives/*` routes | ✅ Mandatory |
| Suitability gate enforced before strategy builder access | ✅ Mandatory |
| All 9 pre-trade gates logged per Section 4 | ✅ Mandatory |
| `idempotency_key` on every order placement | ✅ Mandatory |
| Multi-leg sequencing (sell first → buy second) | ✅ Mandatory |
| `engine_version` & `calculation_timestamp` in all AI outputs | ✅ Mandatory |
| SEBI weekly expiry check via `validateWeeklyExpiryEligibility()` | ✅ Mandatory |
| No autonomous execution (human confirmation gate) | ✅ Non-negotiable |
| 5-year audit trail in `compliance_audit_logs` | ✅ Mandatory |
| Disclaimer on every advisory screen and API response | ✅ Mandatory |
| PAN masking in all derivative audit logs | ✅ Mandatory |
| `expiry_day_elm_surcharge` applied on T-day for short options | ✅ Mandatory |

---

### 11. Gaps Identified in Current Implementation (Action Items)

> [!WARNING]
> The following gaps were found during the SOP audit of `derivatives-routes.ts` and `derivatives-service.ts`:

| # | Gap | Severity | File | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| G-1 | `requireAuth` middleware is **missing** on all `/api/derivatives/*` routes | 🔴 Critical | `derivatives-routes.ts` | Add `requireAuth` to router |
| G-2 | No **suitability gate** — any authenticated user can access options chain & strategy payoff | 🔴 Critical | `derivatives-routes.ts` | Add `risk_profile` check middleware |
| G-3 | `console.error()` used instead of structured `logger` — PAN/user data at risk in logs | 🟠 High | `derivatives-routes.ts` | Replace all `console.error` with `logger.error` |
| G-4 | No **pre-trade gate logging** (SEBI Reg 19) | 🟠 High | `derivatives-routes.ts` | Integrate `auditLog()` on every strategy/margin endpoint |
| G-5 | **Weekly expiry validation** (`validateWeeklyExpiryEligibility`) not called in routes | 🟠 High | `derivatives-routes.ts` | Call validation before returning options chain |
| G-6 | No **idempotency key** on margin or strategy payoff endpoints | 🟡 Medium | `derivatives-routes.ts` | Add `idempotency_key` support |
| G-7 | No mandatory **SEBI F&O disclaimer** in API response payloads | 🟡 Medium | `derivatives-service.ts` | Attach `disclaimer` field to all strategy outputs |
| G-8 | `SEBI_FNO_FRAMEWORK_2026` lot sizes may be **stale** — no refresh mechanism | 🟡 Medium | `derivatives-service.ts` | Add DB-backed lot size table with SEBI circular reference |
| G-9 | `/positions` route returns empty array hardcoded — no real position tracking | 🟡 Medium | `derivatives-routes.ts` | Integrate with `portfolio_transactions` for derivative positions |
| G-10 | No **Expiry Day ELM surcharge** computation in margin calculator | 🟡 Medium | `derivatives-service.ts` | Add `isExpiryDay` flag and 2% ELM surcharge |

---

### 12. Enforcement & Governance

* **Document Owner:** Chief Compliance Officer (CCO), FintekPro
* **Review Cycle:** Quarterly or upon any SEBI circular impacting F&O framework
* **Version History:**

| Version | Date | Changes |
| :--- | :--- | :--- |
| v1.0 | 2026-10-31 | Initial SOP — Derivative Trading Audit Standards |

---

*This SOP is a binding internal policy document. Any deviation requires written CCO approval and must be documented in the compliance exception register. All engineering changes to derivative-related code must be reviewed against this SOP before deployment.*

