import { Express, Response } from 'express';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { adminService } from '../../admin-service';
import { mfComplianceStateMachine } from '../../services/mf-compliance-state-machine';
import mfNamingComplianceService from '../../services/mf-naming-compliance-service';
import mfLifecycleGlidePathService from '../../services/mf-lifecycle-glide-path-service';
import mfSebiOverlapService from '../../services/mf-sebi-overlap-service';
import sebiCategoryEngine from '../../services/mf-sebi-category-engine';
import { amfiSubscriptionSyncService } from '../../services/amfi-subscription-sync-service';

const requireAdmin = async (req: any, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const isAdmin = await adminService.isAdmin(req.user.id);
  if (!isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

export function registerSEBIComplianceRoutes(app: Express): void {

  // ── 1. GET /api/admin/sebi/taxonomy ────────────────────────────────────────
  // List all taxonomy versions with category and subcategory counts
  app.get('/api/admin/sebi/taxonomy', requireAdmin, async (req, res) => {
    try {
      const versionsResult = await db.execute(sql`
        SELECT
          tv.id, tv.version, tv.sebi_circular_ref, tv.effective_date,
          tv.description, tv.is_active, tv.created_at,
          COUNT(DISTINCT cm.id) as category_count,
          COUNT(DISTINCT sm.id) as subcategory_count
        FROM mf_taxonomy_versions tv
        LEFT JOIN mf_category_master cm ON cm.taxonomy_version = tv.version
        LEFT JOIN mf_subcategory_master sm ON sm.taxonomy_version = tv.version
        GROUP BY tv.id, tv.version, tv.sebi_circular_ref, tv.effective_date,
                 tv.description, tv.is_active, tv.created_at
        ORDER BY tv.effective_date DESC
      `);
      const versions = (versionsResult as any).rows || [];

      const categoriesResult = await db.execute(sql`
        SELECT cm.*, COUNT(sm.id) as subcategory_count
        FROM mf_category_master cm
        LEFT JOIN mf_subcategory_master sm ON sm.group_code = cm.group_code AND sm.taxonomy_version = cm.taxonomy_version
        GROUP BY cm.id
        ORDER BY cm.taxonomy_version, cm.group_code
      `);
      const categories = (categoriesResult as any).rows || [];

      const subcategoriesResult = await db.execute(sql`
        SELECT * FROM mf_subcategory_master ORDER BY taxonomy_version, group_code, subcategory_code
      `);
      const subcategories = (subcategoriesResult as any).rows || [];

      res.json({ success: true, versions, categories, subcategories });
    } catch (err: any) {
      console.error('[SEBI Admin] taxonomy error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── 2. GET /api/admin/sebi/compliance-dashboard ────────────────────────────
  // Aggregate compliance status counts + recent state log
  app.get('/api/admin/sebi/compliance-dashboard', requireAdmin, async (req, res) => {
    try {
      const statusCountsResult = await db.execute(sql`
        SELECT compliance_status, COUNT(*) as count
        FROM mutual_funds
        WHERE compliance_status IS NOT NULL
        GROUP BY compliance_status
        ORDER BY count DESC
      `);
      const statusCounts = (statusCountsResult as any).rows || [];

      const namingFailuresResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM mutual_funds WHERE naming_validation_status = 'FAILED'
      `);
      const namingFailures = parseInt((namingFailuresResult as any).rows?.[0]?.count || '0');

      const overlapBreachesResult = await db.execute(sql`
        SELECT COUNT(*) as total_pairs,
               COUNT(*) FILTER (WHERE breach_flag = true) as breach_pairs
        FROM mf_overlap_matrix
      `);
      const overlapStats = (overlapBreachesResult as any).rows?.[0] || {};

      const glidePathInvalidResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM mutual_funds WHERE compliance_status = 'GLIDE_PATH_INVALID'
      `);
      const glidePathInvalid = parseInt((glidePathInvalidResult as any).rows?.[0]?.count || '0');

      const pendingResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM mutual_funds WHERE compliance_status = 'PENDING' OR compliance_status IS NULL
      `);
      const pendingCount = parseInt((pendingResult as any).rows?.[0]?.count || '0');

      const recentLogsResult = await db.execute(sql`
        SELECT csl.*, mf.scheme_name
        FROM mf_compliance_state_log csl
        LEFT JOIN mutual_funds mf ON mf.scheme_code = csl.scheme_code
        ORDER BY csl.triggered_at DESC
        LIMIT 20
      `);
      const recentLogs = (recentLogsResult as any).rows || [];

      const lifecycleCountResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM mutual_funds WHERE lifecycle_metadata IS NOT NULL
      `);
      const lifecycleCount = parseInt((lifecycleCountResult as any).rows?.[0]?.count || '0');

      res.json({
        success: true,
        summary: {
          statusBreakdown: statusCounts,
          namingFailures,
          overlapPairsComputed: parseInt(overlapStats.total_pairs || '0'),
          overlapBreachPairs: parseInt(overlapStats.breach_pairs || '0'),
          glidePathInvalid,
          lifecycleFunds: lifecycleCount,
          pendingReview: pendingCount,
        },
        recentStateChanges: recentLogs,
      });
    } catch (err: any) {
      console.error('[SEBI Admin] dashboard error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── 3. GET /api/admin/sebi/overlap-breaches ────────────────────────────────
  // All scheme pairs with breach_flag = true
  app.get('/api/admin/sebi/overlap-breaches', requireAdmin, async (req, res) => {
    try {
      const breaches = await mfSebiOverlapService.getOverlapBreaches();
      res.json({ success: true, count: breaches.length, breaches });
    } catch (err: any) {
      console.error('[SEBI Admin] overlap-breaches error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── 4. POST /api/admin/sebi/overlap/recompute ──────────────────────────────
  // Trigger full overlap recomputation and breach tagging
  app.post('/api/admin/sebi/overlap/recompute', requireAdmin, async (req, res) => {
    try {
      const { filterByCategory } = req.body || {};
      console.log('[SEBI Admin] Triggering overlap recomputation...');

      const computeResult = await mfSebiOverlapService.computeAllOverlaps(filterByCategory);
      const breachResult = await mfSebiOverlapService.applyBreachRules();

      res.json({
        success: true,
        message: 'Overlap recomputation complete',
        pairsComputed: computeResult.pairsComputed,
        breachesFound: computeResult.breachesFound,
        schemesCovered: computeResult.schemesCovered,
        breachedSchemes: breachResult.breachedSchemes.length,
      });
    } catch (err: any) {
      console.error('[SEBI Admin] overlap recompute error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── 5. GET /api/admin/sebi/compliance/:schemeCode ──────────────────────────
  // Per-scheme compliance detail
  app.get('/api/admin/sebi/compliance/:schemeCode', requireAdmin, async (req, res) => {
    try {
      const { schemeCode } = req.params;

      const fundResult = await db.execute(sql`
        SELECT scheme_code, scheme_name, category, scheme_sub_category,
               compliance_status, naming_validation_status, taxonomy_version,
               lifecycle_metadata, compliance_blocked_reason, is_published
        FROM mutual_funds
        WHERE scheme_code = ${schemeCode}
        LIMIT 1
      `);
      const fund = (fundResult as any).rows?.[0];
      if (!fund) return res.status(404).json({ success: false, error: 'Scheme not found' });

      const overlapEntriesResult = await db.execute(sql`
        SELECT om.*, mf.scheme_name as other_scheme_name
        FROM mf_overlap_matrix om
        JOIN mutual_funds mf ON (
          CASE WHEN om.scheme_code_a = ${schemeCode} THEN mf.scheme_code = om.scheme_code_b
               ELSE mf.scheme_code = om.scheme_code_a END
        )
        WHERE om.scheme_code_a = ${schemeCode} OR om.scheme_code_b = ${schemeCode}
        ORDER BY om.overlap_percent DESC
        LIMIT 20
      `);
      const overlapEntries = (overlapEntriesResult as any).rows || [];

      const stateLogResult = await db.execute(sql`
        SELECT * FROM mf_compliance_state_log
        WHERE scheme_code = ${schemeCode}
        ORDER BY triggered_at DESC
        LIMIT 10
      `);
      const stateLog = (stateLogResult as any).rows || [];

      const auditLogResult = await db.execute(sql`
        SELECT * FROM mf_categorization_audit_log
        WHERE scheme_code = ${schemeCode}
        ORDER BY changed_at DESC
        LIMIT 10
      `);
      const auditLog = (auditLogResult as any).rows || [];

      res.json({ success: true, fund, overlapEntries, stateLog, auditLog });
    } catch (err: any) {
      console.error('[SEBI Admin] per-scheme detail error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── 6. POST /api/admin/sebi/compliance/:schemeCode/transition ──────────────
  // Manual admin state transition
  app.post('/api/admin/sebi/compliance/:schemeCode/transition', requireAdmin, async (req, res) => {
    try {
      const { schemeCode } = req.params;
      const { toStatus, reason } = req.body;

      if (!toStatus || !reason) {
        return res.status(400).json({ success: false, error: 'toStatus and reason are required' });
      }

      const triggeredBy = `admin:${(req as any).user?.id || 'unknown'}`;
      const result = await mfComplianceStateMachine.transition(
        schemeCode, toStatus, reason, triggeredBy, true
      );

      if (!result.success) {
        return res.status(422).json({ success: false, error: result.error });
      }

      res.json({ success: true, message: `Transitioned ${schemeCode}: ${result.fromStatus} → ${result.toStatus}` });
    } catch (err: any) {
      console.error('[SEBI Admin] transition error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── 7. POST /api/admin/sebi/validate/naming/all ────────────────────────────
  // Trigger naming validation for all published schemes
  app.post('/api/admin/sebi/validate/naming/all', requireAdmin, async (req, res) => {
    try {
      console.log('[SEBI Admin] Starting bulk naming validation...');
      const summary = await mfNamingComplianceService.runNamingValidationForAll();
      res.json({
        success: true,
        message: 'Naming validation complete',
        total: summary.total,
        passed: summary.passed,
        failed: summary.failed,
        failureSamples: summary.failures.slice(0, 20),
      });
    } catch (err: any) {
      console.error('[SEBI Admin] naming validate/all error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── 8. POST /api/admin/sebi/validate/lifecycle/all ─────────────────────────
  // Trigger glide path validation for all lifecycle schemes
  app.post('/api/admin/sebi/validate/lifecycle/all', requireAdmin, async (req, res) => {
    try {
      console.log('[SEBI Admin] Starting bulk lifecycle glide path validation...');
      const summary = await mfLifecycleGlidePathService.validateAllLifecycleSchemes();
      res.json({
        success: true,
        message: 'Lifecycle validation complete',
        total: summary.total,
        valid: summary.valid,
        invalid: summary.invalid,
        results: summary.results.slice(0, 50),
      });
    } catch (err: any) {
      console.error('[SEBI Admin] lifecycle validate/all error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── 9. GET /api/admin/sebi/categorization-audit ────────────────────────────
  // Paginated categorization audit log
  app.get('/api/admin/sebi/categorization-audit', requireAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const schemeCode = req.query.schemeCode as string | undefined;
      const offset = (page - 1) * limit;

      let query: string;
      if (schemeCode) {
        const logsResult = await db.execute(sql`
          SELECT cal.*, mf.scheme_name
          FROM mf_categorization_audit_log cal
          LEFT JOIN mutual_funds mf ON mf.scheme_code = cal.scheme_code
          WHERE cal.scheme_code = ${schemeCode}
          ORDER BY cal.changed_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `);
        const countResult = await db.execute(sql`
          SELECT COUNT(*) as count FROM mf_categorization_audit_log WHERE scheme_code = ${schemeCode}
        `);
        const logs = (logsResult as any).rows || [];
        const total = parseInt((countResult as any).rows?.[0]?.count || '0');
        return res.json({ success: true, logs, total, page, limit });
      }

      const logsResult = await db.execute(sql`
        SELECT cal.*, mf.scheme_name
        FROM mf_categorization_audit_log cal
        LEFT JOIN mutual_funds mf ON mf.scheme_code = cal.scheme_code
        ORDER BY cal.changed_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);
      const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM mf_categorization_audit_log`);
      const logs = (logsResult as any).rows || [];
      const total = parseInt((countResult as any).rows?.[0]?.count || '0');

      res.json({ success: true, logs, total, page, limit });
    } catch (err: any) {
      console.error('[SEBI Admin] categorization-audit error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── BONUS: POST /api/admin/sebi/holdings/import ────────────────────────────
  // Import scheme holdings from mf_scheme_stock_holdings for overlap computation
  app.post('/api/admin/sebi/holdings/import', requireAdmin, async (req, res) => {
    try {
      const result = await mfSebiOverlapService.importHoldingsFromSchemeStockHoldings();
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('[SEBI Admin] holdings import error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── BONUS: POST /api/admin/sebi/taxonomy/seed ─────────────────────────────
  // Re-run the SEBI 2026 taxonomy seed (idempotent)
  app.post('/api/admin/sebi/taxonomy/seed', requireAdmin, async (req, res) => {
    try {
      const result = await sebiCategoryEngine.seedSEBI2026Taxonomy();
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('[SEBI Admin] taxonomy seed error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── POST /api/admin/subscription-sync/trigger ──────────────────────────────
  // Manually trigger a full AMFI subscription status sync.
  // Fetches scheme_type from mfapi.in for all overseas + legacy-restricted funds
  // and upserts results to scheme_transaction_rules.
  app.post('/api/admin/subscription-sync/trigger', requireAdmin, async (req, res) => {
    try {
      const result = await amfiSubscriptionSyncService.sync();
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('[SubscriptionSync] Manual trigger error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── GET /api/admin/subscription-sync/status ────────────────────────────────
  // Returns the current sync status and counts from scheme_transaction_rules.
  app.get('/api/admin/subscription-sync/status', requireAdmin, async (req, res) => {
    try {
      const summary = await amfiSubscriptionSyncService.getStatusSummary();
      res.json({ success: true, ...summary });
    } catch (err: any) {
      console.error('[SubscriptionSync] Status error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  console.log('✅ SEBI 2026 Compliance admin routes registered');
}
