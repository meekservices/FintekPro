# FintekPro Financial Product Distribution Policy (FDP v1.0)

**Standard Version**: FDP-1.0.0  
**Effective Date**: November 2026  
**Governing Authorities**: SEBI (Mutual Funds Regs, IA Reg 22, OBPP Framework), AMFI (Code of Conduct), IRDAI (Insurance Intermediary Regulations), PFRDA (NPS PoP Rules), and RBI (Lending Service Provider / DSA Guidelines)  
**Applicability**: Distribution Partners, Sub-Brokers, Relationship Managers (RMs), Agents, Partner Engineering Desk, Compliance Officers  

---

## 1. Executive Summary & Statutory Distinction

FintekPro operates a unified financial services infrastructure that supports both **Fiduciary Investment Advisory (RIA)** and **Commercial Product Distribution (Intermediary / Partner Desk)**.

Under Indian financial laws, **Advisory and Distribution are legally separate activities governed by mutually exclusive statutory standards**:

| Parameter | Advisory Desk (SEBI RIA) | Distribution Desk (MFD / Broker / Corporate Partner) |
| :--- | :--- | :--- |
| **Legal Role** | Fiduciary (Agent of the Client) | Intermediary / Distributor (Agent of the Manufacturer) |
| **Product Universe** | **Direct Plans** / Institutional Classes ONLY | **Regular Plans** / Commercial Partner Products |
| **Revenue Model** | Client-Billed Advisory Fee ONLY | Manufacturer Payout / Trail Commission ONLY |
| **Statutory Prohibitions** | Strictly barred from receiving commissions, brokerages, or volume incentives | Strictly barred from holding out as a "SEBI Registered Investment Adviser" |
| **Regulatory Benchmark** | SEBI (Investment Advisers) Regulations, 2013 | SEBI (MF) Regs 1996, AMFI Code of Conduct, IRDAI, OBPP, RBI |

This Policy defines the rules governing product distribution, partner hierarchies, commission transparency, and statutory segregation from the advisory desk.

---

## 2. SEBI Regulation 22: Segregation of Advisory & Distribution

In strict compliance with **Regulation 22 of the SEBI (Investment Advisers) Regulations, 2013**, FintekPro enforces client-level and operational segregation:

### 2.1 The "Client & Family" Segregation Rule
1. **Advisory Client Prohibition**: If an investor (or any member of their immediate family: spouse, dependent children, dependent parents) is enrolled as an **Advisory Client** under FintekPro's RIA registration:
   - The platform, its partner agents, and affiliated corporate entities are **strictly prohibited from offering, recommending, or executing commission-earning regular products** to that client or their family.
   - All transactions for advisory clients must route strictly to **Direct Plans** with zero distributor commission.
2. **Distribution Client Mode**:
   - Clients onboarding under the **Distribution Partner Portal** execute transactions in Regular Plans or partner products.
   - The portal must display an explicit statutory disclosure:
     ```
     "FintekPro operates as a licensed distributor of financial products earning commissions from AMCs, insurers, and issuers. Services rendered under this portal do not constitute SEBI-registered fee-based investment advice."
     ```

### 2.2 Operational Chinese Wall
- **Staff Segregation**: Advisory personnel and research analysts must operate separately from distribution sales managers, RMs, and partner network coordinators.
- **System Isolation**: Advisory fee ledgers and distributor commission databases (`partner_commissions`, `distribution_ledgers`) are physically isolated and audited quarterly.

---

## 3. Commission Governance & Pre-Trade Disclosures

### 3.1 100% Trail-Only Payout Model (SEBI & AMFI Mandate)
- **Zero Upfront Commissions**: In accordance with SEBI circulars, all mutual fund, PMS, and AIF distribution payouts must follow an unbundled, **100% trail-based commission model**.
- **No Volume Contests or In-Kind Kickbacks**: The platform strictly prohibits organizing or participating in asset-gathering contests, foreign trips, or gift incentives funded by AMCs or product issuers.

### 3.2 Mandatory Commission & TER Pre-Execution Disclosure
Under SEBI Circular `SEBI/HO/IMD/DF2/CIR/P/2018/137`, before an investor confirms an order for any Regular Plan:
1. **Side-by-Side TER Comparison**: The screen must display:
   - Total Expense Ratio (TER) of the **Regular Plan**.
   - Total Expense Ratio (TER) of the corresponding **Direct Plan**.
   - The exact TER delta (e.g. `0.75% p.a.`) representing the annual distribution cost.
2. **Estimated Distributor Payout**: Display the estimated annualized trail commission earned by the distributor/partner on the proposed transaction amount.

