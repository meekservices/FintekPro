# FintekPro Standard Operating Procedure: Executive C-Suite Sub-Agents Governance (SOP-CSUITE-SUBAGENTS-v1.0)

**Document Reference:** `FP-SOP-AI-EXEC-001`  
**Governing Framework:** FASP-AI v1.0 & GCR v1.0 (FintekPro Global Coding Rules)  
**Effective Date:** 2026-11-24  
**Target Roles:** COO, CFO, CBO, CCO, CTO & Iris Autonomous Copilot Sub-Agents  
**Audit Classification:** Mandatory SEBI/RBI Regulatory Compliance Document  

---

## 1. System Objective & Governance Mandate

This Standard Operating Procedure (SOP) defines the operational boundaries, autonomous monitoring thresholds, Maker-Checker approval matrices, and escalation protocols for the **5 Specialized Executive AI Copilot Sub-Agents**:
1. **`Iris-COO`** — Chief Operating Officer (Operations & Settlement Sentinel)
2. **`Iris-CFO`** — Chief Financial Officer (Treasury, Liquidity & Cost Sentinel)
3. **`Iris-CBO`** — Chief Business Officer (Marketplaces, Growth & MCA Deal Sentinel)
4. **`Iris-CCO`** — Chief Compliance Officer (Regulatory & Surveillance Sentinel)
5. **`Iris-CTO`** — Chief Technology Officer (Platform Telemetry & Auto-Healing Sentinel)

### 1.1 Fundamental Non-Negotiable Principle: Decision Support System (DSS)
Under **FASP-AI v1.0 Section 14–15**, each executive sub-agent is classified strictly as a **Decision Support System (DSS)**.
- **PROHIBITED:** Autonomous execution of client trade orders, capital disbursements, tax filings, or permanent credential/account revokation.
- **MANDATORY:** Every critical operational action drafted by a sub-agent requires explicit **1-Click Human Officer Confirmation** or dual-officer Maker-Checker approval before mutation.

---

## 2. Executive Sub-Agent Operational Boundary Matrix

| Sub-Agent | Continuous Autonomous Scope (No Human Required) | Action Draft Scope (Requires 1-Click C-Suite Confirmation) | Prohibited Scope (Hard Block) |
| :--- | :--- | :--- | :--- |
| **`Iris-COO`** | • Telemetry tracking of KYC processing times<br>• T+1 trade execution reconciliation against exchange feeds<br>• Maker-Checker document SLA aging audits | • Reallocating verification queues across operational tiers<br>• Drafting trade settlement break notices to custodians<br>• Flagging physical KYC verification exceptions | • Direct modification of client KYC identity data<br>• Autonomous rejection of verified PAN/Aadhaar records<br>• Manual trade injection |
| **`Iris-CFO`** | • Multi-broker clearing account cash balance monitoring<br>• Partner commission accrual calculations<br>• Cloud and LLM token usage cost burn projections | • Triggering batched distributor payout runs<br>• Flagging account margin calls to designated clearing brokers<br>• Approving cloud auto-scaling budget thresholds | • Direct disbursement of corporate bank funds<br>• Modification of approved partner commission split rates<br>• Off-book financial journal adjustments |
| **`Iris-CBO`** | • Secondary marketplace GTV velocity tracking<br>• MCA filings radar for HNI corporate liquidity events<br>• Partner network conversion funnel analysis | • Routing qualified corporate mandates to relationship desks<br>• Publishing approved institutional deal syndication alerts<br>• Adjusting priority tiers for high-performing distribution networks | • Unilateral alteration of unlisted equity share valuations<br>• Deterministic guarantees of post-IPO listing gains<br>• Bypassing accredited investor verification |
| **`Iris-CCO`** | • Daily SEBI, RBI, AMFI circular impact scanning<br>• True-to-label mutual fund portfolio drift surveillance<br>• RIA/CA advisory license validity monitoring | • Initiating formal compliance audit packs for SEBI inspection<br>• Freezing suspect partner accounts pending Maker-Checker review<br>• Dispatching statutory filing reminder dockets | • Unilateral suppression of suspicious transaction reports (STR)<br>• Overriding statutory anti-money laundering (PMLA) blocks<br>• Modifying historical compliance audit logs |
| **`Iris-CTO`** | • Continuous synthetic tick latency monitoring (<500ms)<br>• Error ledger deduplication and circuit-breaker auto-healing<br>• Database connection pool & cache hit-rate telemetry | • Triggering off-peak database migration rollouts<br>• Archiving degraded circuit-breaker error logs<br>• Promoting canary container revisions to active traffic | • Bypassing pre-commit or pre-deploy quality gates<br>• Live production database DROPs or schema destructions<br>• Hardcoding API keys or secrets into repo code |

---

## 3. Standard Operating Procedures (SOPs) Per Desk

