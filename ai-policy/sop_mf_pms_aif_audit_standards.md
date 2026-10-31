# Standard Operating Procedures (SOP): Mutual Funds, PMS & AIF
## FintekPro Statutory Compliance & Audit Standards (SOP-INSTITUTIONAL-v2.0)

---

### 1. Document Control & Regulatory Mandate

* **Document Code:** `FINTEK-SOP-MF-PMS-AIF-2026-V2`
* **Applicability:** All Operations, Compliance Officers, Advisers (RIA), Distributors (ARN), Portfolio Managers, Fund Managers, and Engineering Systems within the FintekPro Platform.
* **Governing Regulatory Authorities:**
  * **Securities and Exchange Board of India (SEBI):**
    * SEBI (Mutual Funds) Regulations, 1996 & Master Circular on Mutual Funds (July 2023).
    * SEBI (Portfolio Managers) Regulations, 2020.
    * SEBI (Alternative Investment Funds) Regulations, 2012 & Amendments (2021, 2023, 2024).
    * SEBI (Investment Advisers) Regulations, 2013 (Regulation 17 Suitability & Regulation 19 Maintenance of Records).
    * SEBI (Mutual Funds) (Amendment) Regulations, 2024 (Specified Investment Funds - SIF).
  * **Reserve Bank of India (RBI):** FEMA Notification 20(R)/2017-RB (NRI/NRE/NRO Banking).
  * **Financial Intelligence Unit (FIU-IND):** Prevention of Money Laundering Act, 2002 (PMLA).
  * **Central Board of Direct Taxes (CBDT):** FATCA & Common Reporting Standards (CRS), Sec 285BA.

---

### 2. Vehicle Classification & Statutory Threshold Matrix

| Parameter | Mutual Funds (MF) | Specified Investment Funds (SIF) | Portfolio Management Services (PMS) | Alternative Investment Funds (AIF) |
| :--- | :--- | :--- | :--- | :--- |
| **Governing Regulation** | SEBI (MF) Regulations, 1996 | SEBI (MF) Amendment Regs, 2024 | SEBI (PMS) Regulations, 2020 | SEBI (AIF) Regulations, 2012 |
| **Statutory Minimum Ticket** | **₹100** (Lump sum) / **₹500** (SIP) | **₹10,00,000** (Ten Lakhs) | **₹50,00,000** (Fifty Lakhs) — *Reg 23(2)* | **₹1,00,00,000** (One Crore) — *Reg 10(c)* |
| **Special Carve-Outs** | None | None | None (Absolute floor) | ₹25 Lakhs (Angel Funds / Employees / Directors); AI Exemption |
| **Custody & Ownership Structure** | Direct AMC Folio / Pooled Unit Registry | Trustee AMC Units (`TRUSTEE_AMC_UNITS`) | **Segregated Client Demat** in client's own name (`SEGREGATED_CLIENT_DEMAT`) | Unitized Contributory Trust (`POOLED_TRUST_UNITS`) |
| **Asset Pooling Permitted?** | Yes (Unitized Scheme) | Yes (Unitized Trust) | ❌ **STRICTLY PROHIBITED** (*Reg 22(1)*) | Yes (Unitized Fund) |
| **Permitted Asset Universe** | Listed Equities, Bonds, G-Secs, Liquid, Gold/Silver ETFs | Equities, Derivatives (Long/Short), Factor ETFs, Debt, REITs | Listed Equities, Debt, REITs, InvITs, Gold Bonds | Listed/Unlisted Equities, Pre-IPO, Structured Debt, Derivatives |
| **Leverage Limits** | 0% (Borrowing only for redemption liquidity ≤ 20%) | 0% Leverage (Hedging derivative overlays only) | 0% Leverage (No borrowing for trades) | Cat I & II: **0%**; Cat III: **Max 200% gross exposure** |
| **Performance Reporting** | Daily NAV & 2-Tier TRI Benchmark | Daily/Weekly NAV & SIF Benchmark | **TWRR** net of all fees (*SEBI 2020 Circular*) | Unit NAV (Class A/B/C) & Quarterly Drawdown IRRs |
| **Lock-in Period** | None (except ELSS: 3 years) | None / Strategy-dependent | None (Liquid exit, subject to contractual exit loads) | Category I & II: **Minimum 3 Years** |

---

### 3. Step-by-Step Standard Operating Procedures (SOP)

#### Step 1: Pre-Trade Client Onboarding & Statutory KYC Gate
1. **Identity & Pan-Aadhaar Linking:**
   * Every investor must have an active PAN verified against NSDL/Income Tax Database.
   * Aadhaar-PAN linking status must be confirmed.
2. **CKYC / KRA Status:**
   * Check CKYC (Central KYC Registry) or KRA (CVL/NDML/DotEx/CAMS).
   * Status must be `VERIFIED` or `VALIDATED`. Incomplete or `UNDER_PROCESS` status blocks transaction execution.
3. **Residency & FEMA Clearance (Gate 1 & Gate 4):**
   * Classify investor: `resident_indian`, `nri`, `pio`, `oci`.
   * For NRIs: Ensure funding is via designated NRE (repatriable) or NRO (non-repatriable) bank accounts. US/Canada NRIs require AMC-specific FATCA clearance.
4. **PMLA / PEP & Sanctions Screening:**
   * Screen client against UN Security Council, FATF high-risk jurisdictions, and PEP lists.

#### Step 2: Client Risk Profiling & Statutory Suitability Enforcement
1. **Risk Profiling Questionnaire:**
   * Compute Risk Profile: `Conservative`, `Moderate`, `Aggressive`.
