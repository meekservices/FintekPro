# FintekPro Standard Operating Policy: Portfolio Management Services Desk (SOP-PMS v1.0)

**Document Code**: `SOP-PMS-2026-02`  
**Standard Version**: SOP-PMS-1.1.0  
**Effective Date**: November 2026  
**Governing Regulations**: SEBI (Portfolio Managers) Regulations, 2020 (Regulation 22 & 23); APMI (Association of Portfolio Managers in India) Standardized Performance Reporting Circulars; SEBI Master Circular on Portfolio Managers  
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

## 4. APMI Standardized Performance Reporting & TWRR Audits

In strict adherence to SEBI circulars and APMI (Association of Portfolio Managers in India) norms:
1. **Mandatory Time-Weighted Rate of Return (TWRR)**:
   - All performance figures (strategy returns, alpha vs benchmark) must be computed using the standardized **Time-Weighted Rate of Return (TWRR)** method net of all fees, expenses, and taxes.
   - Money-weighted returns (XIRR/IRR) can only be shown as secondary personalized metrics, never as the headline strategy performance.
2. **Monthly APMI Portal Submission**:
   - By the **7th calendar day of each month**, standardized performance and AUM data across all discretionary and non-discretionary strategies must be validated and uploaded to the central APMI reporting repository.
3. **Mandatory Benchmark Comparison**:
   - Performance must be benchmarked against standardized APMI-designated indices (e.g. Nifty 50 TRI, BSE 500 TRI, Nifty Midcap 150 TRI) matching the investment universe.

---

## 5. Fee Schedules & High-Water Mark (HWM) Computation

1. **Fee Component Breakdown**:
   - **Fixed Management Fee**: Billed quarterly in arrears on daily average AUM.
   - **Performance Fee**: Billed annually on alpha generated above a contractually agreed **Hurdle Rate** (e.g., 10% or benchmark return).
2. **Mandatory High-Water Mark Principle**:
   - In compliance with SEBI PMS regulations, performance fees can **ONLY** be charged if the Net Asset Value (NAV) exceeds the highest previously achieved NAV (the High-Water Mark).
   - If a portfolio suffers a drawdown, no performance fee is charged until all past losses are fully recouped.
3. **No Upfront Performance Fees**:
   - Charging performance fees in advance or without crystallization of returns is strictly forbidden.
4. **Direct Plan PMS Option**:
   - The platform offers a **Direct Plan** variant for every PMS strategy with zero distributor placement fees, ensuring lower expense friction for self-directed UHNIs.

---

## 6. SEBI Disclosure Document (Form C) & Digital Onboarding

1. **Mandatory 48-Hour Prior Delivery**:
   - In strict compliance with SEBI (Portfolio Managers) Regulations, 2020, the client must be furnished with the latest **SEBI Disclosure Document (Form C)** at least **48 hours prior** to entering into the client-manager agreement.
   - The platform timestamp records delivery; agreement signing UI remains locked until 48 hours have elapsed.
2. **Digital Onboarding & Central KYC (CKYC)**:
   - All PMS clients undergo CKYC verification, PAN-Aadhaar linking status checks, and digital agreement execution via Aadhaar e-Sign before fund transfers are permitted.
