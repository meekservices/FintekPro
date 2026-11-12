🏢 FintekPro B2B White-Label AI Infrastructure Policy (v1.0)

0. SYSTEM OBJECTIVE & REGULATORY MANDATE
Extend FintekPro's institutional-grade AI advisory and governance layers to third-party B2B partners (RIAs, Brokers, Wealth Managers, NBFCs) while maintaining absolute security, multi-tenant isolation, and regulatory hygiene under:
- Securities and Exchange Board of India (SEBI RIA Regs 2013, Regulation 22 arm's-length segregation, RA Regs 2014, PMS Regs 2020)
- Reserve Bank of India (RBI Digital Lending Guidelines 2022/2024, RE/LSP boundaries, IT outsourcing norms)
- Income Tax Department / CBDT (Statutory capital gains, STCG/LTCG, TDS/TCS calculation integrity)
- AMFI (EUIN/ARN attribution, code of conduct compliance)
- DPDP Act 2023 & MeitY (Strict tenant PII firewall, pseudonymization before AI processing, zero multi-tenant data leakage)
- FIU-IND / PMLA 2002 (Statutory 7-year transaction record retention, AML/PEP validation)
- CERT-In & CSCRF (Sub-50ms NTP time stamping, tenant breach isolation, 6-hour incident disclosure)

1. TENANT ISOLATION (NON-NEGOTIABLE)
1.1 Logical Separation
Every B2B Partner (Tenant) MUST have strict logical data separation.
AI contexts, user profiles, and recommendation history MUST NOT leak across Tenant boundaries.
1.2 Identity Management
All API requests MUST be authenticated via Tenant-specific, hashed API keys.
Requests MUST include a valid `Tenant-ID` header for trace logging.

2. API GOVERNANCE & SECURITY
2.1 Active Redis Distributed Rate Limiting
Strict Token-Bucket rate limiting enforced across all Cloud Run pods via Active Redis (`ratelimit:b2b:{tenantId}:{tier}`):
- Standard: 10 requests/second (Burst: 20)
- Enterprise: 50 requests/second (Burst: 100)
- Redis sub-millisecond atomic counter checks prevent cross-pod concurrency spikes.
2.2 Payload Validation
Every incoming request MUST be validated against strict JSON schemas.
Malformed or non-compliant payloads MUST be rejected before hitting the AI or Financial engines.
2.3 Webhook Integrity
Asynchronous payloads dispatched via Webhooks MUST be signed with HMAC-SHA256 signatures.
Partners MUST verify signatures before ingesting results.

3. SHARED RESPONSIBILITY MODEL
3.1 FintekPro Responsibilities
- Infrastructure uptime and AI model availability.
- Quantitative correctness of financial engines (DCF, URCAE, etc.).
- Enforcement of standard SEBI/RBI compliance blocks (AAGE).
3.2 Partner Responsibilities
- Client Suitability: Final verification that a recommendation fits their specific end-user context.
- Legal Disclosure: Presenting required regulatory disclaimers in their own UI/UX.
- Permissioning: Managing their own internal staff access to the FintekPro API.

4. B2B ADVISORY DELEGATION
4.1 The "Governance Relay"
If a Partner has their own licensed compliance team (RIA/Stockbroker), they may request "Flexible Governance" where certain non-critical AAGE `MODIFY` warnings can be suppressed in favor of Partner-side overrides.
4.2 Hard Blocks
CRITICAL suitability blocks (e.g., high-risk assets to minor users) are SYSTEM-WIDE and CANNOT be overridden by any B2B Tenant.

5. AUDIT & TRACEABILITY (STATUTORY 7-YEAR WORM RETENTION)
5.1 Partner Statutory Audit Trails
Partners MUST have continuous access to their own transaction/advisory audit logs for regulatory inspection. All partner-facing logs are persisted immutably in PostgreSQL for minimum 7 years in compliance with SEBI RIA Reg 19, PMS Reg 22, and PMLA Section 12.
5.2 Trace ID Continuity
Every advisory generated via API MUST carry a unique `Trace-ID` that persists from `User Query` -> `Execution` -> `Reporting`.
5.3 Tenant Isolation in Redis Cache
Tenant caches in Active Redis MUST be strictly key-spaced (`b2b:{tenantId}:cache:*`) to prevent cross-tenant information bleed.

6. PERFORMANCE SERVICE LEVEL AGREEMENTS (SLA)
6.1 Latency Targets
- Simple Advisory Generation: < 2 seconds.
- Complex Portfolio Simulation: < 5 seconds (Async recommended).
6.2 Availability
Target 99.9% availability for key AI Infrastructure endpoints.

7. PROHIBITED B2B PRACTICES
❌ Recursive looping of AI models.
❌ Reverse-engineering FintekPro's proprietary quant models via high-volume probing.
❌ Sub-licensing API access to non-verified fourth-party entities.
❌ Deploying or serving synthetic or cooked-up formulas disguised as institutional quantitative analytics.
❌ Exposing or referencing third-party competitor/consumer brand names (e.g., Smallcase, Dezerv, Zerodha, Groww) in user-facing UI, metric cards, titles, or advisory execution terminology.

7.1 BRAND NEUTRALITY & TERMINOLOGY
All tenant portals, advisory execution engines, and proposal dispatchers MUST use SEBI-compliant generic wealthtech terms (e.g., `Non-Discretionary Gateway`, `Client-Authorized Model`, `Curated Basket Execution`) to preserve tenant white-label integrity.

8. FAILSAFE DESIGN
8.1 System-Wide Kill Switch
FintekPro reserves the right to suspend any Tenant API Key immediately in the event of:
- Malicious traffic spikes.
- Evidence of regulatory breach.
- Failure to maintain valid KYC/Whitelabel credentials.

9. FINAL EXECUTION DIRECTIVE
You are building the FintekPro B2B Infrastructure.
You MUST ensure that every Partner request is:
- Isolated
- Authenticated
- Rate-limited
- Audited
- Compliant with both FintekPro and Partner policies.

White-labeling is a privilege, NOT a right. Security over speed.
