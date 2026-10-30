# FintekPro Standard Operating Policy: Balanced Portfolio Performance Monitoring (SOP-BAL v1.0)

**Document Code**: SOP-BAL-2026-01  
**Effective Date**: October 2026  
**Governing Regulations**: SEBI (Investment Advisers) Regulations, 2013; SEBI (Mutual Funds) Regulations, 1996 — Hybrid Fund Categorization; AMFI Scheme Categorization Circular 2017; SEBI Risk-o-Meter Framework 2021  
**Asset Classes in Scope**: `hybrid` | `multi_asset` | `goal_based` (All-Weather, Balanced Growth, Conservative Balanced, Family Office, Any portfolio with `assetClass = "hybrid"`)  
**Enforced By**: [`portfolio-rebalance-scheduler.ts`](../server/services/portfolio-rebalance-scheduler.ts) | [`portfolio-risk-guard.ts`](../server/services/portfolio-risk-guard.ts) | [`model-portfolio-metrics-service.ts`](../server/services/model-portfolio-metrics-service.ts)

---

## 1. Why Balanced Portfolios Need a Dedicated Monitoring SOP

Balanced portfolios (equity + debt ± gold ± REIT ± international) present a unique and compounded monitoring challenge that is **not captured by the pure-equity SOP-MF or the pure-debt rules**:

| Challenge | Why It Differs from Pure Equity / Pure Debt |
| :--- | :--- |
| **Asset-mix drift** | Over time, equity outperformance silently pushes a 60:40 to 70:30 or 80:20, shifting the mandate entirely |
| **Dual benchmark tracking** | Must be measured against a *blended* benchmark (e.g. CRISIL Hybrid 60:40) — not a single index |
| **Correlation breakdown** | Equity-debt negative correlation can reverse in stagflationary environments; plain drift-detection misses this |
| **Multi-leg rebalancing cost** | Correcting equity–debt mix involves both sell and buy legs with STCG/LTCG friction on both sides |
| **SEBI scheme categorization compliance** | SEBI MF Circular 2017 mandates Balanced Advantage / Aggressive Hybrid must maintain defined equity bands |

---

## 2. Statutory Asset Allocation Bands (SEBI Scheme Categorization)

All balanced / hybrid model portfolios on FintekPro must operate within SEBI-mandated bands:

| Scheme Sub-Category | Min Equity (%) | Max Equity (%) | Min Debt (%) | Max Debt (%) | Governing Circular |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Conservative Hybrid** | 10 | 25 | 75 | 90 | SEBI/HO/IMD/DF3/CIR/P/2017/114 |
| **Balanced Hybrid** | 40 | 60 | 40 | 60 | SEBI/HO/IMD/DF3/CIR/P/2017/114 |
| **Aggressive Hybrid** | 65 | 80 | 20 | 35 | SEBI/HO/IMD/DF3/CIR/P/2017/114 |
| **Multi-Asset Allocation** | 10 | — | 10 | — | Min 3 asset classes, each ≥ 10% |
| **Balanced Advantage / Dynamic Asset Allocation** | 0 | 100 | 0 | 100 | Model-driven; must disclose net equity range |
| **All-Weather / Family Office (FintekPro Custom)** | 20 | 35 | 15 | 25 | Per mandate declaration in `sebi_compliance_rules` |

> [!IMPORTANT]
> A breach of SEBI-mandated equity / debt bands must be **corrected within 30 days** and disclosed in the monthly portfolio commentary.

---

## 3. Monitoring Frequency & Triggers

### 3.1 Regular Cadence

| Monitoring Activity | Frequency | Trigger Condition | Enforcement System |
| :--- | :--- | :--- | :--- |
| **Asset-Mix Drift Check** | Daily (automated) | Live equity % deviates by > ±5pp from target band | `portfolio-rebalance-scheduler.ts` |
| **Blended Benchmark Deviation** | Weekly | Portfolio CAGR lags blended benchmark by > 3pp on rolling 1Y basis | `model-portfolio-metrics-service.ts` |
| **Sharpe Ratio Floor Check** | Monthly | Sharpe < 0.70 (Moderate Balanced mandate threshold per `RISK_POLICY.md`) | `portfolio-risk-guard.ts` |
| **Max Drawdown Breach** | Real-time | Rolling 3M drawdown > -14% (Moderate Balanced mandate) | `portfolio-risk-guard.ts` (Hard Breach) |
| **Correlation Regime Shift** | Monthly | Equity–debt correlation (ρ) flips from negative to > +0.50 | `global-macro-transmission-service.ts` |
| **Cash Drag Check** | Daily | Uninvested cash > `max_cash_drag` (default 10%) | `portfolio-risk-guard.ts` |
| **Alpha Drag Check** | Quarterly | Any single holding trailing alpha < `alpha_drag_floor` (default -8%) for 3 consecutive quarters | `portfolio-risk-guard.ts` |

