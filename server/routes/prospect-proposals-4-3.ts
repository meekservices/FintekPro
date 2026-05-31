// @ts-nocheck
import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  prospectProposals,
  prospectProposalEvents,
  onboardingInvitations,
  users,
  customerCareAgents,
  mutualFunds,
  mutualFundMetrics,
  corporateBonds,
  aifMaster,
  pmsMaster,
  mldMaster,
  listedStocks,
  aiRecommendationTracking
} from "@shared/schema";
import { eq, desc, and, sql, ilike, or } from "drizzle-orm";
import { aiRecommendationTrackingService } from "../services/ai-recommendation-tracking-service";
import { unifiedAIRecommendationEngine } from "../services/unified-ai-recommendation-engine";
import { riskSuitabilityEngine } from "../services/risk-suitability-engine";
import { returnForecastingEngine } from "../services/return-forecasting-engine";
import {
  resolveAgentName, getStoreEligibleMutualFunds, getStoreEligibleBonds, getStoreEligibleAIFs, getStoreEligiblePMS, getStoreEligibleMLDs, getStoreEligibleStocks, getExitLoadFromMetadata, deriveValuationMetrics, generateAIEnhancedRationale, generateAnalyticalRationale, buildMFRationale, buildStockRationale, buildPMSRationale, buildAIFRationale, buildDefaultRationale, calculateCapitalGainsTax, buildDynamicRecommendations
, upload
} from "./prospect-proposals-helpers";

const router = Router();
router.post("/api/agent/parse-holding-report", upload.single('file'), async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "PDF file is required" });
    }

    // Parse PDF using centralized PDF parser service
    const parseResult = await unifiedPDFParser.extractTextSafe(file.buffer);
    if (!parseResult.success || !parseResult.result) {
      return res.status(400).json({ 
        error: parseResult.error || "Failed to parse PDF file" 
      });
    }
    const text = parseResult.result.text;
    
    console.log("[PDF Parse] Extracted text length:", text.length);
    
    // Parse the holding report
    const parsedReport = parseHoldingReportPdf(text);
    
    console.log("[PDF Parse] Parsed holdings:", parsedReport.holdings.length);
    console.log("[PDF Parse] Client info:", parsedReport.clientInfo);
    
    res.json({
      success: true,
      fileName: file.originalname,
      parsedData: parsedReport,
      rawTextLength: text.length
    });
  } catch (error: any) {
    console.error("Parse holding report error:", error);
    res.status(500).json({ error: error.message || "Failed to parse holding report" });
  }
});



export default router;
