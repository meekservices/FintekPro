import { Express } from 'express';
import { randomInt } from 'crypto';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, desc, sql, and, or } from 'drizzle-orm';
import { amfiService } from "../amfi-service";
import { auditLogArchivalService } from "../services/audit-log-archival";
import { marketingService } from "../marketing-automation";
import { whatsappService } from "../whatsapp";
import { portfolioIntelligence } from "../portfolio-intelligence";
import { generateMarketInsight, analyzePortfolio, generateInvestmentStory, explainFinancialConcept } from "../gemini-service";

export function registerMFMonthwiPart1Part2Routes(app: Express): void {
  app.get("/api/iris/analytics/:userId", async (req, res) => {
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
}