2. **Vehicle Suitability Gate:**
   * **Mutual Funds:** Scheme Risk-o-meter (Low to Very High) must be mapped against client risk capacity. High-risk scheme selection by a conservative investor triggers mandatory **High-Risk Suitability Warning & Client Acknowledgement**.
   * **PMS:** Minimum risk profile required is `Moderate` or `Aggressive`. Conservative clients require explicit suitability waiver before agreement execution.
   * **AIF:** Mandatory classification as a **Sophisticated / Accredited Investor**. Ultra-high risk disclosure acknowledged.

#### Step 3: Statutory Pre-Execution Disclosure & Agreement Signing
1. **Mutual Funds:**
   * Deliver Key Information Memorandum (KIM), Scheme Information Document (SID), and live Total Expense Ratio (TER) disclosure (Direct vs Regular delta).
   * Record EUIN (Employee Unique Identification Number) or obtain execution-only declaration.
2. **PMS (Regulation 22 & Schedule V):**
   * **Form C Disclosure Document:** Must be delivered to the client **at least two (2) business days prior** to agreement execution. Client must digitally acknowledge receipt.
   * **Investment Management Agreement (IMA):** Discretionary / Non-Discretionary / Advisory terms must be executed with fee schedule (Fixed + High-Watermark Performance Fee).
3. **AIF (Regulation 11):**
   * Deliver Private Placement Memorandum (PPM).
   * Verify Accredited Investor Certificate issued by a recognized Accreditation Agency (e.g., NSE/BSE/CDSL) if investing below ₹1 Crore.
   * Execute Contribution Agreement and Class Unit subscription schedule.

#### Step 4: Order Execution & Cut-off Protocol
1. **Mutual Funds:**
   * **Liquid / Overnight Funds:** Orders submitted before **13:00 IST** receive same-day NAV (subject to fund realization).
   * **Other Schemes (Debt / Equity):** Orders submitted before **15:00 IST** receive same-day NAV (subject to fund realization).
   * Post-cut-off orders are automatically queued for T+1 processing.
2. **PMS Execution:**
   * Direct execution of shares/ETFs through Upstox broker Demat API.
   * Every order must carry the client's individual segregated Demat account identifier. **No omnibus or pooled trading permitted.**
3. **AIF Execution:**
   * Capital drawdowns executed according to formal Capital Call Notices.
   * Units credited to client Demat account within statutory custody timelines.

#### Step 5: Post-Trade Record Keeping, Audit Trail & Cryptographic Sealing
1. **5-Year Mandatory Immutable Storage (SEBI IA Reg 19 / PMS Reg 22):**
   * Every advice, rationale, rebalance, and transaction must be permanently stored in `compliance_audit_trail` and `model_portfolio_transactions`.
2. **Cryptographic SHA-256 Audit Pack Generation:**
   * Every order generates a `regulatory_audit_pack` snapshot containing:
     * User identity & PAN verification status
     * Risk profile snapshot at transaction timestamp
     * Scheme/portfolio order payload
     * Platform fee & revenue configuration snapshot
     * Cryptographic SHA-256 checksum (`audit_hash`)
3. **Rebalancing & Drift Monitoring:**
   * Asset allocation monitored against defined drift bands (±5%).
   * Breaches trigger rebalancing proposals logged in the audit ledger.
   * Drawdown circuit breakers pause automated rebalancing if drawdown breaches statutory tolerance.

---

### 4. Statutory Compliance Engine Integration (FintekPro Services)

FintekPro enforces this SOP through automated programmatic compliance gates before any trade touches the broker/exchange:

1. **Mutual Funds:** [`mfComplianceService`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/mf-compliance-service.ts)
   * Enforces `SEBI-MF-MIN-TICKET`, `SEBI-MF-RISK-O-METER`, `SEBI-MF-CUTOFF-TIMING`, `SEBI-MF-EUIN-VERIFICATION`, and `SEBI-MF-NOMINEE-MANDATE`.
2. **Portfolio Management Services:** [`pmsComplianceService`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/pms-compliance-service.ts)
   * Enforces `SEBI-PMS-REG23-2` (₹50L floor), `SEBI-PMS-REG22-1` (Segregated Demat), `SEBI-PMS-SCHED-V` (Form C delivery), and TWRR performance.
3. **Alternative Investment Funds:** [`aifComplianceService`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/aif-compliance-service.ts)
   * Enforces `SEBI-AIF-REG10C` (₹1 Cr commitment), `SEBI-AIF-ACCREDITATION`, and `SEBI-AIF-REG15/20-LEVERAGE`.
4. **Transaction Compliance Gate:** [`transactionComplianceGate`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/middleware/transactionComplianceGate.ts)
   * Middleware running 8 sequential pre-flight gates before order submission.
5. **Regulatory Audit Packs:** [`complianceAuditPackService`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/compliance-audit-pack-service.ts)
   * Cryptographically seals snapshots with SHA-256 hashes for statutory inspections.

---

### 5. Audit Inspection Protocol (Checklist for Internal & SEBI Auditors)

When statutory auditors inspect FintekPro:
1. **Verify Statutory Minimums:** Check `compliance_audit_trail` to ensure zero instances of PMS orders < ₹50L or standard AIF orders < ₹1 Cr.
2. **Verify Custody Segregation:** Inspect PMS broker orders to confirm all trades pass client-specific Demat accounts without fund pooling.
3. **Verify Suitability Logs:** Query `proposals` and `regulatory_audit_packs` for signed suitability warnings whenever high-risk products were advised.
4. **Verify SHA-256 Hashes:** Recompute hashes of audit packs to confirm zero tampering of historical advice or fee disclosures.
5. **Verify Form C & PPM Delivery:** Verify timestamps of Form C disclosure delivery vs. IMA signing date (≥ 48 hours buffer).

