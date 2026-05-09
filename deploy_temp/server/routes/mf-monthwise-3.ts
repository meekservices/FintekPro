import { Express } from 'express';
import { randomInt } from 'crypto';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, desc, sql, and, or } from 'drizzle-orm';
import { auditLogArchivalService } from "../services/audit-log-archival";
import { marketStoryService, type MarketData as StoryMarketData } from "../market-story-service";
import { marketingService } from "../marketing-automation";
import { whatsappService } from "../whatsapp";
import { portfolioIntelligence } from "../portfolio-intelligence";
import { generateMarketInsight, analyzePortfolio, generateInvestmentStory, explainFinancialConcept } from "../gemini";
import { objectStorageClient as objectStorage } from "../objectStorage";

export function registerMFMonthwiPart3Routes(app: Express): void {
  async function fetchCDSL(endpoint: string, data?: any) {
    console.log(`CDSL API Call: ${endpoint}`, data);
    await new Promise(resolve => setTimeout(resolve, 500));
    return { status: "success", data: data || {} };
  }

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
          { symbol: '^GSPC', price: 5620.45, change: 15.23, changePercent: 0.27 },
          { symbol: '^DJI', price: 44156.73, change: -89.12, changePercent: -0.20 },
          { symbol: '^IXIC', price: 17765.66, change: 45.67, changePercent: 0.26 },
          { symbol: '^NSEI', price: 23145.60, change: 78.45, changePercent: 0.34 },
          { symbol: '^BSESN', price: 76543.21, change: -23.45, changePercent: -0.03 }
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
}
