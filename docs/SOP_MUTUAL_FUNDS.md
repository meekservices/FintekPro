# FintekPro Standard Operating Policy: Mutual Funds Desk (SOP-MF v1.0)

**Document Code**: SOP-MF-2026-01  
**Effective Date**: October 2026  
**Governing Regulations**: SEBI (Mutual Funds) Regulations, 1996; SEBI (Investment Advisers) Regulations, 2013; AMFI Code of Conduct  
**Execution Desk**: IRIS Hub & RTA Connectivity (BSE StAR MF / NSE NMF II / MF Central)  

---

## 1. Statutory Mandate & Scope

This Operating Policy governs all retail and corporate mutual fund workflows on the FintekPro platform, including model portfolio baskets, SIP lifecycle management, RTA folio reconciliations, and distributor/advisor compliance.

Mutual funds operate on a **pooled investment trust architecture** wherein investor capital is commingled into SEBI-approved schemes managed by registered Asset Management Companies (AMCs) and held by independent Board of Trustees.

---

## 2. Statutory Ticket Sizes & Investment Ceilings

1. **Minimum Ticket Sizes**:
   - Systematic Investment Plans (SIP): Minimum ₹500/month (or scheme minimum).
   - Lumpsum Investments: Minimum ₹1,000 – ₹5,000 as specified in the Scheme Information Document (SID).
2. **Statutory Investment Limits**:
   - Retail investors have no maximum statutory ceiling, but transactions $\ge ₹2,00,000$ trigger High-Value Transaction (HVT) monitoring and require source-of-funds verification.
   - Cash transactions are capped at ₹50,000 per investor per financial year across all schemes.

---

## 3. Advisory vs. Distribution Segregation (SEBI Reg 22)

1. **Fee-Only RIA Routing (Direct Plans)**:
   - All investment recommendations rendered under SEBI RIA registration (`INA...`) must specify **Direct Plans** (ISIN starting with `INF...` designated as Direct-Growth).
   - RIAs are strictly barred from receiving trail commissions, distributor incentives, or marketing support from AMCs.
2. **MFD Distribution Routing (Regular Plans)**:
   - When executing under Mutual Fund Distributor (MFD) status, orders are tagged with the authorized ARN (`ARN-...`) and valid EUIN (`E...`).
   - Platform must present automated pre-execution commission disclosures comparing Regular Plan TER vs. Direct Plan TER per SEBI Circular `SEBI/HO/IMD/DF2/CIR/P/2018/137`.

---

## 4. Order Execution, Cut-Off Timings & Universal NAV Realization (SEBI Circular 2020/175)

Order routing enforces strict cut-off adherence in accordance with unified SEBI NAV realization rules:

| Category | Cut-Off Time (IST) | Universal NAV Realization Rule |
| :--- | :---: | :--- |
| **Liquid & Overnight Funds** | **1:30 PM** | Lower of: Historical day NAV / Day of fund realization in AMC bank account |
| **Equity & Debt Funds (All Ticket Sizes)** | **3:00 PM** | Closing NAV of the business day on which investor funds are credited to the AMC collection account prior to cut-off |
| **Redemptions & Switches** | **3:00 PM** (Equity) / **1:30 PM** (Liquid) | Closing NAV of the transaction submission day |

*Platform Rule*: Any payment confirmation or fund credit received after cut-off time is automatically timestamped for T+1 business day processing.

---

## 5. Daily Reconciliation & RTA Synchronization

1. **RTA Data Ingestion**:
   - Daily automated batch ingestion of reverse feeds (WBR2, WBR9, WBR6) from CAMS and KFintech.
   - Reconciliation of transaction reference numbers, scheme codes, folio allocations, and NAV purchase prices.
2. **CAS (Consolidated Account Statement) Ingestion**:
   - Support for eCAS PDF ingestion with automated parsing and discrepancy reporting against internal ledger.

---

## 6. SEBI New Asset Class / Specified Investment Products (SIF Desk)

1. **Regulatory Framework**:
   - Governed under **SEBI (Mutual Funds) (Amendment) Regulations, 2024 — Master Framework for Specified Investment Products (SIF)**.
   - Designed to bridge the retail mutual fund market (₹5,000) and the high-ticket PMS market (₹50 Lakhs).
2. **Statutory Ticket Size & Eligibility**:
   - Minimum investment commitment: **₹10,00,000 (Rupees Ten Lakhs)** across one or more strategies under the SIF umbrella.
   - Vehicle Type: `SIF_NEW_ASSET_CLASS` with pooled trustee custody (`TRUSTEE_AMC_UNITS`).
3. **Permitted Investment Strategies**:
   - **Long-Short Equity**: Systematic equity long positions combined with index/stock derivative shorts for downside hedging.
   - **Dynamic Factor Arbitrage**: Market-neutral factor spreads capturing valuation anomalies.
   - **Derivative Exposure Ceiling**: Net long/short derivative gross exposure capped at 25% of AUM for hedging and risk mitigation.

---

## 7. Liquidity Stress Testing & Concentration Guardrails

1. **Small & Mid-Cap Liquidity Horizon (SEBI Circular March 2024)**:
   - All small-cap and mid-cap mutual fund holdings are subjected to monthly stress testing models to compute **Days to Liquidate 25% and 50%** of the portfolio.
   - Portfolios requiring $> 15$ days to liquidate 25% are flagged with an elevated liquidity risk warning.
2. **Prudential Diversification Limits**:
   - **Single-Stock Look-Through Cap**: Underlying consolidated stock exposure across multiple schemes capped at 10% (SEBI Seventh Schedule).
   - **Thematic Overlap Cap**: Pairwise overlap between thematic/sectoral schemes capped at 50% to prevent over-concentration.

---

## 8. Fund Performance Maximization Guardrails (FASP-AI v3.1)

1. **Anti-Cash Drag Protocol**:
   - Uninvested cash buffer in equity model portfolios is capped at **5% to 10%**. Any idle cash exceeding the threshold triggers an automated yield deployment alert into 91-Day T-Bills or liquid yield funds yielding 6.8%–7.1% p.a.
2. **Alpha Drag & Underperformance Exit**:
   - Holdings exhibiting trailing alpha $< -8\%$ across 3 consecutive quarters trigger automated tactical replacement recommendations.
3. **Tax-Friction Optimization Gate**:
   - Prior to generating rebalancing proposals, the rebalance optimizer verifies that the projected net alpha gain exceeds the capital gains tax friction (STCG 20%, LTCG 12.5% per Union Budget 2024).

---

## 9. Codebase Enforcement Architecture

- **Validation Gate**: [`model-portfolio-tier-service.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/model-portfolio-tier-service.ts) (`portfolioTier: "retail_mf"` and `"affluent_sif"`).
- **Suitability Checker**: [`risk-suitability-engine.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/risk-suitability-engine.ts) enforcing scheme risk-o-meter alignment with client risk appetite.
- **Risk Budget Guard**: [`portfolio-risk-guard.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/portfolio-risk-guard.ts) enforcing cash-drag limits and alpha drag floors.
- **AMFI & EUIN Verifier**: [`sebi-compliance-service.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/sebi-compliance-service.ts).

---

*FintekPro Legal & Regulatory Council*  
*Standard Operating Policy — Mutual Funds Desk*

