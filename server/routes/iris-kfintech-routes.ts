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


  console.log('✅ IRIS KFintech routes registered');
}
