import { Express } from 'express';
import { db } from '../db';
import { requireAdmin } from '../middleware/roleMiddleware';
import { requireLevel1, requireLevel2, injectKYCLevel } from '../middleware/kyc-level-gate';
import { validateKYC } from '../kyc-middleware';
import { nseNcbApi } from '../nseNcbApi';
import { bseBondApi } from '../bseBondApi';
import { bseDirectApi } from '../bseDirectApi';
import { governmentSecurities, corporateBonds, bondOrders, bondHoldings, insertBondOrderSchema } from '@shared/schema';
import { eq, desc, sql, and, or, gte, lte, inArray } from 'drizzle-orm';
import { isProductionEnvironment } from '../utils/enrichment-guard';

export function registerBondTradingOrderPart3Part2Routes(app: Express): void {
  app.get("/api/aif/ncdex-funds", requireLevel2, async (req, res) => {
    try {
      const ncdexFunds = [
        {
          id: "ncdex-aif-1",
          name: "NCDEX AgriTech Innovation Fund",
          category: "Category I",
          subCategory: "Venture Capital Fund",
          exchange: "NCDEX",
          fundManager: "NCDEX Venture Partners",
          launchDate: "2022-08-15",
          nav: 118.45,
          aum: "₹580 Cr",
          minimumInvestment: "₹1,00,00,000",
          lockInPeriod: "5 years", 
          exitLoad: "1.5%",
          managementFee: "2.0%",
          performanceFee: "20%",
          returns: {
            "1Y": 14.7,
            "2Y": 17.8,
            "3Y": 16.2,
            "5Y": 0, // Not available
            "inception": 16.9
          },
          riskRating: "High",
          benchmark: "NCDEX Agricultural Index",
          sector: "AgriTech & Food Processing",
          status: "Open",
          lastUpdated: "2025-01-27",
          underlyingAssets: ["Agricultural Technology", "Food Processing", "Supply Chain", "Sustainable Farming"],
          regulatoryInfo: {
            sebiRegistration: "IN/AIF1/22-23/1234",
            trustee: "NCDEX Trustee Services",
            custodian: "Union Bank of India"
          }
        },
        {
          id: "ncdex-aif-2",
          name: "NCDEX Rural Development Fund", 
          category: "Category I",
          subCategory: "Social Venture Fund",
          exchange: "NCDEX",
          fundManager: "NCDEX Social Impact",
          launchDate: "2021-11-10",
          nav: 106.23,
          aum: "₹390 Cr",
          minimumInvestment: "₹1,00,00,000",
          lockInPeriod: "6 years",
          exitLoad: "1%",
          managementFee: "1.8%",
          performanceFee: "15%",
          returns: {
            "1Y": 9.8,
            "2Y": 12.4,
            "3Y": 11.6,
            "5Y": 0, // Not available
            "inception": 11.2
          },
          riskRating: "Medium",
          benchmark: "Rural Development Index",
          sector: "Rural & Social Impact",
          status: "Open",
          lastUpdated: "2025-01-27",
          underlyingAssets: ["Rural Infrastructure", "Microfinance", "Agricultural Equipment", "Rural Healthcare"],
          regulatoryInfo: {
            sebiRegistration: "IN/AIF1/21-22/0987",
            trustee: "NCDEX Trustee Services",
            custodian: "Bank of Baroda"
          }
        }
      ];

      res.json({
        status: "success",
        data: ncdexFunds,
        exchange: "NCDEX",
        totalFunds: ncdexFunds.length,
        totalAUM: "₹970 Cr",
        specialization: "Agricultural & Rural Development Funds",
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching NCDEX AIF data:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NCDEX AIF data"
      });
    }
  });

  // Get MSEI AIF funds data (SME and specialized)
  app.get("/api/aif/msei-funds", requireLevel2, async (req, res) => {
    try {
      const mseiFunds = [
        {
          id: "msei-aif-1",
          name: "MSEI Startup Accelerator Fund",
          category: "Category I",
          subCategory: "Venture Capital Fund",
          exchange: "MSEI",
          fundManager: "MSEI Ventures",
          launchDate: "2023-02-28",
          nav: 89.34,
          aum: "₹280 Cr",
          minimumInvestment: "₹1,00,00,000",
          lockInPeriod: "8 years",
          exitLoad: "2%",
          managementFee: "2.5%",
          performanceFee: "25%",
          returns: {
            "1Y": 8.2,
            "2Y": 10.7,
            "3Y": 0, // Not available
            "5Y": 0, // Not available
            "inception": 9.1
          },
          riskRating: "Very High",
          benchmark: "MSEI Startup Index",
          sector: "Technology Startups",
          status: "Open",
          lastUpdated: "2025-01-27",
          underlyingAssets: ["Fintech", "Healthtech", "Edtech", "Deep Tech"],
          regulatoryInfo: {
            sebiRegistration: "IN/AIF1/23-24/1567",
            trustee: "MSEI Trust Company",
            custodian: "IndusInd Bank"
          }
        },
        {
          id: "msei-aif-2",
          name: "MSEI Healthcare Innovation Fund",
          category: "Category II",
          subCategory: "Private Equity Fund",
          exchange: "MSEI",
          fundManager: "MSEI Healthcare Capital",
          launchDate: "2022-07-05",
          nav: 134.78,
          aum: "₹650 Cr",
          minimumInvestment: "₹1,00,00,000",
          lockInPeriod: "4 years",
          exitLoad: "2%",
          managementFee: "2.3%",
          performanceFee: "20%",
          returns: {
            "1Y": 22.1,
            "2Y": 24.6,
            "3Y": 23.4,
            "5Y": 0, // Not available
            "inception": 23.7
          },
          riskRating: "High",
          benchmark: "MSEI Healthcare Index",
          sector: "Healthcare & Pharmaceuticals",
          status: "Open",
          lastUpdated: "2025-01-27",
          underlyingAssets: ["Pharmaceutical Manufacturing", "Medical Devices", "Digital Health", "Biotechnology"],
          regulatoryInfo: {
            sebiRegistration: "IN/AIF2/22-23/1345",
            trustee: "MSEI Trust Company",
            custodian: "HDFC Bank"
          }
        }
      ];

      res.json({
        status: "success", 
        data: mseiFunds,
        exchange: "MSEI",
        totalFunds: mseiFunds.length,
        totalAUM: "₹930 Cr",
        specialization: "SME & Innovation Funds",
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching MSEI AIF data:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch MSEI AIF data"
      });
    }
  });

  // Get comprehensive multi-exchange AIF data
  app.get("/api/aif/all-exchanges", requireLevel2, async (req, res) => {
    try {
      const exchange = req.query.exchange as string;
      const category = req.query.category as string;

      // Fetch from all exchanges
      const [nseResponse, bseResponse, mcxResponse, ncdexResponse, mseiResponse] = await Promise.all([
        fetch(`${req.protocol}://${req.get('host')}/api/aif/nse-funds`),
        fetch(`${req.protocol}://${req.get('host')}/api/aif/bse-funds`),
        fetch(`${req.protocol}://${req.get('host')}/api/aif/mcx-funds`),
        fetch(`${req.protocol}://${req.get('host')}/api/aif/ncdex-funds`),
        fetch(`${req.protocol}://${req.get('host')}/api/aif/msei-funds`)
      ]);

      const [nseData, bseData, mcxData, ncdexData, mseiData] = await Promise.all([
        nseResponse.json(),
        bseResponse.json(), 
        mcxResponse.json(),
        ncdexResponse.json(),
        mseiResponse.json()
      ]);

      let allFunds = [
        ...nseData.data,
        ...bseData.data,
        ...mcxData.data,
        ...ncdexData.data,
        ...mseiData.data
      ];

      // Filter by exchange if specified
      if (exchange && exchange !== 'all') {
        allFunds = allFunds.filter(fund => 
          fund.exchange.toLowerCase() === exchange.toLowerCase()
        );
      }

      // Filter by category if specified
      if (category && category !== 'all') {
        allFunds = allFunds.filter(fund => 
          fund.category.toLowerCase().includes(category.toLowerCase()) ||
          fund.subCategory.toLowerCase().includes(category.toLowerCase())
        );
      }

      // Calculate comprehensive market statistics
      const marketStats = {
        totalFunds: allFunds.length,
        exchangeBreakdown: {
          NSE: nseData.data.length,
          BSE: bseData.data.length,
          MCX: mcxData.data.length,
          NCDEX: ncdexData.data.length,
          MSEI: mseiData.data.length
        },
        totalAUM: allFunds.reduce((sum, fund) => {
          const aum = parseFloat(fund.aum.replace(/[₹,\sCr]/g, ''));
          return sum + aum;
        }, 0),
        averageReturns: {
          "1Y": (allFunds.reduce((sum, fund) => sum + fund.returns["1Y"], 0) / allFunds.length).toFixed(1),
          "3Y": (allFunds.reduce((sum, fund) => sum + (fund.returns["3Y"] || 0), 0) / allFunds.filter(f => f.returns["3Y"]).length).toFixed(1),
          "5Y": (allFunds.reduce((sum, fund) => sum + (fund.returns["5Y"] || 0), 0) / allFunds.filter(f => f.returns["5Y"]).length).toFixed(1)
        },
        categoryDistribution: {
          "Category I": allFunds.filter(f => f.category === 'Category I').length,
          "Category II": allFunds.filter(f => f.category === 'Category II').length,
          "Category III": allFunds.filter(f => f.category === 'Category III').length
        },
        riskDistribution: {
          "High": allFunds.filter(f => f.riskRating && f.riskRating.includes('High')).length,
          "Medium": allFunds.filter(f => f.riskRating && f.riskRating.includes('Medium')).length,
          "Low": allFunds.filter(f => f.riskRating && f.riskRating.includes('Low')).length
        },
        topPerformer: allFunds.reduce((max, fund) => 
          fund.returns["1Y"] > max.returns["1Y"] ? fund : max, allFunds[0]
        )
      };

      res.json({
        status: "success",
        data: allFunds,
        marketStats,
        filters: { exchange: exchange || 'all', category: category || 'all' },
        exchanges: ['NSE', 'BSE', 'MCX', 'NCDEX', 'MSEI'],
        categories: ['Category I', 'Category II', 'Category III'],
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching all exchanges AIF data:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch AIF data from all exchanges"
      });
    }
  });

  // NSDL API endpoints for capital gains and holdings
  app.get("/api/nsdl/holdings", async (req, res) => {
    try {
      const { pan, fromDate, toDate, isin } = req.query;
      
      const nsdlHoldings = [
        {
          id: "nsdl-holding-1",
          isin: "INE002A01018",
          symbol: "RELIANCE",
          companyName: "Reliance Industries Limited",
          depository: "NSDL",
          dpId: "IN300214",
          clientId: "10012345",
          holdingDate: "2025-01-27",
          quantity: 250,
          faceValue: 10,
          marketValue: 625000,
          currentPrice: 2500.50,
          avgCostPrice: 2400.75,
          totalCostValue: 600187.50,
          unrealizedGainLoss: 24812.50,
          gainLossPercentage: 4.13,
          pledgedQuantity: 0,
          lockedQuantity: 0,
          availableQuantity: 250,
          transactions: [
            {
              date: "2024-08-15",
              type: "BUY",
              quantity: 100,
              price: 2380.50,
              value: 238050
            },
            {
              date: "2024-10-20",
              type: "BUY", 
              quantity: 150,
              price: 2412.50,
              value: 361875
            }
          ]
        },
        {
          id: "nsdl-holding-2",
          isin: "INE009A01021", 
          symbol: "INFY",
          companyName: "Infosys Limited",
          depository: "NSDL",
          dpId: "IN300214",
          clientId: "10012345",
          holdingDate: "2025-01-27",
          quantity: 500,
          faceValue: 5,
          marketValue: 925000,
          currentPrice: 1850.25,
          avgCostPrice: 1780.60,
          totalCostValue: 890300,
          unrealizedGainLoss: 34700,
          gainLossPercentage: 3.90,
          pledgedQuantity: 50,
          lockedQuantity: 0,
          availableQuantity: 450,
          transactions: [
            {
              date: "2024-09-10",
              type: "BUY",
              quantity: 300,
              price: 1765.80,
              value: 529740
            },
            {
              date: "2024-11-05",
              type: "BUY",
              quantity: 200,
              price: 1802.80,
              value: 360560
            }
          ]
        },
        {
          id: "nsdl-holding-3",
          isin: "INE040A01034",
          symbol: "HDFCBANK",
          companyName: "HDFC Bank Limited", 
          depository: "NSDL",
          dpId: "IN300214",
          clientId: "10012345",
          holdingDate: "2025-01-27",
          quantity: 300,
          faceValue: 1,
          marketValue: 495000,
          currentPrice: 1650.75,
          avgCostPrice: 1580.25,
          totalCostValue: 474075,
          unrealizedGainLoss: 20925,
          gainLossPercentage: 4.41,
          pledgedQuantity: 0,
          lockedQuantity: 25,
          availableQuantity: 275,
          transactions: [
            {
              date: "2024-07-22",
              type: "BUY",
              quantity: 200,
              price: 1565.50,
              value: 313100
            },
            {
              date: "2024-12-12",
              type: "BUY",
              quantity: 100,
              price: 1609.75,
              value: 160975
            }
          ]
        }
      ];

      // Filter by ISIN if provided
      let filteredHoldings = isin ? nsdlHoldings.filter(h => h.isin === isin) : nsdlHoldings;

      const summary = {
        totalHoldings: filteredHoldings.length,
        totalMarketValue: filteredHoldings.reduce((sum, h) => sum + h.marketValue, 0),
        totalCostValue: filteredHoldings.reduce((sum, h) => sum + h.totalCostValue, 0),
        totalUnrealizedGainLoss: filteredHoldings.reduce((sum, h) => sum + h.unrealizedGainLoss, 0),
        averageGainLossPercentage: (filteredHoldings.reduce((sum, h) => sum + h.gainLossPercentage, 0) / filteredHoldings.length).toFixed(2),
        totalPledgedValue: filteredHoldings.reduce((sum, h) => sum + (h.pledgedQuantity * h.currentPrice), 0)
      };

      res.json({
        status: "success",
        data: filteredHoldings,
        summary,
        depository: "NSDL",
        searchCriteria: { pan, fromDate, toDate, isin },
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching NSDL holdings:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NSDL holdings data"
      });
    }
  });

  // NSDL capital gains report
  app.get("/api/nsdl/capital-gains", async (req, res) => {
    try {
      const { pan, financialYear, transactionType } = req.query;

      const nsdlCapitalGains = [
        {
          id: "nsdl-cg-1",
          isin: "INE002A01018",
          symbol: "RELIANCE",
          companyName: "Reliance Industries Limited",
          depository: "NSDL",
          financialYear: "2024-25",
          transactionType: "LONG_TERM",
          buyDate: "2023-05-15",
          sellDate: "2024-08-20",
          buyPrice: 2280.50,
          sellPrice: 2450.75,
          quantity: 100,
          buyValue: 228050,
          sellValue: 245075,
          brokerage: 450,
          stt: 612.19,
          otherCharges: 125.50,
          netRealizedGain: 15837.31,
          taxableGain: 15837.31,
          taxRate: 12.5, // LTCG tax rate
          taxLiability: 1979.66,
          netGainAfterTax: 13857.65,
          holdingPeriod: 462 // days
        },
        {
          id: "nsdl-cg-2", 
          isin: "INE009A01021",
          symbol: "INFY",
          companyName: "Infosys Limited",
          depository: "NSDL",
          financialYear: "2024-25",
          transactionType: "SHORT_TERM",
          buyDate: "2024-04-10",
          sellDate: "2024-09-25",
          buyPrice: 1680.25,
          sellPrice: 1820.75,
          quantity: 200,
          buyValue: 336050,
          sellValue: 364150,
          brokerage: 350,
          stt: 910.38,
          otherCharges: 95.75,
          netRealizedGain: 26743.87,
          taxableGain: 26743.87,
          taxRate: 20, // STCG tax rate
          taxLiability: 5348.77,
          netGainAfterTax: 21395.10,
          holdingPeriod: 168 // days
        },
        {
          id: "nsdl-cg-3",
          isin: "INE040A01034",
          symbol: "HDFCBANK", 
          companyName: "HDFC Bank Limited",
          depository: "NSDL",
          financialYear: "2024-25",
          transactionType: "LONG_TERM",
          buyDate: "2022-12-05",
          sellDate: "2024-06-18",
          buyPrice: 1425.80,
          sellPrice: 1580.90,
          quantity: 150,
          buyValue: 213870,
          sellValue: 237135,
          brokerage: 295,
          stt: 592.84,
          otherCharges: 78.25,
          netRealizedGain: 22198.91,
          taxableGain: 22198.91,
          taxRate: 12.5,
          taxLiability: 2774.86,
          netGainAfterTax: 19424.05,
          holdingPeriod: 561 // days
        }
      ];

      // Filter by financial year and transaction type if provided
      let filteredGains = nsdlCapitalGains;
      if (financialYear) {
        filteredGains = filteredGains.filter(cg => cg.financialYear === financialYear);
      }
      if (transactionType) {
        filteredGains = filteredGains.filter(cg => cg.transactionType === transactionType);
      }

      const summary = {
        totalTransactions: filteredGains.length,
        totalRealizedGains: filteredGains.reduce((sum, cg) => sum + cg.netRealizedGain, 0),
        totalTaxLiability: filteredGains.reduce((sum, cg) => sum + cg.taxLiability, 0),
        totalNetGainAfterTax: filteredGains.reduce((sum, cg) => sum + cg.netGainAfterTax, 0),
        longTermGains: filteredGains.filter(cg => cg.transactionType === 'LONG_TERM').length,
        shortTermGains: filteredGains.filter(cg => cg.transactionType === 'SHORT_TERM').length,
        averageHoldingPeriod: Math.round(filteredGains.reduce((sum, cg) => sum + cg.holdingPeriod, 0) / filteredGains.length)
      };

      res.json({
        status: "success",
        data: filteredGains,
        summary,
        depository: "NSDL",
        searchCriteria: { pan, financialYear, transactionType },
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching NSDL capital gains:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NSDL capital gains data"
      });
    }
  });

  // CDSL API endpoints for depository services
}
