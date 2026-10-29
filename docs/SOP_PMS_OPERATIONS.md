# FintekPro Standard Operating Policy: Portfolio Management Services Desk (SOP-PMS v1.0)

**Document Code**: SOP-PMS-2026-02  
**Effective Date**: October 2026  
**Governing Regulations**: SEBI (Portfolio Managers) Regulations, 2020 (Regulation 23(2)); SEBI Circulars on Performance Fee Calculation  
**Execution Desk**: Upstox PMS API & Segregated Depository Participants  

---

## 1. Statutory Mandate & Scope

This Operating Policy governs all High Net Worth Individual (HNI) Discretionary and Non-Discretionary Portfolio Management Services (PMS) on the FintekPro platform.

Unlike Mutual Funds, PMS operates strictly on a **segregated client custody architecture**. There is **NO pooling of client funds or securities**. All stocks, bonds, REITs, and cash collateral are held directly in the client's individual PAN-linked Demat and trading accounts with an approved SEBI custodian/broker.

---

## 2. Statutory Minimum Ticket Size (SEBI Regulation 23(2))

1. **Mandatory ₹50 Lakhs Floor**:
   - The platform strictly enforces a **statutory minimum investment ticket of ₹50,00,000 (Rupees Fifty Lakhs)** per client account.
   - Any order, model portfolio allocation, or contract generation below ₹50 Lakhs is hard-blocked at the API gatekeeper level with HTTP 422 `INSUFFICIENT_STATUTORY_PMS_INVESTMENT`.
2. **Partial Withdrawal Restrictions**:
   - Clients may make partial withdrawals only if the post-withdrawal portfolio valuation remains **strictly $\ge ₹50,00,000$**. If market drawdowns cause the portfolio value to dip below ₹50 Lakhs, the client is not forced to add capital, but voluntary withdrawals that breach ₹50 Lakhs are prohibited.

---

## 3. Segregated Demat & Execution Infrastructure

1. **Direct Demat Ownership**:
   - Securities are purchased directly in the client's individual name through connected exchange accounts (e.g., Upstox Execution Desk via [`upstox-execution-engine.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/upstox-execution-engine.ts)).
   - Power of Attorney (POA) or Demat Debit and Pledging Instruction (DDPI) is limited strictly to trade settlement and margin pledge with the registered custodian.
2. **Corporate Actions Handling**:
   - Dividends, stock splits, bonus shares, rights entitlements, and buyback proceeds flow directly into the client’s designated bank and demat accounts.
   - The platform PMS portfolio accounting engine reconciles corporate actions daily at T+1 to adjust cost bases and cash yields.

---

## 4. Fee Schedules & High-Water Mark (HWM) Computation

1. **Fee Component Breakdown**:
   - **Fixed Management Fee**: Billed quarterly in arrears on daily average AUM.
   - **Performance Fee**: Billed annually on alpha generated above a contractually agreed **Hurdle Rate** (e.g., 10% or benchmark return).
2. **Mandatory High-Water Mark Principle**:
   - In compliance with SEBI PMS regulations, performance fees can **ONLY** be charged if the Net Asset Value (NAV) exceeds the highest previously achieved NAV (the High-Water Mark).
   - If a portfolio suffers a drawdown, no performance fee is charged until all past losses are fully recouped.
3. **No Upfront Performance Fees**:
   - Charging performance fees in advance or without crystallization of returns is strictly forbidden.

---

## 5. SEBI Disclosure Document (Form C) & Onboarding

1. **Mandatory Client Acknowledgment**:
   - Prior to account activation or agreement execution, the client must be furnished with the latest **SEBI Disclosure Document (Form C)** detailing the Portfolio Manager's disciplinary history, audited performance track record, conflict of interest disclosures, and comprehensive fee matrix.
   - Client digital signature (Aadhaar e-Sign) and timestamped confirmation are logged in the audit trail.

---

## 6. Codebase Enforcement Architecture

- **Tier Validator**: [`model-portfolio-tier-service.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/model-portfolio-tier-service.ts) (`portfolioTier: "hni_pms"`, `custodyStructure: "SEGREGATED_CLIENT_DEMAT"`).
- **Execution Driver**: [`upstox-execution-engine.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/upstox-execution-engine.ts) for atomic batch order slicing and execution.
- **Capital Sizing**: [`model-portfolio-share-sizing.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/model-portfolio-share-sizing.ts) ensuring whole-share integer allocations across segregated demats.

---

*FintekPro Legal & Regulatory Council*  
*Standard Operating Policy — PMS Desk*
