import { Router, Request, Response } from 'express';
import { isinIntelligenceService, type ISINMetadata } from '../services/isin-intelligence-service';
import { isAuthenticated } from '../auth-setup';

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
    
    if (!isin) {
      return res.status(400).json({ 
        success: false, 
        error: 'ISIN is required' 
      });
    }
    
    const cleanedISIN = isin.trim().toUpperCase();
    const validation = await isinIntelligenceService.validateISIN(cleanedISIN, metadata as ISINMetadata || {});
    
    res.json({
      success: true,
      isin: cleanedISIN,
      valid: validation.valid,
      errors: validation.errors,
      checksumValid: validation.checksumValid
    });
  } catch (error: any) {
    console.error('[ISIN Intelligence] Validation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Validation failed' 
    });
  }
});

router.post('/checksum/verify', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { isin } = req.body;
    
    if (!isin || typeof isin !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'ISIN is required' 
      });
    }
    
    const cleanedISIN = isin.trim().toUpperCase();
    const result = isinIntelligenceService.verifyISINChecksum(cleanedISIN);
    
    res.json({
      success: true,
      isin: cleanedISIN,
      checksumValid: result.valid,
      computedCheckDigit: result.computedCheckDigit,
      providedCheckDigit: result.providedCheckDigit,
      correctedISIN: result.valid ? cleanedISIN : cleanedISIN.slice(0, 11) + result.computedCheckDigit
    });
  } catch (error: any) {
    console.error('[ISIN Intelligence] Checksum verification error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Checksum verification failed' 
    });
  }
});

router.post('/checksum/batch', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { isins } = req.body;
    
    if (!Array.isArray(isins) || isins.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'ISINs array is required' 
      });
    }
    
    if (isins.length > 1000) {
      return res.status(400).json({ 
        success: false, 
        error: 'Maximum 1000 ISINs per batch' 
      });
    }
    
    const results = isins.map((isin: string) => {
      const cleanedISIN = isin.trim().toUpperCase();
      const result = isinIntelligenceService.verifyISINChecksum(cleanedISIN);
      return {
        isin: cleanedISIN,
        valid: result.valid,
        computedCheckDigit: result.computedCheckDigit,
        providedCheckDigit: result.providedCheckDigit
      };
    });
    
    res.json({
      success: true,
      results,
      summary: {
        total: results.length,
        valid: results.filter(r => r.valid).length,
        invalid: results.filter(r => !r.valid).length
      }
    });
  } catch (error: any) {
    console.error('[ISIN Intelligence] Batch checksum error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Batch checksum verification failed' 
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

// ISIN Coverage Dashboard endpoint
router.get('/coverage', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');
    
    // Get coverage stats from all product tables
    const coverageStats = await db.execute(sql`
      SELECT 
        'listed_stocks' as table_name,
        COUNT(*)::integer as total,
        COUNT(CASE WHEN isin IS NOT NULL AND isin != '' THEN 1 END)::integer as with_isin,
        COUNT(CASE WHEN region IS NOT NULL THEN 1 END)::integer as with_region
      FROM listed_stocks
      UNION ALL
      SELECT 'bond_catalog', COUNT(*)::integer, 
        COUNT(CASE WHEN isin IS NOT NULL AND isin != '' THEN 1 END)::integer,
        COUNT(CASE WHEN region IS NOT NULL THEN 1 END)::integer
      FROM bond_catalog
      UNION ALL
      SELECT 'unlisted_companies', COUNT(*)::integer, 
        COUNT(CASE WHEN isin IS NOT NULL AND isin != '' THEN 1 END)::integer,
        COUNT(CASE WHEN region IS NOT NULL THEN 1 END)::integer
      FROM unlisted_companies
      UNION ALL
      SELECT 'instrument_master', COUNT(*)::integer, 
        COUNT(CASE WHEN isin IS NOT NULL AND isin != '' THEN 1 END)::integer,
        COUNT(CASE WHEN region IS NOT NULL THEN 1 END)::integer
      FROM instrument_master
      ORDER BY table_name
    `);
    
    // Get region distribution from instrument_master
    const regionDistribution = await db.execute(sql`
      SELECT region, country, exchange, COUNT(*)::integer as count
      FROM instrument_master
      WHERE region IS NOT NULL
      GROUP BY region, country, exchange
      ORDER BY count DESC
    `);
    
    // Get ISIN prefix distribution for Indian instruments
    const prefixDistribution = await db.execute(sql`
      SELECT 
        SUBSTRING(isin, 1, 3) as isin_prefix,
        COUNT(*)::integer as count
      FROM instrument_master
      WHERE isin LIKE 'IN%'
      GROUP BY SUBSTRING(isin, 1, 3)
      ORDER BY count DESC
    `);
    
    // Calculate overall coverage
    const totalRecords = coverageStats.rows.reduce((sum: number, r: any) => sum + (r.total || 0), 0);
    const totalWithISIN = coverageStats.rows.reduce((sum: number, r: any) => sum + (r.with_isin || 0), 0);
    const totalWithRegion = coverageStats.rows.reduce((sum: number, r: any) => sum + (r.with_region || 0), 0);
    
    res.json({
      success: true,
      coverage: {
        overall: {
          totalRecords,
          withISIN: totalWithISIN,
          withRegion: totalWithRegion,
          isinCoveragePct: totalRecords > 0 ? Math.round((totalWithISIN / totalRecords) * 1000) / 10 : 0,
          regionCoveragePct: totalRecords > 0 ? Math.round((totalWithRegion / totalRecords) * 1000) / 10 : 0
        },
        byTable: coverageStats.rows.map((r: any) => ({
          tableName: r.table_name,
          total: r.total,
          withISIN: r.with_isin,
          withRegion: r.with_region,
          isinCoveragePct: r.total > 0 ? Math.round((r.with_isin / r.total) * 1000) / 10 : 0,
          regionCoveragePct: r.total > 0 ? Math.round((r.with_region / r.total) * 1000) / 10 : 0
        })),
        byRegion: regionDistribution.rows,
        byPrefix: prefixDistribution.rows
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[ISIN Intelligence] Coverage stats error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch coverage stats' 
    });
  }
});

// Coverage by asset class
router.get('/coverage/by-asset-class', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');
    
    const assetClassStats = await db.execute(sql`
      SELECT 
        asset_class,
        region,
        COUNT(*)::integer as count,
        COUNT(CASE WHEN isin IS NOT NULL AND isin != '' THEN 1 END)::integer as with_isin
      FROM instrument_master
      GROUP BY asset_class, region
      ORDER BY count DESC
    `);
    
    res.json({
      success: true,
      assetClassCoverage: assetClassStats.rows
    });
  } catch (error: any) {
    console.error('[ISIN Intelligence] Asset class coverage error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch asset class coverage' 
    });
  }
});

export default router;
