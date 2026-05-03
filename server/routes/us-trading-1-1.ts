import { Router, Request, Response } from "express";
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
// Types are centralized in a dedicated module — no interface/type declarations in route file
import type { AuthRequest, AgreementInput, AlpacaAccountCreated, AlpacaBrokerAccountPayload, AxiosLikeError } from "../types/broker-types";
import { extractErrorMessage, resolveRiskTolerance, resolveInvestmentObjective } from "../types/broker-types";


import { requireAuth, requireAdmin } from "../middleware/auth";
import { alpacaAccountGuard } from "../middleware/rbac";

const router: Router = Router();

// Apply authentication to all routes in this file
router.use(requireAuth);


function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

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
router.get("/positions", async (_req: Request, res: Response): Promise<void> => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      res.json({
        configured: false,
        positions: [],
        totalValueUSD: 0,
        totalValueINR: 0,
        totalGainLossUSD: 0,
        totalGainLossPercent: 0,
        message: "Alpaca API not configured",
      });
      return;
    }
    const positions = await alpacaBrokerService.getPositions();
    let fxRate = 84;
    try {
      fxRate = await alpacaMarketDataService.getUsdInrRate();
    } catch { /* use fallback */ }

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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

router.get("/feature-flags", async (_req: Request, res: Response): Promise<void> => {
  try {
    const flags = await usTradingService.getFeatureFlags();
    res.json({ success: true, flags });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

/** Initialize feature flags (Admin only) */
router.post("/feature-flags/initialize", requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    await usTradingService.initializeFeatureFlags();
    const flags = await usTradingService.getFeatureFlags();
    res.json({ success: true, message: "Feature flags initialized", flags });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

/** Update feature flag (Admin only) */
router.patch("/feature-flags/:flagName", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { flagName } = req.params;
    const { isEnabled } = req.body as { isEnabled: boolean };
    const userId = (req as AuthRequest).user?.id;
    
    const success = await usTradingService.setFeatureFlag(flagName, isEnabled, userId);
    if (success) {
      res.json({ success: true, message: `Flag ${flagName} updated` });
    } else {
      res.status(400).json({ success: false, error: "Failed to update flag" });
    }
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

router.get("/compliance/check", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const result = await usTradingService.checkCompliance(userId);
    res.json({ success: true, ...result });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

router.get("/eligibility", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.json({
        eligible: false,
        reasons: ["Authentication required"],
        lrsUsed: 0,
        lrsLimit: 250000,
        lrsRemaining: 250000,
        riskProfile: "Unknown",
        panVerified: false,
        kycComplete: false,
      });
      return;
    }

    const compliance = await usTradingService.checkCompliance(userId);
    const lrsUsage = await usTradingService.getLrsUsage(userId);
    
    res.json({
      eligible: compliance.eligible,
      reasons: compliance.blockers || [],
      lrsUsed: lrsUsage.used || 0,
      lrsLimit: 250000,
      lrsRemaining: 250000 - (lrsUsage.used || 0),
      riskProfile: compliance.riskProfile || "Moderate",
      panVerified: compliance.checks?.panVerified || false,
      kycComplete: compliance.kycComplete || false,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

router.get("/lrs/usage", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const financialYearParam = typeof req.query.financialYear === "string" ? req.query.financialYear : undefined;
    const usage = await usTradingService.getLrsUsage(userId, financialYearParam);
    res.json({ success: true, ...usage, limitUsd: 250000 });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

router.get("/broker/account", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const account = await usTradingService.getBrokerAccount(userId);
    res.json({ success: true, account });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

router.post("/broker/account", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const existing = await usTradingService.getBrokerAccount(userId);
    if (existing) {
      res.json({ success: true, account: existing, message: "Account already exists" });
      return;
    }

    const account = await usTradingService.createBrokerAccount({ clientId: userId });
    res.json({ success: true, account });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

// ─── Account Opening Wizard ────────────────────────────────────────────────────

/** Pre-fill data for wizard from user profile + KYC vault */
router.get("/account/prefill", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    const [kyc] = await db.select({
      kycStatus: kycVault.kycStatus,
      panVerifiedAt: kycVault.panVerifiedAt,
      aadhaarLast4: kycVault.aadhaarLast4,
    }).from(kycVault).where(eq(kycVault.userId, userId)).limit(1).catch(() => [{
      kycStatus: "pending",
      panVerifiedAt: null,
      aadhaarLast4: null
    }]);

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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

/** Full Alpaca account application — creates account on Alpaca + submits CIP */
router.post("/account/apply", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    // 1) Compliance gate
    const compliance = await usTradingService.checkCompliance(userId);
    if (!compliance.eligible) {
      res.status(400).json({ success: false, error: "Compliance requirements not met", blockers: compliance.blockers });
      return;
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
    } = req.body as {
      identity?: any;
      contact?: any;
      disclosures?: any;
      agreements?: any[];
      documents?: any[];
      riskTolerance?: any;
      investmentObjective?: any;
    };

    if (!identity || !contact || !disclosures || !agreements?.length) {
      res.status(400).json({ success: false, error: "Missing required fields: identity, contact, disclosures, agreements" });
      return;
    }

    // 3) Check if already applied
    let brokerAccount = await usTradingService.getBrokerAccount(userId);

    // 4) Build Alpaca payload — https://docs.alpaca.markets/reference/createaccount
    //    Required top-level: account_type, contact, identity, disclosures, agreements
    //    India-specific: country fields set to IND, tax_id_type set PAN, W-8BEN via documents
    const resolvedRisk = resolveRiskTolerance(riskTolerance);
    const resolvedObjective = resolveInvestmentObjective(investmentObjective);

    const alpacaPayload: AlpacaBrokerAccountPayload = {
      // account_type: "trading" is required for standard brokerage accounts (per Alpaca docs)
      account_type: "trading",

      // Commission Routing: Ensures FintekPro captures revenue for this account
      account_referrer: "fintekpro_app",

      // Top-level risk profile fields (not nested under identity)
      risk_tolerance: resolvedRisk,
      investment_objective: resolvedObjective,

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
      agreements: (agreements as AgreementInput[]).map((a: AgreementInput) => ({
        agreement: a.agreement,
        signed_at: a.signedAt ?? new Date().toISOString(),
        ip_address: a.ipAddress ?? req.ip ?? "0.0.0.0",
        // Use env var so we can update without code deploy when Alpaca releases new agreement versions
        revision: a.revision ?? process.env.ALPACA_AGREEMENT_REVISION ?? "04.2021.10",
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
                  // W-8BEN revision: updated to October 2021 form (IRS Rev. Oct 2021)
                  // Update ALPACA_W8BEN_REVISION env var when IRS releases a new version
                  revision: process.env.ALPACA_W8BEN_REVISION || "10.2021",
                }),
                mime_type: "application/json",
              }];
            }
            return [];
          })(),
      enabled_assets: ["us_equity"],
    };

    // 5) Call Alpaca — create the sub-account
    // Note: catch block always returns, so alpacaAccount is defined after this block
    let alpacaAccount: AlpacaAccountCreated | undefined;
    try {
      alpacaAccount = await alpacaBrokerService.createBrokerAccount(alpacaPayload);
    } catch (err: unknown) {
      const errMsg = extractErrorMessage(err, "Alpaca account creation failed");
      const axErr = err as AxiosLikeError;
      return res.status(422).json({ success: false, error: errMsg, alpacaError: axErr?.response?.data });
    }
    // TypeScript control-flow guard: alpacaAccount is always set after the try block above
    if (!alpacaAccount) return res.status(500).json({ success: false, error: "Account creation returned no data" });

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
      });
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
      });
    }

    // 7) Submit CIP (for fully-disclosed broker model — we run our own KYC)
    if (alpacaAccount.id && compliance.kycComplete) {
      try {
        const cipPayload = {
          provider_name: ["FintekPro"],
          kyc: {
            id: userId,
            risk_level: "LOW",
            risk_score: 0,
            applicant_name: `${identity.firstName} ${identity.lastName}`,
            email_address: contact.email,
            nationality: identity.countryOfCitizenship || "IND",
            date_of_birth: identity.dateOfBirth,
            status: "COMPLETE",
            result: "PASS",
          },
          document: {
            id: userId + "_pan",
            result: "PASS",
            status: "COMPLETE",
          },
        };
        await alpacaBrokerService.submitCip(alpacaAccount.id, cipPayload);
        await usTradingService.updateBrokerAccount(userId, { cipSubmittedAt: new Date() });
      } catch (cipErr: unknown) {
        // CIP failure is non-fatal — account still created
        console.warn("[AccountApply] CIP submission failed:", (cipErr as Error)?.message);
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, error: message });
  }
});

/** Get current account status (local DB + optional Alpaca sync) */
router.get("/account/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const brokerAccount = await usTradingService.getBrokerAccount(userId);
    if (!brokerAccount) {
      res.json({ success: true, hasAccount: false, alpacaStatus: "not_applied" });
      return;
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
          });
        }
      } catch { /* use existing */ }
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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

