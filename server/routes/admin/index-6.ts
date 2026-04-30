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
import { requireAdmin } from '../../middleware/roleMiddleware';



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

export function registerAdminPanelPart6Routes(app: Express): void {
  
  // Admin Dashboard - Overview statistics


  // Revenue Analytics API
  app.post("/api/admin/amfi-benchmark/sync", requireAdmin, async (req: any, res) => {
    try {
      const { amfiBenchmarkIngestionService } = await import("../../services/amfi-benchmark-ingestion-service");
      
      console.log(`[AMFI Admin] Sync triggered by ${req.user?.email || 'admin'}`);
      const result = await amfiBenchmarkIngestionService.syncAmfiSchemeBenchmarks();
      
      res.json({
        success: true,
        ...result,
        message: `Synced ${result.parsed} schemes, ${result.normalized} normalized successfully`
      });
    } catch (error: any) {
      console.error(`[AMFI Admin] Sync error:`, error.message, error.stack);
      res.status(500).json({ success: false, error: error.message || 'Unknown error during AMFI benchmark sync' });
    }
  });

  app.post("/api/admin/amfi-benchmark/auto-map", requireAdmin, async (req: any, res) => {
    try {
      const { amfiBenchmarkIngestionService } = await import("../../services/amfi-benchmark-ingestion-service");
      
      console.log(`[AMFI Admin] Auto-map from AMFI triggered by ${req.user?.email || 'admin'}`);
      const result = await amfiBenchmarkIngestionService.autoMapFromAmfi();
      
      // Trigger metrics recompute for updated mappings
      if (result.recompute.length > 0) {
        const { mfRelativeMetricsEngine } = await import("../../services/mf-relative-metrics-engine");
        mfRelativeMetricsEngine.recomputeAllMetrics(50).catch(err => {
          console.error(`[AMFI Admin] Metrics recompute failed:`, err.message);
        });
      }
      
      res.json({
        success: true,
        ...result,
        message: `Mapped ${result.mapped} new, updated ${result.updated}, ${result.recompute.length} queued for metrics recompute`
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/amfi-benchmark/stats", requireAdmin, async (req, res) => {
    try {
      const { amfiBenchmarkIngestionService } = await import("../../services/amfi-benchmark-ingestion-service");
      const stats = await amfiBenchmarkIngestionService.getAmfiStats();
      res.json({ success: true, ...stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/amfi-benchmark/conflicts", requireAdmin, async (req, res) => {
    try {
      const { amfiBenchmarkIngestionService } = await import("../../services/amfi-benchmark-ingestion-service");
      const conflicts = await amfiBenchmarkIngestionService.getConflicts();
      res.json({ success: true, conflicts, count: conflicts.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/admin/amfi-benchmark/resolve-conflict", requireAdmin, async (req: any, res) => {
    try {
      const { amfiBenchmarkIngestionService } = await import("../../services/amfi-benchmark-ingestion-service");
      
      const { isin, resolution, manualIndexCode } = req.body;
      if (!isin || !resolution) {
        return res.status(400).json({ success: false, error: "Missing isin or resolution" });
      }
      
      const adminId = req.user?.email || req.user?.id || 'admin';
      const result = await amfiBenchmarkIngestionService.resolveConflict(isin, resolution, manualIndexCode, adminId);
      
      if (result) {
        // Trigger metrics recompute for this fund
        const { mfRelativeMetricsEngine } = await import("../../services/mf-relative-metrics-engine");
        mfRelativeMetricsEngine.recomputeAllMetrics(1).catch(err => {
          console.error(`[AMFI Admin] Metrics recompute failed:`, err.message);
        });
      }
      
      res.json({ success: result, message: result ? 'Conflict resolved' : 'Resolution failed' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/amfi-benchmark/history", requireAdmin, async (req, res) => {
    try {
      const { amfiBenchmarkIngestionService } = await import("../../services/amfi-benchmark-ingestion-service");
      const isin = req.query.isin as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await amfiBenchmarkIngestionService.getBenchmarkHistory(isin, limit);
      res.json({ success: true, history, count: history.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log("✅ AMFI Benchmark Auto-Parser routes registered");
  console.log("✅ Benchmark Mapping Admin routes registered");

  // ============ AMFI OFFICIAL NAV SYNC ROUTES ============
  
  // Get NAV sync status
  app.get("/api/admin/amfi-nav/status", requireAdmin, async (req, res) => {
    try {
      const { amfiNavScheduler } = await import("../../services/amfi-nav-scheduler");
      const { amfiOfficialNavService } = await import("../../services/amfi-official-nav-service");
      
      const schedulerStatus = amfiNavScheduler.getStatus();
      const progress = amfiOfficialNavService.getProgress();
      
      res.json({
        success: true,
        scheduler: schedulerStatus,
        progress,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Trigger manual NAV sync
  app.post("/api/admin/amfi-nav/sync", requireAdmin, async (req: any, res) => {
    try {
      const { amfiNavScheduler } = await import("../../services/amfi-nav-scheduler");
      
      console.log(`[AMFI NAV Admin] Manual sync triggered by ${req.user?.email || 'admin'}`);
      const result = await amfiNavScheduler.triggerManualSync();
      
      res.json({
        success: result.success,
        ...result,
        message: result.success 
          ? `Synced ${result.updatedFunds} funds with NAV data from ${result.navDate}` 
          : `Sync failed: ${result.errorDetails?.join(', ')}`
      });
    } catch (error: any) {
      console.error(`[AMFI NAV Admin] Manual sync error:`, error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Get NAV sync progress (for polling during sync)
  app.get("/api/admin/amfi-nav/progress", requireAdmin, async (req, res) => {
    try {
      const { amfiOfficialNavService } = await import("../../services/amfi-official-nav-service");
      const progress = amfiOfficialNavService.getProgress();
      res.json({ success: true, ...progress });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  console.log("✅ AMFI Official NAV Sync routes registered");

  // ============ BSE BENCHMARK ROUTES ============
  
  // Seed BSE indices to market_indices table
  app.post("/api/admin/bse-benchmark/seed-indices", requireAdmin, async (req: any, res) => {
    try {
      const { bseBenchmarkService } = await import("../../services/bse-benchmark-service");
      console.log(`[BSE Admin] Seed indices triggered by ${req.user?.email || 'admin'}`);
      const result = await bseBenchmarkService.seedBseIndices();
      res.json({
        success: true,
        ...result,
        message: `Seeded ${result.seeded} new BSE indices, ${result.existing} already exist`
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get BSE-aware benchmark resolution for a specific fund
  app.get("/api/admin/bse-benchmark/resolve/:isin", requireAdmin, async (req, res) => {
    try {
      const { bseBenchmarkService } = await import("../../services/bse-benchmark-service");
      const { isin } = req.params;
      const resolution = await bseBenchmarkService.resolveBenchmark(isin);
      res.json({ success: true, resolution });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Run BSE-aware auto-mapping with precedence rules
  app.post("/api/admin/bse-benchmark/auto-map", requireAdmin, async (req: any, res) => {
    try {
      const { bseBenchmarkService } = await import("../../services/bse-benchmark-service");
      console.log(`[BSE Admin] Auto-map with precedence triggered by ${req.user?.email || 'admin'}`);
      const result = await bseBenchmarkService.autoMapWithBsePrecedence();
      
      if (result.mapped > 0 || result.updated > 0) {
        const { mfRelativeMetricsEngine } = await import("../../services/mf-relative-metrics-engine");
        mfRelativeMetricsEngine.recomputeAllMetrics(50).catch(err => {
          console.error(`[BSE Admin] Metrics recompute failed:`, err.message);
        });
      }
      
      res.json({
        success: true,
        ...result,
        message: `Mapped ${result.mapped} new, updated ${result.updated}, ${result.lineageRecords} lineage records created`
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get source statistics
  app.get("/api/admin/bse-benchmark/stats", requireAdmin, async (req, res) => {
    try {
      const { bseBenchmarkService } = await import("../../services/bse-benchmark-service");
      const stats = await bseBenchmarkService.getSourceStats();
      res.json({ success: true, ...stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get AMFI vs BSE conflicts
  app.get("/api/admin/bse-benchmark/conflicts", requireAdmin, async (req, res) => {
    try {
      const { bseBenchmarkService } = await import("../../services/bse-benchmark-service");
      const conflicts = await bseBenchmarkService.getAmfiBseConflicts();
      res.json({ success: true, conflicts, count: conflicts.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Resolve AMFI vs BSE conflict
  app.post("/api/admin/bse-benchmark/resolve-conflict", requireAdmin, async (req: any, res) => {
    try {
      const { bseBenchmarkService } = await import("../../services/bse-benchmark-service");
      const { isin, resolution, manualIndexCode, reason } = req.body;
      
      if (!isin || !resolution) {
        return res.status(400).json({ success: false, error: "Missing isin or resolution" });
      }
      
      const adminId = req.user?.email || req.user?.id || 'admin';
      const result = await bseBenchmarkService.resolveConflict(isin, resolution, manualIndexCode, adminId, reason);
      
      if (result) {
        const { mfRelativeMetricsEngine } = await import("../../services/mf-relative-metrics-engine");
        mfRelativeMetricsEngine.recomputeAllMetrics(1).catch(err => {
          console.error(`[BSE Admin] Metrics recompute failed:`, err.message);
        });
      }
      
      res.json({ success: result, message: result ? 'Conflict resolved' : 'Resolution failed' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get benchmark lineage audit trail
  app.get("/api/admin/bse-benchmark/lineage", requireAdmin, async (req, res) => {
    try {
      const { bseBenchmarkService } = await import("../../services/bse-benchmark-service");
      const isin = req.query.isin as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const lineage = await bseBenchmarkService.getBenchmarkLineage(isin, limit);
      res.json({ success: true, lineage, count: lineage.length });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log("✅ BSE Benchmark routes registered");

  // ============ DATA ENRICHMENT ROUTES ============
  
  // MF Extended Enrichment - get stats
  app.get("/api/admin/enrichment/mf/stats", requireAdmin, async (req, res) => {
    try {
      const { mfExtendedEnrichmentService } = await import("../../services/mf-extended-enrichment-service");
      const stats = await mfExtendedEnrichmentService.getEnrichmentStats();
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // MF Extended Enrichment - get progress
  app.get("/api/admin/enrichment/mf/progress", requireAdmin, async (req, res) => {
    try {
      const { mfExtendedEnrichmentService } = await import("../../services/mf-extended-enrichment-service");
      const progress = mfExtendedEnrichmentService.getProgress();
      res.json({ success: true, progress });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // MF Extended Enrichment - run enrichment
  app.post("/api/admin/enrichment/mf/run", requireAdmin, async (req, res) => {
    try {
      const { mfExtendedEnrichmentService } = await import("../../services/mf-extended-enrichment-service");
      const { forceRefresh = false, batchSize = 500 } = req.body;
      
      // Start async enrichment
      mfExtendedEnrichmentService.enrichAllFunds({ forceRefresh, batchSize }).catch(err => {
        console.error('[MF Enrichment Admin] Enrichment failed:', err.message);
      });
      
      res.json({ success: true, message: 'Enrichment started', status: 'running' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.get("/api/admin/enrichment/mf/comprehensive/stats", requireAdmin, async (req, res) => {
    try {
      const { mfComprehensiveEnrichmentService } = await import("../../services/mf-comprehensive-enrichment-service");
      const stats = await mfComprehensiveEnrichmentService.getNullColumnStats();
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/enrichment/mf/comprehensive/progress", requireAdmin, async (req, res) => {
    try {
      const { mfComprehensiveEnrichmentService } = await import("../../services/mf-comprehensive-enrichment-service");
      const progress = mfComprehensiveEnrichmentService.getProgress();
      res.json({ success: true, progress });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/admin/enrichment/mf/comprehensive/run", requireAdmin, async (req, res) => {
    try {
      const { mfComprehensiveEnrichmentService } = await import("../../services/mf-comprehensive-enrichment-service");
      const { maxMfapiFunds = 500, skipMfapi = false, batchSize = 500 } = req.body;

      mfComprehensiveEnrichmentService.runComprehensiveEnrichment({ maxMfapiFunds, skipMfapi, batchSize }).catch(err => {
        console.error('[Comprehensive Enrichment] Failed:', err.message);
      });

      res.json({ success: true, message: 'Comprehensive enrichment started', status: 'running' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/enrichment/mf/ratings/stats", requireAdmin, async (req, res) => {
    try {
      const [stats] = await db.select({
        total: sql<number>`COUNT(*)`,
        rated: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.crisilRating} IS NOT NULL)`,
        unrated: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.crisilRating} IS NULL)`,
        stars5: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.crisilRating} = 5)`,
        stars4: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.crisilRating} = 4)`,
        stars3: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.crisilRating} = 3)`,
        stars2: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.crisilRating} = 2)`,
        stars1: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.crisilRating} = 1)`,
        avgOverall: sql<number>`AVG(CAST(${mutualFunds.crisilOverallScore} AS NUMERIC))`,
        avgPercentile: sql<number>`AVG(CAST(${mutualFunds.crisilPercentile} AS NUMERIC))`,
        dataSourceCalc: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.crisilDataSource} = 'calculated')`,
        dataSourceDb: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.crisilDataSource} = 'database')`,
      }).from(mutualFunds);

      const total = Number(stats?.total || 0);
      const rated = Number(stats?.rated || 0);
      res.json({
        success: true,
        ratingSystem: 'FintekPro Smart Rating v2.0',
        methodology: {
          description: 'Proprietary multi-factor scoring engine using risk-adjusted returns, quality metrics, liquidity, momentum, and valuation analysis',
          scoringWeights: { riskAdjusted: 0.35, quality: 0.25, liquidity: 0.15, momentum: 0.15, valuation: 0.10 },
          dataInputs: ['returns_1y', 'returns_3y', 'returns_5y', 'expense_ratio', 'aum', 'fund_house', 'category'],
          scaleDescription: '1-5 stars (5 = excellent performance)',
          disclaimer: 'FintekPro Smart Ratings are proprietary calculations. Not affiliated with CRISIL, ICRA, or any third-party rating agency.',
        },
        coverage: {
          total,
          rated,
          unrated: Number(stats?.unrated || 0),
          coveragePercent: total > 0 ? ((rated / total) * 100).toFixed(1) : '0',
        },
        distribution: {
          '5_star': Number(stats?.stars5 || 0),
          '4_star': Number(stats?.stars4 || 0),
          '3_star': Number(stats?.stars3 || 0),
          '2_star': Number(stats?.stars2 || 0),
          '1_star': Number(stats?.stars1 || 0),
        },
        averages: {
          overallScore: stats?.avgOverall ? parseFloat(Number(stats.avgOverall).toFixed(2)) : null,
          percentile: stats?.avgPercentile ? parseFloat(Number(stats.avgPercentile).toFixed(2)) : null,
        },
        dataSource: {
          calculated: Number(stats?.dataSourceCalc || 0),
          database: Number(stats?.dataSourceDb || 0),
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/admin/enrichment/mf/ratings/run", requireAdmin, async (req, res) => {
    try {
      const { default: fintekProRatingService } = await import("../../services/fintekpro-rating-service");
      const { onlyNullRatings = true, maxFunds = 50000 } = req.body;

      fintekProRatingService.batchComputeAndPersist({
        onlyNullRatings,
        maxFunds,
        batchSize: 200,
      }).then(result => {
        console.log(`[Admin] FintekPro Smart Rating batch complete: ${result.persisted} persisted, ${result.failed} failed`);
      }).catch(err => {
        console.error('[Admin] FintekPro Smart Rating batch failed:', err.message);
      });

      res.json({
        success: true,
        message: 'FintekPro Smart Rating computation started',
        config: { onlyNullRatings, maxFunds },
        status: 'running',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/enrichment/mf/ratings/methodology", requireAdmin, async (req, res) => {
    res.json({
      success: true,
      system: 'FintekPro Smart Rating',
      version: '2.0',
      lastUpdated: new Date().toISOString(),
      description: 'Proprietary multi-factor rating engine for mutual fund evaluation',
      disclaimer: 'FintekPro Smart Ratings are proprietary calculations based on publicly available fund data. They are NOT CRISIL ratings or any third-party agency ratings. Data source attribution: AMFI (official NAV feed), MFAPI (historical returns), FintekPro (proprietary scoring).',
      components: [
        { name: 'Risk-Adjusted Returns Score', weight: 0.35, inputs: ['returns_1y', 'returns_3y', 'returns_5y', 'expense_ratio'], method: 'Net return above risk-free rate (6.5%), weighted average across time horizons' },
        { name: 'Quality Score', weight: 0.25, inputs: ['fund_house', 'aum', 'existing_rating'], method: 'Fund house reputation scoring (15 major AMCs), AUM scale bonus, rating history' },
        { name: 'Liquidity Score', weight: 0.15, inputs: ['aum', 'category'], method: 'AUM-based liquidity tiers with category adjustments for large-cap preference' },
        { name: 'Momentum Score', weight: 0.15, inputs: ['returns_1y', 'returns_3y'], method: '60/40 weighted short-to-medium term performance momentum' },
        { name: 'Valuation Score', weight: 0.10, inputs: ['expense_ratio', 'category'], method: 'Expense ratio efficiency scoring relative to category norms' },
      ],
      starMapping: [
        { stars: 5, scoreRange: '85-100', label: 'Excellent' },
        { stars: 4, scoreRange: '70-84', label: 'Good' },
        { stars: 3, scoreRange: '55-69', label: 'Average' },
        { stars: 2, scoreRange: '40-54', label: 'Below Average' },
        { stars: 1, scoreRange: '0-39', label: 'Poor' },
      ],
      confidenceLevels: [
        { level: 'high', criteria: 'AUM > ₹5,000 Cr' },
        { level: 'medium', criteria: 'AUM ₹1,000-5,000 Cr' },
        { level: 'low', criteria: 'AUM < ₹1,000 Cr' },
      ],
      regulatoryCompliance: {
        sebi: 'Ratings based on SEBI-regulated data sources (AMFI official feed)',
        dataProvenance: 'All data sourced from AMFI, MFAPI, and proprietary FintekPro calculations',
        auditTrail: 'Full audit logging in mf_enrichment_audit_logs table with enrichment run IDs',
        noThirdPartyRatings: 'No CRISIL, ICRA, or other third-party agency data used in rating computation',
      },
    });
  });

  app.post("/api/admin/enrichment/mf/sebi-rules/seed", requireAdmin, async (req, res) => {
    try {
      const { sebiCategoryEngine } = await import("../../services/mf-sebi-category-engine");
      const result = await sebiCategoryEngine.seedCategoryRules();
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

}
