import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, kycVault } from "@shared/schema";
import { usTradingService } from "../services/us-trading-service";
import { alpacaMarketDataService } from "../services/alpaca-market-data-service";
import { alpacaBrokerService } from "../services/alpaca-broker-service";
import { alpacaSseService } from "../services/alpaca-sse-service";
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
      fxRate = await alpacaMarketDataService.getUsdInrRate();
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
    const quote = await alpacaMarketDataService.getQuote(symbol);
    
    if (!quote) {
      return res.status(404).json({ success: false, error: "Quote not found" });
    }

    const fxRate = await alpacaMarketDataService.getUsdInrRate();
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
    const quotes = await alpacaMarketDataService.getMultipleQuotes(symbolList);
    const fxRate = await alpacaMarketDataService.getUsdInrRate();

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
    const details = await alpacaMarketDataService.getStockDetails(symbol);
    const quote = await alpacaMarketDataService.getQuote(symbol);
    
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

    const results = await alpacaMarketDataService.searchSymbols(
      query as string, 
      parseInt(limit as string) || 10
    );
    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


export default router;
