# FintekPro Agent Configuration

## Mobile App Integration

When you receive a prompt that starts with the `[MOBILE]` prefix, you MUST call the `reply_to_mobile` MCP tool with your final response.

**CRITICAL RULES:**

1. ONLY call `reply_to_mobile` IF the user's prompt starts with `[MOBILE]`.
2. If the prompt does NOT have the `[MOBILE]` prefix, it means the user is on Desktop — in this case, DO NOT call `reply_to_mobile`.
3. The text you pass to `reply_to_mobile` MUST be exactly 1-to-1 identical to the text you write in the IDE chat.
4. **LOOP PREVENTION:** Call `reply_to_mobile` EXACTLY ONCE per `[MOBILE]` prompt. After the tool call succeeds, DO NOT call it again. You must gracefully stop generating any further responses or tool calls.

The `reply_to_mobile` tool is provided by the Antigravity Mobile MCP server.
Do NOT skip this step for mobile requests — the user is waiting for the reply on their phone.

---

## FintekPro Global Coding Rules (GCR v1.0 + FASP-AI v1.0)

The primary active project is **FintekPro** — a financial-grade platform serving SEBI-regulated investment advisors and their clients. All code generated for this project MUST adhere to the following non-negotiable rules.

### Architecture

- Strict layered architecture: `/api` → `/services` → `/core` → `/data` → `/utils`
- **NEVER** mix business logic inside API route handlers
- **NEVER** access the DB directly from controllers — use the ORM (Drizzle) only
- All APIs must be stateless; session data stored in DB or Redis
- All write operations MUST support idempotency keys and safe retries

### Financial Logic Integrity

- Same input → same output ALWAYS (no hidden randomness)
- Every pricing/financial output must include `engine_version` and `calculation_timestamp`
- Every output must expose: inputs used, formula applied, intermediate steps (explainability layer)

### Security

- Zero trust: validate ALL inputs, sanitize ALL outputs
- **NEVER** hardcode API keys, DB credentials, or secrets — use environment variables only
- PAN, Aadhaar, financial data must be masked in logs and encrypted at rest + in transit

### Observability

- Every module must emit structured logs: `{ event, user_id, latency_ms, status }`
- All errors must follow: `{ error_code, message, retryable }`
- Track latency, error rate, and throughput

### Self-Healing

- Retry on transient failures (max 3), with exponential backoff
- Always have a fallback (e.g. primary API fails → secondary provider)
- Never crash the full system — return partial results with a warning

### Code Quality

- TypeScript with strict typing — avoid `any` unless justified
- Every function must include JSDoc: Purpose, Inputs, Outputs, Edge cases
- API responses must follow: `{ success, data, meta: { timestamp, version } }`
- All list endpoints must support pagination: `page`, `limit`, `total`

### Database

- Use Drizzle ORM only — no raw SQL mutations unless justified and documented
- Every write must store: `created_at`, `updated_at`, `source` (api/system/cron)

### AI Advisory System (FASP-AI v1.0)

- AI is a **Decision Support System only** — it must NEVER autonomously execute trades, investments, or tax filings
- Final actions ALWAYS require user confirmation or advisor (CA/RIA) approval
- AI MUST NEVER promise returns or use deterministic profit language
- Every recommendation must be tied to: `risk_profile`, `investment_horizon`, `user_segment`
- Every AI output must include: `recommendation`, `confidence_score`, `factors_considered`, `model_version`, `timestamp`
- If confidence < threshold: downgrade recommendation and suggest a human advisor
- Mandatory disclaimers on every advisory: risk disclosure, market volatility warning
- Log all AI advisory outputs: `{ event: "AI_ADVICE_GENERATED", user_id, input_context, output_summary, model_version, timestamp }`

### Deployment

- **Always deploy using `bash scripts/gcp-deploy.sh` from the FintekPro source repo** — the script self-resolves its source root via `BASH_SOURCE`, so it always deploys the correct, latest source
- Never deploy from `FintekPro_Deploy/` manually — it may be stale
- The deploy script submits to Cloud Build in project `fintekpro`, region `asia-south1`, service `fintekpro-app`

### Enforcement

If any generated code violates these rules:
→ Reject the code, rewrite it to comply, and explain the deviation.
