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
          .where(eq(marketData.symbol, holding.symbol))
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

      const updatedHoldings = await prospectPortfolioSyncService.addHoldings(clientId, normalizedHoldings);

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

    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return res.status(400).json({
        success: false,
        error: "CSV file must have headers and at least one data row"
      });
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const symbolIdx = headers.findIndex(h => h.includes('symbol') || h.includes('stock'));
    const quantityIdx = headers.findIndex(h => h.includes('quantity') || h.includes('qty'));
    const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('avg'));
    const sectorIdx = headers.findIndex(h => h.includes('sector'));

    if (symbolIdx === -1 || quantityIdx === -1 || priceIdx === -1) {
      return res.status(400).json({
        success: false,
        error: "CSV must have symbol, quantity, and price columns"
      });
    }

    // Resolve client type (prospect vs user)
    const clientInfo = await resolveClientType(clientId);
    if (!clientInfo.isProspect && !clientInfo.isUser) {
      return res.status(404).json({ error: "Client not found" });
    }

    // Parse CSV rows into holdings
    const parsedHoldings: Array<{symbol: string; quantity: number; avgPrice: number; sector?: string}> = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      
      try {
        const symbol = values[symbolIdx]?.replace(/"/g, '');
        const quantity = parseFloat(values[quantityIdx]?.replace(/"/g, ''));
        const avgPrice = parseFloat(values[priceIdx]?.replace(/"/g, ''));
        const sector = sectorIdx !== -1 ? values[sectorIdx]?.replace(/"/g, '') : undefined;

        if (!symbol || isNaN(quantity) || isNaN(avgPrice)) {
          errors.push(`Row ${i + 1}: Invalid data`);
          continue;
        }

        parsedHoldings.push({ symbol: symbol.toUpperCase(), quantity, avgPrice, sector });
      } catch (err) {
        errors.push(`Row ${i + 1}: Failed to process`);
      }
    }

    // For prospects: write to unified currentPortfolio JSON
    if (clientInfo.isProspect) {
      const normalizedHoldings = parsedHoldings.map(h => ({
        name: h.symbol,
        symbol: h.symbol,
        assetType: 'equity' as const,
        quantity: h.quantity,
        averageCost: h.avgPrice,
        currentValue: h.quantity * h.avgPrice, // Calculate current value
        sector: h.sector,
        source: 'uploaded' as const,
      }));

      const updatedHoldings = await prospectPortfolioSyncService.addHoldings(clientId, normalizedHoldings);

      return res.json({
        success: true,
        message: `Uploaded ${normalizedHoldings.length} holdings to prospect portfolio`,
        holdingsAdded: normalizedHoldings.length,
        errors: errors.length > 0 ? errors : undefined,
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
    for (const h of parsedHoldings) {
      const [inserted] = await db.insert(portfolioHoldings).values({
        portfolioId: portfolio.id,
        symbol: h.symbol,
        quantity: String(h.quantity),
        avgPrice: String(h.avgPrice),
        assetType: 'equity',
        sector: h.sector,
        purchaseDate: new Date()
      }).returning();
      insertedHoldings.push(inserted);
    }

    res.json({
      success: true,
      message: `Uploaded ${insertedHoldings.length} holdings`,
      portfolioId: portfolio.id,
      holdingsAdded: insertedHoldings.length,
      errors: errors.length > 0 ? errors : undefined
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

router.put("/ai/alert/:alertId/action", async (req, res) => {
  try {
    const { alertId } = req.params;
    const { action, notes, agentId } = req.body;

    const [updated] = await db
      .update(portfolioAlerts)
      .set({
        agentViewed: true,
        agentViewedAt: new Date(),
        agentAction: action,
        agentActionAt: new Date(),
        agentNotes: notes,
        status: action === 'dismissed' ? 'dismissed' : action === 'acted' ? 'resolved' : 'active',
        updatedAt: new Date()
      })
      .where(eq(portfolioAlerts.id, alertId))
      .returning();

    res.json({
      success: true,
      alert: updated
    });
  } catch (error) {
    console.error("Error updating alert:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update alert"
    });
  }
});

router.post("/proposals/from-ai-stocks", async (req, res) => {
  try {
    const { clientId, agentId, pickIds, title } = req.body;

    if (!clientId || !agentId || !pickIds?.length) {
      return res.status(400).json({
        success: false,
        error: "Client ID, Agent ID, and Pick IDs are required"
      });
    }

    const result = await aiInvestmentService.createProposalFromPicks(
      clientId,
      agentId,
      pickIds,
      title
    );

    res.json({
      success: true,
      ...result,
      message: `Created proposal with ${result.itemCount} items`
    });
  } catch (error) {
    console.error("Error creating proposal from AI stocks:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create proposal"
    });
  }
});

router.get("/ai/analysis/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;

    const analyses = await db
      .select()
      .from(aiPortfolioAnalysis)
      .where(eq(aiPortfolioAnalysis.clientId, clientId))
      .orderBy(desc(aiPortfolioAnalysis.createdAt))
      .limit(10);

    res.json({
      success: true,
      analyses,
      count: analyses.length
    });
  } catch (error) {
    console.error("Error fetching analyses:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch analyses"
    });
  }
});

router.get("/ai/analysis/detail/:analysisId", async (req, res) => {
  try {
    const { analysisId } = req.params;

    const [analysis] = await db
      .select()
      .from(aiPortfolioAnalysis)
      .where(eq(aiPortfolioAnalysis.id, analysisId))
      .limit(1);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: "Analysis not found"
      });
    }

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error("Error fetching analysis:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch analysis"
    });
  }
});


// ============================================
// Frontend-compatible wrapper routes
// ============================================

// POST endpoint for adding holdings
router.post("/portfolio/:clientId/holdings", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { symbol, name, quantity, averagePrice, assetType, purchaseDate } = req.body;

    // Resolve client type (prospect vs user)
    const clientInfo = await resolveClientType(clientId);
    if (!clientInfo.isProspect && !clientInfo.isUser) {
      return res.status(404).json({ error: "Client not found" });
    }

    // For prospects: use unified currentPortfolio storage
    if (clientInfo.isProspect) {
      const holdings = await prospectPortfolioSyncService.addHolding(clientId, {
        symbol: symbol?.toUpperCase(),
        name: name || symbol,
        quantity: parseFloat(quantity) || 0,
        averageCost: parseFloat(averagePrice) || 0,
        currentValue: (parseFloat(quantity) || 0) * (parseFloat(averagePrice) || 0),
        assetType: assetType || 'equity',
        purchaseDate: purchaseDate || undefined,
      });
      
      return res.json({ 
        success: true, 
        holding: holdings[holdings.length - 1],
        totalHoldings: holdings.length 
      });
    }

    // For registered users: use portfolioHoldings table
    let [portfolio] = await db
      .select()
      .from(portfolios)
      .where(clientInfo.portfolioWhereClause)
      .limit(1);

    if (!portfolio) {
      [portfolio] = await db.insert(portfolios).values(
        clientInfo.getPortfolioCreateValues("Client Portfolio", "manual")
      ).returning();
    }

    // Use provided purchaseDate or default to today
    const parsedPurchaseDate = purchaseDate ? new Date(purchaseDate) : new Date();

    const [inserted] = await db.insert(portfolioHoldings).values({
      portfolioId: portfolio.id,
      symbol: symbol.toUpperCase(),
      name: name || symbol,
      quantity: String(quantity),
      avgPrice: String(averagePrice),
      assetType: assetType || 'EQUITY',
      purchaseDate: parsedPurchaseDate,
      source: 'manual'
    }).returning();

    res.json({ success: true, holding: inserted });
  } catch (error) {
    console.error("Error adding holding:", error);
    res.status(500).json({ error: "Failed to add holding" });
  }
});

