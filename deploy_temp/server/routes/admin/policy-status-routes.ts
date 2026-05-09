import { Router, Request, Response } from 'express';
import { marketRegimeDetector } from '../../services/risk';

const router = Router();

/**
 * Platform Policy Status Endpoint
 * Exposes the internal state of the Market Resilience engine.
 * Used by the frontend to display transparency banners regarding safety fallbacks.
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const isBlackSwanActive = marketRegimeDetector.detectBlackSwanEvent();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      policy_version: "1.1.0",
      market_regime: {
        is_black_swan_active: isBlackSwanActive,
        protective_mode_engaged: isBlackSwanActive,
        volatility_intercept_active: isBlackSwanActive,
        last_check: new Date().toISOString()
      },
      governance_status: "Operational",
      compliance_engine: "Healthy"
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
