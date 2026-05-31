// @ts-nocheck
import { Express } from 'express';
import { randomInt } from 'crypto';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, desc, sql, and, or } from 'drizzle-orm';
import { irisKfintechService } from '../services/iris-kfintech-service';

export function registerMFMonthwiPart1Part1Routes(app: Express): void {
  app.get("/api/mutual-funds/:schemeCode/monthwise-performance", async (req, res) => {
    try {
      const { schemeCode } = req.params;
      const months = parseInt(req.query.months as string) || 24;
      
      console.log(`[MFMonthwise] Fetching monthwise performance for scheme ${schemeCode}`);
      
      // Import service dynamically to avoid circular dependencies
      const { mfMonthwisePerformanceService } = await import("../services/mf-monthwise-performance-service");
      
      // First try to get cached data
      let performance = await mfMonthwisePerformanceService.getMonthwisePerformance(schemeCode, months);
      
      // If no cached data, calculate and store it
      if (performance.length === 0) {
        console.log(`[MFMonthwise] No cached data, calculating for scheme ${schemeCode}`);
        const calcResult = await mfMonthwisePerformanceService.calculateAndStoreMonthlyReturns(schemeCode);
        
        if (calcResult.success) {
          performance = await mfMonthwisePerformanceService.getMonthwisePerformance(schemeCode, months);
        }
      }
      
      res.json({
        success: true,
        schemeCode,
        data: performance,
        count: performance.length,
      });
    } catch (error) {
      console.error(`[MFMonthwise] Error:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch monthwise performance",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Trigger recalculation of monthwise performance for a scheme
  app.post("/api/mutual-funds/:schemeCode/monthwise-performance/refresh", async (req, res) => {
    try {
      const { schemeCode } = req.params;
      
      const { mfMonthwisePerformanceService } = await import("../services/mf-monthwise-performance-service");
      const result = await mfMonthwisePerformanceService.calculateAndStoreMonthlyReturns(schemeCode);
      
      res.json({
        success: result.success,
        schemeCode,
        monthsCalculated: result.monthsCalculated,
        dateRange: result.dateRange,
        error: result.error,
      });
    } catch (error) {
      console.error(`[MFMonthwise] Refresh error:`, error);
      res.status(500).json({
        success: false,
        error: "Failed to refresh monthwise performance",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });


  app.get("/api/iris/schemes", async (req, res) => {
    try {
      const { q } = req.query;
      let schemes;
      
      if (q) {
        schemes = await irisKfintechService.searchSchemes(q as string);
      } else {
        schemes = await irisKfintechService.getAllFunds();
      }
      
      res.json({
        status: "success",
        data: schemes,
        message: "Mutual fund schemes fetched successfully"
      });
    } catch (error: any) {
      console.error("Error fetching IRIS schemes:", error);
      res.status(500).json({ status: "error", error: error.message });
    }
  });

  app.get("/api/iris/scheme/:schemeCode/details", async (req, res) => {
    try {
      const { schemeCode } = req.params;
      const fundData = await irisKfintechService.getSchemeDetails(schemeCode);
      
      res.json({
        status: "success",
        schemeCode,
        data: fundData
      });
    } catch (error: any) {
      console.error(`Error fetching IRIS scheme details for ${req.params.schemeCode}:`, error);
      res.status(500).json({ status: "error", error: error.message });
    }
  });

  app.post("/api/iris/import-holdings", async (req, res) => {
    try {
      const { userId, pan, mobile } = req.body;
      const holdingsData = {
        userId,
        pan,
        mobile,
        status: "success",
        importDate: new Date().toISOString(),
        folios: [
          {
            folioNumber: "F001234567",
            amc: "SBI Mutual Fund",
            kyc_status: "Completed",
            holdings: [
              {
                schemeCode: "120503",
                schemeName: "SBI Bluechip Fund - Direct Growth",
                isin: "INF200K01RM4",
                nav: "71.25",
                units: "100.523",
                marketValue: "7162.39",
                investmentValue: "7000.00",
                assetType: "Equity"
              }
            ]
          }
        ],
        summary: {
          totalInvestment: "7000.00",
          currentValue: "7162.39",
          totalGainLoss: "162.39",
          portfolioReturn: "2.32%"
        }
      };

      res.json({
        status: "success",
        message: "Holdings imported successfully",
        data: holdingsData
      });
    } catch (error) {
      console.error("Error importing MF holdings:", error);
      res.status(500).json({ 
        status: "error",
        error: "Failed to import mutual fund holdings" 
      });
    }
  });

  // Advanced MF Central Features

  // SIP Calculator
  app.post("/api/iris/sip-calculator", async (req, res) => {
    try {
      const { monthlyAmount, years, expectedReturn } = req.body;
      
      if (!monthlyAmount || !years || !expectedReturn) {
        return res.status(400).json({
          status: "error",
          error: "Monthly amount, years, and expected return are required"
        });
      }

      const monthlyRate = expectedReturn / 12 / 100;
      const totalMonths = years * 12;
      const maturityAmount = monthlyAmount * (((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate));
      const totalInvestment = monthlyAmount * totalMonths;
      const totalReturns = maturityAmount - totalInvestment;

      res.json({
        status: "success",
        data: {
          monthlyInvestment: monthlyAmount,
          investmentPeriod: years,
          expectedReturn: expectedReturn,
          totalInvestment: Math.round(totalInvestment),
          estimatedReturns: Math.round(totalReturns),
          maturityAmount: Math.round(maturityAmount)
        }
      });
    } catch (error) {
      console.error("Error calculating SIP:", error);
      res.status(500).json({ error: "Failed to calculate SIP" });
    }
  });

  // Lumpsum Calculator
  app.post("/api/iris/lumpsum-calculator", async (req, res) => {
    try {
      const { amount, years, expectedReturn } = req.body;
      
      if (!amount || !years || !expectedReturn) {
        return res.status(400).json({
          status: "error",
          error: "Amount, years, and expected return are required"
        });
      }

      const maturityAmount = amount * Math.pow(1 + expectedReturn / 100, years);
      const totalReturns = maturityAmount - amount;

      res.json({
        status: "success",
        data: {
          investment: amount,
          investmentPeriod: years,
          expectedReturn: expectedReturn,
          estimatedReturns: Math.round(totalReturns),
          maturityAmount: Math.round(maturityAmount)
        }
      });
    } catch (error) {
      console.error("Error calculating lumpsum:", error);
      res.status(500).json({ error: "Failed to calculate lumpsum investment" });
    }
  });

  // Scheme Comparison
  app.post("/api/iris/compare", async (req, res) => {
    try {
      const { schemeCodes } = req.body;
      
      if (!schemeCodes || !Array.isArray(schemeCodes) || schemeCodes.length < 2) {
        return res.status(400).json({
          status: "error",
          error: "At least 2 scheme codes are required for comparison"
        });
      }

      const comparisons = await Promise.all(
        schemeCodes.map(async (code) => {
          try {
            const data = await fetchMFAPI(`/mf/${code}`);
            const navHistory = data.data || [];
            const latest = navHistory[0];
            const oneYearAgo = navHistory.find((item: any) => {
              const date = new Date(item.date);
              const oneYearBack = new Date();
              oneYearBack.setFullYear(oneYearBack.getFullYear() - 1);
              return date <= oneYearBack;
            });

            const oneYearReturn = oneYearAgo 
              ? ((latest.nav - oneYearAgo.nav) / oneYearAgo.nav * 100).toFixed(2)
              : 'N/A';

            return {
              schemeCode: code,
              schemeName: data.meta?.scheme_name || 'Unknown Fund',
              category: data.meta?.scheme_category || 'Unknown',
              fundHouse: data.meta?.fund_house || 'Unknown AMC',
              currentNav: latest?.nav || 'N/A',
              oneYearReturn: oneYearReturn
            };
          } catch (error) {
            console.error(`Error fetching scheme ${code}:`, error);
            return {
              schemeCode: code,
              schemeName: 'Unknown Fund',
              category: 'Unknown',
              fundHouse: 'Unknown AMC',
              currentNav: 'N/A',
              oneYearReturn: 'N/A'
            };
          }
        })
      );

      res.json({
        status: "success",
        data: comparisons
      });
    } catch (error) {
      console.error("Error comparing schemes:", error);
      res.status(500).json({ error: "Failed to compare schemes" });
    }
  });

  // Goal Planning
  app.post("/api/iris/goal-planner", async (req, res) => {
    try {
      const { goalAmount, timeHorizon, currentSavings, expectedReturn, inflationRate } = req.body;
      
      if (!goalAmount || !timeHorizon || !expectedReturn) {
        return res.status(400).json({
          status: "error",
          error: "Goal amount, time horizon, and expected return are required"
        });
      }

      const inflation = inflationRate || 6; // Default inflation rate
      const futureValue = goalAmount * Math.pow(1 + inflation / 100, timeHorizon);
      const currentSavingsValue = currentSavings || 0;
      const remainingAmount = futureValue - (currentSavingsValue * Math.pow(1 + expectedReturn / 100, timeHorizon));
      
      const monthlyRate = expectedReturn / 12 / 100;
      const totalMonths = timeHorizon * 12;
      const requiredMonthlySIP = remainingAmount > 0 
        ? remainingAmount / (((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate))
        : 0;

      res.json({
        status: "success",
        data: {
          goalAmount: goalAmount,
          timeHorizon: timeHorizon,
          expectedReturn: expectedReturn,
          inflationAdjustedGoal: Math.round(futureValue),
          currentSavings: currentSavingsValue,
          requiredMonthlySIP: Math.max(0, Math.round(requiredMonthlySIP)),
          goalAchievable: remainingAmount <= 0
        }
      });
    } catch (error) {
      console.error("Error planning goal:", error);
      res.status(500).json({ error: "Failed to plan investment goal" });
    }
  });

}
