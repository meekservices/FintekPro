import type { Express, Request, Response, NextFunction } from 'express';
import { irisKfintechService } from '../services/iris-kfintech-service';
import { isAuthenticated } from '../replitAuth';
import { requireAdmin, requireAgent } from '../middleware/auth';

function requireAuth(req: Request, res: Response, next: NextFunction) {
  return isAuthenticated(req, res, next);
}

async function wrap(res: Response, fn: () => Promise<unknown>): Promise<void> {
  try {
    const data = await fn();
    res.json({ success: true, data });
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string }; status?: number }; message?: string };
    const msg = e?.response?.data?.message ?? e?.message ?? 'IRIS API error';
    const status = e?.response?.status ?? 500;
    res.status(status).json({ success: false, message: msg });
  }
}

export function registerIrisKfintechRoutes(app: Express): void {

  // ─── Status ──────────────────────────────────────────────────────────────────
  app.get('/api/iris/status', requireAuth, (_req, res) => {
    res.json({ success: true, data: irisKfintechService.getStatus() });
  });

  // ─── OTP Auth (admin-only) ────────────────────────────────────────────────────
  app.post('/api/iris/auth/send-otp', requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await irisKfintechService.sendOtp(req.body?.mobile as string | undefined) as { success?: boolean; message?: string };
      if (result?.success === false) {
        res.status(502).json(result);
      } else {
        res.json(result);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      res.status(502).json({ success: false, message: e?.message ?? 'IRIS OTP request failed' });
    }
  });

  app.post('/api/iris/auth/submit-otp', requireAuth, requireAdmin, async (req, res) => {
    try {
      const result = await irisKfintechService.submitOtp(req.body?.otp as string) as { success?: boolean; message?: string };
      if (result?.success === false) {
        res.status(502).json(result);
      } else {
        res.json(result);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      res.status(502).json({ success: false, message: e?.message ?? 'IRIS OTP verification failed' });
    }
  });

  // ─── Dashboard ───────────────────────────────────────────────────────────────
  app.get('/api/iris/dashboard/aum-summary', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getAumSummary());
  });

  app.get('/api/iris/dashboard/fund-earnings', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getFundEarnings());
  });

  app.get('/api/iris/dashboard/sip-summary', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getSipSummary());
  });

  app.get('/api/iris/dashboard/unique-investors', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getUniqueInvestors());
  });

  app.get('/api/iris/dashboard/inflow-outflow', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getInflowOutflow(req.query as Record<string, string>));
  });

  app.get('/api/iris/dashboard/euins', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getEuins());
  });

  // ─── Empanelment ─────────────────────────────────────────────────────────────
  app.get('/api/iris/empanelment/amc-list', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getEmpanelmentAmcList());
  });

  app.get('/api/iris/empanelment/amc-status', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getAmcEmpanelmentStatus(req.query.amcCode as string | undefined));
  });

  app.get('/api/iris/empanelment/fd-status', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getFdEmpanelmentStatus());
  });

  app.get('/api/iris/empanelment/nps-status', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getNpsEmpanelmentStatus());
  });

  app.post('/api/iris/empanelment/resend-esign', requireAuth, requireAgent, async (req, res) => {
    const { empanelmentId } = req.body as { empanelmentId: string };
    await wrap(res, () => irisKfintechService.resendEsignLink(empanelmentId));
  });

  // ─── Investors ───────────────────────────────────────────────────────────────
  app.get('/api/iris/investors', requireAuth, requireAgent, async (req, res) => {
    const { search, page, limit } = req.query as Record<string, string | undefined>;
    await wrap(res, () => irisKfintechService.listInvestors({
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    }));
  });

  app.get('/api/iris/investors/:pan', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getInvestorDetails(req.params.pan));
  });

  app.get('/api/iris/investors/:pan/kyc', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getInvestorKycDetails(req.params.pan));
  });

  app.get('/api/iris/investors/:pan/portfolio-summary', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getPortfolioSummary(req.params.pan));
  });

  app.get('/api/iris/investors/:pan/investments', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getInvestmentDetails(req.params.pan));
  });

  app.get('/api/iris/investors/:pan/transactions', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getTransactionDetails(req.params.pan, req.query as Record<string, string>));
  });

  app.get('/api/iris/investors/:pan/systematic-plans', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSystematicPlanDetails(req.params.pan));
  });

  app.post('/api/iris/investors/:pan/send-ekyc-mail', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.sendEkycMail(req.params.pan));
  });

  app.post('/api/iris/investors/:pan/send-reminder', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.sendReminderMail(req.params.pan, req.body as Record<string, unknown>));
  });

  // ─── Scheme Search ────────────────────────────────────────────────────────────
  // Dedicated scheme-search endpoint — wraps IRIS scheme search endpoint
  app.get('/api/iris/transactions/scheme-search', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.searchSchemes(req.query.q as string));
  });

  // ─── Transactions ─────────────────────────────────────────────────────────────
  app.get('/api/iris/transactions/funds', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getAllFunds());
  });

  app.get('/api/iris/transactions/funds/:fundCode/schemes', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSchemesByFund(req.params.fundCode));
  });

  app.get('/api/iris/transactions/schemes/:schemeCode', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSchemeDetails(req.params.schemeCode));
  });

  app.get('/api/iris/transactions/nfo', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getNfoData());
  });

  app.get('/api/iris/transactions/payment-modes', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getAvailablePaymentModes(
      req.query.pan as string,
      req.query.schemeCode as string,
    ));
  });

  app.post('/api/iris/transactions/validate', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.validateInvestment(req.body as Record<string, unknown>));
  });

  app.post('/api/iris/transactions/place-order', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.placeOrder(req.body as Record<string, unknown>));
  });

  app.post('/api/iris/transactions/place-redemption', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.placeRedemption(req.body as Record<string, unknown>));
  });

  app.post('/api/iris/transactions/sip/cancel', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.cancelSip(req.body as Record<string, unknown>));
  });

  app.post('/api/iris/transactions/sip/pause', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.pauseSip(req.body as Record<string, unknown>));
  });

  app.post('/api/iris/transactions/:orderId/cancel', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.cancelOrder(req.params.orderId));
  });

  app.post('/api/iris/transactions/:orderId/reinitiate', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.reinitiateOrder(req.params.orderId));
  });

  app.get('/api/iris/transactions/mandates', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getMandates(req.query.pan as string));
  });

  // ─── Products ─────────────────────────────────────────────────────────────────
  app.get('/api/iris/products/aif-links', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getAifLinks());
  });

  app.get('/api/iris/products/pms-links', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getPmsLinks());
  });

  app.get('/api/iris/products/fixed-deposits', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getFixedDepositProducts());
  });

  app.get('/api/iris/products/fixed-deposits/:productId/brochure', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getFdBrochure(req.params.productId));
  });

  app.get('/api/iris/products/nps-links', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getNpsInvestmentLinks());
  });

  // ─── Reports ──────────────────────────────────────────────────────────────────
  app.get('/api/iris/reports/capital-gains/:pan', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getCgStatement(req.params.pan, req.query as Record<string, string>));
  });

  app.get('/api/iris/reports/client-statement/:pan', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getClientStatement(req.params.pan, req.query as Record<string, string>));
  });

  app.get('/api/iris/reports/transaction-statement/:pan', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getTransactionStatement(req.params.pan, req.query as Record<string, string>));
  });

  app.get('/api/iris/reports/portfolio-summary/:pan', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getPortfolioReport(req.params.pan, req.query as Record<string, string>));
  });

  // STP Registration
  app.post('/api/iris/transactions/stp/register', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.registerStp(req.body as Record<string, unknown>));
  });

  app.post('/api/iris/transactions/stp/cancel', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.cancelStp(req.body as Record<string, unknown>));
  });

  app.post('/api/iris/transactions/stp/pause', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.pauseStp(req.body as Record<string, unknown>));
  });

  // SWP Registration
  app.post('/api/iris/transactions/swp/register', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.registerSwp(req.body as Record<string, unknown>));
  });

  app.post('/api/iris/transactions/swp/cancel', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.cancelSwp(req.body as Record<string, unknown>));
  });

  app.post('/api/iris/transactions/swp/pause', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.pauseSwp(req.body as Record<string, unknown>));
  });

  // Additional Purchase
  app.post('/api/iris/transactions/additional-purchase', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.placeAdditionalPurchase(req.body as Record<string, unknown>));
  });

  // eNACH / Mandate Creation
  app.post('/api/iris/transactions/mandates', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.createMandate(req.body as Record<string, unknown>));
  });

  app.get('/api/iris/transactions/mandates/:mandateId', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getMandateStatus(req.params.mandateId));
  });

  // Fixed Deposit Orders
  app.post('/api/iris/products/fixed-deposits/order', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.placeFdOrder(req.body as Record<string, unknown>));
  });

  app.get('/api/iris/products/fixed-deposits/orders', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getFdOrders(req.query.pan as string));
  });

  app.get('/api/iris/products/fixed-deposits/orders/:orderId', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getFdOrderDetails(req.params.orderId));
  });

  app.post('/api/iris/products/fixed-deposits/orders/:orderId/premature-closure', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.prematureCloseFd(req.params.orderId, req.body as Record<string, unknown>));
  });

  app.get('/api/iris/products/fixed-deposits/maturity', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getFdMaturityList(req.query as Record<string, string>));
  });

  app.get('/api/iris/products/fixed-deposits/interest-calculator', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.calculateFdInterest(req.query as Record<string, string>));
  });

  // NPS
  app.get('/api/iris/nps/subscriber/:pran', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getNpsSubscriberDetails(req.params.pran));
  });

  app.get('/api/iris/nps/subscriber/:pran/portfolio', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getNpsPortfolio(req.params.pran));
  });

  app.get('/api/iris/nps/subscriber/:pran/fund-values', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getNpsFundValues(req.params.pran));
  });

  app.get('/api/iris/nps/subscriber/:pran/transactions', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getNpsTransactions(req.params.pran, req.query as Record<string, string>));
  });

  app.post('/api/iris/nps/subscriber/:pran/scheme-change', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.changeNpsScheme(req.params.pran, req.body as Record<string, unknown>));
  });

  app.post('/api/iris/nps/subscriber/:pran/partial-withdrawal', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.npsPartialWithdrawal(req.params.pran, req.body as Record<string, unknown>));
  });

  app.post('/api/iris/nps/subscriber/onboarding', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.initiateNpsOnboarding(req.body as Record<string, unknown>));
  });

  app.post('/api/iris/nps/transactions/contribution', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.placeNpsContribution(req.body as Record<string, unknown>));
  });

  // Non-Financial Transactions
  app.post('/api/iris/non-financial/:pan/nominee', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.updateNominee(req.params.pan, req.body as Record<string, unknown>));
  });

  app.post('/api/iris/non-financial/:pan/email', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.updateEmail(req.params.pan, req.body as Record<string, unknown>));
  });

  app.post('/api/iris/non-financial/:pan/mobile', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.updateMobile(req.params.pan, req.body as Record<string, unknown>));
  });

  app.post('/api/iris/non-financial/:pan/fatca', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.updateFatca(req.params.pan, req.body as Record<string, unknown>));
  });

  app.post('/api/iris/non-financial/:pan/idcw', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.updateIdcw(req.params.pan, req.body as Record<string, unknown>));
  });

  app.post('/api/iris/non-financial/:pan/bank', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.updateBankDetails(req.params.pan, req.body as Record<string, unknown>));
  });

  app.post('/api/iris/non-financial/:pan/bank-mandate', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.manageBankMandate(req.params.pan, req.body as Record<string, unknown>));
  });

  // Business Hierarchy
  app.get('/api/iris/hierarchy/sub-brokers', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.listSubBrokers(req.query as Record<string, string>));
  });

  app.get('/api/iris/hierarchy/sub-brokers/:euinCode', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSubBrokerDetails(req.params.euinCode));
  });

  app.post('/api/iris/hierarchy/employees', requireAuth, requireAdmin, async (req, res) => {
    await wrap(res, () => irisKfintechService.addEmployee(req.body as Record<string, unknown>));
  });

  app.put('/api/iris/hierarchy/employees/:euinCode', requireAuth, requireAdmin, async (req, res) => {
    await wrap(res, () => irisKfintechService.updateEmployee(req.params.euinCode, req.body as Record<string, unknown>));
  });

  // Bulk Reports
  app.get('/api/iris/reports/bulk/capital-gains', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getBulkCapitalGains(req.query as Record<string, string>));
  });

  app.get('/api/iris/reports/sip-maturity-calendar', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSipMaturityCalendar(req.query as Record<string, string>));
  });

  app.get('/api/iris/reports/dividend-tracker', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getDividendTracker(req.query as Record<string, string>));
  });

  app.get('/api/iris/reports/bulk/portfolio', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getBulkPortfolioReport(req.query as Record<string, string>));
  });

  // ─── SIP Lifecycle ────────────────────────────────────────────────────────────
  app.post('/api/iris/transactions/sip/register', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.registerSip(req.body as Record<string, unknown>));
  });

  app.patch('/api/iris/transactions/sip/:sipId/modify', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.modifySip(req.params.sipId, req.body as Record<string, unknown>));
  });

  app.get('/api/iris/transactions/sip/:sipId', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSipDetails(req.params.sipId));
  });

  // ─── Order Status / Ledger ────────────────────────────────────────────────────
  app.get('/api/iris/transactions/orders', requireAuth, requireAgent, async (req, res) => {
    const { pan, ...rest } = req.query as Record<string, string>;
    await wrap(res, () => irisKfintechService.listOrdersByPan(pan, Object.keys(rest).length ? rest : undefined));
  });

  app.get('/api/iris/transactions/orders/:orderId', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getOrderDetails(req.params.orderId));
  });

  app.get('/api/iris/transactions/switch/:orderId/status', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSwitchStatus(req.params.orderId));
  });

  // ─── STP Status ───────────────────────────────────────────────────────────────
  app.get('/api/iris/transactions/stp', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.listStpsByPan(req.query.pan as string));
  });

  app.get('/api/iris/transactions/stp/:stpId', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getStpDetails(req.params.stpId));
  });

  // ─── SWP Status ───────────────────────────────────────────────────────────────
  app.get('/api/iris/transactions/swp', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.listSwpsByPan(req.query.pan as string));
  });

  app.get('/api/iris/transactions/swp/:swpId', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSwpDetails(req.params.swpId));
  });

  // ─── Failed/Rejected Transactions ────────────────────────────────────────────
  app.get('/api/iris/transactions/failed', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.listFailedTransactions(req.query.pan as string));
  });

  // ─── Phase 1: Switch (IRIS namespace) ────────────────────────────────────────
  app.post('/api/iris/transactions/switch', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.placeSwitch(req.body));
  });
  app.post('/api/iris/transactions/switch/cancel', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.cancelSwitch(req.body));
  });
  app.post('/api/iris/transactions/switch/:orderId/reinitiate', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.reinitiateSwitch(req.params.orderId));
  });

  // ─── Phase 1: eNACH ──────────────────────────────────────────────────────────
  app.post('/api/iris/enach/create', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.createEnach(req.body));
  });
  app.get('/api/iris/enach/:mandateId/status', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getEnachStatus(req.params.mandateId));
  });
  app.post('/api/iris/enach/:mandateId/cancel', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.cancelEnach(req.params.mandateId));
  });
  app.get('/api/iris/enach', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.listEnach(req.query.pan as string));
  });
  app.post('/api/iris/enach/:mandateId/regenerate-link', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.regenerateEnachLink(req.params.mandateId));
  });

  // ─── Phase 1: UPI Autopay Mandate ────────────────────────────────────────────
  app.post('/api/iris/mandates/upi', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.createUpiMandate(req.body));
  });
  app.get('/api/iris/mandates/upi/:umrn', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getUpiMandateStatus(req.params.umrn));
  });
  app.post('/api/iris/mandates/upi/:umrn/cancel', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.cancelUpiMandate(req.params.umrn));
  });
  app.get('/api/iris/mandates/upi', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.listUpiMandates(req.query.pan as string));
  });

  // ─── Physical NACH Mandate ────────────────────────────────────────────────────
  app.post('/api/iris/mandates/physical', requireAuth, requireAgent, async (req, res) => {
    const { pan, bankName, accountNumber, ifscCode, fileContent } = req.body as Record<string, string>;
    if (!pan || !bankName || !accountNumber || !ifscCode || !fileContent) {
      res.status(400).json({ success: false, message: 'pan, bankName, accountNumber, ifscCode, and fileContent are required' });
      return;
    }
    await wrap(res, () => irisKfintechService.uploadPhysicalMandate(req.body));
  });
  app.get('/api/iris/mandates/physical', requireAuth, requireAgent, async (req, res) => {
    const pan = req.query.pan as string;
    if (!pan) {
      res.status(400).json({ success: false, message: 'pan query parameter is required' });
      return;
    }
    await wrap(res, () => irisKfintechService.listPhysicalMandates(pan));
  });

  // ─── Phase 1: Folio Management ───────────────────────────────────────────────
  app.get('/api/iris/investors/:pan/folios', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.listFolios(req.params.pan));
  });
  app.get('/api/iris/investors/:pan/folios/:folioNo', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getFolioDetails(req.params.pan, req.params.folioNo));
  });
  app.get('/api/iris/investors/:pan/folios/:folioNo/transactions', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getFolioTransactions(req.params.pan, req.params.folioNo, req.query));
  });

  // ─── Phase 1: Investor Portal Link ───────────────────────────────────────────
  app.get('/api/iris/investors/:pan/portal-link', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getInvestorPortalLink(req.params.pan));
  });
  app.post('/api/iris/investors/:pan/portal-link/send', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.sendPortalLinkToInvestor(req.params.pan, req.body));
  });

  // ─── Phase 2: Commission Statements ──────────────────────────────────────────
  app.get('/api/iris/reports/commission', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getCommissionStatement(req.query as Record<string, string>));
  });
  app.get('/api/iris/reports/trail-commission', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getTrailCommission(req.query as Record<string, string>));
  });
  app.get('/api/iris/reports/commission/summary', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getCommissionSummary(req.query as Record<string, string>));
  });
  app.get('/api/iris/reports/commission/amc-wise', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getAmcWiseCommission(req.query as Record<string, string>));
  });

  // ─── Phase 2: Digital Investor Onboarding ────────────────────────────────────
  app.post('/api/iris/onboarding/initiate', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.initiateInvestorOnboarding(req.body));
  });
  app.get('/api/iris/onboarding/:applicationId/status', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getOnboardingStatus(req.params.applicationId));
  });
  app.post('/api/iris/onboarding/:applicationId/kyc-verify', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.verifyOnboardingKyc(req.params.applicationId, req.body));
  });
  app.get('/api/iris/onboarding/applications', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.listOnboardingApplications(req.query as Record<string, string>));
  });
  app.post('/api/iris/onboarding/:applicationId/resend-link', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.resendOnboardingLink(req.params.applicationId));
  });

  // ─── Phase 2: CAS Statement ──────────────────────────────────────────────────
  app.get('/api/iris/reports/cas/:pan', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getCasStatement(req.params.pan, req.query as Record<string, string>));
  });
  app.post('/api/iris/reports/cas/generate', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.generateCasStatement(req.body));
  });

  // ─── Phase 2: XIRR & Returns ─────────────────────────────────────────────────
  app.get('/api/iris/analytics/xirr/:pan', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getInvestorXirr(req.params.pan, req.query as Record<string, string>));
  });
  app.get('/api/iris/analytics/returns/:pan', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getInvestorReturns(req.params.pan, req.query as Record<string, string>));
  });
  app.get('/api/iris/analytics/portfolio-xirr/:pan', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getPortfolioXirr(req.params.pan));
  });
  app.get('/api/iris/schemes/:schemeCode/returns', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSchemeReturns(req.params.schemeCode));
  });

  // ─── Phase 3: Scheme NAV History ─────────────────────────────────────────────
  app.get('/api/iris/schemes/:schemeCode/nav-history', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSchemeNavHistory(req.params.schemeCode, req.query as Record<string, string>));
  });
  app.get('/api/iris/schemes/:schemeCode/nav', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSchemeLatestNav(req.params.schemeCode));
  });

  // ─── Phase 3: Scheme Performance & Holdings ──────────────────────────────────
  app.get('/api/iris/schemes/:schemeCode/performance', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSchemePerformance(req.params.schemeCode));
  });
  app.get('/api/iris/schemes/top-performers', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getTopPerformingSchemes(req.query as Record<string, string>));
  });
  app.get('/api/iris/schemes/:schemeCode/holdings', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSchemeHoldings(req.params.schemeCode));
  });
  app.get('/api/iris/schemes/:schemeCode/factsheet', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSchemeFactSheet(req.params.schemeCode));
  });

  // ─── Phase 3: Scheme Comparison ──────────────────────────────────────────────
  app.post('/api/iris/schemes/compare', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.compareSchemes(req.body));
  });

  // ─── Phase 3: Scheme Categories ──────────────────────────────────────────────
  app.get('/api/iris/categories', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSchemeCategories());
  });
  app.get('/api/iris/subcategories', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSchemeSubcategories(req.query.category as string));
  });
  app.get('/api/iris/schemes/by-category', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSchemesByCategory(req.query.category as string, req.query as Record<string, string>));
  });

  // ─── Phase 3: Risk Profiling ──────────────────────────────────────────────────
  app.get('/api/iris/risk-profile/questionnaire', requireAuth, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getRiskQuestionnaire());
  });
  app.post('/api/iris/investors/:pan/risk-profile', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.submitRiskProfile(req.params.pan, req.body));
  });
  app.get('/api/iris/investors/:pan/risk-profile', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getInvestorRiskProfile(req.params.pan));
  });
  app.get('/api/iris/schemes/recommended', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getSchemesForRiskProfile(req.query.riskProfile as string));
  });

  // ─── Phase 3: Application / Order Tracking ───────────────────────────────────
  app.get('/api/iris/applications', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.listApplications(req.query as Record<string, string>));
  });
  app.get('/api/iris/applications/:applicationId/status', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getApplicationStatus(req.params.applicationId));
  });
  app.get('/api/iris/transactions/:orderId/tracking', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getOrderTracking(req.params.orderId));
  });

  // ─── Phase 3: Alert Management ───────────────────────────────────────────────
  app.post('/api/iris/alerts', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.createAlert(req.body));
  });
  app.get('/api/iris/alerts', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.listAlerts(req.query.pan as string));
  });
  app.delete('/api/iris/alerts/:alertId', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.deleteAlert(req.params.alertId));
  });
  app.put('/api/iris/alerts/:alertId', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.updateAlert(req.params.alertId, req.body));
  });

  // ─── Phase 3: Compliance / AML ───────────────────────────────────────────────
  app.get('/api/iris/reports/compliance', requireAuth, requireAdmin, async (req, res) => {
    await wrap(res, () => irisKfintechService.getComplianceReport(req.query as Record<string, string>));
  });
  app.get('/api/iris/reports/pmla', requireAuth, requireAdmin, async (req, res) => {
    await wrap(res, () => irisKfintechService.getPmlaReport(req.query as Record<string, string>));
  });
  app.get('/api/iris/reports/aml', requireAuth, requireAdmin, async (req, res) => {
    await wrap(res, () => irisKfintechService.getAmlReport(req.query as Record<string, string>));
  });

  // ─── Phase 3: WhatsApp Notifications ─────────────────────────────────────────
  app.post('/api/iris/notifications/whatsapp', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.sendWhatsappNotification(req.body));
  });
  app.get('/api/iris/notifications/templates', requireAuth, requireAgent, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getNotificationTemplates());
  });
  app.get('/api/iris/notifications/history', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getNotificationHistory(req.query.pan as string));
  });

  // ─── Phase 3: NFO ─────────────────────────────────────────────────────────────
  app.get('/api/iris/nfo/active', requireAuth, async (_req, res) => {
    await wrap(res, () => irisKfintechService.getNfoSchemes());
  });
  app.get('/api/iris/nfo/:schemeCode', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getNfoSchemeDetails(req.params.schemeCode));
  });
  app.post('/api/iris/nfo/apply', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.applyNfo(req.body));
  });
  app.get('/api/iris/nfo/applications', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.getNfoApplications(req.query.pan as string));
  });
  app.post('/api/iris/nfo/applications/:applicationId/cancel', requireAuth, async (req, res) => {
    await wrap(res, () => irisKfintechService.cancelNfoApplication(req.params.applicationId));
  });

  // ─── External Portfolio / CAS Import ─────────────────────────────────────────
  // Fetch live CAS data by PAN directly from KFintech registry — no PDF upload required.
  app.get('/api/iris/portfolio/cas-fetch/:pan', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.fetchCasFromRegistry(req.params.pan, req.query as Record<string, string>));
  });

  // Import the fetched CAS data into IRIS portfolio tracking system.
  app.post('/api/iris/portfolio/import', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.importExternalPortfolio(req.body));
  });

  // View all externally linked / imported holdings for a given PAN.
  app.get('/api/iris/portfolio/external/:pan', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.getExternalPortfolio(req.params.pan));
  });

  // Link a single external folio (CAMS or KFintech) to the investor's IRIS profile.
  app.post('/api/iris/portfolio/external/link', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.linkExternalFolio(req.body));
  });

  // Unlink / remove an external folio from IRIS tracking.
  app.delete('/api/iris/portfolio/external/:folioNo', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.unlinkExternalFolio(req.params.folioNo));
  });

  // Trigger a live refresh of all external portfolio data for a PAN.
  app.post('/api/iris/portfolio/external/:pan/refresh', requireAuth, requireAgent, async (req, res) => {
    await wrap(res, () => irisKfintechService.refreshExternalPortfolio(req.params.pan));
  });

  console.log('✅ IRIS KFintech routes registered');
}
