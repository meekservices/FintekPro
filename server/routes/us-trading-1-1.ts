import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, kycVault, usBrokerAccounts } from "@shared/schema";
import { currencyExchangeService } from "../services/currency-exchange-service";
import { usTradingService } from "../services/us-trading-service";
import { alpacaMarketDataService } from "../services/alpaca-market-data-service";
import { alpacaBrokerService } from "../services/alpaca-broker-service";
import { alpacaSseService } from "../services/alpaca-sse-service";
import { alpacaWsStreamingService } from "../services/alpaca-ws-streaming-service";
import { usOrderNotificationService } from "../services/us-order-notification-service";
import { usRebalancingEngine } from "../services/us-rebalancing-engine";
import { orderAuditHook } from "../services/order-audit-hook";
import { ComplianceAuditPackService } from "../services/compliance-audit-pack-service";
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
      identity,          // { firstName, middleName, lastName, dateOfBirth, taxId, taxIdType, countryOfCitizenship, countryOfBirth, countryOfTaxResidence, fundingSource, annualIncomeMin, annualIncomeMax, liquidNetWorthMin, liquidNetWorthMax, totalNetWorthMin, totalNetWorthMax }
      contact,           // { email, phone, streetAddress, city, state, postalCode, country }
      disclosures,       // { isControlPerson, isAffiliatedExchangeOrFinra, isPoliticallyExposed, immediateFamilyExposed }
      agreements,        // Array<{ agreement, signedAt, ipAddress }>
      documents,         // Optional Array<{ documentType, content, mimeType }>
      riskTolerance,     // "conservative" | "moderate" | "significant_risk" — top-level Alpaca field
      investmentObjective, // "growth_income" | "growth" | "capital_preservation" | "speculation" | "other"
    } = req.body;

    if (!identity || !contact || !disclosures || !agreements?.length) {
      return res.status(400).json({ success: false, error: "Missing required fields: identity, contact, disclosures, agreements" });
    }

    // 3) Check if already applied
    let brokerAccount = await usTradingService.getBrokerAccount(userId);

    // 4) Build Alpaca payload — https://docs.alpaca.markets/reference/createaccount
    //    Required top-level: account_type, contact, identity, disclosures, agreements
    //    India-specific: country fields set to IND, tax_id_type set to PAN, W-8BEN via documents
    const alpacaPayload: any = {
      // account_type: "trading" is required for standard brokerage accounts
      account_type: "trading",
      
      // Commission Rooting: Ensures FintekPro captures revenue for this account
      account_referrer: "fintekpro_app",

      // Top-level risk profile fields (not nested under identity)
      // Valid values: "conservative" | "moderate" | "significant_risk"
      risk_tolerance: (riskTolerance || "moderate") as "conservative" | "moderate" | "significant_risk",
      // Valid values: "growth_income" | "growth" | "capital_preservation" | "speculation" | "other"
      investment_objective: (investmentObjective || "growth") as string,

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
        // India: PAN card = "PAN" type; Aadhaar last 4 only (never store full Aadhaar)
        tax_id_type: identity.taxIdType || "NOT_SPECIFIED",
        country_of_citizenship: identity.countryOfCitizenship || "IND",
        country_of_birth: identity.countryOfBirth || "IND",
        country_of_tax_residence: identity.countryOfTaxResidence || "IND",
        funding_source: Array.isArray(identity.fundingSource)
          ? identity.fundingSource
          : [identity.fundingSource || "employment_income"],
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
      // W-8BEN: Required for all non-US-resident account holders (Indian residents)
      // Auto-generate from KYC data — treaty_country "IND", foreign_tax_id = PAN
      documents: documents?.length
        ? documents
        : (() => {
            if (identity.taxId && identity.dateOfBirth) {
              return [{
                document_type: "w8ben",
                content: JSON.stringify({
                  country_citizen: identity.countryOfCitizenship || "IND",
                  date_of_birth: identity.dateOfBirth,
                  full_name: `${identity.firstName}${identity.middleName ? " " + identity.middleName : ""} ${identity.lastName}`,
                  ip_address: req.ip || "0.0.0.0",
                  signed_at: new Date().toISOString(),
                  signer_full_name: `${identity.firstName} ${identity.lastName}`,
                  foreign_tax_id: identity.taxId,
                  tax_id_type: identity.taxIdType || "NOT_SPECIFIED",
                  treaty_country: identity.countryOfTaxResidence || "IND",
                  revision: "10.2018",
                }),
                mime_type: "application/json",
              }];
            }
            return [];
          })(),
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

    // 8) Generate Regulatory Audit Pack
    await ComplianceAuditPackService.generateAuditPack(
      userId,
      "account_opening",
      alpacaAccount.id,
      { provider: "Alpaca", status: alpacaAccount.status }
    );

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

/**
 * GET /account/details
 * Returns live trading account details from Alpaca — PDT flag, equity, day trade count.
 * Used by the order form to display PDT warnings before order placement.
 */
router.get("/account/details", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const brokerAccount = await usTradingService.getBrokerAccount(userId);
    if (!brokerAccount?.alpacaAccountId) {
      return res.status(404).json({ success: false, error: "No Alpaca account found" });
    }

    const tradingAccount = await alpacaBrokerService.getTradingAccount(brokerAccount.alpacaAccountId);
    if (!tradingAccount) {
      return res.status(503).json({ success: false, error: "Unable to fetch trading account from Alpaca" });
    }

    res.json({
      success: true,
      account: {
        id: tradingAccount.id,
        status: tradingAccount.status,
        currency: tradingAccount.currency,
        equity: tradingAccount.equity,
        cash: tradingAccount.cash,
        buying_power: tradingAccount.buying_power,
        portfolio_value: tradingAccount.portfolio_value,
        pattern_day_trader: tradingAccount.pattern_day_trader ?? false,
        daytrade_count: tradingAccount.daytrade_count ?? 0,
        daytrading_buying_power: tradingAccount.daytrading_buying_power,
        long_market_value: tradingAccount.long_market_value,
        short_market_value: tradingAccount.short_market_value,
        unrealized_pl: tradingAccount.unrealized_pl,
        unrealized_plpc: tradingAccount.unrealized_plpc,
        realized_pl: tradingAccount.realized_pl,
        trading_blocked: tradingAccount.trading_blocked ?? false,
        account_blocked: tradingAccount.account_blocked ?? false,
      },
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

/**
 * GET /funding/swift-instructions
 * Returns static SWIFT wire instructions for Indian investors to fund their
 * Alpaca account via LRS/SWIFT transfer from their AD-I bank.
 *
 * Note: The actual beneficiary account details (unique per user) come from the
 * Alpaca Funding Wallet API (/broker/accounts/:id/funding-wallet). This endpoint
 * provides the procedural guide and Alpaca's known routing details as a reference.
 */
router.get("/funding/swift-instructions", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const brokerAccount = await usTradingService.getBrokerAccount(userId);
    const alpacaAccountId = brokerAccount?.alpacaAccountId;

    // Alpaca / Velox Clearing SWIFT reference (same for all accounts — beneficiary
    // account number is what differs per user and comes from the funding-wallet API).
    const instructions = {
      // ── Beneficiary ────────────────────────────────────────────────────────
      beneficiary_name: "Velox Clearing LLC / FBO [Your Name]",
      beneficiary_account_note: "Use the account number from your FintekPro Funding Wallet",
      currency: "USD",

      // ── Correspondent / Intermediary bank ─────────────────────────────────
      // Indian AD-I banks typically need an intermediary US bank for SWIFT routing.
      intermediary_bank_name: "JPMorgan Chase Bank, N.A.",
      intermediary_swift_bic: "CHASUS33",
      intermediary_aba: "021000021",
      intermediary_address: "383 Madison Ave, New York, NY 10179, USA",

      // ── Beneficiary bank (Velox / Alpaca clearing) ─────────────────────────
      beneficiary_bank_name: "Velox Clearing LLC",
      beneficiary_bank_address: "299 Park Avenue, New York, NY 10171, USA",
      beneficiary_bank_country: "US",

      // ── LRS / FEMA / India Compliance ──────────────────────────────────────
      purpose_code: "S0001",   // RBI purpose code for portfolio investment (SEBI FEMA)
      lrs_annual_limit_usd: 250_000,
      form_required: "Form A2 (collected by your AD Category-I bank)",
      tcs_threshold_inr: 700_000,
      tcs_rate_percent: 20,
      tcs_note: "Your AD bank will deduct 20% TCS on LRS remittance above ₹7 lakh/FY (Finance Act 2023 §206C(1G)). Claim credit when filing ITR.",

      // ── Step-by-step guide ─────────────────────────────────────────────────
      steps: [
        {
          step: 1,
          title: "Get your unique USD account details",
          description: "Go to Funding → Wallet in FintekPro to get your dedicated USD beneficiary account number and routing details assigned by Alpaca.",
        },
        {
          step: 2,
          title: "Visit your bank's LRS / forex desk (AD Category-I bank)",
          description: "Authorised dealers: SBI, HDFC, ICICI, Axis, Kotak, YES Bank, etc. Online option: Wise, HDFC Remit, Thomas Cook.",
        },
        {
          step: 3,
          title: "Fill Form A2",
          description: "Your bank will provide Form A2 (FEMA declaration). Purpose: 'Overseas portfolio investment in listed US equities under LRS'. Purpose code: S0001.",
        },
        {
          step: 4,
          title: "Provide PAN and KYC",
          description: "Your PAN is mandatory for LRS. Bank will verify annual LRS utilization against your PAN. Ensure PAN is linked to Aadhaar.",
        },
        {
          step: 5,
          title: "Initiate SWIFT wire transfer",
          description: "Send the USD amount (after TCS deduction or net of bank charges) to your Alpaca beneficiary account. Use the SWIFT BIC of the intermediary bank shown above.",
        },
        {
          step: 6,
          title: "Track settlement",
          description: "International SWIFT transfers typically settle in 2–5 business days. Check your FintekPro Funding Wallet for the deposit to appear.",
        },
        {
          step: 7,
          title: "Maintain ITR records",
          description: "Report US assets in Schedule FA of your Indian ITR. US dividends and capital gains must be reported in Schedule FSI. Consult a CA.",
        },
      ],

      // ── Important notes ────────────────────────────────────────────────────
      important_notes: [
        "Never send INR directly — the transfer must be in USD.",
        "Your bank will convert INR to USD at their interbank rate + spread. Compare rates across banks.",
        "Each SWIFT transfer has a fixed fee (₹1,000–₹2,500 at most banks). Large transfers are more efficient.",
        "Minimum transfer: Most banks require a minimum of $500–$1,000 for LRS international wires.",
        "LRS limit resets on April 1 every financial year.",
        "Keep Form A2 receipts for at least 5 years for FEMA compliance.",
      ],

      alpaca_account_id: alpacaAccountId || null,
      generated_at: new Date().toISOString(),
    };

    res.json({ success: true, instructions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Enhanced LRS Status (Gap 5: LRS Utilisation Tracker) ───────────────────
// Returns full LRS status with INR equivalent, TCS threshold, and FY breakdown.
router.get("/lrs/status", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });

    const LRS_LIMIT_USD = 250_000;
    const TCS_THRESHOLD_INR = 700_000;

    // Current financial year (Apr–Mar)
    const now = new Date();
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const currentFY = `${fyStart}-${String(fyStart + 1).slice(-2)}`;

    const [brokerAccount] = await db
      .select({
        lrsUsedUsd: usBrokerAccounts.lrsUsedUsd,
        lrsFinancialYear: usBrokerAccounts.lrsFinancialYear,
        alpacaAccountId: usBrokerAccounts.alpacaAccountId,
      })
      .from(usBrokerAccounts)
      .where(eq(usBrokerAccounts.clientId, userId))
      .limit(1);

    let usdInrRate = 84;
    try {
      usdInrRate = await currencyExchangeService.getExchangeRate('USD', 'INR');
    } catch { /* use fallback */ }

    const usedUsd   = parseFloat(brokerAccount?.lrsUsedUsd ?? '0');
    const usedInr   = usedUsd * usdInrRate;
    const remaining = LRS_LIMIT_USD - usedUsd;
    const usedPct   = (usedUsd / LRS_LIMIT_USD) * 100;
    const tcsApplies = usedInr > TCS_THRESHOLD_INR;
    const tcsAmountInr = tcsApplies ? (usedInr - TCS_THRESHOLD_INR) * 0.20 : 0;

    res.json({
      success: true,
      financialYear: brokerAccount?.lrsFinancialYear || currentFY,
      limitUsd: LRS_LIMIT_USD,
      usedUsd,
      remainingUsd: remaining,
      usedPercent: Math.min(usedPct, 100),
      usedInr: Math.round(usedInr),
      remainingInr: Math.round(remaining * usdInrRate),
      usdInrRate,
      tcsThresholdInr: TCS_THRESHOLD_INR,
      tcsApplies,
      tcsAmountInr: Math.round(tcsAmountInr),
      warning: usedPct >= 80
        ? usedPct >= 100
          ? 'LRS annual limit exhausted. No further remittances allowed this financial year.'
          : `LRS limit ${usedPct.toFixed(1)}% used. Approaching ₹70L TCS threshold.`
        : null,
    });
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
