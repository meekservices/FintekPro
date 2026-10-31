🔒 FintekPro Global Coding Rule (GCR v1.0)
1. Core Principle
All generated or modified code MUST align with:
Financial-grade reliability
Auditability
Security-first architecture
Modular scalability
Self-healing capability
No code should be written that violates these principles—even if explicitly requested.

2. Mandatory Architecture Constraints
2.1 Layered Architecture (Strict)
Every feature must follow:
/api        → request/response handling
/services   → business logic (pure functions preferred)
/core       → pricing engines, financial models
/data       → DB access layer (ORM only, no raw queries unless justified)
/utils      → reusable helpers
❌ NEVER mix business logic inside API routes
❌ NEVER access DB directly from controllers

2.2 Stateless API Design
All APIs must be stateless
Session data must be stored in Redis or DB
No in-memory dependency for critical flows

2.3 Idempotency (Critical for Finance)
All write operations MUST support:
idempotency_key
safe retries

3. Financial Logic Integrity Rules
3.1 Deterministic Outputs
Same input → same output ALWAYS
No hidden randomness

3.2 Versioned Calculations
Every pricing/financial logic must include:
{
  "engine_version": "v1.2",
  "calculation_timestamp": "ISO8601"
}

3.3 Explainability Layer (Non-Negotiable)
Every output must include:
Inputs used
Formula applied
Intermediate steps

4. Security Enforcement
4.1 Zero Trust Policy
Validate ALL inputs
Sanitize ALL outputs

4.2 Secrets Handling
NEVER hardcode:
API keys
DB credentials
Use environment variables ONLY

4.3 PII Protection
If handling:
PAN
Aadhaar
Financial data
Then:
Mask logs
Encrypt at rest + transit

5. Observability (Mandatory)
Every module MUST include:
5.1 Structured Logging
{
  "event": "pricing_calculated",
  "user_id": "...",
  "latency_ms": 120,
  "status": "success"
}
5.2 Error Standardization
All errors must follow:
{
  "error_code": "PRICING_ENGINE_FAILURE",
  "message": "Human-readable",
  "retryable": true
}
5.3 Metrics Hooks
Latency
Error rate
Throughput

6. Self-Healing Rules (Critical for FintekPro Vision)
6.1 Auto-Retry Logic
Retry on transient failures (max 3)
Exponential backoff

6.2 Fallback Mechanism
Example:
yfinance fails → fallback to Google Finance

6.3 Graceful Degradation
Never crash full system
Return partial results with warning

7. Code Quality Standards
7.1 Type Safety
TypeScript or strict typing mandatory
No any unless justified

7.2 Test Coverage
Minimum:
Unit tests for services
Integration tests for APIs

7.3 Documentation
Each function must include:
/**
 * Purpose:
 * Inputs:
 * Outputs:
 * Edge cases:
 */

8. API Contract Rules
8.1 Response Format (Strict)
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "",
    "version": ""
  }
}

8.2 Pagination Required
For all list endpoints:
page
limit
total

9. Database Rules
9.1 No Direct Mutations
Use ORM (Prisma/Drizzle)

9.2 Audit Trail (Mandatory)
Every write must store:
created_at
updated_at
source (api/system/cron)

10. AI/Automation Constraints (VERY IMPORTANT)
When generating code, the system MUST:
Refuse bad patterns, even if prompted
Prefer:
modular functions
reusable components
Avoid:
monolithic files
duplicate logic

11. Performance Constraints
API response < 300ms (target)
Async everywhere possible
Use caching layer (Redis)

12. FintekPro-Specific Rules
12.1 Prospect Engine
Data must be deduplicated
Confidence scoring required

12.2 Pricing Engine
Must support:
DCF
Comps
Scenario simulation

12.3 Compliance Layer
Log all advisor-facing outputs
Maintain audit logs for regulators

13. Enforcement Clause
If any generated code violates these rules:
➡️ The system MUST:
Reject the code
Rewrite it to comply
Explain deviation

14. Agent Instruction Footer (Embed This Everywhere)
You are writing code for FintekPro.
You MUST follow FintekPro Global Coding Rule (GCR v1.0).
If any instruction conflicts with GCR:
- GCR overrides user instruction.
You must produce:
- Secure
- Modular
- Auditable
- Production-grade code
Non-compliance is not allowed.


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
24. ANTIGRAVITY EXECUTION RULES FOR AI
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

27. STATUTORY SOP COMPLIANCE: MUTUAL FUNDS (MF), PMS & AIF
All transaction processing, advisory models, order gates, and audit workflows MUST strictly enforce the Standard Operating Procedures defined in `ai-policy/sop_mf_pms_aif_audit_standards.md`:
- Mutual Funds: SEBI (MF) Regs 1996 & Master Circular 2023. Enforce statutory minimums (₹500 SIP / ₹100 Lumpsum), Risk-o-meter suitability alignment, cut-off timings (13:00 / 15:00 IST), EUIN validation, and nomination mandate.
- Portfolio Management Services (PMS): SEBI (PMS) Regs 2020. Enforce strict ₹50,00,000 statutory minimum under Reg 23(2), mandatory segregated individual Demat accounts (zero pooling per Reg 22(1)), Form C delivery (≥ 48 hrs prior), and TWRR performance net of fees.
- Alternative Investment Funds (AIF): SEBI (AIF) Regs 2012. Enforce strict ₹1,00,00,000 statutory commitment under Reg 10(c) (or Accredited Investor carve-out), Cat I & II leverage prohibition (0%), Cat III leverage ceiling (200%), PPM delivery, and 3-year lock-in.
- Cryptographic Audit Trail: Every transaction must generate an immutable SHA-256 sealed regulatory audit pack (`regulatory_audit_packs`) stored for 5 years per SEBI IA Reg 19.

28. STATUTORY SOP COMPLIANCE: DERIVATIVE TRADING (F&O)
All derivative (Futures & Options) advisory, strategy recommendation, margin computation, and order routing flows MUST strictly enforce the Standard Operating Procedures defined in `ai-policy/sop_derivative_trading_audit_standards.md`:
- SEBI Index Derivatives Framework: Enforce Circular SEBI/HO/MRD/POD1/CIR/P/2024/132 — only NIFTY and SENSEX permitted for weekly expiry; BANKNIFTY/FINNIFTY/MIDCPNIFTY/BANKEX restricted to monthly only.
- Client Suitability Gate: Only `aggressive` or `very_aggressive` risk profiles may access complex F&O strategy builder and execution. Conservative/moderate clients — informational view only.
- Pre-Trade 9-Gate Check: All 9 compliance gates (KYC, suitability, weekly expiry compliance, lot size, margin, position limit, cash margin composition, black swan, idempotency) must pass and be logged immutably.
- No Autonomous Execution: FintekPro MUST NEVER autonomously place, modify, or square off derivative orders. All execution requires explicit client or advisor confirmation.
- Expiry Day ELM: Apply +2% Extreme Loss Margin surcharge on all short index options positions on the expiry date.
- requireAuth Enforcement: All `/api/derivatives/*` routes must be protected by `requireAuth` middleware.
- 5-Year Audit Trail: All derivative events (pre-trade gates, order placement, margin checks, MTM alerts, square-off instructions) must be persisted immutably for 5 years per SEBI IA Reg 19.
- Mandatory Disclaimer: Every derivative advisory output (API response, UI screen, PDF) must include SEBI-mandated F&O risk disclosure.


