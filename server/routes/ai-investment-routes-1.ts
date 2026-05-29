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

router.get("/portfolio/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Resolve client type (prospect vs user)
    const clientInfo = await resolveClientType(clientId);
    
    // Return 404 if client not found
    if (!clientInfo.isProspect && !clientInfo.isUser) {
      return res.status(404).json({ error: "Client not found" });
    }

    // For prospects: read from unified currentPortfolio JSON
    if (clientInfo.isProspect) {
      const holdings = await prospectPortfolioSyncService.getHoldings(clientId);
      
      // Enrich with market data and tax calculations
      const holdingsWithMarketData = await Promise.all(
        holdings.map(async (holding) => {
          const symbol = holding.symbol || holding.name?.replace(/[^A-Za-z0-9]/g, '').substring(0, 10);
          const [market] = symbol ? await db
            .select()
            .from(marketData)
            .where(eq(marketData.symbol, symbol))
            .limit(1) : [];
          
          const avgPrice = holding.averageCost || 0;
          const quantity = holding.quantity || 0;
          const currentPrice = market?.price ? parseFloat(market.price) : avgPrice;
          const marketValue = quantity * currentPrice;
          const investedValue = quantity * avgPrice;
          const gainLoss = marketValue - investedValue;
          const gainLossPercent = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0;

          // Calculate holding period and tax classification
          const purchaseDate = holding.purchaseDate ? new Date(holding.purchaseDate) : null;
          const holdingDays = purchaseDate 
            ? Math.floor((Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
            : null;
          const isLTCG = holdingDays !== null && holdingDays > 365;
          const daysToLTCG = holdingDays !== null && !isLTCG ? 365 - holdingDays : 0;

          return {
            id: holding.id,
            symbol: symbol || holding.name,
            name: holding.name,
            quantity,
            averagePrice: avgPrice,
            currentPrice,
            currentValue: marketValue,
            gainLoss,
            gainLossPercent,
            assetType: holding.assetType || 'equity',
            isin: holding.isin,
            purchaseDate: holding.purchaseDate,
            holdingDays,
            taxType: holdingDays !== null ? (isLTCG ? 'LTCG' : 'STCG') : null,
            daysToLTCG,
            exitLoadApplicable: holdingDays !== null && holdingDays < 365
          };
        })
      );

      const totalValue = holdingsWithMarketData.reduce((sum, h) => sum + h.currentValue, 0);

      return res.json({
        id: `prospect-${clientId}`,
        clientId,
        name: `${clientInfo.prospect?.name || 'Prospect'}'s Portfolio`,
        totalValue,
        holdings: holdingsWithMarketData,
        lastUpdated: clientInfo.prospect?.updatedAt?.toISOString() || new Date().toISOString(),
        source: 'currentPortfolio'
      });
    }
    
    // For registered users: read from portfolioHoldings table
    const [portfolio] = await db
      .select()
      .from(portfolios)
      .where(clientInfo.portfolioWhereClause)
      .limit(1);

    if (!portfolio) {
      return res.json({
        id: null,
        clientId,
        name: "No Portfolio",
        totalValue: 0,
        holdings: [],
        lastUpdated: new Date().toISOString()
      });
    }

    const holdings = await db
      .select()
      .from(portfolioHoldings)
      .where(eq(portfolioHoldings.portfolioId, portfolio.id));

    const holdingsWithMarketData = await Promise.all(
      holdings.map(async (holding) => {
        const [market] = await db
          .select()
          .from(marketData)
          .where(eq(marketData.symbol as any, holding.symbol))
          .limit(1);
        
        const currentPrice = market?.price ? parseFloat(market.price) : parseFloat(holding.avgPrice || '0');
        const quantity = parseFloat(holding.quantity);
        const avgPrice = parseFloat(holding.avgPrice || '0');
        const marketValue = quantity * currentPrice;
        const investedValue = quantity * avgPrice;
        const gainLoss = marketValue - investedValue;
        const gainLossPercent = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0;

        // Calculate holding period and tax classification
        const purchaseDate = holding.purchaseDate ? new Date(holding.purchaseDate) : null;
        const holdingDays = purchaseDate 
          ? Math.floor((Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const isLTCG = holdingDays !== null && holdingDays > 365;
        const daysToLTCG = holdingDays !== null && !isLTCG ? 365 - holdingDays : 0;

        return {
          id: holding.id,
          symbol: holding.symbol,
          name: holding.name || holding.symbol,
          quantity,
          averagePrice: avgPrice,
          currentPrice,
          currentValue: marketValue,
          gainLoss,
          gainLossPercent,
          sector: holding.sector,
          assetType: holding.assetType || 'EQUITY',
          purchaseDate: holding.purchaseDate,
          holdingDays,
          taxType: holdingDays !== null ? (isLTCG ? 'LTCG' : 'STCG') : null,
          daysToLTCG,
          exitLoadApplicable: holdingDays !== null && holdingDays < 365
        };
      })
    );

    const totalValue = holdingsWithMarketData.reduce((sum, h) => sum + h.currentValue, 0);

    res.json({
      id: portfolio.id,
      clientId,
      name: portfolio.name,
      totalValue,
      holdings: holdingsWithMarketData,
      lastUpdated: portfolio.updatedAt?.toISOString() || new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch portfolio"
    });
  }
});

router.post("/portfolio/manual-entry", async (req, res) => {
  try {
    const validatedData = manualEntrySchema.parse(req.body);
    const { clientId, holdings } = validatedData;

    // Resolve client type (prospect vs user)
    const clientInfo = await resolveClientType(clientId);
    if (!clientInfo.isProspect && !clientInfo.isUser) {
      return res.status(404).json({ error: "Client not found" });
    }

    // For prospects: write to unified currentPortfolio JSON
    if (clientInfo.isProspect) {
      const normalizedHoldings = holdings.map(h => ({
        name: h.stockName || h.symbol,
        symbol: h.symbol?.toUpperCase(),
        assetType: h.assetType || 'equity',
        quantity: h.quantity,
        averageCost: h.avgPrice,
        currentValue: h.quantity * h.avgPrice, // Calculate current value from quantity * avgPrice
        sector: h.sector,
        purchaseDate: h.purchaseDate,
        source: 'manual' as const,
      }));

      const updatedHoldings = await prospectPortfolioSyncService.addHoldings(clientId, normalizedHoldings as any);

      return res.json({
        success: true,
        message: `Added ${normalizedHoldings.length} holdings to prospect portfolio`,
        holdings: updatedHoldings,
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
        clientInfo.getPortfolioCreateValues("Manual Portfolio", "manual")
      ).returning();
    }

    const insertedHoldings = [];
    for (const holding of holdings) {
      // Use provided purchaseDate or default to today if not specified
      const parsedPurchaseDate = holding.purchaseDate 
        ? new Date(holding.purchaseDate) 
        : new Date();
      
      const [inserted] = await db.insert(portfolioHoldings).values({
        portfolioId: portfolio.id,
        symbol: holding.symbol,
        name: holding.stockName || holding.symbol,
        quantity: String(holding.quantity),
        avgPrice: String(holding.avgPrice),
        assetType: holding.assetType,
        sector: holding.sector,
        purchaseDate: parsedPurchaseDate,
        source: 'manual'
      }).returning();
      insertedHoldings.push(inserted);
    }

    res.json({
      success: true,
      message: `Added ${insertedHoldings.length} holdings to portfolio`,
      portfolioId: portfolio.id,
      holdings: insertedHoldings
    });
  } catch (error) {
    console.error("Error adding manual entries:", error);
    res.status(500).json({
      success: false,
      error: error instanceof z.ZodError ? error.errors : "Failed to add holdings"
    });
  }
});

router.post("/portfolio/upload-csv", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded"
      });
    }

    const clientId = req.body.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required"
      });
    }

    // Resolve client type (prospect vs user)
    const clientInfo = await resolveClientType(clientId);
    if (!clientInfo.isProspect && !clientInfo.isUser) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Use centralized CSV import service
    const csvContent = req.file.buffer.toString('utf-8');
    const importResult = await unifiedPortfolioImportService.importFromCSV(csvContent, req.file.originalname);

    if (!importResult.success || importResult.holdings.length === 0) {
      return res.status(400).json({
        success: false,
        error: importResult.errors?.[0] || "No valid holdings found in CSV"
      });
    }

    // For prospects: write to unified currentPortfolio JSON
    if (clientInfo.isProspect) {
      const normalizedHoldings = importResult.holdings.map(h => ({
        name: h.name || h.symbol || 'Unknown',
        symbol: h.symbol,
        isin: h.isin,
        assetType: h.assetType || 'equity',
        quantity: h.quantity,
        averageCost: h.avgCostPerUnit,
        currentValue: h.currentValue,
        folioNumber: h.folioNumber,
        purchaseDate: h.purchaseDate,
        source: 'uploaded' as const,
      }));

      await prospectPortfolioSyncService.addHoldings(clientId, normalizedHoldings as any);

      return res.json({
        success: true,
        message: `Uploaded ${normalizedHoldings.length} holdings to prospect portfolio`,
        holdingsAdded: normalizedHoldings.length,
        errors: importResult.errors?.length > 0 ? importResult.errors : undefined,
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
        clientInfo.getPortfolioCreateValues("CSV Uploaded Portfolio", "uploaded")
      ).returning();
    }

    const insertedHoldings = [];
    for (const h of importResult.holdings) {
      const [inserted] = await db.insert(portfolioHoldings).values({
        portfolioId: portfolio.id,
        symbol: h.symbol || h.name,
        name: h.name,
        quantity: String(h.quantity),
        avgPrice: String(h.avgCostPerUnit || 0),
        assetType: h.assetType || 'equity',
        isin: h.isin,
        folioNumber: h.folioNumber,
        purchaseDate: h.purchaseDate ? new Date(h.purchaseDate) : new Date()
      }).returning();
      insertedHoldings.push(inserted);
    }

    res.json({
      success: true,
      message: `Uploaded ${insertedHoldings.length} holdings`,
      portfolioId: portfolio.id,
      holdingsAdded: insertedHoldings.length,
      errors: importResult.errors?.length > 0 ? importResult.errors : undefined
    });
  } catch (error) {
    console.error("Error uploading CSV:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process CSV file"
    });
  }
});

