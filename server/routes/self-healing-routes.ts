/**
 * Self-Healing Admin Routes
 *
 * Accessible only to admins. Exposes:
 *  GET  /api/admin/self-healing/status              — full system health snapshot
 *  GET  /api/admin/self-healing/circuit-breakers     — all circuit breaker states
 *  POST /api/admin/self-healing/circuit-breakers/reset — reset open breakers
 *  POST /api/admin/self-healing/recover/:action      — trigger a specific recovery action
 *  GET  /api/admin/self-healing/events               — recent healing event log
 */

import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/roleMiddleware';
import {
  getSystemHealthSnapshot,
  getAllCircuitBreakers,
  resetAllCircuitBreakers,
  resetCircuitBreaker,
  triggerManualRecovery,
  type RecoveryAction,
} from '../services/auto-recovery-service';
import { getFeedbackStats, routeFixStrategy, type GuardedModule } from '../services/guarded-execution';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

const VALID_ACTIONS: RecoveryAction[] = [
  'flush_lru_cache',
  'clear_sandbox_token',
  'reset_python_circuit',
  'reset_all_circuits',
  'flush_ai_response_cache',
  'flush_distributed_cache',
  'gc_collect',
];

// ── GET /status ───────────────────────────────────────────────────────────────
router.get('/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const snapshot = await getSystemHealthSnapshot();
    res.json({ success: true, ...snapshot });
  } catch (err: any) {
    console.error('[SelfHealing] Status error:', err);
    res.status(500).json({ error: 'Failed to retrieve system health snapshot' });
  }
});

// ── GET /circuit-breakers ─────────────────────────────────────────────────────
router.get('/circuit-breakers', requireAdmin, async (req: Request, res: Response) => {
  try {
    const breakers = getAllCircuitBreakers();
    res.json({
      success: true,
      total: breakers.length,
      open: breakers.filter(b => b.status === 'open').length,
      breakers,
    });
  } catch (err: any) {
    console.error('[SelfHealing] Circuit breaker list error:', err);
    res.status(500).json({ error: 'Failed to list circuit breakers' });
  }
});

// ── POST /circuit-breakers/reset (reset all open) ────────────────────────────
router.post('/circuit-breakers/reset', requireAdmin, async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id || 'unknown';
    const { service } = req.body;

    if (service) {
      resetCircuitBreaker(service);
      console.log(`[SelfHealing] Circuit breaker reset for service "${service}" by admin ${adminId}`);
      res.json({ success: true, message: `Circuit breaker for "${service}" reset` });
    } else {
      const reset = resetAllCircuitBreakers();
      console.log(`[SelfHealing] All circuit breakers reset by admin ${adminId}: ${reset.join(', ')}`);
      res.json({ success: true, reset, message: `${reset.length} circuit breaker(s) reset` });
    }
  } catch (err: any) {
    console.error('[SelfHealing] Circuit breaker reset error:', err);
    res.status(500).json({ error: 'Failed to reset circuit breakers' });
  }
});

// ── POST /recover/:action ─────────────────────────────────────────────────────
router.post('/recover/:action', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { action } = req.params as { action: string };
    const adminId = (req as any).user?.id || 'unknown';

    if (!VALID_ACTIONS.includes(action as RecoveryAction)) {
      return res.status(400).json({
        error: `Unknown action "${action}"`,
        validActions: VALID_ACTIONS,
      });
    }

    const result = await triggerManualRecovery(action as RecoveryAction, adminId);

    res.json({
      success: result.success,
      action: result.action,
      message: result.message,
      durationMs: result.durationMs,
    });
  } catch (err: any) {
    console.error('[SelfHealing] Manual recovery error:', err);
    res.status(500).json({ error: 'Failed to run recovery action' });
  }
});

// ── GET /events ───────────────────────────────────────────────────────────────
router.get('/events', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
    const offset = parseInt((req.query.offset as string) || '0', 10);

    let rows: any[] = [];
    try {
      const result = await db.execute(sql`
        SELECT id, event_type, trigger_message, action_taken, success, message, context, occurred_at
        FROM self_healing_events
        ORDER BY occurred_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
      rows = result.rows as any[];
    } catch {
      // Table not yet created — return empty set gracefully
    }

    res.json({ success: true, events: rows, limit, offset });
  } catch (err: any) {
    console.error('[SelfHealing] Events fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch healing events' });
  }
});

// ── GET /feedback ─────────────────────────────────────────────────────────────
// Data feedback loop: error → module → fix strategy → success rate
router.get('/feedback', requireAdmin, async (req: Request, res: Response) => {
  try {
    const hours = parseInt((req.query.hours as string) || '24', 10);
    const stats = await getFeedbackStats(Math.min(hours, 720));

    // Enrich each module row with its fix strategy and risk routing
    const enriched = stats.byModule.map((row) => ({
      ...row,
      fixStrategy: routeFixStrategy(row.module as GuardedModule),
    }));

    res.json({
      success: true,
      hoursWindow: stats.summary.hoursWindow,
      summary: stats.summary,
      byModule: enriched,
      recentFailures: stats.recentFailures,
    });
  } catch (err: any) {
    console.error('[SelfHealing] Feedback stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve feedback stats' });
  }
});

// ── GET /actions (introspection) ──────────────────────────────────────────────
router.get('/actions', requireAdmin, (_req: Request, res: Response) => {
  const descriptions: Record<RecoveryAction, string> = {
    flush_lru_cache: 'Flush the in-memory LRU / distributed cache (reduces memory pressure)',
    clear_sandbox_token: 'Clear the cached Sandbox.co.in auth token — next request re-authenticates',
    reset_python_circuit: 'Reset the Python sidecar circuit breaker so the next call probes the service',
    reset_all_circuits: 'Reset ALL open circuit breakers at once',
    flush_ai_response_cache: 'Clear the AI (Gemini) response cache',
    flush_distributed_cache: 'Purge expired rows from the distributed DB cache table',
    gc_collect: 'Force a Node.js garbage collection cycle (requires --expose-gc flag)',
  };

  res.json({
    success: true,
    actions: VALID_ACTIONS.map(action => ({ action, description: descriptions[action] })),
  });
});

export default router;
