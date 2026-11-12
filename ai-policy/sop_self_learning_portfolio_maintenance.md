# 🧠 SOP-SLPM v1.0: Self-Learning Portfolio Maintenance & Return Optimization Engine

> **Document ID:** `FINTEKPRO-SOP-SLPM-2026-V1`  
> **Classification:** Production AI Policy & Quantitative Governance Standard  
> **Applies To:** FintekPro Model Portfolio Engine, Portfolio Intelligence Service, Quant Retraining Pipeline  
> **Regulatory Adherence:** SEBI (Investment Advisers) Regulations 2013, SEBI (Portfolio Managers) Regulations 2020, SEBI AIF Regulations 2012, FASP-AI v3.1, GCR v1.0  
> **Effective Date:** November 2026  

---

## 1. Executive Summary & Purpose

The **Self-Learning Portfolio Maintenance & Return Optimization Engine (SLPM)** is FintekPro’s autonomous quantitative framework designed to continually maintain, monitor, rebalance, and optimize the 44 canonical model portfolios across all 4 SEBI wealth tiers:
1. **Retail Mutual Funds** (< ₹50L) — 100% AMFI Regular Plan verified.
2. **Affluent Specialized Investment Funds (SIF)** (₹10L - ₹50L).
3. **HNI Portfolio Management Services (PMS)** (₹50L - ₹1Cr).
4. **UHNI Alternative Investment Funds (AIF)** (≥ ₹1Cr).

The system continuously adapts asset weights, eliminates decaying instruments, and optimizes risk-adjusted returns (Sharpe, Sortino, Information Ratio) while guaranteeing strict adherence to regulatory boundaries, risk guardrails, and client consent gates.

---

## 2. Multi-Cadence Operational Architecture

The self-learning architecture operates on five synchronized feedback loops across distinct time horizons:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                             FintekPro SLPM Multi-Cadence Matrix                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
  Time Cadence      Component                   Primary Action
  ────────────────  ──────────────────────────  ─────────────────────────────────────────────
  Every 15 Mins     Algo Trading Sweep          Sweeps active limit/SIP orders & reconciles demat
  Daily 19:15 IST   Drift & Regime Monitor      Detects drift from canonical target allocations
  Nightly 23:00 IST Quant Scorer & NAV Sync     Recalculates Sharpe, Sortino, VaR, CVaR, Beta
  Weekly Sun 23:00  Alpha-Gap Dynamic Swaps     Identifies underperforming funds & proposes swaps
  M/W/F 19:00 IST   Calendar Rebalancing        Triggers disciplined rebalancing checks
  Cyclic (Auto)     Quant Retraining Pipeline   Retrains MVO, Covariance, Black-Litterman models
```

### 2.1 15-Minute Algo Trading Sweep (`modelPortfolioAlgoService`)
- Monitored by `runAlgoTradingBatchSweep()`.
- Reconciles execution states across broker gateways (Upstox, BSE StAR MF, NSE NMF II).
- Re-evaluates resting conditional execution orders against real-time market data ticks.

### 2.2 Daily 19:15 IST Drift Detection (`refreshDriftScores`)
- Evaluates asset class, sector, and constituent-level drift:
  $$\text{Drift}_i = |w_{i,\text{current}} - w_{i,\text{target}}|$$
- Portfolios with drift exceeding **5.00%** (Retail) or **3.50%** (PMS/AIF) are flagged for automated rebalancing recommendation.
- Evaluates regime classification (Bull / Low Vol, High Vol Chop, Bear / Risk-Off) based on Nifty 50 and multi-asset trend metrics.

### 2.3 Nightly 23:00 IST Quant Scoring (`model-portfolio-quant-service`)
- Computes daily NAV history, tracking errors, 3-year trailing alpha, downside deviation, and maximum drawdown.
- Emits structured analytics for all 44 canonical model portfolios into database persistence stores.

### 2.4 Weekly Sunday 23:00 IST Alpha-Gap Swaps (`autoApplyHighConfidenceSwaps`)
- Flags any constituent whose rolling 6-month alpha drops $> 2.50\%$ below category peers.
- Identifies higher-scoring substitutes within the same AMFI / SEBI category.
- Applies high-confidence replacements ($Confidence \ge 0.85$) at the canonical model layer with audit logging.

### 2.5 Mon / Wed / Fri 19:00 IST Calendar Rebalancing (`autoApplyCalendarRebalancing`)
- Checks rebalancing schedules (Monthly, Quarterly, Semi-Annual, Annual).
- Generates disciplined rebalance proposals to curb momentum creep and restore target asset allocation weights.

---

## 3. Quantitative Retraining Pipeline (`quantRetrainingScheduler`)

The core self-learning mathematical engine is powered by four cyclic modules running on distributed locks (`quantSchedulerLocks`):

```
                        ┌──────────────────────────────────────┐
                        │      Real-Time Market Data / NAV     │
                        └──────────────────┬───────────────────┘
                                           │
                                           ▼
                       ┌─────────────────────────────────────────┐
                       │  Shrinkage Covariance Matrix Calibration │
                       │           (Ledoit-Wolf Estimator)       │
                       └───────────────────┬─────────────────────┘
                                           │
                                           ▼
                       ┌─────────────────────────────────────────┐
                       │    Black-Litterman Bayesian Updater     │
                       │   (Prior Equilibrium + Analyst Views)   │
                       └───────────────────┬─────────────────────┘
                                           │
                                           ▼
                       ┌─────────────────────────────────────────┐
                       │    Mean-Variance Optimization (MVO)     │
                       │    (Constrained Quadratic Program)      │
                       └───────────────────┬─────────────────────┘
                                           │
                                           ▼
                       ┌─────────────────────────────────────────┐
                       │        Drift Prediction Retrainer       │
                       │     (Predicts Volatility Drift Spikes)  │
                       └───────────────────┬─────────────────────┘
                                           │
                                           ▼
                       ┌─────────────────────────────────────────┐
                       │   Canonical Portfolio Model Calibration │
                       └─────────────────────────────────────────┘
