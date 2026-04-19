# ♻️ FintekPro Self-Healing Production Runtime (SHPR v1.0)

> **Classification:** Internal Engineering Policy — Production Grade  
> **Owner:** FintekPro Platform Engineering / SRE  
> **Effective:** 2026-04-20  
> **Review Cycle:** Quarterly  
> **Regulators:** SEBI / RBI  
> **Version:** 1.0.0

---

## 0. SYSTEM OBJECTIVE

The FintekPro Self-Healing Production Runtime (SHPR) is an autonomous reliability layer designed to detect, diagnose, and safely correct production issues in real time — **within strict, regulator-defensible guardrails**.

Its five core mandates:

1. **Detect** production anomalies in < 5 seconds using structured observability signals
2. **Diagnose** root cause with precision before any fix is attempted
3. **Generate** safe, bounded fixes — never touching financial, pricing, or compliance logic
4. **Validate** every fix in isolation (sandbox + shadow traffic) before any production deployment
5. **Audit** every decision with an immutable, replay-capable trail satisfying SEBI and RBI requirements

> **This system is controlled AI automation — not uncontrolled autonomy.**  
> **Unsafe self-modification of financial infrastructure is prohibited absolutely.**

---

## 1. ARCHITECTURE OVERVIEW

```
┌──────────────────────────────────────────────────────────────────────┐
│                      PRODUCTION SYSTEM                               │
│    (API servers, background services, integrations, databases)       │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ telemetry
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│               OBSERVABILITY LAYER                                    │
│  Structured Logs │ Metrics (latency/error) │ Traces (request flows)  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ signals
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│               ANOMALY DETECTION ENGINE                               │
│  Threshold │ Statistical Baseline │ Pattern Recognition              │
│  Severity: LOW → MEDIUM → HIGH → CRITICAL                           │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ anomaly event
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│               DIAGNOSIS ENGINE                                       │
│  Root Cause Analysis │ Dependency Graph │ Context Collection         │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ diagnosis context
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│               FIX GENERATION ENGINE                                  │
│  Safe Fix Library │ LLM-Assisted Generation │ Guardrail Validation   │
│  RESTRICTED ZONES enforced before generation begins                  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ candidate fix
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│               VALIDATION SANDBOX                                     │
│  Staging Deploy │ Shadow Traffic Replay │ Regression Suite │ Perf    │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ validation result
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│               DECISION ENGINE                                        │
│  AUTO-APPLY │ REQUIRE HUMAN APPROVAL │ REJECT                       │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ deploy signal
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│               CONTROLLED DEPLOYMENT                                  │
│  Canary (1% → 10% → 25% → 100%) │ Continuous Health Monitoring      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
              ┌────────────────┴──────────────────┐
              ▼                                   ▼
     FULL ROLLOUT                          INSTANT ROLLBACK
  (all signals green)               (any anomaly signal detected)
```

---

## 2. OBSERVABILITY LAYER (MANDATORY FOUNDATION)

### 2.1 Data Sources

All observability data must be **structured** (JSON) and **centrally aggregated** before the anomaly detection engine can consume it. Unstructured logs are normalized at ingestion.

| Source | Format | Ingestion Rate | Retention |
|---|---|---|---|
| Application logs | JSONL (structured) | Real-time streaming | 90 days hot, 7 years cold |
| API metrics | Prometheus-compatible | 10s scrape interval | 13 months |
| Distributed traces | OpenTelemetry | 100% sampled critical paths | 30 days |
| DB query metrics | pg_stat_statements | 30s interval | 30 days |
| External API health | HTTP probe results | 60s interval | 30 days |

### 2.2 Required Signal Matrix

The following signals are **mandatory** — if any signal source is unavailable, the SHPR escalates to `CRITICAL` severity automatically and blocks all auto-healing operations until observability is restored.

| Signal | Source | Threshold for Alert |
|---|---|---|
| API error rate | Application logs + metrics | > 1% over 60s rolling window |
| P99 API latency | Distributed traces | > 2000ms sustained for > 30s |
| Transaction mismatch | Financial integrity checker | Any single mismatch |
| Payment gateway timeout | External API probe | > 3 consecutive failures |
| DB connection pool exhaustion | pg metrics | > 85% pool utilization |
| KYC/compliance service failure | Health probe | Any failure in 30s window |
| Order execution error | Structured event log | Any `status: "error"` in order pipeline |
| Compliance rule violation | ACGP audit log | Any `severity: "critical"` event |
| Memory / CPU saturation | System metrics | > 90% for > 2 minutes |
| SSE stream disconnect rate | Connection metrics | > 20% clients disconnected in 60s |

### 2.3 Signal Pipeline Architecture

```
Service emits structured log event
          │
          ▼
Log aggregator (Loki / CloudWatch)
          │
          ▼
SHPR Signal Normalizer (maps to canonical signal schema)
          │
          ▼
Signal Buffer (ring buffer, 60s window)
          │
          ▼
Anomaly Detection Engine (real-time stream processing)
```

