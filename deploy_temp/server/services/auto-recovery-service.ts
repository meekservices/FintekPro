/**
 * FintekPro Auto-Recovery Service
 *
 * Pattern-to-action self-healing engine. Integrates with:
 *  - Python client circuit breaker (existing)
 *  - Error tracking system (existing)
 *  - Supervisor crash events (new supervisor bridge)
 *
 * Actions are rate-limited (max 1 per 5 min per action type) so repeated
 * errors don't trigger an endless recovery storm.
 *
 * Registered circuit breakers track state for all external services.
 * Any service can register/update its own breaker via registerCircuitBreaker().
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { clearSandboxToken } from '../utils/sandbox-config';

// ── Circuit breaker registry ──────────────────────────────────────────────────

export interface CircuitBreakerState {
  service: string;
  status: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureAt: Date | null;
  openUntil: Date | null;
  lastSuccessAt: Date | null;
  totalRecoveries: number;
}

const circuitRegistry = new Map<string, CircuitBreakerState>();

export function registerCircuitBreaker(service: string, state: Partial<CircuitBreakerState>): void {
  const existing = circuitRegistry.get(service);
  circuitRegistry.set(service, {
    service,
    status: 'closed',
    failureCount: 0,
    lastFailureAt: null,
    openUntil: null,
    lastSuccessAt: null,
    totalRecoveries: 0,
    ...existing,
    ...state,
  });
}

export function updateCircuitBreaker(service: string, update: Partial<CircuitBreakerState>): void {
  const existing = circuitRegistry.get(service) ?? {
    service,
    status: 'closed' as const,
    failureCount: 0,
    lastFailureAt: null,
    openUntil: null,
    lastSuccessAt: null,
    totalRecoveries: 0,
  };
  circuitRegistry.set(service, { ...existing, ...update });
}

export function getAllCircuitBreakers(): CircuitBreakerState[] {
  return Array.from(circuitRegistry.values());
}

export function resetCircuitBreaker(service: string): void {
  const existing = circuitRegistry.get(service);
  if (existing) {
    circuitRegistry.set(service, {
      ...existing,
      status: 'closed',
      failureCount: 0,
      openUntil: null,
    });
  }
}

export function resetAllCircuitBreakers(): string[] {
  const reset: string[] = [];
  for (const [name, state] of circuitRegistry.entries()) {
    if (state.status !== 'closed') {
      circuitRegistry.set(name, { ...state, status: 'closed', failureCount: 0, openUntil: null });
      reset.push(name);
    }
  }
  return reset;
}

// ── Recovery action rate limiter ──────────────────────────────────────────────

const lastRecoveryAt = new Map<string, number>(); // action → epoch ms
const RECOVERY_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function canRunRecovery(action: string): boolean {
  const last = lastRecoveryAt.get(action) ?? 0;
  return Date.now() - last >= RECOVERY_COOLDOWN_MS;
}

function markRecoveryRan(action: string): void {
  lastRecoveryAt.set(action, Date.now());
}

// ── Recovery actions ──────────────────────────────────────────────────────────

export type RecoveryAction =
  | 'flush_lru_cache'
  | 'clear_sandbox_token'
  | 'reset_python_circuit'
  | 'reset_all_circuits'
  | 'flush_ai_response_cache'
  | 'flush_distributed_cache'
  | 'gc_collect';

interface RecoveryResult {
  action: RecoveryAction;
  success: boolean;
  message: string;
  skippedCooldown?: boolean;
  durationMs: number;
}

async function runRecoveryAction(action: RecoveryAction, force = false): Promise<RecoveryResult> {
  const start = Date.now();

  if (!force && !canRunRecovery(action)) {
    const remaining = Math.ceil((RECOVERY_COOLDOWN_MS - (Date.now() - (lastRecoveryAt.get(action) ?? 0))) / 1000);
    return {
      action,
      success: false,
      message: `Rate-limited: ${remaining}s remaining before next ${action} allowed`,
      skippedCooldown: true,
      durationMs: Date.now() - start,
    };
  }

  markRecoveryRan(action);

  try {
    switch (action) {
      case 'flush_lru_cache': {
        // Dynamic import to avoid circular dependency
        const { distributedCache } = await import('../utils/distributed-cache').catch(() => ({ distributedCache: null }));
        if (distributedCache && typeof (distributedCache as any).flush === 'function') {
          await (distributedCache as any).flush();
          return { action, success: true, message: 'LRU/distributed cache flushed', durationMs: Date.now() - start };
        }
        // Force GC as fallback
        if (global.gc) global.gc();
        return { action, success: true, message: 'GC triggered (no cache service available)', durationMs: Date.now() - start };
      }

      case 'clear_sandbox_token': {
        clearSandboxToken();
        return { action, success: true, message: 'Sandbox.co.in auth token cleared — next request will re-authenticate', durationMs: Date.now() - start };
      }

      case 'reset_python_circuit': {
        const { getPythonHealthState } = await import('../clients/python-client');
        const state = getPythonHealthState();
        updateCircuitBreaker('python_sidecar', {
          status: state.circuitOpen ? 'open' : 'closed',
          lastSuccessAt: state.lastSuccessAt,
        });
        // The Python client manages its own circuit breaker state internally;
        // we reset our registry view and let the client half-open naturally
        resetCircuitBreaker('python_sidecar');
        return { action, success: true, message: 'Python sidecar circuit breaker reset — next call will probe the service', durationMs: Date.now() - start };
      }

      case 'reset_all_circuits': {
        const reset = resetAllCircuitBreakers();
        return { action, success: true, message: `Reset ${reset.length} circuit breaker(s): ${reset.join(', ') || 'none were open'}`, durationMs: Date.now() - start };
      }

      case 'flush_ai_response_cache': {
        const { aiResponseCacheService } = await import('./ai-response-cache-service').catch(() => ({ aiResponseCacheService: null }));
        if (aiResponseCacheService && typeof (aiResponseCacheService as any).clearAll === 'function') {
          await (aiResponseCacheService as any).clearAll();
          return { action, success: true, message: 'AI response cache cleared', durationMs: Date.now() - start };
        }
        return { action, success: true, message: 'AI response cache service not available — skipped', durationMs: Date.now() - start };
      }

      case 'flush_distributed_cache': {
        await db.execute(sql`DELETE FROM cache WHERE expires_at < NOW()`);
        return { action, success: true, message: 'Expired distributed cache rows purged from DB', durationMs: Date.now() - start };
      }

      case 'gc_collect': {
        if (global.gc) {
          global.gc();
          const mem = process.memoryUsage();
          return { action, success: true, message: `GC triggered — heap after: ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`, durationMs: Date.now() - start };
        }
        return { action, success: false, message: 'GC not exposed — run Node with --expose-gc to enable', durationMs: Date.now() - start };
      }

      default:
        return { action, success: false, message: `Unknown action: ${action}`, durationMs: Date.now() - start };
    }
  } catch (err: any) {
    return {
      action,
      success: false,
      message: `Recovery action threw: ${err.message}`,
      durationMs: Date.now() - start,
    };
  }
}

// ── Error-to-recovery pattern matching ───────────────────────────────────────

interface ErrorPattern {
  pattern: RegExp;
  actions: RecoveryAction[];
  description: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /ECONNREFUSED|ETIMEDOUT|ENOTFOUND.*sandbox\.co\.in/i,
    actions: ['clear_sandbox_token'],
    description: 'Sandbox.co.in connectivity failure — token cleared',
  },
  {
    pattern: /python.*service.*unavailable|circuit.*open|502.*python/i,
    actions: ['reset_python_circuit'],
    description: 'Python sidecar circuit opened — reset scheduled',
  },
  {
    pattern: /heap.*out.*of.*memory|js.*heap|javascript.*heap/i,
    actions: ['flush_lru_cache', 'flush_distributed_cache', 'gc_collect'],
    description: 'Memory pressure detected — cache flush + GC',
  },
  {
    pattern: /AI.*cache.*stale|gemini.*429|rate.*limit.*exceeded/i,
    actions: ['flush_ai_response_cache'],
    description: 'AI rate limit or stale cache — AI cache cleared',
  },
  {
    pattern: /cache.*corrupt|integrity.*error.*cache/i,
    actions: ['flush_lru_cache', 'flush_distributed_cache'],
    description: 'Cache corruption detected — full cache flush',
  },
];

export async function handleErrorWithAutoRecovery(
  errorMessage: string,
  context: string = 'unknown',
): Promise<{ triggered: boolean; actions: RecoveryResult[] }> {
  const triggered: RecoveryResult[] = [];

  for (const { pattern, actions, description } of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      console.log(`[AutoRecovery] Pattern matched for "${context}": ${description}`);
      for (const action of actions) {
        const result = await runRecoveryAction(action);
        triggered.push(result);
        await logHealingEvent({
          eventType: 'auto_recovery',
          trigger: errorMessage.substring(0, 300),
          action,
          success: result.success,
          message: result.message,
          context,
        });
      }
      break; // only first matching pattern
    }
  }

  return { triggered: triggered.length > 0, actions: triggered };
}

// ── Self-healing event log ────────────────────────────────────────────────────

interface HealingEvent {
  eventType: 'auto_recovery' | 'manual_recovery' | 'circuit_opened' | 'circuit_reset' | 'supervisor_restart' | 'health_check_fail';
  trigger?: string;
  action?: string;
  success?: boolean;
  message?: string;
  context?: string;
}

export async function logHealingEvent(event: HealingEvent): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO self_healing_events
        (event_type, trigger_message, action_taken, success, message, context, occurred_at)
      VALUES
        (${event.eventType}, ${event.trigger ?? null}, ${event.action ?? null},
         ${event.success ?? null}, ${event.message ?? null}, ${event.context ?? null}, NOW())
    `);
  } catch {
    // Non-fatal — table might not exist yet in dev or during first boot
  }
}

// ── Manual trigger (admin API) ────────────────────────────────────────────────

export async function triggerManualRecovery(
  action: RecoveryAction,
  adminId: string,
): Promise<RecoveryResult> {
  console.log(`[AutoRecovery] Manual trigger: ${action} by ${adminId}`);
  const result = await runRecoveryAction(action, true /* force = bypass cooldown */);
  await logHealingEvent({
    eventType: 'manual_recovery',
    action,
    success: result.success,
    message: result.message,
    context: `admin:${adminId}`,
  });
  return result;
}