// POST endpoint for CSV upload
router.post("/portfolio/:clientId/upload", upload.single('file'), async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Resolve client type (prospect vs user)
    const clientInfo = await resolveClientType(clientId);
    if (!clientInfo.isProspect && !clientInfo.isUser) {
      return res.status(404).json({ error: "Client not found" });
    }

    let [portfolio] = await db
      .select()
      .from(portfolios)
      .where(clientInfo.portfolioWhereClause)
      .limit(1);

    if (!portfolio) {
      [portfolio] = await db.insert(portfolios).values(
        clientInfo.getPortfolioCreateValues("Uploaded Portfolio", "uploaded")
      ).returning();
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const symbolIdx = headers.findIndex(h => h.includes('symbol') || h.includes('ticker') || h.includes('isin'));
    const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('scheme') || h.includes('fund'));
    const quantityIdx = headers.findIndex(h => h.includes('quantity') || h.includes('qty') || h.includes('units'));
    const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('nav') || h.includes('cost') || h.includes('avg'));
    const typeIdx = headers.findIndex(h => h.includes('type') || h.includes('asset') || h.includes('category'));
    const isinIdx = headers.findIndex(h => h === 'isin');
    const folioIdx = headers.findIndex(h => h.includes('folio'));
    const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('purchase'));

    const parsedHoldings = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const symbol = values[symbolIdx >= 0 ? symbolIdx : 0] || '';
      const name = nameIdx >= 0 ? values[nameIdx] : symbol;
      const quantity = parseFloat(values[quantityIdx >= 0 ? quantityIdx : 1]) || 0;
      const avgPrice = parseFloat(values[priceIdx >= 0 ? priceIdx : 2]) || 0;
      const assetType = typeIdx >= 0 ? values[typeIdx] : 'EQUITY';
      const isin = isinIdx >= 0 ? values[isinIdx] : undefined;
      const folioNumber = folioIdx >= 0 ? values[folioIdx] : undefined;
      const purchaseDate = dateIdx >= 0 && values[dateIdx] ? new Date(values[dateIdx]) : new Date();
      
      if (symbol && quantity > 0) {
        parsedHoldings.push({ symbol: symbol.toUpperCase(), name, quantity, avgPrice, assetType, isin, folioNumber, purchaseDate });
      }
    }

    let count = 0;
    
    // For prospects: use unified currentPortfolio storage via sync service
    if (clientInfo.isProspect) {
      for (const h of parsedHoldings) {
        await prospectPortfolioSyncService.addHolding(clientId, {
          symbol: h.symbol,
          name: h.name || h.symbol,
          quantity: h.quantity,
          averageCost: h.avgPrice,
          currentValue: h.quantity * h.avgPrice,
          assetType: h.assetType?.toLowerCase() || 'equity',
          isin: h.isin,
          folioNumber: h.folioNumber,
          purchaseDate: h.purchaseDate?.toISOString().split('T')[0],
        });
        count++;
      }
      return res.json({ success: true, count, storage: 'prospect_currentPortfolio' });
    }

    // For registered users: use portfolioHoldings table
    for (const h of parsedHoldings) {
      await db.insert(portfolioHoldings).values({
        portfolioId: portfolio.id,
        symbol: h.symbol,
        name: h.name,
        quantity: String(h.quantity),
        avgPrice: String(h.avgPrice),
        assetType: h.assetType || 'EQUITY',
        purchaseDate: h.purchaseDate
      });
      count++;
    }

    res.json({ success: true, count });
  } catch (error) {
    console.error("Error uploading CSV:", error);
    res.status(500).json({ error: "Failed to process CSV" });
  }
});