**Canonical signal schema:**
```jsonc
{
  "signal_id": "sig-20260420-001",
  "signal_type": "api_error_rate",
  "service": "server/routes/portfolio-core-2-2.ts",
  "severity": "high",
  "value": 3.7,
  "threshold": 1.0,
  "unit": "percent",
  "window_seconds": 60,
  "trace_ids": ["trace-abc123", "trace-def456"],
  "timestamp": "2026-04-20T00:51:17Z"
}
```

---

## 3. ANOMALY DETECTION ENGINE

### 3.1 Detection Algorithms

#### A. Threshold-Based Detection
Simple, deterministic, zero false-negative risk for known failure modes.

```
error_rate(service, window=60s) > 1.0%   → HIGH
error_rate(service, window=60s) > 5.0%   → CRITICAL
p99_latency(endpoint, window=30s) > 2000ms → MEDIUM
p99_latency(endpoint, window=30s) > 5000ms → HIGH
db_pool_utilization > 85%                 → MEDIUM
db_pool_utilization > 95%                 → CRITICAL
```

#### B. Statistical Baseline Detection
Compares current metrics against a rolling 7-day baseline (same hour, same day-of-week) using z-score analysis.

```
z_score = (current_value - baseline_mean) / baseline_std

|z_score| > 2.0  → MEDIUM  (2σ deviation)
|z_score| > 3.0  → HIGH    (3σ deviation)
|z_score| > 4.0  → CRITICAL (4σ — rare, almost certainly an incident)
```

#### C. Pattern-Based Detection
Sequence analysis over a sliding window to detect non-obvious failure modes.

| Pattern | Detection Method | Example |
|---|---|---|
| Repeated identical errors | Groupby error fingerprint, count > threshold | Same DB timeout message 10x in 60s |
| Cascading failure propagation | Service dependency graph + correlated error onset | Payment → KYC → Order all fail within 10s |
| Memory leak signature | Monotonic memory growth > 5% per minute | Heap growing without GC relief |
| Token exhaustion | API key 429 responses from external service | Screener API rate limit hit |
| Circuit breaker open | Upstream service health probe returning 503 | Alpaca API unavailable |

### 3.2 Severity Levels and Automated Actions

| Level | Criteria | Automated Action | Human Alert |
|---|---|---|---|
| `LOW` | Minor deviation, single occurrence | Log event, no action | None |
| `MEDIUM` | Sustained deviation, degraded performance | Suggest fix, queue for review | Slack `#eng-monitoring` |
| `HIGH` | Significant failure, user-impacting | Trigger healing pipeline | Slack `#eng-alerts` + PagerDuty |
| `CRITICAL` | Financial integrity risk, compliance failure, or system-wide outage | **Halt auto-healing**, page on-call, consider kill switch | PagerDuty P1 + CTO alert |

> **CRITICAL severity always requires human decision.** The SHPR never autonomously acts on critical-severity anomalies affecting financial data.

---

## 4. DIAGNOSIS ENGINE

### 4.1 Root Cause Analysis (RCA)

The diagnosis engine constructs a **causal chain** before generating any fix. A fix without a confirmed root cause is rejected.

```
Anomaly Signal
     │
     ▼
Service Identification (which service owns this signal?)
     │
     ▼
Error Fingerprinting (unique hash of error message + stack trace)
     │
     ▼
Dependency Graph Traversal (which upstream/downstream services are affected?)
     │
     ▼
Change Correlation (did a recent deployment or config change precede this?)
     │
     ▼
Historical Match (has this error pattern been seen before? what fixed it?)
     │
     ▼
RCA Conclusion: { cause, confidence, affected_scope }
```

### 4.2 Diagnosis Context Object

```jsonc
{
  "diagnosis_id": "diag-20260420-portfolio-001",
  "anomaly_signal_id": "sig-20260420-001",
  "root_cause": {
    "type": "timeout",
    "description": "External Screener API responding with 504 after 10s. No retry logic present.",
    "confidence": 0.91,
    "evidence": [
      "23 consecutive 504 responses from screener.in/api/v2",
      "P99 latency spiked from 340ms to 11,200ms at 00:47:32 IST",
      "No recent code changes to screener integration",
      "Screener status page shows degraded performance"
    ]
  },
  "affected_services": ["server/routes/market-data-1.ts", "server/routes/market-data-2.ts"],
  "affected_endpoints": ["/api/stocks/screener", "/api/market/overview"],
  "recent_changes": [],
  "dependencies": {
    "upstream": ["Screener.in API"],
    "downstream": ["Portfolio analytics", "Pick of the Day generation"]
  },
  "financial_data_at_risk": false,
  "compliance_scope": false,
  "fix_zone": "API_RELIABILITY",
  "timestamp": "2026-04-20T00:51:32Z"
}
```

### 4.3 Financial Risk Assessment

Before any diagnosis concludes, the engine runs a **financial data risk check**:

