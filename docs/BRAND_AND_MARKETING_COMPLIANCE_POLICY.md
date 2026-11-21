# FintekPro Brand, Trademark & Marketing Compliance Policy
# BRAND-POLICY v1.0 | Effective: 2026-11-20
# Authority: Legal & Regulatory Compliance Council
# Scope: All Engineers, Contributors, CI/CD Pipelines, and AI Agents

---

## 1. Statutory Context & Legal Foundations

FintekPro operates as an institutional financial platform in India subject to:
1. **SEBI (Investment Advisers) Regulations, 2013 & SEBI Advertising Master Circulars (2023)**:
   - Prohibits deceptive, misleading, exaggerated, or unsubstantiated claims.
   - Forbids comparative claims suggesting unauthorized affiliations or parity with proprietary third-party institutions.
2. **Trade Marks Act, 1999 (Sections 29 & 135)**:
   - Prohibits trademark infringement, passing off, and trademark dilution by using competitor or third-party registered trademarks to market services.
3. **Consumer Protection Act, 2019 (Section 2(28))**:
   - Classifies false descriptions or misleading endorsements as punishable offenses.

---

## 2. Forbidden Trademark & Claim Invariants (Zero-Tolerance)

The following words and phrases are **STRICTLY PROHIBITED** from appearing as product names, badges, marketing headlines, buttons, or meta tags:

| Prohibited Term / Phrase | Legal Hazard | Approved Compliant Alternative |
| :--- | :--- | :--- |
| `Bloomberg Terminal for Indian Investors` | Trademark Infringement & Passing Off | `Wall Street Analytics, Built for Indian Investors` |
| `Indian Bloomberg` / `Bloomberg of India` | Trademark Dilution & False Equivalency | `Institutional-Grade Terminal for Indian Investors` |
| `Reuters Eikon / Terminal for India` | Third-Party Trademark Appropriation | `Institutional Research & Analytics Cockpit` |
| `FactSet for Indian Investors` | Third-Party Trademark Appropriation | `Multi-Asset Research & Decision Terminal` |
| `Robinhood of India` | Trademark Infringement | `Modern Commission-Free Investing Platform` |
| `Guaranteed X% Returns` | SEBI Advertising Violation | `Illustrative Target Returns (Subject to Market Risk)` |
| `Zero-Risk Profit / Risk-Free Alpha` | Misleading Financial Representation | Standard risk-return profile with mandatory SEBI disclosures |

---

## 3. Permitted Nominative Fair Use

Mentioning third-party institutional names (e.g. *Bloomberg*, *Reuters*, *JP Morgan*, *MSCI*, *CRISIL*) is permitted **only when all three conditions are satisfied**:
1. **Factual Attribution**: Purely identifying the source of an external data index or news report (e.g., *"JP Morgan GBI-EM Index"* or *"MSCI India Domestic Index"*).
2. **No Commercial Equivalency**: The name is never used in hero badges, pricing plan names, slogans, or product names.
3. **Trademark Ownership Attribution**: If prominent, include standard attribution:
   `[Brand]® is a registered trademark of [Owner]. FintekPro is not affiliated with, endorsed by, or sponsored by [Owner].`

---

## 4. Automated Enforcement Mandate

Every PR, code generator, and build process must verify that no prohibited trademark terms exist in user-facing UI components (`client/src/pages/`, `client/src/components/`).
Automated tests in `server/tests/marketing-and-brand-compliance.test.ts` continuously validate that client pages remain 100% compliant.
Violations must be rejected immediately with reference to this policy.
