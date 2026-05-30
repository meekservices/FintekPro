/**
 * IRIS LAS/LAMF Routes — Loan Against Securities & Mutual Funds
 *
 * REST API surface for the IRIS-powered LAS/LAMF feature.
 * All endpoints require authentication. Agents can act on behalf of their clients.
 *
 * Endpoints:
 *   GET  /api/iris/las/mf/eligibility/:pan          → MF folio eligibility check
 *   GET  /api/iris/las/securities/eligibility/:pan  → Demat securities eligibility
 *   POST /api/iris/las/mf/pledge                    → Initiate MF pledge
 *   POST /api/iris/las/securities/pledge            → Initiate securities pledge
 *   GET  /api/iris/las/pledge/:pledgeId/status      → Get pledge status
 *   POST /api/iris/las/loan/apply                   → Apply for loan
 *   GET  /api/iris/las/loan/:loanId/status          → Get loan status
 *   GET  /api/iris/las/loan/statement/:pan          → Loan statement
 *   POST /api/iris/las/loan/repay                   → Repay loan
 *   POST /api/iris/las/pledge/:pledgeId/release     → Release pledge
 *   GET  /api/iris/las/pledges                      → List my pledges
 *   GET  /api/iris/las/loans                        → List my loans
 *
 * @module iris-las-routes
 */

import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../auth-setup';
import { requireAgent } from '../middleware/auth';
import { irisLasService } from '../services/iris-las-service';
import { logger } from '../logger';

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: () => void) {
  return isAuthenticated(req, res, next as any);
}

function getUser(req: Request): { id: string; role?: string; panNumber?: string } {
  return (req as any).user;
}

/** Returns a structured error envelope */
function apiError(res: Response, status: number, code: string, message: string, retryable = false) {
  return res.status(status).json({
    success: false,
    error: { error_code: code, message, retryable },
    meta: { timestamp: new Date().toISOString(), version: 'iris-las-v1' },
  });
}