```
Is the anomaly in or adjacent to:
  - Order execution?           → financial_data_at_risk = true
  - Transaction processing?    → financial_data_at_risk = true
  - Ledger entries?            → financial_data_at_risk = true
  - Pricing calculation?       → financial_data_at_risk = true
  - KYC/compliance logic?      → compliance_scope = true
  - Portfolio analytics (read-only)? → financial_data_at_risk = false ✓
  - External API integration?        → financial_data_at_risk = false ✓
  - Infrastructure/caching?          → financial_data_at_risk = false ✓
```

If `financial_data_at_risk = true` OR `compliance_scope = true`, **the fix generation engine is bypassed entirely** and the issue is escalated to human on-call.

---

## 5. FIX GENERATION ENGINE

### 5.1 Fix Zone Classification (MANDATORY FIRST STEP)

Before generating any fix, the engine classifies the repair zone. This classification determines whether auto-healing is permitted at all.

```
┌──────────────────────────────────────────────────────────────────┐
│                    FIX ZONE MAP                                  │
├─────────────────────────────────┬────────────────────────────────┤
│ ZONE                            │ AUTO-HEAL PERMITTED?           │
├─────────────────────────────────┼────────────────────────────────┤
│ Infrastructure (servers, cache) │ ✅ YES — full auto-heal        │
│ External API reliability        │ ✅ YES — retry/timeout/fallback│
│ Background job reliability      │ ✅ YES — retry/circuit breaker │
│ Non-financial route errors      │ ✅ YES (read-only endpoints)   │
│ SSE / WebSocket connectivity    │ ✅ YES                         │
│ Configuration (non-financial)   │ ⚠️ YES — with human review    │
│ Financial logic / calculations  │ ❌ NO — hard blocked           │
│ Order execution paths           │ ❌ NO — hard blocked           │
│ Ledger/transaction processing   │ ❌ NO — hard blocked           │
│ Pricing algorithms              │ ❌ NO — hard blocked           │
│ KYC/AML/compliance rules        │ ❌ NO — hard blocked           │
│ Authentication/authorization    │ ❌ NO — requires security team │
└─────────────────────────────────┴────────────────────────────────┘
```

### 5.2 Allowed Fix Types

#### ✅ SAFE — Auto-heal eligible

| Fix Type | Description | Example |
|---|---|---|
| `RETRY_LOGIC` | Add exponential backoff retry wrapper around external API call | Screener API timeout → add 3 retries with 1s/2s/4s backoff |
| `TIMEOUT_TUNING` | Increase/decrease HTTP timeout for external service | Alpaca API call timing out at 5s → increase to 15s |
| `NULL_GUARD` | Add null/undefined check before property access | `Cannot read property 'price' of undefined` → add guard |
| `FALLBACK_ROUTING` | Route to backup data source when primary fails | Screener down → fall back to cached data |
| `CIRCUIT_BREAKER` | Open circuit after N failures to prevent cascade | Stop hammering failing API after 5 consecutive errors |
| `RATE_LIMIT_BACKOFF` | Add rate limit detection + backoff logic | 429 responses → implement token bucket backoff |
| `CONNECTION_POOL_TUNE` | Adjust DB connection pool size/timeout | Pool exhausted → increase max connections by 20% |
| `CACHE_INVALIDATION` | Clear stale cache that is causing incorrect read responses | Stale cache serving wrong price data → TTL reduction |
| `MEMORY_LEAK_PATCH` | Clear un-cleared intervals, listeners, or buffers | EventEmitter listener leak → add cleanup on disconnect |
| `STRUCTURED_ERROR_RESPONSE` | Standardize error response format | Inconsistent 500 response shapes → normalize |

#### ❌ RESTRICTED — Never auto-generated

| Fix Type | Restriction Reason |
|---|---|
| Changes to financial calculation logic | SEBI regulatory risk; requires human audit |
| Changes to order execution flow | Direct market impact; requires human review |
| Changes to pricing algorithms | Manipulation risk; requires compliance sign-off |
| Changes to KYC/AML validation rules | RBI regulatory requirement; not AI-modifiable |
| Changes to ledger entry logic | Double-entry integrity; human-only |
| Changes to authentication/session logic | Security critical; security team only |
| Schema migrations | Data integrity risk; DBA required |

### 5.3 Fix Output Schema

```jsonc
{
  "fix_id": "fix-20260420-screener-timeout-001",
  "diagnosis_id": "diag-20260420-portfolio-001",
  "fix_type": "RETRY_LOGIC",
  "fix_zone": "API_RELIABILITY",
  "target_file": "server/services/data-enrichment-service.ts",
  "target_function": "fetchScreenerData",
  "description": "Add exponential backoff retry (3 attempts: 1s/2s/4s) to Screener API call. No change to returned data shape or financial logic.",
  "code_patch": {
    "before": "const response = await fetch(screenerUrl, { timeout: 5000 });",
    "after": "const response = await retryWithBackoff(() => fetch(screenerUrl, { timeout: 10000 }), { attempts: 3, baseDelayMs: 1000 });",
    "diff": "...(unified diff)..."
  },
  "confidence": 0.91,
  "financial_data_modified": false,
  "compliance_scope_modified": false,
  "estimated_fix_effectiveness": 0.87,
  "fix_generator": "rule_based",
  "generated_at": "2026-04-20T00:51:45Z"
}
```