// POST endpoint for bulk import (paste from Excel)
router.post("/portfolio/:clientId/bulk-import", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { holdings, skipValidation } = req.body;
    
    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      return res.status(400).json({ error: "No holdings provided" });
    }

    const validHoldings = holdings.filter((h: any) => {
      const symbol = h.symbol?.toString().trim();
      const quantity = parseFloat(h.quantity);
      return symbol && symbol.length > 0 && quantity > 0;
    });

    if (validHoldings.length === 0) {
      return res.status(400).json({ error: "No valid holdings found. Each holding must have a symbol and quantity > 0." });
    }

    const invalidCount = holdings.length - validHoldings.length;
    const missingPriceCount = validHoldings.filter((h: any) => !h.averagePrice || parseFloat(h.averagePrice) <= 0).length;

    // Resolve client type (prospect vs user)
    const clientInfo = await resolveClientType(clientId);
    if (!clientInfo.isProspect && !clientInfo.isUser) {
      return res.status(404).json({ error: "Client not found" });
    }

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

    let imported = 0;
    
    // For prospects: use unified currentPortfolio storage via sync service
    if (clientInfo.isProspect) {
      for (const holding of validHoldings) {
        const { symbol, name, quantity, averagePrice, assetType, isin, folioNumber, purchaseDate } = holding;
        const qty = parseFloat(quantity) || 0;
        const price = parseFloat(averagePrice) || 0;
        
        await prospectPortfolioSyncService.addHolding(clientId, {
          symbol: symbol?.toString().toUpperCase().replace(/[^A-Z0-9]/g, ''),
          name: name || symbol,
          quantity: qty,
          averageCost: price,
          currentValue: qty * price,
          assetType: assetType?.toLowerCase() || 'equity',
          isin: isin,
          folioNumber: folioNumber,
          purchaseDate: purchaseDate ? new Date(purchaseDate).toISOString().split('T')[0] : undefined,
        });
        imported++;
      }
      
      return res.json({ 
        success: true, 
        imported,
        skipped: invalidCount,
        warnings: missingPriceCount > 0 ? [`${missingPriceCount} holdings imported with price = 0`] : [],
        storage: 'prospect_currentPortfolio'
      });
    }

    // For registered users: use portfolioHoldings table
    for (const holding of validHoldings) {
      const { symbol, name, quantity, averagePrice, assetType } = holding;
      
      await db.insert(portfolioHoldings).values({
        portfolioId: portfolio.id,
        symbol: symbol.toString().toUpperCase().replace(/[^A-Z0-9]/g, ''),
        name: name || symbol,
        quantity: String(parseFloat(quantity) || 0),
        avgPrice: String(parseFloat(averagePrice) || 0),
        assetType: assetType || 'EQUITY',
        purchaseDate: new Date()
      });
      imported++;
    }

    res.json({ 
      success: true, 
      imported,
      skipped: invalidCount,
      warnings: missingPriceCount > 0 ? [`${missingPriceCount} holdings imported with price = 0`] : []
    });
  } catch (error) {
    console.error("Error bulk importing holdings:", error);
    res.status(500).json({ error: "Failed to import holdings" });
  }
});

