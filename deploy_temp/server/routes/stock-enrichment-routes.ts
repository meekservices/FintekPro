/**
 * Stock Enrichment API Routes
 * Endpoints for managing stock data enrichment
 */

import { Router, Request, Response } from "express";
import { stockEnrichmentService } from "../services/stock-enrichment-service";
import { mapToBroadSector, BROAD_SECTORS, getBroadSectorStats } from "../utils/sector-consolidation";

const router = Router();

router.get("/enrichment/progress", async (req: Request, res: Response) => {
  try {
    const progress = stockEnrichmentService.getProgress();
    res.json(progress);
  } catch (error: any) {
    console.error("[StockEnrichment] Error getting progress:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/enrichment/stats", async (req: Request, res: Response) => {
  try {
    const stats = await stockEnrichmentService.getEnrichmentStats();
    res.json(stats);
  } catch (error: any) {
    console.error("[StockEnrichment] Error getting stats:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/enrichment/start", async (req: Request, res: Response) => {
  try {
    const progress = stockEnrichmentService.getProgress();
    if (progress.status === 'running') {
      return res.status(409).json({ error: "Enrichment already in progress", progress });
    }

    stockEnrichmentService.enrichAllMissingData().catch(err => {
      console.error("[StockEnrichment] Background enrichment error:", err);
    });

    res.json({ 
      message: "Enrichment started", 
      progress: stockEnrichmentService.getProgress() 
    });
  } catch (error: any) {
    console.error("[StockEnrichment] Error starting enrichment:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/enrichment/broad-sectors", async (req: Request, res: Response) => {
  try {
    const result = await stockEnrichmentService.populateBroadSectors();
    res.json({
      success: true,
      message: `Updated ${result.updated} stocks with broad sectors`,
      ...result
    });
  } catch (error: any) {
    console.error("[StockEnrichment] Error populating broad sectors:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/sectors/broad", async (req: Request, res: Response) => {
  try {
    res.json({
      sectors: BROAD_SECTORS,
      mapping: getBroadSectorStats()
    });
  } catch (error: any) {
    console.error("[StockEnrichment] Error getting broad sectors:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/sectors/map/:granularSector", async (req: Request, res: Response) => {
  try {
    const { granularSector } = req.params;
    const broadSector = mapToBroadSector(granularSector);
    res.json({ granularSector, broadSector });
  } catch (error: any) {
    console.error("[StockEnrichment] Error mapping sector:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