### 3.2 Event-Based Emergency Triggers

| Market Event | Escalation Action |
| :--- | :--- |
| VIX-equivalent > 10σ (Black Swan) | All automated rebalancing suspended immediately (§24.1 of FASP-AI) |
| RBI emergency rate move > 75bps intraday | Debt-side duration sensitivity review triggered immediately |
| Nifty 50 intraday drop > 7% (circuit level) | Circuit breaker (`circuit_breaker_tripped = true`) set; auto-rebalance suspended |
| Equity allocation breaches SEBI band | `needs_rebalance = true`, `pending_rebalance_plan` seeded with multi-leg correction |

---

## 4. Blended Benchmark Construction

Every balanced portfolio must carry a **composite blended benchmark** for performance attribution, stored in `blended_benchmark_return` and `apmi_benchmark_name`:

| Portfolio | Benchmark | Composition |
| :--- | :--- | :--- |
| **Moderate Balanced Growth** | CRISIL Hybrid 60:40 Index | 60% Nifty 50 + 40% CRISIL Composite Bond Fund Index |
| **All-Weather Multi-Asset** | CRISIL Multi Asset 60:40 Index | 60% Equity / 20% Debt / 10% Gold / 10% REITs |
| **Conservative Capital Preserver** | CRISIL Hybrid 25:75 Index | 25% Nifty 50 + 75% CRISIL Composite Bond Fund Index |
| **Family Office Portfolio** | CRISIL Multi Asset 60:40 Index | Institutional 6-asset class composite |
| **Gold + Debt + Equity Custom** | CRISIL Multi Asset 60:40 Index | Per mandate declaration |

> [!NOTE]
> `blended_benchmark_return` in `model_portfolios` must be updated every NAV computation cycle by `nav-sync` job using weighted constituent index returns. The `benchmark_name` column must store the *standard* benchmark name per the above table.

---

## 5. Asset-Mix Drift Correction Protocol

When equity-band drift is detected (`needs_rebalance = true`), the following process applies:

```
Step 1 — Compute current equity %, debt %, gold %, other %
         from live holdings weighted by current NAV / LTP

Step 2 — Compare against mandate band (from sebi_compliance_rules or
         SEBI categorization table above)

Step 3 — If drift > 5pp: generate pending_rebalance_plan with:
           - Which legs to sell (over-weight assets)
           - Which legs to buy (under-weight assets)
           - Estimated LTCG / STCG tax friction for each sell leg
           - Net alpha projected after tax friction

Step 4 — Tax friction gate: if net alpha gain < tax cost, defer
         rebalance by 1 quarter and flag REBALANCE_DEFERRED_TAX_FRICTION

Step 5 — RIA approval gate: generate rebalance_proposals record
         with status = 'pending_advisor'. Never auto-apply on
         client accounts without 1-tap RIA or client confirmation.

Step 6 — Post-execution: log to model_portfolio_transactions and
         sebi_audit_logs with rebalance_reason, drift_score, and
         engine_version
```

> [!CAUTION]
> **Never auto-apply multi-leg equity↔debt rebalances on live client accounts.** Template model portfolios may be auto-updated. Client folios require explicit `rebalance_proposals` → advisor approval flow.

---

## 6. Performance Attribution Requirements

Every balanced portfolio must emit a monthly **performance attribution report** (stored in `portfolio_ai_decisions`) with the following mandatory fields:

```json
{
  "event": "BALANCED_PERFORMANCE_REVIEW",
  "portfolio_id": "<string>",
  "review_period": "YYYY-MM",
  "equity_contribution_return": "<number>",
  "debt_contribution_return": "<number>",
  "gold_contribution_return": "<number>",
  "blended_benchmark_return": "<number>",
  "active_return_vs_benchmark": "<number>",
  "current_equity_pct": "<number>",
  "current_debt_pct": "<number>",
  "target_equity_pct": "<number>",
  "target_debt_pct": "<number>",
  "band_breach": "<boolean>",
  "sharpe_ratio": "<number>",
  "max_drawdown_3m": "<number>",
  "correlation_equity_debt": "<number>",
  "cash_drag_pct": "<number>",
  "model_version": "FASP-AI v3.1",
  "calculation_timestamp": "<iso_timestamp>",
  "engine_version": "<string>"
}
```