### 5.4 LLM-Assisted Fix Generation

For complex issues not covered by the rule-based fix library, the SHPR invokes an LLM with a tightly constrained prompt:

```
SYSTEM: You are the FintekPro SHPR fix generation engine.
Your context: Production reliability fix — NOT financial logic.

STRICT CONSTRAINTS:
1. Fix ONLY the reliability issue described below
2. DO NOT modify any financial calculations, pricing, or compliance logic
3. DO NOT change function signatures or API contracts
4. DO NOT add new external dependencies
5. Produce the MINIMAL code change that resolves the issue
6. If you cannot produce a safe fix within these constraints, output: CANNOT_FIX

DIAGNOSIS: {diagnosis_context}
TARGET FILE: {file}
TARGET FUNCTION: {function_name}
ISSUE: {root_cause_description}

OUTPUT: Produce ONLY the code patch in unified diff format. No explanation.
```

**LLM fix guardrails:**

| Guardrail | Implementation |
|---|---|
| Financial scope check | Automated AST scan of LLM output for restricted patterns before acceptance |
| Diff size limit | LLM fix rejected if diff > 30 lines |
| No new imports | Any new `import` statement in LLM fix triggers human review |
| Determinism check | Fix is generated twice; outputs must be functionally identical |
| Re-validation required | LLM fix MUST pass full validation sandbox before deployment |

---

## 6. VALIDATION LAYER

### 6.1 Validation Pipeline

Every fix — whether rule-based or LLM-assisted — must pass **all four** validation stages before the decision engine is invoked. **A single failure in any stage causes the fix to be rejected.**

```
Candidate Fix
      │
      ▼
Stage 1: Static Analysis (< 5s)
  • AST scan for restricted zone violations
  • ACGP policy engine full rule pass
  • Syntax validity check
      │ PASS
      ▼
Stage 2: Unit Test Suite (< 60s)
  • Run existing test suite against patched code
  • Zero test regressions permitted
  • If no tests cover fix area → escalate to human
      │ PASS
      ▼
Stage 3: Staging Environment Deploy (< 120s)
  • Deploy patch to isolated staging instance
  • Run integration test suite (API contracts)
  • Run financial integrity check suite (read-only)
      │ PASS
      ▼
Stage 4: Shadow Traffic Replay (< 300s)
  • Replay last 15 minutes of production traffic against patched staging
  • Compare response bodies (diff must be < configured tolerance)
  • Monitor error rate, latency, memory
      │ PASS
      ▼
VALIDATION PASSED → Decision Engine
```

### 6.2 Validation Success Criteria

| Check | Pass Criteria |
|---|---|
| AST restricted zone scan | 0 violations |
| ACGP policy pass | 0 critical violations |
| Unit test regression | 0 tests newly failing |
| API contract compliance | All endpoints return correct schemas |
| Financial integrity check | All read-only financial calculations match baseline |
| Error rate in shadow replay | ≤ baseline error rate (no regression) |
| P99 latency in shadow replay | ≤ 110% of baseline latency |
| Memory usage | No statistically significant increase |

### 6.3 Compliance Integrity Verification

Shadow traffic replay always includes a **compliance signal** check — ensuring that KYC gates, suitability checks, and SEBI disclosure fields are unchanged and correctly populated in all replayed responses.

---

## 7. DECISION ENGINE

### 7.1 Approval Matrix

| Condition | Confidence | Validation Result | Action |
|---|---|---|---|
| Safe fix type, high confidence | > 0.85 | All stages PASS | `AUTO-APPLY` |
| Safe fix type, medium confidence | 0.60–0.85 | All stages PASS | `REQUIRE_HUMAN_APPROVAL` (30-min window) |
| Safe fix type, low confidence | < 0.60 | Any result | `REJECT` — escalate to on-call |
| Any stage FAILS validation | Any | FAIL | `REJECT` — no deployment |
| Fix touches compliance/financial zone | Any | Any | `REJECT` — escalate to on-call immediately |
| LLM-generated fix | Any | All stages PASS | `REQUIRE_HUMAN_APPROVAL` (mandatory) |
| CRITICAL anomaly severity | Any | Any | `BLOCK_AUTO_HEAL` — human required |

### 7.2 Human-in-the-Loop Protocol

When `REQUIRE_HUMAN_APPROVAL` is triggered:

1. Alert sent to on-call engineer via PagerDuty + Slack with:
   - Anomaly summary
   - Root cause diagnosis
   - Proposed fix (diff + explanation)
   - Validation results
   - **30-minute approval window**
