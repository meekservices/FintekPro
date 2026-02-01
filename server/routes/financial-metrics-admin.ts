/**
 * Financial Metrics Admin Routes
 * 
 * Admin-only endpoints to manage and refresh financial metrics from real data sources.
 * Includes audit trail and compliance documentation endpoints.
 * 
 * SECURITY: All endpoints require admin or master_agent role.
 * This router is mounted with requireAdmin middleware at app.use level.
 */

import { Router } from 'express';
import { mutualFundMetricsService } from '../services/mutual-fund-metrics-service';
import { stockMetricsService } from '../services/stock-metrics-service';
import { financialMetricsRefreshScheduler } from '../services/financial-metrics-refresh-scheduler';

const router = Router();

/**
 * Helper to verify admin/master_agent role
 * Note: requireAdmin middleware at app.use level already validates this,
 * but we add explicit checks for defense-in-depth
 */
function verifyAdminRole(req: any, res: any): boolean {
  const user = req.user as any;
  const roles = user?.roles || [];
  
  if (!roles.includes('admin') && !roles.includes('master_agent')) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return false;
  }
  return true;
}

/**
 * Get scheduler status and last refresh results
 * ADMIN ONLY - contains compliance-sensitive information
 */
router.get('/status', async (req, res) => {
  try {
    if (!verifyAdminRole(req, res)) return;
    
    const status = financialMetricsRefreshScheduler.getStatus();
    res.json({
      success: true,
      status
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get methodology documentation for regulatory compliance
 * ADMIN ONLY - regulatory audit documentation
 */
router.get('/methodology', async (req, res) => {
  try {
    if (!verifyAdminRole(req, res)) return;
    
    const documentation = financialMetricsRefreshScheduler.getMethodologyDocumentation();
    res.json({
      success: true,
      documentation,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get audit log for mutual fund calculations
 * ADMIN ONLY - compliance audit trail
 */
router.get('/audit-log/mutual-funds', async (req, res) => {
  try {
    if (!verifyAdminRole(req, res)) return;
    
    const auditLog = await mutualFundMetricsService.getPersistedAuditLog();
    res.json({
      success: true,
      entries: auditLog,
      count: auditLog.length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get audit log for stock calculations
 * ADMIN ONLY - compliance audit trail
 */
router.get('/audit-log/stocks', async (req, res) => {
  try {
    if (!verifyAdminRole(req, res)) return;
    
    const auditLog = await stockMetricsService.getPersistedAuditLog();
    res.json({
      success: true,
      entries: auditLog,
      count: auditLog.length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Trigger immediate refresh for mutual funds
 * ADMIN ONLY
 */
router.post('/refresh/mutual-funds', async (req, res) => {
  try {
    if (!verifyAdminRole(req, res)) return;

    const user = req.user as any;
    const { limit = 100 } = req.body;
    
    console.log(`[Admin] Triggering mutual fund refresh (limit: ${limit}) by ${user?.email}`);
    
    const result = await mutualFundMetricsService.refreshAllReturns({ 
      forceRefresh: false,
      limit 
    });

    res.json({
      success: true,
      result,
      triggeredBy: user?.email
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Trigger immediate refresh for stocks
 * ADMIN ONLY
 */
router.post('/refresh/stocks', async (req, res) => {
  try {
    if (!verifyAdminRole(req, res)) return;

    const user = req.user as any;
    const { limit = 50 } = req.body;
    
    console.log(`[Admin] Triggering stock metrics refresh (limit: ${limit}) by ${user?.email}`);
    
    const result = await stockMetricsService.refreshAllMetrics({ 
      forceRefresh: false,
      limit 
    });

    res.json({
      success: true,
      result,
      triggeredBy: user?.email
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Refresh metrics for a specific mutual fund scheme
 * ADMIN ONLY
 */
router.post('/refresh/mutual-fund/:schemeCode', async (req, res) => {
  try {
    if (!verifyAdminRole(req, res)) return;
    
    const { schemeCode } = req.params;
    const user = req.user as any;
    
    console.log(`[Admin] Refreshing metrics for scheme ${schemeCode} by ${user?.email}`);
    
    // First fetch and store NAV history
    await mutualFundMetricsService.fetchAndStoreNavHistory(schemeCode);
    
    // Calculate returns
    const returns = await mutualFundMetricsService.calculateReturnsForScheme(schemeCode);
    
    // Update database
    const success = await mutualFundMetricsService.updateSchemeReturns(schemeCode);

    res.json({
      success,
      schemeCode,
      returns,
      message: success ? 'Metrics updated successfully' : 'No NAV data available',
      triggeredBy: user?.email
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Refresh metrics for a specific stock
 * ADMIN ONLY
 */
router.post('/refresh/stock/:symbol', async (req, res) => {
  try {
    if (!verifyAdminRole(req, res)) return;
    
    const { symbol } = req.params;
    const user = req.user as any;
    
    console.log(`[Admin] Refreshing metrics for stock ${symbol} by ${user?.email}`);
    
    const metrics = await stockMetricsService.fetchMetricsForStock(symbol);
    
    if (!metrics) {
      return res.status(404).json({ 
        success: false, 
        error: 'No data found for this stock symbol'
      });
    }

    const success = await stockMetricsService.updateStockMetrics(symbol);

    res.json({
      success,
      symbol,
      metrics,
      message: success ? 'Metrics updated successfully' : 'Update failed',
      triggeredBy: user?.email
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Start the refresh scheduler
 * ADMIN ONLY
 */
router.post('/scheduler/start', async (req, res) => {
  try {
    if (!verifyAdminRole(req, res)) return;
    
    const user = req.user as any;
    console.log(`[Admin] Starting metrics scheduler by ${user?.email}`);

    financialMetricsRefreshScheduler.start();
    
    res.json({
      success: true,
      message: 'Scheduler started',
      status: financialMetricsRefreshScheduler.getStatus(),
      triggeredBy: user?.email
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Stop the refresh scheduler
 * ADMIN ONLY
 */
router.post('/scheduler/stop', async (req, res) => {
  try {
    if (!verifyAdminRole(req, res)) return;
    
    const user = req.user as any;
    console.log(`[Admin] Stopping metrics scheduler by ${user?.email}`);

    financialMetricsRefreshScheduler.stop();
    
    res.json({
      success: true,
      message: 'Scheduler stopped',
      status: financialMetricsRefreshScheduler.getStatus(),
      triggeredBy: user?.email
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Trigger immediate full refresh (both mutual funds and stocks)
 * ADMIN ONLY
 */
router.post('/refresh/all', async (req, res) => {
  try {
    if (!verifyAdminRole(req, res)) return;
    
    const user = req.user as any;
    console.log(`[Admin] Triggering full metrics refresh by ${user?.email}`);
    
    const result = await financialMetricsRefreshScheduler.triggerImmediateRefresh();

    res.json({
      success: true,
      result,
      triggeredBy: user?.email
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
