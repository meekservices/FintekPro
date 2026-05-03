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
import * as schema from "@shared/schema";
import { requireAuth, requireAdmin, requireAgent } from "../middleware/auth";
import { alpacaAccountGuard } from "../middleware/rbac";

const router = Router();

// Apply authentication to all routes in this file
router.use(requireAuth);


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

// Watchlist operations (Admin/Agent/Owner)
router.delete("/broker/accounts/:accountId/watchlists/:watchlistId", alpacaAccountGuard, async (req, res) => {
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

/** List generated reports (Admin only) */
router.get("/broker/reports", requireAdmin, async (req, res) => {
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

/** Create / request a report (Admin only) */
router.post("/broker/reports", requireAdmin, async (req, res) => {
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

/** Get a specific report (Admin only) */
router.get("/broker/reports/:reportId", requireAdmin, async (req, res) => {
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

/** List corporate action announcements via new /v1/corporate_actions/announcements endpoint */
router.get("/broker/corporate-actions/announcements", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, announcements: [] });
    }
    const announcements = await alpacaBrokerService.getCorporateActionsNew({
      symbol: req.query.symbol as string,
      types: req.query.types as string,
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
    });
    res.json({ success: true, announcements });
  } catch (error: any) {
    res.status(500).json({ success: false, announcements: [], error: error.message });
  }
});

/** List corporate action announcements (legacy endpoint — dividends, splits, mergers) */
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

/** List tradable assets (Authenticated) */
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

// ─── Funding Wallets ──────────────────────────────────────────────────────────

/** Get funding wallet details (Admin/Agent/Owner) */
router.get("/broker/accounts/:accountId/funding-wallet", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const { accountId } = req.params;
    let wallet = await alpacaBrokerService.getFundingWallet(accountId);
    if (!wallet) {
      wallet = await alpacaBrokerService.createFundingWallet(accountId);
    }
    const details = wallet
      ? await alpacaBrokerService.getFundingWalletDetails(accountId, wallet.id)
      : [];
    const transfers = wallet
      ? await alpacaBrokerService.getFundingWalletTransfers(accountId, wallet.id)
      : [];
    res.json({ success: true, wallet, details, transfers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Simulate funding deposit (Admin only - Testing) */
router.post("/broker/accounts/:accountId/funding-wallet/deposit-simulation", requireAdmin, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const { accountId } = req.params;
    const { amount_usd } = req.body;
    if (!amount_usd || amount_usd <= 0) return res.status(400).json({ error: "Invalid amount" });
    const wallet = await alpacaBrokerService.getFundingWallet(accountId);
    if (!wallet) return res.status(404).json({ error: "No funding wallet — create it first" });
    const result = await alpacaBrokerService.simulateFundingDeposit(accountId, wallet.id, parseFloat(amount_usd));
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Recipient Banks ──────────────────────────────────────────────────────────

/** List recipient banks (Admin/Agent/Owner) */
router.get("/broker/accounts/:accountId/recipient-banks", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const banks = await alpacaBrokerService.listRecipientBanks(req.params.accountId);
    res.json({ success: true, banks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Create recipient bank (Admin/Agent/Owner) */
router.post("/broker/accounts/:accountId/recipient-banks", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const schema = z.object({
      name: z.string().min(1),
      bank_name: z.string().min(1),
      bank_account_number: z.string().min(1),
      bank_account_type: z.enum(["CHECKING", "SAVINGS", "INTERNATIONAL"]),
      bank_routing_number: z.string().optional(),
      bank_swift_code: z.string().optional(),
      bank_iban: z.string().optional(),
      country: z.string().min(2).max(3),
      currency: z.string().min(3).max(3),
      bank_address: z.string().optional(),
      beneficiary_address: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const bank = await alpacaBrokerService.createRecipientBank(req.params.accountId, data);
    res.json({ success: true, bank });
  } catch (error: any) {
    res.status(error.name === "ZodError" ? 400 : 500).json({ success: false, error: error.message });
  }
});

/** Delete recipient bank (Admin/Agent/Owner) */
router.delete("/broker/accounts/:accountId/recipient-banks/:bankId", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    await alpacaBrokerService.deleteRecipientBank(req.params.accountId, req.params.bankId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Initiate wire withdrawal (Admin/Agent/Owner) */
router.post("/broker/accounts/:accountId/wire-withdrawal", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const { amount, currency = "USD", recipient_bank_id, memo } = req.body;
    if (!amount || !recipient_bank_id) return res.status(400).json({ error: "amount and recipient_bank_id required" });
    const result = await alpacaBrokerService.createWireWithdrawal(req.params.accountId, {
      amount: parseFloat(amount), currency, recipient_bank_id, memo,
    });
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Options Contracts ────────────────────────────────────────────────────────

router.get("/options/contracts", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const contracts = await alpacaBrokerService.listOptionContracts({
      underlying_symbols: req.query.symbol as string || "",
      expiration_date_gte: req.query.expiry_from as string,
      expiration_date_lte: req.query.expiry_to as string,
      type: req.query.type as "call" | "put" | undefined,
      strike_price_gte: req.query.strike_min as string,
      strike_price_lte: req.query.strike_max as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
    });
    res.json({ success: true, contracts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/options/contracts/:symbolOrId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const contract = await alpacaBrokerService.getOptionContract(req.params.symbolOrId);
    if (!contract) return res.status(404).json({ error: "Contract not found" });
    res.json({ success: true, contract });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/options/positions", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const accountId = req.query.account_id as string | undefined;
    const positions = await alpacaBrokerService.getOptionsPositions(accountId);
    res.json({ success: true, positions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Account Configuration ────────────────────────────────────────────────────

router.get("/account/config", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const accountId = (req as any).user?.alpacaAccountId;
    if (!accountId) return res.status(400).json({ error: "No Alpaca account linked to user" });
    const config = await alpacaBrokerService.getAccountConfig(accountId);
    if (!config) return res.status(404).json({ error: "Config not found" });
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/account/config", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const accountId = (req as any).user?.alpacaAccountId;
    const config = await alpacaBrokerService.updateAccountConfig(req.body, accountId);
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Get account config (Admin/Agent/Owner) */
router.get("/broker/accounts/:accountId/config", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const config = await alpacaBrokerService.getAccountConfig(req.params.accountId);
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Update account config (Admin only) */
router.patch("/broker/accounts/:accountId/config", requireAdmin, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const config = await alpacaBrokerService.updateAccountConfig(req.body, req.params.accountId);
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Batch Journals ───────────────────────────────────────────────────────────

/** Create batch journals (Admin only) */
router.post("/broker/journals/batch", requireAdmin, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const { journals } = req.body;
    if (!Array.isArray(journals) || journals.length === 0) {
      return res.status(400).json({ error: "journals array is required" });
    }
    const result = await alpacaBrokerService.createBatchJournals(journals);
    res.json({ success: true, ...result, total: journals.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Alpaca Rebalancing Portfolios ────────────────────────────────────────────

/** List rebalancing portfolios (Admin/Agent) */
router.get("/broker/rebalancing/portfolios", requireAgent, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const portfolios = await alpacaBrokerService.listRebalancingPortfolios();
    res.json({ success: true, portfolios });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Create rebalancing portfolio (Admin only) */
router.post("/broker/rebalancing/portfolios", requireAdmin, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const portfolio = await alpacaBrokerService.createRebalancingPortfolio(req.body);
    res.json({ success: true, portfolio });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/broker/rebalancing/portfolios/:portfolioId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const portfolio = await alpacaBrokerService.getRebalancingPortfolio(req.params.portfolioId);
    if (!portfolio) return res.status(404).json({ error: "Portfolio not found" });
    res.json({ success: true, portfolio });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/broker/rebalancing/portfolios/:portfolioId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const portfolio = await alpacaBrokerService.updateRebalancingPortfolio(req.params.portfolioId, req.body);
    res.json({ success: true, portfolio });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/broker/rebalancing/portfolios/:portfolioId/subscriptions", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const subs = await alpacaBrokerService.listPortfolioSubscriptions(req.params.portfolioId);
    res.json({ success: true, subscriptions: subs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Subscribe account to portfolio (Admin/Agent) */
router.post("/broker/rebalancing/portfolios/:portfolioId/subscriptions", requireAgent, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const { account_id } = req.body;
    if (!account_id) return res.status(400).json({ error: "account_id required" });
    const sub = await alpacaBrokerService.subscribeAccountToPortfolio(req.params.portfolioId, account_id);
    res.json({ success: true, subscription: sub });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/broker/rebalancing/portfolios/:portfolioId/subscriptions/:subscriptionId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    await alpacaBrokerService.unsubscribeAccountFromPortfolio(req.params.portfolioId, req.params.subscriptionId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/broker/rebalancing/portfolios/:portfolioId/runs", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const runs = await alpacaBrokerService.listRebalancingRuns(req.params.portfolioId);
    res.json({ success: true, runs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/broker/rebalancing/portfolios/:portfolioId/runs", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const { type = "full_rebalance" } = req.body;
    const run = await alpacaBrokerService.createRebalancingRun(req.params.portfolioId, type);
    res.json({ success: true, run });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Corporate Actions (updated endpoint) ─────────────────────────────────────

router.get("/broker/corporate-actions/announcements", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const actions = await alpacaBrokerService.getCorporateActionsNew({
      symbol: req.query.symbol as string,
      types: req.query.types as string,
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    });
    res.json({ success: true, announcements: actions, total: actions.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── High-Yield Cash Interest Program ────────────────────────────────────────

router.get("/cash-interest/tiers", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const tiers = await alpacaBrokerService.getAprTiers();
    res.json({ success: true, tiers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Enroll account in cash interest (Admin/Agent/Owner) */
router.post("/broker/accounts/:accountId/cash-interest/enroll", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const { accountId } = req.params;
    const { apr_tier_name } = req.body;
    if (!apr_tier_name) return res.status(400).json({ error: "apr_tier_name required" });
    const result = await alpacaBrokerService.enrollCashInterest(accountId, apr_tier_name);
    res.json({ success: true, account: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/broker/accounts/:accountId/cash-interest/unenroll", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const { accountId } = req.params;
    const result = await alpacaBrokerService.unenrollCashInterest(accountId);
    res.json({ success: true, account: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Fully Paid Securities Lending (FPSL) ───────────────────────────────────

/** Get FPSL status (Admin/Agent/Owner) */
router.get("/broker/accounts/:accountId/fpsl/status", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const { accountId } = req.params;
    const fpslStatus = await alpacaBrokerService.getFpslStatus(accountId);
    res.json({ success: true, fpsl: fpslStatus });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Enroll in FPSL (Admin/Agent/Owner) */
router.post("/broker/accounts/:accountId/fpsl/enroll", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const { accountId } = req.params;
    const { tier_id } = req.body;
    if (!tier_id) return res.status(400).json({ error: "tier_id required" });
    const result = await alpacaBrokerService.enrollFpsl(accountId, tier_id);
    res.json({ success: true, account: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/broker/accounts/:accountId/fpsl/unenroll", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) return res.status(400).json({ error: "Not configured" });
    const { accountId } = req.params;
    const result = await alpacaBrokerService.unenrollFpsl(accountId);
    res.json({ success: true, account: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Options Exercise ──────────────────────────────────────────────────────────

/**
 * List options exercise requests for an account.
 * GET /api/broker/accounts/:accountId/options/exercises
 */
/** List options exercise requests (Admin/Agent/Owner) */
router.get("/broker/accounts/:accountId/options/exercises", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const exercises = await alpacaBrokerService.listOptionsExercises(req.params.accountId, {
      symbol: req.query.symbol as string,
      status: req.query.status as string,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, exercises });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Exercise (or abandon) one or more options contracts.
 * POST /api/broker/accounts/:accountId/options/exercises
 * Body: {
 *   type: "e" (exercise) | "a" (abandon),
 *   contracts: [{ symbol: "AAPL241220C00175000", qty: 1 }]
 * }
 * India tax note: US options gains = USD income; reportable under Schedule FA of ITR-2/3.
 * DTAA Article 13 applies for capital gains; withholding at 25% may apply via IRS Form W-8BEN.
 */
/** Exercise options (Admin/Agent/Owner) */
router.post("/broker/accounts/:accountId/options/exercises", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const { type = "e", contracts } = req.body;
    if (!Array.isArray(contracts) || contracts.length === 0) {
      return res.status(400).json({ success: false, error: "contracts array is required (e.g. [{ symbol, qty }])" });
    }
    if (!["e", "a"].includes(type)) {
      return res.status(400).json({ success: false, error: "type must be 'e' (exercise) or 'a' (abandon)" });
    }
    const result = await alpacaBrokerService.exerciseOptions(req.params.accountId, contracts, type);
    res.status(201).json({ success: true, exercise: result });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

// ─── SSE Event Stream Proxy ────────────────────────────────────────────────────
// Relays Alpaca SSE events to the browser client over a persistent connection.

router.get("/events/stream", async (req, res) => {
  const userId = (req as any).user?.id;
  const alpacaAccountId = req.query.account_id as string | undefined;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const subscriberId = crypto.randomUUID();

  // Send a hello heartbeat
  res.write(`event: connected\ndata: ${JSON.stringify({ subscriberId, ts: new Date().toISOString() })}\n\n`);

  // Heartbeat every 25s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 25_000);

  // Subscribe to Alpaca events
  alpacaSseService.subscribe(subscriberId, userId, alpacaAccountId, (event) => {
    try {
      res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
    } catch {
      // client disconnected
    }
  });

  req.on("close", () => {
    clearInterval(heartbeat);
    alpacaSseService.unsubscribe(subscriberId);
  });
});

// GET recent cached events (non-streaming)
router.get("/events/recent", async (req, res) => {
  const accountId = req.query.account_id as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
  const events = alpacaSseService.getRecentEvents(accountId, limit);
  res.json({ success: true, events, total: events.length });
});

// ─── Crypto Trading ─────────────────────────────────────────────────────────

router.get("/crypto/assets", async (_req, res) => {
  try {
    const assets = await alpacaBrokerService.listAssets({
      status: "active",
      asset_class: "crypto",
    });
    res.json({ success: true, assets });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/crypto/positions", async (req, res) => {
  try {
    const accountId = req.query.account_id as string | undefined;
    const positions = await alpacaBrokerService.getPositions(accountId);
    const cryptoPositions = positions.filter(
      (p: any) => p.asset_class === "crypto"
    );
    res.json({ success: true, positions: cryptoPositions });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/crypto/orders", async (req, res) => {
  try {
    const { symbol, qty, notional, side, type, limit_price, time_in_force, account_id } = req.body;
    const order = await alpacaBrokerService.placeOrder({
      symbol,
      qty: qty?.toString(),
      notional: notional?.toString(),
      side,
      type: type || "market",
      time_in_force: time_in_force || "gtc",
      limit_price: limit_price?.toString(),
      account_id,
    });
    res.json({ success: true, order });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── Account Restrictions & Compliance ─────────────────────────────────────

/** Get account restrictions (Admin/Agent/Owner) */
router.get("/broker/accounts/:accountId/restrictions", alpacaAccountGuard, async (req, res) => {
  try {
    const restrictions = await alpacaBrokerService.getAccountRestrictions(req.params.accountId);
    res.json({ success: true, restrictions });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** Update account restrictions (Admin only) */
router.patch("/broker/accounts/:accountId/restrictions", requireAdmin, async (req, res) => {
  try {
    const result = await alpacaBrokerService.updateAccountRestrictions(
      req.params.accountId,
      req.body
    );
    res.json({ success: true, restrictions: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/** Suspend account (Admin only) */
router.post("/broker/accounts/:accountId/suspend", requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, error: "reason is required" });
    const result = await alpacaBrokerService.suspendAccount(req.params.accountId, reason);
    res.json({ success: true, account: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/broker/accounts/:accountId/reinstate", async (req, res) => {
  try {
    const result = await alpacaBrokerService.reinstateAccount(req.params.accountId);
    res.json({ success: true, account: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── ACH Micro-deposit Verification ────────────────────────────────────────

router.post("/broker/accounts/:accountId/ach/:achId/verify", async (req, res) => {
  try {
    const { amount1, amount2 } = req.body;
    if (!amount1 || !amount2) {
      return res.status(400).json({ success: false, error: "amount1 and amount2 are required" });
    }
    const result = await alpacaBrokerService.verifyAchRelationship(
      req.params.accountId,
      req.params.achId,
      parseFloat(amount1),
      parseFloat(amount2)
    );
    res.json({ success: true, relationship: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── Order Replace / Modify ─────────────────────────────────────────────────

router.patch("/broker/accounts/:accountId/orders/:orderId", async (req, res) => {
  try {
    const result = await alpacaBrokerService.replaceOrder(
      req.params.accountId,
      req.params.orderId,
      req.body
    );
    res.json({ success: true, order: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── All Transfers (broker-level) ──────────────────────────────────────────

/** List all transfers (Admin only) */
router.get("/broker/transfers", requireAdmin, async (req, res) => {
  try {
    const params: any = {};
    if (req.query.direction) params.direction = req.query.direction as string;
    if (req.query.limit) params.limit = parseInt(req.query.limit as string);
    if (req.query.offset) params.offset = parseInt(req.query.offset as string);
    const transfers = await alpacaBrokerService.listAllTransfers(params);
    res.json({ success: true, transfers });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── Journal Reversal ───────────────────────────────────────────────────────

router.post("/broker/journals/:journalId/reverse", async (req, res) => {
  try {
    const result = await alpacaBrokerService.reverseJournal(req.params.journalId);
    res.json({ success: true, journal: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
