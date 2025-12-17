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
  marketData
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const manualEntrySchema = z.object({
  clientId: z.string(),
  holdings: z.array(z.object({
    symbol: z.string(),
    stockName: z.string().optional(),
    quantity: z.number().positive(),
    avgPrice: z.number().positive(),
    assetType: z.string().default('equity'),
    sector: z.string().optional(),
  }))
});

const csvUploadSchema = z.object({
  clientId: z.string(),
});

router.get("/portfolio/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const [portfolio] = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.userId, clientId))
      .limit(1);

    if (!portfolio) {
      return res.json({
        success: true,
        portfolio: null,
        holdings: [],
        message: "No portfolio found for this client"
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
        
        const currentPrice = market?.price ? parseFloat(market.price) : parseFloat(holding.avgPrice);
        const quantity = parseFloat(holding.quantity);
        const avgPrice = parseFloat(holding.avgPrice);
        const marketValue = quantity * currentPrice;
        const investedValue = quantity * avgPrice;
        const gainLoss = marketValue - investedValue;
        const gainLossPercent = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0;

        return {
          ...holding,
          currentPrice,
          marketValue,
          investedValue,
          gainLoss,
          gainLossPercent,
          change: market?.change || "0",
          changePercent: market?.changePercent || "0"
        };
      })
    );

    const totalValue = holdingsWithMarketData.reduce((sum, h) => sum + h.marketValue, 0);
    const totalInvested = holdingsWithMarketData.reduce((sum, h) => sum + h.investedValue, 0);

    res.json({
      success: true,
      portfolio: {
        ...portfolio,
        totalValue,
        totalInvested,
        totalGainLoss: totalValue - totalInvested,
        totalGainLossPercent: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0
      },
      holdings: holdingsWithMarketData
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

    let [portfolio] = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.userId, clientId))
      .limit(1);

    if (!portfolio) {
      [portfolio] = await db.insert(portfolios).values({
        userId: clientId,
        name: "Manual Portfolio",
        isDefault: true,
      }).returning();
    }

    const insertedHoldings = [];
    for (const holding of holdings) {
      const [inserted] = await db.insert(portfolioHoldings).values({
        portfolioId: portfolio.id,
        symbol: holding.symbol,
        quantity: String(holding.quantity),
        avgPrice: String(holding.avgPrice),
        assetType: holding.assetType,
        sector: holding.sector,
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

    let [portfolio] = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.userId, clientId))
      .limit(1);

    if (!portfolio) {
      [portfolio] = await db.insert(portfolios).values({
        userId: clientId,
        name: "CSV Uploaded Portfolio",
        isDefault: true,
      }).returning();
    }

    const insertedHoldings = [];
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

        const [inserted] = await db.insert(portfolioHoldings).values({
          portfolioId: portfolio.id,
          symbol: symbol.toUpperCase(),
          quantity: String(quantity),
          avgPrice: String(avgPrice),
          assetType: 'equity',
          sector,
        }).returning();
        insertedHoldings.push(inserted);
      } catch (err) {
        errors.push(`Row ${i + 1}: Failed to process`);
      }
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
    const { quantity, avgPrice, sector } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (quantity !== undefined) updateData.quantity = String(quantity);
    if (avgPrice !== undefined) updateData.avgPrice = String(avgPrice);
    if (sector !== undefined) updateData.sector = sector;

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

export default router;