/**
 * GET /account/details
 * Returns live trading account details from Alpaca — PDT flag, equity, day trade count.
 * Used by the order form to display PDT warnings before order placement.
 */
router.get("/account/details", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const brokerAccount = await usTradingService.getBrokerAccount(userId);
    if (!brokerAccount?.alpacaAccountId) {
      res.status(404).json({ success: false, error: "No Alpaca account found" });
      return;
    }

    const tradingAccount = await alpacaBrokerService.getTradingAccount(brokerAccount.alpacaAccountId);
    if (!tradingAccount) {
      res.status(503).json({ success: false, error: "Unable to fetch trading account from Alpaca" });
      return;
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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

router.get("/market/quote/:symbol", async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol } = req.params;
    const quote = await alpacaMarketDataService.getQuote(symbol);
    
    if (!quote) {
      res.status(404).json({ success: false, error: "Quote not found" });
      return;
    }

    const fxRate = await alpacaMarketDataService.getUsdInrRate();
    res.json({ 
      success: true, 
      quote,
      priceInr: quote.price * fxRate,
      fxRate,
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

router.get("/market/quotes", async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      res.status(400).json({ success: false, error: "Symbols required" });
      return;
    }

    const symbolList = (typeof symbols === "string" ? symbols : "").split(",").map((s) => s.trim().toUpperCase());
    const quotes = await alpacaMarketDataService.getMultipleQuotes(symbolList);
    const fxRate = await alpacaMarketDataService.getUsdInrRate();

    const resultQuotes = quotes ? [...quotes.values()].map((quote) => ({
      ...quote,
      priceInr: quote.price * fxRate,
    })) : [];

    res.json({ success: true, quotes: resultQuotes, fxRate });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

router.get("/market/details/:symbol", async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol } = req.params;
    const details = await alpacaMarketDataService.getStockDetails(symbol);
    const quote = await alpacaMarketDataService.getQuote(symbol);
    
    res.json({ success: true, details, quote });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
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
router.get("/funding/swift-instructions", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

// ─── Enhanced LRS Status (Gap 5: LRS Utilisation Tracker) ───────────────────
// Returns full LRS status with INR equivalent, TCS threshold, and FY breakdown.
router.get("/lrs/status", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const LRS_LIMIT_USD = 250_000;
    const TCS_THRESHOLD_INR = 700_000;

    // Current financial year (Apr–Mar)
    const now = new Date();
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const currentFY = `${fyStart}-${String(fyStart + 1).slice(-2)}`;

    // LRS is a per-PAN (per-person) limit — aggregate across ALL Alpaca accounts for this user.
    // A user could have multiple sub-accounts (e.g. individual + joint) — TCS is calculated on total.
    const allBrokerAccounts = await db
      .select({
        lrsUsedUsd: usBrokerAccounts.lrsUsedUsd,
        lrsFinancialYear: usBrokerAccounts.lrsFinancialYear,
        alpacaAccountId: usBrokerAccounts.alpacaAccountId,
      })
      .from(usBrokerAccounts)
      .where(eq(usBrokerAccounts.clientId, userId));

    const brokerAccount = allBrokerAccounts[0]; // primary account for FY label

    let usdInrRate = 84;
    try {
      usdInrRate = await currencyExchangeService.convertAmount(1, 'USD', 'INR');
    } catch { /* use fallback */ }

    const usedUsd   = allBrokerAccounts.reduce((sum, a) => sum + parseFloat(a.lrsUsedUsd ?? '0'), 0);
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
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

router.get("/market/search", async (req: Request, res: Response): Promise<void> => {
  try {
    const rawQuery = req.query.query;
    const rawLimit = req.query.limit;
    if (!rawQuery || typeof rawQuery !== "string") {
      res.status(400).json({ success: false, error: "Query required" });
      return;
    }

    const results = await alpacaMarketDataService.searchSymbols(
      rawQuery,
      typeof rawLimit === "string" ? parseInt(rawLimit, 10) || 10 : 10
    );
    res.json({ success: true, results });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});




// ─── ACH Relationships ────────────────────────────────────────────────────────
// These routes expose the Alpaca ACH funding workflow to authenticated clients.


/** List ACH relationships for the authenticated user's Alpaca account */
router.get("/funding/ach-relationships", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    const brokerAccount = await usTradingService.getBrokerAccount(userId);
    if (!brokerAccount?.alpacaAccountId) {
      res.status(404).json({ success: false, error: "No Alpaca account found" });
      return;
    }
    const relationships = await alpacaBrokerService.listAchRelationships(brokerAccount.alpacaAccountId);
    res.json({ success: true, relationships });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

/** Create a new ACH relationship (link a US bank account for LRS funding via ACH) */
router.post("/funding/ach-relationships", async (req, res) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) return res.status(401).json({ success: false, error: "Authentication required" });
    const brokerAccount = await usTradingService.getBrokerAccount(userId);
    if (!brokerAccount?.alpacaAccountId) return res.status(404).json({ success: false, error: "No Alpaca account found" });

    const { account_owner_name, bank_account_type, bank_account_number, bank_routing_number, nickname, processor_token } = req.body;
    if (!account_owner_name || !bank_account_type || !bank_account_number || !bank_routing_number) {
      return res.status(400).json({ success: false, error: "Missing required fields: account_owner_name, bank_account_type, bank_account_number, bank_routing_number" });
    }
    if (!["CHECKING", "SAVINGS"].includes(bank_account_type)) {
      return res.status(400).json({ success: false, error: "bank_account_type must be CHECKING or SAVINGS" });
    }

    const relationship = await alpacaBrokerService.createAchRelationship(brokerAccount.alpacaAccountId, {
      account_owner_name,
      bank_account_type,
      bank_account_number,
      bank_routing_number,
      nickname,
      processor_token,
    });
    res.json({ success: true, relationship });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(422).json({ success: false, error: message });
  }
});

/** Delete an ACH relationship */
router.delete("/funding/ach-relationships/:relationshipId", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    const brokerAccount = await usTradingService.getBrokerAccount(userId);
    if (!brokerAccount?.alpacaAccountId) {
      res.status(404).json({ success: false, error: "No Alpaca account found" });
      return;
    }
    await alpacaBrokerService.deleteAchRelationship(brokerAccount.alpacaAccountId, req.params.relationshipId);
    res.json({ success: true, message: "ACH relationship deleted" });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

// ─── Transfers (Funding / Withdrawal) ─────────────────────────────────────────

/** List transfers for the authenticated user */
router.get("/funding/transfers", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    const brokerAccount = await usTradingService.getBrokerAccount(userId);
    if (!brokerAccount?.alpacaAccountId) {
      res.status(404).json({ success: false, error: "No Alpaca account found" });
      return;
    }
    const transfers = await alpacaBrokerService.listTransfers(brokerAccount.alpacaAccountId, {
      direction: typeof req.query.direction === "string" ? req.query.direction : undefined,
      limit: typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) || 50 : 50,
    });
    res.json({ success: true, transfers });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

/**
 * Initiate an ACH transfer (fund account via INCOMING, or withdraw via OUTGOING).
 * For Indian investors, note: ACH is US-bank-to-US-broker; LRS SWIFT is handled separately.
 */
router.post("/funding/transfers", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    const brokerAccount = await usTradingService.getBrokerAccount(userId);
    if (!brokerAccount?.alpacaAccountId) {
      res.status(404).json({ success: false, error: "No Alpaca account found" });
      return;
    }

    const { relationship_id, amount, direction, transfer_type = "ach" } = req.body as {
      relationship_id?: string;
      amount?: number | string;
      direction?: string;
      transfer_type?: string;
    };
    if (!amount || !direction) {
      res.status(400).json({ success: false, error: "Missing required fields: amount, direction" });
      return;
    }
    if (!["INCOMING", "OUTGOING"].includes(direction)) {
      res.status(400).json({ success: false, error: "direction must be INCOMING or OUTGOING" });
      return;
    }

    const transfer = await alpacaBrokerService.createTransfer(brokerAccount.alpacaAccountId, {
      transfer_type,
      relationship_id,
      amount: amount.toString(),
      direction,
    });
    res.json({ success: true, transfer });
  } catch (error: unknown) {
    res.status(422).json({ success: false, error: errorMessage(error) });
  }
});

/** Cancel a pending transfer */
router.delete("/funding/transfers/:transferId", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    const brokerAccount = await usTradingService.getBrokerAccount(userId);
    if (!brokerAccount?.alpacaAccountId) {
      res.status(404).json({ success: false, error: "No Alpaca account found" });
      return;
    }
    await alpacaBrokerService.cancelTransfer(brokerAccount.alpacaAccountId, req.params.transferId);
    res.json({ success: true, message: "Transfer cancelled" });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

// ─── SSE Event Relay ──────────────────────────────────────────────────────────
// Relays Alpaca broker events to connected browser clients via server-sent events.
// Each browser tab gets a unique subscriber ID. Events are filtered to the user's
// own Alpaca account ID so no cross-account data leaks.

router.get("/events/stream", async (req, res) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  // Lookup user's Alpaca account for server-side filtering
  const brokerAccount = await usTradingService.getBrokerAccount(userId);
  const alpacaAccountId = brokerAccount?.alpacaAccountId || undefined;

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering if applicable
  res.flushHeaders();

  // Send initial heartbeat so browser knows the connection is alive
  res.write(": connected\n\n");

  // Register subscriber — events are filtered by Alpaca account ID
  const subscriberId = `sse_${userId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  alpacaSseService.subscribe(subscriberId, userId, alpacaAccountId, (event) => {
    try {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    } catch {
      // Client may have disconnected mid-write
    }
  });

  // Heartbeat every 30s to keep the connection alive through proxies/load balancers
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 30_000);

  // Cleanup on client disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    alpacaSseService.unsubscribe(subscriberId);
  });
});

router.get("/events/recent", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    const brokerAccount = await usTradingService.getBrokerAccount(userId);
    const events = alpacaSseService.getRecentEvents(brokerAccount?.alpacaAccountId || undefined, 50);
    res.json({ success: true, events });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: errorMessage(error) });
  }
});

export default router;
