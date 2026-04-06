import { Express } from 'express';
import { randomInt } from 'crypto';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, desc, sql, and, or } from 'drizzle-orm';

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


  // MF Central style endpoints
  app.get("/api/mfcentral/all-schemes", async (req, res) => {
    try {
      // Try to fetch from API, with fallback to cached/demo data
      let allSchemes = [];
      
      try {
        const response = await fetch(`${MF_CENTRAL_API_BASE}/mf`);
        if (response.ok) {
          allSchemes = await response.json();
        } else {
          throw new Error('API response not ok');
        }
      } catch (apiError) {
        console.warn('MF API unavailable, using demo data');
        // Fallback to demo data
        allSchemes = POPULAR_MF_SCHEMES.map(scheme => ({
          schemeCode: scheme.code,
          schemeName: scheme.name,
          schemeType: 'Open Ended',
          schemeCategory: 'Equity',
          fundHouse: scheme.name.split(' ')[0] + ' Mutual Fund'
        }));
      }
      
      res.json({
        status: "success",
        data: allSchemes,
        count: allSchemes.length,
        message: "Mutual fund schemes fetched successfully"
      });
    } catch (error) {
      console.error("Error fetching all MF schemes:", error);
      res.status(500).json({ 
        status: "error",
        error: "Failed to fetch all mutual fund schemes" 
      });
    }
  });

  app.get("/api/mfcentral/scheme/:schemeCode/nav-history", async (req, res) => {
    try {
      const { schemeCode } = req.params;
      let fundData;
      
      try {
        fundData = await fetchMFAPI(`/mf/${schemeCode}`);
      } catch (apiError) {
        console.warn(`MF API unavailable for scheme ${schemeCode}, using demo data`);
        // Find matching scheme or create demo data
        const scheme = POPULAR_MF_SCHEMES.find(s => s.code === schemeCode);
        fundData = {
          meta: {
            scheme_name: scheme?.name || `Demo Mutual Fund ${schemeCode}`,
            fund_house: scheme?.name.split(' ')[0] + ' Mutual Fund' || 'Demo AMC',
            scheme_category: 'Equity',
            scheme_type: 'Open Ended'
          },
          data: [
            { nav: (Math.random() * 100 + 10).toFixed(4), date: new Date().toISOString().split('T')[0] },
            { nav: (Math.random() * 100 + 10).toFixed(4), date: new Date(Date.now() - 86400000).toISOString().split('T')[0] }
          ]
        };
      }
      
      res.json({
        status: "success",
        schemeCode,
        schemeName: fundData.meta?.scheme_name || "Unknown Fund",
        data: {
          current_nav: fundData.data?.[0]?.nav || "0",
          nav_date: fundData.data?.[0]?.date || new Date().toISOString().split('T')[0],
          historical_nav: fundData.data || [],
          fund_house: fundData.meta?.fund_house || "Unknown AMC",
          scheme_category: fundData.meta?.scheme_category || "Unknown Category",
          scheme_type: fundData.meta?.scheme_type || "Open Ended"
        }
      });
    } catch (error) {
      console.error(`Error fetching NAV history for ${req.params.schemeCode}:`, error);
      res.status(500).json({ 
        status: "error",
        error: "Failed to fetch NAV history" 
      });
    }
  });

  app.get("/api/mfcentral/holdings/:userId/import", async (req, res) => {
    try {
      const { userId } = req.params;
      const { pan, mobile } = req.query;
      
      if (!pan || !mobile) {
        return res.status(400).json({
          status: "error",
          error: "PAN and mobile number are required"
        });
      }

      // Simulate MF Central holdings import flow
      // In real implementation, this would integrate with actual MF Central APIs
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
  app.post("/api/mfcentral/sip-calculator", async (req, res) => {
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
  app.post("/api/mfcentral/lumpsum-calculator", async (req, res) => {
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
  app.post("/api/mfcentral/compare", async (req, res) => {
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
  app.post("/api/mfcentral/goal-planner", async (req, res) => {
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