router.put("/portfolio/update/:holdingId", async (req, res) => {
  try {
    const { holdingId } = req.params;
    const { clientId, quantity, avgPrice, sector, purchaseDate, folioNumber, name, isin, assetType, symbol, currentValue, investedValue, notes } = req.body;

    // If clientId is provided, check if it's a prospect
    if (clientId) {
      const clientInfo = await resolveClientType(clientId);
      if (clientInfo.isProspect) {
        const updates: any = {};
        if (quantity !== undefined) updates.quantity = Number(quantity);
        if (avgPrice !== undefined) updates.averageCost = Number(avgPrice);
        if (purchaseDate !== undefined) updates.purchaseDate = purchaseDate || undefined;
        if (folioNumber !== undefined) updates.folioNumber = folioNumber || undefined;
        if (name !== undefined) updates.name = name;
        if (isin !== undefined) updates.isin = isin || undefined;
        if (assetType !== undefined) updates.assetType = assetType;
        if (symbol !== undefined) updates.symbol = symbol || undefined;
        if (currentValue !== undefined) updates.currentValue = Number(currentValue);
        if (investedValue !== undefined) updates.investedValue = Number(investedValue);

        const updatedHoldings = await prospectPortfolioSyncService.updateHolding(clientId, holdingId, updates);
        return res.json({
          success: true,
          holdings: updatedHoldings,
          source: 'currentPortfolio'
        });
      }
    }

    // For registered users: update portfolioHoldings table
    const updateData: any = { updatedAt: new Date() };
    if (quantity !== undefined) updateData.quantity = String(quantity);
    if (avgPrice !== undefined) updateData.avgPrice = String(avgPrice);
    if (sector !== undefined) updateData.sector = sector;
    if (purchaseDate !== undefined) updateData.purchaseDate = purchaseDate ? new Date(purchaseDate) : null;
    if (folioNumber !== undefined) updateData.folioNumber = folioNumber || null;
    if (name !== undefined) updateData.name = name;
    if (isin !== undefined) updateData.isin = isin || null;
    if (assetType !== undefined) updateData.assetType = assetType;
    if (symbol !== undefined) updateData.symbol = symbol || null;
    if (currentValue !== undefined) updateData.currentValue = String(currentValue);
    if (investedValue !== undefined) updateData.investedValue = String(investedValue);
    if (notes !== undefined) updateData.notes = notes || null;

    const [updated] = await db
      .update(portfolioHoldings)
      .set(updateData)
      .where(eq(portfolioHoldings.id, holdingId))
      .returning();

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Holding not found"
      });
    }

    res.json({
      success: true,
      holding: updated
    });
  } catch (error) {
    console.error("Error updating holding:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update holding"
    });
  }
});

