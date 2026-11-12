# FintekPro Multi-Regulator AI Compliance Framework (MR-AICF v1.0)

**Standard Version**: MR-AICF-1.0.0  
**Effective Date**: November 2026  
**Governing Authority**: FintekPro Legal, Regulatory & Technology Governance Council  
**Statutory Scope**: SEBI (Market Intermediaries AI Framework), RBI (Model Risk Management & DLG), DPDP Act 2023, MeitY AI Directives, FIU-IND / PMLA, IRDAI, PFRDA, and CERT-In  

---

## 1. Executive Summary & Objective

FintekPro is an institutional-grade, AI-powered wealth management and financial portal serving SEBI-registered Investment Advisers (RIAs), Research Analysts (RAs), Chartered Accountants (CAs), Mutual Fund Distributors (MFDs), and their retail/HNI clients.

Because FintekPro employs artificial intelligence, large language models (LLMs), and quantitative analytical engines to deliver real-time market insights, portfolio rebalancing, tax optimization, and asset allocation, it is subject to concurrent oversight from multiple Indian financial and technological regulatory bodies.

This framework defines the non-negotiable compliance rules, technical guardrails, and audit requirements governing AI systems across all integrated services.

---

## 2. SEBI Compliance Mandates (Securities & Capital Markets)

### 2.1 Non-Delegation of Fiduciary Responsibility
- **Statutory Liability**: Per SEBI circulars on AI/ML tools, registered intermediaries (RIAs/RAs) cannot delegate, outsource, or abdicate legal and fiduciary accountability to AI algorithms or foundation models.
- **Human-in-the-Loop (HITL)**: All portfolio rebalancing, model portfolio switches, order execution, and client fee applications require explicit, authenticated human approval (client OTP or registered RIA digital signature).
- **Prohibition of Autonomous Execution**: The AI engine is strictly a **Decision Support System (DSS)**. It possesses zero execution keys for automated brokerage routing.

### 2.2 AI Model Inventory & Categorization (SEBI AI/ML Circular)
FintekPro maintains an immutable, version-controlled **AI Model Registry** categorizing systems into three regulatory tiers:
- **Tier 1 (High Risk — Customer-Facing Advisory & Rebalancing)**: Models generating specific stock/fund recommendations, asset allocation weights, or drift rebalance orders (`APRE`, `URCAE`, `GoldenPricingEngine`). Must undergo quarterly validation, stress testing, and bias audits.
- **Tier 2 (Medium Risk — Analytical & Educational)**: Models generating market commentary, knowledge hub summaries, and product explainers.
- **Tier 3 (Low Risk — Operational & Administrative)**: OCR document parsers, KYC discrepancy detectors, and automated query routing.

### 2.3 Algorithmic Marketing & Performance Claims
- **Ban on Unverified Backtest Marketing**: Advertising simulated, backtested, or cherry-picked "AI win-rates" to retail investors is **strictly prohibited**.
- **Net-of-Fee Performance Reporting**: All performance statistics displayed must be net of advisory fees, statutory taxes (STT, GST, Stamp Duty), and brokerage slippage.
- **Mandatory Benchmark Comparison**: Model portfolio returns must always be displayed side-by-side with official SEBI total return benchmarks (e.g. NIFTY 50 TRI, NIFTY 500 TRI, CRISIL Composite Bond Index).
- **Finfluencer / Unregistered Algorithm Guardrail**: FintekPro APIs and white-label SDKs strictly prohibit partnering with unregistered algorithmic signal providers or finfluencer syndicates.

---

## 3. RBI Compliance Mandates (Banking, Lending & Payments)

### 3.1 Model Risk Management (MRM) Standards
In alignment with RBI guidelines on quantitative risk and model governance:
- **Conceptual Soundness**: Every algorithmic model must have documented theoretical foundations grounded in peer-reviewed financial economics or statutory law. Synthetic or "cooked-up" formulas are strictly barred.
- **Model Drift & Validation**: Quantitative models (Black-Litterman, Mean-Variance, Credit Scoring) must be monitored daily for:
  - **Data Drift**: Shifts in underlying macro, price, or volatility distributions.
  - **Concept Drift**: Degradation in model accuracy or predictive confidence over 30-day rolling windows.
- **Out-of-Distribution (OOD) Guardrail**: When input market conditions exceed $3.5\sigma$ historical volatility, the model must automatically downgrade confidence and alert the human investment committee.

