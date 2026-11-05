# Standard Operating Procedure (SOP): RBI Digital Lending & Model Risk Management (MRM)

**Document Code**: `FINTEK-SOP-RBI-DLG-MRM-2026-03`  
**Standard Version**: SOP-RBI-1.0.0  
**Effective Date**: November 2026  
**Governing Authorities**: Reserve Bank of India (Digital Lending Guidelines 2022/2024, Master Direction on IT Governance, Model Risk Management Framework)  
**Applicability**: Credit Operations Desk, Lending Partners (Banks/NBFCs), Software Engineering, Risk & Compliance  

---

## 1. Statutory Mandate & Scope

This Standard Operating Procedure governs all digital credit facilitation, Loan Against Mutual Funds/Shares (LAS), margin financing integrations, and credit scoring algorithms deployed on the FintekPro platform.

In digital lending workflows, FintekPro operates as a **Lending Service Provider (LSP)** partnering with RBI-regulated entities (Banks / NBFCs). All lending practices must conform strictly to the **RBI Digital Lending Guidelines (DLG)** and the **Model Risk Management (MRM)** framework.

---

## 2. Strict Device Privacy & Anti-Harvesting Boundaries

Under RBI DLG §4, fintech lending portals are **strictly prohibited** from accessing mobile device telemetry commonly exploited by predatory lenders.

### 2.1 Explicitly Banned Data Ingestion
- ❌ **Mobile Contact Lists**: The application and mobile SDK must **never request permission or inspect** client phone address books.
- ❌ **SMS Text Archives**: Scraping SMS inbox contents for transaction sniffing is strictly banned.
- ❌ **Call Logs & Audio/Video Media**: Zero access to call logs, phone state, device gallery, or microphone.
- ❌ **Continuous Background Geolocation**: Background GPS tracking is disabled.

### 2.2 Sole Exception: One-Time Onboarding Verification
- **One-Time Location & Camera Access**: Real-time camera and single-point GPS coordinate capture are permitted **strictly once** during live Video Customer Identification Process (V-CIP) / CKYC geofencing verification to confirm the applicant is physically within Indian territory. Once verified, location permissions are immediately relinquished.

---

## 3. Direct Fund Flows (Zero Intermediary Escrow)

1. **Borrower to Regulated Entity Direct Routing**:
   - In compliance with RBI circulars, **no loan disbursement or repayment may transit through a FintekPro pool account, nodal account, or third-party payment gateway wallet**.
   - Loan proceeds must disburse directly from the Regulated Entity's (Bank/NBFC) core banking system into the borrower's verified primary bank account.
2. **Repayments**:
   - Repayments and EMI debits must flow via e-NACH / UPI AutoPay mandates registered directly in favor of the lending Bank/NBFC.

---

## 4. Key Fact Statement (KFS) & Cooling-off Period

1. **Standardized Key Fact Statement (KFS)**:
   - Before executing any digital loan contract or pledging securities, the platform must present a standardized, RBI-compliant Key Fact Statement.
   - The KFS must explicitly disclose:
     - Total sanctioned credit limit and drawing power.
     - **Annual Percentage Rate (APR)** covering all interest, processing fees, and documentation charges.
     - Recovery partner details and nodal grievance redressal officer contact.
     - Penal interest charges and margin call triggers.
2. **Mandatory Cooling-off / Look-up Period**:
   - Every borrower is granted a statutory **cooling-off period of at least 3 business days** (for loans with tenure $\ge 7$ days).
   - If the borrower decides to exit the loan during this window, they may repay the principal and proportionate APR without incurring any prepayment penalties.

---

## 5. Model Risk Management (MRM) for Credit & LTV Algorithms

FintekPro utilizes quantitative models (`MultiVendorLASService`, `MarginCallCalculator`) to evaluate Loan-to-Value (LTV) ratios and collateral haircuts against mutual funds and equities.

### 5.1 Model Lifecycle Governance
1. **Conceptual Soundness**:
   - All haircut calculations must strictly enforce SEBI/RBI statutory caps:
     - Equity Shares: Maximum statutory LTV is capped at **50% of 5-day volume-weighted average price (VWAP)**.
     - Debt Mutual Funds: Maximum statutory LTV is capped at **85% of official NAV**.
     - Equity Mutual Funds: Maximum statutory LTV is capped at **50% of official NAV**.
2. **Automated Margin Call & Invocation Protocol**:
   - When market drawdowns erode collateral value:
     - **Warning Alert (LTV reaches 65%)**: Automated SMS and email alert to borrower to top up collateral.
     - **Liquidation Warning (LTV reaches 75%)**: 24-hour cure notice.
     - **Enforcement (LTV reaches 85%)**: Regulated entity invokes pledge. AI facilitates slice-order execution with minimum market slippage.
3. **Algorithmic Bias Audit**:
   - Credit scoring algorithms are audited semi-annually to verify zero adverse impact or demographic bias across geographic zones, gender, or community segments.

---

*FintekPro Lending Operations & Credit Risk Committee*  
*Standard Operating Procedure — RBI Digital Lending & MRM*