router.delete("/portfolio/holding/:holdingId", async (req, res) => {
  try {
    const { holdingId } = req.params;
    const { clientId } = req.query;

    // If clientId is provided, check if it's a prospect
    if (clientId && typeof clientId === 'string') {
      const clientInfo = await resolveClientType(clientId);
      if (clientInfo.isProspect) {
        const updatedHoldings = await prospectPortfolioSyncService.deleteHolding(clientId, holdingId);
        return res.json({
          success: true,
          message: "Holding deleted from prospect portfolio",
          holdings: updatedHoldings,
          source: 'currentPortfolio'
        });
      }
    }

    // For registered users: delete from portfolioHoldings table
    await db
      .delete(portfolioHoldings)
      .where(eq(portfolioHoldings.id, holdingId));

    res.json({
      success: true,
      message: "Holding deleted"
    });
  } catch (error) {
    console.error("Error deleting holding:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete holding"
    });
  }
});

router.post("/ai/portfolio/analyze", async (req, res) => {
  try {
    const { clientId, portfolioId } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required"
      });
    }

    const analysis = await aiInvestmentService.analyzePortfolio(clientId, portfolioId);

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error("Error analyzing portfolio:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to analyze portfolio"
    });
  }
});

router.post("/ai/portfolio/alerts", async (req, res) => {
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required"
      });
    }

    const alerts = await aiInvestmentService.generateAlerts(clientId);

    res.json({
      success: true,
      alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error("Error generating alerts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate alerts"
    });
  }
});