### 3.2 Digital Lending Guidelines (DLG) & Privacy Boundary
For loan-against-securities (LAS), margin facilities, and co-branded credit integrations:
- **Device Privacy**: The platform **must never** request or access client mobile contacts, call logs, SMS text archives, or continuous device geolocation.
- **Single-Purpose Geolocation**: Geolocation access is permitted strictly once during real-time V-CIP / CKYC identity verification per RBI Master Directions.
- **Key Fact Statement (KFS)**: Before any credit transaction, an AI-generated, human-verified Key Fact Statement detailing APR, processing charges, and penal fees must be presented and acknowledged.
- **Direct Account Settlement**: All loan disbursements and repayments must flow directly between the borrower's verified bank account and the RBI-regulated entity (Bank/NBFC), bypassing intermediate escrow.

---

## 4. DPDP Act 2023 & MeitY AI Directives (Data Privacy & AI Governance)

### 4.1 Zero Raw PII in Third-Party LLM Prompts (The Privacy Firewall)
FintekPro utilizes external foundation models (Google Gemini, Groq, Cerebras, Anthropic) via API. To guarantee compliance with the Digital Personal Data Protection Act, 2023:
- **Pre-Prompt Sanitization Middleware**: Before any user query or financial payload is transmitted to an LLM provider:
  - **Aadhaar**: Redacted completely (`[REDACTED_AADHAAR]`).
  - **PAN**: Masked (`ABCDE****F`).
  - **Bank & Demat Accounts**: Tokenized or masked to last 4 digits (`[ACCT_END_1234]`).
  - **Personal Names & Addresses**: Replaced with generic tokens (`Client_A`, `Pin_XXXXXX`).
- **Zero Data Retention (ZDR)**: Commercial enterprise agreements with LLM providers must mandate Zero Data Retention and an explicit ban on utilizing FintekPro payloads for foundational model pre-training.

### 4.2 Consent Architecture & Purpose Limitation
- **Granular Consent**: Clients must provide explicit, affirmative consent specifically authorizing algorithmic processing of their transaction history for personalized advisory.
- **Right to Human Review (Automated Decision Contestability)**: Every client has the statutory right to contest an automated recommendation or risk classification and request an immediate, manual evaluation by a qualified human RIA/CA.
- **Balancing DPDP Erasure with SEBI/PMLA Retention**:
  - When a client exercises the "Right to Erasure" under DPDP Section 12:
    - User profile data, marketing cookies, and optional behavioral preferences are permanently erased.
    - Transaction records, statutory KYC packs, advisory logs, and audit trails are cryptographically quarantined and preserved for the mandatory **7-year statutory period** per SEBI (IA) Regulations and PMLA 2002.

### 4.3 MeitY AI Advisory & Watermarking
- **Visible AI Disclosure**: Every screen, PDF report, or client presentation containing algorithmic insights must display the standardized badge:
  ```
  🤖 AI-Assisted Advisory • Decision Support System Only • Subject to Human Advisor Oversight
  ```
- **Metadata Watermarking**: AI-generated documents must embed cryptographic metadata indicating the `model_id`, `version`, `prompt_hash`, and generation timestamp.

---

## 5. FIU-IND & PMLA Compliance (Anti-Money Laundering & Terrorist Financing)

### 5.1 Automated AML & Anomaly Detection
- **Deterministic Rules + AI Screening**: AI monitors transactions for structured deposits, rapid turnover without economic rationale, and cross-border flow anomalies.
- **Human Compliance Officer Sign-Off**: The AI **never autonomously files** regulatory reports. All detected anomalies are routed to the Principal Officer / Designated Director, who conducts independent due diligence before filing Suspicious Transaction Reports (STRs) or Cash Transaction Reports (CTRs) with FIU-IND.
- **Sanctions & PEP Screening**: Daily automated screening of investor rosters against:
  - Ministry of Home Affairs (MHA) UAPA Sanctions List.
  - United Nations Security Council (UNSC) Consolidated List.
  - Global Politically Exposed Persons (PEP) registry.

---

## 6. Income Tax Department & CBDT Compliance Mandates (Direct Taxes & Capital Gains)

