import { Router } from "express";
import { aiInvestmentService } from "../services/ai-investment-service";
import { db } from "../db";
import { 
  portfolios, 
  portfolioHoldings, 
  aiProfitPicks, 
  portfolioAlerts, 
  aiPortfolioAnalysis,
  aiTalkingPoints,
  marketData,
  prospectClients,
  users
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import { prospectPortfolioSyncService } from "../services/prospect-portfolio-sync-service";
import { requireRole } from "../middleware/roleMiddleware";
import { unifiedPortfolioImportService } from "../services/unified-portfolio-import-service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to resolve clientId to prospect or user and return appropriate portfolio lookup
async function resolveClientType(clientId: string): Promise<{
  isProspect: boolean;
  isUser: boolean;
  prospect: any | null;
  user: any | null;
  portfolioWhereClause: ReturnType<typeof eq>;
  getPortfolioCreateValues: (name: string, source?: string) => any;
}> {
  const [prospect] = await db
    .select()
    .from(prospectClients)
    .where(eq(prospectClients.id, clientId))
    .limit(1);
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);
  
  const isProspect = !!prospect;
  const isUser = !!user;
  
  return {
    isProspect,
    isUser,
    prospect,
    user,
    portfolioWhereClause: isProspect 
      ? eq(portfolios.prospectId, clientId)
      : eq(portfolios.userId, clientId),
    getPortfolioCreateValues: (name: string, source?: string) => isProspect
      ? {
          prospectId: clientId,
          name: `${prospect?.name || 'Prospect'}'s ${name}`,
          isDefault: true,
          source: source as any || 'manual',
          isVerified: false
        }
      : {
          userId: clientId,
          name,
          isDefault: true,
        }
  };
}

const manualEntrySchema = z.object({
  clientId: z.string(),
  holdings: z.array(z.object({
    symbol: z.string(),
    stockName: z.string().optional(),
    quantity: z.number().positive(),
    avgPrice: z.number().positive(),
    assetType: z.string().default('equity'),
    sector: z.string().optional(),
    purchaseDate: z.string().optional(), // ISO date string for exit load & capital gains calculation
  }))
});

const csvUploadSchema = z.object({
  clientId: z.string(),
});

router.post("/portfolio/preview-pdf", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Use unified service for better provider detection, holding lots, and ISIN enrichment
    const result = await unifiedPortfolioImportService.importFromPDF(
      req.file.buffer,
      req.file.originalname || 'statement.pdf',
      { detectCAS: true }
    );

    // Extract profile info for provider detection display
    const profile = (result as any).profile;
    const parsingMetrics = (result as any).parsingMetrics;
    const holdingLots = (result as any).holdingLots;

    res.json({
      success: result.success,
      holdings: result.holdings.map((h: any) => ({
        id: h.id || crypto.randomUUID(),
        name: h.schemeName || h.name || 'Unknown',
        symbol: h.isin || h.symbol,
        isin: h.isin,
        quantity: h.units || h.quantity || 0,
        averagePrice: h.avgCostPerUnit || (h.investedValue / (h.units || 1)) || 0,
        currentValue: h.currentValue || 0,
        investedValue: h.investedValue || 0,
        assetType: h.assetType || 'mutual_fund',
        folioNumber: h.folioNumber,
        confidenceScore: h.confidenceScore,
        broker: h.broker,
        purchaseDate: h.purchaseDate,
        // ISIN enrichment data
        isinMatched: !!h.isin && h.confidenceScore && h.confidenceScore >= 0.7,
        exitLoadInfo: (h as any).exitLoadInfo,
        category: (h as any).category,
        fundHouse: (h as any).fundHouse,
        // Holding lots for SIP tracking and capital gains
        lots: h.lots
      })),
      // Provider detection from unified parser
      providerDetected: profile?.brokerInfo?.name || result.brokerDetected,
      providerType: profile?.documentType,
      providerConfidence: profile?.confidence,
      confidenceScore: result.confidenceScore,
      // Summary stats
      summary: result.summary,
      investor: result.investor,
      // Holding lots for LTCG/STCG calculations
      holdingLots: holdingLots,
      // Parsing metrics for debugging
      parsingMetrics: parsingMetrics,
      errors: result.errors,
      needsManualReview: result.parsingStatus === 'needs_review' || (result.confidenceScore || 0) < 0.7
    });
  } catch (error: any) {
    console.error("Error previewing PDF:", error);
    res.status(500).json({ error: error.message || "Failed to parse PDF" });
  }
});