```

### 3.1 Mean-Variance Optimization (MVO)
- Formulated as a constrained convex quadratic optimization problem:
  $$\max_w \quad w^T \mu - \frac{\lambda}{2} w^T \Sigma w$$
  $$\text{subject to} \quad \sum_{i=1}^n w_i = 100.00\%, \quad w_{\min} \le w_i \le w_{\max}$$
- **Weight Bounds:**
  - Retail Mutual Fund portfolios: Minimum holding weight $2.00\%$, maximum single fund holding $30.00\%$.
  - Large-Cap / Equity PMS: Minimum $3.00\%$, maximum single stock $10.00\%$ (SEBI concentration norm).
  - Cash / Liquid buffer: Retains a minimum $2.00\% - 5.00\%$ liquidity reserve.

### 3.2 Ledoit-Wolf Shrinkage Covariance Matrix
- Mitigates sample noise in high-dimensional financial return time series.
- Shrinks empirical sample covariance $S$ towards a structured constant-correlation target $F$:
  $$\Sigma^* = \alpha F + (1 - \alpha) S$$
- Prevents extreme, erratic weights produced by raw covariance inversion.

### 3.3 Black-Litterman Model Integration
- Blends historical market equilibrium returns $\Pi$ with forward-looking macroeconomic and quantitative views $Q$:
  $$E[R] = \left[(\tau \Sigma)^{-1} + P^T \Omega^{-1} P\right]^{-1} \left[(\tau \Sigma)^{-1} \Pi + P^T \Omega^{-1} Q\right]$$
- Incorporates interest rate trajectories (RBI MPC stance), inflation dynamics, and equity risk premia without overreacting to short-term price noise.

### 3.4 Drift Prediction Retraining
- Retrains machine-learning regressors on tracking error patterns.
- Predicts which asset classes are approaching drift threshold triggers before breaches occur.

---

## 4. Risk Controls, Circuit Breakers & Black Swan Handling

To prevent machine learning models from destabilizing portfolios during tail-risk events, the following guardrails are strictly enforced:

### 4.1 10σ Black Swan Market Suspension
- If the intraday volatility or market drawdown exceeds $10\sigma$ relative to the 252-day moving window:
  - All automated model weight mutations and rebalancing pipelines are **immediately suspended**.
  - Portfolios default to defensive capital-preservation postures (tactical liquid / treasury allocations).
  - High-priority operational alerts are dispatched to the Chief Risk Officer and Lead Portfolio Manager.

### 4.2 Distributed Locking, Redis Acceleration & Rate Limiting
- **Lock Management:** Handled via Google Cloud Memorystore Redis as Tier 1 (`distributedLock`, namespace `lock:quant_retrain:*`) with automatic TTL expiry, falling back to PostgreSQL `quant_scheduler_locks` with a 30-minute Time-To-Live (TTL).
- **Execution Cap:** Maximum **4 retraining runs per 24-hour cycle** per cluster.
- **Cooling Window:** Minimum gap of **6 hours** between consecutive MVO retrain executions.
- **Exponential Backoff:** If an optimization routine fails or encounters degenerate covariance matrices, backoff kicks in from 15 minutes up to 24 hours.

### 4.3 Portfolio Rebalancing Guardrails
- **Turnover Cap:** Rebalancing reallocations are capped at **20% per calendar quarter** to prevent excessive portfolio churn and transaction friction.
- **Tax Optimization:** Sell recommendations prioritize tax-loss harvesting and avoid crossing short-term capital gains (STCG) thresholds when long-term status (LTCG) is imminent within 30 days.

---

## 5. SEBI Regulatory & Fiduciary Boundaries

The SLPM Engine enforces a strict structural distinction between **Model-Level Optimization** and **Client Account Execution**:

```
Model Portfolio Layer (Canonical)                     Client Portfolio Layer (Individual Demat)
┌─────────────────────────────────┐                 ┌────────────────────────────────────────┐
│  Automated Self-Learning &      │                 │  FASP-AI Decision Support System       │
│  Quantitative Model Tuning      │ ──[Recommendation]──▶ │  • Generates Client Rebalance Proposal │
│  • MVO, Black-Litterman, Swaps  │                 │  • Explicit User / Advisor Approval    │
│  • Fully Autonomous at Template │                 │  • MANDATORY Human-in-the-Loop Gate    │
└─────────────────────────────────┘                 └───────────────────┬────────────────────┘
                                                                        │
                                                                 [User Approved]
                                                                        │
                                                                        ▼
                                                            ┌────────────────────────┐
                                                            │ Execution Gateways     │
                                                            │ (BSE StAR, NSE, Upstox)│
                                                            └────────────────────────┘
