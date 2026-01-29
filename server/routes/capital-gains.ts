import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { capitalGainsReports, insertCapitalGainsReportSchema } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { proposalCapitalGainsService } from '../services/proposal-capital-gains-service';

export function registerCapitalGainsRoutes(app: Express): void {
  app.post("/api/nsdl/capital-gains", async (req, res) => {
    try {
      const { accountNumber, financialYear, fromDate, toDate } = req.body;

      if (!accountNumber || !financialYear) {
        return res.status(400).json({ error: "Account number and financial year are required" });
      }

      const mockCapitalGainsData = {
        accountNumber,
        financialYear,
        reportType: "capital_gains",
        source: "nsdl",
        summary: {
          totalShortTermGains: "125430.50",
          totalLongTermGains: "89750.25",
          totalDividend: "15600.00",
          totalTdsDeducted: "2340.75",
          totalTransactions: 45
        },
        transactions: [
          {
            id: "txn1",
            isin: "INE009A01021",
            companyName: "Infosys Limited",
            symbol: "INFY",
            transactionType: "sell",
            buyDate: "2022-03-15",
            sellDate: "2023-08-20",
            buyQuantity: 100,
            sellQuantity: 100,
            buyPrice: "1450.50",
            sellPrice: "1650.75",
            buyValue: "145050.00",
            sellValue: "165075.00",
            gainLoss: "20025.00",
            gainType: "long_term",
            tdsDeducted: "0.00"
          }
        ],
        generatedAt: new Date().toISOString()
      };

      res.json(mockCapitalGainsData);
    } catch (error) {
      console.error("Error fetching NSDL capital gains:", error);
      res.status(500).json({ error: "Failed to fetch capital gains data" });
    }
  });

  app.post("/api/cdsl/capital-gains", async (req, res) => {
    try {
      const { boid, financialYear, fromDate, toDate } = req.body;

      if (!boid || !financialYear) {
        return res.status(400).json({ error: "BOID and financial year are required" });
      }

      const mockCapitalGainsData = {
        boid,
        financialYear,
        reportType: "capital_gains",
        source: "cdsl",
        summary: {
          totalShortTermGains: "98765.25",
          totalLongTermGains: "156780.50",
          totalDividend: "12450.00",
          totalTdsDeducted: "1867.50",
          totalTransactions: 38
        },
        transactions: [
          {
            id: "ctxn1",
            isin: "INE040A01034",
            companyName: "HDFC Bank Limited",
            symbol: "HDFCBANK",
            transactionType: "sell",
            buyDate: "2021-11-10",
            sellDate: "2023-06-15",
            buyQuantity: 50,
            sellQuantity: 50,
            buyPrice: "1320.00",
            sellPrice: "1680.50",
            buyValue: "66000.00",
            sellValue: "84025.00",
            gainLoss: "18025.00",
            gainType: "long_term",
            tdsDeducted: "0.00"
          }
        ],
        generatedAt: new Date().toISOString()
      };

      res.json(mockCapitalGainsData);
    } catch (error) {
      console.error("Error fetching CDSL capital gains:", error);
      res.status(500).json({ error: "Failed to fetch capital gains data" });
    }
  });

  app.post("/api/capital-gains/save-report", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { report, source } = req.body;
      if (!report) {
        return res.status(400).json({ error: "Report data is required" });
      }

      const savedReport = await storage.createCapitalGainsReport({
        userId: req.user.id,
        financialYear: report.financialYear,
        source: source || 'nsdl',
        totalShortTermGains: report.summary?.totalShortTermGains || "0",
        totalLongTermGains: report.summary?.totalLongTermGains || "0",
        totalDividend: report.summary?.totalDividend || "0",
        totalTdsDeducted: report.summary?.totalTdsDeducted || "0",
        transactions: report.transactions || [],
        status: "completed"
      });

      res.status(201).json(savedReport);
    } catch (error) {
      console.error("Error saving capital gains report:", error);
      res.status(500).json({ error: "Failed to save capital gains report" });
    }
  });

  app.get("/api/capital-gains/reports", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const reports = await storage.getCapitalGainsReportsByUserId(req.user.id);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching capital gains reports:", error);
      res.status(500).json({ error: "Failed to fetch capital gains reports" });
    }
  });

  app.get("/api/capital-gains/reports/:reportId", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { reportId } = req.params;
      const report = await storage.getCapitalGainsReport(reportId);

      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      if (report.userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(report);
    } catch (error) {
      console.error("Error fetching capital gains report:", error);
      res.status(500).json({ error: "Failed to fetch capital gains report" });
    }
  });

  app.delete("/api/capital-gains/reports/:reportId", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { reportId } = req.params;
      const report = await storage.getCapitalGainsReport(reportId);

      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      if (report.userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      await db.delete(capitalGainsReports).where(eq(capitalGainsReports.id, reportId));
      res.json({ message: "Report deleted successfully" });
    } catch (error) {
      console.error("Error deleting capital gains report:", error);
      res.status(500).json({ error: "Failed to delete capital gains report" });
    }
  });

  // Tax-efficient sell timing advice endpoint
  app.post("/api/capital-gains/sell-advice", async (req, res) => {
    try {
      const { holdings } = req.body;

      if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
        return res.status(400).json({ error: "Holdings array is required" });
      }

      const advice = await proposalCapitalGainsService.generateTaxEfficientSellAdvice(holdings);
      res.json(advice);
    } catch (error) {
      console.error("Error generating tax-efficient sell advice:", error);
      res.status(500).json({ error: "Failed to generate sell advice" });
    }
  });

  // What-if redemption simulator endpoint
  app.post("/api/capital-gains/simulate-redemption", async (req, res) => {
    try {
      const { holding, redemptionAmount, strategy = 'fifo' } = req.body;

      if (!holding || !redemptionAmount) {
        return res.status(400).json({ error: "Holding and redemption amount are required" });
      }

      // Calculate current NAV and prepare lots
      const units = holding.quantity || 100;
      const currentNav = holding.currentValue / units;
      const purchaseNav = (holding.investedAmount || holding.currentValue * 0.85) / units;
      
      // Generate lots for simulation if not provided
      const lots = holding.lots || [{
        id: 'lot-1',
        purchaseDate: holding.purchaseDate || new Date().toISOString(),
        purchaseNav,
        purchaseValue: purchaseNav * units,
        units,
        remainingUnits: units,
        source: 'purchase' as const
      }];

      // First calculate lot-wise tax summary using the correct signature
      const lotWiseSummary = proposalCapitalGainsService.calculateLotWiseTax(
        holding.name || 'Holding',
        lots.map((lot: any) => ({
          id: lot.id || lot.lotId || 'lot-1',
          purchaseDate: lot.purchaseDate,
          purchaseNav: lot.purchaseNav || purchaseNav,
          purchaseValue: lot.purchaseValue || (lot.purchaseNav || purchaseNav) * (lot.units || units),
          units: lot.units || units,
          remainingUnits: lot.remainingUnits || lot.units || units,
          source: lot.source || 'purchase'
        })),
        currentNav,
        holding.productType || 'MUTUAL_FUND',
        holding.category,
        holding.isin,
        holding.schemeCode,
        undefined, // exitLoadDays - will use ISIN lookup
        undefined  // exitLoadPercent - will use ISIN lookup
      );

      // Then get optimized redemption plan
      const redemptionPlan = proposalCapitalGainsService.getOptimizedRedemptionPlan(
        lotWiseSummary,
        redemptionAmount,
        strategy
      );

      // Also get comprehensive tax details for context
      const taxDetails = await proposalCapitalGainsService.calculateHoldingTaxAsync(holding);

      res.json({
        holding: {
          name: holding.name,
          isin: holding.isin,
          currentValue: holding.currentValue,
          investedAmount: holding.investedAmount
        },
        redemptionAmount,
        strategy,
        lotWiseSummary: {
          totalLots: lotWiseSummary.lots.length,
          stcgLots: lotWiseSummary.stcgLots,
          ltcgLots: lotWiseSummary.ltcgLots,
          totalUnrealizedGain: lotWiseSummary.totalUnrealizedGain,
          totalEstimatedTax: lotWiseSummary.totalEstimatedTax,
          totalValue: lotWiseSummary.totalCurrentValue
        },
        redemptionPlan,
        currentTaxDetails: {
          taxType: taxDetails.taxType,
          holdingPeriodDays: taxDetails.holdingPeriodDays,
          exitLoad: taxDetails.exitLoad,
          exitLoadSource: taxDetails.exitLoadSource,
          daysToZeroExitLoad: taxDetails.daysToZeroExitLoad,
          grandfatheringApplied: taxDetails.grandfatheringApplied,
          grandfatheringBenefit: taxDetails.grandfatheringBenefit
        },
        comparison: {
          withCurrentStrategy: {
            totalTax: redemptionPlan.totalTax,
            totalExitLoad: redemptionPlan.totalExitLoad,
            totalCost: redemptionPlan.totalTax + redemptionPlan.totalExitLoad
          }
        }
      });
    } catch (error) {
      console.error("Error simulating redemption:", error);
      res.status(500).json({ error: "Failed to simulate redemption" });
    }
  });

  // Exit load status dashboard endpoint
  app.post("/api/capital-gains/exit-load-status", async (req, res) => {
    try {
      const { holdings } = req.body;

      if (!holdings || !Array.isArray(holdings)) {
        return res.status(400).json({ error: "Holdings array is required" });
      }

      const statusList = await Promise.all(holdings.map(async (holding: any) => {
        const taxDetails = await proposalCapitalGainsService.calculateHoldingTaxAsync(holding);
        const holdingPeriodDays = Math.floor(
          (Date.now() - new Date(holding.purchaseDate || Date.now()).getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          name: holding.name,
          isin: holding.isin,
          currentValue: holding.currentValue,
          holdingPeriodDays,
          exitLoadPercent: taxDetails.exitLoad > 0 ? (taxDetails.exitLoad / holding.currentValue) * 100 : 0,
          exitLoadAmount: taxDetails.exitLoad,
          exitLoadSource: taxDetails.exitLoadSource,
          daysToExitLoadFree: taxDetails.daysToZeroExitLoad,
          exitLoadFreeDate: taxDetails.daysToZeroExitLoad !== null 
            ? new Date(Date.now() + taxDetails.daysToZeroExitLoad * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            : null,
          isExitLoadFree: taxDetails.exitLoad === 0,
          taxType: taxDetails.taxType,
          unrealizedGain: taxDetails.unrealizedGain
        };
      }));

      // Sort by days to exit load free (soonest first)
      statusList.sort((a, b) => {
        if (a.daysToExitLoadFree === null) return 1;
        if (b.daysToExitLoadFree === null) return -1;
        return a.daysToExitLoadFree - b.daysToExitLoadFree;
      });

      const summary = {
        totalHoldings: statusList.length,
        exitLoadFree: statusList.filter(h => h.isExitLoadFree).length,
        withinExitLoadPeriod: statusList.filter(h => !h.isExitLoadFree).length,
        totalExitLoadExposure: statusList.reduce((sum, h) => sum + h.exitLoadAmount, 0),
        holdingsNearExitLoadExpiry: statusList.filter(h => h.daysToExitLoadFree !== null && h.daysToExitLoadFree <= 60).length
      };

      res.json({
        holdings: statusList,
        summary
      });
    } catch (error) {
      console.error("Error getting exit load status:", error);
      res.status(500).json({ error: "Failed to get exit load status" });
    }
  });

  console.log("✅ Capital Gains routes registered");
}
