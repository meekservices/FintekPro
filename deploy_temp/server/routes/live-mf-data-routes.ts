import { Router, Request, Response } from 'express';
import { liveMFDataService } from '../services/live-mf-data-service';

const router = Router();

router.get('/status', async (req: Request, res: Response) => {
  try {
    const stats = liveMFDataService.getCacheStats();
    res.json({
      success: true,
      cache: {
        fundsCount: stats.size,
        ageSeconds: stats.age,
        isValid: stats.isValid,
        ttlSeconds: 3600
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const success = await liveMFDataService.refreshCache();
    const stats = liveMFDataService.getCacheStats();
    
    res.json({
      success,
      message: success ? 'Cache refreshed successfully' : 'Cache refresh failed',
      cache: {
        fundsCount: stats.size,
        ageSeconds: stats.age
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/nav/:schemeCode', async (req: Request, res: Response) => {
  try {
    const { schemeCode } = req.params;
    const navData = await liveMFDataService.getLiveNav(schemeCode);
    
    if (!navData) {
      return res.status(404).json({ 
        success: false, 
        error: 'Fund not found or NAV data unavailable' 
      });
    }

    const returns = await liveMFDataService.calculateReturns(schemeCode);

    res.json({
      success: true,
      data: {
        ...navData,
        returns
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sync-database', async (req: Request, res: Response) => {
  try {
    const { schemeCodes } = req.body;
    const result = await liveMFDataService.updateDatabaseWithLiveData(schemeCodes);
    
    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sync-new-funds', async (req: Request, res: Response) => {
  try {
    const added = await liveMFDataService.syncNewFundsFromAmfi();
    
    res.json({
      success: true,
      fundsAdded: added
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/enhanced/:schemeCode', async (req: Request, res: Response) => {
  try {
    const { schemeCode } = req.params;
    const data = await liveMFDataService.getEnhancedFundData(schemeCode);
    
    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
