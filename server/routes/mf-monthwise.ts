import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, desc, sql, and, or } from 'drizzle-orm';

export function registerMFMonthwiseRoutes(app: Express): void {
  // ============ MF MONTHWISE PERFORMANCE ============
  // Get monthwise performance for a mutual fund scheme
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

  app.get("/api/mfcentral/analytics/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Get user's portfolio data for analytics
      const portfolios = await storage.getPortfoliosByUserId(userId);
      
      const analytics = {
        userId,
        analysis_date: new Date().toISOString(),
        portfolio_summary: {
          total_schemes: portfolios.length,
          total_investment: portfolios.reduce((sum, p) => sum + parseFloat(p.totalValue || "0"), 0),
          equity_allocation: "65%",
          debt_allocation: "30%",
          hybrid_allocation: "5%"
        },
        performance_metrics: {
          one_year_return: "12.5%",
          three_year_return: "15.2%",
          portfolio_volatility: "18.5%",
          sharpe_ratio: "0.85"
        },
        recommendations: [
          {
            type: "rebalancing",
            message: "Consider rebalancing your portfolio - equity allocation is high"
          },
          {
            type: "diversification", 
            message: "Add more debt funds for better risk management"
          }
        ]
      };

      res.json({
        status: "success",
        data: analytics
      });
    } catch (error) {
      console.error("Error generating portfolio analytics:", error);
      res.status(500).json({ 
        status: "error",
        error: "Failed to generate portfolio analytics" 
      });
    }
  });

  // KFintech capital gains report
  app.get("/api/kfintech/capital-gains", async (req, res) => {
    try {
      const { pan, financialYear, transactionType, folioNumber } = req.query;

      // Simulate KFintech mutual fund capital gains data
      const kfintechCapitalGains = [
        {
          id: "kfintech-cg-1",
          pan: pan || "ABCDE1234F",
          folioNumber: "MF123456789",
          schemeCode: "HDFC-TOP100-G",
          schemeName: "HDFC Top 100 Fund - Growth",
          isin: "INF179K01158",
          amcName: "HDFC Asset Management Company Limited",
          registrar: "KFintech",
          financialYear: "2024-25",
          transactionType: "LONG_TERM",
          purchaseDate: "2023-04-15",
          redemptionDate: "2024-08-10",
          purchaseNav: 675.50,
          redemptionNav: 758.25,
          units: 148.25,
          purchaseValue: 100120.13,
          redemptionValue: 112445.06,
          exitLoad: 0, // No exit load for > 1 year
          otherCharges: 15.50,
          grossGain: 12324.93,
          netRealizedGain: 12309.43,
          taxableGain: 12309.43,
          taxRate: 12.5, // LTCG tax rate for equity mutual funds
          taxLiability: 1538.68,
          netGainAfterTax: 10770.75,
          holdingPeriod: 482, // days
          category: "Large Cap Equity"
        },
        {
          id: "kfintech-cg-2",
          pan: pan || "ABCDE1234F", 
          folioNumber: "MF987654321",
          schemeCode: "ICICI-BLUECHIP-G",
          schemeName: "ICICI Prudential Bluechip Fund - Growth",
          isin: "INF109K01013",
          amcName: "ICICI Prudential Asset Management Company Limited",
          registrar: "KFintech",
          financialYear: "2024-25",
          transactionType: "SHORT_TERM",
          purchaseDate: "2024-02-20",
          redemptionDate: "2024-09-15",
          purchaseNav: 45.80,
          redemptionNav: 52.15,
          units: 2185.59,
          purchaseValue: 100120.00,
          redemptionValue: 113979.01,
          exitLoad: 341.94, // 1% exit load for < 1 year
          otherCharges: 25.75,
          grossGain: 13859.01,
          netRealizedGain: 13491.32,
          taxableGain: 13491.32,
          taxRate: 20, // STCG tax rate for equity mutual funds
          taxLiability: 2698.26,
          netGainAfterTax: 10793.06,
          holdingPeriod: 208, // days
          category: "Large Cap Equity"
        },
        {
          id: "kfintech-cg-3",
          pan: pan || "ABCDE1234F",
          folioNumber: "MF456789123",
          schemeCode: "AXIS-LONGTERM-G",
          schemeName: "Axis Long Term Equity Fund - Growth",
          isin: "INF846K01201",
          amcName: "Axis Asset Management Company Limited",
          registrar: "KFintech",
          financialYear: "2024-25", 
          transactionType: "LONG_TERM",
          purchaseDate: "2022-11-25",
          redemptionDate: "2024-07-30",
          purchaseNav: 58.90,
          redemptionNav: 72.45,
          units: 1700.17,
          purchaseValue: 100120.02,
          redemptionValue: 123197.33,
          exitLoad: 0,
          otherCharges: 18.25,
          grossGain: 23077.31,
          netRealizedGain: 23059.06,
          taxableGain: 23059.06,
          taxRate: 12.5,
          taxLiability: 2882.38,
          netGainAfterTax: 20176.68,
          holdingPeriod: 613, // days
          category: "Tax Saving (ELSS)"
        },
        {
          id: "kfintech-cg-4",
          pan: pan || "ABCDE1234F",
          folioNumber: "MF321654987",
          schemeCode: "SBI-SMALLCAP-G", 
          schemeName: "SBI Small Cap Fund - Growth",
          isin: "INF200K01158",
          amcName: "SBI Funds Management Limited",
          registrar: "KFintech",
          financialYear: "2024-25",
          transactionType: "SHORT_TERM",
          purchaseDate: "2024-03-10",
          redemptionDate: "2024-09-05",
          purchaseNav: 125.75,
          redemptionNav: 142.30,
          units: 796.41,
          purchaseValue: 100154.16,
          redemptionValue: 113273.52,
          exitLoad: 339.82, // 1% exit load
          otherCharges: 22.50,
          grossGain: 13119.36,
          netRealizedGain: 12757.04,
          taxableGain: 12757.04,
          taxRate: 20,
          taxLiability: 2551.41,
          netGainAfterTax: 10205.63,
          holdingPeriod: 179, // days
          category: "Small Cap Equity"
        }
      ];

      // Filter by financial year if provided
      let filteredGains = kfintechCapitalGains;
      if (financialYear) {
        filteredGains = filteredGains.filter(cg => cg.financialYear === financialYear);
      }
      if (transactionType) {
        filteredGains = filteredGains.filter(cg => cg.transactionType === transactionType);
      }
      if (folioNumber) {
        filteredGains = filteredGains.filter(cg => cg.folioNumber === folioNumber);
      }

      const summary = {
        totalTransactions: filteredGains.length,
        totalRealizedGains: filteredGains.reduce((sum, cg) => sum + cg.netRealizedGain, 0),
        totalTaxLiability: filteredGains.reduce((sum, cg) => sum + cg.taxLiability, 0),
        totalNetGainAfterTax: filteredGains.reduce((sum, cg) => sum + cg.netGainAfterTax, 0),
        totalExitLoad: filteredGains.reduce((sum, cg) => sum + cg.exitLoad, 0),
        longTermGains: filteredGains.filter(cg => cg.transactionType === 'LONG_TERM').length,
        shortTermGains: filteredGains.filter(cg => cg.transactionType === 'SHORT_TERM').length,
        averageHoldingPeriod: Math.round(filteredGains.reduce((sum, cg) => sum + cg.holdingPeriod, 0) / filteredGains.length),
        schemeCategories: Array.from(new Set(filteredGains.map(cg => cg.category)))
      };

      res.json({
        status: "success",
        data: filteredGains,
        summary,
        registrar: "KFintech",
        searchCriteria: { pan, financialYear, transactionType, folioNumber },
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching KFintech capital gains:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch KFintech capital gains data"
      });
    }
  });

  // CAMS API Integration endpoints

  // Get investor portfolio from CAMS
  app.get("/api/cams/portfolio/:pan", async (req, res) => {
    try {
      const { pan } = req.params;
      const { folio } = req.query;
      
      if (!pan) {
        return res.status(400).json({
          status: "error",
          error: "PAN number is required"
        });
      }

      const portfolios = await camsApi.getInvestorPortfolio(pan, folio as string);

      res.json({
        status: "success",
        data: portfolios,
        count: portfolios.length,
        message: "Portfolio details fetched successfully"
      });
    } catch (error) {
      console.error("Error fetching CAMS portfolio:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch portfolio from CAMS"
      });
    }
  });

  // Get transaction history from CAMS
  app.get("/api/cams/transactions/:pan", async (req, res) => {
    try {
      const { pan } = req.params;
      const { fromDate, toDate, folio } = req.query;
      
      if (!pan || !fromDate || !toDate) {
        return res.status(400).json({
          status: "error",
          error: "PAN, fromDate, and toDate are required"
        });
      }

      const transactions = await camsApi.getTransactionHistory(
        pan,
        fromDate as string,
        toDate as string,
        folio as string
      );

      res.json({
        status: "success",
        data: transactions,
        count: transactions.length,
        message: "Transaction history fetched successfully"
      });
    } catch (error) {
      console.error("Error fetching CAMS transactions:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch transactions from CAMS"
      });
    }
  });

  // Create purchase transaction through CAMS
  app.post("/api/cams/transactions/purchase", async (req, res) => {
    try {
      const {
        pan,
        schemeCode,
        amount,
        folioNumber,
        investorName,
        bankAccount,
        ifscCode
      } = req.body;
      
      if (!pan || !schemeCode || !amount || !investorName || !bankAccount || !ifscCode) {
        return res.status(400).json({
          status: "error",
          error: "PAN, scheme code, amount, investor name, bank account, and IFSC are required"
        });
      }

      const result = await camsApi.createPurchaseTransaction({
        pan,
        schemeCode,
        amount,
        folioNumber,
        investorName,
        bankAccount,
        ifscCode
      });

      res.json({
        status: "success",
        data: result,
        message: "Purchase transaction created successfully"
      });
    } catch (error) {
      console.error("Error creating CAMS purchase transaction:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to create purchase transaction"
      });
    }
  });

  // Create redemption transaction through CAMS
  app.post("/api/cams/transactions/redemption", async (req, res) => {
    try {
      const {
        pan,
        folio,
        schemeCode,
        units,
        amount,
        redemptionType,
        bankAccount,
        ifscCode
      } = req.body;
      
      if (!pan || !folio || !schemeCode || !redemptionType || !bankAccount || !ifscCode) {
        return res.status(400).json({
          status: "error",
          error: "PAN, folio, scheme code, redemption type, bank account, and IFSC are required"
        });
      }

      const result = await camsApi.createRedemptionTransaction({
        pan,
        folio,
        schemeCode,
        units,
        amount,
        redemptionType,
        bankAccount,
        ifscCode
      });

      res.json({
        status: "success",
        data: result,
        message: "Redemption transaction created successfully"
      });
    } catch (error) {
      console.error("Error creating CAMS redemption transaction:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to create redemption transaction"
      });
    }
  });

  // Setup SIP through CAMS
  app.post("/api/cams/sip/setup", async (req, res) => {
    try {
      const {
        pan,
        schemeCode,
        amount,
        frequency,
        startDate,
        endDate,
        installments,
        folioNumber,
        bankAccount,
        ifscCode
      } = req.body;
      
      if (!pan || !schemeCode || !amount || !frequency || !startDate || !bankAccount || !ifscCode) {
        return res.status(400).json({
          status: "error",
          error: "PAN, scheme code, amount, frequency, start date, bank account, and IFSC are required"
        });
      }

      const result = await camsApi.setupSip({
        pan,
        schemeCode,
        amount,
        frequency,
        startDate,
        endDate,
        installments,
        folioNumber,
        bankAccount,
        ifscCode
      });

      res.json({
        status: "success",
        data: result,
        message: "SIP setup successfully"
      });
    } catch (error) {
      console.error("Error setting up CAMS SIP:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to setup SIP"
      });
    }
  });

  // Get SIP details from CAMS
  app.get("/api/cams/sip/:pan", async (req, res) => {
    try {
      const { pan } = req.params;
      const { sipId } = req.query;
      
      if (!pan) {
        return res.status(400).json({
          status: "error",
          error: "PAN number is required"
        });
      }

      const sipDetails = await camsApi.getSipDetails(pan, sipId as string);

      res.json({
        status: "success",
        data: sipDetails,
        count: sipDetails.length,
        message: "SIP details fetched successfully"
      });
    } catch (error) {
      console.error("Error fetching CAMS SIP details:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch SIP details"
      });
    }
  });

  // Cancel SIP through CAMS
  app.post("/api/cams/sip/cancel", async (req, res) => {
    try {
      const { sipId, pan } = req.body;
      
      if (!sipId || !pan) {
        return res.status(400).json({
          status: "error",
          error: "SIP ID and PAN are required"
        });
      }

      const result = await camsApi.cancelSip(sipId, pan);

      res.json({
        status: "success",
        data: result,
        message: "SIP cancelled successfully"
      });
    } catch (error) {
      console.error("Error cancelling CAMS SIP:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to cancel SIP"
      });
    }
  });

  // Get scheme details from CAMS
  app.get("/api/cams/schemes/:schemeCode?", async (req, res) => {
    try {
      const { schemeCode } = req.params;
      
      const schemes = await camsApi.getSchemeDetails(schemeCode);

      res.json({
        status: "success",
        data: schemes,
        count: schemes.length,
        message: "Scheme details fetched successfully"
      });
    } catch (error) {
      console.error("Error fetching CAMS scheme details:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch scheme details"
      });
    }
  });

  // Get NAV data from CAMS
  app.get("/api/cams/nav/:schemeCode", async (req, res) => {
    try {
      const { schemeCode } = req.params;
      const { date } = req.query;
      
      if (!schemeCode) {
        return res.status(400).json({
          status: "error",
          error: "Scheme code is required"
        });
      }

      const navData = await camsApi.getNavData(schemeCode, date as string);

      res.json({
        status: "success",
        data: navData,
        message: "NAV data fetched successfully"
      });
    } catch (error) {
      console.error("Error fetching CAMS NAV data:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NAV data"
      });
    }
  });

  // Validate investor through CAMS
  app.get("/api/cams/investor/validate/:pan", async (req, res) => {
    try {
      const { pan } = req.params;
      
      if (!pan) {
        return res.status(400).json({
          status: "error",
          error: "PAN number is required"
        });
      }

      const validation = await camsApi.validateInvestor(pan);

      res.json({
        status: "success",
        data: validation,
        message: validation.isValid ? "Investor validated successfully" : "Invalid investor PAN"
      });
    } catch (error) {
      console.error("Error validating investor through CAMS:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to validate investor"
      });
    }
  });

  // Generate consolidated statement through CAMS
  app.post("/api/cams/statement/generate", async (req, res) => {
    try {
      const { pan, fromDate, toDate, format } = req.body;
      
      if (!pan || !fromDate || !toDate) {
        return res.status(400).json({
          status: "error",
          error: "PAN, from date, and to date are required"
        });
      }

      const statement = await camsApi.getConsolidatedStatement(
        pan,
        fromDate,
        toDate,
        format || 'PDF'
      );

      res.json({
        status: "success",
        data: statement,
        message: "Statement generated successfully"
      });
    } catch (error) {
      console.error("Error generating CAMS statement:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to generate statement"
      });
    }
  });

  // CAMS capital gains report
  app.get("/api/cams/capital-gains", async (req, res) => {
    try {
      const { pan, financialYear, transactionType, folioNumber } = req.query;

      // Simulate CAMS mutual fund capital gains data
      const camsCapitalGains = [
        {
          id: "cams-cg-1",
          pan: pan || "ABCDE1234F",
          folioNumber: "CAM123456789",
          schemeCode: "FRAN-INDIA-G",
          schemeName: "Franklin India Bluechip Fund - Growth",
          isin: "INF154K01014",
          amcName: "Franklin Templeton Asset Management (India) Private Limited",
          registrar: "CAMS",
          financialYear: "2024-25",
          transactionType: "LONG_TERM",
          purchaseDate: "2023-03-20",
          redemptionDate: "2024-08-25",
          purchaseNav: 580.75,
          redemptionNav: 642.90,
          units: 172.46,
          purchaseValue: 100143.55,
          redemptionValue: 110846.93,
          exitLoad: 0, // No exit load for > 1 year
          otherCharges: 18.75,
          grossGain: 10703.38,
          netRealizedGain: 10684.63,
          taxableGain: 10684.63,
          taxRate: 12.5, // LTCG tax rate for equity mutual funds
          taxLiability: 1335.58,
          netGainAfterTax: 9349.05,
          holdingPeriod: 523, // days
          category: "Large Cap Equity"
        },
        {
          id: "cams-cg-2",
          pan: pan || "ABCDE1234F",
          folioNumber: "CAM987654321",
          schemeCode: "INVESCO-CONTRA-G",
          schemeName: "Invesco India Contra Fund - Growth",
          isin: "INF220K01015",
          amcName: "Invesco Asset Management (India) Private Limited",
          registrar: "CAMS",
          financialYear: "2024-25",
          transactionType: "SHORT_TERM",
          purchaseDate: "2024-01-15",
          redemptionDate: "2024-09-10",
          purchaseNav: 75.20,
          redemptionNav: 84.85,
          units: 1331.38,
          purchaseValue: 100119.78,
          redemptionValue: 112969.58,
          exitLoad: 338.91, // 1% exit load for < 1 year
          otherCharges: 28.50,
          grossGain: 12849.80,
          netRealizedGain: 12482.39,
          taxableGain: 12482.39,
          taxRate: 20, // STCG tax rate for equity mutual funds
          taxLiability: 2496.48,
          netGainAfterTax: 9985.91,
          holdingPeriod: 238, // days
          category: "Multi Cap Equity"
        },
        {
          id: "cams-cg-3",
          pan: pan || "ABCDE1234F",
          folioNumber: "CAM456789123",
          schemeCode: "MOTILAL-MIDCAP-G",
          schemeName: "Motilal Oswal Midcap Fund - Growth",
          isin: "INF769K01021",
          amcName: "Motilal Oswal Asset Management Company Limited",
          registrar: "CAMS",
          financialYear: "2024-25",
          transactionType: "LONG_TERM",
          purchaseDate: "2022-10-10",
          redemptionDate: "2024-06-20",
          purchaseNav: 42.15,
          redemptionNav: 56.80,
          units: 2375.44,
          purchaseValue: 100115.29,
          redemptionValue: 134924.99,
          exitLoad: 0,
          otherCharges: 22.25,
          grossGain: 34809.70,
          netRealizedGain: 34787.45,
          taxableGain: 34787.45,
          taxRate: 12.5,
          taxLiability: 4348.43,
          netGainAfterTax: 30439.02,
          holdingPeriod: 618, // days
          category: "Mid Cap Equity"
        },
        {
          id: "cams-cg-4",
          pan: pan || "ABCDE1234F",
          folioNumber: "CAM321654987",
          schemeCode: "ADITYA-LIQUID-G",
          schemeName: "Aditya Birla Sun Life Liquid Fund - Growth",
          isin: "INF209K01024",
          amcName: "Aditya Birla Sun Life Asset Management Company Limited",
          registrar: "CAMS",
          financialYear: "2024-25",
          transactionType: "SHORT_TERM",
          purchaseDate: "2024-05-15",
          redemptionDate: "2024-08-30",
          purchaseNav: 298.45,
          redemptionNav: 301.80,
          units: 335.45,
          purchaseValue: 100135.02,
          redemptionValue: 101240.11,
          exitLoad: 0, // No exit load for liquid funds
          otherCharges: 5.50,
          grossGain: 1105.09,
          netRealizedGain: 1099.59,
          taxableGain: 1099.59,
          taxRate: 20, // STCG tax rate (applicable to liquid/debt funds regardless of holding period)
          taxLiability: 219.92,
          netGainAfterTax: 879.67,
          holdingPeriod: 107, // days
          category: "Liquid Fund"
        }
      ];

      // Filter by financial year if provided
      let filteredGains = camsCapitalGains;
      if (financialYear) {
        filteredGains = filteredGains.filter(cg => cg.financialYear === financialYear);
      }
      if (transactionType) {
        filteredGains = filteredGains.filter(cg => cg.transactionType === transactionType);
      }
      if (folioNumber) {
        filteredGains = filteredGains.filter(cg => cg.folioNumber === folioNumber);
      }

      const summary = {
        totalTransactions: filteredGains.length,
        totalRealizedGains: filteredGains.reduce((sum, cg) => sum + cg.netRealizedGain, 0),
        totalTaxLiability: filteredGains.reduce((sum, cg) => sum + cg.taxLiability, 0),
        totalNetGainAfterTax: filteredGains.reduce((sum, cg) => sum + cg.netGainAfterTax, 0),
        totalExitLoad: filteredGains.reduce((sum, cg) => sum + cg.exitLoad, 0),
        longTermGains: filteredGains.filter(cg => cg.transactionType === 'LONG_TERM').length,
        shortTermGains: filteredGains.filter(cg => cg.transactionType === 'SHORT_TERM').length,
        averageHoldingPeriod: Math.round(filteredGains.reduce((sum, cg) => sum + cg.holdingPeriod, 0) / filteredGains.length),
        schemeCategories: Array.from(new Set(filteredGains.map(cg => cg.category)))
      };

      res.json({
        status: "success",
        data: filteredGains,
        summary,
        registrar: "CAMS",
        searchCriteria: { pan, financialYear, transactionType, folioNumber },
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching CAMS capital gains:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch CAMS capital gains data"
      });
    }
  });

  // NSDL API endpoints
  
  // Helper function for NSDL API calls
  async function fetchNSDL(endpoint: string, data?: any) {
    // In production, this would use actual NSDL credentials and endpoints
    // For demo purposes, we'll simulate NSDL responses
    console.log(`NSDL API Call: ${endpoint}`, data);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { status: "success", data: data || {} };
  }

  // NSDL Demat Account Services
  app.post("/api/nsdl/demat/account/open", async (req, res) => {
    try {
      const { clientName, pan, mobile, email, address, kycDocuments } = req.body;
      
      if (!clientName || !pan || !mobile) {
        return res.status(400).json({
          status: "error",
          error: "Client name, PAN, and mobile number are required"
        });
      }

      // Simulate NSDL Insta Demat Account Opening
      const accountData = {
        clientId: `CL${Date.now()}`,
        demateAccountNumber: `${Math.random().toString().slice(2, 16)}`,
        dpId: "IN300394",
        dpName: "Demo Depository Participant",
        clientName,
        pan,
        mobile,
        email,
        status: "ACTIVE",
        accountType: "SINGLE_HOLDING",
        openingDate: new Date().toISOString().split('T')[0],
        kycStatus: "COMPLETED",
        holdingNomination: "NOT_APPLICABLE"
      };

      await fetchNSDL("/account/open", accountData);

      res.json({
        status: "success",
        message: "NSDL Demat account opened successfully",
        data: accountData
      });
    } catch (error) {
      console.error("Error opening NSDL demat account:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to open demat account"
      });
    }
  });

  app.get("/api/nsdl/demat/holdings/:accountNumber", async (req, res) => {
    try {
      const { accountNumber } = req.params;
      
      // Simulate NSDL holdings data
      const holdingsData = {
        accountNumber,
        dpId: "IN300394",
        clientName: "Demo Client",
        asOfDate: new Date().toISOString().split('T')[0],
        holdings: [
          {
            isin: "INE002A01018",
            securityName: "Reliance Industries Ltd",
            quantity: 100,
            marketValue: "267500.00",
            freeQuantity: 100,
            lockedQuantity: 0,
            pledgedQuantity: 0
          },
          {
            isin: "INE009A01021", 
            securityName: "Infosys Limited",
            quantity: 50,
            marketValue: "95000.00",
            freeQuantity: 45,
            lockedQuantity: 0,
            pledgedQuantity: 5
          },
          {
            isin: "INE467B01029",
            securityName: "HDFC Bank Ltd",
            quantity: 75,
            marketValue: "127500.00", 
            freeQuantity: 75,
            lockedQuantity: 0,
            pledgedQuantity: 0
          }
        ],
        totalMarketValue: "490000.00"
      };

      await fetchNSDL("/holdings/fetch", { accountNumber });

      res.json({
        status: "success",
        data: holdingsData
      });
    } catch (error) {
      console.error("Error fetching NSDL holdings:", error);
      res.status(500).json({
        status: "error", 
        error: "Failed to fetch holdings data"
      });
    }
  });

  // NSDL eDIS (Electronic Delivery Instruction Slip)
  app.post("/api/nsdl/edis/instruction", async (req, res) => {
    try {
      const { accountNumber, isin, quantity, brokerCode, tradeDate, otp } = req.body;
      
      if (!accountNumber || !isin || !quantity || !brokerCode || !otp) {
        return res.status(400).json({
          status: "error",
          error: "Account number, ISIN, quantity, broker code, and OTP are required"
        });
      }

      // Simulate eDIS instruction processing
      const edisInstruction = {
        instructionId: `DIS${Date.now()}`,
        accountNumber,
        isin,
        quantity,
        brokerCode,
        tradeDate,
        status: "APPROVED",
        processingDate: new Date().toISOString(),
        remarks: "Electronic Delivery Instruction processed successfully"
      };

      await fetchNSDL("/edis/submit", edisInstruction);

      res.json({
        status: "success",
        message: "eDIS instruction submitted successfully",
        data: edisInstruction
      });
    } catch (error) {
      console.error("Error processing eDIS instruction:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to process delivery instruction"
      });
    }
  });

  app.post("/api/nsdl/edis/otp/generate", async (req, res) => {
    try {
      const { accountNumber, mobile } = req.body;
      
      if (!accountNumber || !mobile) {
        return res.status(400).json({
          status: "error",
          error: "Account number and mobile number are required"
        });
      }

      // Simulate OTP generation
      const otpData = {
        referenceId: `OTP${Date.now()}`,
        accountNumber,
        mobile,
        otp: Math.floor(100000 + Math.random() * 900000).toString(), // Demo OTP
        validityMinutes: 10,
        status: "SENT"
      };

      await fetchNSDL("/otp/generate", { accountNumber, mobile });

      res.json({
        status: "success",
        message: "OTP sent successfully to registered mobile number",
        data: {
          referenceId: otpData.referenceId,
          validityMinutes: otpData.validityMinutes
        }
      });
    } catch (error) {
      console.error("Error generating OTP:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to generate OTP"
      });
    }
  });

  // NSDL Margin Pledge API
  app.post("/api/nsdl/margin/pledge/create", async (req, res) => {
    try {
      const { accountNumber, isin, quantity, pledgeeCode, purpose, otp } = req.body;
      
      if (!accountNumber || !isin || !quantity || !pledgeeCode || !otp) {
        return res.status(400).json({
          status: "error",
          error: "All fields including OTP are required for margin pledge"
        });
      }

      // Simulate margin pledge creation
      const pledgeData = {
        pledgeId: `PLG${Date.now()}`,
        accountNumber,
        isin,
        quantity,
        pledgeeCode,
        purpose: purpose || "MARGIN",
        status: "CONFIRMED",
        pledgeDate: new Date().toISOString().split('T')[0],
        collateralValue: (parseFloat(quantity) * 1500).toString(), // Simulated value
        haircut: "15%",
        eligibleValue: (parseFloat(quantity) * 1275).toString()
      };

      await fetchNSDL("/margin/pledge", pledgeData);

      res.json({
        status: "success",
        message: "Margin pledge created successfully",
        data: pledgeData
      });
    } catch (error) {
      console.error("Error creating margin pledge:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to create margin pledge"
      });
    }
  });

  app.post("/api/nsdl/margin/pledge/close", async (req, res) => {
    try {
      const { pledgeId, otp } = req.body;
      
      if (!pledgeId || !otp) {
        return res.status(400).json({
          status: "error",
          error: "Pledge ID and OTP are required"
        });
      }

      // Simulate pledge closure
      const closureData = {
        pledgeId,
        status: "CLOSED",
        closureDate: new Date().toISOString().split('T')[0],
        releasedQuantity: "100",
        remarks: "Pledge closed successfully"
      };

      await fetchNSDL("/margin/pledge/close", closureData);

      res.json({
        status: "success",
        message: "Margin pledge closed successfully",
        data: closureData
      });
    } catch (error) {
      console.error("Error closing margin pledge:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to close margin pledge"
      });
    }
  });

  // NSDL Digital LAS (Loan Against Securities)
  app.post("/api/nsdl/las/loan/apply", async (req, res) => {
    try {
      const { accountNumber, loanAmount, collateralSecurities, purpose, bankCode } = req.body;
      
      if (!accountNumber || !loanAmount || !collateralSecurities || !bankCode) {
        return res.status(400).json({
          status: "error",
          error: "Account number, loan amount, collateral securities, and bank code are required"
        });
      }

      // Simulate LAS loan application
      const loanApplication = {
        applicationId: `LAS${Date.now()}`,
        accountNumber,
        loanAmount,
        bankCode,
        purpose: purpose || "PERSONAL",
        status: "UNDER_PROCESSING",
        applicationDate: new Date().toISOString().split('T')[0],
        collateralSecurities,
        interestRate: "12.5%",
        tenure: "12 months",
        eligibleLoanAmount: (parseFloat(loanAmount) * 0.7).toString()
      };

      await fetchNSDL("/las/apply", loanApplication);

      res.json({
        status: "success",
        message: "LAS loan application submitted successfully",
        data: loanApplication
      });
    } catch (error) {
      console.error("Error applying for LAS loan:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to submit loan application"
      });
    }
  });

  app.get("/api/nsdl/las/loan/status/:applicationId", async (req, res) => {
    try {
      const { applicationId } = req.params;
      
      // Simulate loan status check
      const loanStatus = {
        applicationId,
        status: "APPROVED",
        approvedAmount: "500000.00",
        disbursementDate: new Date().toISOString().split('T')[0],
        interestRate: "12.5%",
        repaymentSchedule: [
          { dueDate: "2025-09-27", amount: "42708.33", status: "PENDING" },
          { dueDate: "2025-10-27", amount: "42708.33", status: "PENDING" },
          { dueDate: "2025-11-27", amount: "42708.33", status: "PENDING" }
        ]
      };

      await fetchNSDL("/las/status", { applicationId });

      res.json({
        status: "success",
        data: loanStatus
      });
    } catch (error) {
      console.error("Error checking loan status:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch loan status"
      });
    }
  });

  // NSDL Account Statement and Transaction History
  app.get("/api/nsdl/statement/:accountNumber", async (req, res) => {
    try {
      const { accountNumber } = req.params;
      const { fromDate, toDate } = req.query;
      
      // Simulate transaction history
      const statement = {
        accountNumber,
        dpId: "IN300394",
        period: `${fromDate || '2025-01-01'} to ${toDate || new Date().toISOString().split('T')[0]}`,
        transactions: [
          {
            date: "2025-08-25",
            isin: "INE002A01018",
            securityName: "Reliance Industries Ltd",
            transactionType: "BUY",
            quantity: 50,
            rate: "2675.00",
            amount: "133750.00",
            balanceQuantity: 100
          },
          {
            date: "2025-08-20", 
            isin: "INE009A01021",
            securityName: "Infosys Limited",
            transactionType: "PLEDGE",
            quantity: 5,
            rate: "1900.00",
            amount: "9500.00",
            balanceQuantity: 50
          },
          {
            date: "2025-08-15",
            isin: "INE467B01029",
            securityName: "HDFC Bank Ltd",
            transactionType: "SELL",
            quantity: -25,
            rate: "1700.00",
            amount: "-42500.00",
            balanceQuantity: 75
          }
        ]
      };

      await fetchNSDL("/statement/fetch", { accountNumber, fromDate, toDate });

      res.json({
        status: "success",
        data: statement
      });
    } catch (error) {
      console.error("Error fetching account statement:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch account statement"
      });
    }
  });

  // Advanced NSDL Features

  // Corporate Actions
  app.get("/api/nsdl/corporate-actions/:accountNumber", async (req, res) => {
    try {
      const { accountNumber } = req.params;
      
      // Simulate corporate actions data
      const corporateActions = {
        accountNumber,
        actions: [
          {
            recordDate: "2025-08-15",
            exDate: "2025-08-10",
            isin: "INE002A01018",
            securityName: "Reliance Industries Ltd",
            actionType: "DIVIDEND",
            rate: "8.00",
            unit: "PER_SHARE",
            status: "PROCESSED",
            eligibleQuantity: 100,
            totalAmount: "800.00"
          },
          {
            recordDate: "2025-07-20",
            exDate: "2025-07-18",
            isin: "INE009A01021",
            securityName: "Infosys Limited", 
            actionType: "BONUS",
            ratio: "1:2",
            status: "PROCESSED",
            eligibleQuantity: 50,
            bonusQuantity: 25
          }
        ]
      };

      await fetchNSDL("/corporate-actions/fetch", { accountNumber });

      res.json({
        status: "success",
        data: corporateActions
      });
    } catch (error) {
      console.error("Error fetching corporate actions:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch corporate actions"
      });
    }
  });

  // Portfolio Analytics
  app.get("/api/nsdl/analytics/:accountNumber", async (req, res) => {
    try {
      const { accountNumber } = req.params;
      
      // Simulate portfolio analytics
      const analytics = {
        accountNumber,
        analysisDate: new Date().toISOString().split('T')[0],
        totalPortfolioValue: "2500000.00",
        gainLoss: "+150000.00",
        gainLossPercent: "+6.25%",
        sectorAllocation: [
          { sector: "Technology", value: "750000.00", percentage: 30 },
          { sector: "Financial Services", value: "625000.00", percentage: 25 },
          { sector: "Healthcare", value: "500000.00", percentage: 20 },
          { sector: "Consumer Goods", value: "375000.00", percentage: 15 },
          { sector: "Energy", value: "250000.00", percentage: 10 }
        ],
        topHoldings: [
          { isin: "INE002A01018", name: "Reliance Industries", value: "400000.00", percentage: 16 },
          { isin: "INE009A01021", name: "Infosys Limited", value: "350000.00", percentage: 14 },
          { isin: "INE040A01034", name: "TCS Limited", value: "300000.00", percentage: 12 }
        ]
      };

      await fetchNSDL("/analytics/generate", { accountNumber });

      res.json({
        status: "success",
        data: analytics
      });
    } catch (error) {
      console.error("Error generating analytics:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to generate portfolio analytics"
      });
    }
  });

  // CDSL API endpoints
  
  // Helper function for CDSL API calls
  async function fetchCDSL(endpoint: string, data?: any) {
    // In production, this would use actual CDSL credentials and endpoints
    // For demo purposes, we'll simulate CDSL responses
    console.log(`CDSL API Call: ${endpoint}`, data);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { status: "success", data: data || {} };
  }

  // CDSL Account Opening and Management
  app.post("/api/cdsl/account/setup", async (req, res) => {
    try {
      const { clientName, pan, mobile, email, address, nomineeName, nomineeRelation } = req.body;
      
      if (!clientName || !pan || !mobile || !email) {
        return res.status(400).json({
          status: "error",
          error: "Client name, PAN, mobile, and email are required"
        });
      }

      // Simulate CDSL BO Setup
      const accountData = {
        boId: `${Date.now()}`,
        accountNumber: `${Math.random().toString().slice(2, 16)}`,
        dpId: "12345600",
        dpName: "CDSL Demo Depository Participant",
        clientName,
        pan,
        mobile,
        email,
        status: "ACTIVE",
        accountType: "INDIVIDUAL",
        openingDate: new Date().toISOString().split('T')[0],
        kycStatus: "COMPLETED",
        tpin: Math.floor(100000 + Math.random() * 900000).toString(),
        holdingNature: "BENEFICIAL_OWNER"
      };

      await fetchCDSL("/bo-setup", accountData);

      res.json({
        status: "success",
        message: "CDSL account opened successfully",
        data: accountData
      });
    } catch (error) {
      console.error("Error opening CDSL account:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to open CDSL account"
      });
    }
  });

  app.get("/api/cdsl/holdings/:boId", async (req, res) => {
    try {
      const { boId } = req.params;
      
      // Simulate CDSL holdings data
      const holdingsData = {
        boId,
        dpId: "12345600",
        clientName: "Demo CDSL Client",
        asOfDate: new Date().toISOString().split('T')[0],
        holdings: [
          {
            isin: "INE040A01034",
            securityName: "Tata Consultancy Services Ltd",
            quantity: 50,
            marketValue: "195000.00",
            freeQuantity: 50,
            lockedQuantity: 0,
            pledgedQuantity: 0,
            earmarkQuantity: 0
          },
          {
            isin: "INE075A01022", 
            securityName: "Wipro Limited",
            quantity: 100,
            marketValue: "57500.00",
            freeQuantity: 95,
            lockedQuantity: 0,
            pledgedQuantity: 5,
            earmarkQuantity: 0
          },
          {
            isin: "INE019A01038",
            securityName: "Asian Paints Ltd",
            quantity: 25,
            marketValue: "82500.00", 
            freeQuantity: 25,
            lockedQuantity: 0,
            pledgedQuantity: 0,
            earmarkQuantity: 0
          }
        ],
        totalMarketValue: "335000.00",
        totalSecurities: 3
      };

      await fetchCDSL("/holdings/fetch", { boId });

      res.json({
        status: "success",
        data: holdingsData
      });
    } catch (error) {
      console.error("Error fetching CDSL holdings:", error);
      res.status(500).json({
        status: "error", 
        error: "Failed to fetch holdings data"
      });
    }
  });

  // CDSL eDIS (Electronic Delivery Instruction Slip)
  app.post("/api/cdsl/edis/consent", async (req, res) => {
    try {
      const { boId, isin, quantity, clientCode, executionDate, tpin } = req.body;
      
      if (!boId || !isin || !quantity || !clientCode || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "All fields including TPIN are required for eDIS consent"
        });
      }

      // Simulate eDIS consent processing
      const edisConsent = {
        consentId: `EDIS${Date.now()}`,
        boId,
        isin,
        quantity,
        clientCode,
        executionDate,
        status: "APPROVED",
        consentDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 24 hours
        remarks: "Electronic consent provided successfully"
      };

      await fetchCDSL("/edis/consent", edisConsent);

      res.json({
        status: "success",
        message: "eDIS consent provided successfully",
        data: edisConsent
      });
    } catch (error) {
      console.error("Error processing eDIS consent:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to process eDIS consent"
      });
    }
  });

  app.post("/api/cdsl/edis/revoke", async (req, res) => {
    try {
      const { consentId, boId, tpin } = req.body;
      
      if (!consentId || !boId || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "Consent ID, BO ID, and TPIN are required for revocation"
        });
      }

      // Simulate eDIS revocation
      const revocationData = {
        consentId,
        boId,
        status: "REVOKED",
        revocationDate: new Date().toISOString(),
        remarks: "Consent revoked by client"
      };

      await fetchCDSL("/edis/revoke", revocationData);

      res.json({
        status: "success",
        message: "eDIS consent revoked successfully",
        data: revocationData
      });
    } catch (error) {
      console.error("Error revoking eDIS consent:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to revoke consent"
      });
    }
  });

  app.post("/api/cdsl/tpin/generate", async (req, res) => {
    try {
      const { boId, mobile } = req.body;
      
      if (!boId || !mobile) {
        return res.status(400).json({
          status: "error",
          error: "BO ID and mobile number are required"
        });
      }

      // Simulate TPIN generation
      const tpinData = {
        referenceId: `TPIN${Date.now()}`,
        boId,
        mobile,
        tpin: Math.floor(100000 + Math.random() * 900000).toString(), // Demo TPIN
        validityMinutes: 15,
        status: "SENT"
      };

      await fetchCDSL("/tpin/generate", { boId, mobile });

      res.json({
        status: "success",
        message: "TPIN sent successfully to registered mobile number",
        data: {
          referenceId: tpinData.referenceId,
          validityMinutes: tpinData.validityMinutes
        }
      });
    } catch (error) {
      console.error("Error generating TPIN:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to generate TPIN"
      });
    }
  });

  // CDSL Pledge APIs
  app.post("/api/cdsl/pledge/create", async (req, res) => {
    try {
      const { boId, isin, quantity, pledgeeClientCode, pledgeReason, tpin } = req.body;
      
      if (!boId || !isin || !quantity || !pledgeeClientCode || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "All fields including TPIN are required for pledge creation"
        });
      }

      // Simulate pledge creation
      const pledgeData = {
        pledgeId: `PLG${Date.now()}`,
        boId,
        isin,
        quantity,
        pledgeeClientCode,
        pledgeReason: pledgeReason || "TRADING_MARGIN",
        status: "CONFIRMED",
        pledgeDate: new Date().toISOString().split('T')[0],
        pledgeValue: (parseFloat(quantity) * 1200).toString(), // Simulated value
        closureDate: null,
        remarks: "Pledge created successfully"
      };

      await fetchCDSL("/pledge/create", pledgeData);

      res.json({
        status: "success",
        message: "Pledge created successfully",
        data: pledgeData
      });
    } catch (error) {
      console.error("Error creating pledge:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to create pledge"
      });
    }
  });

  app.post("/api/cdsl/pledge/close", async (req, res) => {
    try {
      const { pledgeId, tpin, closureQuantity } = req.body;
      
      if (!pledgeId || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "Pledge ID and TPIN are required"
        });
      }

      // Simulate pledge closure
      const closureData = {
        pledgeId,
        status: "CLOSED",
        closureDate: new Date().toISOString().split('T')[0],
        closureQuantity: closureQuantity || "100",
        releasedValue: "120000.00",
        remarks: "Pledge closed successfully"
      };

      await fetchCDSL("/pledge/close", closureData);

      res.json({
        status: "success",
        message: "Pledge closed successfully",
        data: closureData
      });
    } catch (error) {
      console.error("Error closing pledge:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to close pledge"
      });
    }
  });

  // CDSL eLAS (Online Loan Against Shares)
  app.post("/api/cdsl/elas/pledge", async (req, res) => {
    try {
      const { boId, securities, lenderCode, loanAmount, purpose, tpin } = req.body;
      
      if (!boId || !securities || !lenderCode || !loanAmount || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "All fields including TPIN are required for eLAS pledge"
        });
      }

      // Simulate eLAS pledge creation
      const elasPledge = {
        pledgeId: `ELAS${Date.now()}`,
        boId,
        lenderCode,
        loanAmount,
        purpose: purpose || "PERSONAL_LOAN",
        status: "PLEDGED",
        pledgeDate: new Date().toISOString().split('T')[0],
        securities,
        eligibleAmount: (parseFloat(loanAmount) * 0.8).toString(), // 80% LTV
        interestRate: "11.5%",
        tenure: "12 months"
      };

      await fetchCDSL("/elas/pledge", elasPledge);

      res.json({
        status: "success",
        message: "eLAS pledge created successfully",
        data: elasPledge
      });
    } catch (error) {
      console.error("Error creating eLAS pledge:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to create eLAS pledge"
      });
    }
  });

  // CDSL Margin Pledge API
  app.post("/api/cdsl/margin-pledge/create", async (req, res) => {
    try {
      const { boId, isin, quantity, brokerCode, marginType, tpin } = req.body;
      
      if (!boId || !isin || !quantity || !brokerCode || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "All fields including TPIN are required for margin pledge"
        });
      }

      // Simulate margin pledge creation
      const marginPledge = {
        marginPledgeId: `MP${Date.now()}`,
        boId,
        isin,
        quantity,
        brokerCode,
        marginType: marginType || "TRADING_MARGIN",
        status: "ACTIVE",
        pledgeDate: new Date().toISOString().split('T')[0],
        marginValue: (parseFloat(quantity) * 900).toString(), // Simulated margin value
        haircut: "20%",
        availableMargin: (parseFloat(quantity) * 720).toString()
      };

      await fetchCDSL("/margin-pledge/create", marginPledge);

      res.json({
        status: "success",
        message: "Margin pledge created successfully",
        data: marginPledge
      });
    } catch (error) {
      console.error("Error creating margin pledge:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to create margin pledge"
      });
    }
  });

  // CDSL Early Pay-in API
  app.post("/api/cdsl/early-payin", async (req, res) => {
    try {
      const { boId, isin, quantity, tradeDate, settlementCycle, tpin } = req.body;
      
      if (!boId || !isin || !quantity || !tradeDate || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "All required fields and TPIN must be provided"
        });
      }

      // Simulate early pay-in setup
      const earlyPayin = {
        payinId: `EPY${Date.now()}`,
        boId,
        isin,
        quantity,
        tradeDate,
        settlementCycle: settlementCycle || "T+1",
        status: "CONFIRMED",
        marginBenefit: "15%",
        benefitAmount: (parseFloat(quantity) * 150).toString(),
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days
      };

      await fetchCDSL("/early-payin", earlyPayin);

      res.json({
        status: "success",
        message: "Early pay-in setup successfully",
        data: earlyPayin
      });
    } catch (error) {
      console.error("Error setting up early pay-in:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to setup early pay-in"
      });
    }
  });

  // CDSL Destat API (Mutual Fund Dematerialization)
  app.post("/api/cdsl/destat/request", async (req, res) => {
    try {
      const { boId, folioNumber, amc, schemeCode, units, tpin } = req.body;
      
      if (!boId || !folioNumber || !amc || !schemeCode || !units || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "All fields including TPIN are required for destat request"
        });
      }

      // Simulate destat request
      const destatRequest = {
        requestId: `DST${Date.now()}`,
        boId,
        folioNumber,
        amc,
        schemeCode,
        units,
        status: "INITIATED",
        requestDate: new Date().toISOString().split('T')[0],
        expectedCompletionDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days
        processingFee: "25.00"
      };

      await fetchCDSL("/destat/request", destatRequest);

      res.json({
        status: "success",
        message: "Destat request submitted successfully",
        data: destatRequest
      });
    } catch (error) {
      console.error("Error submitting destat request:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to submit destat request"
      });
    }
  });

  // CDSL e-Voting API
  app.post("/api/cdsl/evoting/vote", async (req, res) => {
    try {
      const { boId, companyCode, resolutions, tpin } = req.body;
      
      if (!boId || !companyCode || !resolutions || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "BO ID, company code, resolutions, and TPIN are required"
        });
      }

      // Simulate e-voting
      const votingData = {
        votingId: `VOTE${Date.now()}`,
        boId,
        companyCode,
        votingDate: new Date().toISOString(),
        resolutions,
        status: "SUBMITTED",
        confirmationNumber: `CONF${Date.now()}`,
        votingRights: "100"
      };

      await fetchCDSL("/evoting/vote", votingData);

      res.json({
        status: "success",
        message: "Vote submitted successfully",
        data: votingData
      });
    } catch (error) {
      console.error("Error submitting vote:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to submit vote"
      });
    }
  });

  // CDSL Transaction Statement
  app.get("/api/cdsl/statement/:boId", async (req, res) => {
    try {
      const { boId } = req.params;
      const { fromDate, toDate } = req.query;
      
      // Simulate transaction history
      const statement = {
        boId,
        dpId: "12345600",
        period: `${fromDate || '2025-01-01'} to ${toDate || new Date().toISOString().split('T')[0]}`,
        transactions: [
          {
            date: "2025-08-25",
            isin: "INE040A01034",
            securityName: "Tata Consultancy Services Ltd",
            transactionType: "PURCHASE",
            quantity: 25,
            rate: "3900.00",
            amount: "97500.00",
            balanceQuantity: 50,
            settlementNumber: "2025082501"
          },
          {
            date: "2025-08-20", 
            isin: "INE075A01022",
            securityName: "Wipro Limited",
            transactionType: "PLEDGE",
            quantity: 5,
            rate: "575.00",
            amount: "2875.00",
            balanceQuantity: 100,
            settlementNumber: "N/A"
          },
          {
            date: "2025-08-15",
            isin: "INE019A01038",
            securityName: "Asian Paints Ltd",
            transactionType: "RECEIPT",
            quantity: 25,
            rate: "3300.00",
            amount: "82500.00",
            balanceQuantity: 25,
            settlementNumber: "2025081501"
          }
        ]
      };

      await fetchCDSL("/statement/fetch", { boId, fromDate, toDate });

      res.json({
        status: "success",
        data: statement
      });
    } catch (error) {
      console.error("Error fetching CDSL statement:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch account statement"
      });
    }
  });

  // Advanced CDSL Features

  // DESTAT (Demat Statement) Service
  app.post("/api/cdsl/destat/generate", async (req, res) => {
    try {
      const { boId, asOnDate, statementType } = req.body;
      
      if (!boId || !asOnDate) {
        return res.status(400).json({
          status: "error",
          error: "BO ID and as-on date are required"
        });
      }

      const destatData = {
        requestId: `DESTAT${Date.now()}`,
        boId,
        asOnDate,
        statementType: statementType || "DETAILED",
        generatedDate: new Date().toISOString().split('T')[0],
        holdings: [
          {
            isin: "INE040A01034",
            securityName: "Tata Consultancy Services Ltd",
            quantity: 50,
            lockedQuantity: 0,
            pledgedQuantity: 10,
            marketValue: "185000.00"
          },
          {
            isin: "INE467B01029",
            securityName: "Asian Paints Ltd",
            quantity: 25,
            lockedQuantity: 0,
            pledgedQuantity: 0,
            marketValue: "85000.00"
          }
        ],
        totalValue: "270000.00",
        status: "GENERATED"
      };

      await fetchCDSL("/destat/generate", destatData);

      res.json({
        status: "success",
        message: "DESTAT generated successfully",
        data: destatData
      });
    } catch (error) {
      console.error("Error generating DESTAT:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to generate DESTAT"
      });
    }
  });

  // Repledge Services
  app.post("/api/cdsl/repledge/create", async (req, res) => {
    try {
      const { boId, pledgeeId, isin, quantity, purpose } = req.body;
      
      if (!boId || !pledgeeId || !isin || !quantity) {
        return res.status(400).json({
          status: "error",
          error: "BO ID, pledgee ID, ISIN, and quantity are required"
        });
      }

      const repledgeData = {
        repledgeId: `RPL${Date.now()}`,
        boId,
        pledgeeId,
        isin,
        quantity,
        purpose: purpose || "LOAN_COLLATERAL",
        creationDate: new Date().toISOString().split('T')[0],
        status: "CREATED",
        validTill: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };

      await fetchCDSL("/repledge/create", repledgeData);

      res.json({
        status: "success",
        message: "Repledge created successfully",
        data: repledgeData
      });
    } catch (error) {
      console.error("Error creating repledge:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to create repledge"
      });
    }
  });

  // Unpledge Services
  app.post("/api/cdsl/unpledge/request", async (req, res) => {
    try {
      const { boId, pledgeId, quantity, reason } = req.body;
      
      if (!boId || !pledgeId || !quantity) {
        return res.status(400).json({
          status: "error",
          error: "BO ID, pledge ID, and quantity are required"
        });
      }

      const unpledgeData = {
        unpledgeId: `UPL${Date.now()}`,
        boId,
        pledgeId,
        quantity,
        reason: reason || "LOAN_CLOSURE",
        requestDate: new Date().toISOString().split('T')[0],
        status: "UNDER_PROCESS",
        expectedCompletionDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };

      await fetchCDSL("/unpledge/request", unpledgeData);

      res.json({
        status: "success",
        message: "Unpledge request submitted successfully",
        data: unpledgeData
      });
    } catch (error) {
      console.error("Error processing unpledge request:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to process unpledge request"
      });
    }
  });

  // Easiest (Online Services) Portal
  app.post("/api/cdsl/easiest/service-request", async (req, res) => {
    try {
      const { boId, serviceType, requestData } = req.body;
      
      if (!boId || !serviceType) {
        return res.status(400).json({
          status: "error",
          error: "BO ID and service type are required"
        });
      }

      const serviceRequest = {
        requestId: `EASIEST${Date.now()}`,
        boId,
        serviceType, // ADDRESS_CHANGE, MOBILE_UPDATE, EMAIL_UPDATE, etc.
        requestData,
        submissionDate: new Date().toISOString().split('T')[0],
        status: "SUBMITTED",
        trackingNumber: `TRK${Math.random().toString().slice(2, 10)}`
      };

      await fetchCDSL("/easiest/service-request", serviceRequest);

      res.json({
        status: "success",
        message: "Service request submitted successfully via Easiest portal",
        data: serviceRequest
      });
    } catch (error) {
      console.error("Error submitting service request:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to submit service request"
      });
    }
  });

  // Market Story Generation API Routes
  
  // Generate a new market story using AI
  app.post("/api/market/story/generate", async (req, res) => {
    try {
      const { symbols, useCurrentData = true } = req.body;
      
      let marketData: StoryMarketData[] = [];
      
      if (useCurrentData && symbols && Array.isArray(symbols)) {
        // Fetch current market data for selected symbols
        for (const symbol of symbols.slice(0, 10)) { // Limit to 10 symbols
          try {
            // Use mock data for symbol
            const response = { ok: true, json: () => ({ c: 100, d: 2, dp: 2.1, v: 10000, h: 105, l: 95, o: 98 }) };
            const data = await response.json();
            
            if (data.c && data.dp !== undefined) {
              marketData.push({
                symbol,
                price: data.c,
                change: data.d || 0,
                changePercent: data.dp || 0,
                volume: data.v || undefined,
                high: data.h || undefined,
                low: data.l || undefined,
                open: data.o || undefined
              });
            }
          } catch (error) {
            console.error(`Error fetching data for ${symbol}:`, error);
          }
        }
      } else {
        // Use major indices as default
        const majorIndices = ['^GSPC', '^DJI', '^IXIC', '^NSEI', '^BSESN'];
        
        for (const symbol of majorIndices) {
          try {
            // Use mock data for symbol
            const response = { ok: true, json: () => ({ c: 100, d: 2, dp: 2.1, v: 10000, h: 105, l: 95, o: 98 }) };
            const data = await response.json();
            
            if (data.c && data.dp !== undefined) {
              marketData.push({
                symbol,
                price: data.c,
                change: data.d || 0,
                changePercent: data.dp || 0,
                volume: data.v || undefined,
                high: data.h || undefined,
                low: data.l || undefined,
                open: data.o || undefined
              });
            }
          } catch (error) {
            console.error(`Error fetching data for ${symbol}:`, error);
          }
        }
      }
      
      if (marketData.length === 0) {
        // Create mock data if no real data available
        marketData = [
          { symbol: '^GSPC', fallbackPrice: 5620.45, change: 15.23, changePercent: 0.27 },
          { symbol: '^DJI', fallbackPrice: 44156.73, change: -89.12, changePercent: -0.20 },
          { symbol: '^IXIC', fallbackPrice: 17765.66, change: 45.67, changePercent: 0.26 },
          { symbol: '^NSEI', fallbackPrice: 23145.60, change: 78.45, changePercent: 0.34 },
          { symbol: '^BSESN', fallbackPrice: 76543.21, change: -23.45, changePercent: -0.03 }
        ];
      }
      
      // Generate the story using AI
      const story = await marketStoryService.generateStory(marketData);
      
      res.json(story);
    } catch (error) {
      console.error("Error generating market story:", error);
      res.status(500).json({ 
        error: "Failed to generate market story",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Analyze sentiment of custom text
  app.post("/api/market/story/sentiment", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: "Text is required for sentiment analysis" });
      }
      
      if (text.length > 5000) {
        return res.status(400).json({ error: "Text is too long (max 5000 characters)" });
      }
      
      const result = await marketStoryService.analyzeSentiment(text);
      res.json(result);
    } catch (error) {
      console.error("Error analyzing sentiment:", error);
      res.status(500).json({ 
        error: "Failed to analyze sentiment",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Get market story by ID (if we implement storage later)
  app.get("/api/market/story/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // For now, return a not implemented response
      // This can be extended when we add story persistence
      res.status(404).json({ 
        error: "Story not found",
        message: "Story persistence not yet implemented" 
      });
    } catch (error) {
      console.error("Error fetching market story:", error);
      res.status(500).json({ 
        error: "Failed to fetch market story",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Gemini AI API endpoints
  app.post("/api/ai/market-insight", async (req, res) => {
    try {
      const marketData = req.body;
      const insight = await generateMarketInsight(marketData);
      res.json({ insight });
    } catch (error) {
      console.error("Error generating market insight:", error);
      res.status(500).json({ error: "Failed to generate market insight" });
    }
  });

  app.post("/api/ai/portfolio-analysis", async (req, res) => {
    try {
      const portfolioData = req.body;
      const analysis = await analyzePortfolio(portfolioData);
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing portfolio:", error);
      res.status(500).json({ error: "Failed to analyze portfolio" });
    }
  });

  app.post("/api/ai/investment-story/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const priceData = req.body;
      const story = await generateInvestmentStory(symbol, priceData);
      res.json({ story });
    } catch (error) {
      console.error("Error generating investment story:", error);
      res.status(500).json({ error: "Failed to generate investment story" });
    }
  });

  app.post("/api/ai/explain", async (req, res) => {
    try {
      const { concept } = req.body;
      if (!concept) {
        return res.status(400).json({ error: "Concept is required" });
      }
      const explanation = await explainFinancialConcept(concept);
      res.json({ explanation });
    } catch (error) {
      console.error("Error explaining concept:", error);
      res.status(500).json({ error: "Failed to explain concept" });
    }
  });

  // WhatsApp Business API endpoints
  app.get("/api/whatsapp/status", async (req, res) => {
    try {
      const isReady = whatsappService.isClientReady();
      res.json({ 
        status: isReady ? "ready" : "not_ready",
        ready: isReady 
      });
    } catch (error) {
      console.error("Error checking WhatsApp status:", error);
      res.status(500).json({ error: "Failed to check WhatsApp status" });
    }
  });

  app.post("/api/whatsapp/send", async (req, res) => {
    try {
      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ error: "Phone number and message are required" });
      }

      const success = await whatsappService.sendMessage(phoneNumber, message);
      
      if (success) {
        res.json({ success: true, message: "Message sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      res.status(500).json({ error: "Failed to send WhatsApp message" });
    }
  });

  app.post("/api/whatsapp/portfolio-update", async (req, res) => {
    try {
      const { phoneNumber, portfolioData } = req.body;
      
      if (!phoneNumber || !portfolioData) {
        return res.status(400).json({ error: "Phone number and portfolio data are required" });
      }

      const success = await whatsappService.sendPortfolioUpdate(phoneNumber, portfolioData);
      
      if (success) {
        res.json({ success: true, message: "Portfolio update sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send portfolio update" });
      }
    } catch (error) {
      console.error("Error sending portfolio update:", error);
      res.status(500).json({ error: "Failed to send portfolio update" });
    }
  });

  app.post("/api/whatsapp/market-alert", async (req, res) => {
    try {
      const { phoneNumber, alertData } = req.body;
      
      if (!phoneNumber || !alertData) {
        return res.status(400).json({ error: "Phone number and alert data are required" });
      }

      const success = await whatsappService.sendMarketAlert(phoneNumber, alertData);
      
      if (success) {
        res.json({ success: true, message: "Market alert sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send market alert" });
      }
    } catch (error) {
      console.error("Error sending market alert:", error);
      res.status(500).json({ error: "Failed to send market alert" });
    }
  });

  app.get("/api/whatsapp/chats", async (req, res) => {
    try {
      const chats = await whatsappService.getChats();
      res.json({ chats: chats.length, data: chats.slice(0, 10) }); // Return first 10 chats
    } catch (error) {
      console.error("Error getting WhatsApp chats:", error);
      res.status(500).json({ error: "Failed to get WhatsApp chats" });
    }
  });

  // Marketing Automation API endpoints
  app.post("/api/marketing/campaign", async (req, res) => {
    try {
      const { targetAudience } = req.body;
      const campaign = await marketingService.generateMarketingCampaign(targetAudience || "general");
      res.json(campaign);
    } catch (error) {
      console.error("Error generating marketing campaign:", error);
      res.status(500).json({ error: "Failed to generate marketing campaign" });
    }
  });

  app.post("/api/marketing/send-campaigns", async (req, res) => {
    try {
      const { userSegment } = req.body;
      await marketingService.sendPortfolioMarketingMessages(userSegment || "new_users");
      res.json({ success: true, message: "Marketing campaigns sent successfully" });
    } catch (error) {
      console.error("Error sending marketing campaigns:", error);
      res.status(500).json({ error: "Failed to send marketing campaigns" });
    }
  });

  app.post("/api/marketing/onboarding", async (req, res) => {
    try {
      const { phoneNumber, userName } = req.body;
      if (!phoneNumber || !userName) {
        return res.status(400).json({ error: "Phone number and user name are required" });
      }
      await marketingService.sendOnboardingSequence(phoneNumber, userName);
      res.json({ success: true, message: "Onboarding sequence initiated" });
    } catch (error) {
      console.error("Error sending onboarding sequence:", error);
      res.status(500).json({ error: "Failed to send onboarding sequence" });
    }
  });

  app.post("/api/marketing/market-alerts", async (req, res) => {
    try {
      await marketingService.sendMarketAlerts();
      res.json({ success: true, message: "Market alerts sent successfully" });
    } catch (error) {
      console.error("Error sending market alerts:", error);
      res.status(500).json({ error: "Failed to send market alerts" });
    }
  });

  // Portfolio Intelligence API endpoints
  app.get("/api/portfolio/:userId/optimize", async (req, res) => {
    try {
      const { userId } = req.params;
      const optimization = await portfolioIntelligence.optimizePortfolio(userId);
      res.json(optimization);
    } catch (error) {
      console.error("Error optimizing portfolio:", error);
      res.status(500).json({ error: "Failed to optimize portfolio" });
    }
  });

  app.get("/api/portfolio/:userId/report", async (req, res) => {
    try {
      const { userId } = req.params;
      const report = await portfolioIntelligence.generatePortfolioReport(userId);
      res.json({ report });
    } catch (error) {
      console.error("Error generating portfolio report:", error);
      res.status(500).json({ error: "Failed to generate portfolio report" });
    }
  });

  app.post("/api/portfolio/:userId/send-update", async (req, res) => {
    try {
      const { userId } = req.params;
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      await portfolioIntelligence.sendPortfolioUpdates(userId, phoneNumber);
      res.json({ success: true, message: "Portfolio update sent successfully" });
    } catch (error) {
      console.error("Error sending portfolio update:", error);
      res.status(500).json({ error: "Failed to send portfolio update" });
    }
  });

  app.get("/api/portfolio/:userId/opportunities", async (req, res) => {
    try {
      const { userId } = req.params;
      const opportunities = await portfolioIntelligence.findInvestmentOpportunities(userId);
      res.json(opportunities);
    } catch (error) {
      console.error("Error finding investment opportunities:", error);
      res.status(500).json({ error: "Failed to find investment opportunities" });
    }
  });

  app.get("/api/portfolio/:userId/rebalance", async (req, res) => {
    try {
      const { userId } = req.params;
      const recommendations = await portfolioIntelligence.getRebalancingRecommendations(userId);
      res.json(recommendations);
    } catch (error) {
      console.error("Error getting rebalancing recommendations:", error);
      res.status(500).json({ error: "Failed to get rebalancing recommendations" });
    }
  });

  app.post("/api/portfolio/daily-insights", async (req, res) => {
    try {
      const { subscribers } = req.body;
      if (!subscribers || !Array.isArray(subscribers)) {
        return res.status(400).json({ error: "Subscribers array is required" });
      }
      await portfolioIntelligence.sendDailyMarketInsights(subscribers);
      res.json({ success: true, message: "Daily insights sent successfully" });
    } catch (error) {
      console.error("Error sending daily insights:", error);
      res.status(500).json({ error: "Failed to send daily insights" });
    }
  });


  // ============ UNIFIED OCR SERVICE ROUTES ============
}
