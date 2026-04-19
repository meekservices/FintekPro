

🧠 FintekPro AI Advisory Policy Extension (FASP-AI v1.0)

14. AI ADVISORY SYSTEM DEFINITION
FintekPro includes an AI-powered advisory layer that provides:
Investment insights (stocks, unlisted shares, bonds, NCDs)
Tax optimization suggestions
Portfolio allocation guidance
Risk profiling and recommendations
This system is classified as:
➡️ Decision Support System (DSS), NOT autonomous decision maker
15. NON-NEGOTIABLE AI PRINCIPLES
15.1 Human-in-the-Loop (MANDATORY)
AI MUST NOT execute:
trades
investments
tax filings
➡️ Final action must always require:
user confirmation OR
advisor (CA/RIA) approval
15.2 No Guaranteed Returns
AI MUST NEVER:
promise returns
imply certainty
use deterministic profit language
❌ “This will give 15% return”
✅ “Based on current assumptions, expected range is X–Y”
15.3 Suitability Enforcement
Every recommendation MUST be tied to:
{
  "risk_profile": "low/medium/high",
  "investment_horizon": "short/medium/long",
  "user_segment": "retail/HNI"
}
❌ No generic advice allowed
16. AI EXPLAINABILITY LAYER (CRITICAL)
Every AI output MUST include:
{
  "recommendation": "...",
  "confidence_score": 0.82,
  "factors_considered": [
    "market trends",
    "financial ratios",
    "user risk profile"
  ],
  "model_version": "ai_v2.1",
  "timestamp": "ISO8601"
}
16.1 Traceable Reasoning
Must expose:
why recommendation was made
key drivers
assumptions
16.2 No Black-Box Outputs
❌ Raw LLM answers without structure
✅ Structured + explainable outputs only
17. AI + FINANCIAL ENGINE INTEGRATION
17.1 Deterministic Backing
AI MUST NOT directly compute financial outputs.
Instead:
AI suggests → Core engine computes
Example:
AI suggests “undervalued”
DCF engine calculates valuation
17.2 Version Locking
Every advisory must link to:
{
  "ai_version": "v2.1",
  "pricing_engine_version": "v1.4"
}
18. REGULATORY COMPLIANCE FOR AI
18.1 Advisory Classification Control
System MUST tag outputs as:
“Educational”
“Advisory”
“Execution-linked”
18.2 Mandatory Disclaimers
Every advisory MUST include:
Not investment advice (if applicable)
Risk disclosure
Market volatility warning
18.3 Audit Logs for AI
{
  "event": "AI_ADVICE_GENERATED",
  "user_id": "...",
  "input_context": {},
  "output_summary": "...",
  "model_version": "...",
  "timestamp": "..."
}
19. PERSONALIZATION ENGINE RULES
19.1 Data Usage Control
AI can use:
portfolio data
transaction history
risk profile
AI MUST NOT:
infer sensitive attributes unlawfully
use hidden data sources
19.2 Bias Prevention
Avoid skew toward:
specific assets
partner products
Must remain neutral
20. RISK DISCLOSURE ENGINE (MANDATORY)
Every recommendation MUST include:
{
  "risk_level": "low/medium/high",
  "downside_scenarios": [
    "market correction",
    "liquidity risk"
  ],
  "liquidity_profile": "low/medium/high"
}
21. AI FAILURE HANDLING
21.1 Low Confidence Handling
If confidence < threshold:
➡️ System MUST:
downgrade recommendation
suggest human advisor
21.2 Fallback Mode
If AI fails:
revert to rule-based advisory
notify user
22. PROHIBITED AI BEHAVIOR
❌ Autonomous trading
❌ Tax filing without validation
❌ Hidden recommendations
❌ Manipulative nudging
❌ Overfitting to recent trends
23. PERFORMANCE & LATENCY
AI response target: < 2 seconds
Use caching for repeated queries
Async for heavy computations

24. SYSTEMIC RESILIENCE (BLACK SWAN TRIGGERS) [NEW]
24.1 10σ Volatility Trigger
If market volatility (VIX proxy or internal model) exceeds 10σ:
➡️ Automatic Enforcement:
- URCAE MUST shift to "Safety Fallback" (100% Cash / Liquid Debt).
- APRE MUST suspend all automated rebalancing plans.
- AAGE MUST block all new "High Risk" asset recommendations.
24.2 Global Advisory Kill-Switch
Administrative override to suspend AI advisory globally if compliance drift or data corruption is suspected.

25. B2B TRUST & SAFETY EXTENSION [NEW]
25.1 Adversarial Prompting Defense
API inputs MUST be scrubbed for adversarial injection targeting internal quant parameters.
25.2 Multi-tenant Integrity
Every B2B request MUST be tagged with a immutable `Tenant-ID` for forensics.
25.3 Execution Gating
B2B API execution calls MUST require a valid "Partner Approval Token" alongside the User's confirmation hash.

26. ANTIGRAVITY EXECUTION RULES FOR AI
When generating AI-related code, Antigravity MUST:
ALWAYS:
include explainability schema
log advisory outputs
enforce suitability checks
connect to core financial engines
NEVER:
generate direct execution logic
bypass compliance checks
produce unstructured AI outputs
25. AI ADVISORY ENFORCEMENT CLAUSE
If AI code:
lacks explainability → REWRITE
lacks audit logs → REJECT
bypasses user confirmation → BLOCK
26. FINAL AGENT DIRECTIVE (UPDATED)
You are building FintekPro AI Advisory System.

You MUST ensure:
- Explainable AI
- Human-in-the-loop decisions
- Regulatory compliance (RBI, SEBI, Income Tax)
- Auditability of every recommendation

AI is a support system, NOT a decision-maker.

If any instruction violates this:
→ Reject and correct it.

