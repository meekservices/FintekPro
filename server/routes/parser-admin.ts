/**
 * Parser Admin Routes
 * 
 * Admin endpoints for controlling PDF Parser v2 configuration:
 * - Set parser version (v1/v2/dual)
 * - Enable/disable dual-run mode
 * - Force v1 fallback (rollback switch)
 * - View parser stats and cache
 */

import { Router } from 'express';
import { pdfParserV2Service, type ParserVersion, type ParserConfig } from '../services/pdf-parser-v2';

const router = Router();

router.get('/config', (req, res) => {
  try {
    const config = pdfParserV2Service.getConfig();
    const cacheStats = pdfParserV2Service.getProfileCacheStats();
    
    res.json({
      success: true,
      config,
      cache: cacheStats,
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/config', (req, res) => {
  try {
    const updates: Partial<ParserConfig> = {};
    
    if (req.body.version && ['v1', 'v2', 'dual'].includes(req.body.version)) {
      updates.version = req.body.version as ParserVersion;
    }
    
    if (typeof req.body.enableDualRun === 'boolean') {
      updates.enableDualRun = req.body.enableDualRun;
    }
    
    if (typeof req.body.enableLearning === 'boolean') {
      updates.enableLearning = req.body.enableLearning;
    }
    
    if (typeof req.body.enableConfidenceScoring === 'boolean') {
      updates.enableConfidenceScoring = req.body.enableConfidenceScoring;
    }
    
    if (typeof req.body.logComparisons === 'boolean') {
      updates.logComparisons = req.body.logComparisons;
    }
    
    if (typeof req.body.forceV1Fallback === 'boolean') {
      updates.forceV1Fallback = req.body.forceV1Fallback;
    }
    
    if (typeof req.body.minConfidenceThreshold === 'number') {
      updates.minConfidenceThreshold = Math.max(0, Math.min(1, req.body.minConfidenceThreshold));
    }
    
    pdfParserV2Service.setConfig(updates);
    
    res.json({
      success: true,
      message: 'Parser configuration updated',
      config: pdfParserV2Service.getConfig(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/version', (req, res) => {
  try {
    const { version } = req.body;
    
    if (!version || !['v1', 'v2', 'dual'].includes(version)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid version. Must be v1, v2, or dual',
      });
    }
    
    pdfParserV2Service.setVersion(version as ParserVersion);
    
    res.json({
      success: true,
      message: `Parser version set to ${version}`,
      config: pdfParserV2Service.getConfig(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/dual-run', (req, res) => {
  try {
    const { enable } = req.body;
    
    if (typeof enable !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enable must be a boolean',
      });
    }
    
    pdfParserV2Service.enableDualRun(enable);
    
    res.json({
      success: true,
      message: `Dual-run mode ${enable ? 'enabled' : 'disabled'}`,
      config: pdfParserV2Service.getConfig(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/rollback', (req, res) => {
  try {
    const { force } = req.body;
    const shouldForce = force !== false;
    
    pdfParserV2Service.forceV1Fallback(shouldForce);
    
    res.json({
      success: true,
      message: shouldForce 
        ? 'Rollback activated - all parsing will use v1' 
        : 'Rollback deactivated - parser will use configured version',
      config: pdfParserV2Service.getConfig(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/cache/clear', (req, res) => {
  try {
    pdfParserV2Service.clearProfileCache();
    
    res.json({
      success: true,
      message: 'Profile cache cleared',
      cache: pdfParserV2Service.getProfileCacheStats(),
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/cache/stats', (req, res) => {
  try {
    const stats = pdfParserV2Service.getProfileCacheStats();
    
    res.json({
      success: true,
      cache: stats,
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
