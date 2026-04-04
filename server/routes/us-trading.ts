import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, kycVault } from "@shared/schema";
import { usTradingService } from "../services/us-trading-service";
import { polygonMarketService } from "../services/polygon-market-service";
import { alpacaBrokerService } from "../services/alpaca-broker-service";
import { massiveWebSocketService } from "../services/massive-websocket-service";
import { usOrderNotificationService } from "../services/us-order-notification-service";
import { usRebalancingEngine } from "../services/us-rebalancing-engine";
import { orderAuditHook } from "../services/order-audit-hook";
import { kycEncryptionService } from "../services/kyc-encryption-service";
import crypto from "crypto";

const router = Router();

const orderSchema = z.object({
  symbol: z.string().min(1).max(10),
  side: z.enum(["buy", "sell"]),
  orderType: z.enum(["market", "limit", "stop", "stop_limit"]).default("market"),
  timeInForce: z.enum(["day", "gtc", "ioc", "fok"]).default("day"),
  quantity: z.number().positive().optional(),
  notionalUsd: z.number().positive().optional(),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  consent: z.boolean(),
  lrsDeclaration: z.boolean(),
});

// Get user positions (live from Alpaca when configured, graceful fallback otherwise)
router.get("/positions", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.json({
        configured: false,
        positions: [],
        totalValueUSD: 0,
        totalValueINR: 0,
        totalGainLossUSD: 0,
        totalGainLossPercent: 0,
        message: "Alpaca API not configured",
      });
    }
    const positions = await alpacaBrokerService.getPositions();
    let fxRate = 84;
    try {
      fxRate = await polygonMarketService.getUsdInrRate();
    } catch {}
    const totalValueUSD = positions.reduce((sum, p) => sum + parseFloat(p.market_value || "0"), 0);
    const totalGainLossUSD = positions.reduce((sum, p) => sum + parseFloat(p.unrealized_pl || "0"), 0);
    res.json({
      configured: true,
      isPaper: alpacaBrokerService.isPaperTrading(),
      positions: positions.map(p => ({
        symbol: p.symbol,
        quantity: parseFloat(p.qty),
        avgPrice: parseFloat(p.avg_entry_price),
        currentPrice: parseFloat(p.current_price),
        marketValue: parseFloat(p.market_value),
        gainLoss: parseFloat(p.unrealized_pl),
        gainLossPercent: parseFloat(p.unrealized_plpc) * 100,
        side: p.side,
        currency: "USD",
      })),
      totalValueUSD,
      totalValueINR: totalValueUSD * fxRate,
      totalGainLossUSD,
      totalGainLossPercent: totalValueUSD > 0 ? (totalGainLossUSD / (totalValueUSD - totalGainLossUSD)) * 100 : 0,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/feature-flags", async (req, res) => {
  try {
    const flags = await usTradingService.getFeatureFlags();
    res.json({ success: true, flags });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/feature-flags/initialize", async (req, res) => {
  try {
    await usTradingService.initializeFeatureFlags();
    const flags = await usTradingService.getFeatureFlags();
    res.json({ success: true, message: "Feature flags initialized", flags });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/feature-flags/:flagName", async (req, res) => {
  try {
    const { flagName } = req.params;
    const { isEnabled } = req.body;
    const userId = (req as any).user?.id;
    
    const success = await usTradingService.setFeatureFlag(flagName, isEnabled, userId);
    if (success) {
      res.json({ success: true, message: `Flag ${flagName} updated` });
    } else {
      res.status(400).json({ success: false, error: "Failed to update flag" });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/compliance/check", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const result = await usTradingService.checkCompliance(userId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/eligibility", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.json({
        eligible: false,
        reasons: ["Authentication required"],
        lrsUsed: 0,
        lrsLimit: 250000,
        lrsRemaining: 250000,
        riskProfile: "Unknown",
        panVerified: false,
        kycComplete: false,
      });
    }

    const compliance = await usTradingService.checkCompliance(userId);
    const lrsUsage = await usTradingService.getLrsUsage(userId);
    
    res.json({
      eligible: compliance.eligible,
      reasons: compliance.reasons || [],
      lrsUsed: lrsUsage.usedUsd || 0,
      lrsLimit: 250000,
      lrsRemaining: 250000 - (lrsUsage.usedUsd || 0),
      riskProfile: compliance.riskProfile || "Moderate",
      panVerified: compliance.panVerified || false,
      kycComplete: compliance.kycComplete || false,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/lrs/usage", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { financialYear } = req.query;
    const usage = await usTradingService.getLrsUsage(userId, financialYear as string);
    res.json({ success: true, ...usage, limitUsd: 250000 });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/broker/account", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const account = await usTradingService.getBrokerAccount(userId);
    res.json({ success: true, account });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/broker/account", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const existing = await usTradingService.getBrokerAccount(userId);
    if (existing) {
      return res.json({ success: true, account: existing, message: "Account already exists" });
    }

    const account = await usTradingService.createBrokerAccount({ clientId: userId });
    res.json({ success: true, account });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Account Opening Wizard ────────────────────────────────────────────────────

/** Pre-fill data for wizard from user profile + KYC vault */
router.get("/account/prefill", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const [kyc] = await db.select({
      kycStatus: kycVault.kycStatus,
      panVerifiedAt: kycVault.panVerifiedAt,
      aadhaarLast4: kycVault.aadhaarLast4,
    }).from(kycVault).where(eq(kycVault.userId, userId)).limit(1).catch(() => [null as any]);

    const brokerAccount = await usTradingService.getBrokerAccount(userId);
    const compliance = await usTradingService.checkCompliance(userId);

    res.json({
      success: true,
      brokerAccount,
      compliance,
      prefill: {
        firstName: user.firstName || "",
        middleName: user.middleName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.mobile || "",
        dateOfBirth: user.dateOfBirth || "",
        address: user.address || "",
        city: user.city || "",
        state: user.state || "",
        postalCode: user.pincode || "",
        country: "IND",
        panNumber: user.panNumber || "",
        taxIdType: "NOT_SPECIFIED",
        kycStatus: kyc?.kycStatus || "pending",
        panVerified: Boolean(kyc?.panVerifiedAt),
        pepStatus: user.pepStatus || "is_not_pep",
        occupation: user.occupation || "",
        annualIncome: user.annualIncome || "",
        sourceOfWealth: user.sourceOfWealth || "",
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Full Alpaca account application — creates account on Alpaca + submits CIP */
router.post("/account/apply", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    // 1) Compliance gate
    const compliance = await usTradingService.checkCompliance(userId);
    if (!compliance.eligible) {
      return res.status(400).json({ success: false, error: "Compliance requirements not met", blockers: compliance.blockers });
    }

    // 2) Parse wizard payload
    const {
      identity,    // { firstName, middleName, lastName, dateOfBirth, taxId, taxIdType, countryOfCitizenship, countryOfBirth, countryOfTaxResidence, fundingSource, annualIncomeMin, annualIncomeMax, liquidNetWorthMin, liquidNetWorthMax, totalNetWorthMin, totalNetWorthMax }
      contact,     // { email, phone, streetAddress, city, state, postalCode, country }
      disclosures, // { isControlPerson, isAffiliatedExchangeOrFinra, isPoliticallyExposed, immediateFamilyExposed }
      agreements,  // Array<{ agreement, signedAt, ipAddress }>
      documents,   // Optional Array<{ documentType, content, mimeType }>
    } = req.body;

    if (!identity || !contact || !disclosures || !agreements?.length) {
      return res.status(400).json({ success: false, error: "Missing required fields: identity, contact, disclosures, agreements" });
    }

    // 3) Check if already applied
    let brokerAccount = await usTradingService.getBrokerAccount(userId);

    // 4) Build Alpaca payload
    const alpacaPayload = {
      contact: {
        email_address: contact.email,
        phone_number: contact.phone,
        street_address: Array.isArray(contact.streetAddress) ? contact.streetAddress : [contact.streetAddress],
        city: contact.city,
        state: contact.state,
        postal_code: contact.postalCode,
        country: contact.country || "IND",
      },
      identity: {
        given_name: identity.firstName,
        family_name: identity.lastName,
        middle_name: identity.middleName || undefined,
        date_of_birth: identity.dateOfBirth,
        tax_id: identity.taxId || undefined,
        tax_id_type: identity.taxIdType || "NOT_SPECIFIED",
        country_of_citizenship: identity.countryOfCitizenship || "IND",
        country_of_birth: identity.countryOfBirth || "IND",
        country_of_tax_residence: identity.countryOfTaxResidence || "IND",
        funding_source: Array.isArray(identity.fundingSource) ? identity.fundingSource : [identity.fundingSource || "employment_income"],
        annual_income_min: identity.annualIncomeMin || "10000",
        annual_income_max: identity.annualIncomeMax || "50000",
        liquid_net_worth_min: identity.liquidNetWorthMin || "5000",
        liquid_net_worth_max: identity.liquidNetWorthMax || "50000",
        total_net_worth_min: identity.totalNetWorthMin || "10000",
        total_net_worth_max: identity.totalNetWorthMax || "100000",
      },
      disclosures: {
        is_control_person: Boolean(disclosures.isControlPerson),
        is_affiliated_exchange_or_finra: Boolean(disclosures.isAffiliatedExchangeOrFinra),
        is_politically_exposed: Boolean(disclosures.isPoliticallyExposed),
        immediate_family_exposed: Boolean(disclosures.immediateFamilyExposed),
      },
      agreements: agreements.map((a: any) => ({
        agreement: a.agreement,
        signed_at: a.signedAt || new Date().toISOString(),
        ip_address: a.ipAddress || req.ip || "0.0.0.0",
        revision: a.revision || "04.2021.10",
      })),
      documents: documents || [],
      enabled_assets: ["us_equity"],
    };

    // 5) Call Alpaca — create the sub-account
    let alpacaAccount: any;
    try {
      alpacaAccount = await alpacaBrokerService.createBrokerAccount(alpacaPayload);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || "Alpaca account creation failed";
      return res.status(422).json({ success: false, error: errMsg, alpacaError: err?.response?.data });
    }

    const applicationDataStr = JSON.stringify({ ...alpacaPayload, documents: "[REDACTED]" });

    // 6) Upsert local record
    if (brokerAccount) {
      brokerAccount = await usTradingService.updateBrokerAccount(userId, {
        alpacaAccountId: alpacaAccount.id,
        alpacaAccountNumber: alpacaAccount.account_number,
        alpacaStatus: alpacaAccount.status,
        applicationStep: "submitted",
        applicationData: applicationDataStr,
        agreementsSignedAt: new Date(),
        femaEligible: true,
        status: alpacaAccount.status === "ACTIVE" ? "live" : "pending",
      } as any);
    } else {
      brokerAccount = await usTradingService.createBrokerAccount({
        clientId: userId,
        alpacaAccountId: alpacaAccount.id,
        alpacaAccountNumber: alpacaAccount.account_number,
        alpacaStatus: alpacaAccount.status,
        applicationStep: "submitted",
        applicationData: applicationDataStr,
        agreementsSignedAt: new Date(),
        femaEligible: true,
        status: alpacaAccount.status === "ACTIVE" ? "live" : "pending",
      } as any);
    }

    // 7) Submit CIP (for fully-disclosed broker model — we run our own KYC)
    if (alpacaAccount.id && compliance.kycComplete) {
      try {
        const cipPayload = {
          provider: "FintekPro",
          kyc: {
            id: userId,
            tax_id: identity.taxId || "PENDING",
            tax_id_type: identity.taxIdType || "NOT_SPECIFIED",
            given_name: identity.firstName,
            family_name: identity.lastName,
            date_of_birth: identity.dateOfBirth,
            date_of_approval: new Date().toISOString().split("T")[0],
            date_of_expiry: new Date(Date.now() + 2 * 365 * 24 * 3600 * 1000).toISOString().split("T")[0],
            address: {
              street_address: Array.isArray(contact.streetAddress) ? contact.streetAddress : [contact.streetAddress],
              city: contact.city,
              state: contact.state,
              postal_code: contact.postalCode,
              country: contact.country || "IND",
            },
            kyc_completed_at: new Date().toISOString(),
            ip_address: req.ip || "0.0.0.0",
            risk_score: null,
            risk_level: "LOW",
            risk_categories: [],
            applicant_name: `${identity.firstName} ${identity.lastName}`,
            email_address: contact.email,
            nationality: identity.countryOfCitizenship || "IND",
            date_of_birth_full_match: true,
            country_of_residency: identity.countryOfTaxResidence || "IND",
          },
          document: {
            id: userId + "_pan",
            result: "PASS",
            status: "COMPLETE",
            type: "PAN_CARD",
            sub_type: "PAN_CARD",
            date: new Date().toISOString().split("T")[0],
            document_numbers: [{ value: "VERIFIED", type: "document_number" }],
          },
        };
        await alpacaBrokerService.submitCip(alpacaAccount.id, cipPayload);
        await usTradingService.updateBrokerAccount(userId, { cipSubmittedAt: new Date() } as any);
      } catch (cipErr: any) {
        // CIP failure is non-fatal — account still created
        console.warn("[AccountApply] CIP submission failed:", cipErr?.message);
      }
    }

    res.json({
      success: true,
      alpacaAccountId: alpacaAccount.id,
      alpacaAccountNumber: alpacaAccount.account_number,
      alpacaStatus: alpacaAccount.status,
      message: `Account ${alpacaAccount.status === "ACTIVE" ? "opened and active" : "submitted for approval"}`,
      account: brokerAccount,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Get current account status (local DB + optional Alpaca sync) */
router.get("/account/status", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const brokerAccount = await usTradingService.getBrokerAccount(userId);
    if (!brokerAccount) {
      return res.json({ success: true, hasAccount: false, alpacaStatus: "not_applied" });
    }

    // Optionally sync from Alpaca if account is in a transient state
    let liveAlpacaStatus = brokerAccount.alpacaStatus;
    if (brokerAccount.alpacaAccountId && ["SUBMITTED", "APPROVAL_PENDING", "ACTION_REQUIRED"].includes(brokerAccount.alpacaStatus || "")) {
      try {
        const liveAccount = await alpacaBrokerService.getAccount(brokerAccount.alpacaAccountId);
        if (liveAccount?.status && liveAccount.status !== brokerAccount.alpacaStatus) {
          liveAlpacaStatus = liveAccount.status;
          await usTradingService.updateBrokerAccount(userId, {
            alpacaStatus: liveAccount.status,
            status: liveAccount.status === "ACTIVE" ? "live" : "pending",
            accountApprovedAt: liveAccount.status === "APPROVED" || liveAccount.status === "ACTIVE" ? new Date() : undefined,
          } as any);
        }
      } catch {}
    }

    res.json({
      success: true,
      hasAccount: true,
      alpacaAccountId: brokerAccount.alpacaAccountId,
      alpacaAccountNumber: brokerAccount.alpacaAccountNumber,
      alpacaStatus: liveAlpacaStatus,
      applicationStep: brokerAccount.applicationStep,
      status: brokerAccount.status,
      agreementsSignedAt: brokerAccount.agreementsSignedAt,
      cipSubmittedAt: brokerAccount.cipSubmittedAt,
      accountApprovedAt: brokerAccount.accountApprovedAt,
      lrsUsedUsd: brokerAccount.lrsUsedUsd,
      lrsFinancialYear: brokerAccount.lrsFinancialYear,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/quote/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const quote = await polygonMarketService.getQuote(symbol);
    
    if (!quote) {
      return res.status(404).json({ success: false, error: "Quote not found" });
    }

    const fxRate = await polygonMarketService.getUsdInrRate();
    res.json({ 
      success: true, 
      quote,
      priceInr: quote.price * fxRate,
      fxRate,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/quotes", async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      return res.status(400).json({ success: false, error: "Symbols required" });
    }

    const symbolList = (symbols as string).split(",").map(s => s.trim().toUpperCase());
    const quotes = await polygonMarketService.getMultipleQuotes(symbolList);
    const fxRate = await polygonMarketService.getUsdInrRate();

    const result: any[] = [];
    quotes.forEach((quote, symbol) => {
      result.push({
        ...quote,
        priceInr: quote.price * fxRate,
      });
    });

    res.json({ success: true, quotes: result, fxRate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/details/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const details = await polygonMarketService.getStockDetails(symbol);
    const quote = await polygonMarketService.getQuote(symbol);
    
    res.json({ success: true, details, quote });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/search", async (req, res) => {
  try {
    const { query, limit } = req.query;
    if (!query) {
      return res.status(400).json({ success: false, error: "Query required" });
    }

    const results = await polygonMarketService.searchSymbols(
      query as string, 
      parseInt(limit as string) || 10
    );
    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/stocks", async (req, res) => {
  try {
    const stocks = await polygonMarketService.getPopularStocks();
    const fxRate = await polygonMarketService.getUsdInrRate();
    res.json({ success: true, stocks, fxRate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/etfs", async (req, res) => {
  try {
    const etfs = await polygonMarketService.getPopularETFs();
    const fxRate = await polygonMarketService.getUsdInrRate();
    res.json({ success: true, etfs, fxRate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/sp500", async (req, res) => {
  try {
    const constituents = await polygonMarketService.getSP500Constituents();
    res.json({ success: true, constituents });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/fx-rate", async (req, res) => {
  try {
    const rate = await polygonMarketService.getUsdInrRate();
    res.json({ success: true, usdInr: rate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/orders", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const data = orderSchema.parse(req.body);

    if (!data.consent || !data.lrsDeclaration) {
      return res.status(400).json({ 
        success: false, 
        error: "Both trade consent and LRS declaration must be acknowledged before placing order" 
      });
    }

    if (!data.quantity && !data.notionalUsd) {
      return res.status(400).json({ 
        success: false, 
        error: "Either quantity or notional amount is required" 
      });
    }

    const compliance = await usTradingService.checkCompliance(userId);
    if (!compliance.eligible) {
      return res.status(403).json({ 
        success: false, 
        error: "Compliance check failed",
        blockers: compliance.blockers,
      });
    }

    const fxRate = await polygonMarketService.getUsdInrRate();
    
    const order = await usTradingService.createOrder({
      clientId: userId,
      symbol: data.symbol.toUpperCase(),
      side: data.side,
      orderType: data.orderType,
      timeInForce: data.timeInForce,
      quantity: data.quantity?.toString(),
      notionalUsd: data.notionalUsd?.toString(),
      limitPrice: data.limitPrice?.toString(),
      stopPrice: data.stopPrice?.toString(),
      fxRateUsdInr: fxRate.toString(),
      status: "pending",
    });

    const consentData = {
      orderId: order.id,
      userId,
      symbol: data.symbol,
      side: data.side,
      quantity: data.quantity,
      notionalUsd: data.notionalUsd,
      consent: data.consent,
      lrsDeclaration: data.lrsDeclaration,
      timestamp: new Date().toISOString(),
    };
    const consentHash = usTradingService.generateConsentHash(consentData);
    
    await usTradingService.recordLrsDeclaration({
      clientId: userId,
      orderId: order.id,
      declarationType: "lrs_trade_declaration",
      declarationText: "I declare this transaction is within my LRS limit and complies with FEMA regulations",
      declarationHash: crypto.createHash('sha256').update(JSON.stringify({
        userId,
        orderId: order.id,
        lrsDeclaration: true,
        timestamp: new Date().toISOString(),
      })).digest('hex'),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await usTradingService.recordConsent({
      clientId: userId,
      orderId: order.id,
      consentType: "trade_approval",
      consentHash,
      consentData,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Log to immutable SEBI-compliant audit trail
    await orderAuditHook.logUSOrderCreated(
      order.id,
      userId,
      'client',
      {
        symbol: data.symbol.toUpperCase(),
        side: data.side,
        orderType: data.orderType,
        quantity: data.quantity,
        notionalUsd: data.notionalUsd,
        fxRate,
      },
      compliance,
      req
    );

    try {
      const alpacaOrder = await alpacaBrokerService.placeOrder({
        symbol: data.symbol.toUpperCase(),
        qty: data.quantity,
        notional: data.notionalUsd,
        side: data.side,
        type: data.orderType,
        time_in_force: data.timeInForce,
        limit_price: data.limitPrice,
        stop_price: data.stopPrice,
        client_order_id: order.id,
      });

      if (alpacaOrder) {
        await usTradingService.updateOrderStatus(order.id, alpacaOrder.status, {
          alpacaOrderId: alpacaOrder.id,
          alpacaClientOrderId: alpacaOrder.client_order_id,
          submittedAt: new Date(),
          filledQuantity: alpacaOrder.filled_qty,
          avgFillPrice: alpacaOrder.filled_avg_price,
          filledAt: alpacaOrder.filled_at ? new Date(alpacaOrder.filled_at) : undefined,
        });
      }

      res.json({ 
        success: true, 
        order: { ...order, alpacaOrderId: alpacaOrder?.id },
        message: "Order placed successfully",
      });
    } catch (brokerError: any) {
      await usTradingService.updateOrderStatus(order.id, "rejected");
      return res.status(400).json({ 
        success: false, 
        error: brokerError.message,
        order,
      });
    }
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: "Invalid order data", details: error.errors });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/orders", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { limit } = req.query;
    const orders = await usTradingService.getOrders(userId, parseInt(limit as string) || 50);
    res.json({ success: true, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/orders/:orderId", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const order = await usTradingService.getOrderById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (order.clientId !== userId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    res.json({ success: true, order });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/holdings", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const holdings = await usTradingService.getHoldings(userId);
    const fxRate = await polygonMarketService.getUsdInrRate();

    const enrichedHoldings = await Promise.all(
      holdings.map(async (holding) => {
        const quote = await polygonMarketService.getQuote(holding.symbol);
        return {
          ...holding,
          currentPriceUsd: quote?.price || holding.currentPriceUsd,
          currentFxRate: fxRate,
          marketValueInr: quote ? parseFloat(holding.quantity) * quote.price * fxRate : null,
        };
      })
    );

    const totalValueUsd = enrichedHoldings.reduce(
      (sum, h) => sum + (h.currentPriceUsd ? parseFloat(h.quantity) * parseFloat(h.currentPriceUsd.toString()) : 0),
      0
    );

    res.json({ 
      success: true, 
      holdings: enrichedHoldings,
      summary: {
        totalValueUsd,
        totalValueInr: totalValueUsd * fxRate,
        fxRate,
        holdingsCount: holdings.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/watchlist", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const watchlist = await usTradingService.getWatchlist(userId);
    const fxRate = await polygonMarketService.getUsdInrRate();

    const enriched = await Promise.all(
      watchlist.map(async (item) => {
        const quote = await polygonMarketService.getQuote(item.symbol);
        return { ...item, quote, fxRate };
      })
    );

    res.json({ success: true, watchlist: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/watchlist", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { symbol, notes } = req.body;
    if (!symbol) {
      return res.status(400).json({ success: false, error: "Symbol required" });
    }

    const item = await usTradingService.addToWatchlist({ 
      clientId: userId, 
      symbol: symbol.toUpperCase(),
      notes,
    });
    res.json({ success: true, item });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/watchlist/:symbol", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    await usTradingService.removeFromWatchlist(userId, req.params.symbol.toUpperCase());
    res.json({ success: true, message: "Removed from watchlist" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/broker/test-connection", async (req, res) => {
  try {
    const alpacaResult = await alpacaBrokerService.testConnection();
    const polygonResult = polygonMarketService.testConnection();
    const wsStatus = massiveWebSocketService.getStatus();

    res.json({
      success: true,
      alpaca: alpacaResult,
      polygon: polygonResult,
      massiveWebSocket: {
        configured: wsStatus.configured,
        connected: wsStatus.connected,
        authenticated: wsStatus.authenticated,
        feedType: wsStatus.feedType,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Alpaca Account Dashboard Routes ──────────────────────────────────────────

router.post("/alpaca/credentials", async (req, res) => {
  try {
    const { apiKey, secretKey, baseUrl } = req.body;
    if (!apiKey || !secretKey) {
      return res.status(400).json({ success: false, error: "apiKey and secretKey are required" });
    }
    alpacaBrokerService.configure(apiKey.trim(), secretKey.trim(), baseUrl?.trim() || undefined);
    const test = await alpacaBrokerService.testConnection();
    if (!test.success) {
      return res.status(400).json({ success: false, error: test.message });
    }
    res.json({
      success: true,
      message: `Connected to Alpaca (${alpacaBrokerService.isPaperTrading() ? "Sandbox" : "Live"})`,
      isPaper: alpacaBrokerService.isPaperTrading(),
      baseUrl: alpacaBrokerService.getBaseUrl(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/alpaca/config", async (req, res) => {
  res.json({
    configured: alpacaBrokerService.isConfigured(),
    isPaper: alpacaBrokerService.isPaperTrading(),
    baseUrl: alpacaBrokerService.getBaseUrl(),
    defaultBaseUrl: "https://broker-api.sandbox.alpaca.markets",
    isBrokerApi: alpacaBrokerService.isBrokerApi(),
  });
});

// List all broker-managed accounts (broker API only)
router.get("/alpaca/broker/accounts", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.json({ configured: false, accounts: [] });
    }
    const accounts = await alpacaBrokerService.listBrokerAccounts();
    res.json({ configured: true, accounts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/alpaca/account", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.json({ configured: false, isPaper: true });
    }
    const accountId = req.query.accountId as string | undefined;
    const account = await alpacaBrokerService.getAccount(accountId);
    res.json({ configured: true, isPaper: alpacaBrokerService.isPaperTrading(), account });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/alpaca/market-clock", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.json({ configured: false });
    }
    const clock = await alpacaBrokerService.getMarketClock();
    res.json({ configured: true, clock });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/alpaca/portfolio/history", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.json({ configured: false });
    }
    const period = (req.query.period as string) || "1M";
    const timeframe = (req.query.timeframe as string) || "1D";
    const accountId = req.query.accountId as string | undefined;
    const history = await alpacaBrokerService.getPortfolioHistory(period, timeframe, accountId);
    res.json({ configured: true, history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/alpaca/orders", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.json({ configured: false, orders: [] });
    }
    const status = (req.query.status as string) || "all";
    const limit = parseInt((req.query.limit as string) || "50");
    const accountId = req.query.accountId as string | undefined;
    const orders = await alpacaBrokerService.getOrders(status, limit, accountId);
    res.json({ configured: true, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/alpaca/orders", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca API not configured" });
    }
    const accountId = req.query.accountId as string | undefined;
    const cancelled = await alpacaBrokerService.cancelAllOrders(accountId);
    res.json({ success: true, cancelled });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/alpaca/orders/:orderId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca API not configured" });
    }
    const accountId = req.query.accountId as string | undefined;
    const ok = await alpacaBrokerService.cancelOrder(req.params.orderId, accountId);
    res.json({ success: ok });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/alpaca/positions/:symbol", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca API not configured" });
    }
    const accountId = req.query.accountId as string | undefined;
    const ok = await alpacaBrokerService.closePosition(req.params.symbol.toUpperCase(), accountId);
    res.json({ success: ok });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market-data", async (req, res) => {
  try {
    const popularSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "JNJ"];
    const etfSymbols = ["SPY", "QQQ", "VTI", "VOO", "IWM", "VUG"];
    
    const [stockQuotes, etfQuotes, exchangeRate] = await Promise.all([
      Promise.all(popularSymbols.map(async (symbol) => {
        const quote = await polygonMarketService.getQuote(symbol);
        return quote;
      })),
      Promise.all(etfSymbols.map(async (symbol) => {
        const quote = await polygonMarketService.getQuote(symbol);
        return quote;
      })),
      polygonMarketService.getUsdInrRate(),
    ]);
    
    const now = new Date();
    const nyHour = parseInt(now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }));
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const marketStatus = isWeekend ? "closed" : (nyHour >= 9 && nyHour < 16) ? "open" : "closed";
    
    res.json({
      indices: [
        { symbol: "^GSPC", name: "S&P 500", price: 5998.74, change: 23.45, changePercent: 0.39 },
        { symbol: "^IXIC", name: "NASDAQ", price: 19764.88, change: -45.32, changePercent: -0.23 },
        { symbol: "^DJI", name: "Dow Jones", price: 42992.21, change: 168.53, changePercent: 0.39 },
        { symbol: "^VIX", name: "VIX", price: 14.58, change: -0.87, changePercent: -5.63 },
      ],
      stocks: stockQuotes.filter(Boolean),
      etfs: etfQuotes.filter(Boolean),
      exchangeRate: { rate: exchangeRate, currency: "INR" },
      marketStatus,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/holdings", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.json({
        holdings: [],
        totalValue: 0,
        totalValueINR: 0,
        totalProfitLoss: 0,
        totalProfitLossPercent: 0,
      });
    }

    const holdings = await usTradingService.getHoldings(userId);
    const fxRate = await polygonMarketService.getUsdInrRate();
    
    let totalValue = 0;
    let totalCost = 0;
    
    const formattedHoldings = holdings.map((h: any) => {
      const currentPrice = parseFloat(h.currentPriceUsd) || 0;
      const avgPrice = parseFloat(h.avgPriceUsd) || 0;
      const qty = parseFloat(h.quantity) || 0;
      const value = currentPrice * qty;
      const cost = avgPrice * qty;
      const pl = value - cost;
      const plPercent = cost > 0 ? (pl / cost) * 100 : 0;
      
      totalValue += value;
      totalCost += cost;
      
      return {
        id: h.id,
        symbol: h.symbol,
        companyName: h.companyName || h.symbol,
        quantity: qty,
        avgPrice,
        currentPrice,
        totalValue: value,
        profitLoss: pl,
        profitLossPercent: plPercent,
        priceInINR: value * fxRate,
      };
    });
    
    const totalPL = totalValue - totalCost;
    const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
    
    res.json({
      holdings: formattedHoldings,
      totalValue,
      totalValueINR: totalValue * fxRate,
      totalProfitLoss: totalPL,
      totalProfitLossPercent: totalPLPercent,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/watchlist", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.json({ items: [] });
    }

    const items = await usTradingService.getWatchlist(userId);
    res.json({ items: items.map((i: any) => ({ symbol: i.symbol, addedAt: i.addedAt })) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/orders", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.json({ orders: [] });
    }

    const orders = await usTradingService.getOrders(userId);
    res.json({ 
      orders: orders.map((o: any) => ({
        id: o.id,
        symbol: o.symbol,
        side: o.side,
        quantity: parseFloat(o.quantity) || 0,
        price: parseFloat(o.filledAvgPrice || o.limitPrice || "0"),
        status: o.status,
        createdAt: o.createdAt,
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/holdings/sync", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const positions = await alpacaBrokerService.getPositions();
    const fxRate = await polygonMarketService.getUsdInrRate();

    for (const position of positions) {
      await usTradingService.upsertHolding(userId, position.symbol, {
        quantity: position.qty,
        avgPriceUsd: position.avg_entry_price,
        currentPriceUsd: position.current_price,
        marketValueUsd: position.market_value,
        unrealizedPlUsd: position.unrealized_pl,
        unrealizedPlPercent: position.unrealized_plpc,
        currentFxRate: fxRate.toString(),
        marketValueInr: (parseFloat(position.market_value) * fxRate).toString(),
        lastSyncAt: new Date(),
        assetType: "stock",
      });
    }

    res.json({ 
      success: true, 
      message: `Synced ${positions.length} positions`,
      syncedAt: new Date(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/ai/recommendations", async (req, res) => {
  try {
    const riskProfile = req.query.riskProfile as string || "moderate";
    const fxRate = await polygonMarketService.getUsdInrRate();
    
    const stockSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "JNJ"];
    const quotes = await polygonMarketService.getMultipleQuotes(stockSymbols);
    
    const recommendations = stockSymbols.map(symbol => {
      const quote = quotes.get(symbol);
      if (!quote) return null;
      
      const changeScore = quote.changePercent > 0 ? Math.min(quote.changePercent * 10, 30) : Math.max(quote.changePercent * 5, -20);
      const baseScore = 50 + changeScore + (Math.random() * 20);
      const score = Math.min(Math.max(Math.round(baseScore), 20), 95);
      
      let signal: "buy" | "hold" | "sell";
      if (score >= 70) signal = "buy";
      else if (score >= 45) signal = "hold";
      else signal = "sell";
      
      let risk: "low" | "medium" | "high";
      if (["AAPL", "MSFT", "JNJ", "JPM", "V"].includes(symbol)) risk = "low";
      else if (["GOOGL", "AMZN", "META"].includes(symbol)) risk = "medium";
      else risk = "high";
      
      const riskCompatibility: Record<string, string[]> = {
        conservative: ["low"],
        moderate: ["low", "medium"],
        aggressive: ["low", "medium", "high"],
        very_aggressive: ["low", "medium", "high"],
      };
      
      const isCompatible = riskCompatibility[riskProfile]?.includes(risk) ?? true;
      
      return {
        symbol,
        name: getStockName(symbol),
        price: quote.price,
        priceInr: quote.price * fxRate,
        change: quote.change,
        changePercent: quote.changePercent,
        score,
        signal,
        risk,
        isCompatible,
        rationale: generateRationale(symbol, signal, score),
      };
    }).filter(Boolean).sort((a: any, b: any) => b.score - a.score);
    
    res.json({ 
      success: true, 
      recommendations,
      fxRate,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function getStockName(symbol: string): string {
  const names: Record<string, string> = {
    AAPL: "Apple Inc.",
    MSFT: "Microsoft Corporation",
    GOOGL: "Alphabet Inc.",
    AMZN: "Amazon.com Inc.",
    NVDA: "NVIDIA Corporation",
    META: "Meta Platforms Inc.",
    TSLA: "Tesla Inc.",
    JPM: "JPMorgan Chase & Co.",
    V: "Visa Inc.",
    JNJ: "Johnson & Johnson",
  };
  return names[symbol] || symbol;
}

function generateRationale(symbol: string, signal: string, score: number): string {
  const rationales: Record<string, Record<string, string>> = {
    AAPL: {
      buy: "Strong ecosystem, consistent growth, and robust iPhone sales make Apple an attractive long-term investment.",
      hold: "Apple maintains solid fundamentals but current valuation suggests waiting for better entry point.",
      sell: "Near-term headwinds and competition may pressure margins.",
    },
    MSFT: {
      buy: "Cloud growth via Azure and AI integration positions Microsoft for continued expansion.",
      hold: "Microsoft remains stable but growth may be priced in at current levels.",
      sell: "Slowing enterprise spending could impact near-term performance.",
    },
    NVDA: {
      buy: "AI chip demand continues to surge, making NVIDIA a leader in the AI revolution.",
      hold: "Strong fundamentals but high valuation requires caution.",
      sell: "Potential competition and supply constraints pose risks.",
    },
  };
  
  return rationales[symbol]?.[signal] || 
    `Based on current market analysis and ${score}% confidence score, the recommendation is to ${signal} this stock.`;
}

router.get("/notifications", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const notifications = await usOrderNotificationService.getNotifications(userId, limit);
    const unreadCount = await usOrderNotificationService.getUnreadCount(userId);

    res.json({ success: true, notifications, unreadCount });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    const success = await usOrderNotificationService.markAsRead(id);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/notifications/read-all", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const success = await usOrderNotificationService.markAllAsRead(userId);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/rebalancing/analyze", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const analysis = await usRebalancingEngine.analyzePortfolio(userId);
    if (!analysis) {
      return res.status(400).json({ 
        success: false, 
        error: "Risk profile required for rebalancing analysis" 
      });
    }

    res.json({ success: true, analysis });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/rebalancing/save", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const analysis = await usRebalancingEngine.analyzePortfolio(userId);
    if (!analysis) {
      return res.status(400).json({ success: false, error: "Unable to analyze portfolio" });
    }

    const suggestionId = await usRebalancingEngine.saveSuggestion(userId, analysis);
    res.json({ success: true, suggestionId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/rebalancing/suggestion", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const suggestion = await usRebalancingEngine.getSuggestion(userId);
    res.json({ success: true, suggestion });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/ws/status", async (req, res) => {
  try {
    const status = massiveWebSocketService.getStatus();
    res.json({ success: true, ...status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ws/connect", async (req, res) => {
  try {
    const { feed } = req.body || {};
    if (!massiveWebSocketService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: "Massive WebSocket API key not configured. Set POLYGON_API_KEY.",
      });
    }
    massiveWebSocketService.connect(feed || "delayed");
    res.json({
      success: true,
      message: `Connecting to ${feed || "delayed"} feed...`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ws/disconnect", async (req, res) => {
  try {
    massiveWebSocketService.disconnect();
    res.json({ success: true, message: "Disconnected from Massive WebSocket" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const validWsChannels = ["trades", "quotes", "minuteAggs", "secondAggs", "all"] as const;

const wsSubscribeSchema = z.object({
  symbols: z.array(z.string().min(1).max(10)).min(1).max(50),
  channels: z.array(z.enum(validWsChannels)).optional(),
});

router.post("/ws/subscribe", async (req, res) => {
  try {
    const parsed = wsSubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { symbols, channels } = parsed.data;

    if (!massiveWebSocketService.isConnected()) {
      return res.status(400).json({
        success: false,
        error: "WebSocket not connected. Call POST /ws/connect first.",
      });
    }

    const channelList = channels || ["trades", "quotes", "minuteAggs"];

    if (channelList.includes("trades")) massiveWebSocketService.subscribeTrades(symbols);
    if (channelList.includes("quotes")) massiveWebSocketService.subscribeQuotes(symbols);
    if (channelList.includes("minuteAggs")) massiveWebSocketService.subscribeMinuteAggs(symbols);
    if (channelList.includes("secondAggs")) massiveWebSocketService.subscribeSecondAggs(symbols);
    if (channelList.includes("all")) massiveWebSocketService.subscribeAll(symbols);

    res.json({
      success: true,
      message: `Subscribed to ${channelList.join(", ")} for ${symbols.join(", ")}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ws/unsubscribe", async (req, res) => {
  try {
    const parsed = wsSubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { symbols, channels } = parsed.data;
    const channelList = channels || ["trades", "quotes", "minuteAggs"];

    if (channelList.includes("trades")) massiveWebSocketService.unsubscribeTrades(symbols);
    if (channelList.includes("quotes")) massiveWebSocketService.unsubscribeQuotes(symbols);
    if (channelList.includes("minuteAggs")) massiveWebSocketService.unsubscribeMinuteAggs(symbols);
    if (channelList.includes("all")) massiveWebSocketService.unsubscribeAll(symbols);

    res.json({
      success: true,
      message: `Unsubscribed from ${channelList.join(", ")} for ${symbols.join(", ")}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/ws/latest/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const quote = massiveWebSocketService.getLatestQuote(symbol);
    const trade = massiveWebSocketService.getLatestTrade(symbol);
    const agg = massiveWebSocketService.getLatestAgg(symbol);

    res.json({
      success: true,
      symbol,
      quote: quote || null,
      trade: trade || null,
      aggregate: agg || null,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/ws/latest", async (req, res) => {
  try {
    res.json({
      success: true,
      quotes: massiveWebSocketService.getAllLatestQuotes(),
      trades: massiveWebSocketService.getAllLatestTrades(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/flatfiles/datasets", async (req, res) => {
  try {
    const datasets = await polygonMarketService.getAvailableDatasets();
    res.json({ success: true, datasets });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/flatfiles/list", async (req, res) => {
  try {
    const prefix = (req.query.prefix as string) || "us_stocks_sip";
    const maxKeys = parseInt(req.query.maxKeys as string) || 50;
    const files = await polygonMarketService.listFlatFiles(prefix, maxKeys);
    res.json({ success: true, files });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/flatfiles/day-aggs/:date", async (req, res) => {
  try {
    const data = await polygonMarketService.getHistoricalDayAggs(req.params.date);
    res.json({
      success: true,
      date: req.params.date,
      count: data.length,
      data: data.slice(0, parseInt(req.query.limit as string) || 100),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// FULLY-DISCLOSED BROKER-DEALER ROUTES  (Alpaca Broker API v1)
// Prefix: /api/us-trading/broker/*
// Guards: Admin = all; Agent = view own clients; Client = own account only
// ════════════════════════════════════════════════════════════════════════════

// ─── Account Management ───────────────────────────────────────────────────────

/** List all broker-managed end-user accounts (admin/agent) */
router.get("/broker/accounts", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.json({ configured: false, accounts: [] });
    }
    const accounts = await alpacaBrokerService.listAccounts({
      query: req.query.query as string,
      status: req.query.status as string,
      created_after: req.query.created_after as string,
      created_before: req.query.created_before as string,
      sort: (req.query.sort as "asc" | "desc") || "desc",
      entities: (req.query.entities as string) || "identity,contact,disclosures",
    });
    res.json({ configured: true, accounts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Create a new end-user trading account (admin) */
router.post("/broker/accounts", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const account = await alpacaBrokerService.createBrokerAccount(req.body);
    res.status(201).json({ success: true, account });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Get a single account (admin/agent) */
router.get("/broker/accounts/:accountId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const account = await alpacaBrokerService.getAccount(req.params.accountId);
    if (!account) return res.status(404).json({ success: false, error: "Account not found" });
    res.json({ success: true, account });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Update account information (admin) */
router.patch("/broker/accounts/:accountId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const account = await alpacaBrokerService.updateBrokerAccount(req.params.accountId, req.body);
    res.json({ success: true, account });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Close / deactivate an account (admin) */
router.delete("/broker/accounts/:accountId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    await alpacaBrokerService.closeBrokerAccount(req.params.accountId);
    res.json({ success: true, message: "Account closure initiated" });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Get trading account details (equity, cash, buying power) for a sub-account */
router.get("/broker/accounts/:accountId/trading", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const account = await alpacaBrokerService.getTradingAccount(req.params.accountId);
    res.json({ success: true, account });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── CIP / KYC ────────────────────────────────────────────────────────────────

/** Submit CIP (Customer Identification Program) data for an account (admin) */
router.post("/broker/accounts/:accountId/cip", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const cip = await alpacaBrokerService.submitCip(req.params.accountId, req.body);
    res.json({ success: true, cip });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Get CIP status for an account (admin/agent) */
router.get("/broker/accounts/:accountId/cip", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const cip = await alpacaBrokerService.getCip(req.params.accountId);
    res.json({ success: true, cip });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Documents ────────────────────────────────────────────────────────────────

/** List documents for an account (admin/agent/client) */
router.get("/broker/accounts/:accountId/documents", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const docs = await alpacaBrokerService.listDocuments(req.params.accountId, {
      documents_type: req.query.documents_type as string,
      start: req.query.start as string,
      end: req.query.end as string,
    });
    res.json({ success: true, documents: docs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Upload a KYC/compliance document (admin) */
router.post("/broker/accounts/:accountId/documents", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const doc = await alpacaBrokerService.uploadDocument(req.params.accountId, req.body);
    res.status(201).json({ success: true, document: doc });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Get a signed download URL for a document */
router.get("/broker/accounts/:accountId/documents/:documentId/download", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const url = await alpacaBrokerService.downloadDocument(req.params.accountId, req.params.documentId);
    if (!url) return res.status(404).json({ success: false, error: "Document not found" });
    res.json({ success: true, url });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ACH Relationships ────────────────────────────────────────────────────────

/** List ACH bank relationships for an account */
router.get("/broker/accounts/:accountId/ach-relationships", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const relationships = await alpacaBrokerService.listAchRelationships(
      req.params.accountId,
      req.query.statuses as string,
    );
    res.json({ success: true, relationships });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Create an ACH relationship (link bank account) */
router.post("/broker/accounts/:accountId/ach-relationships", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const relationship = await alpacaBrokerService.createAchRelationship(req.params.accountId, req.body);
    res.status(201).json({ success: true, relationship });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Delete an ACH relationship */
router.delete("/broker/accounts/:accountId/ach-relationships/:achId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    await alpacaBrokerService.deleteAchRelationship(req.params.accountId, req.params.achId);
    res.json({ success: true });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

// ─── Transfers / Funding ──────────────────────────────────────────────────────

/** List transfers for an account */
router.get("/broker/accounts/:accountId/transfers", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const transfers = await alpacaBrokerService.listTransfers(req.params.accountId, {
      direction: req.query.direction as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    });
    res.json({ success: true, transfers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Initiate a transfer (deposit/withdrawal) */
router.post("/broker/accounts/:accountId/transfers", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const transfer = await alpacaBrokerService.createTransfer(req.params.accountId, req.body);
    res.status(201).json({ success: true, transfer });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Cancel a pending transfer */
router.delete("/broker/accounts/:accountId/transfers/:transferId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    await alpacaBrokerService.cancelTransfer(req.params.accountId, req.params.transferId);
    res.json({ success: true });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

// ─── Account Activities ───────────────────────────────────────────────────────

/** Get activity log for a specific account (trade confirmations, dividends, etc.) */
router.get("/broker/accounts/:accountId/activities", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const activities = await alpacaBrokerService.getAccountActivities(req.params.accountId, {
      activity_type: req.query.activity_type as string,
      date: req.query.date as string,
      until: req.query.until as string,
      after: req.query.after as string,
      direction: req.query.direction as string,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 50,
    });
    res.json({ success: true, activities });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Get activities across ALL accounts (admin-level view) */
router.get("/broker/activities", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const activities = await alpacaBrokerService.getAllActivities({
      activity_type: req.query.activity_type as string,
      account_id: req.query.account_id as string,
      date: req.query.date as string,
      until: req.query.until as string,
      after: req.query.after as string,
      direction: req.query.direction as string,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 100,
    });
    res.json({ success: true, activities });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Journals (Broker-to-Broker Fund / Securities Transfers) ─────────────────

/** List all journal entries (admin) */
router.get("/broker/journals", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const journals = await alpacaBrokerService.listJournals({
      after: req.query.after as string,
      before: req.query.before as string,
      status: req.query.status as string,
      entry_type: req.query.entry_type as string,
      to_account: req.query.to_account as string,
      from_account: req.query.from_account as string,
    });
    res.json({ success: true, journals });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Create a journal entry (JNLC = cash, JNLS = securities) (admin) */
router.post("/broker/journals", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const journal = await alpacaBrokerService.createJournal(req.body);
    res.status(201).json({ success: true, journal });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Cancel a pending journal */
router.delete("/broker/journals/:journalId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    await alpacaBrokerService.cancelJournal(req.params.journalId);
    res.json({ success: true });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

// ─── Trading: Orders per account ─────────────────────────────────────────────

/** List orders for a specific broker account */
router.get("/broker/accounts/:accountId/orders", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const orders = await alpacaBrokerService.getOrders(
      (req.query.status as string) || "all",
      req.query.limit ? parseInt(req.query.limit as string) : 50,
      req.params.accountId,
    );
    res.json({ success: true, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Place an order for a specific broker account */
router.post("/broker/accounts/:accountId/orders", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const order = await alpacaBrokerService.placeOrder({
      ...req.body,
      account_id: req.params.accountId,
    });
    res.status(201).json({ success: true, order });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Cancel a specific order for an account */
router.delete("/broker/accounts/:accountId/orders/:orderId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const ok = await alpacaBrokerService.cancelOrder(req.params.orderId, req.params.accountId);
    res.json({ success: ok });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Cancel ALL orders for an account */
router.delete("/broker/accounts/:accountId/orders", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const cancelled = await alpacaBrokerService.cancelAllOrders(req.params.accountId);
    res.json({ success: true, cancelled });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Trading: Positions per account ──────────────────────────────────────────

/** List positions for a specific broker account */
router.get("/broker/accounts/:accountId/positions", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const positions = await alpacaBrokerService.getPositions(req.params.accountId);
    res.json({ success: true, positions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Close a specific position for an account */
router.delete("/broker/accounts/:accountId/positions/:symbol", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const ok = await alpacaBrokerService.closePosition(req.params.symbol.toUpperCase(), req.params.accountId);
    res.json({ success: ok });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Close ALL positions for an account */
router.delete("/broker/accounts/:accountId/positions", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const ok = await alpacaBrokerService.closeAllPositions(
      req.params.accountId,
      req.query.cancel_orders !== "false",
    );
    res.json({ success: ok });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Portfolio History per account ────────────────────────────────────────────

router.get("/broker/accounts/:accountId/portfolio/history", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const history = await alpacaBrokerService.getPortfolioHistory(
      (req.query.period as string) || "1M",
      (req.query.timeframe as string) || "1D",
      req.params.accountId,
    );
    res.json({ success: true, history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Watchlists ────────────────────────────────────────────────────────────────

router.get("/broker/accounts/:accountId/watchlists", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const watchlists = await alpacaBrokerService.listWatchlists(req.params.accountId);
    res.json({ success: true, watchlists });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/broker/accounts/:accountId/watchlists", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const { name, symbols } = req.body;
    const watchlist = await alpacaBrokerService.createWatchlist(req.params.accountId, name, symbols || []);
    res.status(201).json({ success: true, watchlist });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

router.put("/broker/accounts/:accountId/watchlists/:watchlistId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const watchlist = await alpacaBrokerService.updateWatchlist(
      req.params.accountId,
      req.params.watchlistId,
      req.body,
    );
    res.json({ success: true, watchlist });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/broker/accounts/:accountId/watchlists/:watchlistId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    await alpacaBrokerService.deleteWatchlist(req.params.accountId, req.params.watchlistId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Reports ──────────────────────────────────────────────────────────────────

/** List generated reports (admin) */
router.get("/broker/reports", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const reports = await alpacaBrokerService.listReports({
      report_type: req.query.report_type as string,
      date: req.query.date as string,
    });
    res.json({ success: true, reports });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Create / request a report (account_statement, trade_confirmation, tax_1099) */
router.post("/broker/reports", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const report = await alpacaBrokerService.createReport(req.body);
    res.status(201).json({ success: true, report });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Get a specific report */
router.get("/broker/reports/:reportId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const report = await alpacaBrokerService.getReport(req.params.reportId);
    if (!report) return res.status(404).json({ success: false, error: "Report not found" });
    res.json({ success: true, report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Corporate Actions ────────────────────────────────────────────────────────

/** List corporate action announcements (dividends, splits, mergers) */
router.get("/broker/corporate-actions", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const actions = await alpacaBrokerService.getCorporateActions({
      ca_types: req.query.ca_types as string,
      since: req.query.since as string,
      until: req.query.until as string,
      symbol: req.query.symbol as string,
      date_type: req.query.date_type as string,
    });
    res.json({ success: true, corporate_actions: actions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Assets ───────────────────────────────────────────────────────────────────

/** List tradable assets */
router.get("/broker/assets", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const assets = await alpacaBrokerService.listAssets({
      status: (req.query.status as "active" | "inactive") || "active",
      asset_class: req.query.asset_class as "us_equity" | "crypto",
      exchange: req.query.exchange as string,
    });
    res.json({ success: true, assets });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Get a specific asset by symbol or UUID */
router.get("/broker/assets/:symbolOrId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const asset = await alpacaBrokerService.getAsset(req.params.symbolOrId.toUpperCase());
    if (!asset) return res.status(404).json({ success: false, error: "Asset not found" });
    res.json({ success: true, asset });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Market Calendar ──────────────────────────────────────────────────────────

router.get("/broker/calendar", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const calendar = await alpacaBrokerService.getMarketCalendar({
      start: req.query.start as string,
      end: req.query.end as string,
    });
    res.json({ success: true, calendar });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