```

1. **Autonomous Canonical Model Tuning:**
   - The 44 canonical model portfolios stored in the platform are quantitative templates.
   - The self-learning engine updates template allocations, published status, and recommended target weights autonomously under SEBI Research Analyst / RA algorithm governance.
2. **Client Account Execution Gate (Zero Autonomous Trading):**
   - In compliance with SEBI Investment Advisers (RIA) regulations and **FintekPro FASP-AI v3.1**, the AI engine is strictly a **Decision Support System**.
   - The engine **NEVER** autonomously initiates buy or sell orders in client demat accounts or mutual fund folios.
   - All proposed portfolio drifts, swaps, and rebalancing events generate actionable recommendations requiring **explicit client consent or authorized RIA approval**.

---

## 6. Auditability & Observability (GCR v1.0)

Every self-learning calculation, model swap, and scheduler trigger must emit immutable structured logs:

```json
{
  "event": "QUANT_RETRAINING_MVO_COMPLETED",
  "engine_version": "SLPM-v1.0",
  "portfolio_id": "core-conservative-wealth",
  "calculation_timestamp": "2026-11-10T19:00:00.000Z",
  "inputs_used": {
    "lookback_days": 756,
    "risk_aversion_lambda": 3.5,
    "shrinkage_alpha": 0.28
  },
  "allocations_previous": { "DEBT": 0.60, "LARGE_CAP": 0.30, "GOLD": 0.10 },
  "allocations_optimized": { "DEBT": 0.58, "LARGE_CAP": 0.32, "GOLD": 0.10 },
  "expected_sharpe_delta": "+0.14",
  "status": "SUCCESS",
  "latency_ms": 342
}
```

- In the event of an anomalous model recommendation, administrators can revert canonical allocations instantly to any historical snapshot via the versioned audit ledger.

---

## 7. Operational Checklist & Routine Maintenance

| Frequency | Responsible Engine | Verification Task |
| :--- | :--- | :--- |
| **Daily** | `Data Health Monitor` | Verify AMFI NAV fetch completeness and NSE quote pipeline integrity. |
| **Weekly** | `Audit Cleanup Task` | Prune expired scheduler locks (`quantSchedulerLocks`) and check for deadlocks. |
| **Monthly** | Lead Quantitative Analyst | Review backtested tracking error vs benchmark (Nifty 50, CRISIL Composite Bond Fund Index). |
| **Quarterly** | Risk & Compliance Committee | Full audit of model portfolio turn-over rates, alpha-gap swap efficacy, and client approval logs. |

---
*Signed off by FintekPro Quantitative Investment & Governance Committee.*

