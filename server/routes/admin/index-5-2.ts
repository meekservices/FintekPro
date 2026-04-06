import { Express, Response } from 'express';
import { db } from '../../db';
import { sql, desc, eq } from 'drizzle-orm';
import { mutualFunds, signalResolutionLog, governancePolicy } from '@shared/schema';
import { signalOrchestrator } from '../../services/signal-orchestrator';
import { storage } from '../../storage';
import { adminService } from '../../admin-service';
import ckycDeferredRoutes from './ckyc-deferred-routes';
import { registerSEBIComplianceRoutes } from './sebi-compliance-routes';
import { auditIntegrityChecker } from '../../services/audit-integrity-checker';
import { platformStatsCache } from '../../services/platform-stats-cache';
import { riaValidationService } from '../../services/ria-validation-service';
import { insuranceSuitabilityService } from '../../services/insurance-suitability-service';
import { proxyToInsurance } from '../../clients/insurance-client';
import { beneficialOwnershipService } from '../../services/beneficial-ownership-service';
import { sebiScoresService } from '../../services/sebi-scores-service';
import { mfReturnsSyncService } from '../../services/mf-returns-sync-service';

const requireAdmin = async (req: any, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  const isAdmin = await adminService.isAdmin(req.user.id);
  if (!isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  next();
};

async function ensureAgentNotificationsTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agent_notifications (
        id          SERIAL PRIMARY KEY,
        agent_id    VARCHAR(255) NOT NULL,
        title       TEXT NOT NULL,
        body        TEXT NOT NULL,
        type        TEXT NOT NULL DEFAULT 'info',
        link        TEXT,
        read_at     TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_id
        ON agent_notifications(agent_id)
    `);
    console.log("✅ [AgentNotifications] Table ready");
  } catch (err: any) {
    console.error("[AgentNotifications] Table init error:", err.message);
  }
}
ensureAgentNotificationsTable();

export function registerAdminPanelPart5Sub2Routes(app: Express): void {
  
  // Admin Dashboard - Overview statistics


  // Revenue Analytics API
  app.get("/api/admin/audit/integrity-status", requireAdmin, async (req, res) => {
    try {
      const status = auditIntegrityChecker.getStatus();
      const failedVerifications = await auditIntegrityChecker.getFailedVerifications(20);
      
      res.json({
        success: true,
        status,
        failedVerifications,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[Audit Integrity] Error fetching status:", error.message);
      res.status(500).json({ 
        error: "Failed to fetch audit integrity status",
        message: error.message 
      });
    }
  });

  // Trigger manual integrity check
  app.post("/api/admin/audit/integrity-check", requireAdmin, async (req, res) => {
    try {
      console.log("[Audit Integrity] Manual check triggered by admin");
      const result = await auditIntegrityChecker.runIntegrityCheck();
      
      res.json({
        success: true,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[Audit Integrity] Manual check failed:", error.message);
      res.status(500).json({ 
        error: "Failed to run integrity check",
        message: error.message 
      });
    }
  });

  // Update integrity check schedule
  app.post("/api/admin/audit/integrity-schedule", requireAdmin, async (req, res) => {
    try {
      const { intervalMinutes, enabled } = req.body;
      
      if (typeof intervalMinutes === 'number' && intervalMinutes >= 5) {
        auditIntegrityChecker.setScheduleInterval(intervalMinutes);
      }
      
      if (enabled === true) {
        auditIntegrityChecker.startScheduledChecks();
      } else if (enabled === false) {
        auditIntegrityChecker.stopScheduledChecks();
      }
      
      const status = auditIntegrityChecker.getStatus();
      
      res.json({
        success: true,
        message: "Schedule updated successfully",
        status: {
          isScheduleRunning: status.isScheduleRunning,
          scheduleIntervalMinutes: status.scheduleIntervalMinutes
        }
      });
    } catch (error: any) {
      console.error("[Audit Integrity] Schedule update failed:", error.message);
      res.status(500).json({ 
        error: "Failed to update schedule",
        message: error.message 
      });
    }
  });

  // Mark failed verification as reviewed
  app.post("/api/admin/audit/integrity-failure/:failureId/review", requireAdmin, async (req: any, res) => {
    try {
      const { failureId } = req.params;
      const reviewedBy = req.user?.id || req.user?.email || 'admin';
      
      const success = await auditIntegrityChecker.markVerificationReviewed(failureId, reviewedBy);
      
      if (success) {
        res.json({
          success: true,
          message: "Failure marked as reviewed"
        });
      } else {
        res.status(400).json({
          success: false,
          error: "Failed to mark as reviewed"
        });
      }
    } catch (error: any) {
      console.error("[Audit Integrity] Review marking failed:", error.message);
      res.status(500).json({ 
        error: "Failed to mark failure as reviewed",
        message: error.message 
      });
    }
  });

  console.log("✅ Audit Integrity routes registered");

  // CKYC Deferred Cases Management Routes
  app.use("/api/admin/ckyc-deferred", requireAdmin, ckycDeferredRoutes);
  console.log("✅ CKYC Deferred Cases routes registered");

  // MF Returns Enrichment Status and Manual Sync
  app.get("/api/admin/mf-enrichment-status", requireAdmin, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.set('Pragma', 'no-cache');

      const countsResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN returns_1y IS NOT NULL THEN 1 END) as with_returns,
          COUNT(CASE WHEN nav IS NOT NULL THEN 1 END) as with_nav,
          COUNT(CASE WHEN aum IS NOT NULL THEN 1 END) as with_aum,
          COUNT(CASE WHEN expense_ratio IS NOT NULL THEN 1 END) as with_ter,
          COUNT(CASE WHEN risk_level IS NOT NULL THEN 1 END) as with_risk,
          (SELECT COUNT(DISTINCT scheme_code) FROM mutual_fund_metrics WHERE sharpe_ratio IS NOT NULL) as with_sharpe
        FROM mutual_funds
      `);
      const row = countsResult.rows[0] as any;
      const totalFunds = parseInt(row.total) || 0;
      const enrichedFunds = parseInt(row.with_returns) || 0;
      const pendingFunds = totalFunds - enrichedFunds;
      const progressPercentage = totalFunds > 0 ? Math.round((enrichedFunds / totalFunds) * 100 * 100) / 100 : 0;
      
      const syncStatus = mfReturnsSyncService.getStatus();
      
      let lastSyncTime = syncStatus.lastSyncTime?.toISOString() || null;
      if (!lastSyncTime) {
        const lastUpdateResult = await db.execute(sql`
          SELECT MAX(last_updated) as last_sync FROM mutual_funds WHERE returns_1y IS NOT NULL
        `);
        const dbLastSync = (lastUpdateResult.rows[0] as any)?.last_sync;
        if (dbLastSync) {
          lastSyncTime = new Date(dbLastSync).toISOString();
        }
      }

      const lastSyncedResult = await db.execute(sql`
        SELECT mf.scheme_code, mf.scheme_name, mf.isin, mf.expense_ratio, mf.aum, mf.risk_level,
               mf.returns_1y, mf.returns_3y, mf.returns_5y,
               m.sharpe_ratio, m.sortino_ratio, m.standard_deviation, m.max_drawdown,
               m.alpha, m.beta, mf.last_updated
        FROM mutual_funds mf
        LEFT JOIN LATERAL (
          SELECT sharpe_ratio, sortino_ratio, standard_deviation, max_drawdown, alpha, beta
          FROM mutual_fund_metrics
          WHERE scheme_code = mf.scheme_code
          ORDER BY last_updated DESC
          LIMIT 1
        ) m ON true
        WHERE mf.returns_1y IS NOT NULL 
        ORDER BY mf.last_updated DESC NULLS LAST
        LIMIT 5
      `);
      
      res.json({
        success: true,
        fetchedAt: new Date().toISOString(),
        stats: {
          totalFunds,
          enrichedFunds,
          pendingFunds,
          progressPercentage,
          withNav: parseInt(row.with_nav) || 0,
          withAum: parseInt(row.with_aum) || 0,
          withTer: parseInt(row.with_ter) || 0,
          withRisk: parseInt(row.with_risk) || 0,
          withSharpe: parseInt(row.with_sharpe) || 0,
        },
        syncStatus: {
          isRunning: syncStatus.isRunning,
          lastSyncTime
        },
        recentlyEnriched: lastSyncedResult.rows.map((row: any) => ({
          schemeCode: row.scheme_code,
          schemeName: row.scheme_name,
          isin: row.isin || null,
          ter: row.expense_ratio ? parseFloat(row.expense_ratio) : null,
          aum: row.aum ? parseFloat(row.aum) : null,
          riskLevel: row.risk_level || null,
          returns1y: row.returns_1y ? parseFloat(row.returns_1y) : null,
          returns3y: row.returns_3y ? parseFloat(row.returns_3y) : null,
          returns5y: row.returns_5y ? parseFloat(row.returns_5y) : null,
          sharpeRatio: row.sharpe_ratio ? parseFloat(row.sharpe_ratio) : null,
          sortinoRatio: row.sortino_ratio ? parseFloat(row.sortino_ratio) : null,
          standardDeviation: row.standard_deviation ? parseFloat(row.standard_deviation) : null,
          maxDrawdown: row.max_drawdown ? parseFloat(row.max_drawdown) : null,
          alpha: row.alpha ? parseFloat(row.alpha) : null,
          beta: row.beta ? parseFloat(row.beta) : null,
          lastUpdated: row.last_updated
        }))
      });
    } catch (error: any) {
      console.error("[MF Enrichment] Status fetch failed:", error.message);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch enrichment status",
        message: error.message 
      });
    }
  });

  app.post("/api/admin/mf-enrichment-sync", requireAdmin, async (req: any, res) => {
    try {
      const syncStatus = mfReturnsSyncService.getStatus();
      
      if (syncStatus.isRunning) {
        return res.status(409).json({
          success: false,
          error: "Sync already in progress",
          message: "A sync operation is currently running. Please wait for it to complete."
        });
      }
      
      // Get batch limit from request body, default to 20 funds
      const batchLimit = parseInt(req.body?.batchLimit) || 20;
      const clampedLimit = Math.min(Math.max(batchLimit, 1), 100); // Clamp between 1-100
      
      console.log(`[MF Enrichment] Admin-initiated sync started for ${clampedLimit} funds by ${req.user?.email || 'admin'}`);
      
      // Start async sync (don't await - return immediately)
      const syncPromise = mfReturnsSyncService.runBatchSync(clampedLimit);
      
      // Return immediately, the sync runs in background
      res.json({
        success: true,
        message: `Sync started for up to ${clampedLimit} funds. Check status endpoint for progress.`,
        syncStartedAt: new Date().toISOString()
      });
      
      // Log completion when done
      syncPromise.then((result) => {
        console.log(`[MF Enrichment] Admin sync completed: ${result.successful}/${result.processed} successful, ${result.failed} failed`);
      }).catch((err) => {
        console.error(`[MF Enrichment] Admin sync failed:`, err.message);
      });
      
    } catch (error: any) {
      console.error("[MF Enrichment] Manual sync trigger failed:", error.message);
      res.status(500).json({ 
        success: false,
        error: "Failed to trigger sync",
        message: error.message 
      });
    }
  });

  console.log("✅ MF Enrichment Admin routes registered");

  // ============================================================================
  // BENCHMARK MAPPING MANAGEMENT ROUTES
  // ============================================================================

  app.get("/api/admin/benchmarks", requireAdmin, async (req, res) => {
    try {
      const { benchmarkSyncService } = await import("../../services/benchmark-sync-service");
      const { db } = await import("../../db");
      const { marketIndices } = await import("@shared/schema");
      
      const indices = await db.select().from(marketIndices);
      const coverage = await benchmarkSyncService.getBenchmarkDataCoverage();
      
      res.json({
        success: true,
        indices,
        coverage
      });
    } catch (error: any) {
      console.error("[Benchmark Admin] Error fetching benchmarks:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/admin/benchmarks/sync", requireAdmin, async (req: any, res) => {
    try {
      const { benchmarkSyncService } = await import("../../services/benchmark-sync-service");
      
      console.log(`[Benchmark Admin] Manual sync triggered by ${req.user?.email || 'admin'}`);
      
      // Start async sync
      const syncPromise = benchmarkSyncService.syncAllBenchmarks();
      
      res.json({
        success: true,
        message: "Benchmark sync started. Check status for progress."
      });
      
      syncPromise.then((result) => {
        console.log(`[Benchmark Admin] Sync completed: ${result.synced} synced, ${result.failed.length} failed`);
      }).catch((err) => {
        console.error(`[Benchmark Admin] Sync failed:`, err.message);
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/mf-benchmark-mappings", requireAdmin, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.set('Pragma', 'no-cache');

      const { db } = await import("../../db");
      const { mfBenchmarkMap } = await import("@shared/schema");
      const { desc, sql } = await import("drizzle-orm");
      
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const mappings = await db.select({
        id: mfBenchmarkMap.id,
        mfIsin: mfBenchmarkMap.mfIsin,
        mfSchemeCode: mfBenchmarkMap.mfSchemeCode,
        indexCode: mfBenchmarkMap.indexCode,
        confidenceScore: mfBenchmarkMap.confidenceScore,
        source: mfBenchmarkMap.source,
        mappingReason: mfBenchmarkMap.mappingReason,
        isOverridden: mfBenchmarkMap.isOverridden,
        createdAt: mfBenchmarkMap.createdAt,
      })
      .from(mfBenchmarkMap)
      .orderBy(desc(mfBenchmarkMap.createdAt))
      .limit(limit)
      .offset(offset);
      
      const statsResult = await db.execute(sql`
        SELECT 
          COUNT(*) as total_mappings,
          COUNT(CASE WHEN source = 'auto' THEN 1 END) as auto_mappings,
          COUNT(CASE WHEN is_overridden = true THEN 1 END) as manual_overrides,
          COUNT(CASE WHEN CAST(confidence_score AS FLOAT) >= 0.70 THEN 1 END) as high_confidence
        FROM mf_benchmark_map
      `);
      const statsRow = statsResult.rows[0] as any;

      const indexDistResult = await db.execute(sql`
        SELECT index_code, COUNT(*) as count FROM mf_benchmark_map GROUP BY index_code ORDER BY count DESC
      `);
      const byIndexCode: Record<string, number> = {};
      for (const r of indexDistResult.rows as any[]) {
        byIndexCode[r.index_code] = parseInt(r.count);
      }
      
      res.json({
        success: true,
        fetchedAt: new Date().toISOString(),
        mappings,
        stats: {
          totalMappings: parseInt(statsRow.total_mappings) || 0,
          autoMappings: parseInt(statsRow.auto_mappings) || 0,
          manualOverrides: parseInt(statsRow.manual_overrides) || 0,
          highConfidence: parseInt(statsRow.high_confidence) || 0,
          byIndexCode,
        },
        pagination: { limit, offset }
      });
    } catch (error: any) {
      console.error("[Benchmark Admin] Error fetching mappings:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/admin/mf-benchmark-mappings/auto-map", requireAdmin, async (req: any, res) => {
    try {
      const { mfBenchmarkMappingService } = await import("../../services/mf-benchmark-mapping-service");
      
      const limit = parseInt(req.body?.limit) || 500;
      console.log(`[Benchmark Admin] Auto-mapping triggered by ${req.user?.email || 'admin'}`);
      
      const result = await mfBenchmarkMappingService.autoMapUnmappedFunds(limit);
      
      res.json({
        success: true,
        result,
        message: `Mapped ${result.mapped} funds, skipped ${result.skipped}`
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/admin/mf-benchmark-mappings/override", requireAdmin, async (req: any, res) => {
    try {
      const { mfBenchmarkMappingService } = await import("../../services/mf-benchmark-mapping-service");
      
      const { isin, indexCode } = req.body;
      if (!isin || !indexCode) {
        return res.status(400).json({ success: false, error: "Missing isin or indexCode" });
      }
      
      await mfBenchmarkMappingService.overrideBenchmark(isin, indexCode, req.user?.email || 'admin');
      
      res.json({
        success: true,
        message: `Benchmark override applied for ${isin}`
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/admin/mf-relative-metrics/recompute", requireAdmin, async (req: any, res) => {
    try {
      const { mfRelativeMetricsEngine } = await import("../../services/mf-relative-metrics-engine");
      
      const batchSize = parseInt(req.body?.batchSize) || 50;
      console.log(`[Metrics Admin] Recompute triggered by ${req.user?.email || 'admin'}`);
      
      // Start async recompute
      const recomputePromise = mfRelativeMetricsEngine.recomputeAllMetrics(batchSize);
      
      res.json({
        success: true,
        message: `Metrics recomputation started for up to ${batchSize} funds`
      });
      
      recomputePromise.then((result) => {
        console.log(`[Metrics Admin] Recompute completed: ${result.success}/${result.processed} success`);
      }).catch((err) => {
        console.error(`[Metrics Admin] Recompute failed:`, err.message);
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });


  // AMFI Benchmark Ingestion Routes
}