// POST endpoint for importing previewed CAS holdings
router.post("/portfolio/:clientId/import-previewed", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { holdings } = req.body;
    
    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      return res.status(400).json({ error: "No holdings provided" });
    }

    // Resolve client type (prospect vs user) using shared helper
    const clientInfo = await resolveClientType(clientId);
    if (!clientInfo.isProspect && !clientInfo.isUser) {
      return res.status(404).json({ error: "Client not found. Must be a valid prospect or user." });
    }

    // For prospects: write to unified currentPortfolio
    if (clientInfo.isProspect) {
      const normalizedHoldings = holdings.map((h: any) => ({
        name: h.name || h.schemeName || h.symbol || 'Unknown',
        isin: h.isin,
        symbol: h.symbol?.toUpperCase(),
        assetType: h.assetType === 'mutual_fund' ? 'mutual_fund' : (h.assetType || 'equity'),
        productType: h.productType || (h.assetType === 'mutual_fund' ? 'MF' : undefined),
        quantity: parseFloat(h.quantity || h.units) || 0,
        averageCost: parseFloat(h.averagePrice || h.avgPrice) || 0,
        currentValue: parseFloat(h.value || h.currentValue) || 0,
        investedValue: parseFloat(h.investedValue) || undefined,
        folioNumber: h.folioNumber,
        purchaseDate: h.purchaseDate,
      }));

      const updatedHoldings = await prospectPortfolioSyncService.replaceAllHoldings(clientId, normalizedHoldings);
      const totalValue = updatedHoldings.reduce((sum: any, h: any) => sum + h.currentValue, 0);

      return res.json({
        success: true,
        imported: updatedHoldings.length,
        totalValue,
        source: 'currentPortfolio'
      });
    }

    // For registered users: write to portfolioHoldings table
    let [portfolio] = await db
      .select()
      .from(portfolios)
      .where(clientInfo.portfolioWhereClause)
      .limit(1);

    if (!portfolio) {
      [portfolio] = await db.insert(portfolios).values(
        clientInfo.getPortfolioCreateValues("Imported Portfolio", "uploaded")
      ).returning();
    }

    // Delete existing holdings before importing new ones
    await db.delete(portfolioHoldings).where(eq(portfolioHoldings.portfolioId, portfolio.id));

    let imported = 0;
    for (const holding of holdings) {
      const symbol = holding.symbol || holding.name?.replace(/[^A-Za-z0-9]/g, '').substring(0, 20) || 'UNKNOWN';
      
      await db.insert(portfolioHoldings).values({
        portfolioId: portfolio.id,
        symbol: symbol.toUpperCase(),
        name: holding.name || holding.schemeName || symbol,
        isin: holding.isin || null,
        quantity: String(holding.quantity || holding.units || 0),
        avgPrice: String(holding.averagePrice || holding.avgPrice || 0),
        currentValue: String(holding.value || holding.currentValue || 0),
        investedValue: String(holding.investedValue || 0),
        assetType: holding.assetType === 'mutual_fund' ? 'mutual_fund' : (holding.assetType || 'equity'),
        productType: holding.productType || (holding.assetType === 'mutual_fund' ? 'MF' : null),
        folioNumber: holding.folioNumber || null,
        source: 'uploaded',
        purchaseDate: holding.purchaseDate ? new Date(holding.purchaseDate) : new Date()
      });
      imported++;
    }

    // Update portfolio total value
    const totalValue = holdings.reduce((sum: number, h: any) => sum + (h.value || h.currentValue || 0), 0);
    await db.update(portfolios)
      .set({ totalValue: totalValue.toString(), updatedAt: new Date() })
      .where(eq(portfolios.id, portfolio.id));

    res.json({
      success: true,
      imported,
      portfolioId: portfolio.id,
      totalValue
    });
  } catch (error: any) {
    console.error("Error importing previewed holdings:", error);
    res.status(500).json({ error: error.message || "Failed to import holdings" });
  }
});