2. Engineer reviews and responds:
   - **APPROVE** → controlled deployment begins
   - **REJECT** → fix discarded, issue continues to be monitored
   - **MODIFY** → engineer edits fix and re-submits for validation
3. If no response within 30 minutes → fix is **auto-rejected** (fail-closed)

### 7.3 Mandatory Human Approval Scenarios

The following scenarios **always** require human sign-off regardless of confidence score:

- Any fix touching a file in `server/routes/` for POST/PUT/DELETE endpoints
- Any fix to external financial service integrations (Alpaca, payment gateways)
- Any LLM-generated fix
- Any fix that alters retry/timeout behavior on order execution paths
- Any fix deployed outside business hours (IST 09:00–18:00) to production

---

## 8. CONTROLLED DEPLOYMENT

### 8.1 Canary Release Strategy

```
FIX APPROVED
     │
     ▼
Stage 0: Deploy to staging (already done in validation)
     │
     ▼
Stage 1: Canary — 1% of production traffic (5 minutes monitoring)
     │ all signals green?
     ▼
Stage 2: Expand — 10% of production traffic (10 minutes monitoring)
     │ all signals green?
     ▼
Stage 3: Expand — 25% of production traffic (10 minutes monitoring)
     │ all signals green?
     ▼
Stage 4: Full rollout — 100% production traffic
     │
     ▼
Post-deploy monitoring: 60 minutes elevated alerting sensitivity
```

### 8.2 Canary Health Metrics (Monitored Continuously)

At every canary stage, the following metrics are compared between canary traffic and baseline:

| Metric | Rollback Threshold |
|---|---|
| Error rate | Canary error rate > 2× baseline |
| P99 latency | Canary P99 > 150% baseline P99 |
| Financial transaction mismatch | Any single mismatch |
| Order execution error | Any single order error introduced by fix |
| KYC/compliance API error | Any failure rate increase |
| Memory usage | > 120% of pre-fix baseline |

### 8.3 Instant Rollback

Rollback is **automatic** if any canary health metric exceeds its rollback threshold.

```
Anomaly detected in canary
         │
         ▼
ROLLOUT_HALTED immediately
         │
         ▼
Traffic reverted to last stable version (< 30 seconds)
         │
         ▼
Healing event marked FAILED in audit log
         │
         ▼
PagerDuty alert + Slack notification with rollback evidence
         │
         ▼
Fix quarantined — cannot be re-attempted without human review
```

Rollback uses **blue-green deployment** — the previous version is always kept warm and can receive 100% traffic within 30 seconds.

---

## 9. AUDIT & TRACEABILITY

### 9.1 Healing Event Log Schema

Every SHPR event — detection, diagnosis, fix generation, validation, deployment, rollback — produces an immutable, append-only audit record in `acgp_healing_logs`:

```jsonc
{
  "healing_id": "heal-20260420-screener-timeout-001",
  "phase": "DEPLOYED",
  "event": "AUTO_HEAL",
  "anomaly": {
    "signal_id": "sig-20260420-001",
    "type": "api_error_rate",
    "service": "market-data-1.ts",
    "severity": "high",
    "detected_at": "2026-04-20T00:47:35Z"
  },
  "diagnosis": {
    "diagnosis_id": "diag-20260420-portfolio-001",
    "root_cause": "Screener API 504 timeout, no retry logic",
    "confidence": 0.91,
    "financial_data_at_risk": false
  },
  "fix": {
    "fix_id": "fix-20260420-screener-timeout-001",
    "fix_type": "RETRY_LOGIC",
    "fix_zone": "API_RELIABILITY",
    "target_file": "server/services/data-enrichment-service.ts",
    "code_patch_hash": "sha256:aabb...",
    "fix_generator": "rule_based",
    "confidence": 0.91
  },
  "validation": {
    "stages_passed": ["static_analysis", "unit_tests", "staging_deploy", "shadow_replay"],
    "duration_ms": 287340,
    "compliance_integrity_verified": true
  },
  "approval": {
    "method": "auto",
    "approved_by": "SHPR_v1.0",
    "approved_at": "2026-04-20T00:52:18Z"
  },
  "deployment": {
    "strategy": "canary",
    "stages_completed": ["1pct", "10pct", "25pct", "100pct"],
    "rollback_triggered": false
  },
  "result": "SUCCESS",
  "issue_resolved": true,
  "time_to_heal_seconds": 287,
  "environment": "production",
  "shpr_version": "1.0.0",
  "timestamp": "2026-04-20T00:52:22Z"
}
```

### 9.2 Replay Capability

Every healing event must be **fully reproducible** from the audit log alone. A regulator or auditor must be able to reconstruct the complete sequence:

```
healing_id
    │
    ├── anomaly signal (raw metric values, timestamps)
    ├── diagnosis context (full RCA evidence)
    ├── fix generated (exact code patch, hash-verified)
    ├── validation results (all stage outputs)
    ├── approval record (who/what approved, when)
    ├── deployment progression (canary stages, traffic %)
    └── outcome (success/failure/rollback, resolution time)
```