### 6.1 Canonical Tax Formula Governance (Income Tax Act 1961)
- **Zero Synthetic Tax Math**: All capital gains (STCG/LTCG), surcharge, health & education cess (4%), indexation, and Section 111A/112/112A calculations MUST adhere strictly to the Income Tax Act 1961 as amended by the applicable Finance Act.
- **FY / AY Precision**: Every tax optimization insight, harvest recommendation, or advance tax forecast MUST explicitly declare both Financial Year (FY) and Assessment Year (AY).
- **Grandfathering Mandate**: LTCG on listed equities acquired before 31 January 2018 must strictly implement Section 55(2)(ac) Fair Market Value (FMV) grandfathering rules.
- **TCS / TDS Enforcement**: Outward remittances under Liberalised Remittance Scheme (LRS) must reflect exact Section 206C(1G) TCS tiers (5% / 20%) and track the statutory ₹7,00,000 threshold.

### 6.2 Tax Advisory Segregation & CA Certification
- **Informational Classification**: AI-generated tax calculations, harvesting scenarios, and ITR schedules are strictly classified as **Computational Decision Support**.
- **Mandatory Human CA / Tax Professional Sign-Off**: Filing of ITR, Advance Tax challan generation, or submission of rectification requests requires explicit validation by the client or their empaneled Chartered Accountant (CA).
- **Audit Defense Pack**: For any tax loss harvesting or portfolio restructuring advice, the system generates an immutable tax justification sheet exposing original purchase dates, holding periods, grandfathered cost bases, and realized gain breakdown for Income Tax scrutiny.

---

## 7. AMFI & Mutual Fund Distribution Compliance Mandates

### 7.1 SEBI & AMFI Code of Conduct for Intermediaries
- **ARN / EUIN Validation**: Every mutual fund recommendation or transaction route must validate active AMFI Registration Number (ARN) and Employee Unique Identification Number (EUIN).
- **Risk-o-Meter Suitability Alignment**: AI must never recommend a mutual fund scheme whose SEBI Risk-o-Meter rating exceeds the client's documented risk tolerance tier.
- **SEBI Cut-Off Timing Enforcement**: Transaction advice must reflect official cut-off timings (13:00 IST for liquid/overnight funds; 15:00 IST for other equity/debt funds) and NAV realization rules.

### 7.2 Regular vs. Direct Plan Segregation (SEBI IA Reg 22)
- **Advisory Client Protection**: Clients enrolled under fee-based Advisory agreements (RIA) MUST NEVER be recommended or routed to commission-earning Regular Plans. AI strictly enforces Direct Plan routing.
- **Distributor Pre-Sale TER Disclosure**: When operating in distribution mode (MFD), the system mandates a side-by-side disclosure of Total Expense Ratio (TER) differentials and estimated trail commissions prior to client authorization.

---

## 8. IRDAI & PFRDA AI Advisory Standards

### 8.1 Insurance Advisory (IRDAI)
- **Zero Automated Rejections**: AI engines may assist in insurance policy suitability comparisons (term, health, motor) but must **never** execute an automated claim denial or policy cancellation.
- **Non-Discrimination**: Underwriting support algorithms are strictly audited to eliminate discrimination based on gender, caste, genetic predisposition, or disability.
- **Need Analysis & Free-Look Notice**: All life/health insurance recommendations must include a documented Need Analysis and highlight the statutory 30-day Free-Look cancellation right.

### 8.2 Pension Advisory (PFRDA)
- **NPS Suitability**: Guidance on National Pension System (NPS) Tier I & Tier II schemes must strictly adhere to PFRDA age-linked asset allocation schedules (Auto Choice Aggressive LC-75, Moderate LC-50, Conservative LC-25).
- **Equity Allocation Ceiling**: AI algorithms are hard-locked against proposing equity (Asset Class E) exposure exceeding statutory caps (75% up to age 35, tapering annually).

---

## 9. CERT-In & Cybersecurity Standards (CSCRF)

### 9.1 Official IST Time Synchronization (NTP Mandate)
- All FintekPro servers, microservices, and AI inference runtimes must synchronize their system clocks with the **National Physical Laboratory (NPL)** or **National Informatics Centre (NIC)** NTP servers within $\pm 50\text{ ms}$.
- Ensures legally defensible, millisecond-accurate timestamps on all SEBI/RBI audit logs.

### 9.2 6-Hour Cyber Incident Reporting
- Any confirmed cyber incident, unauthorized API breach, credential leak, or algorithmic manipulation must be reported to the **Indian Computer Emergency Response Team (CERT-In)** within **6 hours** of detection per CERT-In Cyber Security Directions.
- Immutable WORM audit trails and distributed security logs must be maintained for 5 years per CERT-In requirements.

---

## 10. Active Redis Infrastructure Governance & Multi-Pod Audit Invariants

