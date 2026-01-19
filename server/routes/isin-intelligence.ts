import { Router, Request, Response } from 'express';
import { isinIntelligenceService, type ISINMetadata } from '../services/isin-intelligence-service';
import { isAuthenticated } from '../replitAuth';

const router = Router();

router.post('/detect', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { isin, metadata } = req.body;
    
    if (!isin || typeof isin !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'ISIN is required' 
      });
    }
    
    const cleanedISIN = isin.trim().toUpperCase();
    
    if (cleanedISIN.length !== 12) {
      return res.status(400).json({ 
        success: false, 
        error: 'ISIN must be exactly 12 characters' 
      });
    }
    
    const result = await isinIntelligenceService.detectInstrument(cleanedISIN, metadata as ISINMetadata);
    
    res.json({
      success: true,
      detection: result,
      regulator: isinIntelligenceService.getRegulatorInfo(result)
    });
  } catch (error: any) {
    console.error('[ISIN Intelligence] Detection error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Detection failed' 
    });
  }
});

router.post('/detect/batch', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { isins } = req.body;
    
    if (!Array.isArray(isins) || isins.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'ISINs array is required' 
      });
    }
    
    if (isins.length > 100) {
      return res.status(400).json({ 
        success: false, 
        error: 'Maximum 100 ISINs per batch' 
      });
    }
    
    const results = await Promise.all(
      isins.map(async (item: { isin: string; metadata?: ISINMetadata }) => {
        const isin = typeof item === 'string' ? item : item.isin;
        const metadata = typeof item === 'object' ? item.metadata : undefined;
        const cleanedISIN = isin.trim().toUpperCase();
        return isinIntelligenceService.detectInstrument(cleanedISIN, metadata);
      })
    );
    
    res.json({
      success: true,
      detections: results,
      summary: {
        total: results.length,
        validated: results.filter(r => r.validationStatus === 'validated').length,
        conflicts: results.filter(r => r.validationStatus === 'conflict').length,
        unknown: results.filter(r => r.validationStatus === 'unknown').length,
        edgeCases: results.filter(r => r.isEdgeCase).length
      }
    });
  } catch (error: any) {
    console.error('[ISIN Intelligence] Batch detection error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Batch detection failed' 
    });
  }
});

router.post('/validate', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { isin, metadata } = req.body;
    
    if (!isin || !metadata) {
      return res.status(400).json({ 
        success: false, 
        error: 'ISIN and metadata are required' 
      });
    }
    
    const cleanedISIN = isin.trim().toUpperCase();
    const validation = await isinIntelligenceService.validateISIN(cleanedISIN, metadata as ISINMetadata);
    
    res.json({
      success: true,
      isin: cleanedISIN,
      valid: validation.valid,
      errors: validation.errors
    });
  } catch (error: any) {
    console.error('[ISIN Intelligence] Validation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Validation failed' 
    });
  }
});

router.get('/lookup/:isin', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { isin } = req.params;
    const cleanedISIN = isin.trim().toUpperCase();
    
    if (cleanedISIN.length !== 12) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid ISIN format' 
      });
    }
    
    const instrument = await isinIntelligenceService.lookupISIN(cleanedISIN);
    
    if (!instrument) {
      const detection = await isinIntelligenceService.detectInstrument(cleanedISIN);
      return res.json({
        success: true,
        found: false,
        instrument: null,
        detection
      });
    }
    
    res.json({
      success: true,
      found: true,
      instrument
    });
  } catch (error: any) {
    console.error('[ISIN Intelligence] Lookup error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Lookup failed' 
    });
  }
});

router.post('/register', isAuthenticated, async (req: Request, res: Response) => {
  try {
    // Role check - only agents and admins can register instruments
    const user = (req as any).user;
    if (user?.role !== 'admin' && user?.role !== 'agent') {
      return res.status(403).json({ 
        success: false, 
        error: 'Only agents and admins can register instruments' 
      });
    }
    
    const { isin, metadata, autoDetect = true } = req.body;
    
    if (!isin) {
      return res.status(400).json({ 
        success: false, 
        error: 'ISIN is required' 
      });
    }
    
    const cleanedISIN = isin.trim().toUpperCase();
    
    let detection;
    if (autoDetect) {
      detection = await isinIntelligenceService.detectInstrument(cleanedISIN, metadata as ISINMetadata);
    } else {
      detection = await isinIntelligenceService.detectInstrument(cleanedISIN);
    }
    
    const instrument = await isinIntelligenceService.upsertInstrument(cleanedISIN, detection, metadata as ISINMetadata);
    
    if (!instrument) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to register instrument' 
      });
    }
    
    res.json({
      success: true,
      instrument,
      detection
    });
  } catch (error: any) {
    console.error('[ISIN Intelligence] Registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Registration failed' 
    });
  }
});