No gap in this chain is permitted. If any link is missing, the healing event is flagged as `INCOMPLETE_AUDIT` and a Slack alert is sent to the engineering team.

### 9.3 Audit Log Storage Tiers

| Environment | Storage | Retention | Access | Signing |
|---|---|---|---|---|
| Development | Local JSONL | 7 days | Developer | None |
| Staging | DB table | 90 days | Engineering | HMAC |
| Production | DB + S3 Glacier | 7 years | Compliance + Mgmt | GPG signed |

### 9.4 SEBI & RBI Compliance Reporting

Monthly compliance report automatically generated from healing logs, containing:

- Total healing events by category (infrastructure / API / background services)
- List of all events that touched financially-adjacent services (for transparency)
- All human-approval events with approver identity and rationale
- All rollbacks and their root causes
- Zero-incident attestation for: financial logic, pricing, compliance rules

---

## 10. SAFETY GUARDRAILS (NON-NEGOTIABLE)

### 10.1 Hard Restrictions — Technical Enforcement

These restrictions are enforced at the **code level** in the fix generation engine, not as policy documentation. The engine physically cannot produce fixes that violate these rules.

```typescript
// SHPR Fix Generation Engine — Restricted File Patterns
const RESTRICTED_FILE_PATTERNS = [
  // Financial logic
  /server\/routes\/.*(order|trade|payment|ledger|pricing).*/,
  /server\/services\/.*(order|pricing|ledger|transaction|fee).*/,
  // Compliance
  /server\/services\/.*(kyc|aml|compliance|suitability).*/,
  /server\/middleware\/.*(kyc|auth|role).*/,
  // Schema (data integrity)
  /shared\/schema\/.*/,
  // Auth
  /server\/auth\.ts/,
];

// If target file matches any pattern → FIX GENERATION ABORTED
// Diagnosis context is saved, issue escalated to human on-call
```

```typescript
// SHPR Fix Generation Engine — Restricted Code Patterns (AST check on output)
const RESTRICTED_OUTPUT_PATTERNS = [
  "db.insert(orders",         // Order creation
  "db.insert(ledger",         // Ledger mutation
  "executeOrder(",            // Order execution
  "calculatePrice(",          // Price calculation
  "taxCalculat",              // Tax logic
  "validateKyc(",             // KYC validation
  "suitabilityCheck(",        // Suitability logic
  "aiGovernanceEngine",       // AI governance gate (only humans touch this)
];
```

### 10.2 Safe Healing Zones (Explicitly Whitelisted)

```
✅ Infrastructure layer
   - Memory management
   - Process restart
   - Connection pool tuning

✅ External API reliability
   - Retry logic (non-financial APIs)
   - Timeout configuration
   - Circuit breakers
   - Rate limit handling
   - Fallback to cache

✅ Background job reliability
   - Scheduler restart
   - Job retry logic
   - Dead letter queue handling

✅ Non-financial read endpoints
   - Market data display (not calculation)
   - Static content serving
   - Analytics dashboards (read-only)

✅ SSE / WebSocket / UI connectivity
   - Reconnection logic
   - Stream health checks
```

### 10.3 Golden Rule

> **If the SHPR cannot determine with certainty that a fix is isolated to the safe zone, it does not act. The default is always to escalate to a human.**

---

## 11. FAILSAFE DESIGN

### 11.1 If Auto-Healing Fails

```
Fix applied → anomaly persists → ROLLBACK triggered (< 30s)
                                          │
                                          ▼
                             Restore to last stable version
                                          │
                                          ▼
                             Service-level circuit breaker OPEN
                             (no further auto-healing on this service for 60 min)
                                          │
                                          ▼
                             PagerDuty P1 + Slack + email to on-call
                                          │
                                          ▼
                             Issue quarantined for manual engineering review
```

### 11.2 If Observability Layer Fails

If the SHPR cannot receive signals (log pipeline failure, metric scraper down):

```
Observability signal loss detected (> 30s without heartbeat)
         │
         ▼
SHPR enters SAFE MODE:
  - All auto-healing suspended
  - All canary rollouts paused (no new deployments)
  - No fixes generated or applied
  - Existing deployments continue running (do not roll back stable production)
         │
         ▼
PagerDuty + Slack alert: "SHPR SAFE MODE — observability lost"
         │
         ▼
SHPR resumes normal operation only after observability restored + 5-minute clean window
```

### 11.3 Global Kill Switch

A global kill switch is available to immediately halt all SHPR auto-healing operations:

```bash
# Emergency disable — requires two-person authorization (2FA + GPG)
node services/shpr/cli/kill-switch.js --disable --reason="..." --authorized-by="..."

# Re-enable (same authorization requirement)
node services/shpr/cli/kill-switch.js --enable --authorized-by="..."
```

Kill switch operations produce `event="KILL_SWITCH_ACTIVATED"` audit entries and trigger immediate PagerDuty notification to the engineering leadership team.