// POST endpoint for CAS PDF upload (direct without preview)
router.post("/portfolio/:clientId/upload-cas", upload.single('file'), async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Resolve client type (prospect vs user) using shared helper
    const clientInfo = await resolveClientType(clientId);
    if (!clientInfo.isProspect && !clientInfo.isUser) {
      return res.status(404).json({ error: "Client not found. Must be a valid prospect or user." });
    }

    // Use unified service for better provider detection, ISIN enrichment, and holding lots
    const result = await unifiedPortfolioImportService.importFromPDF(
      req.file.buffer,
      req.file.originalname || 'cas.pdf',
      { detectCAS: true }
    );

    if (!result.success || result.holdings.length === 0) {
      return res.status(400).json({
        error: result.errors?.join('; ') || "Could not parse any holdings from the PDF"
      });
    }

    const profile = (result as any).profile;
    const holdingLots = (result as any).holdingLots;

    // For prospects: write to unified currentPortfolio (auto-fetch refresh)
    if (clientInfo.isProspect) {
      const normalizedHoldings = result.holdings.map((h: any) => ({
        name: h.schemeName || h.name || 'Unknown',
        isin: h.isin,
        symbol: (h.isin || h.symbol || h.name?.replace(/[^A-Za-z0-9]/g, '').substring(0, 20))?.toUpperCase(),
        assetType: h.assetType || 'mutual_fund',
        quantity: h.units || h.quantity || 0,
        averageCost: h.avgCostPerUnit || (h.investedValue / (h.units || 1)) || 0,
        currentValue: h.currentValue || 0,
        folioNumber: h.folioNumber,
        purchaseDate: h.purchaseDate,
        confidenceScore: h.confidenceScore,
        broker: h.broker,
        // Include holding lots for capital gains tracking
        lots: h.lots,
        // ISIN enrichment data
        exitLoadInfo: h.exitLoadInfo,
        category: h.category,
        fundHouse: h.fundHouse,
      }));

      const updatedHoldings = await prospectPortfolioSyncService.replaceAllHoldings(clientId, normalizedHoldings);
      const totalValue = updatedHoldings.reduce((sum: any, h: any) => sum + h.currentValue, 0);

      return res.json({
        success: true,
        imported: updatedHoldings.length,
        totalValue,
        providerDetected: profile?.brokerInfo?.name || result.brokerDetected,
        providerType: profile?.documentType,
        confidenceScore: result.confidenceScore,
        investor: result.investor,
        summary: result.summary,
        holdingLots: holdingLots,
        warnings: result.errors,
        needsManualReview: result.parsingStatus === 'needs_review',
        source: 'currentPortfolio'
      });
    }

    // For registered users: write to portfolioHoldings table
    let [portfolio] = await db
      .select()
      .from(portfolios)
      .where(clientInfo.portfolioWhereClause)
      .limit(1);

    if (!portfolio) {
      [portfolio] = await db.insert(portfolios).values(
        clientInfo.getPortfolioCreateValues("CAS Portfolio", "cas_fetch")
      ).returning();
    }

    // Delete existing holdings before importing new ones
    await db.delete(portfolioHoldings).where(eq(portfolioHoldings.portfolioId, portfolio.id));

    let imported = 0;
    for (const holding of result.holdings) {
      const symbol = holding.isin || holding.symbol || (holding.schemeName || holding.name || '').replace(/[^A-Za-z0-9]/g, '').substring(0, 20);
      
      await db.insert(portfolioHoldings).values({
        portfolioId: portfolio.id,
        symbol: symbol.toUpperCase(),
        name: holding.schemeName || holding.name || symbol,
        isin: holding.isin || null,
        quantity: String(holding.units || holding.quantity || 0),
        avgPrice: String(holding.avgCostPerUnit || (holding.investedValue / (holding.units || 1)) || 0),
        currentValue: String(holding.currentValue || 0),
        assetType: holding.assetType || 'mutual_fund',
        folioNumber: holding.folioNumber || null,
        source: 'cas_fetch',
        purchaseDate: holding.purchaseDate ? new Date(holding.purchaseDate) : new Date()
      });
      imported++;
    }

    // Update portfolio total value
    const totalValue = result.holdings.reduce((sum: number, h: any) => sum + (h.currentValue || 0), 0);
    await db.update(portfolios)
      .set({ totalValue: totalValue.toString(), updatedAt: new Date() })
      .where(eq(portfolios.id, portfolio.id));

    res.json({
      success: true,
      imported,
      totalValue,
      providerDetected: profile?.brokerInfo?.name || result.brokerDetected,
      providerType: profile?.documentType,
      confidenceScore: result.confidenceScore,
      investor: result.investor,
      summary: result.summary,
      holdingLots: holdingLots,
      warnings: result.errors,
      needsManualReview: result.parsingStatus === 'needs_review'
    });
  } catch (error: any) {
    console.error("Error uploading CAS PDF:", error);
    res.status(500).json({ error: error.message || "Failed to process PDF" });
  }
});