router.get("/ai/alerts/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { status } = req.query;

    const alerts = await aiInvestmentService.getClientAlerts(
      clientId, 
      status as string | undefined
    );

    res.json({
      success: true,
      alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch alerts"
    });
  }
});

router.post("/ai/stocks/profit-picks", async (req, res) => {
  try {
    const { clientId, count, timeHorizon, riskLevel } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required"
      });
    }

    const picks = await aiInvestmentService.generateProfitPicks(clientId, {
      count,
      timeHorizon,
      riskLevel
    });

    res.json({
      success: true,
      picks,
      count: picks.length
    });
  } catch (error) {
    console.error("Error generating profit picks:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate profit picks"
    });
  }
});

router.get("/ai/stocks/profit-picks/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { status } = req.query;

    const picks = await aiInvestmentService.getClientProfitPicks(
      clientId, 
      status as string | undefined
    );

    res.json({
      success: true,
      picks,
      count: picks.length
    });
  } catch (error) {
    console.error("Error fetching profit picks:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch profit picks"
    });
  }
});

router.post("/ai/stocks/buy-signals", async (req, res) => {
  try {
    const { clientId, count = 5 } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required"
      });
    }

    const picks = await aiInvestmentService.generateProfitPicks(clientId, {
      count,
      timeHorizon: 'short'
    });

    const buySignals = picks.filter(p => p.signalType === 'buy');

    res.json({
      success: true,
      signals: buySignals,
      count: buySignals.length
    });
  } catch (error) {
    console.error("Error generating buy signals:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate buy signals"
    });
  }
});

router.post("/ai/agent/talking-points", async (req, res) => {
  try {
    const { clientId, analysisId } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required"
      });
    }

    const talkingPoints = await aiInvestmentService.generateTalkingPoints(clientId, analysisId);

    res.json({
      success: true,
      talkingPoints,
      count: talkingPoints.length
    });
  } catch (error) {
    console.error("Error generating talking points:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate talking points"
    });
  }
});

router.get("/ai/talking-points/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;

    const talkingPoints = await db
      .select()
      .from(aiTalkingPoints)
      .where(eq(aiTalkingPoints.clientId, clientId))
      .orderBy(aiTalkingPoints.sequenceOrder);

    res.json({
      success: true,
      talkingPoints,
      count: talkingPoints.length
    });
  } catch (error) {
    console.error("Error fetching talking points:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch talking points"
    });
  }
});

router.put("/ai/profit-pick/:pickId/approve", async (req, res) => {
  try {
    const { pickId } = req.params;
    const { agentId, targetPrice, quantity, notes } = req.body;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: "Agent ID is required"
      });
    }

    const updated = await aiInvestmentService.approveProfitPick(pickId, agentId, {
      targetPrice,
      quantity,
      notes
    });

    res.json({
      success: true,
      pick: updated
    });
  } catch (error) {
    console.error("Error approving profit pick:", error);
    res.status(500).json({
      success: false,
      error: "Failed to approve profit pick"
    });
  }
});


export default router;
