# FintekPro Standard Operating Policy: Alternative Investment Funds Desk (SOP-AIF v1.0)

**Document Code**: SOP-AIF-2026-03  
**Effective Date**: October 2026  
**Governing Regulations**: SEBI (Alternative Investment Funds) Regulations, 2012 (Regulation 10(c)); SEBI Master Circular for AIFs (July 2023); SEBI Accredited Investor Framework  
**Execution Desk**: Multi-Asset Orchestration Desk & Trust Escrow Custody  

---

## 1. Statutory Mandate & Scope

This Operating Policy governs all Ultra High Net Worth Individual (UHNI), Family Office, and Institutional Private Market allocations on the FintekPro platform covering **SEBI Category I, Category II, and Category III Alternative Investment Funds (AIFs)**.

AIFs are structured as **privately pooled investment trusts or Limited Liability Partnerships (LLPs)** managed by an Investment Manager and overseen by an independent SEBI-registered Trustee. Investors hold **beneficial trust units** representing pro-rata participation in private equity, unlisted tech, venture debt, private credit, and pre-IPO instruments.

---

## 2. Statutory Minimum Ticket Sizes & Accreditation (SEBI Reg 10(c))

1. **Mandatory ₹1 Crore Minimum Commitment**:
   - For regular UHNI and Corporate investors, the minimum capital commitment to a Category I or Category II AIF is strictly **₹1,00,00,000 (Rupees One Crore)**.
   - For Angel Funds under Category I, the statutory ticket size is minimum **₹25,00,000 (Rupees Twenty-Five Lakhs)**.
   - Employees or directors of the Investment Manager are permitted a statutory concession of ₹25 Lakhs.
2. **Accredited Investor (AI) Certification Protocol**:
   - Investors participating with lower ticket flexibilities or bespoke terms under SEBI's Accredited Investor regime must present an authentic **Accreditation Certificate** issued by an authorized Accreditation Agency (KRA/Depositories).
   - **Eligibility Criteria**:
     - *Individuals*: Annual income $\ge ₹2 \text{ Crore}$, OR Liquid Net Worth $\ge ₹7.5 \text{ Crore}$ (with at least ₹3.75 Cr in financial assets).
     - *Corporates / LLPs*: Net worth $\ge ₹50 \text{ Crore}$.
   - All AI certificates are verified and logged in the platform compliance vault prior to onboarding.

---

## 3. Capital Commitment, Drawdowns & Default Policy

1. **Commitment vs. Drawdown Accounting**:
   - Unlike mutual funds where the entire amount is debited on Day 1, AIF investments are structured as **Commitment Agreements**.
   - Capital is called in tranches (Drawdowns) as the Investment Manager identifies target portfolio company investments over the fund's 2–3 year investment period.
2. **Drawdown Notice Operations**:
   - Drawdown notices must provide a minimum **15 business days' notice period** with detailed capital deployment context and wire instructions to the Fund’s designated Escrow Account.
3. **Defaulting Investor Protocol**:
   - If a client fails to honor a drawdown notice within the stipulated window, the platform initiates a formal default curing notice. Failure to cure triggers contractual remedies under the Private Placement Memorandum (PPM), including suspension of voting rights, penalty interest (typically 18% p.a.), and forfeiture/compulsory transfer of existing units.

---

## 4. Valuation Norms & Distribution Waterfall

1. **Independent IBBI Valuation**:
   - Category I and II AIFs hold illiquid, unlisted securities. Valuations must be conducted at least **semi-annually or quarterly** by an independent Registered Valuer registered with the Insolvency and Bankruptcy Board of India (IBBI).
2. **Distribution Waterfall Hierarchy**:
   - Cash realizations from liquidity events (pre-IPO listings, buybacks, debt coupon repayments) must be distributed through the statutory 4-tier waterfall:
     1. **Return of Capital**: 100% of proceeds go to investors until cumulative capital contributed is fully returned.
     2. **Preferred Return (Hurdle Rate)**: 100% of proceeds go to investors until they receive their preferred return (typically 8% to 10% IRR compounded annually).
     3. **Catch-up**: Investment Manager receives a catch-up tranche per the PPM terms.
     4. **Carried Interest Split**: Remaining surplus is split (typically 80% to investors, 20% carried interest to the Investment Manager).

---

## 5. Lock-in Periods & Secondary Unit Transfers

1. **Tenure & Lock-in Enforcement**:
   - Category I and II AIFs are strictly closed-ended with a statutory tenure of **3 to 7 years** (extendable by up to 2 years with approval of two-thirds of investors by value).
   - Early redemptions are strictly prohibited during the fund lifecycle.
2. **Secondary Transfers & Demat Units**:
   - Unit transfers to third parties are permitted only with the written consent of the Investment Manager and subject to the transferee meeting the ₹1 Crore minimum / Accredited Investor eligibility threshold.

---

## 6. Codebase Enforcement Architecture

- **Tier Validator**: [`model-portfolio-tier-service.ts`](file:///Users/sangrammohanty/Documents/GitHub/FintekPro/server/services/model-portfolio-tier-service.ts) (`portfolioTier: "uhni_aif"`, `statutoryMinInvestment: "10000000"`, `accreditationRequired: true`).
- **Accreditation Gate**: Verified through `validateInvestmentTierCompliance()`.
- **Institutional Custody**: `custodyStructure: "POOLED_TRUST_UNITS"`.

---

*FintekPro Legal & Regulatory Council*  
*Standard Operating Policy — AIF Desk*