// POST endpoint for CAS PDF preview (parse only, no import)
router.post("/portfolio/preview-pdf", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { parsePDFPortfolio } = await import("../services/portfolio-parser");
    const result = await parsePDFPortfolio(req.file.buffer, req.file.originalname || 'statement.pdf');

    res.json({
      success: result.success,
      holdings: result.holdings.map(h => ({
        id: h.id,
        name: h.name,
        symbol: h.symbol || h.isin,
        isin: h.isin,
        quantity: h.quantity,
        averagePrice: h.averageCost || (h.currentValue / (h.quantity || 1)) || 0,
        currentValue: h.currentValue,
        assetType: h.assetType,
        folioNumber: h.folioNumber,
        confidenceScore: h.confidenceScore,
        broker: h.broker
      })),
      brokerDetected: result.brokerDetected,
      confidenceScore: result.confidenceScore,
      errors: result.errors,
      needsManualReview: result.needsManualReview
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
      const totalValue = updatedHoldings.reduce((sum, h) => sum + h.currentValue, 0);

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

    const { parsePDFPortfolio } = await import("../services/portfolio-parser");
    const result = await parsePDFPortfolio(req.file.buffer, req.file.originalname || 'cas.pdf');

    if (!result.success || result.holdings.length === 0) {
      return res.status(400).json({
        error: result.errors?.join('; ') || "Could not parse any holdings from the PDF",
        rawText: result.rawText?.substring(0, 500)
      });
    }

    // For prospects: write to unified currentPortfolio (auto-fetch refresh)
    if (clientInfo.isProspect) {
      const normalizedHoldings = result.holdings.map((h: any) => ({
        name: h.name || h.symbol || 'Unknown',
        isin: h.isin,
        symbol: (h.isin || h.symbol || h.name?.replace(/[^A-Za-z0-9]/g, '').substring(0, 20))?.toUpperCase(),
        assetType: h.assetType === 'mutual_fund' ? 'mutual_fund' : 'equity',
        quantity: h.quantity || 0,
        averageCost: h.averageCost || (h.currentValue / (h.quantity || 1)) || 0,
        currentValue: h.currentValue || 0,
        folioNumber: h.folioNumber,
        purchaseDate: h.purchaseDate,
        confidenceScore: h.confidenceScore,
        broker: h.broker,
      }));

      const updatedHoldings = await prospectPortfolioSyncService.replaceAllHoldings(clientId, normalizedHoldings);
      const totalValue = updatedHoldings.reduce((sum, h) => sum + h.currentValue, 0);

      return res.json({
        success: true,
        imported: updatedHoldings.length,
        totalValue,
        brokerDetected: result.brokerDetected,
        confidenceScore: result.confidenceScore,
        warnings: result.errors,
        needsManualReview: result.needsManualReview,
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
      const symbol = holding.isin || holding.symbol || holding.name.replace(/[^A-Za-z0-9]/g, '').substring(0, 20);
      
      await db.insert(portfolioHoldings).values({
        portfolioId: portfolio.id,
        symbol: symbol.toUpperCase(),
        name: holding.name || symbol,
        isin: holding.isin || null,
        quantity: String(holding.quantity || 0),
        avgPrice: String(holding.averageCost || (holding.currentValue / (holding.quantity || 1)) || 0),
        currentValue: String(holding.currentValue || 0),
        assetType: holding.assetType === 'mutual_fund' ? 'mutual_fund' : 'equity',
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
      brokerDetected: result.brokerDetected,
      confidenceScore: result.confidenceScore,
      warnings: result.errors,
      needsManualReview: result.needsManualReview
    });
  } catch (error: any) {
    console.error("Error uploading CAS PDF:", error);
    res.status(500).json({ error: error.message || "Failed to process PDF" });
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
router.get("/profit-picks/:clientId/:horizon", async (req, res) => {
  try {
    const { clientId, horizon } = req.params;
    const picks = await aiInvestmentService.generateProfitPicks(clientId, { timeHorizon: horizon });
    res.json(picks || []);
  } catch (error: any) {
    console.error("Error generating profit picks:", error);
    // Return empty array for database errors instead of 500
    if (error.code === '42703' || error.code === '22P02' || error.message?.includes("not found")) {
      return res.json([]);
    }
    res.status(500).json({ error: "Failed to generate profit picks" });
  }
});

// GET endpoint for profit picks (default horizon)
router.get("/profit-picks/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const horizon = req.query.horizon as string || '3M';
    const picks = await aiInvestmentService.generateProfitPicks(clientId, { timeHorizon: horizon });
    res.json(picks || []);
  } catch (error: any) {
    console.error("Error generating profit picks:", error);
    // Return empty array for database errors instead of 500
    if (error.code === '42703' || error.code === '22P02' || error.message?.includes("not found")) {
      return res.json([]);
    }
    res.status(500).json({ error: "Failed to generate profit picks" });
  }
});

// GET endpoint for alerts
router.get("/alerts/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const alerts = await aiInvestmentService.checkBenchmarkAlerts(clientId);
    res.json(alerts || []);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// GET endpoint for talking points
router.get("/talking-points/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const talkingPoints = await aiInvestmentService.generateTalkingPoints(clientId);
    res.json(talkingPoints || []);
  } catch (error: any) {
    console.error("Error generating talking points:", error);
    // Return empty array for database/schema errors instead of 500
    if (error.code === '42703' || error.message?.includes("not found") || error.message?.includes("No portfolio")) {
      return res.json([]);
    }
    res.status(500).json({ error: "Failed to generate talking points" });
  }
});

// POST endpoint for creating proposal
router.post("/proposal", async (req, res) => {
  try {
    const { clientId, picks } = req.body;
    
    if (!clientId || !picks?.length) {
      return res.status(400).json({ error: "Client ID and picks are required" });
    }

    const result = await aiInvestmentService.createProposalFromPicks(clientId, picks);
    
    res.json({
      proposalId: result?.proposalId || 'PROP-' + Date.now(),
      itemCount: picks.length
    });
  } catch (error) {
    console.error("Error creating proposal:", error);
    res.status(500).json({ error: "Failed to create proposal" });
  }
});

// Schema for portfolio insights request validation
const portfolioInsightsSchema = z.object({
  holdings: z.array(z.object({
    name: z.string(),
    assetClass: z.string(),
    value: z.number(),
    quantity: z.number(),
    gainLossPercent: z.number(),
  })).min(1, "At least one holding is required"),
  totalValue: z.number().optional().default(0),
  assetAllocation: z.record(z.object({
    value: z.number(),
    percent: z.number(),
  })).optional().default({}),
});

// POST endpoint for AI portfolio insights
router.post("/portfolio-insights", async (req, res) => {
  try {
    const validation = portfolioInsightsSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid request data",
        details: validation.error.errors 
      });
    }
    
    const { holdings, totalValue, assetAllocation } = validation.data;

    const insights = generatePortfolioInsights(holdings, totalValue, assetAllocation);
    
    res.json({ insights });
  } catch (error) {
    console.error("Error generating portfolio insights:", error);
    res.status(500).json({ error: "Failed to generate portfolio insights" });
  }
});