// POST endpoint for server-side Excel paste validation with ISIN lookup
router.post("/portfolio/validate-paste", async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: "No text data provided" });
    }

    // Use unified service for CSV parsing (handles clipboard data)
    const result = await unifiedPortfolioImportService.importFromCSV(text, 'clipboard-paste.csv');

    if (!result.success || result.holdings.length === 0) {
      return res.status(400).json({
        success: false,
        error: result.errors?.[0] || "Could not parse any holdings from the pasted data",
        errors: result.errors
      });
    }

    // Return enriched holdings with ISIN status
    res.json({
      success: true,
      holdings: result.holdings.map((h: any) => ({
        id: h.id || crypto.randomUUID(),
        name: h.schemeName || h.name || 'Unknown',
        symbol: h.isin || h.symbol,
        isin: h.isin,
        quantity: h.units || h.quantity || 0,
        averagePrice: h.avgCostPerUnit || (h.investedValue / (h.units || 1)) || 0,
        currentValue: h.currentValue || 0,
        investedValue: h.investedValue || 0,
        assetType: h.assetType || 'equity',
        folioNumber: h.folioNumber,
        purchaseDate: h.purchaseDate,
        // ISIN enrichment status
        isinMatched: !!h.isin,
        isinStatus: h.isin ? 'matched' : (h.symbol ? 'partial' : 'unknown'),
        exitLoadInfo: (h as any).exitLoadInfo,
        category: (h as any).category,
        fundHouse: (h as any).fundHouse,
        confidenceScore: h.confidenceScore
      })),
      summary: result.summary,
      totalMatched: result.holdings.filter((h: any) => h.isin).length,
      totalPartial: result.holdings.filter((h: any) => !h.isin && h.symbol).length,
      totalUnmatched: result.holdings.filter((h: any) => !h.isin && !h.symbol).length,
      errors: result.errors
    });
  } catch (error: any) {
    console.error("Error validating paste data:", error);
    res.status(500).json({ error: error.message || "Failed to validate pasted data" });
  }
});

// In-memory import history store (per client, last 10 imports)
const importHistoryStore: Record<string, Array<{
  id: string;
  timestamp: string;
  source: string;
  provider: string | null;
  holdingsCount: number;
  totalValue: number;
  isinMatchedCount: number;
  confidenceScore: number;
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
}>> = {};

// POST endpoint to record import history
router.post("/portfolio/:clientId/import-history", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { source, provider, holdingsCount, totalValue, isinMatchedCount, confidenceScore, status, errors } = req.body;

    if (!importHistoryStore[clientId]) {
      importHistoryStore[clientId] = [];
    }

    const historyEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      source: source || 'unknown',
      provider: provider || null,
      holdingsCount: holdingsCount || 0,
      totalValue: totalValue || 0,
      isinMatchedCount: isinMatchedCount || 0,
      confidenceScore: confidenceScore || 0,
      status: status || 'success',
      errors: errors || []
    };

    // Add to history (keep last 10)
    importHistoryStore[clientId].unshift(historyEntry);
    if (importHistoryStore[clientId].length > 10) {
      importHistoryStore[clientId] = importHistoryStore[clientId].slice(0, 10);
    }

    res.json({ success: true, entry: historyEntry });
  } catch (error: any) {
    console.error("Error recording import history:", error);
    res.status(500).json({ error: error.message || "Failed to record import history" });
  }
});

// GET endpoint to retrieve import history for a client
router.get("/portfolio/:clientId/import-history", async (req, res) => {
  try {
    const { clientId } = req.params;
    const history = importHistoryStore[clientId] || [];

    res.json({ 
      success: true,
      history,
      count: history.length
    });
  } catch (error: any) {
    console.error("Error fetching import history:", error);
    res.status(500).json({ error: error.message || "Failed to fetch import history" });
  }
});

// GET endpoint for portfolio analysis
router.get("/analyze/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const analysis = await aiInvestmentService.analyzePortfolio(clientId);
    
    res.json({
      totalValue: analysis?.totalValue || 0,
      totalGainLoss: analysis?.totalGainLoss || 0,
      totalGainLossPercent: analysis?.totalGainLossPercent || 0,
      fundamentalRatios: analysis?.fundamentalRatios || {
        avgPE: 0,
        avgPB: 0,
        avgROE: 0,
        avgDebtEquity: 0
      },
      sectorConcentration: analysis?.sectorConcentration || {},
      topHoldings: analysis?.topHoldings || [],
      riskScore: analysis?.riskScore || 50,
      diversificationScore: analysis?.diversificationScore || 50
    });
  } catch (error: any) {
    console.error("Error analyzing portfolio:", error);
    // Return empty analysis for missing portfolios instead of 500 error
    if (error.message?.includes("not found") || error.message?.includes("No portfolio")) {
      return res.json({
        totalValue: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
        fundamentalRatios: { avgPE: 0, avgPB: 0, avgROE: 0, avgDebtEquity: 0 },
        sectorConcentration: {},
        topHoldings: [],
        riskScore: 50,
        diversificationScore: 50,
        message: "No portfolio data available. Add holdings to see analysis."
      });
    }
    res.status(500).json({ error: "Failed to analyze portfolio" });
  }
});

// GET endpoint for profit picks


export default router;
