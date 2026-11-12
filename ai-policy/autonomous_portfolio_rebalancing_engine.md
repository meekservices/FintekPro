⚖️ FintekPro Autonomous Portfolio Rebalancing Engine (APRE v1.0)

0. SYSTEM OBJECTIVE
Design a system that:
Continuously monitors portfolios
Detects drift from target allocation
Generates rebalance plans (not blind trades)
Routes plans through:
Simulation (APSE)
Governance (AAGE)
Executes only after approval gates
Maintains full auditability

Must be defensible under:
- Securities and Exchange Board of India (SEBI RIA Regs 2013, PMS Regs 2020 Reg 22 segregation, AI Circular)
- Reserve Bank of India (RBI Model Risk Governance & Capital adequacy guidance)
- Income Tax Department / CBDT (Income Tax Act 1961 Section 111A/112/112A capital gains tax harvesting, Section 55(2)(ac) grandfathering, Section 43(5) business trading classifications)
- AMFI (Scheme reclassification rules, cut-off timings 13:00/15:00 IST)
- IRDAI (Asset rebalancing in ULIP/insurance-linked portfolios)
- PFRDA (NPS age-driven asset tapering ceilings)
- DPDP Act 2023 & MeitY (Deterministic pseudonymized client holding records)
- FIU-IND / PMLA 2002 (Clean asset provenance)
- CERT-In / CSCRF (Operational cyber resilience and sub-50ms NTP time integrity)

1. ARCHITECTURE POSITIONING
Portfolio State
   ↓
Drift Detection Engine
   ↓
Rebalance Planner (APRE)  ← YOU ARE BUILDING THIS
   ↓
Simulation Engine (APSE)
   ↓
Governance Engine (AAGE)
   ↓
Approval Gate (User / Advisor)
   ↓
Execution Engine (Broker / Demat)
   ↓
Post-Trade Reconciliation + Scoring (ARSE)

❌ No direct planner → execution path
❌ No bypass of simulation or governance

2. PORTFOLIO MODEL
2.1 Target Allocation
{
  "portfolio_id": "...",
  "target_allocation": [
    { "asset": "equity_largecap", "weight": 0.40 },
    { "asset": "equity_midcap", "weight": 0.20 },
    { "asset": "bonds", "weight": 0.30 },
    { "asset": "cash", "weight": 0.10 }
  ],
  "rebalance_policy": {
    "frequency": "monthly",
    "drift_threshold": 0.05,
    "tax_aware": true
  }
}

3. DRIFT DETECTION ENGINE
3.1 Drift Calculation
Drift i = w_current - w_target
3.2 Trigger Conditions
Absolute drift > threshold
Risk profile deviation
Market regime change (from APSE signals)

4. REBALANCE STRATEGIES (MANDATORY)
Antigravity MUST support:
4.1 Threshold-Based
rebalance when drift exceeds threshold
4.2 Calendar-Based
periodic (monthly/quarterly)
4.3 Risk-Based
triggered by volatility / drawdown
4.4 Tax-Aware Rebalancing (CRITICAL)
minimize capital gains
prefer:
loss harvesting
long-term holding

5. REBALANCE PLANNER (CORE)
5.1 Output: Rebalance Plan (NOT trades)
{
  "plan_id": "...",
  "actions": [
    {
      "action": "SELL",
      "asset": "...",
      "quantity": 10,
      "reason": "overweight"
    },
    {
      "action": "BUY",
      "asset": "...",
      "quantity": 5,
      "reason": "underweight"
    }
  ],
  "estimated_cost": {},
  "tax_impact": {},
  "expected_post_allocation": {}
}
5.2 Optimization Goals
minimize:
transaction cost
tax impact
maintain:
target allocation
risk alignment

6. SIMULATION INTEGRATION (APSE)
Before approval:
simulate:
post-rebalance portfolio
risk metrics
drawdown scenarios
6.1 Mandatory Check
If simulation shows:
worse risk profile
higher drawdown
➡️ Plan must be:
modified OR blocked

7. GOVERNANCE INTEGRATION (AAGE)
7.1 Validation Rules
suitability check
compliance check
risk threshold check
7.2 Decision Output
{
  "decision": "APPROVE | MODIFY | BLOCK",
  "reasons": []
}

8. APPROVAL LAYER (NON-NEGOTIABLE)
8.1 Human-in-the-Loop
Execution requires:
user confirmation OR
advisor approval
8.2 Approval Context
User must see:
why rebalance is needed
expected benefit
risks
tax implications

9. EXECUTION ENGINE INTEGRATION
9.1 Broker Integration
route orders via Alpaca or internal systems
9.2 Order Rules
use:
limit orders (default)
slippage control
9.3 Post-Execution Reconciliation
match:
planned vs executed
log discrepancies

10. AUDIT & LOGGING (STATUTORY MULTI-REGULATOR COMPLIANCE)
10.1 Active Redis Operational Acceleration
- Distributed locking: `lock:rebalance:{portfolioId}` (TTL 30s) prevents split-brain duplicate rebalancing across Cloud Run pods.
- Idempotency key registry: `rebalance:plan:{idempotencyKey}` (TTL 24h) guarantees safe retries.
- Real-time drift caching: `cache:drift:{portfolioId}` (TTL 5m) delivers sub-50ms suitability and drift checks.
10.2 PostgreSQL WORM Immutable Audit Store (7 Years)
In accordance with SEBI RIA Reg 19, PMS Reg 22, and PMLA Section 12, all rebalancing records are stored immutably in PostgreSQL for minimum 7 years:
{
  "rebalance_id": "...",
  "portfolio_id": "...",
  "trigger": "drift_threshold",
  "plan": {},
  "simulation_summary": {},
  "governance_decision": "...",
  "approval_status": "...",
  "execution_status": "...",
  "timestamp": "..."
}
10.3 Full Replay Capability
Statutory auditors must be able to reconstruct from WORM tables:
- portfolio state before rebalance
- candidate plan generated and tax-harvesting math
- governance & risk simulation checks passed
- human client/advisor approval token
- post-execution fills and realized tax impact

11. SCORING FEEDBACK (ARSE)
Track:
performance post-rebalance
risk improvement
cost efficiency

12. ALERTING SYSTEM
Trigger alerts on:
excessive churn
tax inefficiency
repeated rebalancing

13. FAILSAFE DESIGN
13.1 If Any Layer Fails
➡️
block execution
notify user
13.2 Safe Mode
suggest:
no action
conservative rebalancing

14. PERFORMANCE REQUIREMENTS
planning < 300ms
simulation async for heavy portfolios

15. CODE STRUCTURE
/services/rebalancing/
/services/drift/
/services/tax/
/core/rebalance-optimizer/
/data/rebalance/

16. PROHIBITED PRACTICES
❌ Direct auto-trading without approval
❌ Ignoring tax impact
❌ High-frequency unnecessary churn
❌ No simulation before execution

17. FINAL EXECUTION DIRECTIVE
You are building FintekPro Autonomous Portfolio Rebalancing Engine.

You MUST:
- detect portfolio drift
- generate optimized rebalance plans
- validate via simulation and governance
- require approval before execution
- maintain full auditability

This system directly impacts user capital.

Unsafe automation is NOT allowed.