**When kill switch is active:**
- All pending auto-heals are cancelled
- No new healing pipelines are started
- All canary deployments are paused (not rolled back unless explicitly commanded)
- SHPR continues to monitor and log anomalies (observability is unaffected)
- Human engineering team assumes manual incident response

---

## 12. PERFORMANCE REQUIREMENTS

| Operation | Requirement | Measurement |
|---|---|---|
| Anomaly detection latency | < 5 seconds from event occurrence | P99 across all signal types |
| Root cause diagnosis | < 10 seconds | P95 for known failure patterns |
| Fix generation (rule-based) | < 5 seconds | P99 |
| Fix generation (LLM-assisted) | < 30 seconds | P95 |
| Validation — static analysis | < 5 seconds | P99 |
| Validation — unit tests | < 60 seconds | P99 |
| Validation — staging deploy | < 120 seconds | P99 |
| Validation — shadow replay | < 300 seconds | P99 |
| Total time to heal (auto) | < 10 minutes | P90 for safe fix types |
| Canary rollback execution | < 30 seconds | P99 |
| Full rollout (0% → 100%) | < 35 minutes | P90 |
| Audit log write | < 500ms | P99 — must not block healing pipeline |

---

## 13. CODE STRUCTURE

```
/server/services/shpr/
├── cli/
│   ├── validate.js              # Manual validation trigger
│   └── kill-switch.js           # Emergency disable/enable
│
├── observability/
│   ├── signal-normalizer.ts     # Canonical signal schema mapping
│   ├── signal-buffer.ts         # 60s rolling window ring buffer
│   └── heartbeat-monitor.ts     # Observability pipeline health check
│
├── anomaly/
│   ├── index.ts                 # Anomaly detection orchestrator
│   ├── threshold-detector.ts    # Threshold-based detection
│   ├── statistical-detector.ts  # Z-score baseline deviation
│   ├── pattern-detector.ts      # Sequence pattern analysis
│   └── severity-classifier.ts  # Severity assignment logic
│
├── diagnosis/
│   ├── index.ts                 # RCA orchestrator
│   ├── dependency-graph.ts      # Service dependency mapping
│   ├── change-correlator.ts     # Recent deployment correlation
│   ├── financial-risk-checker.ts # Financial scope classifier
│   └── context-builder.ts      # Diagnosis context object builder
│
├── fix-engine/
│   ├── index.ts                 # Fix generation orchestrator
│   ├── zone-classifier.ts       # Fix zone whitelist/restriction check
│   ├── rule-library/            # Deterministic fix templates
│   │   ├── retry-logic.ts
│   │   ├── timeout-tuning.ts
│   │   ├── null-guard.ts
│   │   ├── fallback-routing.ts
│   │   ├── circuit-breaker.ts
│   │   └── cache-invalidation.ts
│   └── llm-assist.ts            # LLM-assisted fix generation
│
├── validation/
│   ├── index.ts                 # Validation pipeline orchestrator
│   ├── static-analysis.ts       # AST + ACGP policy check
│   ├── test-runner.ts           # Unit test execution
│   ├── staging-deployer.ts      # Ephemeral staging deploy
│   ├── shadow-replayer.ts       # Production traffic replay
│   └── compliance-checker.ts   # Financial integrity verification
│
├── decision/
│   ├── index.ts                 # Decision engine
│   ├── approval-matrix.ts       # Confidence × validation → action
│   └── human-in-loop.ts        # PagerDuty + Slack approval flow
│
├── deployment/
│   ├── index.ts                 # Deployment orchestrator
│   ├── canary-controller.ts     # Progressive rollout (1/10/25/100%)
│   ├── health-monitor.ts        # Canary health surveillance
│   └── rollback-executor.ts    # Instant rollback to stable
│
├── audit/
│   ├── logger.ts                # Immutable audit log writer
│   ├── replay-builder.ts        # Full event chain reconstruction
│   ├── compliance-reporter.ts   # SEBI/RBI monthly report generator
│   └── schema.ts                # Healing log Zod schema
│
└── config/
    ├── default.json             # Thresholds, timeouts, confidence levels
    ├── staging.json             # Staging-specific overrides
    └── production.json          # Production overrides (zero-tolerance)
```

---

## 14. PROHIBITED BEHAVIORS

| # | Prohibited Behavior | Technical Enforcement |
|---|---|---|
| 1 | Autonomous changes to financial calculation logic | Restricted file pattern check — engine aborts |
| 2 | Autonomous changes to order/transaction processing | Restricted file pattern check — engine aborts |
| 3 | Applying untested fixes (validation skipped) | Pipeline is linear — no skip path exists |
| 4 | Deploying without audit log write confirmation | Deployment blocked if audit write fails |
| 5 | Silent canary deployments (no monitoring) | Health monitor is mandatory; rollout blocked without it |
| 6 | Acting on CRITICAL severity anomalies autonomously | Severity classifier routes CRITICAL to human-only path |
| 7 | Continuing canary rollout after rollback threshold exceeded | Rollback executor fires automatically, rollout controller has no override |
| 8 | Using kill switch without two-person authorization | CLI requires dual GPG signatures |
| 9 | LLM-generated fix applied without human approval | Approval matrix always routes LLM fixes to `REQUIRE_HUMAN_APPROVAL` |
| 10 | Operating without observability (blind auto-healing) | Heartbeat monitor triggers SAFE MODE immediately |