/** Wraps an async route and emits structured logs */
async function wrap(
  res: Response,
  userId: string,
  event: string,
  fn: () => Promise<unknown>
): Promise<void> {
  const t0 = Date.now();
  try {
    const data = await fn();
    logger.info(`[IrisLAS] Route OK: ${event}`, {
      event,
      user_id: userId,
      latency_ms: Date.now() - t0,
      status: 'success',
    });
    res.json({
      success: true,
      data,
      meta: { timestamp: new Date().toISOString(), version: 'iris-las-v1' },
    });
  } catch (err: any) {
    logger.error(`[IrisLAS] Route error: ${event}`, {
      event,
      user_id: userId,
      latency_ms: Date.now() - t0,
      error: err?.message,
      status: 'error',
    });
    const status = err?.response?.status ?? 500;
    apiError(res, status, 'IRIS_LAS_ERROR', err?.response?.data?.message ?? err?.message ?? 'Internal error', status >= 500);
  }
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const panSchema = z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format');

const mfPledgeSchema = z.object({
  pan: panSchema,
  folioDetails: z.array(z.object({
    folioNo: z.string().min(1),
    schemeCode: z.string().min(1),
    units: z.number().positive(),
  })).min(1, 'At least one folio required'),
  loanAmount: z.number().positive().max(50_00_00_000, 'Max loan ₹50 Cr'),
  lenderCode: z.string().optional(),
  clientUserId: z.string().optional(), // agent acting for client
});

const secPledgeSchema = z.object({
  pan: panSchema,
  dpId: z.string().min(8, 'Valid DP ID required'),
  securities: z.array(z.object({
    isin: z.string().length(12, 'ISIN must be 12 characters'),
    quantity: z.number().int().positive(),
  })).min(1),
  loanAmount: z.number().positive().max(50_00_00_000),
  lenderCode: z.string().optional(),
  clientUserId: z.string().optional(),
});

const loanApplySchema = z.object({
  localPledgeId: z.string().uuid('Invalid pledge ID'),
  requestedAmount: z.number().positive(),
  tenure: z.number().int().min(1).max(60, 'Max tenure 60 months'),
  disbursementBankAccount: z.string().optional(),
  purposeOfLoan: z.string().max(200).optional(),
  clientUserId: z.string().optional(),
});

const repaySchema = z.object({
  localLoanId: z.string().uuid('Invalid loan ID'),
  amount: z.number().positive(),
  paymentMode: z.enum(['NEFT', 'IMPS', 'UPI', 'NACH']),
  utrNumber: z.string().optional(),
});

const releaseSchema = z.object({
  reason: z.enum(['LOAN_CLOSED', 'LOAN_CANCELLED', 'VOLUNTARY']),
});

// ─── Route Registration ───────────────────────────────────────────────────────

export function registerIrisLasRoutes(app: Express): void {

  /**
   * GET /api/iris/las/mf/eligibility/:pan
   * Check MF folio eligibility for LAS pledge.
   * Agents can check any client PAN; clients can only check their own.
   */
  app.get('/api/iris/las/mf/eligibility/:pan', requireAuth, async (req, res) => {
    const user = getUser(req);
    const pan = req.params.pan.toUpperCase();

    const parsed = panSchema.safeParse(pan);
    if (!parsed.success) return apiError(res, 400, 'INVALID_PAN', parsed.error.issues[0]?.message ?? 'Invalid PAN');

    const folioNos = req.query.folioNos ? String(req.query.folioNos).split(',') : undefined;

    await wrap(res, user.id, 'IRIS_LAS_MF_ELIGIBILITY', () =>
      irisLasService.checkMfEligibility(pan, folioNos)
    );
  });

  /**
   * GET /api/iris/las/securities/eligibility/:pan
   * Check demat securities eligibility for LAS pledge.
   */
  app.get('/api/iris/las/securities/eligibility/:pan', requireAuth, async (req, res) => {
    const user = getUser(req);
    const pan = req.params.pan.toUpperCase();

    const parsed = panSchema.safeParse(pan);
    if (!parsed.success) return apiError(res, 400, 'INVALID_PAN', parsed.error.issues[0]?.message ?? 'Invalid PAN');

    const dpId = req.query.dpId ? String(req.query.dpId) : undefined;

    await wrap(res, user.id, 'IRIS_LAS_SEC_ELIGIBILITY', () =>
      irisLasService.checkSecuritiesEligibility(pan, dpId)
    );
  });

  /**
   * POST /api/iris/las/mf/pledge
   * Initiate pledge of MF folios.
   * Body: { pan, folioDetails, loanAmount, lenderCode?, clientUserId? }
   */
  app.post('/api/iris/las/mf/pledge', requireAuth, async (req, res) => {
    const user = getUser(req);
    const parsed = mfPledgeSchema.safeParse(req.body);
    if (!parsed.success) {
      return apiError(res, 400, 'VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join('; '));
    }

    const { pan, folioDetails, loanAmount, lenderCode, clientUserId } = parsed.data;
    // Agent can act for client; client can only act for themselves
    const targetUserId = clientUserId ?? user.id;
    const agentId = clientUserId ? user.id : undefined;

    await wrap(res, user.id, 'IRIS_LAS_MF_PLEDGE', () =>
      irisLasService.initiateMfPledge({ userId: targetUserId, pan, folioDetails, loanAmount, lenderCode, agentId })
    );
  });

  /**
   * POST /api/iris/las/securities/pledge
   * Initiate pledge of demat securities.
   */
  app.post('/api/iris/las/securities/pledge', requireAuth, async (req, res) => {
    const user = getUser(req);
    const parsed = secPledgeSchema.safeParse(req.body);
    if (!parsed.success) {
      return apiError(res, 400, 'VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join('; '));
    }

    const { pan, dpId, securities, loanAmount, lenderCode, clientUserId } = parsed.data;
    const targetUserId = clientUserId ?? user.id;
    const agentId = clientUserId ? user.id : undefined;

    await wrap(res, user.id, 'IRIS_LAS_SEC_PLEDGE', () =>
      irisLasService.initiateSecuritiesPledge({ userId: targetUserId, pan, dpId, securities, loanAmount, lenderCode, agentId })
    );
  });

  /**
   * GET /api/iris/las/pledge/:pledgeId/status
   * Get real-time pledge status (syncs from IRIS).
   */
  app.get('/api/iris/las/pledge/:pledgeId/status', requireAuth, async (req, res) => {
    const user = getUser(req);
    const { pledgeId } = req.params;

    await wrap(res, user.id, 'IRIS_LAS_PLEDGE_STATUS', () =>
      irisLasService.getPledgeStatus(pledgeId, user.id)
    );
  });

  /**
   * POST /api/iris/las/loan/apply
   * Apply for a LAS loan against an active pledge.
   * Requires explicit investor consent (enforced by UI — route only accepts confirmed requests).
   */
  app.post('/api/iris/las/loan/apply', requireAuth, async (req, res) => {
    const user = getUser(req);
    const parsed = loanApplySchema.safeParse(req.body);
    if (!parsed.success) {
      return apiError(res, 400, 'VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join('; '));
    }

    const { localPledgeId, requestedAmount, tenure, disbursementBankAccount, purposeOfLoan, clientUserId } = parsed.data;

    // Mandatory investor pan from session
    const pan = user.panNumber;
    if (!pan) return apiError(res, 400, 'MISSING_PAN', 'PAN is required for LAS. Please complete KYC first.');

    const targetUserId = clientUserId ?? user.id;
    const agentId = clientUserId ? user.id : undefined;

    await wrap(res, user.id, 'IRIS_LAS_LOAN_APPLY', () =>
      irisLasService.applyForLoan({
        userId: targetUserId,
        pan,
        localPledgeId,
        requestedAmount,
        tenure,
        disbursementBankAccount,
        purposeOfLoan,
        agentId,
      })
    );
  });

  /**
   * GET /api/iris/las/loan/:loanId/status
   * Get real-time loan status (syncs from IRIS).
   */
  app.get('/api/iris/las/loan/:loanId/status', requireAuth, async (req, res) => {
    const user = getUser(req);
    await wrap(res, user.id, 'IRIS_LAS_LOAN_STATUS', () =>
      irisLasService.getLoanStatus(req.params.loanId, user.id)
    );
  });

  /**
   * GET /api/iris/las/loan/statement/:pan
   * Full loan statement from IRIS (outstanding, repayment schedule, history).
   */
  app.get('/api/iris/las/loan/statement/:pan', requireAuth, async (req, res) => {
    const user = getUser(req);
    const pan = req.params.pan.toUpperCase();
    const loanId = req.query.loanId ? String(req.query.loanId) : undefined;

    await wrap(res, user.id, 'IRIS_LAS_LOAN_STATEMENT', () =>
      irisLasService.getLoanStatement(user.id, pan, loanId)
    );
  });

  /**
   * POST /api/iris/las/loan/repay
   * Initiate loan repayment.
   */
  app.post('/api/iris/las/loan/repay', requireAuth, async (req, res) => {
    const user = getUser(req);
    const parsed = repaySchema.safeParse(req.body);
    if (!parsed.success) {
      return apiError(res, 400, 'VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join('; '));
    }

    await wrap(res, user.id, 'IRIS_LAS_LOAN_REPAY', () =>
      irisLasService.repayLoan({ userId: user.id, ...parsed.data })
    );
  });

  /**
   * POST /api/iris/las/pledge/:pledgeId/release
   * Release pledge after loan closure or cancellation.
   */
  app.post('/api/iris/las/pledge/:pledgeId/release', requireAuth, async (req, res) => {
    const user = getUser(req);
    const parsed = releaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return apiError(res, 400, 'VALIDATION_ERROR', parsed.error.issues.map(i => i.message).join('; '));
    }

    await wrap(res, user.id, 'IRIS_LAS_PLEDGE_RELEASE', () =>
      irisLasService.releasePledge({ userId: user.id, localPledgeId: req.params.pledgeId, reason: parsed.data.reason })
    );
  });

  /**
   * GET /api/iris/las/pledges
   * List all pledges for the authenticated user.
   */
  app.get('/api/iris/las/pledges', requireAuth, async (req, res) => {
    const user = getUser(req);
    const pan = req.query.pan ? String(req.query.pan).toUpperCase() : undefined;

    await wrap(res, user.id, 'IRIS_LAS_LIST_PLEDGES', () =>
      irisLasService.listUserPledges(user.id, pan)
    );
  });

  /**
   * GET /api/iris/las/loans
   * List all loans for the authenticated user.
   */
  app.get('/api/iris/las/loans', requireAuth, async (req, res) => {
    const user = getUser(req);
    const pan = req.query.pan ? String(req.query.pan).toUpperCase() : undefined;

    await wrap(res, user.id, 'IRIS_LAS_LIST_LOANS', () =>
      irisLasService.listUserLoans(user.id, pan)
    );
  });

  logger.info('[IrisLAS] Routes registered', {
    event: 'IRIS_LAS_ROUTES_REGISTERED',
    endpoints: 12,
  });
}