### 3.3 Strict Ban on Rebating / Kickbacks
- Under Clause 3 of the **AMFI Code of Conduct**, distributors and partner agents are **strictly forbidden from rebating, discounting, or passing back** any portion of their commission to the investor, directly or indirectly. Any agent discovered rebating will face immediate contract termination and AMFI de-registration referral.

---

## 4. Multi-Product Distribution Framework

### 4.1 Mutual Funds Distribution (AMFI & SEBI)
- **ARN & EUIN Mandate**: Every mutual fund transaction must be tagged with a valid, active AMFI Registration Number (ARN) and Employee Unique Identification Number (EUIN).
- **Execution-Only Platforms (EOP)**: Digital order routing must conform to SEBI Circular 2023/86:
  - Category 1 EOP (transacting as agent of AMCs; flat fee billed to AMC).
  - Category 2 EOP (transacting as stock broker on exchange platforms).

### 4.2 Insurance Product Distribution (IRDAI)
- **Need-Based Suitability**: Distribution agents must document an objective Need Analysis (human life value, health coverage gap) prior to proposing term or health insurance policies.
- **Prohibition on Churning & Mis-Selling**: Persuading an investor to surrender or lapse an existing life policy to purchase a new policy for fresh upfront commission is strictly prohibited.
- **30-Day Free-Look Period**: The platform must assist investors in exercising their statutory 30-day free-look cancellation rights without friction.

### 4.3 Fixed Income & Corporate Bonds (SEBI OBPP Framework)
- **Listed Debt Only**: In compliance with the SEBI Online Bond Platform Providers (OBPP) regulations, public digital distribution is restricted strictly to **listed debt securities**. Unlisted private placements cannot be distributed to retail investors on the portal.
- **Price Transparency**: Quotes must clearly distinguish between **Clean Price, Accrued Interest, Dirty Price**, and **Yield-to-Maturity (YTM)**.
- **Settlement via Clearing Corporation**: All bond transactions must settle through the clearing corporation of the stock exchange (ICCL / NSCCL).

### 4.4 Corporate Fixed Deposits (RBI & MCA)
- **Statutory Disclosures**: Must display the credit rating from a SEBI-registered rating agency (CRISIL, ICRA, CARE) and state clearly that corporate FDs are **unsecured deposits not covered by DICGC insurance** (which protects scheduled commercial bank deposits up to ₹5 Lakhs).

### 4.5 National Pension System (PFRDA PoP Desk)
- **Point of Presence (PoP) Rules**: PFRDA-approved onboarding and contribution collection adhering strictly to the statutory transaction charge schedule.

### 4.6 Digital Lending Facilitation (RBI LSP / DSA)
- **Sourcing Transparency**: Platform must identify the lending Bank/NBFC, present the Key Fact Statement (KFS), and disclose the exact sourcing fee earned.

---

## 5. AI Guardrails in Product Distribution (Zero Commission Bias)

When client interactions, search queries, or catalog browsing occur under the Distribution portal:

1. **Role Identification**: The AI assistant must explicitly declare its commercial distribution role:
   ```
   "I am presenting product options available through FintekPro's distribution desk. Commissions are earned on distributed regular products. For fee-only fiduciary advice, please switch to the Advisory Desk."
   ```
2. **Zero Commission-Bias Sorting**:
   - The algorithmic sorting, filtering, and comparison engines **MUST NEVER rank or recommend products based on higher commission payout to FintekPro or its partners**.
   - Rankings must be strictly deterministic, driven by objective criteria: historical rolling returns, category benchmark alpha, expense ratio efficiency, portfolio credit rating, and liquidity.
3. **Transparent Alternatives**:
   - When presenting any regular product, the AI must highlight that a Direct Plan alternative exists with lower expense overheads.

---

## 6. Partner, Agent & Sub-Broker Hierarchy Governance

1. **KYC & Licensing Verification**:
   - All Distribution Partners, sub-brokers, and authorized agents must submit valid NISM-Series-V-A certification, active ARN cards, PAN, and bank accounts prior to portal activation.
   - Platform automates monthly verification of ARN validity against the AMFI central database. Any expired or suspended ARN instantly blocks transaction routing.
2. **Clawback & Exit Loads**:
   - If an investor redeems a mutual fund holding within the AMC clawback window (typically 12 months for equity schemes), the unearned commission is automatically debited from the partner's monthly payout ledger.
3. **Mis-Selling Escalation Protocol**:
   - Customer complaints regarding mis-selling, unauthorized transaction initiation, or misleading return claims trigger an immediate investigation by the FintekPro Compliance Council. Sub-brokers found guilty are terminated, reported to AMFI, and their outstanding payouts frozen.

---

*Approved by the FintekPro Legal, Regulatory & Technology Governance Council*  
*Standard Operating Document: FINTEK-DOCS-DIST-POLICY-2026-V1*