### 3.1 SOP-COO-01: KYC Velocity Bottleneck & Exception Resolution
1. **Detection:** When median Smart KYC processing time exceeds `15.0 minutes` or pending exception queue exceeds `25 documents`:
2. **Iris-COO Action:**
   - Synthesizes bottleneck causes (e.g. Digilocker timeout, OCR low-confidence score).
   - Generates an `ActionDraft` with priority `HIGH`.
   - Surfaces proposed route to `/admin/kyc-v2-management`.
3. **Human Officer Action:**
   - COO reviews explainability factors (e.g. OCR blur rate, API provider latency).
   - Confirms re-allocation of manual review staff via 1-click approval.

### 3.2 SOP-CFO-01: Multi-Broker Liquidity & Payout Batching
1. **Detection:** When multi-broker clearing account buffer drops below `₹10,00,000` or accumulated commission liability exceeds payout threshold:
2. **Iris-CFO Action:**
   - Reconciles earnings across Upstox, Alpaca, and unlisted dealer partners.
   - Calculates exact GST split and net payable amounts using canonical math.
   - Drafts `ActionDraft` with categorized amounts and beneficiary hashes.
3. **Human Officer Action:**
   - CFO/Finance Controller confirms batch authorization via 1-click token.
   - Payment batch transmitted to banking gateway with cryptographic audit signature.

### 3.3 SOP-CBO-01: MCA Liquidity Event & Institutional Syndication
1. **Detection:** MCA Intelligence Sentinel detects new corporate filing (e.g. director change, capital raise, ESOP buyback):
2. **Iris-CBO Action:**
   - Cross-references company against unlisted equity directory.
   - Computes HNI relationship affinity score.
   - Drafts prioritized syndication docket in `/admin/mca-intelligence`.
3. **Human Officer Action:**
   - CBO verifies institutional investor suitability tier.
   - Approves deal distribution to accredited wealth managers.

### 3.4 SOP-CCO-01: True-to-Label & Regulatory Drift Audit
1. **Detection:** Continuous portfolio analyzer detects asset allocation mismatch exceeding SEBI categorization norms (e.g. Large Cap fund holding >20% Mid Cap):
2. **Iris-CCO Action:**
   - Tags specific ISINs causing category drift.
   - Calculates drift magnitude and potential regulatory infraction code.
   - Emits structured alert to `/admin/sebi-mf-compliance`.
3. **Human Officer Action:**
   - CCO reviews fund house disclosures and risk attribution breakdown.
   - Confirms advisory alert to impacted client portfolios.

### 3.5 SOP-CTO-01: Telemetry Spike Mitigation & Auto-Healing Sentinel
1. **Detection:** Error tracking service detects persistent sidecar outage (e.g. Python sidecar degraded) or AI provider rate limit:
2. **Iris-CTO Action:**
   - Suppresses duplicate error ledger ingestion (2-minute deduplication window).
   - Engages circuit breaker to secondary provider fallback.
   - Auto-resolves resolved incidents upon telemetry recovery.
   - Emits health digest to CTO Command Desk.
3. **Human Officer Action:**
   - CTO reviews auto-heal timeline in `/admin/activity-centre`.
   - Confirms telemetry archive via 1-click audit sign-off.

---

## 4. Immutable Audit Trail & Regulatory Forensics Contract

Every autonomous audit run and every human approval action MUST write an immutable record to `admin_ai_audit_logs`:

```json
{
  "agent_type": "iris_coo_agent",
  "agent_action": "autonomous_deep_audit",
  "user_id": "admin_uuid",
  "entity_type": "executive_desk",
  "entity_id": "coo_audit_1732462800000",
  "confidence_score": 0.98,
  "model_version": "Iris Core v3.0 / gemini-2.5-flash",
  "input_context": { "role": "coo", "triggered_by": "admin" },
  "output_summary": "Deep forensic audit completed across 14 operational layers. 0 critical exceptions.",
  "approval_status": "approved",
  "approving_admin": "sangram.m",
  "status": "success",
  "timestamp": "2026-11-24T20:45:00.000Z"
}
```

### 4.1 Non-Repudiation Norms
- The `admin_ai_audit_logs` table is strictly **INSERT-ONLY**. `UPDATE` and `DELETE` queries are prohibited by database security triggers.
- Logs must be preserved for a minimum of **8 years** in accordance with SEBI (Investment Advisers) Regulations, 2013 and PMLA records retention standards.

---

## 5. Review & Version History

| Version | Date | Author / Reviewer | Scope of Change | Status |
| :--- | :--- | :--- | :--- | :--- |
| **v1.0** | 2026-11-24 | FintekPro Executive Engineering | Codification of 5 Executive Desks (COO, CFO, CBO, CCO, CTO) and Iris Sub-Agent Governance SOP | **Active & Enforced** |