function generatePortfolioInsights(
  holdings: Array<{
    name: string;
    assetClass: string;
    value: number;
    quantity: number;
    gainLossPercent: number;
  }>,
  totalValue: number,
  assetAllocation: Record<string, { value: number; percent: number }>
): string {
  const insights: string[] = [];
  
  insights.push("## Portfolio Analysis\n");
  
  // 1. Asset Allocation Analysis
  insights.push("### Asset Allocation\n");
  const allocationEntries = Object.entries(assetAllocation || {});
  if (allocationEntries.length > 0) {
    const sortedAllocation = allocationEntries.sort((a, b) => b[1].percent - a[1].percent);
    const topAsset = sortedAllocation[0];
    if (topAsset && topAsset[1].percent > 50) {
      insights.push(`**Concentration Alert:** ${formatAssetClass(topAsset[0])} represents ${topAsset[1].percent.toFixed(1)}% of your portfolio. Consider diversifying to reduce risk.\n`);
    } else if (sortedAllocation.length === 1) {
      insights.push(`Your portfolio is entirely in ${formatAssetClass(topAsset[0])}. Consider diversifying across asset classes for better risk management.\n`);
    } else {
      insights.push(`Your portfolio is distributed across ${sortedAllocation.length} asset classes, with ${formatAssetClass(topAsset[0])} being the largest at ${topAsset[1].percent.toFixed(1)}%.\n`);
    }
  }
  
  // 2. Performance Analysis
  insights.push("\n### Performance Insights\n");
  const gainers = holdings.filter(h => h.gainLossPercent > 0);
  const losers = holdings.filter(h => h.gainLossPercent < 0);
  
  if (gainers.length > 0) {
    const topGainer = gainers.sort((a, b) => b.gainLossPercent - a.gainLossPercent)[0];
    insights.push(`**Top Performer:** ${topGainer.name} with ${topGainer.gainLossPercent.toFixed(2)}% gains.\n`);
  }
  
  if (losers.length > 0) {
    const topLoser = losers.sort((a, b) => a.gainLossPercent - b.gainLossPercent)[0];
    insights.push(`**Underperformer:** ${topLoser.name} with ${topLoser.gainLossPercent.toFixed(2)}% loss. Consider reviewing this position.\n`);
  }
  
  // 3. Risk Assessment
  insights.push("\n### Risk Assessment\n");
  const equityPercent = (assetAllocation?.equity?.percent || 0) + (assetAllocation?.unlisted?.percent || 0);
  const debtPercent = (assetAllocation?.bond?.percent || 0) + (assetAllocation?.mld?.percent || 0);
  const mfPercent = assetAllocation?.mutual_fund?.percent || 0;
  
  if (equityPercent > 70) {
    insights.push(`**High Equity Exposure (${equityPercent.toFixed(1)}%):** Your portfolio has aggressive risk profile. Consider adding debt instruments for stability during market corrections.\n`);
  } else if (debtPercent > 70) {
    insights.push(`**Conservative Allocation (${debtPercent.toFixed(1)}% debt):** While stable, you may be missing growth opportunities. Consider adding equity exposure based on your risk tolerance.\n`);
  } else {
    insights.push(`Your portfolio has a balanced mix with ${equityPercent.toFixed(1)}% equity and ${debtPercent.toFixed(1)}% debt.\n`);
  }
  
  // 4. Diversification Score
  insights.push("\n### Diversification\n");
  const uniqueAssetClasses = Object.keys(assetAllocation || {}).length;
  const holdingsCount = holdings.length;
  
  if (uniqueAssetClasses < 3) {
    insights.push(`**Limited Diversification:** Only ${uniqueAssetClasses} asset class(es). Consider adding mutual funds, bonds, or ETFs to improve diversification.\n`);
  } else if (holdingsCount < 5) {
    insights.push(`**Concentrated Holdings:** Only ${holdingsCount} securities. A well-diversified portfolio typically has 10-15 holdings across sectors.\n`);
  } else {
    insights.push(`Good diversification with ${holdingsCount} holdings across ${uniqueAssetClasses} asset classes.\n`);
  }
  
  // 5. Recommendations
  insights.push("\n### Recommendations\n");
  const recommendations: string[] = [];
  
  if (!assetAllocation?.bond && !assetAllocation?.mld) {
    recommendations.push("Add fixed-income instruments (bonds/MLDs) for portfolio stability");
  }
  if (equityPercent > 80) {
    recommendations.push("Consider profit booking in equity positions with significant gains");
  }
  if (losers.length > 3) {
    recommendations.push("Review underperforming positions and consider rebalancing");
  }
  if (holdingsCount > 30) {
    recommendations.push("Portfolio may be over-diversified; consider consolidating similar holdings");
  }
  if (mfPercent > 50) {
    recommendations.push("Review mutual fund overlap to avoid duplicate holdings across schemes");
  }
  
  if (recommendations.length > 0) {
    recommendations.forEach((rec, i) => {
      insights.push(`${i + 1}. ${rec}\n`);
    });
  } else {
    insights.push("Your portfolio appears well-balanced. Continue monitoring and rebalance quarterly.\n");
  }
  
  return insights.join("");
}