---

## 15. FINAL EXECUTION DIRECTIVE

### What SHPR MUST do when active in production:

1. **Monitor continuously** — observability signals are processed in real time, 24/7, with no maintenance windows
2. **Detect with precision** — three detection algorithms (threshold, statistical, pattern) run in parallel to minimize false negatives
3. **Diagnose before acting** — no fix is generated without a confirmed root cause; RCA confidence must exceed 0.60
4. **Classify zone** — the fix zone is determined before fix generation begins; any restricted zone immediately escalates to human
5. **Validate exhaustively** — four validation stages must all pass before the decision engine is reached
6. **Deploy conservatively** — canary rollout with continuous monitoring; immediate rollback on any health threshold breach
7. **Audit completely** — every decision produces an immutable, GPG-signed, replay-capable log entry

### What SHPR must never do:

> SHPR **never** modifies financial logic, pricing, compliance rules, or order execution paths — autonomously or otherwise.  
> SHPR **never** deploys to production without a passing validation suite.  
> SHPR **never** acts when observability is compromised.  
> SHPR **never** suppresses an audit log entry in any scenario.

---

## 16. FINTEKPRO FINOS — FULL STACK POSITION

With SHPR v1.0 operational, FintekPro's AI intelligence layer is complete:

```
┌──────────────────────────────────────────────────────────────────┐
│                   FINTEKPRO FinOS v1.0                          │
├──────────────────────────────────────────────────────────────────┤
│  ADVISORY LAYER                                                  │
│  ├── AI Advisory Engine (Gemini-backed recommendations)         │
│  ├── AI Governance Engine (AAGE — compliance gate)              │
│  ├── AI Recommendation Scoring Engine (ARSE)                    │
│  └── AI Model Selection Engine (AMSE)                           │
├──────────────────────────────────────────────────────────────────┤
│  QUANTITATIVE LAYER                                              │
│  ├── MVO / Black-Litterman Portfolio Optimizer                  │
│  ├── AI Portfolio Simulation Engine (APSE)                      │
│  ├── Autonomous Portfolio Rebalancing Engine (APRE)             │
│  └── Unified Risk Capital Allocation Engine (URCAE)             │
├──────────────────────────────────────────────────────────────────┤
│  FINANCIAL SERVICES LAYER                                        │
│  ├── Mutual Fund Engine (CAMS/KFintech CAS integration)         │
│  ├── Bond Marketplace + Order Execution                         │
│  ├── US Equities (Alpaca Broker API)                            │
│  ├── AIF / PMS Store                                            │
│  └── ITR + Tax Smart Filing                                     │
├──────────────────────────────────────────────────────────────────┤
│  PLATFORM LAYER                                                  │
│  ├── Multi-tier KYC (Aadhaar / Video / DigiLocker)             │
│  ├── Agent + Client + DSA Role System                           │
│  ├── B2B White-Label API Platform                               │
│  └── Zoho CRM Integration                                       │
├──────────────────────────────────────────────────────────────────┤
│  CODE GOVERNANCE LAYER (ACGP v1.0)                              │
│  ├── AI Code Interceptor (pre-write hook)                       │
│  ├── 40-Rule Policy Engine (Core / FintekPro / AI packs)       │
│  ├── AST-Based Code Rewrite Engine                              │
│  └── Immutable Code Audit Trail                                 │
├──────────────────────────────────────────────────────────────────┤
│  SELF-HEALING RUNTIME (SHPR v1.0)     ← YOU ARE HERE            │
│  ├── Observability Signal Pipeline                              │
│  ├── Anomaly Detection (3 algorithms)                           │
│  ├── Root Cause Diagnosis Engine                                │
│  ├── Guardrailed Fix Generation (10 fix types)                  │
│  ├── 4-Stage Validation Sandbox                                 │
│  ├── Canary Deployment + Instant Rollback                       │
│  └── SEBI/RBI-Compliant Audit Trail                             │
└──────────────────────────────────────────────────────────────────┘
```

> **FintekPro is now a self-monitoring, self-correcting, compliance-aware financial operating system.**  
> **Controlled. Auditable. Regulator-defensible. Production-grade.**

---

*Document version: 1.0.0 | Last updated: 2026-04-20 | Next review: 2026-07-20*  
*Owner: FintekPro Platform Engineering / SRE | Classification: Internal — Engineering Policy*  
*Regulatory scope: SEBI (Investment Advisor Regulations 2013) | RBI (Payment System Regulations)*
