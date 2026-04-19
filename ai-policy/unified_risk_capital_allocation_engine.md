🧠 FintekPro Unified Risk & Capital Allocation Engine (URCAE v1.0)

0. SYSTEM OBJECTIVE
Design a system that:
Allocates capital across:
asset classes (equity, debt, unlisted, cash)
strategies (growth, income, tax optimization)
Optimizes for:
risk-adjusted returns
regulatory constraints
user suitability
Acts as the central allocator feeding:
Advisory Engine
Rebalancing Engine (APRE)

Must align with:
Securities and Exchange Board of India
Reserve Bank of India

1. ARCHITECTURE POSITIONING
User Profile + Market State
        ↓
Unified Risk & Capital Allocation Engine (URCAE) ← YOU ARE BUILDING THIS
        ↓
Target Allocation + Strategy Mix
        ↓
Rebalancing Engine (APRE)
        ↓
Execution Layer

2. CORE PRINCIPLE: RISK BUDGETING
Capital allocation MUST be driven by risk, not just returns.
2.1 Portfolio Risk Budget
∑ RC_i = R_total
Where:
RC_i = risk contribution of asset i
R_total = total portfolio risk budget
2.2 Risk Contribution
RC_i = w_i * σ_i * ρ_i,p

3. INPUT CONTRACT
{
  "user_profile": {
    "risk_profile": "low/medium/high",
    "investment_horizon": "long",
    "liquidity_needs": "medium"
  },
  "portfolio_state": {},
  "market_state": {
    "volatility": "...",
    "interest_rates": "...",
    "macro_regime": "bull/bear/neutral"
  }
}

4. OUTPUT CONTRACT
{
  "target_allocation": [
    { "asset_class": "equity", "weight": 0.5 },
    { "asset_class": "bonds", "weight": 0.3 },
    { "asset_class": "unlisted", "weight": 0.1 },
    { "asset_class": "cash", "weight": 0.1 }
  ],
  "strategy_overlay": [
    "growth",
    "income"
  ],
  "risk_budget": {},
  "expected_metrics": {
    "return": 0.12,
    "volatility": 0.15
  }
}

5. ALLOCATION MODELS (MANDATORY)
Antigravity MUST implement:
5.1 Mean-Variance Optimization
min w^T Σ w s.t. w^T μ ≥ r, ∑ w_i = 1
5.2 Risk Parity
equalize risk contributions across assets
5.3 Black-Litterman (Advanced)
combine:
market equilibrium
AI views

6. CONSTRAINT ENGINE (CRITICAL)
6.1 Regulatory Constraints
asset exposure limits
leverage restrictions
6.2 User Constraints
liquidity needs
tax considerations
concentration limits
6.3 System Constraints
{
  "max_single_asset": 0.2,
  "min_cash": 0.05
}

7. MARKET REGIME ADAPTATION
7.1 Regime Detection
volatility spikes
interest rate shifts
macro signals
7.2 Dynamic Allocation
Regime	Action
Bull	increase equity
Bear	increase bonds/cash
Volatile	diversify

8. AI INTEGRATION
8.1 AI Provides:
expected returns
asset signals
8.2 URCAE Decides:
final allocation
overrides AI if needed

9. GOVERNANCE INTEGRATION
9.1 Validation
suitability
compliance
risk thresholds
9.2 Override Rule
If allocation violates:
→ must be modified or blocked

10. SIMULATION INTEGRATION (APSE)
Before finalizing:
simulate allocation
stress-test portfolio

11. SCORING FEEDBACK (ARSE)
Track:
allocation performance
risk efficiency

12. CAPITAL ALLOCATION STRATEGIES
12.1 Core-Satellite
core: stable assets
satellite: high-return bets
12.2 Tactical Allocation
short-term adjustments
12.3 Strategic Allocation
long-term baseline

13. AUDIT & TRACEABILITY
13.1 Allocation Record
{
  "allocation_id": "...",
  "inputs": {},
  "model_used": "mean_variance",
  "constraints": {},
  "final_weights": {},
  "timestamp": "..."
}
13.2 Replay Capability
Must reconstruct:
inputs
model
constraints
decision

14. FAILSAFE DESIGN
14.1 If Optimization Fails
→ fallback to:
rule-based allocation
14.2 Safe Allocation
increase cash
reduce risk assets

15. PERFORMANCE REQUIREMENTS
allocation computation < 500ms
async for complex optimization

16. CODE STRUCTURE
/services/allocation/
/services/risk/
/core/optimizer/
/core/constraints/
/data/allocation/

17. PROHIBITED PRACTICES
❌ return-only optimization
❌ ignoring risk contribution
❌ no constraints
❌ no simulation validation

18. FINAL EXECUTION DIRECTIVE
You are building FintekPro Unified Risk & Capital Allocation Engine.

You MUST:
- allocate capital based on risk budgeting
- enforce constraints and compliance
- integrate AI, simulation, and governance
- produce explainable and auditable allocations

This is the portfolio brain of the system.

Failure is not allowed.