router.get('/prefix-rules', isAuthenticated, async (req: Request, res: Response) => {
  const rules = {
    INF: {
      description: 'Mutual Funds / ETFs',
      primaryRegulator: 'SEBI',
      expectedInstruments: ['Mutual Fund', 'ETF', 'Fund of Funds'],
      mandatoryFields: ['plan', 'option'],
      rejectIf: ['coupon exists', 'maturity exists']
    },
    INS: {
      description: 'Government Securities',
      primaryRegulator: 'RBI',
      expectedInstruments: ['G-Sec', 'T-Bill', 'SDL', 'SGB'],
      mandatoryFields: ['maturity', 'coupon (except T-Bills)'],
      rejectIf: ['issuer is private']
    },
    INE: {
      description: 'Listed Securities (Complex Resolution)',
      primaryRegulator: 'SEBI / RBI (depends on issuer)',
      expectedInstruments: ['Equity', 'NCD', 'AT1 Bond', 'MLD', 'REIT/InvIT Units'],
      resolution: 'Deep resolver based on issuer type and instrument attributes',
      edgeCases: ['Bank bonds (RBI)', 'NBFC NCDs (dual)', 'MLDs (structured)', 'AT1 (perpetual)']
    },
    INV: {
      description: 'Securitised Instruments',
      primaryRegulator: 'SEBI',
      expectedInstruments: ['Pass Through Certificate', 'ABS', 'MBS'],
      mandatoryFields: ['pool_id'],
      rejectIf: ['issuer missing']
    },
    INX: {
      description: 'Temporary/Entitlement Instruments',
      primaryRegulator: 'SEBI',
      expectedInstruments: ['Rights Entitlement', 'Partly Paid', 'Bonus Entitlement'],
      mandatoryFields: ['expiry_date'],
      rejectIf: ['maturity exists']
    }
  };
  
  res.json({
    success: true,
    rules,
    version: '1.0.0',
    lastUpdated: '2026-01-19'
  });
});

router.get('/edge-cases', isAuthenticated, async (req: Request, res: Response) => {
  const edgeCases = {
    MLD: {
      name: 'Market Linked Debentures',
      detection: 'INE + structured = TRUE + coupon NULL',
      assetClass: 'Fixed Income',
      subClass: 'Structured Debt',
      riskLevel: 'very_high',
      regulator: 'SEBI'
    },
    AT1: {
      name: 'Additional Tier-1 Bonds',
      detection: 'INE + issuer_type = BANK + perpetual = TRUE',
      assetClass: 'Fixed Income',
      subClass: 'Bank Capital Instrument',
      riskLevel: 'very_high',
      regulator: 'RBI',
      notes: 'No maturity, write-down/conversion clauses'
    },
    SGB: {
      name: 'Sovereign Gold Bonds',
      detection: 'INS + gold_linked = TRUE',
      assetClass: 'Commodities',
      subClass: 'Gold-Linked Bond',
      riskLevel: 'low',
      regulator: 'RBI'
    },
    CONVERTIBLE: {
      name: 'Convertible Instruments',
      detection: 'INE + coupon + equity_flag = TRUE',
      assetClass: 'Fixed Income',
      subClass: 'Equity-Linked Debt',
      riskLevel: 'high',
      regulator: 'SEBI',
      notes: 'Primary: Debt, Secondary: Equity-linked'
    },
    PERPETUAL: {
      name: 'Perpetual Bonds (Tier-2)',
      detection: 'INE + issuer_type = BANK + perpetual = TRUE + has maturity terms',
      assetClass: 'Fixed Income',
      subClass: 'Perpetual Debt',
      riskLevel: 'very_high',
      regulator: 'RBI'
    }
  };
  
  res.json({
    success: true,
    edgeCases
  });
});

export default router;