// ── System health snapshot ────────────────────────────────────────────────────

export async function getSystemHealthSnapshot() {
  const mem = process.memoryUsage();
  const uptime = process.uptime();

  let pythonState = null;
  try {
    const { getPythonHealthState } = await import('../clients/python-client');
    pythonState = getPythonHealthState();
    // Sync to registry
    updateCircuitBreaker('python_sidecar', {
      status: pythonState.circuitOpen ? 'open' : 'closed',
      failureCount: pythonState.consecutiveFailures,
      lastSuccessAt: pythonState.lastSuccessAt,
      openUntil: pythonState.circuitOpenUntil,
    });
  } catch { /* optional */ }

  const circuits = getAllCircuitBreakers();
  const openCircuits = circuits.filter(c => c.status === 'open');

  let recentEvents: any[] = [];
  try {
    const rows = await db.execute(sql`
      SELECT event_type, action_taken, success, message, occurred_at
      FROM self_healing_events
      ORDER BY occurred_at DESC
      LIMIT 20
    `);
    recentEvents = rows.rows as any[];
  } catch { /* table may not exist yet */ }

  return {
    process: {
      uptimeSeconds: Math.round(uptime),
      memoryMB: {
        heapUsed: +(mem.heapUsed / 1024 / 1024).toFixed(1),
        heapTotal: +(mem.heapTotal / 1024 / 1024).toFixed(1),
        rss: +(mem.rss / 1024 / 1024).toFixed(1),
        external: +(mem.external / 1024 / 1024).toFixed(1),
      },
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'development',
    },
    circuitBreakers: {
      total: circuits.length,
      open: openCircuits.length,
      services: circuits,
    },
    recovery: {
      recentEvents,
      cooldowns: Object.fromEntries(
        Array.from(lastRecoveryAt.entries()).map(([action, ts]) => [
          action,
          {
            lastRanAt: new Date(ts).toISOString(),
            cooldownRemainingSeconds: Math.max(0, Math.ceil((RECOVERY_COOLDOWN_MS - (Date.now() - ts)) / 1000)),
          },
        ])
      ),
    },
    overallStatus: openCircuits.length > 0 ? 'degraded' : 'healthy',
  };
}

// ── Boot-time registration of known external services ─────────────────────────

export function initAutoRecoveryService(): void {
  const services = [
    'python_sidecar',
    'sandbox_co_in',
    'cashfree_secure_id',
    'alpaca_sse',
    'finnhub',
    'ifsc_lookup',
    'icai_scraper',
    'zoho_books',
    'razorpay_ifsc',
  ];
  for (const svc of services) {
    registerCircuitBreaker(svc, {});
  }
  console.log(`✅ Auto-Recovery Service initialized (${services.length} circuit breakers registered)`);
}
