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

export function registerAdminPanelPart7Routes(app: Express): void {
  
  // Admin Dashboard - Overview statistics


  // Revenue Analytics API
  app.get("/api/admin/enrichment/mf/sebi-rules", requireAdmin, async (req, res) => {
    try {
      const { sebiCategoryEngine } = await import("../../services/mf-sebi-category-engine");
      const rules = await sebiCategoryEngine.getAllRules();
      res.json({ success: true, data: rules });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/enrichment/mf/category-stats", requireAdmin, async (req, res) => {
    try {
      const { sebiCategoryEngine } = await import("../../services/mf-sebi-category-engine");
      const stats = await sebiCategoryEngine.getCategoryStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/enrichment/mf/audit-logs", requireAdmin, async (req, res) => {
    try {
      const { mfComprehensiveEnrichmentService } = await import("../../services/mf-comprehensive-enrichment-service");
      const { schemeCode, limit = '50', changeType } = req.query;
      const logs = await mfComprehensiveEnrichmentService.getAuditLogs(
        schemeCode as string | undefined,
        parseInt(limit as string) || 50,
        changeType as string | undefined
      );
      res.json({ success: true, data: logs });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/enrichment/mf/validate-categories", requireAdmin, async (req, res) => {
    try {
      const { sebiCategoryEngine } = await import("../../services/mf-sebi-category-engine");
      const { limit = '500' } = req.query;
      const validation = await sebiCategoryEngine.validateAllSchemes(parseInt(limit as string) || 500);
      res.json({ success: true, ...validation });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Stock Financial Enrichment - get stats
  app.get("/api/admin/enrichment/stocks/stats", requireAdmin, async (req, res) => {
    try {
      const { stockFinancialEnrichmentService } = await import("../../services/stock-financial-enrichment-service");
      const stats = await stockFinancialEnrichmentService.getEnrichmentStats();
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Stock Financial Enrichment - get progress
  app.get("/api/admin/enrichment/stocks/progress", requireAdmin, async (req, res) => {
    try {
      const { stockFinancialEnrichmentService } = await import("../../services/stock-financial-enrichment-service");
      const progress = stockFinancialEnrichmentService.getProgress();
      res.json({ success: true, progress });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.post("/api/admin/enrichment/stocks/run", requireAdmin, async (req, res) => {
    try {
      const { stockFinancialEnrichmentService } = await import("../../services/stock-financial-enrichment-service");
      const {
        useYahoo = false,
        batchSize = 50,
        maxYahooRequests = 50,
        useFmp = true,
        maxFmpStocks = 40,
        includeReturns = true,
      } = req.body;

      stockFinancialEnrichmentService.enrichAllStocks({
        useYahoo, batchSize, maxYahooRequests, useFmp, maxFmpStocks, includeReturns
      }).catch(err => {
        console.error('[Stock Enrichment Admin] Enrichment failed:', err.message);
      });

      res.json({ success: true, message: 'FMP enrichment started', status: 'running', config: { useFmp, maxFmpStocks, includeReturns } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Screener.in bulk enrichment — fills revenue_growth, debt_to_equity, earnings_growth for pending stocks
  // Works in any environment (dev + prod). Runs in background, returns immediately.
  app.post("/api/admin/enrichment/screener/run", requireAdmin, async (req: any, res) => {
    try {
      const limit = Math.min(Number(req.body?.limit) || 100, 500);
      const { runScreenerEnrichmentBatch } = await import("../../cron-enrichment");
      runScreenerEnrichmentBatch(limit, "AdminScreenerEnrich").catch((e: any) =>
        console.warn("[AdminScreenerEnrich] Batch failed:", e?.message)
      );
      res.json({ success: true, message: `Screener.in enrichment started for up to ${limit} pending stocks`, status: "running" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Status of Screener.in enrichment (pending / complete / failed counts)
  app.get("/api/admin/enrichment/screener/status", requireAdmin, async (_req, res) => {
    try {
      const { pool } = await import("../../db");
      const [statusResult, nullRevResult] = await Promise.all([
        pool.query(`SELECT enrichment_status, COUNT(*) as cnt FROM listed_stocks WHERE is_active = true GROUP BY enrichment_status ORDER BY cnt DESC`),
        pool.query(`SELECT COUNT(*) as total, COUNT(revenue_growth) as has_revenue_growth, COUNT(debt_to_equity) as has_debt_equity, COUNT(earnings_growth) as has_earnings_growth, COUNT(roe) as has_roe FROM screener_financials`),
      ]);
      res.json({ success: true, enrichmentStatus: statusResult.rows, screenerFinancials: nullRevResult.rows[0] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Combined enrichment stats
  app.get("/api/admin/enrichment/stats", requireAdmin, async (req, res) => {
    try {
      const { hasProductionDb: hasProd } = await import("../../db-production");
      const { mfExtendedEnrichmentService } = await import("../../services/mf-extended-enrichment-service");
      const { stockFinancialEnrichmentService } = await import("../../services/stock-financial-enrichment-service");
      
      const [mfStats, stockStats] = await Promise.all([
        mfExtendedEnrichmentService.getEnrichmentStats(),
        stockFinancialEnrichmentService.getEnrichmentStats(),
      ]);
      
      res.json({ 
        success: true, 
        productionDbConfigured: hasProd(),
        dataSource: hasProd() ? 'production' : 'development',
        mutualFunds: mfStats,
        stocks: stockStats,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // NAV-based metrics enrichment - trigger batch sync
  app.post("/api/admin/enrichment/nav-metrics/run", requireAdmin, async (req, res) => {
    try {
      const { mfReturnsSyncService } = await import("../../services/mf-returns-sync-service");
      const { maxFunds = 100 } = req.body;
      
      // Start async batch sync
      mfReturnsSyncService.runBatchSync(maxFunds).catch(err => {
        console.error('[NAV Metrics Enrichment] Batch sync failed:', err.message);
      });
      
      res.json({ success: true, message: 'NAV metrics sync started', status: 'running' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // NAV-based metrics enrichment - get status
  app.get("/api/admin/enrichment/nav-metrics/status", requireAdmin, async (req, res) => {
    try {
      const { mfReturnsSyncService } = await import("../../services/mf-returns-sync-service");
      const status = mfReturnsSyncService.getStatus();
      res.json({ success: true, status });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Run all enrichment jobs
  app.post("/api/admin/enrichment/run-all", requireAdmin, async (req, res) => {
    try {
      const { hasProductionDb: hasProd } = await import("../../db-production");
      if (!hasProd()) {
        return res.status(400).json({ 
          success: false, 
          error: 'PRODUCTION_DATABASE_URL not configured. Enrichment writes require production database.',
          hint: 'Set PRODUCTION_DATABASE_URL in environment secrets to enable enrichment.'
        });
      }

      const { mfExtendedEnrichmentService } = await import("../../services/mf-extended-enrichment-service");
      const { stockFinancialEnrichmentService } = await import("../../services/stock-financial-enrichment-service");
      const { mfReturnsSyncService } = await import("../../services/mf-returns-sync-service");
      
      const startedJobs: string[] = [];
      
      Promise.all([
        mfExtendedEnrichmentService.enrichAllFunds({ forceRefresh: false }).then(() => console.log('[Enrichment All] MF TER/AUM done')),
        stockFinancialEnrichmentService.enrichAllStocks({ useFmp: true, maxFmpStocks: 40, includeReturns: true }).then(() => console.log('[Enrichment All] Stock FMP enrichment done')),
        mfReturnsSyncService.runBatchSync(200).then(() => console.log('[Enrichment All] MF Returns done')),
      ]).catch(err => {
        console.error('[Enrichment All] Failed:', err.message);
      });
      startedJobs.push('mf_extended', 'stock_financials', 'mf_returns');
      
      try {
        const { benchmarkSyncService } = await import("../../services/benchmark-sync-service");
        benchmarkSyncService.syncAllBenchmarks().then(result => {
          console.log(`[Enrichment All] Benchmarks done: ${result.synced} synced`);
        }).catch(err => console.error('[Enrichment All] Benchmark sync failed:', err.message));
        startedJobs.push('benchmark_sync');
      } catch (err) { /* optional */ }
      
      try {
        const { amfiBenchmarkIngestionService } = await import("../../services/amfi-benchmark-ingestion-service");
        amfiBenchmarkIngestionService.syncAmfiSchemeBenchmarks().then(result => {
          console.log(`[Enrichment All] AMFI benchmarks done: ${result.normalized} normalized`);
        }).catch(err => console.error('[Enrichment All] AMFI benchmark failed:', err.message));
        startedJobs.push('amfi_benchmarks');
      } catch (err) { /* optional */ }
      
      try {
        const { bseBenchmarkService } = await import("../../services/bse-benchmark-service");
        bseBenchmarkService.seedBseIndices().then(result => {
          console.log(`[Enrichment All] BSE indices seeded: ${result.seeded} new`);
        }).catch(err => console.error('[Enrichment All] BSE seed failed:', err.message));
        startedJobs.push('bse_benchmark_seed');
      } catch (err) { /* optional */ }
      
      res.json({ success: true, message: 'All enrichment jobs started', jobs: startedJobs });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/enrichment/full-status", requireAdmin, async (req, res) => {
    try {
      const { hasProductionDb, getProductionDb } = await import("../../db-production");
      const statuses: Record<string, any> = {};

      statuses.productionDb = {
        configured: hasProductionDb(),
        message: hasProductionDb() ? 'Production database connected - enrichment will write to production' : 'PRODUCTION_DATABASE_URL not set - enrichment writes will be blocked',
      };
      
      try {
        const { dataEnrichmentScheduler } = await import("../../services/data-enrichment-scheduler");
        statuses.dataEnrichmentScheduler = dataEnrichmentScheduler.getStatus();
      } catch (e) { statuses.dataEnrichmentScheduler = { error: 'not loaded' }; }
      
      try {
        const { mfExtendedEnrichmentService } = await import("../../services/mf-extended-enrichment-service");
        statuses.mfExtended = mfExtendedEnrichmentService.getProgress();
      } catch (e) { statuses.mfExtended = { error: 'not loaded' }; }
      
      try {
        const { stockFinancialEnrichmentService } = await import("../../services/stock-financial-enrichment-service");
        statuses.stockFinancials = stockFinancialEnrichmentService.getProgress();
      } catch (e) { statuses.stockFinancials = { error: 'not loaded' }; }
      
      try {
        const { financialMetricsRefreshScheduler } = await import("../../services/financial-metrics-refresh-scheduler");
        statuses.metricsRefresh = financialMetricsRefreshScheduler.getStatus();
      } catch (e) { statuses.metricsRefresh = { error: 'not loaded' }; }
      
      try {
        const { historicalNavRefreshJob } = await import("../../services/historical-nav-refresh-job");
        statuses.historicalNav = await historicalNavRefreshJob.getStatus();
      } catch (e) { statuses.historicalNav = { error: 'not loaded' }; }

      const statsDb = hasProductionDb() ? getProductionDb() : db;
      const dbGaps = await statsDb.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM mutual_funds) as total_mf,
          (SELECT SUM(CASE WHEN returns_1y IS NULL THEN 1 ELSE 0 END) FROM mutual_funds) as mf_missing_returns,
          (SELECT SUM(CASE WHEN expense_ratio IS NULL THEN 1 ELSE 0 END) FROM mutual_funds) as mf_missing_expense,
          (SELECT COUNT(*) FROM mutual_funds) - (SELECT COUNT(DISTINCT scheme_code) FROM mutual_fund_metrics WHERE sharpe_ratio IS NOT NULL) as mf_missing_sharpe,
          (SELECT COUNT(*) FROM listed_stocks) as total_stocks,
          (SELECT SUM(CASE WHEN pe_ratio IS NULL THEN 1 ELSE 0 END) FROM listed_stocks) as stocks_missing_pe,
          (SELECT COUNT(*) FROM historical_nav_data) as total_nav_records,
          (SELECT COUNT(DISTINCT identifier) FROM historical_nav_data) as nav_unique_schemes,
          (SELECT COUNT(*) FROM market_index_nav) as total_benchmark_nav
      `);
      
      statuses.databaseGaps = dbGaps.rows[0];
      statuses.databaseGaps.dataSource = hasProductionDb() ? 'production' : 'development';
      
      res.json({ success: true, statuses });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Extended Data Extraction endpoints
  app.get("/api/admin/enrichment/extraction/stats", requireAdmin, async (req, res) => {
    try {
      const { mfExtendedDataExtractor } = await import("../../services/mf-extended-data-extractor");
      const stats = await mfExtendedDataExtractor.getExtractionStats();
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.get("/api/admin/enrichment/extraction/progress", requireAdmin, async (req, res) => {
    try {
      const { mfExtendedDataExtractor } = await import("../../services/mf-extended-data-extractor");
      const progress = mfExtendedDataExtractor.getProgress();
      res.json({ success: true, progress });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.post("/api/admin/enrichment/extraction/run", requireAdmin, async (req, res) => {
    try {
      const { mfExtendedDataExtractor } = await import("../../services/mf-extended-data-extractor");
      const { forceRefresh = false } = req.body;
      
      // Start extraction async
      mfExtendedDataExtractor.extractAllFunds({ forceRefresh }).catch(err => {
        console.error('[Extraction] Failed:', err.message);
      });
      
      res.json({ success: true, message: 'Extended data extraction started' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Scheduler status and control
  app.get("/api/admin/enrichment/scheduler/status", requireAdmin, async (req, res) => {
    try {
      const { dataEnrichmentScheduler } = await import("../../services/data-enrichment-scheduler");
      const status = dataEnrichmentScheduler.getStatus();
      res.json({ success: true, status });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.post("/api/admin/enrichment/scheduler/initialize", requireAdmin, async (req, res) => {
    try {
      const { dataEnrichmentScheduler } = await import("../../services/data-enrichment-scheduler");
      dataEnrichmentScheduler.initialize();
      res.json({ success: true, message: 'Scheduler initialized' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Initialize the scheduler on startup (production only - writes to DB)
  import("../../utils/enrichment-guard").then(({ isProductionEnvironment }) => {
    if (isProductionEnvironment()) {
      import("../../services/data-enrichment-scheduler").then(({ dataEnrichmentScheduler }) => {
        dataEnrichmentScheduler.initialize();
        console.log("✅ Data Enrichment Scheduler initialized");
      }).catch(err => {
        console.warn("⚠️ Failed to initialize Data Enrichment Scheduler:", err.message);
      });
    } else {
      console.log("⏭️ [DataEnrichment] Scheduler skipped (development mode - production only)");
    }
  });
  
  console.log("✅ Data Enrichment Admin routes registered");

  app.get("/api/admin/data-providers/health", requireAdmin, async (req, res) => {
    try {
      const { getProviderRegistry } = await import("../../services/screener/data-provider-registry");
      const registry = getProviderRegistry();
      const stats = registry.getStats();
      res.json({ success: true, ...stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/admin/data-providers/reset-metrics", requireAdmin, async (req, res) => {
    try {
      const { getProviderRegistry } = await import("../../services/screener/data-provider-registry");
      const registry = getProviderRegistry();
      const { providerName } = req.body;
      registry.resetMetrics(providerName || undefined);
      res.json({ success: true, message: providerName ? `Metrics reset for ${providerName}` : 'All metrics reset' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/data-providers/test/:provider", requireAdmin, async (req, res) => {
    try {
      const { getProviderRegistry } = await import("../../services/screener/data-provider-registry");
      const registry = getProviderRegistry();
      const testSymbol = req.query.symbol as string || 'RELIANCE.NS';

      const start = Date.now();
      const { result: profile, provider } = await registry.getCompanyProfile(testSymbol);
      const latency = Date.now() - start;

      res.json({
        success: true,
        test: {
          symbol: testSymbol,
          provider,
          latencyMs: latency,
          hasData: !!profile,
          data: profile ? { companyName: profile.companyName, sector: profile.sector, marketCap: profile.marketCap } : null,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/admin/data-providers/usage", requireAdmin, async (req, res) => {
    try {
      const { fmpUsageMonitor } = await import("../../services/screener/fmp-usage-monitor");
      const { getAlphaVantageProvider } = await import("../../services/screener/alpha-vantage-provider");

      const fmpStats = await fmpUsageMonitor.getDailyStats();
      const avProvider = getAlphaVantageProvider();
      const avStats = avProvider.getUsageStats();

      res.json({
        success: true,
        usage: {
          fmp: { dailyCalls: fmpStats.used, maxDaily: fmpStats.limit, remaining: fmpStats.remaining },
          alphaVantage: avStats,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log("✅ Data Provider Health routes registered");

  app.get("/api/admin/signal-audit", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const entries = await db.select()
        .from(signalResolutionLog)
        .orderBy(desc(signalResolutionLog.createdAt))
        .limit(limit);

      res.json({
        success: true,
        count: entries.length,
        entries
      });
    } catch (err) {
      console.error('[Admin] Signal audit fetch failed:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch signal audit log' });
    }
  });

  app.get("/api/admin/governance-policy", requireAdmin, async (_req, res) => {
    try {
      const matrix = signalOrchestrator.getGovernanceMatrix();
      res.json({ success: true, matrix });
    } catch (err) {
      console.error('[Admin] Governance policy fetch failed:', err);
      res.status(500).json({ success: false, error: 'Failed to fetch governance policy' });
    }
  });

  app.patch("/api/admin/governance-policy", requireAdmin, async (req, res) => {
    try {
      const { ruleId, updates } = req.body;
      if (!ruleId) {
        return res.status(400).json({ success: false, error: 'ruleId is required' });
      }

      signalOrchestrator.updateGovernanceRule(ruleId, updates);

      const existing = await db.select().from(governancePolicy).where(eq(governancePolicy.ruleId, ruleId));
      if (existing.length > 0) {
        await db.update(governancePolicy)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(governancePolicy.ruleId, ruleId));
      } else {
        const rule = signalOrchestrator.getGovernanceMatrix().find(r => r.id === ruleId);
        if (rule) {
          await db.insert(governancePolicy).values({
            ruleId: rule.id,
            potdSignal: rule.potdSignal,
            rebalanceSignal: rule.rebalanceSignal,
            resolvedAction: rule.resolvedAction,
            priority: rule.priority,
            description: rule.description,
            enabled: rule.enabled,
          });
        }
      }

      res.json({
        success: true,
        message: `Governance rule ${ruleId} updated`,
        currentMatrix: signalOrchestrator.getGovernanceMatrix()
      });
    } catch (err) {
      console.error('[Admin] Governance policy update failed:', err);
      res.status(500).json({ success: false, error: 'Failed to update governance policy' });
    }
  });

  console.log("✅ Signal Orchestrator admin routes registered");

  registerSEBIComplianceRoutes(app);

  console.log("✅ Admin Panel routes registered");
}