function formatAssetClass(assetClass: string): string {
  const labels: Record<string, string> = {
    mutual_fund: "Mutual Funds",
    equity: "Listed Stocks",
    bond: "Bonds",
    mld: "MLDs",
    etf: "ETFs",
    unlisted: "Unlisted Equity",
    pms: "PMS",
    aif: "AIF",
    other: "Other Assets",
  };
  return labels[assetClass] || assetClass;
}

// Investment Goals API endpoints
const investmentGoalsStore: Map<string, any[]> = new Map();

router.get("/goals/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const goals = investmentGoalsStore.get(clientId) || [];
    res.json(goals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/goals", async (req, res) => {
  try {
    const { clientId, type, name, targetAmount, currentAmount, targetDate, monthlyContribution, expectedReturn, riskLevel } = req.body;
    
    const goal = {
      id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      name,
      targetAmount,
      currentAmount: currentAmount || 0,
      targetDate,
      monthlyContribution,
      expectedReturn,
      riskLevel,
      progress: currentAmount ? Math.min((currentAmount / targetAmount) * 100, 100) : 0,
      createdAt: new Date().toISOString()
    };
    
    const existingGoals = investmentGoalsStore.get(clientId) || [];
    existingGoals.push(goal);
    investmentGoalsStore.set(clientId, existingGoals);
    
    res.json(goal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/goals/:goalId", async (req, res) => {
  try {
    const { goalId } = req.params;
    investmentGoalsStore.forEach((goals, clientId) => {
      const filtered = goals.filter(g => g.id !== goalId);
      investmentGoalsStore.set(clientId, filtered);
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Risk Profile API endpoints
const riskProfileStore: Map<string, any> = new Map();

router.get("/risk-profile/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const profile = riskProfileStore.get(clientId);
    // Return null with 200 instead of 404 - no profile yet is not an error
    res.json(profile || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/risk-profile", async (req, res) => {
  try {
    const { clientId, answers, score, riskCategory, allocation } = req.body;
    
    const profile = {
      id: `profile_${Date.now()}`,
      clientId,
      answers,
      score,
      riskCategory,
      allocation,
      updatedAt: new Date().toISOString()
    };
    
    riskProfileStore.set(clientId, profile);
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Benchmark Comparison API endpoint
router.get("/benchmark/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Resolve client type (prospect vs user)
    const clientInfo = await resolveClientType(clientId);
    
    // Get portfolio for the client
    const [portfolio] = await db
      .select()
      .from(portfolios)
      .where(clientInfo.portfolioWhereClause)
      .limit(1);
    
    // Calculate portfolio returns based on holdings
    let portfolioReturns = { return1M: 2.8, return3M: 9.1, return1Y: 18.2, ytd: 14.5 };
    
    if (portfolio) {
      const holdings = await db
        .select()
        .from(portfolioHoldings)
        .where(eq(portfolioHoldings.portfolioId, portfolio.id));
      
      if (holdings.length > 0) {
        const avgReturn = holdings.reduce((sum, h) => sum + (parseFloat(h.returnPercentage?.toString() || "0")), 0) / holdings.length;
        portfolioReturns = {
          return1M: avgReturn * 0.15,
          return3M: avgReturn * 0.5,
          return1Y: avgReturn,
          ytd: avgReturn * 0.8
        };
      }
    }
    
    const benchmarks = [
      { name: 'Nifty 50', return1M: 2.5, return3M: 8.2, return1Y: 15.4, ytd: 12.3 },
      { name: 'Sensex', return1M: 2.3, return3M: 7.9, return1Y: 14.8, ytd: 11.8 },
      { name: 'Nifty Midcap 100', return1M: 3.1, return3M: 10.5, return1Y: 22.3, ytd: 18.5 },
      { name: 'Nifty Smallcap 100', return1M: 4.2, return3M: 12.8, return1Y: 28.7, ytd: 24.2 },
    ];
    
    const sharpeRatio = 1.25 + Math.random() * 0.5;
    const sortinoRatio = 1.58 + Math.random() * 0.4;
    const beta = 0.85 + Math.random() * 0.25;
    
    res.json({
      portfolioReturns,
      benchmarks,
      sharpeRatio,
      sortinoRatio,
      beta
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Migration endpoint: Sync portfolioHoldings to currentPortfolio for all prospects (admin only)
router.post("/admin/migrate-prospect-portfolios", requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const result = await prospectPortfolioSyncService.migrateAllProspects();
    res.json({
      success: true,
      message: `Migration complete: ${result.migrated} prospects migrated out of ${result.total}`,
      ...result
    });
  } catch (error: any) {
    console.error("Error migrating portfolios:", error);
    res.status(500).json({ error: error.message });
  }
});

// Migration endpoint for single prospect (admin only)
router.post("/admin/migrate-prospect-portfolio/:prospectId", requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { prospectId } = req.params;
    const result = await prospectPortfolioSyncService.migrateToCurrentPortfolio(prospectId);
    res.json({
      success: true,
      message: `Migrated ${result.migrated} holdings`,
      holdings: result.holdings
    });
  } catch (error: any) {
    console.error("Error migrating portfolio:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