---

## 7. Risk Budget for Balanced Mandates

From `RISK_POLICY.md` §3 — these risk budgets apply and are enforced by [`portfolio-risk-guard.ts`](../server/services/portfolio-risk-guard.ts):

| Mandate | Max Volatility (σ) | Max Drawdown | Beta Ceiling | Sharpe Floor | Max Single Holding | Max Sector |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Conservative Capital Preserver** | 8.0% | -6.0% | 0.40 | 1.20 | 30.0% | 50.0% |
| **Moderate Balanced Growth** | 16.0% | -14.0% | 1.00 | 0.70 | 25.0% | 40.0% |
| **All-Weather Multi-Asset** | 12.0% | -10.0% | 0.70 | 0.90 | 25.0% | 40.0% |
| **Family Office / UHNI** | 14.0% | -12.0% | 0.80 | 0.80 | 20.0% | 35.0% |

---

## 8. Codebase Enforcement Architecture

| SOP Rule | Enforced In | Trigger |
| :--- | :--- | :--- |
| Daily asset-mix drift | [`portfolio-rebalance-scheduler.ts`](../server/services/portfolio-rebalance-scheduler.ts) | Cron: every trading day at 4:30 PM IST |
| Blended benchmark deviation | [`model-portfolio-metrics-service.ts`](../server/services/model-portfolio-metrics-service.ts) | Weekly nav-sync job |
| Sharpe / drawdown hard breach | [`portfolio-risk-guard.ts`](../server/services/portfolio-risk-guard.ts) | Real-time on rebalance proposal creation |
| Cash drag alert | [`portfolio-risk-guard.ts`](../server/services/portfolio-risk-guard.ts) | Daily (uses `max_cash_drag` column) |
| Alpha drag floor | [`portfolio-risk-guard.ts`](../server/services/portfolio-risk-guard.ts) | Quarterly (uses `alpha_drag_floor` column) |
| SEBI band breach flag | [`portfolio-rebalance-scheduler.ts`](../server/services/portfolio-rebalance-scheduler.ts) | Sets `needs_rebalance = true`, `circuit_breaker_tripped` if severe |
| Performance attribution log | [`model-portfolio-metrics-service.ts`](../server/services/model-portfolio-metrics-service.ts) | Monthly (logged to `portfolio_ai_decisions`) |
| Audit trail | [`sebi-audit-logs`](../shared/schema.ts) | Every rebalance event, WORM-logged for 7 years |

> [!NOTE]
> The `balanced_portfolio_monitor` service function is **to be implemented in `portfolio-rebalance-scheduler.ts`** (see §9 below). This is the key missing implementation gap.

---

## 9. Implementation Gap: `monitorBalancedPortfolios()` Function

The following **function is currently missing** from the codebase and must be implemented:

```typescript
/**
 * monitorBalancedPortfolios()
 * SOP-BAL v1.0 §3 — Daily automated monitoring for hybrid/multi-asset portfolios.
 *
 * Purpose:    Enforce asset-mix band compliance, blended benchmark deviation alerts,
 *             correlation regime detection, and monthly attribution logging for all
 *             portfolios with assetClass = 'hybrid' | 'multi_asset' | 'goal_based'.
 * Schedule:   Called daily at 4:30 PM IST by the rebalance cron job.
 * Guardrails: Black Swan suspension (§24.1), tax friction gate, RIA approval gate.
 * Output:     { portfoliosChecked, bandBreaches, benchmarkAlerts, rebalancesQueued }
 */
export async function monitorBalancedPortfolios(): Promise<BalancedMonitorResult> { ... }
```

**Implementation is required for full SOP-BAL v1.0 compliance.**

---

## 10. Disclosure Requirements

Every balanced portfolio factsheet, proposal, and client report must include:

1. **Benchmark disclosure**: *"This portfolio is benchmarked against [CRISIL Hybrid 60:40 Index / CRISIL Multi Asset 60:40 Index]. Past performance of the benchmark does not guarantee future portfolio returns."*
2. **Asset-mix disclosure**: Current equity%, debt%, gold%, and other% as of report date.
3. **Standard risk disclaimer**: *"Investment in securities market are subject to market risks. Read all scheme related documents carefully."*
4. **Rebalancing disclosure**: Date and reason for last rebalance, tax impact on client account.

---

*FintekPro Investment & Risk Committee (IRC)*  
*SOP-BAL v1.0 — Balanced Portfolio Performance Monitoring*
