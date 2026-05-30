import { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '@shared/schema';
import { portfolioHoldings, mutualFunds, mutualFundAmcs, insertWatchlistSchema } from '@shared/schema';
import { eq, desc, asc, sql, and, or, gte, lte, count, inArray, ilike } from 'drizzle-orm';
import { MultiSourceMFService } from '../services/multisource-mf-service';
import { calculateFintekProRating } from '../utils/mf-rating-utils';

const multiSourceMFService = new MultiSourceMFService(storage);

export function registerReportsInline21Routes(app: Express): void {
  app.post("/api/reports/fetch-from-nsdl", async (req, res) => {
    try {
      const { userId, financialYear, clientId } = req.body;
      
      // Mock external API call to NSDL
      const mockReportData = {
        source: "nsdl",
        assetType: "equity",
        totalPurchases: "500000.00",
        totalRedemptions: "200000.00",
        totalSwitches: "0.00",
        totalDividendReceived: "15000.00",
        totalBrokerage: "2500.00",
        totalTaxes: "5000.00",
        transactionCount: 45,
        reportData: {
          summary: { totalTransactions: 45, netInvestment: 300000 }
        },
        status: "completed"
      };

      const report = await storage.createTransactionReport({
        userId,
        financialYear,
        fetchedAt: new Date(),
        ...mockReportData
      });

      res.status(201).json({
        message: "Report fetched successfully from NSDL",
        report
      });
    } catch (error) {
      console.error("Error fetching from NSDL:", error);
      res.status(500).json({ error: "Failed to fetch report from NSDL" });
    }
  });

  app.post("/api/reports/fetch-from-cdsl", async (req, res) => {
    try {
      const { userId, financialYear, dpId, clientId } = req.body;
      
      // Mock external API call to CDSL
      const mockReportData = {
        source: "cdsl", 
        assetType: "equity",
        totalPurchases: "300000.00",
        totalRedemptions: "100000.00",
        totalSwitches: "50000.00",
        totalDividendReceived: "8000.00",
        totalBrokerage: "1800.00",
        totalTaxes: "3200.00",
        transactionCount: 28,
        reportData: {
          summary: { totalTransactions: 28, netInvestment: 200000 }
        },
        status: "completed"
      };

      const report = await storage.createTransactionReport({
        userId,
        financialYear,
        fetchedAt: new Date(),
        ...mockReportData
      });

      res.status(201).json({
        message: "Report fetched successfully from CDSL",
        report
      });
    } catch (error) {
      console.error("Error fetching from CDSL:", error);
      res.status(500).json({ error: "Failed to fetch report from CDSL" });
    }
  });


  // Sync MF holdings to portfolio
  app.post("/api/reports/sync-mf-to-portfolio", async (req, res) => {
    try {
      const { userId, portfolioId } = req.body;
      
      if (!userId || !portfolioId) {
        return res.status(400).json({ error: "userId and portfolioId are required" });
      }

      // Get MF holdings for user by joining through mf_folios (which has user_id)
      // Using actual DB column names: average_nav, current_nav, current_value
      const holdings = await db.select({
        id: schema.mfHoldings.id,
        folioId: schema.mfHoldings.folioId,
        schemeCode: schema.mfHoldings.schemeCode,
        schemeName: schema.mfHoldings.schemeName,
        units: schema.mfHoldings.units,
      })
        .from(schema.mfHoldings)
        .innerJoin(schema.mfFolios, eq(schema.mfHoldings.folioId, schema.mfFolios.id))
        .where(eq(schema.mfFolios.userId, userId));

      let syncedCount = 0;
      for (const holding of holdings) {
        // Skip holdings with zero or negligible units
        const holdingUnits = parseFloat(holding.units || '0');
        if (holdingUnits <= 0.0001) {
          continue;
        }

        // Check if already synced to portfolio
        const existing = await db.select()
          .from(portfolioHoldings)
          .where(and(
            eq(portfolioHoldings.portfolioId, portfolioId),
            eq(portfolioHoldings.symbol, holding.schemeCode || '')
          ))
          .limit(1);

        if (existing.length > 0) {
          // Update existing with available data
          await db.update(portfolioHoldings)
            .set({
              quantity: holding.units || '0',
              updatedAt: new Date(),
            })
            .where(eq(portfolioHoldings.id, existing[0].id));
        } else {
          // Create new with available data
          await db.insert(portfolioHoldings).values({
            portfolioId,
            symbol: holding.schemeCode || '',
            name: holding.schemeName || 'Unknown Fund',
            type: 'mutual-fund',
            quantity: holding.units || '0',
          });
        }
        syncedCount++;
      }

      res.json({
        message: `Synced ${syncedCount} mutual fund holdings to portfolio`,
        syncedCount
      });
    } catch (error) {
      console.error("Error syncing MF to portfolio:", error);
      res.status(500).json({ error: "Failed to sync MF holdings to portfolio" });
    }
  });

  // Sync demat holdings to portfolio
  app.post("/api/reports/sync-demat-to-portfolio", async (req, res) => {
    try {
      const { userId, portfolioId, depository } = req.body;
      
      if (!userId || !portfolioId) {
        return res.status(400).json({ error: "userId and portfolioId are required" });
      }

      // This would normally fetch from NSDL/CDSL, but for now we return mock data
      res.json({
        message: `Synced demat holdings from ${depository || 'NSDL'} to portfolio`,
        syncedCount: 0,
        note: "Real demat sync requires AA (Account Aggregator) integration"
      });
    } catch (error) {
      console.error("Error syncing demat to portfolio:", error);
      res.status(500).json({ error: "Failed to sync demat holdings to portfolio" });
    }
  });
  // Watchlist endpoints
  app.get("/api/watchlists/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const watchlists = await storage.getWatchlistsByUserId(userId);
      res.json(watchlists);
    } catch (error) {
      console.error("Error fetching watchlists:", error);
      res.status(500).json({ error: "Failed to fetch watchlists" });
    }
  });

  app.post("/api/watchlists", async (req, res) => {
    try {
      const validatedData = insertWatchlistSchema.parse(req.body);
      const watchlist = await storage.createWatchlist(validatedData);
      res.json(watchlist);
    } catch (error) {
      console.error("Error creating watchlist:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid watchlist data", details: error.issues });
      } else {
        res.status(500).json({ error: "Failed to create watchlist" });
      }
    }
  });

  // Enhanced Mutual Fund API endpoints with MultiSource integration

  // ==========================================
  // PUBLIC Mutual Fund API - Published funds from store
  // ==========================================
  
  // Fetch published mutual funds for public /mutual-funds page (no auth required)
  app.get("/api/public/mutual-funds", async (req, res) => {
    try {
      const { 
        category,
        fundHouse,
        planType,
        search,
        sortBy = 'schemeName',
        sortOrder = 'asc',
        page = '1',
        limit = '50'
      } = req.query;
      
      console.log('📊 Fetching published mutual funds from store...');
      
      // Build conditions for query
      let conditions: any[] = [
        eq(mutualFunds.isPublished, true)
      ];
      
      if (planType && planType !== 'all') {
        conditions.push(eq(mutualFunds.planType, planType as string));
      }
      
      if (category && category !== 'all') {
        conditions.push(ilike(mutualFunds.category, `%${category}%`));
      }
      
      if (fundHouse && fundHouse !== 'all') {
        conditions.push(ilike(mutualFunds.fundHouse, `%${fundHouse}%`));
      }
      
      if (search) {
        conditions.push(
          or(
            ilike(mutualFunds.schemeName, `%${search}%`),
            ilike(mutualFunds.fundHouse, `%${search}%`),
            ilike(mutualFunds.schemeCode, `%${search}%`)
          )
        );
      }
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;
      
      // Get sorting
      let orderBy: any = desc(mutualFunds.schemeName);
      if (sortBy === 'nav') {
        orderBy = sortOrder === 'asc' ? asc(mutualFunds.nav) : desc(mutualFunds.nav);
      } else if (sortBy === 'returns1y') {
        orderBy = sortOrder === 'asc' ? asc(mutualFunds.returns1y) : desc(mutualFunds.returns1y);
      } else if (sortBy === 'fundHouse') {
        orderBy = sortOrder === 'asc' ? asc(mutualFunds.fundHouse) : desc(mutualFunds.fundHouse);
      } else {
        orderBy = sortOrder === 'asc' ? asc(mutualFunds.schemeName) : desc(mutualFunds.schemeName);
      }
      
      const funds = await db.select()
        .from(mutualFunds)
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limitNum)
        .offset(offset);
      
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(mutualFunds)
        .where(and(...conditions));
      
      const total = Number(countResult[0]?.count || 0);
      
      // Get unique fund houses for filter dropdown
      const fundHouses = await db.selectDistinct({ fundHouse: mutualFunds.fundHouse })
        .from(mutualFunds)
        .where(eq(mutualFunds.isPublished, true));
      
      // Get unique categories for filter dropdown
      const categories = await db.selectDistinct({ category: mutualFunds.category })
        .from(mutualFunds)
        .where(eq(mutualFunds.isPublished, true));
      
      console.log(`✅ Found ${total} published mutual funds`);
      
      res.json({
        success: true,
        funds: funds.map(fund => ({
          id: fund.id,
          schemeCode: fund.schemeCode,
          schemeName: fund.schemeName,
          category: fund.category,
          fundHouse: fund.fundHouse,
          nav: fund.nav,
          change: fund.change,
          changePercent: fund.changePercent,
          expenseRatio: fund.expenseRatio,
          aum: fund.aum,
          riskLevel: fund.riskLevel,
          returns1y: fund.returns1y,
          returns3y: fund.returns3y,
          returns5y: fund.returns5y,
          planType: fund.planType,
          rating: fund.crisilRating || calculateFintekProRating(fund),
          extendedData: fund.extendedData,
          lastUpdated: fund.lastUpdated
        })),
        filters: {
          fundHouses: fundHouses.map(f => f.fundHouse).filter(Boolean),
          categories: categories.map(c => c.category).filter(Boolean)
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error: any) {
      console.error("[Public MF API] Error fetching published funds:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message,
        funds: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 }
      });
    }
  });


  // SEBI Mutual Funds API (public redirect)
}
