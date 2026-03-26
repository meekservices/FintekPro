import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, desc, sql, and, or, gte, lte, count, inArray } from 'drizzle-orm';
import { MultiSourceMFService } from '../services/multisource-mf-service';

const multiSourceMFService = new MultiSourceMFService(storage);

export function registerReportsInlineRoutes(app: Express): void {
  // ===== REPORTS API ENDPOINTS =====
  
  // Capital Gains Reports
  app.get("/api/capital-gains-reports", async (req, res) => {
    try {
      const { userId, financialYear } = req.query;
      const reports = await storage.getCapitalGainsReports(
        userId as string,
        financialYear as string
      );
      res.json(reports);
    } catch (error) {
      console.error("Error fetching capital gains reports:", error);
      res.status(500).json({ error: "Failed to fetch capital gains reports" });
    }
  });

  app.get("/api/capital-gains-reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.getCapitalGainsReport(id);
      if (report) {
        res.json(report);
      } else {
        res.status(404).json({ error: "Capital gains report not found" });
      }
    } catch (error) {
      console.error("Error fetching capital gains report:", error);
      res.status(500).json({ error: "Failed to fetch capital gains report" });
    }
  });

  app.post("/api/capital-gains-reports", async (req, res) => {
    try {
      const report = await storage.createCapitalGainsReport(req.body);
      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating capital gains report:", error);
      res.status(500).json({ error: "Failed to create capital gains report" });
    }
  });

  app.put("/api/capital-gains-reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.updateCapitalGainsReport(id, req.body);
      if (report) {
        res.json(report);
      } else {
        res.status(404).json({ error: "Capital gains report not found" });
      }
    } catch (error) {
      console.error("Error updating capital gains report:", error);
      res.status(500).json({ error: "Failed to update capital gains report" });
    }
  });

  // Transaction Reports  
  app.get("/api/transaction-reports", async (req, res) => {
    try {
      const { userId, financialYear } = req.query;
      const reports = await storage.getTransactionReports(
        userId as string,
        financialYear as string
      );
      res.json(reports);
    } catch (error) {
      console.error("Error fetching transaction reports:", error);
      res.status(500).json({ error: "Failed to fetch transaction reports" });
    }
  });

  app.get("/api/transaction-reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.getTransactionReport(id);
      if (report) {
        res.json(report);
      } else {
        res.status(404).json({ error: "Transaction report not found" });
      }
    } catch (error) {
      console.error("Error fetching transaction report:", error);
      res.status(500).json({ error: "Failed to fetch transaction report" });
    }
  });

  app.post("/api/transaction-reports", async (req, res) => {
    try {
      const report = await storage.createTransactionReport(req.body);
      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating transaction report:", error);
      res.status(500).json({ error: "Failed to create transaction report" });
    }
  });

  app.put("/api/transaction-reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.updateTransactionReport(id, req.body);
      if (report) {
        res.json(report);
      } else {
        res.status(404).json({ error: "Transaction report not found" });
      }
    } catch (error) {
      console.error("Error updating transaction report:", error);
      res.status(500).json({ error: "Failed to update transaction report" });
    }
  });

  // Transaction Records
  app.get("/api/transaction-records/:reportId", async (req, res) => {
    try {
      const { reportId } = req.params;
      const records = await storage.getTransactionRecords(reportId);
      res.json(records);
    } catch (error) {
      console.error("Error fetching transaction records:", error);
      res.status(500).json({ error: "Failed to fetch transaction records" });
    }
  });

  app.get("/api/transaction-records/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { financialYear } = req.query;
      const records = await storage.getTransactionRecordsByUser(
        userId,
        financialYear as string
      );
      res.json(records);
    } catch (error) {
      console.error("Error fetching user transaction records:", error);
      res.status(500).json({ error: "Failed to fetch user transaction records" });
    }
  });

  app.post("/api/transaction-records", async (req, res) => {
    try {
      const record = await storage.createTransactionRecord(req.body);
      res.status(201).json(record);
    } catch (error) {
      console.error("Error creating transaction record:", error);
      res.status(500).json({ error: "Failed to create transaction record" });
    }
  });

  // Capital Gains Report Download/Export
  app.get("/api/capital-gains-reports/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const { format = 'csv' } = req.query;
      
      const report = await storage.getCapitalGainsReport(id);
      if (!report) {
        return res.status(404).json({ error: "Capital gains report not found" });
      }

      const filename = `capital-gains-${report.financialYear}-${report.source}-${Date.now()}`;
      
      if (format === 'csv') {
        // Generate CSV content
        const csvContent = [
          'Financial Year,Source,Long Term Gains,Short Term Gains,Dividend,TDS Deducted,Status,Generated Date',
          `${report.financialYear},${report.source.toUpperCase()},${report.totalLongTermGains},${report.totalShortTermGains},${report.totalDividend},${report.totalTdsDeducted},${report.status},${report.generatedAt ? new Date(report.generatedAt).toLocaleDateString('en-IN') : 'N/A'}`
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.send(csvContent);
      } else if (format === 'pdf') {
        // Mock PDF generation - in real implementation, use a PDF library
        const pdfContent = `Capital Gains Report\n\nFinancial Year: ${report.financialYear}\nSource: ${report.source.toUpperCase()}\nLong Term Gains: ₹${report.totalLongTermGains}\nShort Term Gains: ₹${report.totalShortTermGains}\nDividend: ₹${report.totalDividend}\nTDS Deducted: ₹${report.totalTdsDeducted}\nStatus: ${report.status}\nGenerated: ${report.generatedAt ? new Date(report.generatedAt).toLocaleDateString('en-IN') : 'N/A'}`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        res.send(pdfContent);
      } else {
        // JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        res.json(report);
      }
    } catch (error) {
      console.error("Error downloading capital gains report:", error);
      res.status(500).json({ error: "Failed to download capital gains report" });
    }
  });

  // Transaction Report Download/Export
  app.get("/api/transaction-reports/:id/download", async (req, res) => {
    try {
      const { id } = req.params;
      const { format = 'csv' } = req.query;
      
      const report = await storage.getTransactionReport(id);
      if (!report) {
        return res.status(404).json({ error: "Transaction report not found" });
      }

      const filename = `transaction-report-${report.financialYear}-${report.source}-${Date.now()}`;
      
      if (format === 'csv') {
        // Generate CSV content
        const csvContent = [
          'Financial Year,Source,Asset Type,Total Purchases,Total Redemptions,Total Switches,Dividend Received,Brokerage,Taxes,Transaction Count',
          `${report.financialYear},${report.source.toUpperCase()},${report.assetType},${report.totalPurchases},${report.totalRedemptions},${report.totalSwitches},${report.totalDividendReceived},${report.totalBrokerage},${report.totalTaxes},${report.transactionCount}`
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.send(csvContent);
      } else if (format === 'pdf') {
        // Mock PDF generation
        const pdfContent = `Transaction Report\n\nFinancial Year: ${report.financialYear}\nSource: ${report.source.toUpperCase()}\nAsset Type: ${report.assetType}\nTotal Purchases: ₹${report.totalPurchases}\nTotal Redemptions: ₹${report.totalRedemptions}\nTotal Switches: ₹${report.totalSwitches}\nDividend Received: ₹${report.totalDividendReceived}\nBrokerage: ₹${report.totalBrokerage}\nTaxes: ₹${report.totalTaxes}\nTransaction Count: ${report.transactionCount}`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        res.send(pdfContent);
      } else {
        // JSON format
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        res.json(report);
      }
    } catch (error) {
      console.error("Error downloading transaction report:", error);
      res.status(500).json({ error: "Failed to download transaction report" });
    }
  });

  // External API Integration Endpoints for Fetching Reports
  app.post("/api/reports/fetch-from-mf-central", async (req, res) => {
    try {
      const { userId, financialYear, panNumber } = req.body;
      
      // Mock external API call to MF Central
      // In real implementation, this would call MF Central API
      const mockReportData = {
        source: "mf_central",
        totalShortTermGains: "25000.00",
        totalLongTermGains: "75000.00",
        totalDividend: "12000.00",
        totalTdsDeducted: "2400.00",
        reportData: {
          summary: { totalGains: 100000, taxableShortTerm: 25000 },
          holdings: []
        },
        status: "completed"
      };

      const report = await storage.createCapitalGainsReport({
        userId,
        financialYear,
        reportType: "capital_gains",
        fetchedAt: new Date(),
        ...mockReportData
      });

      res.status(201).json({
        message: "Report fetched successfully from MF Central",
        report
      });
    } catch (error) {
      console.error("Error fetching from MF Central:", error);
      res.status(500).json({ error: "Failed to fetch report from MF Central" });
    }
  });

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
        res.status(400).json({ error: "Invalid watchlist data", details: error.errors });
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
  app.get("/api/sebi/mutual-funds", async (req, res) => {
    try {
      // Return published mutual funds or redirect to public API
      const pageNum = parseInt(req.query.page as string || '1');
      const limitNum = parseInt(req.query.limit as string || '50');
      const offset = (pageNum - 1) * limitNum;
      
      const funds = await db.select()
        .from(mutualFunds)
        .where(eq(mutualFunds.isPublished, true))
        .limit(limitNum)
        .offset(offset);
      
      res.json({
        success: true,
        data: funds,
        source: 'sebi_registry'
      });
    } catch (error: any) {
      console.error("[SEBI MF API] Error:", error);
      res.json({ success: true, data: [], source: 'sebi_registry' });
    }
  });

  // Get AMCs with their published scheme counts for public display
  app.get("/api/public/mutual-funds/amcs", async (req, res) => {
    try {
      const amcs = await db.select()
        .from(mutualFundAmcs)
        .where(
          or(
            eq(mutualFundAmcs.regularPlansEnabled, true),
            eq(mutualFundAmcs.directPlansEnabled, true)
          )
        )
        .orderBy(asc(mutualFundAmcs.name));
      
      res.json({
        success: true,
        amcs: amcs.map(amc => ({
          id: amc.id,
          name: amc.name,
          displayName: amc.displayName || amc.name,
          logoUrl: amc.logoUrl,
          regularPlansEnabled: amc.regularPlansEnabled,
          directPlansEnabled: amc.directPlansEnabled,
          totalSchemes: amc.totalSchemes,
          publishedRegularSchemes: amc.publishedRegularSchemes,
          publishedDirectSchemes: amc.publishedDirectSchemes
        }))
      });
    } catch (error: any) {
      console.error("[Public MF API] Error fetching AMCs:", error);
      res.status(500).json({ success: false, error: error.message, amcs: [] });
    }
  });

  app.get("/api/mutual-funds", async (req, res) => {
    try {
      const { 
        category, 
        fundHouse, 
        nav_min, 
        nav_max, 
        sortBy = 'returns1Y', 
        sortOrder = 'desc',
        page = '1',
        limit = '50',
        query 
      } = req.query;
      
      console.log('📊 Fetching mutual funds with MultiSource MF service...');
      
      // Prepare search parameters
      const searchParams = {
        query: query as string,
        category: category as string,
        fundHouse: fundHouse as string,
        sortBy: sortBy as 'name' | 'nav' | 'returns1Y' | 'returns3Y' | 'returns5Y' | 'aum',
        sortOrder: sortOrder as 'asc' | 'desc',
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      };

      const result = await multiSourceMFService.listFunds(searchParams);
      
      // Transform MultiSource data to camelCase format for frontend compatibility
      const formattedFunds = result.funds.map((fund) => ({
        id: `mf-${fund.schemeCode}`,
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName,
        fundHouse: fund.fundHouse,
        category: fund.category,
        subCategory: fund.subCategory || fund.category,
        nav: String(parseFloat(fund.currentNav || '0')),
        change: fund.change || '0',
        changePercent: fund.changePercent || '0',
        navDate: fund.navDate,
        aum: fund.aum || "N/A",
        expenseRatio: fund.expenseRatio || "N/A",
        minInvestment: 5000,
        fundManager: fund.manager || "N/A",
        benchmark: fund.benchmark || "N/A",
        launchDate: "N/A",
        returns: {
          "1D": null,
          "1W": null,
          "1M": fund.returns['1M'] || 0,
          "3M": null,
          "6M": fund.returns['6M'] || 0,
          "1Y": fund.returns['1Y'] || 0,
          "2Y": null,
          "3Y": fund.returns['3Y'] || 0,
          "5Y": fund.returns['5Y'] || 0,
          "since_inception": null
        },
        returnStrings: fund.returnStrings,
        riskLevel: fund.riskLevel,
        rating: 4,
        exitLoad: "1% if redeemed within 365 days",
        returns1y: fund.returns?.['1Y'],
        returns3y: fund.returns?.['3Y'],
        returns5y: fund.returns?.['5Y'],
        provenance: fund.provenance
      }));
      
      // Apply legacy filters if provided for backward compatibility
      let filteredFunds = formattedFunds;
      
      if (nav_min) {
        filteredFunds = filteredFunds.filter(fund => parseFloat(fund.nav) >= parseFloat(nav_min as string));
      }
      
      if (nav_max) {
        filteredFunds = filteredFunds.filter(fund => parseFloat(fund.nav) <= parseFloat(nav_max as string));
      }
      
      return res.json({
        success: true,
        data: filteredFunds,
        total: result.total,
        page: result.page,
        limit: result.limit,
        hasMore: result.hasMore,
        source: 'MultiSource',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("❌ Error in mutual funds endpoint:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch mutual funds",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/mutual-funds/popular", async (req, res) => {
    try {
      console.log("📈 Fetching best performing mutual funds with MultiSource service...");
      
      // Use MultiSource service for popular funds
      const popularFunds = await multiSourceMFService.getPopularFunds();
      
      if (popularFunds && popularFunds.length > 0) {
        console.log(`✅ MultiSource service found ${popularFunds.length} popular funds`);
        
        // Return top 30 funds for better variety (was 6, increased for comprehensive coverage)
        const topFunds = popularFunds.slice(0, 30);
        
        // Transform to camelCase format for frontend compatibility
        const formattedFunds = topFunds.map(fund => ({
          id: `multisource-${fund.schemeCode}`,
          schemeCode: fund.schemeCode,
          schemeName: fund.schemeName,
          fundHouse: fund.fundHouse,
          category: fund.category,
          nav: String(parseFloat(fund.currentNav || fund.nav || '0')),
          change: fund.change || '0',
          changePercent: fund.changePercent || '0',
          navDate: fund.navDate || new Date().toISOString().split('T')[0],
          returns: fund.returns || {},
          returnStrings: fund.returnStrings || {},
          riskLevel: fund.riskLevel || 'Moderate',
          fintekproRating: fund.crisilRating || null,
          rating: fund.crisilRating || fund.rating || 4,
          minInvestment: fund.minInvestment || 5000,
          exitLoad: fund.exitLoad || '1% if redeemed within 365 days',
          expenseRatio: fund.expenseRatio,
          aum: fund.aum,
          returns1y: fund.returns?.['1Y'],
          returns3y: fund.returns?.['3Y'],
          returns5y: fund.returns?.['5Y'],
          provenance: fund.provenance
        }));
        
        // Cache the data for future use
        for (const fund of topFunds) {
          try {
            await storage.upsertMutualFund({
              schemeCode: fund.schemeCode,
              schemeName: fund.schemeName,
              category: fund.category,
              fundHouse: fund.fundHouse,
              nav: String(fund.currentNav || fund.nav || '0')
            });
          } catch (cacheError) {
            console.warn(`Failed to cache fund ${fund.schemeCode}:`, cacheError);
          }
        }
        
        return res.json({
          success: true,
          data: formattedFunds,
          total: formattedFunds.length,
          source: 'MultiSource',
          timestamp: new Date().toISOString()
        });
      }
      
      console.warn("⚠️ MultiSource service returned no popular funds, trying fallback...");
      
    // Fallback to cached data
    try {
        const cachedFunds = await storage.getAllMutualFunds();
        if (cachedFunds.length > 0) {
          console.log(`✅ Using cached data with ${cachedFunds.length} funds`);
          
          const topCachedFunds = cachedFunds.slice(0, 30);
          const formattedCached = topCachedFunds.map((fund, index) => ({
            id: `cache-${fund.schemeCode}`,
            scheme_code: fund.schemeCode,
            scheme_name: fund.schemeName,
            amc: fund.fundHouse,
            category: fund.category,
            nav: parseFloat(String(fund.nav)) || 0,
            nav_date: fund.lastUpdated ? fund.lastUpdated.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            returns: {
              '1M': 0,
              '6M': 0,
              '1Y': 0,
              '3Y': 0,
              '5Y': 0
            },
            returnStrings: {
              '1M': 'N/A',
              '6M': 'N/A',
              '1Y': 'N/A',
              '3Y': 'N/A',
              '5Y': 'N/A'
            },
            risk_level: 'Moderate',
            rating: 4,
            min_investment: 5000,
            exit_load: '1% if redeemed within 365 days'
          }));
          
          return res.json({
            success: true,
            data: formattedCached,
            total: formattedCached.length,
            source: 'Cache',
            timestamp: new Date().toISOString()
          });
        }
      } catch (cacheError) {
        console.warn("⚠️ Failed to fetch cached funds:", cacheError);
      }
      
      // Final fallback - return minimal data structure
      console.log("💡 Using minimal fallback data");
      const minimalFunds = [
        {
          id: 'fallback-119551',
          scheme_code: '119551',
          scheme_name: 'SBI BlueChip Fund - Direct Plan - Growth',
          amc: 'SBI Mutual Fund',
          category: 'Large Cap Fund',
          nav: 85.67,
          nav_date: new Date().toISOString().split('T')[0],
          returns: { '1M': 2.1, '6M': 8.5, '1Y': 15.3, '3Y': 12.7, '5Y': 11.2 },
          returnStrings: { '1M': '+2.1%', '6M': '+8.5%', '1Y': '+15.3%', '3Y': '+12.7%', '5Y': '+11.2%' },
          risk_level: 'Moderate',
          rating: 4,
          min_investment: 5000,
          exit_load: '1% if redeemed within 365 days'
        }
      ];
      
      return res.json({
        success: true,
        data: minimalFunds,
        total: minimalFunds.length,
        source: 'Fallback',
        message: 'Using fallback data as all primary sources are unavailable',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("❌ Error fetching popular mutual funds:", error);
      
      // Return 503 Service Unavailable when no data is available from any source
      res.status(503).json({
        success: false,
        error: "Service temporarily unavailable",
        message: "All data sources are currently unavailable. Please try again later.",
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/mutual-funds/autocomplete", async (req, res) => {
    try {
      const { q, limit = '20' } = req.query;
      
      if (!q || String(q).length < 2) {
        return res.json({ success: true, funds: [] });
      }
      
      const searchPattern = `%${String(q).toLowerCase()}%`;
      const searchPatternUpper = `%${String(q).toUpperCase()}%`;
      
      const funds = await db.select({
        isin: mutualFunds.isin,
        schemeCode: mutualFunds.schemeCode,
        schemeName: mutualFunds.schemeName,
        fundHouse: mutualFunds.fundHouse,
        category: mutualFunds.category,
        nav: mutualFunds.nav,
        planType: mutualFunds.planType,
        extendedData: mutualFunds.extendedData
      })
      .from(mutualFunds)
      .where(
        or(
          sql`LOWER(${mutualFunds.schemeName}) LIKE ${searchPattern}`,
          sql`LOWER(${mutualFunds.fundHouse}) LIKE ${searchPattern}`,
          sql`UPPER(${mutualFunds.isin}) LIKE ${searchPatternUpper}`
        )
      )
      .limit(parseInt(limit as string));
      
      const results = funds.map(fund => ({
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName,
        fundHouse: fund.fundHouse || '',
        category: fund.category || '',
        nav: parseFloat(fund.nav || '0'),
        planType: fund.planType || 'Regular',
        isin: fund.isin || (fund.extendedData as any)?.isin || ''
      }));
      
      res.json({ success: true, funds: results });
    } catch (error) {
      console.error("Error in autocomplete search:", error);
      res.status(500).json({ success: false, error: "Search failed" });
    }
  });

  app.get("/api/mutual-funds/by-isin/:isin", async (req, res) => {
    try {
      const { isin } = req.params;
      
      if (!isin || isin.length !== 12) {
        return res.status(400).json({ success: false, error: 'Invalid ISIN format' });
      }
      
      const funds = await db.select({
        isin: mutualFunds.isin,
        schemeCode: mutualFunds.schemeCode,
        schemeName: mutualFunds.schemeName,
        fundHouse: mutualFunds.fundHouse,
        category: mutualFunds.category,
        nav: mutualFunds.nav,
        planType: mutualFunds.planType,
        extendedData: mutualFunds.extendedData
      })
      .from(mutualFunds)
      .where(sql`${mutualFunds.extendedData}->>'isin' = ${isin}`)
      .limit(1);
      
      if (funds.length === 0) {
        return res.status(404).json({ success: false, error: 'Fund not found for this ISIN' });
      }
      
      const fund = funds[0];
      res.json({
        success: true,
        fund: {
          schemeCode: fund.schemeCode,
          schemeName: fund.schemeName,
          fundHouse: fund.fundHouse || '',
          category: fund.category || '',
          nav: parseFloat(fund.nav || '0'),
          planType: fund.planType || 'Regular',
          isin: fund.isin || (fund.extendedData as any)?.isin || ''
        }
      });
    } catch (error) {
      console.error("Error looking up fund by ISIN:", error);
      res.status(500).json({ success: false, error: "Lookup failed" });
    }
  });

  // Query param style search handler - MUST be before :schemeCode route to prevent shadowing
  app.get("/api/mutual-funds/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.status(400).json({ 
          success: false, 
          error: "Query too short",
          message: "Search query must be at least 2 characters"
        });
      }
      
      console.log(`🔍 Searching funds with query param: ${query}`);
      const searchResults = await multiSourceMFService.searchFunds(query);
      
      if (searchResults.length > 0) {
        console.log(`✅ Query param search found ${searchResults.length} funds`);
        return res.json({ success: true, data: searchResults });
      }
      
      return res.json({ success: true, data: [], message: "No funds found matching query" });
    } catch (error: any) {
      console.error("❌ Error in query param search:", error);
      return res.status(500).json({
        success: false,
        error: "Search failed",
        message: error.message
      });
    }
  });

  app.get("/api/mutual-funds/:schemeCode", async (req, res) => {
    try {
      const { schemeCode } = req.params;
      console.log(`📊 Fetching fund details for scheme: ${schemeCode} with MultiSource service`);
      
      const fund = await multiSourceMFService.getFund(schemeCode);
      
      if (!fund) {
        return res.status(404).json({
          success: false,
          error: "Fund not found",
          message: `No data available for scheme code: ${schemeCode}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Transform to legacy API format for compatibility
      const formattedFund = {
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName,
        category: fund.category,
        subCategory: fund.subCategory || fund.category,
        fundHouse: fund.fundHouse,
        nav: parseFloat(fund.currentNav || '0'),
        navDate: fund.navDate,
        isin: fund.isin || "N/A",
        aum: fund.aum || "N/A",
        expenseRatio: fund.expenseRatio || "N/A",
        minInvestment: 5000,
        exitLoad: "1% if redeemed within 365 days",
        benchmark: fund.benchmark || "N/A",
        fundManager: fund.manager || "N/A",
        launchDate: "N/A",
        riskLevel: fund.riskLevel || "Moderate",
        rating: 4,
        returns: fund.returns || {},
        returnStrings: fund.returnStrings || {},
        volatility: fund.volatility,
        sharpeRatio: fund.sharpeRatio,
        maxDrawdown: (fund as any).maxDrawdown,
        historicalData: (fund as any).historicalData || [],
        lastUpdated: fund.navDate,
        source: 'MultiSource',
        provenance: fund.provenance
      };
      
      return res.json({
        success: true,
        data: formattedFund,
        source: 'MultiSource',
        timestamp: new Date().toISOString()
      });
        
        /* LEGACY START: BSE/AMFI - to be removed 
        if (bseFundPerformance) {
          console.log(`✅ BSE service found fund: ${bseFundPerformance.schemeName}`);
          
          // Get historical NAV data
          const historicalNAV = await bseService.getHistoricalNAV(schemeCode);
          
          const fundData = {
            schemeCode: bseFundPerformance.schemeCode,
            schemeName: bseFundPerformance.schemeName,
            category: bseFundPerformance.category,
            subCategory: bseFundPerformance.subCategory || bseFundPerformance.category,
            fundHouse: bseFundPerformance.fundHouse,
            nav: bseFundPerformance.currentNav,
            navDate: bseFundPerformance.navDate,
            isin: bseFundPerformance.isin,
            aum: bseFundPerformance.aum || "N/A",
            expenseRatio: bseFundPerformance.expenseRatio || 1.2,
            minInvestment: bseFundPerformance.minInvestment || 5000,
            exitLoad: bseFundPerformance.exitLoad || "1% if redeemed within 365 days",
            benchmark: bseFundPerformance.benchmark || "N/A",
            fundManager: bseFundPerformance.fundManager || "N/A",
            launchDate: bseFundPerformance.launchDate || "N/A",
            riskLevel: bseFundPerformance.riskLevel,
            rating: bseFundPerformance.rating || 4,
            returns: bseFundPerformance.returns,
            returnStrings: bseFundPerformance.returnStrings,
            volatility: bseFundPerformance.volatility,
            sharpeRatio: bseFundPerformance.sharpeRatio,
            maxDrawdown: bseFundPerformance.maxDrawdown,
            historicalData: historicalNAV.slice(0, 365), // Last 1 year of data
            lastUpdated: bseFundPerformance.lastUpdated,
            source: 'BSE'
          };
          
          // Store/update in database for caching
          await storage.upsertMutualFund({
            schemeCode: fundData.schemeCode,
            schemeName: fundData.schemeName,
            category: fundData.category,
            fundHouse: fundData.fundHouse,
            nav: String(fundData.nav),
            lastUpdated: new Date()
          });
          
          return res.json({
            success: true,
            data: fundData,
            source: 'BSE',
            timestamp: new Date().toISOString()
          });
        }
      } catch (bseError) {
        console.warn(`⚠️ BSE service failed for ${schemeCode}, trying AMFI:`, bseError);
      }
      
      // Fallback to AMFI service
      try {
        const amfiFundPerformance = await amfiService.calculateFundPerformance(schemeCode);
        
        if (amfiFundPerformance) {
          console.log(`✅ AMFI fallback found fund: ${amfiFundPerformance.schemeName}`);
          
          const fundData = {
            schemeCode: amfiFundPerformance.schemeCode,
            schemeName: amfiFundPerformance.schemeName,
            category: amfiFundPerformance.category,
            subCategory: amfiFundPerformance.category,
            fundHouse: amfiFundPerformance.fundHouse,
            nav: amfiFundPerformance.currentNav,
            navDate: amfiFundPerformance.lastUpdated,
            returns: amfiFundPerformance.returns,
            returnStrings: amfiFundPerformance.returnStrings,
            historicalData: [], // AMFI service doesn't provide historical data in this format
            lastUpdated: amfiFundPerformance.lastUpdated,
            source: 'AMFI'
          };
          
          await storage.upsertMutualFund({
            schemeCode: fundData.schemeCode,
            schemeName: fundData.schemeName,
            category: fundData.category,
            fundHouse: fundData.fundHouse,
            nav: String(fundData.nav),
            lastUpdated: new Date()
          });
          
          return res.json({
            success: true,
            data: fundData,
            source: 'AMFI',
            timestamp: new Date().toISOString()
          });
        }
      } catch (amfiError) {
        console.error(`❌ AMFI service also failed for ${schemeCode}:`, amfiError);
      }
      
      // Final fallback - check database
      const cachedFund = await storage.getMutualFund(schemeCode);
      if (cachedFund) {
        return res.json({
          success: true,
          data: cachedFund,
          source: 'Cache',
          timestamp: new Date().toISOString()
        });
      }
      
      return res.status(404).json({
        success: false,
        error: "Fund not found",
        message: `No data available for scheme code: ${schemeCode}`,
        timestamp: new Date().toISOString()
      });
      LEGACY END - to be removed */
      
    } catch (error) {
      console.error(`❌ Error fetching mutual fund ${req.params.schemeCode}:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch mutual fund details",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/mutual-funds/search/:query", async (req, res) => {
    try {
      const { query } = req.params;
      console.log(`🔍 Searching funds with query: ${query}`);
      
      // Use MultiSource service for search
      const searchResults = await multiSourceMFService.searchFunds(query);
      
      if (searchResults.length > 0) {
        console.log(`✅ MultiSource search found ${searchResults.length} funds`);
        
        // Transform MultiSource results to API format
        const formattedResults = searchResults.map(fund => ({
          id: `multisource-${fund.schemeCode}`,
          scheme_code: fund.schemeCode,
          scheme_name: fund.schemeName,
          amc: fund.fundHouse,
          category: fund.category,
          nav: fund.nav,
          nav_date: fund.navDate,
          returns: fund.returns,
          returnStrings: fund.returnStrings,
          riskLevel: fund.riskLevel,
          rating: fund.rating,
          provenance: fund.provenance
        }));
        
        return res.json({
          success: true,
          data: formattedResults,
          total: searchResults.length,
          query: query,
          source: 'MultiSource',
          timestamp: new Date().toISOString()
        });
      }
      
      return res.json({
        success: true,
        data: [],
        total: 0,
        query: query,
        message: 'No funds found matching the search criteria',
        source: 'None',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`❌ Error searching mutual funds for "${req.params.query}":`, error);
      res.status(500).json({
        success: false,
        error: "Failed to search mutual funds",
        message: error instanceof Error ? error.message : 'Unknown error',
        query: req.params.query
      });
    }
  });

}