With **Google Cloud Memorystore for Redis ACTIVATED and LIVE** in production (FP-INFRA-POL-2026-01):
1. **Tier 1 Distributed In-Memory Acceleration**:
   - High-throughput Redis cluster accelerates AI rationale lookups (`ai:rationale:*`), prompt deduplication caches (`ai_response:*`), real-time market regimes (`market:regime`), and distributed rate limiting (`ratelimit:ai:*`).
   - Ensures AI response latencies remain $< 150\text{ ms}$ for cached inferences and prevents duplicate LLM token charges.
2. **Statutory Non-Volatility Invariant (Audit Primacy)**:
   - Redis is an operational acceleration tier, **NOT** the statutory audit store.
   - Per SEBI, RBI, and PMLA rules requiring permanent non-repudiation, all final AI advisory outputs, explainability trees, client risk confirmations, and advisor approvals MUST be committed to Cloud SQL PostgreSQL (`ai_advisory_outputs`, `portfolio_ai_decisions`, `regulatory_audit_packs`).
3. **Resilient Zero-Downtime Fallback**:
   - If Redis becomes unreachable or times out ($> 150\text{ ms}$), the system triggers the circuit-breaker and seamlessly falls back to in-memory LRU and Cloud SQL without interrupting client advisory flows or breaching regulatory uptime SLAs.

---

## 11. Multi-Regulator Inter-Agency Conflict Matrix

When regulatory requirements diverge across integrated asset classes, the following statutory hierarchy governs:

| Regulatory Area | Primary Authority | Secondary Authority | FintekPro Enforcement Rule |
| :--- | :--- | :--- | :--- |
| **Audit Log Retention** | SEBI (7 Years) | PMLA (5 Years) / DPDP (Erasure) | Retain immutable WORM logs for **7 Years**; redact marketing PII only. |
| **Client Risk Profiling** | SEBI Reg 17 (365 Days) | RBI Credit Scoring | Mandatory annual recertification; hard block on day 366. |
| **Derivatives / F&O Access** | SEBI Derivatives Framework | Exchange Bylaws (NSE/BSE) | 9-Gate compliance check; limit to Aggressive profiles only. |
| **Outbound Remittance** | RBI FEMA / LRS | Income Tax (TCS 20%) | Strictly block offshore CFDs/Margin; track $250k annual LRS cap. |
| **Direct vs. Regular Plans** | SEBI IA Reg 22 | AMFI MFD Code | Fee-based advisory = 100% Direct Plans only. Zero commission bias. |
| **AI Output Verification** | SEBI AI/ML Circular | MeitY AI Advisory | Standard explainability layer + Human RIA approval before execution. |

---

## 12. Statutory Audit Evidence & WORM Packaging Protocol

To guarantee immediate compliance during SEBI, RBI, or Income Tax regulatory inspections:
1. **Cryptographic Sealing**: Every advisory interaction generates a `regulatory_audit_pack` sealed with SHA-256 HMAC incorporating the input snapshot, model version, canonical formula citations, and human approval signature.
2. **One-Click Regulatory Inspection Export**: Authorized compliance officers can export a complete, tamper-evident audit dossier (CSV/JSON/PDF) for any client or transaction covering the mandatory 7-year inspection window.
3. **Daily Automated Compliance Health Checks**: Continuous integration test suites run automated verification across all 9 regulatory dimensions (SEBI, RBI, CBDT, DPDP, MeitY, FIU-IND, IRDAI, PFRDA, CERT-In), alerting compliance officers within 60 seconds of any policy drift.

---

## 9. Governance Oversight & Emergency Kill-Switch SOP

### 9.1 Algorithmic Kill-Switch
FintekPro maintains an administrative, hardware-backed **Global AI Kill-Switch**:
- **Triggers**: Suspected data corruption, upstream licensed feed outage, regulatory directive, or algorithmic hallucination.
- **Effect**: Instantly disables all customer-facing AI recommendations, freezes model portfolio rebalancing proposals, and reverts the portal to basic, human-managed deterministic operations within $< 100\text{ ms}$.

### 9.2 Quarterly Compliance Audit Cadence
- **Month 1**: AI Model Inventory reconciliation & drift assessment.
- **Month 2**: Third-party LLM privacy & PII de-identification penetration testing.
- **Month 3**: Independent RIA/CA advisory sample review & SEBI audit pack certification.

---

*Approved by the FintekPro Legal, Regulatory & Technology Governance Council*  
*Document Ref: FINTEKPRO-MR-AICF-2026-V1*

