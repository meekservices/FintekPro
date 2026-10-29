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

## 4. Order Execution, Cut-Off Timings & NAV Realization

Order routing must enforce strict cut-off adherence in accordance with SEBI NAV realization rules:

| Category | Cut-Off Time (IST) | Applicable NAV Rule |
| :--- | :---: | :--- |
| **Liquid & Overnight Funds** | **1:30 PM** | Lower of: Historical day NAV / Day of fund realization in AMC bank account |
| **Equity & Debt Funds (< ₹2 Lakhs)** | **3:00 PM** | Same day NAV, subject to realization of funds before cut-off |
| **High Value Orders ($\ge ₹2 Lakhs$)** | **3:00 PM** | Closing NAV of the business day on which funds are credited to AMC account |

*Platform Rule*: Any payment confirmation received after cut-off time is automatically timestamped for T+1 business day processing.

---

## 5. Daily Reconciliation & RTA Synchronization

1. **RTA Data Ingestion**:
   - Daily automated batch ingestion of reverse feeds (WBR2, WBR9, WBR6) from CAMS and KFintech.
   - Reconciliation of transaction reference numbers, scheme codes, folio allocations, and NAV purchase prices.
2. **CAS (Consolidated Account Statement) Ingestion**:
   - Support for eCAS PDF ingestion with automated parsing and discrepancy reporting against internal ledger.

---

## 6. Codebase Enforcement Architecture

- **Validation Gate**: [`model-portfolio-tier-service.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/model-portfolio-tier-service.ts) (`portfolioTier: "retail_mf"`).
- **Suitability Checker**: [`risk-suitability-engine.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/risk-suitability-engine.ts) enforcing scheme risk-o-meter alignment with client risk appetite.
- **AMFI & EUIN Verifier**: [`sebi-compliance-service.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/sebi-compliance-service.ts).

---

*FintekPro Legal & Regulatory Council*  
*Standard Operating Policy — Mutual Funds Desk*

