/**
 * Probe42 Advanced Analytics API Routes
 * 
 * Endpoints for:
 * - Investable Surplus Detection
 * - Smart Lead Scoring
 * - Director Network Mining
 * - Sector-Based Targeting
 * - Geographic Heat Maps
 * - Automated Prospecting Alerts
 */

import { Router, Request, Response } from 'express';
import { getProbe42AnalyticsService } from '../services/probe42-analytics-service';
import { apiResponse } from '../utils/responses';
import { adminService } from '../admin-service';

const router = Router();
const analyticsService = getProbe42AnalyticsService();

// Middleware to check admin access (matches pattern from routes.ts)
const requireAdmin = async (req: any, res: Response, next: any) => {
  // Check if user is authenticated
  if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // Check if user is admin using adminService
  const isAdmin = await adminService.isAdmin(req.user.id);
  if (!isAdmin) {
    return apiResponse.forbidden(res, 'Admin access required');
  }
  next();
};

// ===================================================================
// ANALYTICS DASHBOARD
// ===================================================================

/**
 * Get comprehensive analytics summary
 */
router.get('/summary', requireAdmin, async (req: Request, res: Response) => {
  try {
    const summary = await analyticsService.getAnalyticsSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    return apiResponse.serverError(res, 'Failed to fetch analytics summary');
  }
});

// ===================================================================
// INVESTABLE SURPLUS DETECTION
// ===================================================================

/**
 * Calculate investable surplus for a specific company
 */
router.get('/surplus/:cin', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cin } = req.params;
    const surplus = await analyticsService.calculateInvestableSurplus(cin);
    
    if (!surplus) {
      return apiResponse.notFound(res, 'Company not found or insufficient data');
    }

    res.json(surplus);
  } catch (error) {
    console.error('Error calculating surplus:', error);
    return apiResponse.serverError(res, 'Failed to calculate investable surplus');
  }
});

/**
 * Find companies with high investable surplus
 */
router.get('/surplus', requireAdmin, async (req: Request, res: Response) => {
  try {
    const minSurplus = parseInt(req.query.minSurplus as string) || 10000000;
    const limit = parseInt(req.query.limit as string) || 50;

    const companies = await analyticsService.findHighSurplusCompanies(minSurplus, limit);
    res.json({
      count: companies.length,
      minSurplus,
      companies
    });
  } catch (error) {
    console.error('Error finding high surplus companies:', error);
    return apiResponse.serverError(res, 'Failed to find high surplus companies');
  }
});

// ===================================================================
// SMART LEAD SCORING
// ===================================================================

/**
 * Get smart lead score for a specific company
 */
router.get('/score/:cin', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cin } = req.params;
    const score = await analyticsService.calculateSmartLeadScore(cin);
    
    if (!score) {
      return apiResponse.notFound(res, 'Company not found or insufficient data');
    }

    res.json(score);
  } catch (error) {
    console.error('Error calculating lead score:', error);
    return apiResponse.serverError(res, 'Failed to calculate lead score');
  }
});

/**
 * Bulk score multiple leads
 */
router.post('/score/bulk', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { cins } = req.body;
    
    if (!cins || !Array.isArray(cins) || cins.length === 0) {
      return apiResponse.badRequest(res, 'CINs array is required');
    }

    if (cins.length > 50) {
      return apiResponse.badRequest(res, 'Maximum 50 CINs allowed per request');
    }

    const scores = await analyticsService.scoreLeadsBulk(cins);
    res.json({
      count: scores.length,
      scores
    });
  } catch (error) {
    console.error('Error bulk scoring leads:', error);
    return apiResponse.serverError(res, 'Failed to score leads');
  }
});

// ===================================================================
// DIRECTOR NETWORK MINING
// ===================================================================

/**
 * Get director network by DIN
 */
router.get('/directors/:din/network', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { din } = req.params;
    const network = await analyticsService.buildDirectorNetwork(din);
    
    if (!network) {
      return apiResponse.notFound(res, 'Director not found or no network data');
    }

    res.json(network);
  } catch (error) {
    console.error('Error building director network:', error);
    return apiResponse.serverError(res, 'Failed to build director network');
  }
});

/**
 * Find all directors with connections to existing clients
 */
router.get('/directors/connected', requireAdmin, async (req: Request, res: Response) => {
  try {
    const networks = await analyticsService.findConnectedDirectors();
    res.json({
      count: networks.length,
      networks
    });
  } catch (error) {
    console.error('Error finding connected directors:', error);
    return apiResponse.serverError(res, 'Failed to find connected directors');
  }
});

// ===================================================================
// SECTOR-BASED TARGETING
// ===================================================================

/**
 * Get available sectors with prospect counts
 */
router.get('/sectors', requireAdmin, async (req: Request, res: Response) => {
  try {
    const sectors = await analyticsService.getAvailableSectors();
    res.json(sectors);
  } catch (error) {
    console.error('Error fetching sectors:', error);
    return apiResponse.serverError(res, 'Failed to fetch sectors');
  }
});

/**
 * Get sector benchmarks and top performers
 */
router.get('/sectors/:sector/benchmarks', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { sector } = req.params;
    const benchmarks = await analyticsService.getSectorBenchmarks(decodeURIComponent(sector));
    
    if (!benchmarks) {
      return apiResponse.notFound(res, 'Sector not found or no data');
    }

    res.json(benchmarks);
  } catch (error) {
    console.error('Error fetching sector benchmarks:', error);
    return apiResponse.serverError(res, 'Failed to fetch sector benchmarks');
  }
});

// ===================================================================
// GEOGRAPHIC HEAT MAPS
// ===================================================================

/**
 * Get geographic heat map data
 */
router.get('/geo/heatmap', requireAdmin, async (req: Request, res: Response) => {
  try {
    const heatMap = await analyticsService.getGeographicHeatMap();
    res.json(heatMap);
  } catch (error) {
    console.error('Error generating heat map:', error);
    return apiResponse.serverError(res, 'Failed to generate heat map');
  }
});

/**
 * Get prospects by city within a state
 */
router.get('/geo/state/:state/cities', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { state } = req.params;
    const cities = await analyticsService.getProspectsByCity(decodeURIComponent(state));
    res.json(cities);
  } catch (error) {
    console.error('Error fetching city data:', error);
    return apiResponse.serverError(res, 'Failed to fetch city data');
  }
});

// ===================================================================
// AUTOMATED PROSPECTING ALERTS
// ===================================================================

/**
 * Check prospecting thresholds and generate alerts
 */
router.post('/alerts/check', requireAdmin, async (req: Request, res: Response) => {
  try {
    const thresholds = req.body;
    const alerts = await analyticsService.checkProspectingThresholds(thresholds);
    res.json({
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('Error checking thresholds:', error);
    return apiResponse.serverError(res, 'Failed to check thresholds');
  }
});

/**
 * Get active alerts
 */
router.get('/alerts', requireAdmin, async (req: Request, res: Response) => {
  try {
    const alerts = analyticsService.getActiveAlerts();
    res.json({
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return apiResponse.serverError(res, 'Failed to fetch alerts');
  }
});

/**
 * Acknowledge an alert
 */
router.post('/alerts/:alertId/acknowledge', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const success = analyticsService.acknowledgeAlert(alertId);
    
    if (!success) {
      return apiResponse.notFound(res, 'Alert not found');
    }

    res.json({ message: 'Alert acknowledged' });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return apiResponse.serverError(res, 'Failed to acknowledge alert');
  }
});

export default router;
