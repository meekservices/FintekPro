import { Express, Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { capitalGainsReports, insertCapitalGainsReportSchema, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { proposalCapitalGainsService } from '../services/proposal-capital-gains-service';
import { realizedGainsAggregationService } from '../services/realized-gains-aggregation-service';
import { capitalGainsCalculator } from '../services/capital-gains-calculator';
import { requireAuth, requireRole } from '../middleware/roleMiddleware';
import { z } from 'zod';
import { sandboxITRService } from '../sandbox-itr-service';
import rateLimit from 'express-rate-limit';

const taxRegimeComparisonSchema = z.object({
  fiscalYear: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  salaryIncome: z.number().min(0).default(0),
  otherIncome: z.number().min(0).default(0),
  deductions80C: z.number().min(0).max(150000).default(0),
  deductions80D: z.number().min(0).max(100000).default(0),
  homeLoanInterest: z.number().min(0).default(0),
});

const itrAutoPopulateSchema = z.object({
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),
  assessmentYear: z.string().regex(/^\d{4}-\d{2}$/),
  fiscalYear: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

const taxApiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many tax API requests. Please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

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

  // ITR Schedule CG Export endpoint
  // Generates structured capital gains data for ITR Schedule CG filing
  // MODES:
  // - transactions: Use actual sale transactions with saleDate (for accurate ITR filing)
  // - holdings: Use current holdings with estimated gains (for planning/preview only)
  app.post("/api/capital-gains/itr-export", async (req, res) => {
    try {
      const { holdings, transactions, assessmentYear, panNumber } = req.body;

      if (!transactions && !holdings) {
        return res.status(400).json({ 
          error: "Either transactions (for actual ITR filing) or holdings (for estimates) is required",
          note: "For accurate ITR filing, use transactions array with saleDate for each item"
        });
      }

      const isEstimateMode = !transactions; // If using holdings, this is an estimate
      const assessYear = assessmentYear || getAssessmentYear();
      const source = transactions || holdings;

      // Categorize gains by asset type and term
      const equitySTCG: any[] = [];
      const equityLTCG: any[] = [];
      const debtSTCG: any[] = [];
      const debtLTCG: any[] = [];
      const otherAssets: any[] = [];

      for (const item of source) {
        const taxDetails = await proposalCapitalGainsService.calculateHoldingTaxAsync({
          name: item.name || item.schemeName,
          productType: item.productType || 'MUTUAL_FUND',
          category: item.category,
          isin: item.isin,
          currentValue: item.saleValue || item.currentValue,
          investedAmount: item.purchaseValue || item.investedAmount,
          purchaseDate: item.purchaseDate,
          quantity: item.units || item.quantity
        });

        const entry = {
          schemeName: item.name || item.schemeName,
          isin: item.isin,
          folioNumber: item.folioNumber,
          units: item.units || item.quantity,
          purchaseDate: item.purchaseDate,
          purchaseValue: item.purchaseValue || item.investedAmount,
          saleDate: item.saleDate || new Date().toISOString().split('T')[0],
          saleValue: item.saleValue || item.currentValue,
          capitalGain: taxDetails.unrealizedGain,
          holdingPeriodDays: taxDetails.holdingPeriodDays,
          taxType: taxDetails.taxType,
          taxAmount: taxDetails.estimatedTax,
          costOfAcquisition: item.purchaseValue || item.investedAmount,
          costOfImprovement: 0,
          exemptionClaimed: 0,
          netTaxableGain: taxDetails.unrealizedGain,
          grandfatheringApplied: taxDetails.grandfatheringApplied,
          grandfatheringBenefit: taxDetails.grandfatheringBenefit
        };

        // Check if it's equity or debt
        const isEquity = ['STOCK', 'EQUITY', 'ETF'].some(t => 
          (item.productType || '').toUpperCase().includes(t)
        ) || ['equity', 'large cap', 'mid cap', 'small cap', 'flexi cap', 'elss'].some(c =>
          (item.category || '').toLowerCase().includes(c)
        );

        if (isEquity) {
          if (taxDetails.taxType === 'STCG') {
            equitySTCG.push(entry);
          } else {
            equityLTCG.push(entry);
          }
        } else {
          if (taxDetails.taxType === 'STCG' || taxDetails.taxType === 'SLAB') {
            debtSTCG.push(entry);
          } else {
            debtLTCG.push(entry);
          }
        }
      }

      // Calculate totals
      const totalEquitySTCG = equitySTCG.reduce((sum, e) => sum + e.capitalGain, 0);
      const totalEquityLTCG = equityLTCG.reduce((sum, e) => sum + e.capitalGain, 0);
      const totalDebtSTCG = debtSTCG.reduce((sum, e) => sum + e.capitalGain, 0);
      const totalDebtLTCG = debtLTCG.reduce((sum, e) => sum + e.capitalGain, 0);

      // ITR Schedule CG format
      const scheduleCG = {
        assessmentYear: assessYear,
        panNumber: panNumber || 'XXXPX0000X',
        generatedAt: new Date().toISOString(),
        mode: isEstimateMode ? 'ESTIMATE' : 'ACTUAL',
        modeNote: isEstimateMode 
          ? 'This is an ESTIMATE based on current holdings. For actual ITR filing, provide transactions with saleDate.'
          : 'Based on actual sale transactions. Verify all values before filing.',
        
        // Section A1 - Short Term Capital Gain on equity shares (STT paid) - u/s 111A
        sectionA1_EquitySTCG: {
          description: 'Short Term Capital Gain on equity shares/units of equity oriented fund on which STT is paid',
          applicableSection: '111A',
          taxRate: '20%',
          transactions: equitySTCG,
          totalCostOfAcquisition: equitySTCG.reduce((sum, e) => sum + e.costOfAcquisition, 0),
          totalSaleConsideration: equitySTCG.reduce((sum, e) => sum + e.saleValue, 0),
          totalCapitalGain: totalEquitySTCG,
          lossSetOff: 0,
          netTaxableGain: Math.max(0, totalEquitySTCG)
        },

        // Section A2 - Long Term Capital Gain on equity shares (STT paid) - u/s 112A
        sectionA2_EquityLTCG: {
          description: 'Long Term Capital Gain on equity shares/units of equity oriented fund on which STT is paid',
          applicableSection: '112A',
          taxRate: '12.5%',
          exemptionLimit: 125000,
          transactions: equityLTCG,
          totalCostOfAcquisition: equityLTCG.reduce((sum, e) => sum + e.costOfAcquisition, 0),
          totalSaleConsideration: equityLTCG.reduce((sum, e) => sum + e.saleValue, 0),
          totalCapitalGain: totalEquityLTCG,
          exemptionClaimed: Math.min(125000, Math.max(0, totalEquityLTCG)),
          netTaxableGain: Math.max(0, totalEquityLTCG - 125000),
          grandfatheringBenefitApplied: equityLTCG.some(e => e.grandfatheringApplied)
        },

        // Section B - STCG on assets other than above (debt, gold, etc.)
        sectionB_OtherSTCG: {
          description: 'Short Term Capital Gain on assets other than those covered in Section A',
          applicableSection: 'Slab Rate/Special Rates',
          transactions: debtSTCG,
          totalCostOfAcquisition: debtSTCG.reduce((sum, e) => sum + e.costOfAcquisition, 0),
          totalSaleConsideration: debtSTCG.reduce((sum, e) => sum + e.saleValue, 0),
          totalCapitalGain: totalDebtSTCG,
          netTaxableGain: Math.max(0, totalDebtSTCG)
        },

        // Section C - LTCG on assets other than equity (with/without indexation)
        sectionC_OtherLTCG: (() => {
          // Apply indexation for eligible holdings (purchased before April 2023, held 3+ years)
          const indexationResults = debtLTCG.map(e => {
            const purchaseDate = new Date(e.purchaseDate);
            const isEligible = purchaseDate < new Date('2023-04-01') && e.holdingPeriodDays >= 1095;
            
            if (isEligible) {
              // Calculate indexed cost
              const indexResult = proposalCapitalGainsService.calculateIndexationBenefit({
                purchaseDate: e.purchaseDate,
                saleDate: e.saleDate,
                purchaseCost: e.costOfAcquisition,
                saleValue: e.saleValue,
                productType: 'DEBT',
                category: 'debt'
              });
              
              return {
                ...e,
                indexationApplied: true,
                indexedCost: indexResult.indexedCost,
                gainWithIndexation: indexResult.gainWithIndexation,
                taxWithIndexation: indexResult.taxWithIndexation
              };
            }
            return {
              ...e,
              indexationApplied: false,
              indexedCost: e.costOfAcquisition,
              gainWithIndexation: e.capitalGain,
              taxWithIndexation: Math.max(0, e.capitalGain) * 0.30 // Slab rate for non-eligible
            };
          });
          
          const eligibleCount = indexationResults.filter(r => r.indexationApplied).length;
          const totalIndexedGain = indexationResults.reduce((sum, r) => sum + r.gainWithIndexation, 0);
          const totalIndexedTax = indexationResults.reduce((sum, r) => sum + r.taxWithIndexation, 0);
          
          return {
            description: 'Long Term Capital Gain on assets other than those covered in Section A',
            applicableSection: '112/Slab Rate',
            transactions: indexationResults,
            totalCostOfAcquisition: debtLTCG.reduce((sum, e) => sum + e.costOfAcquisition, 0),
            totalIndexedCost: indexationResults.reduce((sum, r) => sum + r.indexedCost, 0),
            totalSaleConsideration: debtLTCG.reduce((sum, e) => sum + e.saleValue, 0),
            totalCapitalGain: totalDebtLTCG,
            totalGainWithIndexation: totalIndexedGain,
            indexationEligible: eligibleCount,
            netTaxableGain: Math.max(0, totalIndexedGain),
            estimatedTax: totalIndexedTax
          };
        })(),

        // Summary
        summary: (() => {
          // Recalculate debt LTCG with indexation
          let debtLTCGTaxableGain = 0;
          let debtLTCGTax = 0;
          
          for (const e of debtLTCG) {
            const purchaseDate = new Date(e.purchaseDate);
            const isEligible = purchaseDate < new Date('2023-04-01') && e.holdingPeriodDays >= 1095;
            
            if (isEligible) {
              const indexResult = proposalCapitalGainsService.calculateIndexationBenefit({
                purchaseDate: e.purchaseDate,
                saleDate: e.saleDate,
                purchaseCost: e.costOfAcquisition,
                saleValue: e.saleValue,
                productType: 'DEBT',
                category: 'debt'
              });
              debtLTCGTaxableGain += indexResult.gainWithIndexation;
              debtLTCGTax += indexResult.taxWithIndexation;
            } else {
              debtLTCGTaxableGain += e.capitalGain;
              debtLTCGTax += Math.max(0, e.capitalGain) * 0.30;
            }
          }
          
          return {
            totalSTCG: totalEquitySTCG + totalDebtSTCG,
            totalLTCG: totalEquityLTCG + totalDebtLTCG,
            totalCapitalGains: totalEquitySTCG + totalDebtSTCG + totalEquityLTCG + totalDebtLTCG,
            equityLTCGExemption: Math.min(125000, Math.max(0, totalEquityLTCG)),
            netTaxableCapitalGains: 
              Math.max(0, totalEquitySTCG) +
              Math.max(0, totalEquityLTCG - 125000) +
              Math.max(0, totalDebtSTCG) +
              Math.max(0, debtLTCGTaxableGain),
            estimatedTax: {
              onEquitySTCG: Math.max(0, totalEquitySTCG) * 0.20,
              onEquityLTCG: Math.max(0, totalEquityLTCG - 125000) * 0.125,
              onDebtSTCG: Math.max(0, totalDebtSTCG) * 0.30,
              onDebtLTCG: debtLTCGTax,
              total: 
                Math.max(0, totalEquitySTCG) * 0.20 +
                Math.max(0, totalEquityLTCG - 125000) * 0.125 +
                Math.max(0, totalDebtSTCG) * 0.30 +
                debtLTCGTax
            }
          };
        })()
      };

      res.json(scheduleCG);
    } catch (error) {
      console.error("Error generating ITR Schedule CG export:", error);
      res.status(500).json({ error: "Failed to generate ITR Schedule CG export" });
    }
  });

  // Helper function to get current assessment year
  function getAssessmentYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // If between April and December, assessment year is next year
    // If between January and March, assessment year is current year
    if (month >= 3) { // April onwards
      return `${year + 1}-${(year + 2).toString().slice(2)}`;
    } else {
      return `${year}-${(year + 1).toString().slice(2)}`;
    }
  }

  // Indexation benefit calculator endpoint
  app.post("/api/capital-gains/indexation-benefit", async (req, res) => {
    try {
      const { purchaseDate, saleDate, purchaseCost, saleValue, productType, category } = req.body;

      if (!purchaseDate || !purchaseCost || !saleValue || !productType) {
        return res.status(400).json({ 
          error: "purchaseDate, purchaseCost, saleValue, and productType are required" 
        });
      }

      const result = proposalCapitalGainsService.calculateIndexationBenefit({
        purchaseDate,
        saleDate,
        purchaseCost,
        saleValue,
        productType,
        category
      });

      res.json(result);
    } catch (error) {
      console.error("Error calculating indexation benefit:", error);
      res.status(500).json({ error: "Failed to calculate indexation benefit" });
    }
  });

  // Exit load calendar view endpoint
  // Shows timeline of when each holding becomes exit-load-free
  app.post("/api/capital-gains/exit-load-calendar", async (req, res) => {
    try {
      const { holdings, months = 12 } = req.body;

      if (!holdings || !Array.isArray(holdings)) {
        return res.status(400).json({ error: "Holdings array is required" });
      }

      // Calculate exit load status for each holding
      const holdingsWithDates = await Promise.all(holdings.map(async (holding: any) => {
        const taxDetails = await proposalCapitalGainsService.calculateHoldingTaxAsync(holding);
        const purchaseDate = new Date(holding.purchaseDate || Date.now());
        
        let exitLoadFreeDate: Date | null = null;
        if (taxDetails.daysToZeroExitLoad !== null && taxDetails.daysToZeroExitLoad > 0) {
          exitLoadFreeDate = new Date(Date.now() + taxDetails.daysToZeroExitLoad * 24 * 60 * 60 * 1000);
        } else if (taxDetails.exitLoad === 0) {
          // Already exit load free
          exitLoadFreeDate = null; // null means already free
        }

        // Calculate LTCG eligible date based on product type
        const holdingPeriodDays = Math.floor((Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Determine LTCG threshold based on product type, purchase date, and regime
        // - Equity: Always 365 days (1 year)
        // - Debt purchased BEFORE April 2023: 1095 days (3 years) with indexation benefit
        // - Debt purchased AFTER April 2023: 730 days (2 years) under new rules, but taxed at slab
        // - Gold/Silver: 730 days (2 years) post-July 2024
        const isEquity = ['STOCK', 'EQUITY', 'ETF'].some(t => 
          (holding.productType || '').toUpperCase().includes(t)
        ) || ['equity', 'large cap', 'mid cap', 'small cap', 'flexi cap', 'elss'].some(c =>
          (holding.category || '').toLowerCase().includes(c)
        );
        
        const isDebt = ['DEBT', 'BOND', 'LIQUID', 'GILT'].some(t =>
          (holding.productType || '').toUpperCase().includes(t)
        ) || ['debt', 'bond', 'liquid', 'money market', 'corporate', 'banking psu'].some(c =>
          (holding.category || '').toLowerCase().includes(c)
        );
        
        const isGold = ['GOLD', 'SILVER'].some(t =>
          (holding.productType || '').toUpperCase().includes(t)
        ) || ['gold', 'silver', 'commodity'].some(c =>
          (holding.category || '').toLowerCase().includes(c)
        );
        
        const indexationCutoff = new Date('2023-04-01');
        let ltcgThreshold = 365; // Default for equity
        
        if (isDebt) {
          // Check if purchased before April 2023 (eligible for 3-year LTCG with indexation)
          if (purchaseDate < indexationCutoff) {
            ltcgThreshold = 1095; // 3 years for pre-April 2023 debt
          } else {
            ltcgThreshold = 730; // 2 years for post-April 2023 debt (but slab rate)
          }
        } else if (isGold) {
          ltcgThreshold = 730; // 2 years for gold/silver
        }
        
        let ltcgEligibleDate: Date | null = null;
        if (holdingPeriodDays < ltcgThreshold) {
          ltcgEligibleDate = new Date(purchaseDate.getTime() + ltcgThreshold * 24 * 60 * 60 * 1000);
        }
        
        // Calculate exit load percent from amount
        // taxDetails.exitLoad is the amount, so we calculate percent as (amount / value * 100)
        const exitLoadPercent = holding.currentValue > 0 ? (taxDetails.exitLoad / holding.currentValue * 100) : 0;

        return {
          name: holding.name,
          isin: holding.isin,
          currentValue: holding.currentValue,
          purchaseDate: purchaseDate.toISOString().split('T')[0],
          productType: holding.productType,
          category: holding.category,
          isExitLoadFree: taxDetails.exitLoad === 0,
          exitLoadFreeDate: exitLoadFreeDate ? exitLoadFreeDate.toISOString().split('T')[0] : null,
          daysToExitLoadFree: taxDetails.daysToZeroExitLoad,
          exitLoadPercent: Math.round(exitLoadPercent * 100) / 100, // Rounded to 2 decimals
          currentExitLoadAmount: taxDetails.exitLoad,
          exitLoadSource: taxDetails.exitLoadSource,
          isLTCGEligible: taxDetails.taxType === 'LTCG',
          ltcgThresholdDays: ltcgThreshold,
          ltcgEligibleDate: ltcgEligibleDate ? ltcgEligibleDate.toISOString().split('T')[0] : null,
          daysToLTCG: ltcgEligibleDate ? Math.ceil((ltcgEligibleDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
          taxType: taxDetails.taxType
        };
      }));

      // Generate calendar view
      const today = new Date();
      const calendar: Record<string, any[]> = {};
      
      // Initialize months
      for (let i = 0; i < months; i++) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        calendar[monthKey] = [];
      }

      // Add holdings to calendar based on their exit load free dates
      for (const holding of holdingsWithDates) {
        if (holding.exitLoadFreeDate) {
          const exitDate = new Date(holding.exitLoadFreeDate);
          const monthKey = `${exitDate.getFullYear()}-${String(exitDate.getMonth() + 1).padStart(2, '0')}`;
          if (calendar[monthKey]) {
            calendar[monthKey].push({
              type: 'exit_load_free',
              date: holding.exitLoadFreeDate,
              name: holding.name,
              isin: holding.isin,
              currentValue: holding.currentValue,
              exitLoadSaved: holding.currentExitLoadAmount
            });
          }
        }
        
        if (holding.ltcgEligibleDate) {
          const ltcgDate = new Date(holding.ltcgEligibleDate);
          const monthKey = `${ltcgDate.getFullYear()}-${String(ltcgDate.getMonth() + 1).padStart(2, '0')}`;
          if (calendar[monthKey]) {
            calendar[monthKey].push({
              type: 'ltcg_eligible',
              date: holding.ltcgEligibleDate,
              name: holding.name,
              isin: holding.isin,
              currentValue: holding.currentValue
            });
          }
        }
      }

      // Sort events within each month by date
      for (const monthKey of Object.keys(calendar)) {
        calendar[monthKey].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }

      // Summary
      const summary = {
        totalHoldings: holdings.length,
        alreadyExitLoadFree: holdingsWithDates.filter(h => h.isExitLoadFree).length,
        pendingExitLoadFree: holdingsWithDates.filter(h => !h.isExitLoadFree).length,
        alreadyLTCGEligible: holdingsWithDates.filter(h => h.isLTCGEligible).length,
        pendingLTCGEligible: holdingsWithDates.filter(h => !h.isLTCGEligible).length,
        totalPendingExitLoad: holdingsWithDates.reduce((sum, h) => sum + (h.currentExitLoadAmount || 0), 0),
        upcomingEvents: Object.values(calendar).flat().length
      };

      res.json({
        holdings: holdingsWithDates,
        calendar,
        summary
      });
    } catch (error) {
      console.error("Error generating exit load calendar:", error);
      res.status(500).json({ error: "Failed to generate exit load calendar" });
    }
  });

  // Batch indexation benefit calculator for multiple holdings
  app.post("/api/capital-gains/indexation-benefit/batch", async (req, res) => {
    try {
      const { holdings, saleDate } = req.body;

      if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
        return res.status(400).json({ error: "Holdings array is required" });
      }

      const results = holdings.map((holding: any) => ({
        name: holding.name,
        isin: holding.isin,
        ...proposalCapitalGainsService.calculateIndexationBenefit({
          purchaseDate: holding.purchaseDate,
          saleDate: saleDate || new Date(),
          purchaseCost: holding.investedAmount || holding.purchaseCost,
          saleValue: holding.currentValue || holding.saleValue,
          productType: holding.productType,
          category: holding.category
        })
      }));

      const eligibleHoldings = results.filter((r: any) => r.eligible);
      const totalTaxSavings = eligibleHoldings.reduce((sum: number, r: any) => sum + r.taxSavingsFromIndexation, 0);

      res.json({
        holdings: results,
        summary: {
          totalHoldings: results.length,
          eligibleForIndexation: eligibleHoldings.length,
          notEligible: results.length - eligibleHoldings.length,
          totalPotentialTaxSavings: Math.round(totalTaxSavings * 100) / 100
        }
      });
    } catch (error) {
      console.error("Error calculating batch indexation benefit:", error);
      res.status(500).json({ error: "Failed to calculate indexation benefit" });
    }
  });

  app.get("/api/advance-tax/status", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const fiscalYear = req.query.fiscalYear as string | undefined;
      const status = await realizedGainsAggregationService.getAdvanceTaxStatus(req.user.id, fiscalYear);

      res.json(status);
    } catch (error) {
      console.error("Error fetching advance tax status:", error);
      res.status(500).json({ error: "Failed to fetch advance tax status" });
    }
  });

  app.get("/api/capital-gains/realized", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const fiscalYear = req.query.fiscalYear as string | undefined;
      const gains = await realizedGainsAggregationService.aggregateRealizedGains(req.user.id, fiscalYear);

      res.json(gains);
    } catch (error) {
      console.error("Error fetching realized gains:", error);
      res.status(500).json({ error: "Failed to fetch realized gains" });
    }
  });

  app.get("/api/capital-gains/combined", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const fiscalYear = req.query.fiscalYear as string | undefined;
      const combined = await capitalGainsCalculator.getCombinedGains(req.user.id, fiscalYear);

      res.json(combined);
    } catch (error) {
      console.error("Error fetching combined gains:", error);
      res.status(500).json({ error: "Failed to fetch combined capital gains" });
    }
  });

  app.post("/api/capital-gains/itr-export-actual", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { assessmentYear, panNumber, fiscalYear } = req.body;
      const fy = fiscalYear || realizedGainsAggregationService.getCurrentFiscalYear();
      const assessYear = assessmentYear || getAssessmentYear();

      const gains = await realizedGainsAggregationService.aggregateRealizedGains(req.user.id, fy);

      if (gains.trades.length === 0) {
        return res.json({
          mode: 'ACTUAL',
          fiscalYear: fy,
          assessmentYear: assessYear,
          panNumber: panNumber || 'XXXPX0000X',
          message: 'No realized capital gains found for this fiscal year',
          generatedAt: new Date().toISOString(),
          sectionA1_EquitySTCG: { totalCapitalGain: 0, netTaxableGain: 0, transactions: [] },
          sectionA2_EquityLTCG: { totalCapitalGain: 0, netTaxableGain: 0, transactions: [] },
          sectionB_OtherSTCG: { totalCapitalGain: 0, netTaxableGain: 0, transactions: [] },
          sectionC_OtherLTCG: { totalCapitalGain: 0, netTaxableGain: 0, transactions: [] },
          summary: {
            totalRealizedGains: 0,
            totalSTCG: 0,
            totalLTCG: 0,
            totalTaxLiability: 0
          }
        });
      }

      const equitySTCG: any[] = [];
      const equityLTCG: any[] = [];
      const debtSTCG: any[] = [];
      const debtLTCG: any[] = [];

      for (const trade of gains.trades) {
        const entry = {
          orderId: trade.orderId,
          schemeName: trade.schemeName,
          isin: trade.isin,
          saleDate: trade.saleDate,
          gainType: trade.gainType,
          realizedGain: trade.realizedGain,
          taxableGain: trade.taxableGain,
          estimatedTax: trade.estimatedTax,
        };

        if (trade.gainType === 'STCG') {
          equitySTCG.push(entry);
        } else {
          equityLTCG.push(entry);
        }
      }

      const totalEquitySTCG = equitySTCG.reduce((sum, e) => sum + e.realizedGain, 0);
      const totalEquityLTCG = equityLTCG.reduce((sum, e) => sum + e.realizedGain, 0);

      res.json({
        mode: 'ACTUAL',
        fiscalYear: fy,
        assessmentYear: assessYear,
        panNumber: panNumber || 'XXXPX0000X',
        generatedAt: new Date().toISOString(),

        sectionA1_EquitySTCG: {
          description: 'Short Term Capital Gain on equity shares/units on which STT is paid',
          applicableSection: '111A',
          taxRate: '20%',
          transactions: equitySTCG,
          totalCapitalGain: totalEquitySTCG,
          netTaxableGain: Math.max(0, totalEquitySTCG)
        },

        sectionA2_EquityLTCG: {
          description: 'Long Term Capital Gain on equity shares/units on which STT is paid',
          applicableSection: '112A',
          taxRate: '12.5%',
          exemptionLimit: 125000,
          transactions: equityLTCG,
          totalCapitalGain: totalEquityLTCG,
          exemptionClaimed: Math.min(125000, Math.max(0, totalEquityLTCG)),
          netTaxableGain: Math.max(0, totalEquityLTCG - 125000)
        },

        sectionB_OtherSTCG: {
          description: 'Short Term Capital Gain on assets other than equity',
          transactions: debtSTCG,
          totalCapitalGain: 0,
          netTaxableGain: 0
        },

        sectionC_OtherLTCG: {
          description: 'Long Term Capital Gain on assets other than equity',
          transactions: debtLTCG,
          totalCapitalGain: 0,
          netTaxableGain: 0
        },

        summary: {
          totalRealizedGains: gains.totalRealizedGains,
          totalSTCG: gains.stcg.total,
          totalLTCG: gains.ltcg.total,
          totalTaxLiability: gains.totalTaxLiability,
          tradesCount: gains.trades.length
        },

        quarterlyBreakdown: gains.quarterlyBreakdown
      });
    } catch (error) {
      console.error("Error generating actual ITR export:", error);
      res.status(500).json({ error: "Failed to generate ITR export from realized gains" });
    }
  });

  app.post("/api/tax/regime-comparison", 
    requireAuth,
    requireRole('user', 'client', 'agent', 'admin'),
    taxApiRateLimiter,
    async (req: Request, res: Response) => {
    try {
      const validationResult = taxRegimeComparisonSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationResult.error.errors
        });
      }

      const { salaryIncome, otherIncome, deductions80C, deductions80D, homeLoanInterest, fiscalYear } = validationResult.data;
      const fy = fiscalYear || realizedGainsAggregationService.getCurrentFiscalYear();

      const gains = await realizedGainsAggregationService.aggregateRealizedGains(req.user!.id, fy);

      const totalCapitalGains = gains.totalRealizedGains || 0;
      const stcg = gains.stcg?.total || 0;
      const ltcg = gains.ltcg?.total || 0;
      
      const totalNonCGIncome = salaryIncome + otherIncome;

      const oldRegimeTotalDeductions = deductions80C + deductions80D + homeLoanInterest + 50000;
      const oldRegimeTaxableNonCG = Math.max(0, totalNonCGIncome - oldRegimeTotalDeductions);
      
      let oldRegimeIncomeTax = 0;
      if (oldRegimeTaxableNonCG > 250000) {
        if (oldRegimeTaxableNonCG <= 500000) {
          oldRegimeIncomeTax = (oldRegimeTaxableNonCG - 250000) * 0.05;
        } else if (oldRegimeTaxableNonCG <= 1000000) {
          oldRegimeIncomeTax = 12500 + (oldRegimeTaxableNonCG - 500000) * 0.20;
        } else {
          oldRegimeIncomeTax = 112500 + (oldRegimeTaxableNonCG - 1000000) * 0.30;
        }
      }

      const newRegimeStandardDeduction = 75000;
      const newRegimeTaxableNonCG = Math.max(0, totalNonCGIncome - newRegimeStandardDeduction);
      
      let newRegimeIncomeTax = 0;
      if (newRegimeTaxableNonCG > 300000) {
        if (newRegimeTaxableNonCG <= 700000) {
          newRegimeIncomeTax = (newRegimeTaxableNonCG - 300000) * 0.05;
        } else if (newRegimeTaxableNonCG <= 1000000) {
          newRegimeIncomeTax = 20000 + (newRegimeTaxableNonCG - 700000) * 0.10;
        } else if (newRegimeTaxableNonCG <= 1200000) {
          newRegimeIncomeTax = 50000 + (newRegimeTaxableNonCG - 1000000) * 0.15;
        } else if (newRegimeTaxableNonCG <= 1500000) {
          newRegimeIncomeTax = 80000 + (newRegimeTaxableNonCG - 1200000) * 0.20;
        } else {
          newRegimeIncomeTax = 140000 + (newRegimeTaxableNonCG - 1500000) * 0.30;
        }
      }

      const stcgTax = Math.max(0, stcg) * 0.20;
      const ltcgExemption = 125000;
      const ltcgTaxable = Math.max(0, ltcg - ltcgExemption);
      const ltcgTax = ltcgTaxable * 0.125;
      const capitalGainsTax = stcgTax + ltcgTax;

      const oldRegimeTotalTax = oldRegimeIncomeTax + capitalGainsTax;
      const newRegimeTotalTax = newRegimeIncomeTax + capitalGainsTax;
      
      const oldRegimeCess = oldRegimeTotalTax * 0.04;
      const newRegimeCess = newRegimeTotalTax * 0.04;
      
      const oldRegimeFinalTax = oldRegimeTotalTax + oldRegimeCess;
      const newRegimeFinalTax = newRegimeTotalTax + newRegimeCess;

      const taxSavings = Math.abs(oldRegimeFinalTax - newRegimeFinalTax);
      const recommendedRegime = newRegimeFinalTax <= oldRegimeFinalTax ? 'new' : 'old';

      let recommendation = '';
      if (recommendedRegime === 'new') {
        recommendation = `The New Tax Regime saves you ₹${taxSavings.toLocaleString('en-IN')}. It's beneficial since your deductions (₹${(deductions80C + deductions80D + homeLoanInterest).toLocaleString('en-IN')}) are below the break-even threshold.`;
      } else {
        recommendation = `The Old Tax Regime saves you ₹${taxSavings.toLocaleString('en-IN')}. Your deductions (₹${(deductions80C + deductions80D + homeLoanInterest).toLocaleString('en-IN')}) make it more beneficial than the new regime.`;
      }

      console.log(`[TaxRegimeComparison] User ${req.user!.id}: Old=${oldRegimeFinalTax.toFixed(2)}, New=${newRegimeFinalTax.toFixed(2)}, Recommended=${recommendedRegime}`);

      res.json({
        fiscalYear: fy,
        comparison: {
          oldRegime: {
            taxableIncome: oldRegimeTaxableNonCG,
            incomeTax: oldRegimeIncomeTax,
            capitalGainsTax,
            cess: oldRegimeCess,
            totalTax: oldRegimeFinalTax,
            deductionsClaimed: oldRegimeTotalDeductions,
            breakdown: {
              section80C: deductions80C,
              section80D: deductions80D,
              homeLoanInterest,
              standardDeduction: 50000
            }
          },
          newRegime: {
            taxableIncome: newRegimeTaxableNonCG,
            incomeTax: newRegimeIncomeTax,
            capitalGainsTax,
            cess: newRegimeCess,
            totalTax: newRegimeFinalTax,
            deductionsClaimed: newRegimeStandardDeduction,
            breakdown: {
              standardDeduction: newRegimeStandardDeduction,
              note: 'No chapter VI-A deductions allowed under new regime'
            }
          }
        },
        capitalGainsBreakdown: {
          stcg: { amount: stcg, taxRate: '20%', tax: stcgTax },
          ltcg: { amount: ltcg, exemption: ltcgExemption, taxable: ltcgTaxable, taxRate: '12.5%', tax: ltcgTax },
          totalTax: capitalGainsTax
        },
        recommendation: {
          regime: recommendedRegime,
          savings: taxSavings,
          explanation: recommendation
        }
      });
    } catch (error) {
      console.error("Error in tax regime comparison:", error);
      res.status(500).json({ error: "Failed to compare tax regimes" });
    }
  });

  app.post("/api/itr/auto-populate",
    requireAuth,
    requireRole('user', 'client', 'agent', 'admin'),
    taxApiRateLimiter,
    async (req: Request, res: Response) => {
    try {
      const validationResult = itrAutoPopulateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationResult.error.errors
        });
      }

      const { panNumber, assessmentYear, fiscalYear } = validationResult.data;
      const fy = fiscalYear || realizedGainsAggregationService.getCurrentFiscalYear();

      const gains = await realizedGainsAggregationService.aggregateRealizedGains(req.user!.id, fy);

      const stcgEquity = gains.stcg?.equity || 0;
      const ltcgEquity = gains.ltcg?.equity || 0;
      const ltcgGrandfathered = gains.ltcg?.equityWithGrandfathering || 0;

      const scheduleCGData = {
        panNumber,
        assessmentYear,
        fiscalYear: fy,
        generatedAt: new Date().toISOString(),
        
        shortTermCapitalGains111A: {
          section: '111A',
          description: 'STCG on sale of listed equity shares/units of equity oriented MF where STT paid',
          fullValueOfConsideration: gains.trades
            .filter(t => t.gainType === 'STCG')
            .reduce((sum, t) => sum + (t.taxableGain + (t.realizedGain - t.taxableGain)), 0),
          costOfAcquisition: gains.trades
            .filter(t => t.gainType === 'STCG')
            .reduce((sum, t) => sum + (t.realizedGain - t.taxableGain), 0),
          capitalGain: stcgEquity,
          taxRate: 20
        },
        
        longTermCapitalGains112A: {
          section: '112A',
          description: 'LTCG on sale of listed equity shares/units of equity oriented MF where STT paid',
          fullValueOfConsideration: gains.trades
            .filter(t => t.gainType === 'LTCG')
            .reduce((sum, t) => sum + (t.taxableGain + (t.realizedGain - t.taxableGain)), 0),
          costOfAcquisition: gains.trades
            .filter(t => t.gainType === 'LTCG')
            .reduce((sum, t) => sum + (t.realizedGain - t.taxableGain), 0),
          capitalGain: ltcgEquity + ltcgGrandfathered,
          grandfatheringBenefitApplied: ltcgGrandfathered > 0,
          exemptionUnder112A: Math.min(125000, Math.max(0, ltcgEquity + ltcgGrandfathered)),
          netTaxableGain: Math.max(0, ltcgEquity + ltcgGrandfathered - 125000),
          taxRate: 12.5
        },
        
        summary: {
          totalSTCG: stcgEquity,
          totalLTCG: ltcgEquity + ltcgGrandfathered,
          ltcgExemption: Math.min(125000, Math.max(0, ltcgEquity + ltcgGrandfathered)),
          netTaxableLTCG: Math.max(0, ltcgEquity + ltcgGrandfathered - 125000),
          estimatedTax: gains.totalTaxLiability,
          tradesCount: gains.trades.length
        },

        itrForm: sandboxITRService.getSuitableITRForm({
          salaryIncome: 0,
          businessIncome: 0,
          capitalGains: stcgEquity + ltcgEquity + ltcgGrandfathered,
          otherIncome: 0,
          interestIncome: 0,
          rentalIncome: 0,
          dividendIncome: 0
        }, 'individual'),

        trades: gains.trades.map(t => ({
          orderId: t.orderId,
          schemeName: t.schemeName,
          isin: t.isin,
          saleDate: t.saleDate,
          gainType: t.gainType,
          realizedGain: t.realizedGain,
          taxableGain: t.taxableGain
        }))
      };

      console.log(`[ITRAutoPopulate] Generated Schedule CG for PAN ${panNumber}, AY ${assessmentYear}, ${gains.trades.length} trades`);

      res.json({
        success: true,
        data: scheduleCGData
      });
    } catch (error) {
      console.error("Error in ITR auto-populate:", error);
      res.status(500).json({ error: "Failed to auto-populate ITR data" });
    }
  });

  app.post("/api/tax/pnl-report",
    requireAuth,
    requireRole('user', 'client', 'agent', 'admin'),
    taxApiRateLimiter,
    async (req: Request, res: Response) => {
    try {
      const { fiscalYear, format = 'json' } = req.body;
      const fy = fiscalYear || realizedGainsAggregationService.getCurrentFiscalYear();

      const gains = await realizedGainsAggregationService.aggregateRealizedGains(req.user!.id, fy);

      const pnlReport = {
        reportType: 'Tax P&L Statement',
        fiscalYear: fy,
        generatedAt: new Date().toISOString(),
        generatedFor: req.user!.id,

        summary: {
          totalRealizedGains: gains.totalRealizedGains,
          shortTermGains: gains.stcg.total,
          longTermGains: gains.ltcg.total,
          totalTaxLiability: gains.totalTaxLiability,
          numberOfTrades: gains.trades.length
        },

        shortTermCapitalGains: {
          equity: gains.stcg.equity,
          debt: gains.stcg.debtPreApr2023 + gains.stcg.debtPostApr2023,
          others: gains.stcg.others,
          total: gains.stcg.total,
          taxRate: '20%',
          taxAmount: Math.max(0, gains.stcg.total) * 0.20
        },

        longTermCapitalGains: {
          equity: gains.ltcg.equity,
          equityWithGrandfathering: gains.ltcg.equityWithGrandfathering,
          debtWithIndexation: gains.ltcg.debtWithIndexation,
          debtWithoutIndexation: gains.ltcg.debtWithoutIndexation,
          others: gains.ltcg.others,
          total: gains.ltcg.total,
          exemption: Math.min(125000, Math.max(0, gains.ltcg.total)),
          taxableAmount: Math.max(0, gains.ltcg.total - 125000),
          taxRate: '12.5%',
          taxAmount: Math.max(0, gains.ltcg.total - 125000) * 0.125
        },

        transactionDetails: gains.trades.map(trade => ({
          orderId: trade.orderId,
          security: trade.schemeName,
          isin: trade.isin,
          saleDate: trade.saleDate,
          holdingPeriod: trade.gainType === 'LTCG' ? 'Long Term (>365 days)' : 'Short Term (<=365 days)',
          realizedGain: trade.realizedGain,
          taxableGain: trade.taxableGain,
          estimatedTax: trade.estimatedTax
        })),

        quarterlyAdvanceTax: gains.quarterlyBreakdown,

        disclaimer: 'This report is for informational purposes. Please verify all calculations with a qualified tax professional before filing.'
      };

      console.log(`[TaxPnLReport] Generated for user ${req.user!.id}, FY ${fy}, format: ${format}`);

      res.json({
        success: true,
        format,
        data: pnlReport
      });
    } catch (error) {
      console.error("Error generating Tax P&L report:", error);
      res.status(500).json({ error: "Failed to generate Tax P&L report" });
    }
  });

  app.post("/api/advance-tax/validate",
    requireAuth,
    requireRole('user', 'client', 'agent', 'admin'),
    taxApiRateLimiter,
    async (req: Request, res: Response) => {
    try {
      const { fiscalYear } = req.body;
      const fy = fiscalYear || realizedGainsAggregationService.getCurrentFiscalYear();

      const gains = await realizedGainsAggregationService.aggregateRealizedGains(req.user!.id, fy);
      const advanceTaxStatus = await realizedGainsAggregationService.getAdvanceTaxStatus(req.user!.id, fy);

      const fintekProCalculation = {
        stcg: gains.stcg.total,
        ltcg: gains.ltcg.total,
        ltcgExemption: Math.min(125000, Math.max(0, gains.ltcg.total)),
        totalTaxLiability: gains.totalTaxLiability,
        quarters: advanceTaxStatus.quarters
      };

      const stcgTax = Math.max(0, gains.stcg.total) * 0.20;
      const ltcgTaxable = Math.max(0, gains.ltcg.total - 125000);
      const ltcgTax = ltcgTaxable * 0.125;
      const expectedTotal = stcgTax + ltcgTax;

      const discrepancy = Math.abs(gains.totalTaxLiability - expectedTotal);
      const isConsistent = discrepancy < 1;

      const validationResult = {
        fiscalYear: fy,
        fintekProCalculation,
        
        crossCheck: {
          expectedTotalTax: expectedTotal,
          calculatedTotalTax: gains.totalTaxLiability,
          discrepancy,
          isConsistent,
          validatedAt: new Date().toISOString()
        },

        advanceTaxSchedule: {
          q1: { dueDate: `${fy.split('-')[0]}-06-15`, percentage: 15, status: advanceTaxStatus.quarters[0]?.status },
          q2: { dueDate: `${fy.split('-')[0]}-09-15`, percentage: 45, status: advanceTaxStatus.quarters[1]?.status },
          q3: { dueDate: `${fy.split('-')[0]}-12-15`, percentage: 75, status: advanceTaxStatus.quarters[2]?.status },
          q4: { dueDate: `${parseInt(fy.split('-')[0]) + 1}-03-15`, percentage: 100, status: advanceTaxStatus.quarters[3]?.status }
        },

        warnings: !isConsistent ? [
          `Calculation discrepancy of ₹${discrepancy.toFixed(2)} detected. Please review transaction data.`
        ] : []
      };

      if (!isConsistent) {
        console.warn(`[AdvanceTaxValidation] Discrepancy for user ${req.user!.id}: Expected ${expectedTotal.toFixed(2)}, Got ${gains.totalTaxLiability.toFixed(2)}`);
      }

      res.json({
        success: true,
        validation: validationResult
      });
    } catch (error) {
      console.error("Error validating advance tax:", error);
      res.status(500).json({ error: "Failed to validate advance tax calculations" });
    }
  });

  /**
   * FIX SPEC SECTION 4.4 & 5.3: Lot Validation Endpoint
   * Validates lots before allowing tax/exit load calculations
   * HARD BLOCKER: Returns capitalGainsEnabled=false if dates are missing
   */
  app.post("/api/capital-gains/validate-lots", requireAuth, async (req: Request, res: Response) => {
    try {
      const { lots } = req.body;
      
      if (!lots || !Array.isArray(lots)) {
        return res.json({
          success: true,
          validation: {
            isValid: false,
            capitalGainsEnabled: false,
            exitLoadEnabled: false,
            validationErrors: ['No lots provided'],
            disabledReason: 'Transaction lots are required for tax calculations'
          }
        });
      }

      const validation = capitalGainsCalculator.validateLotsForTax(lots);
      
      res.json({
        success: true,
        validation,
        complianceNote: "Capital gains and exit load calculations are based on transaction-level data from the client's CAS statement and FIFO methodology, as per Indian tax regulations."
      });
    } catch (error) {
      console.error("Error validating lots:", error);
      res.status(500).json({ error: "Failed to validate lots" });
    }
  });

  /**
   * FIX SPEC SECTION 4.2: Tax Calculation Validation (DSP Healthcare Test)
   * Returns LTCG/STCG units breakdown for validation
   * 
   * DSP Healthcare Example (Fix Spec Section 4.2):
   * - Lot 1: 07-Oct-2024, 4974.876 units
   * - Lot 2: 29-Oct-2024, 4966.475 units
   * - If saleDate = 2025-10-20: Lot 1 = LTCG (378 days), Lot 2 = STCG (356 days) = Mixed
   */
  app.post("/api/capital-gains/calculate-tax-breakdown", requireAuth, async (req: Request, res: Response) => {
    try {
      const { lots, saleDate } = req.body;
      
      // First validate lots (hard blocker per Section 4.4)
      const validation = capitalGainsCalculator.validateLotsForTax(lots || []);
      if (!validation.isValid) {
        return res.json({
          success: false,
          error: validation.disabledReason,
          capitalGainsEnabled: false,
          validation
        });
      }

      // Pass saleDate for accurate STCG/LTCG calculation at redemption time
      const taxBreakdown = capitalGainsCalculator.validateTaxCalculation(lots, saleDate);
      
      res.json({
        success: true,
        taxBreakdown,
        summary: {
          totalLots: lots.length,
          ltcgUnits: taxBreakdown.ltcgUnits,
          stcgUnits: taxBreakdown.stcgUnits,
          taxStatus: taxBreakdown.ltcgUnits > 0 && taxBreakdown.stcgUnits > 0 ? 'Mixed' :
                    taxBreakdown.ltcgUnits > 0 ? 'All LTCG' : 'All STCG',
          referenceDate: taxBreakdown.referenceDate
        },
        complianceNote: "FIFO lot-wise calculation per Indian equity mutual fund tax regulations."
      });
    } catch (error) {
      console.error("Error calculating tax breakdown:", error);
      res.status(500).json({ error: "Failed to calculate tax breakdown" });
    }
  });

  /**
   * FIX SPEC SECTION 5.2: FIFO Partial Redemption Simulation
   * Simulates which lots are consumed when redeeming a specific amount
   */
  app.post("/api/capital-gains/simulate-redemption", requireAuth, async (req: Request, res: Response) => {
    try {
      const { lots, redemptionAmount, currentNav } = req.body;
      
      if (!lots || !Array.isArray(lots) || lots.length === 0) {
        return res.json({
          success: false,
          error: 'Transaction lots are required for redemption simulation',
          exitLoadEnabled: false
        });
      }

      if (!redemptionAmount || !currentNav) {
        return res.status(400).json({ 
          error: 'redemptionAmount and currentNav are required' 
        });
      }

      // Validate lots first
      const validation = capitalGainsCalculator.validateLotsForTax(lots);
      if (!validation.isValid) {
        return res.json({
          success: false,
          error: validation.disabledReason,
          exitLoadEnabled: false,
          validation
        });
      }

      const simulation = capitalGainsCalculator.simulateFIFORedemption(
        lots, 
        parseFloat(redemptionAmount), 
        parseFloat(currentNav)
      );
      
      res.json({
        success: true,
        simulation,
        summary: {
          unitsToRedeem: simulation.unitsToRedeem.toFixed(3),
          lotsConsumed: simulation.consumedLots.length,
          totalExitLoad: simulation.totalExitLoad.toFixed(2),
          ltcgAmount: simulation.ltcgAmount.toFixed(2),
          stcgAmount: simulation.stcgAmount.toFixed(2),
          lotsWithExitLoad: simulation.consumedLots.filter(l => l.hasExitLoad).length
        },
        complianceNote: "FIFO methodology applied. Exit load calculated per lot based on holding period."
      });
    } catch (error) {
      console.error("Error simulating redemption:", error);
      res.status(500).json({ error: "Failed to simulate redemption" });
    }
  });

  console.log("✅ Capital Gains routes registered");
}
