// @ts-nocheck
import type { Express, Request, Response, NextFunction } from "express";
import { irisKfintechService } from "../services/iris-kfintech-service";
import {
	scheduleIrisPortfolioRefresh,
	syncIrisHoldingsForPan,
} from "../services/iris-portfolio-sync-service";
import { ComplianceAuditPackService } from "../services/compliance-audit-pack-service";
import { isAuthenticated } from "../auth-setup";
import { requireAdmin, requireAgent } from "../middleware/auth";
import { requireTransactionCompliance } from "../middleware/transactionComplianceGate";

function requireAuth(req: Request, res: Response, next: NextFunction) {
	return isAuthenticated(req, res, next);
}

async function wrap(res: Response, fn: () => Promise<unknown>): Promise<void> {
	try {
		const data = await fn();
		res.json({ success: true, data });
	} catch (err: unknown) {
		const e = err as {
			response?: { data?: { message?: string }; status?: number };
			message?: string;
		};
		const msg = e?.response?.data?.message ?? e?.message ?? "IRIS API error";
		// When IRIS is not yet authenticated/configured, return empty 200 instead of 500
		// so the agent dashboard loads gracefully without error toasts
		if (
			msg === "IRIS authentication failed" ||
			msg?.includes("IRIS_USERNAME") ||
			msg?.includes("IRIS_PASSWORD")
		) {
			return res.json({
				success: true,
				data: null,
				unconfigured: true,
				message:
					"IRIS/KFintech credentials not configured. Complete OTP login via Admin → IRIS settings.",
			});
		}
		const status = e?.response?.status ?? 500;
		res.status(status).json({ success: false, message: msg });
	}
}

export function registerIrisKfintechRoutes(app: Express): void {
	// ─── Status ──────────────────────────────────────────────────────────────────
	app.get("/api/iris/status", requireAuth, (_req, res) => {
		res.json({ success: true, data: irisKfintechService.getStatus() });
	});

	// ─── OTP Auth (admin-only) ────────────────────────────────────────────────────
	app.post(
		"/api/iris/auth/send-otp",
		requireAuth,
		requireAdmin,
		async (req, res) => {
			try {
				const pan = req.body?.pan as string | undefined;
				const mobile = req.body?.mobile as string | undefined;
				if (!pan) {
					return res.status(400).json({ success: false, message: "PAN is required" });
				}
				const result = (await irisKfintechService.sendOtp(
					pan,
					mobile,
				)) as { success?: boolean; message?: string };
				if (result?.success === false) {
					res.status(502).json(result);
				} else {
					res.json(result);
				}
			} catch (err: unknown) {
				const e = err as { message?: string };
				res
					.status(502)
					.json({
						success: false,
						message: e?.message ?? "IRIS OTP request failed",
					});
			}
		},
	);

	app.post(
		"/api/iris/auth/submit-otp",
		requireAuth,
		requireAdmin,
		async (req, res) => {
			try {
				const result = (await irisKfintechService.submitOtp(
					req.body?.otp as string,
				)) as { success?: boolean; message?: string };
				if (result?.success === false) {
					res.status(502).json(result);
				} else {
					res.json(result);
				}
			} catch (err: unknown) {
				const e = err as { message?: string };
				res
					.status(502)
					.json({
						success: false,
						message: e?.message ?? "IRIS OTP verification failed",
					});
			}
		},
	);

	// ─── Dashboard ───────────────────────────────────────────────────────────────
	app.get(
		"/api/iris/dashboard/aum-summary",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getAumSummary());
		},
	);

	app.get(
		"/api/iris/dashboard/fund-earnings",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getFundEarnings());
		},
	);

	app.get(
		"/api/iris/dashboard/sip-summary",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getSipSummary());
		},
	);

	app.get(
		"/api/iris/dashboard/unique-investors",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getUniqueInvestors());
		},
	);

	app.get(
		"/api/iris/dashboard/inflow-outflow",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getInflowOutflow(
					req.query as Record<string, string>,
				),
			);
		},
	);

	app.get(
		"/api/iris/dashboard/euins",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getEuins());
		},
	);

	// ─── Empanelment ─────────────────────────────────────────────────────────────
	app.get(
		"/api/iris/empanelment/amc-list",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getEmpanelmentAmcList());
		},
	);

	app.get(
		"/api/iris/empanelment/amc-status",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getAmcEmpanelmentStatus(
					req.query.amcCode as string | undefined,
				),
			);
		},
	);

	app.get(
		"/api/iris/empanelment/fd-status",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getFdEmpanelmentStatus());
		},
	);

	app.get(
		"/api/iris/empanelment/nps-status",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getNpsEmpanelmentStatus());
		},
	);

	app.post(
		"/api/iris/empanelment/resend-esign",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const { empanelmentId } = req.body as { empanelmentId: string };
			await wrap(res, () => irisKfintechService.resendEsignLink(empanelmentId));
		},
	);

	// ─── Investors ───────────────────────────────────────────────────────────────
	app.get(
		"/api/iris/investors",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const { search, page, limit } = req.query as Record<
				string,
				string | undefined
			>;
			await wrap(res, () =>
				irisKfintechService.listInvestors({
					search,
					page: page ? Number(page) : undefined,
					limit: limit ? Number(limit) : undefined,
				}),
			);
		},
	);

	app.get(
		"/api/iris/investors/:pan",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getInvestorDetails(req.params.pan),
			);
		},
	);

	app.get(
		"/api/iris/investors/:pan/kyc",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getInvestorKycDetails(req.params.pan),
			);
		},
	);

	app.get(
		"/api/iris/investors/:pan/portfolio-summary",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getPortfolioSummary(req.params.pan),
			);
		},
	);

	app.get(
		"/api/iris/investors/:pan/investments",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getInvestmentDetails(req.params.pan),
			);
		},
	);

	app.get(
		"/api/iris/investors/:pan/transactions",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getTransactionDetails(
					req.params.pan,
					req.query as Record<string, string>,
				),
			);
		},
	);

	app.get(
		"/api/iris/investors/:pan/systematic-plans",
		requireAuth,
		requireAgent,
		async (req, res) => {
			try {
				const data = await irisKfintechService.getSystematicPlanDetails(
					req.params.pan,
				);
				res.json({ success: true, data });
			} catch (err: any) {
				res.status(500).json({ success: false, message: err.message });
			}
		},
	);

	app.get(
		"/api/iris/investors/:pan/family-portfolio",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getFamilyPortfolio(req.params.pan),
			);
		},
	);

	app.get(
		"/api/iris/investors/:pan/portfolio-insights",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getPortfolioInsights(req.params.pan),
			);
		},
	);

	app.get(
		"/api/iris/investors/:pan/kra-status",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () => irisKfintechService.getKraStatus(req.params.pan));
		},
	);

	app.get(
		"/api/iris/investors/:pan/sip-health",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () => irisKfintechService.getSipHealth(req.params.pan));
		},
	);

	app.post(
		"/api/iris/investors/:pan/send-ekyc-mail",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () => irisKfintechService.sendEkycMail(req.params.pan));
		},
	);

	app.post(
		"/api/iris/investors/:pan/send-reminder",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.sendReminderMail(
					req.params.pan,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	// ─── Scheme Search ────────────────────────────────────────────────────────────
	// Dedicated scheme-search endpoint — wraps IRIS scheme search endpoint
	app.get(
		"/api/iris/transactions/scheme-search",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.searchSchemes(req.query.q as string),
			);
		},
	);

	// ─── Transactions ─────────────────────────────────────────────────────────────
	app.get(
		"/api/iris/transactions/funds",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getAllFunds());
		},
	);

	app.get(
		"/api/iris/transactions/funds/:fundCode/schemes",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSchemesByFund(req.params.fundCode),
			);
		},
	);

	app.get(
		"/api/iris/transactions/schemes/:schemeCode",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSchemeDetails(req.params.schemeCode),
			);
		},
	);

	app.get(
		"/api/iris/transactions/nfo",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getNfoData());
		},
	);

	app.get(
		"/api/iris/transactions/payment-modes",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getAvailablePaymentModes(
					req.query.pan as string,
					req.query.schemeCode as string,
				),
			);
		},
	);

	app.get(
		"/api/iris/transactions/direct-pay-status",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getDirectPayStatus(
					req.query.pan as string,
					req.query.accountNo as string,
				),
			);
		},
	);

	app.post(
		"/api/iris/transactions/validate",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.validateInvestment(
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	app.post(
		"/api/iris/transactions/place-order",
		requireAuth,
		requireAgent,
		requireTransactionCompliance("MF", "purchase"),
		async (req, res) => {
			const pan = (req.body as any)?.pan;
			const userId = (req as any).user?.id;

			await wrap(res, async () => {
				const result = await irisKfintechService.placeOrder(
					req.body as Record<string, unknown>,
				);

				// Generate Audit Pack for this trade
				if (userId) {
					await ComplianceAuditPackService.generateAuditPack(
						userId,
						"order_placement",
						result?.orderId || "MF-ORDER",
						{
							provider: "Iris",
							complianceGates: res.locals.complianceResult?.gates?.length ?? 7,
							...req.body,
						},
					);
				}
				return result;
			});

			if (pan && userId) scheduleIrisPortfolioRefresh(pan, userId);
		},
	);

	app.post(
		"/api/iris/transactions/place-redemption",
		requireAuth,
		requireAgent,
		requireTransactionCompliance("MF", "redemption"),
		async (req, res) => {
			const pan = (req.body as any)?.pan;
			await wrap(res, () =>
				irisKfintechService.placeRedemption(
					req.body as Record<string, unknown>,
				),
			);
			if (pan) scheduleIrisPortfolioRefresh(pan, (req as any).user?.id);
		},
	);

	app.post(
		"/api/iris/transactions/sip/cancel",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.cancelSip(req.body as Record<string, unknown>),
			);
		},
	);

	app.post(
		"/api/iris/transactions/sip/pause",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.pauseSip(req.body as Record<string, unknown>),
			);
		},
	);

	app.post(
		"/api/iris/transactions/:orderId/cancel",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.cancelOrder(req.params.orderId),
			);
		},
	);

	app.post(
		"/api/iris/transactions/:orderId/reinitiate",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.reinitiateOrder(req.params.orderId),
			);
		},
	);

	app.get(
		"/api/iris/transactions/mandates",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getMandates(req.query.pan as string),
			);
		},
	);

	// ─── Products ─────────────────────────────────────────────────────────────────
	app.get(
		"/api/iris/products/aif-links",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getAifLinks());
		},
	);

	app.get(
		"/api/iris/products/pms-links",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getPmsLinks());
		},
	);

	app.get(
		"/api/iris/products/fixed-deposits",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getFixedDepositProducts());
		},
	);

	app.get(
		"/api/iris/products/fixed-deposits/:productId/brochure",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getFdBrochure(req.params.productId),
			);
		},
	);

	app.get(
		"/api/iris/products/nps-links",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getNpsInvestmentLinks());
		},
	);

	// ─── Reports ──────────────────────────────────────────────────────────────────
	app.get(
		"/api/iris/reports/capital-gains/:pan",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getCgStatement(
					req.params.pan,
					req.query as Record<string, string>,
				),
			);
		},
	);

	app.get(
		"/api/iris/reports/client-statement/:pan",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getClientStatement(
					req.params.pan,
					req.query as Record<string, string>,
				),
			);
		},
	);

	app.get(
		"/api/iris/reports/transaction-statement/:pan",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getTransactionStatement(
					req.params.pan,
					req.query as Record<string, string>,
				),
			);
		},
	);

	app.get(
		"/api/iris/reports/portfolio-summary/:pan",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getPortfolioReport(
					req.params.pan,
					req.query as Record<string, string>,
				),
			);
		},
	);

	// STP Registration
	app.post(
		"/api/iris/transactions/stp/register",
		requireAuth,
		requireAgent,
		requireTransactionCompliance("MF", "stp"),
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.registerStp(req.body as Record<string, unknown>),
			);
		},
	);

	app.post(
		"/api/iris/transactions/stp/cancel",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.cancelStp(req.body as Record<string, unknown>),
			);
		},
	);

	app.post(
		"/api/iris/transactions/stp/pause",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.pauseStp(req.body as Record<string, unknown>),
			);
		},
	);

	// SWP Registration
	app.post(
		"/api/iris/transactions/swp/register",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.registerSwp(req.body as Record<string, unknown>),
			);
		},
	);

	app.post(
		"/api/iris/transactions/swp/cancel",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.cancelSwp(req.body as Record<string, unknown>),
			);
		},
	);

	app.post(
		"/api/iris/transactions/swp/pause",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.pauseSwp(req.body as Record<string, unknown>),
			);
		},
	);

	// Additional Purchase
	app.post(
		"/api/iris/transactions/additional-purchase",
		requireAuth,
		requireAgent,
		requireTransactionCompliance("MF", "purchase"),
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.placeAdditionalPurchase(
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	// eNACH / Mandate Creation
	app.post(
		"/api/iris/transactions/mandates",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.createMandate(req.body as Record<string, unknown>),
			);
		},
	);

	app.get(
		"/api/iris/transactions/mandates/:mandateId",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getMandateStatus(req.params.mandateId),
			);
		},
	);

	app.get(
		"/api/iris/transactions/mandates/active",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.listActiveMandatesByBank(
					req.query.pan as string,
					req.query.accountNo as string,
				),
			);
		},
	);

	// Fixed Deposit Orders
	app.post(
		"/api/iris/products/fixed-deposits/order",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.placeFdOrder(req.body as Record<string, unknown>),
			);
		},
	);

	app.get(
		"/api/iris/products/fixed-deposits/orders",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getFdOrders(req.query.pan as string),
			);
		},
	);

	app.get(
		"/api/iris/products/fixed-deposits/orders/:orderId",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getFdOrderDetails(req.params.orderId),
			);
		},
	);

	app.post(
		"/api/iris/products/fixed-deposits/orders/:orderId/premature-closure",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.prematureCloseFd(
					req.params.orderId,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	app.get(
		"/api/iris/products/fixed-deposits/maturity",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getFdMaturityList(
					req.query as Record<string, string>,
				),
			);
		},
	);

	app.get(
		"/api/iris/products/fixed-deposits/interest-calculator",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.calculateFdInterest(
					req.query as Record<string, string>,
				),
			);
		},
	);

	// NPS
	app.get(
		"/api/iris/nps/subscriber/:pran",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getNpsSubscriberDetails(req.params.pran),
			);
		},
	);

	app.get(
		"/api/iris/nps/subscriber/:pran/portfolio",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getNpsPortfolio(req.params.pran),
			);
		},
	);

	app.get(
		"/api/iris/nps/subscriber/:pran/fund-values",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getNpsFundValues(req.params.pran),
			);
		},
	);

	app.get(
		"/api/iris/nps/subscriber/:pran/transactions",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getNpsTransactions(
					req.params.pran,
					req.query as Record<string, string>,
				),
			);
		},
	);

	app.post(
		"/api/iris/nps/subscriber/:pran/scheme-change",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.changeNpsScheme(
					req.params.pran,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	app.post(
		"/api/iris/nps/subscriber/:pran/partial-withdrawal",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.npsPartialWithdrawal(
					req.params.pran,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	app.post(
		"/api/iris/nps/subscriber/onboarding",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.initiateNpsOnboarding(
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	app.post(
		"/api/iris/nps/transactions/contribution",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.placeNpsContribution(
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	// Non-Financial Transactions — GET (read current values)
	app.get(
		"/api/iris/non-financial/:pan/nominee",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getNomineeDetails(req.params.pan),
			);
		},
	);

	app.get(
		"/api/iris/non-financial/:pan/bank",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () => irisKfintechService.getBankDetails(req.params.pan));
		},
	);

	app.get(
		"/api/iris/non-financial/:pan/fatca",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getFatcaDetails(req.params.pan),
			);
		},
	);

	// Dividend History
	app.get(
		"/api/iris/investors/:pan/dividend-history",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getDividendHistory(
					req.params.pan,
					req.query as Record<string, string>,
				),
			);
		},
	);

	// eKYC Status
	app.get(
		"/api/iris/investors/:pan/ekyc-status",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () => irisKfintechService.getEkycStatus(req.params.pan));
		},
	);

	// Demat Accounts
	app.get(
		"/api/iris/investors/:pan/demat-accounts",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getDematAccounts(req.params.pan),
			);
		},
	);

	app.post(
		"/api/iris/investors/:pan/demat-accounts",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.linkDematAccount(
					req.params.pan,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	// Investor Documents
	app.get(
		"/api/iris/investors/:pan/documents",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getInvestorDocuments(req.params.pan),
			);
		},
	);

	app.post(
		"/api/iris/investors/:pan/documents",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.uploadInvestorDocument(
					req.params.pan,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	// Financial Goals
	app.get(
		"/api/iris/investors/:pan/goals",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () => irisKfintechService.getGoals(req.params.pan));
		},
	);

	app.post(
		"/api/iris/investors/:pan/goals",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.createGoal(
					req.params.pan,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	app.put(
		"/api/iris/investors/:pan/goals/:goalId",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.updateGoal(
					req.params.pan,
					req.params.goalId,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	app.delete(
		"/api/iris/investors/:pan/goals/:goalId",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.deleteGoal(req.params.pan, req.params.goalId),
			);
		},
	);

	// Non-Financial Transactions — POST (write)
	app.post(
		"/api/iris/non-financial/:pan/nominee",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.updateNominee(
					req.params.pan,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	app.post(
		"/api/iris/non-financial/:pan/email",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.updateEmail(
					req.params.pan,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	app.post(
		"/api/iris/non-financial/:pan/mobile",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.updateMobile(
					req.params.pan,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	app.post(
		"/api/iris/non-financial/:pan/fatca",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.updateFatca(
					req.params.pan,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	app.post(
		"/api/iris/non-financial/:pan/idcw",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.updateIdcw(
					req.params.pan,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	app.post(
		"/api/iris/non-financial/:pan/bank",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.updateBankDetails(
					req.params.pan,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	app.post(
		"/api/iris/non-financial/:pan/bank-mandate",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.manageBankMandate(
					req.params.pan,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	// Business Hierarchy
	app.get(
		"/api/iris/hierarchy/sub-brokers",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.listSubBrokers(req.query as Record<string, string>),
			);
		},
	);

	app.get(
		"/api/iris/hierarchy/sub-brokers/:euinCode",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSubBrokerDetails(req.params.euinCode),
			);
		},
	);

	app.get(
		"/api/iris/hierarchy/sub-brokers/:euinCode/aum",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSubBrokerAum(
					req.params.euinCode,
					req.query as Record<string, string>,
				),
			);
		},
	);

	app.post(
		"/api/iris/hierarchy/employees",
		requireAuth,
		requireAdmin,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.addEmployee(req.body as Record<string, unknown>),
			);
		},
	);

	app.put(
		"/api/iris/hierarchy/employees/:euinCode",
		requireAuth,
		requireAdmin,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.updateEmployee(
					req.params.euinCode,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	// Bulk Reports
	app.get(
		"/api/iris/reports/bulk/capital-gains",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getBulkCapitalGains(
					req.query as Record<string, string>,
				),
			);
		},
	);

	app.get(
		"/api/iris/reports/sip-maturity-calendar",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSipMaturityCalendar(
					req.query as Record<string, string>,
				),
			);
		},
	);

	app.get(
		"/api/iris/reports/dividend-tracker",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getDividendTracker(
					req.query as Record<string, string>,
				),
			);
		},
	);

	app.get(
		"/api/iris/reports/bulk/portfolio",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getBulkPortfolioReport(
					req.query as Record<string, string>,
				),
			);
		},
	);

	// ─── SIP Lifecycle ────────────────────────────────────────────────────────────
	app.post(
		"/api/iris/transactions/sip/register",
		requireAuth,
		requireAgent,
		requireTransactionCompliance("MF", "sip"),
		async (req, res) => {
			const pan = (req.body as any)?.pan;
			await wrap(res, () =>
				irisKfintechService.registerSip(req.body as Record<string, unknown>),
			);
			if (pan) scheduleIrisPortfolioRefresh(pan, (req as any).user?.id);
		},
	);

	app.patch(
		"/api/iris/transactions/sip/:sipId/modify",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.modifySip(
					req.params.sipId,
					req.body as Record<string, unknown>,
				),
			);
		},
	);

	app.get(
		"/api/iris/transactions/sip/:sipId",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSipDetails(req.params.sipId),
			);
		},
	);

	// ─── Order Status / Ledger ────────────────────────────────────────────────────
	app.get(
		"/api/iris/transactions/orders",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const { pan, ...rest } = req.query as Record<string, string>;
			await wrap(res, () =>
				irisKfintechService.listOrdersByPan(
					pan,
					Object.keys(rest).length ? rest : undefined,
				),
			);
		},
	);

	app.get(
		"/api/iris/transactions/orders/:orderId",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getOrderDetails(req.params.orderId),
			);
		},
	);

	app.get(
		"/api/iris/transactions/switch/:orderId/status",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSwitchStatus(req.params.orderId),
			);
		},
	);

	// ─── STP Status ───────────────────────────────────────────────────────────────
	app.get(
		"/api/iris/transactions/stp",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.listStpsByPan(req.query.pan as string),
			);
		},
	);

	app.get(
		"/api/iris/transactions/stp/:stpId",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getStpDetails(req.params.stpId),
			);
		},
	);

	// ─── SWP Status ───────────────────────────────────────────────────────────────
	app.get(
		"/api/iris/transactions/swp",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.listSwpsByPan(req.query.pan as string),
			);
		},
	);

	app.get(
		"/api/iris/transactions/swp/:swpId",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSwpDetails(req.params.swpId),
			);
		},
	);

	// ─── Failed/Rejected Transactions ────────────────────────────────────────────
	app.get(
		"/api/iris/transactions/failed",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.listFailedTransactions(req.query.pan as string),
			);
		},
	);

	// ─── Phase 1: Switch (IRIS namespace) ────────────────────────────────────────
	app.post("/api/iris/transactions/switch", requireAuth, async (req, res) => {
		await wrap(res, () => irisKfintechService.placeSwitch(req.body));
	});
	app.post(
		"/api/iris/transactions/switch/cancel",
		requireAuth,
		async (req, res) => {
			await wrap(res, () => irisKfintechService.cancelSwitch(req.body));
		},
	);
	app.post(
		"/api/iris/transactions/switch/:orderId/reinitiate",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.reinitiateSwitch(req.params.orderId),
			);
		},
	);

	// ─── Phase 1: eNACH ──────────────────────────────────────────────────────────
	app.post("/api/iris/enach/create", requireAuth, async (req, res) => {
		await wrap(res, () => irisKfintechService.createEnach(req.body));
	});
	app.get(
		"/api/iris/enach/:mandateId/status",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getEnachStatus(req.params.mandateId),
			);
		},
	);
	app.post(
		"/api/iris/enach/:mandateId/cancel",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.cancelEnach(req.params.mandateId),
			);
		},
	);
	app.get("/api/iris/enach", requireAuth, async (req, res) => {
		await wrap(res, () =>
			irisKfintechService.listEnach(req.query.pan as string),
		);
	});
	app.post(
		"/api/iris/enach/:mandateId/regenerate-link",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.regenerateEnachLink(req.params.mandateId),
			);
		},
	);

	// ─── Phase 1: UPI Autopay Mandate ────────────────────────────────────────────
	app.post("/api/iris/mandates/upi", requireAuth, async (req, res) => {
		await wrap(res, () => irisKfintechService.createUpiMandate(req.body));
	});
	app.get("/api/iris/mandates/upi/:umrn", requireAuth, async (req, res) => {
		await wrap(res, () =>
			irisKfintechService.getUpiMandateStatus(req.params.umrn),
		);
	});
	app.post(
		"/api/iris/mandates/upi/:umrn/cancel",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.cancelUpiMandate(req.params.umrn),
			);
		},
	);
	app.get("/api/iris/mandates/upi", requireAuth, async (req, res) => {
		await wrap(res, () =>
			irisKfintechService.listUpiMandates(req.query.pan as string),
		);
	});

	// ─── Physical NACH Mandate ────────────────────────────────────────────────────
	app.post(
		"/api/iris/mandates/physical",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const { pan, bankName, accountNumber, ifscCode, fileContent } =
				req.body as Record<string, string>;
			if (!pan || !bankName || !accountNumber || !ifscCode || !fileContent) {
				res
					.status(400)
					.json({
						success: false,
						message:
							"pan, bankName, accountNumber, ifscCode, and fileContent are required",
					});
				return;
			}
			await wrap(res, () =>
				irisKfintechService.uploadPhysicalMandate(req.body),
			);
		},
	);
	app.get(
		"/api/iris/mandates/physical",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const pan = req.query.pan as string;
			if (!pan) {
				res
					.status(400)
					.json({ success: false, message: "pan query parameter is required" });
				return;
			}
			await wrap(res, () => irisKfintechService.listPhysicalMandates(pan));
		},
	);

	// ─── Phase 1: Folio Management ───────────────────────────────────────────────
	app.get("/api/iris/investors/:pan/folios", requireAuth, async (req, res) => {
		await wrap(res, () => irisKfintechService.listFolios(req.params.pan));
	});
	app.get(
		"/api/iris/investors/:pan/folios/:folioNo",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getFolioDetails(req.params.pan, req.params.folioNo),
			);
		},
	);
	app.get(
		"/api/iris/investors/:pan/folios/:folioNo/transactions",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getFolioTransactions(
					req.params.pan,
					req.params.folioNo,
					req.query,
				),
			);
		},
	);

	// ─── Phase 1: Investor Portal Link ───────────────────────────────────────────
	app.get(
		"/api/iris/investors/:pan/portal-link",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getInvestorPortalLink(req.params.pan),
			);
		},
	);
	app.post(
		"/api/iris/investors/:pan/portal-link/send",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.sendPortalLinkToInvestor(req.params.pan, req.body),
			);
		},
	);

	// ─── Phase 2: Commission Statements ──────────────────────────────────────────
	app.get(
		"/api/iris/reports/commission",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getCommissionStatement(
					req.query as Record<string, string>,
				),
			);
		},
	);
	app.get(
		"/api/iris/reports/trail-commission",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getTrailCommission(
					req.query as Record<string, string>,
				),
			);
		},
	);
	app.get(
		"/api/iris/reports/commission/summary",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getCommissionSummary(
					req.query as Record<string, string>,
				),
			);
		},
	);
	app.get(
		"/api/iris/reports/commission/amc-wise",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getAmcWiseCommission(
					req.query as Record<string, string>,
				),
			);
		},
	);

	// ─── Phase 2: Digital Investor Onboarding ────────────────────────────────────
	app.post(
		"/api/iris/onboarding/initiate",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.initiateInvestorOnboarding(req.body),
			);
		},
	);
	app.get(
		"/api/iris/onboarding/:applicationId/status",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getOnboardingStatus(req.params.applicationId),
			);
		},
	);
	app.post(
		"/api/iris/onboarding/:applicationId/kyc-verify",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.verifyOnboardingKyc(
					req.params.applicationId,
					req.body,
				),
			);
		},
	);
	app.get(
		"/api/iris/onboarding/applications",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.listOnboardingApplications(
					req.query as Record<string, string>,
				),
			);
		},
	);
	app.post(
		"/api/iris/onboarding/:applicationId/resend-link",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.resendOnboardingLink(req.params.applicationId),
			);
		},
	);

	// ─── Phase 2: CAS Statement ──────────────────────────────────────────────────
	app.get("/api/iris/reports/cas/:pan", requireAuth, async (req, res) => {
		await wrap(res, () =>
			irisKfintechService.getCasStatement(
				req.params.pan,
				req.query as Record<string, string>,
			),
		);
	});
	app.post("/api/iris/reports/cas/generate", requireAuth, async (req, res) => {
		await wrap(res, () => irisKfintechService.generateCasStatement(req.body));
	});

	// ─── Phase 2: XIRR & Returns ─────────────────────────────────────────────────
	app.get("/api/iris/analytics/xirr/:pan", requireAuth, async (req, res) => {
		await wrap(res, () =>
			irisKfintechService.getInvestorXirr(
				req.params.pan,
				req.query as Record<string, string>,
			),
		);
	});
	app.get("/api/iris/analytics/returns/:pan", requireAuth, async (req, res) => {
		await wrap(res, () =>
			irisKfintechService.getInvestorReturns(
				req.params.pan,
				req.query as Record<string, string>,
			),
		);
	});
	app.get(
		"/api/iris/analytics/portfolio-xirr/:pan",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getPortfolioXirr(req.params.pan),
			);
		},
	);
	app.get(
		"/api/iris/schemes/:schemeCode/returns",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSchemeReturns(req.params.schemeCode),
			);
		},
	);

	// ─── Phase 3: Scheme NAV History ─────────────────────────────────────────────
	app.get(
		"/api/iris/schemes/:schemeCode/nav-history",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSchemeNavHistory(
					req.params.schemeCode,
					req.query as Record<string, string>,
				),
			);
		},
	);
	app.get(
		"/api/iris/schemes/:schemeCode/nav",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSchemeLatestNav(req.params.schemeCode),
			);
		},
	);

	// ─── Phase 3: Scheme Performance & Holdings ──────────────────────────────────
	app.get(
		"/api/iris/schemes/:schemeCode/performance",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSchemePerformance(req.params.schemeCode),
			);
		},
	);
	app.get("/api/iris/schemes/top-performers", requireAuth, async (req, res) => {
		await wrap(res, () =>
			irisKfintechService.getTopPerformingSchemes(
				req.query as Record<string, string>,
			),
		);
	});
	app.get(
		"/api/iris/schemes/:schemeCode/holdings",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSchemeHoldings(req.params.schemeCode),
			);
		},
	);
	app.get(
		"/api/iris/schemes/:schemeCode/factsheet",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSchemeFactSheet(req.params.schemeCode),
			);
		},
	);

	// ─── Phase 3: Scheme Comparison ──────────────────────────────────────────────
	app.post("/api/iris/schemes/compare", requireAuth, async (req, res) => {
		await wrap(res, () => irisKfintechService.compareSchemes(req.body));
	});

	// ─── Phase 3: Scheme Categories ──────────────────────────────────────────────
	app.get("/api/iris/categories", requireAuth, async (req, res) => {
		await wrap(res, () => irisKfintechService.getSchemeCategories());
	});
	app.get("/api/iris/subcategories", requireAuth, async (req, res) => {
		await wrap(res, () =>
			irisKfintechService.getSchemeSubcategories(req.query.category as string),
		);
	});
	app.get("/api/iris/schemes/by-category", requireAuth, async (req, res) => {
		await wrap(res, () =>
			irisKfintechService.getSchemesByCategory(
				req.query.category as string,
				req.query as Record<string, string>,
			),
		);
	});

	// ─── Phase 3: Risk Profiling ──────────────────────────────────────────────────
	app.get(
		"/api/iris/risk-profile/questionnaire",
		requireAuth,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getRiskQuestionnaire());
		},
	);
	app.post(
		"/api/iris/investors/:pan/risk-profile",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.submitRiskProfile(req.params.pan, req.body),
			);
		},
	);
	app.get(
		"/api/iris/investors/:pan/risk-profile",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getInvestorRiskProfile(req.params.pan),
			);
		},
	);
	app.get("/api/iris/schemes/recommended", requireAuth, async (req, res) => {
		await wrap(res, () =>
			irisKfintechService.getSchemesForRiskProfile(
				req.query.riskProfile as string,
			),
		);
	});

	// ─── Phase 3: Application / Order Tracking ───────────────────────────────────
	app.get(
		"/api/iris/applications",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.listApplications(
					req.query as Record<string, string>,
				),
			);
		},
	);
	app.get(
		"/api/iris/applications/:applicationId/status",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getApplicationStatus(req.params.applicationId),
			);
		},
	);
	app.get(
		"/api/iris/transactions/:orderId/tracking",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getOrderTracking(req.params.orderId),
			);
		},
	);

	// ─── Phase 3: Alert Management ───────────────────────────────────────────────
	app.post("/api/iris/alerts", requireAuth, async (req, res) => {
		await wrap(res, () => irisKfintechService.createAlert(req.body));
	});
	app.get("/api/iris/alerts", requireAuth, async (req, res) => {
		await wrap(res, () =>
			irisKfintechService.listAlerts(req.query.pan as string),
		);
	});
	app.delete("/api/iris/alerts/:alertId", requireAuth, async (req, res) => {
		await wrap(res, () => irisKfintechService.deleteAlert(req.params.alertId));
	});
	app.put("/api/iris/alerts/:alertId", requireAuth, async (req, res) => {
		await wrap(res, () =>
			irisKfintechService.updateAlert(req.params.alertId, req.body),
		);
	});

	// ─── Phase 3: Compliance / AML ───────────────────────────────────────────────
	app.get(
		"/api/iris/reports/compliance",
		requireAuth,
		requireAdmin,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getComplianceReport(
					req.query as Record<string, string>,
				),
			);
		},
	);
	app.get(
		"/api/iris/reports/pmla",
		requireAuth,
		requireAdmin,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getPmlaReport(req.query as Record<string, string>),
			);
		},
	);
	app.get(
		"/api/iris/reports/aml",
		requireAuth,
		requireAdmin,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getAmlReport(req.query as Record<string, string>),
			);
		},
	);

	// ─── Phase 3: WhatsApp Notifications ─────────────────────────────────────────
	app.post(
		"/api/iris/notifications/whatsapp",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.sendWhatsappNotification(req.body),
			);
		},
	);
	app.get(
		"/api/iris/notifications/templates",
		requireAuth,
		requireAgent,
		async (_req, res) => {
			await wrap(res, () => irisKfintechService.getNotificationTemplates());
		},
	);
	app.get(
		"/api/iris/notifications/history",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getNotificationHistory(req.query.pan as string),
			);
		},
	);

	/**
	 * POST /api/iris/notifications/whatsapp-rich
	 * Send a structured rich WhatsApp message to an investor.
	 *
	 * Body: {
	 *   pan: string,
	 *   mobile: string,
	 *   message: string,
	 *   templateId?: string,
	 *   agentName?: string,   // Appended as "— {agentName} via FintekPro"
	 *   mediaUrl?: string     // Attach image/document
	 * }
	 *
	 * FASP-AI: AI advisory messages MUST include risk disclaimer in body.
	 */
	app.post(
		"/api/iris/notifications/whatsapp-rich",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const { pan, mobile, message, templateId, agentName, mediaUrl } = req.body ?? {};
			if (!mobile || !message) {
				return res.status(400).json({
					success: false,
					error: { error_code: "MISSING_FIELDS", message: "mobile and message are required", retryable: false },
					meta: { timestamp: new Date().toISOString(), version: "iris-v1" },
				});
			}
			await wrap(res, () =>
				irisKfintechService.sendWhatsAppMessage({
					pan,
					mobile,
					message,
					templateId,
					agentName,
					extra: mediaUrl ? { mediaUrl } : undefined,
				}),
			);
		},
	);

	/**
	 * POST /api/iris/notifications/festival-greeting
	 * Send a festival/occasion greeting to an investor via WhatsApp.
	 *
	 * Body: {
	 *   pan: string,
	 *   mobile: string,
	 *   festivalName: string,    // e.g. "Diwali", "Holi", "Eid"
	 *   message?: string,        // Override default festival message
	 *   agentName: string,       // Greeting "from" name
	 *   templateId?: string
	 * }
	 *
	 * Used for: client retention campaigns, seasonal outreach.
	 */
	app.post(
		"/api/iris/notifications/festival-greeting",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const { pan, mobile, festivalName, message, agentName, templateId } = req.body ?? {};
			if (!mobile || !festivalName || !agentName) {
				return res.status(400).json({
					success: false,
					error: { error_code: "MISSING_FIELDS", message: "mobile, festivalName, and agentName are required", retryable: false },
					meta: { timestamp: new Date().toISOString(), version: "iris-v1" },
				});
			}
			await wrap(res, () =>
				irisKfintechService.sendFestivalGreeting({
					pan,
					mobile,
					festivalName,
					message: message ?? `Wishing you a very Happy ${festivalName}! 🎉`,
					agentName,
					templateId,
				}),
			);
		},
	);

	// ─── Phase 3: NFO ─────────────────────────────────────────────────────────────

	app.get("/api/iris/nfo/active", requireAuth, async (_req, res) => {
		await wrap(res, () => irisKfintechService.getNfoSchemes());
	});
	app.get("/api/iris/nfo/:schemeCode", requireAuth, async (req, res) => {
		await wrap(res, () =>
			irisKfintechService.getNfoSchemeDetails(req.params.schemeCode),
		);
	});
	app.post("/api/iris/nfo/apply", requireAuth, async (req, res) => {
		await wrap(res, () => irisKfintechService.applyNfo(req.body));
	});
	app.get("/api/iris/nfo/applications", requireAuth, async (req, res) => {
		await wrap(res, () =>
			irisKfintechService.getNfoApplications(req.query.pan as string),
		);
	});
	app.post(
		"/api/iris/nfo/applications/:applicationId/cancel",
		requireAuth,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.cancelNfoApplication(req.params.applicationId),
			);
		},
	);

	// ─── Analytics: Tax Harvesting ────────────────────────────────────────────────
	app.get(
		"/api/iris/portfolio/tax-harvest/:pan",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getTaxHarvestingOpportunities(req.params.pan),
			);
		},
	);

	// ─── Analytics: SIP XIRR ──────────────────────────────────────────────────────
	app.get(
		"/api/iris/analytics/sip-returns/:pan",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSipXirr(
					req.params.pan,
					req.query as Record<string, string>,
				),
			);
		},
	);

	// ─── Scheme Intelligence: Ratings ─────────────────────────────────────────────
	app.get(
		"/api/iris/schemes/:schemeCode/ratings",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSchemeRatings(req.params.schemeCode),
			);
		},
	);

	// ─── Scheme Intelligence: Fund Manager ────────────────────────────────────────
	app.get(
		"/api/iris/schemes/:schemeCode/fund-manager",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSchemeFundManager(req.params.schemeCode),
			);
		},
	);

	// ─── Scheme Intelligence: Benchmark Comparison ───────────────────────────────
	app.get(
		"/api/iris/schemes/:schemeCode/benchmark",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getSchemeBenchmarkComparison(
					req.params.schemeCode,
					req.query as Record<string, string>,
				),
			);
		},
	);

	// ─── External Portfolio / CAS Import ─────────────────────────────────────────
	// Fetch live CAS data by PAN directly from KFintech registry — no PDF upload required.
	app.get(
		"/api/iris/portfolio/cas-fetch/:pan",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.fetchCasFromRegistry(
					req.params.pan,
					req.query as Record<string, string>,
				),
			);
		},
	);

	// Import the fetched CAS data into IRIS portfolio tracking system.
	app.post(
		"/api/iris/portfolio/import",
		requireAuth,
		requireAgent,
		async (req, res) => {
			try {
				const data = await irisKfintechService.importExternalPortfolio(
					req.body,
				);
				const pan = req.body.pan || req.body.investor?.pan;
				if (pan) {
					await syncIrisHoldingsForPan(pan);
				}
				res.json({ success: true, data });
			} catch (err: any) {
				logger.error("[IRIS Import] Error: " + (err?.message ?? "unknown"));
				res
					.status(500)
					.json({ success: false, message: err?.message || "Import failed" });
			}
		},
	);

	// View all externally linked / imported holdings for a given PAN.
	app.get(
		"/api/iris/portfolio/external/:pan",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.getExternalPortfolio(req.params.pan),
			);
		},
	);

	// Link a single external folio (CAMS or KFintech) to the investor's IRIS profile.
	app.post(
		"/api/iris/portfolio/external/link",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () => irisKfintechService.linkExternalFolio(req.body));
		},
	);

	// Unlink / remove an external folio from IRIS tracking.
	app.delete(
		"/api/iris/portfolio/external/:folioNo",
		requireAuth,
		requireAgent,
		async (req, res) => {
			await wrap(res, () =>
				irisKfintechService.unlinkExternalFolio(req.params.folioNo),
			);
		},
	);

	// Trigger a live refresh of all external portfolio data for a PAN.
	app.post(
		"/api/iris/portfolio/external/:pan/refresh",
		requireAuth,
		requireAgent,
		async (req, res) => {
			try {
				const data = await irisKfintechService.refreshExternalPortfolio(
					req.params.pan,
				);
				// After fresh data is pushed to IRIS, bridge it to our local comprehensiveHoldings tracker
				const syncResult = await syncIrisHoldingsForPan(req.params.pan);
				res.json({ success: true, data, syncResult });
			} catch (err: any) {
				logger.error("[IRIS Refresh] Error: " + (err?.message ?? "unknown"));
				res
					.status(500)
					.json({ success: false, message: err?.message || "Refresh failed" });
			}
		},
	);

	// ─── Client Portfolio Rebalancing (FASP-AI-v3.0) ──────────────────────────────
	// AI generates proposal → advisor approves → IRIS executes legs.
	// Per FASP-AI advisory compliance rules: never autonomous execution.

	/**
	 * POST /api/iris/rebalance/generate
	 * Generates a drift-based rebalancing proposal for a client PAN vs a model portfolio.
	 * Returns proposal with trade legs, confidence score, and FASP-AI disclaimer.
	 * Does NOT execute any trades — proposal is pending_advisor_review.
	 */
	app.post(
		"/api/iris/rebalance/generate",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const { pan, modelPortfolioId } = req.body as { pan?: string; modelPortfolioId?: string };
				if (!pan)             return res.status(400).json({ success: false, message: "pan is required" });
				if (!modelPortfolioId) return res.status(400).json({ success: false, message: "modelPortfolioId is required" });

				const advisorId = (req as any).user?.id ?? "unknown";
				const { generateClientRebalanceProposal } = await import("../services/iris-rebalance-orchestrator");
				const proposal = await generateClientRebalanceProposal(pan, modelPortfolioId, advisorId);

				res.json({
					success: true,
					data: proposal,
					meta: { timestamp: new Date().toISOString(), version: "FASP-AI-v3.0", latency_ms: Date.now() - t0 },
				});
			} catch (err: any) {
				res.status(500).json({ success: false, message: err?.message ?? "Proposal generation failed", retryable: true });
			}
		},
	);

	/**
	 * POST /api/iris/rebalance/:proposalId/approve
	 * Advisor explicitly approves a pending_advisor_review proposal.
	 * Triggers sequential IRIS switch / redemption / purchase calls.
	 * Role-gated: admin | agent | advisor | ria only.
	 * FASP-AI: This is the ONLY path that executes IRIS trades.
	 */
	app.post(
		"/api/iris/rebalance/:proposalId/approve",
		requireAuth,
		requireAgent,
		requireTransactionCompliance("MF", "switch"),
		async (req, res) => {
			const t0 = Date.now();
			try {
				const advisorId   = (req as any).user?.id ?? "unknown";
				const advisorRole = (req as any).user?.roles?.[0] ?? "";
				const allowed     = ["admin", "agent", "advisor", "super_admin", "ria"];
				if (!allowed.includes(advisorRole)) {
					return res.status(403).json({ success: false, message: "Only SEBI-registered advisors may approve rebalancing proposals." });
				}

				const { executeApprovedProposal } = await import("../services/iris-rebalance-orchestrator");
				const result = await executeApprovedProposal(req.params.proposalId, advisorId);

				res.json({
					success: result.success,
					data: result,
					meta: { timestamp: new Date().toISOString(), version: "FASP-AI-v3.0", latency_ms: Date.now() - t0 },
				});
			} catch (err: any) {
				res.status(500).json({ success: false, message: err?.message ?? "Execution failed", retryable: false });
			}
		},
	);

	/**
	 * POST /api/iris/rebalance/:proposalId/reject
	 * Advisor rejects a proposal with an optional reason.
	 * Marks status = 'rejected', records reviewer + timestamp.
	 */
	app.post(
		"/api/iris/rebalance/:proposalId/reject",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const advisorId = (req as any).user?.id ?? "unknown";
				const reason    = (req.body?.reason as string | undefined) ?? "Rejected by advisor";
				const { db }    = await import("../db");
				const { rebalanceProposals } = await import("@shared/schema");
				const { eq }    = await import("drizzle-orm");

				await db.update(rebalanceProposals)
					.set({ status: "rejected", reviewedBy: advisorId, reviewedAt: new Date(),
						   rejectionReason: reason, updatedAt: new Date() })
					.where(eq(rebalanceProposals.id, req.params.proposalId));

				res.json({
					success: true,
					data: { proposalId: req.params.proposalId, status: "rejected", rejectedBy: advisorId, reason },
					meta: { timestamp: new Date().toISOString(), version: "FASP-AI-v3.0", latency_ms: Date.now() - t0 },
				});
			} catch (err: any) {
				res.status(500).json({ success: false, message: err?.message ?? "Rejection failed", retryable: false });
			}
		},
	);

	/**
	 * GET /api/iris/rebalance/:proposalId/status
	 * Returns proposal row + all per-leg iris_rebalance_executions rows.
	 * Includes IRIS order IDs, leg status (pending/submitted/failed), and timestamps.
	 */
	app.get(
		"/api/iris/rebalance/:proposalId/status",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const { getExecutionStatus } = await import("../services/iris-rebalance-orchestrator");
				const data = await getExecutionStatus(req.params.proposalId);
				if (!data.proposal) return res.status(404).json({ success: false, message: "Proposal not found" });
				res.json({
					success: true,
					data,
					meta: { timestamp: new Date().toISOString(), version: "FASP-AI-v3.0", latency_ms: Date.now() - t0 },
				});
			} catch (err: any) {
				res.status(500).json({ success: false, message: err?.message ?? "Status fetch failed", retryable: true });
			}
		},
	);

	// ─── IRIS Instrument Catalog (DB-backed, seeded by enrichment job Phase D) ──
	//
	// These routes READ from the seeded iris_* tables rather than live-proxying
	// to IRIS, making them fast (<5ms) and resilient to IRIS downtime.
	// Live-proxy equivalents remain at /api/iris/products/* for real-time data.

	/**
	 * GET /api/iris/catalog/fixed-deposits
	 * Returns all FD products from the seeded iris_fd_products table.
	 * Supports optional query filters: ?category=corporate&minRate=7&rating=AAA
	 */
	app.get(
		"/api/iris/catalog/fixed-deposits",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const { db } = await import("../db");
				const { irisFdProducts } = await import("@shared/schema");
				const { sql, and, gte, eq } = await import("drizzle-orm");

				const conditions: any[] = [];
				if (req.query.category) conditions.push(eq(irisFdProducts.category, req.query.category as string));
				if (req.query.rating)   conditions.push(eq(irisFdProducts.creditRating, req.query.rating as string));
				if (req.query.minRate)  conditions.push(gte(irisFdProducts.interestRate, req.query.minRate as string));

				const rows = await db
					.select()
					.from(irisFdProducts)
					.where(conditions.length > 0 ? and(...conditions) : undefined)
					.orderBy(sql`interest_rate DESC NULLS LAST`)
					.limit(200);

				res.json({
					success: true,
					data: rows,
					meta: {
						total: rows.length,
						source: "iris_fd_products",
						timestamp: new Date().toISOString(),
						version: "FASP-AI-v3.0",
						latency_ms: Date.now() - t0,
					},
				});
			} catch (err: any) {
				res.status(500).json({ success: false, error_code: "FD_CATALOG_FETCH_FAILED", message: err.message, retryable: true });
			}
		},
	);

	/**
	 * GET /api/iris/catalog/nps-funds
	 * Returns NPS pension fund manager options from iris_nps_funds.
	 * Optional: ?tier=I&tier=II
	 */
	app.get(
		"/api/iris/catalog/nps-funds",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const { db } = await import("../db");
				const { irisNpsFunds } = await import("@shared/schema");
				const { eq, sql } = await import("drizzle-orm");

				const conditions: any[] = [];
				if (req.query.tier) conditions.push(eq(irisNpsFunds.tier, req.query.tier as string));

				const { and } = await import("drizzle-orm");
				const rows = await db
					.select()
					.from(irisNpsFunds)
					.where(conditions.length > 0 ? and(...conditions) : undefined)
					.orderBy(sql`fund_manager_name ASC`);

				res.json({
					success: true,
					data: rows,
					meta: {
						total: rows.length,
						source: "iris_nps_funds",
						timestamp: new Date().toISOString(),
						version: "FASP-AI-v3.0",
						latency_ms: Date.now() - t0,
					},
				});
			} catch (err: any) {
				res.status(500).json({ success: false, error_code: "NPS_CATALOG_FETCH_FAILED", message: err.message, retryable: true });
			}
		},
	);

	/**
	 * GET /api/iris/catalog/pms
	 * Returns PMS strategies from iris_pms_aif_products where product_type='pms'.
	 */
	app.get(
		"/api/iris/catalog/pms",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const { db } = await import("../db");
				const { irisPmsAifProducts } = await import("@shared/schema");
				const { eq, sql } = await import("drizzle-orm");

				const rows = await db
					.select()
					.from(irisPmsAifProducts)
					.where(eq(irisPmsAifProducts.productType, "pms"))
					.orderBy(sql`return_3y DESC NULLS LAST`)
					.limit(200);

				res.json({
					success: true,
					data: rows,
					meta: {
						total: rows.length,
						source: "iris_pms_aif_products",
						timestamp: new Date().toISOString(),
						version: "FASP-AI-v3.0",
						latency_ms: Date.now() - t0,
					},
				});
			} catch (err: any) {
				res.status(500).json({ success: false, error_code: "PMS_CATALOG_FETCH_FAILED", message: err.message, retryable: true });
			}
		},
	);

	/**
	 * GET /api/iris/catalog/aif
	 * Returns AIF products from iris_pms_aif_products where product_type='aif'.
	 */
	app.get(
		"/api/iris/catalog/aif",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const { db } = await import("../db");
				const { irisPmsAifProducts } = await import("@shared/schema");
				const { eq, sql } = await import("drizzle-orm");

				const rows = await db
					.select()
					.from(irisPmsAifProducts)
					.where(eq(irisPmsAifProducts.productType, "aif"))
					.orderBy(sql`return_3y DESC NULLS LAST`)
					.limit(200);

				res.json({
					success: true,
					data: rows,
					meta: {
						total: rows.length,
						source: "iris_pms_aif_products",
						timestamp: new Date().toISOString(),
						version: "FASP-AI-v3.0",
						latency_ms: Date.now() - t0,
					},
				});
			} catch (err: any) {
				res.status(500).json({ success: false, error_code: "AIF_CATALOG_FETCH_FAILED", message: err.message, retryable: true });
			}
		},
	);

	/**
	 * GET /api/iris/catalog/status
	 * Returns row counts and last-seeded timestamps for all catalog tables.
	 * Useful for health-checking the seeding pipeline.
	 */
	app.get(
		"/api/iris/catalog/status",
		requireAuth,
		requireAdmin,
		async (_req, res) => {
			const t0 = Date.now();
			try {
				const { db } = await import("../db");
				const { irisFdProducts, irisNpsFunds, irisPmsAifProducts } = await import("@shared/schema");
				const { sql } = await import("drizzle-orm");

				const [fdStat]  = await db.select({ count: sql<number>`count(*)`, lastSeeded: sql<string>`max(seeded_at)` }).from(irisFdProducts);
				const [npsStat] = await db.select({ count: sql<number>`count(*)`, lastSeeded: sql<string>`max(seeded_at)` }).from(irisNpsFunds);
				const [pmsStat] = await db.select({ count: sql<number>`count(*) filter (where product_type='pms')`, lastSeeded: sql<string>`max(seeded_at)` }).from(irisPmsAifProducts);
				const [aifStat] = await db.select({ count: sql<number>`count(*) filter (where product_type='aif')`, lastSeeded: sql<string>`max(seeded_at)` }).from(irisPmsAifProducts);

				res.json({
					success: true,
					data: {
						fixedDeposits: { count: Number(fdStat?.count ?? 0), lastSeeded: fdStat?.lastSeeded ?? null },
						npsFunds:      { count: Number(npsStat?.count ?? 0), lastSeeded: npsStat?.lastSeeded ?? null },
						pmsProducts:   { count: Number(pmsStat?.count ?? 0), lastSeeded: pmsStat?.lastSeeded ?? null },
						aifProducts:   { count: Number(aifStat?.count ?? 0), lastSeeded: aifStat?.lastSeeded ?? null },
					},
					meta: { timestamp: new Date().toISOString(), version: "FASP-AI-v3.0", latency_ms: Date.now() - t0 },
				});
			} catch (err: any) {
				res.status(500).json({ success: false, error_code: "CATALOG_STATUS_FAILED", message: err.message, retryable: true });
			}
		},
	);

	/**
	 * POST /api/iris/catalog/seed
	 * Admin-only: triggers all 5 IRIS seeding jobs on-demand (outside the cron).
	 * Runs non-blocking — returns immediately with a job ID for status tracking.
	 *
	 * Body: { jobs?: ('fd'|'nps'|'pmsAif'|'mfHoldings'|'mfFactsheet')[] }
	 *       Omit `jobs` to run all.
	 */
	app.post(
		"/api/iris/catalog/seed",
		requireAuth,
		requireAdmin,
		async (req, res) => {
			const t0 = Date.now();
			const requestedJobs: string[] = req.body?.jobs ?? ["fd", "nps", "pmsAif", "mfHoldings", "mfFactsheet"];
			const jobId = `iris-seed-${Date.now()}`;

			// Respond immediately — seeding runs in background
			res.json({
				success: true,
				data: { jobId, requestedJobs, status: "started" },
				meta: { timestamp: new Date().toISOString(), version: "FASP-AI-v3.0", latency_ms: Date.now() - t0 },
			});

			// Fire-and-forget seeding
			(async () => {
				try {
					const svc = await import("../services/iris-instrument-seeding-service");
					const results: Record<string, any> = {};

					if (requestedJobs.includes("fd"))          results.fd          = await svc.seedFdProducts();
					if (requestedJobs.includes("nps"))         results.nps         = await svc.seedNpsFunds();
					if (requestedJobs.includes("pmsAif"))      results.pmsAif      = await svc.seedPmsAifProducts();
					if (requestedJobs.includes("mfHoldings"))  results.mfHoldings  = await svc.enrichMfHoldings(200);
					if (requestedJobs.includes("mfFactsheet")) results.mfFactsheet = await svc.enrichMfFactsheets(200);

					logger.info(`[IRIS Catalog Seed] ${jobId} complete`);
				} catch (err: any) {
					logger.error(`[IRIS Catalog Seed] ${jobId} failed: ${err.message}`);
				}
			})();
		},
	);

	// ─── IRIS Catalog Transaction Routes ─────────────────────────────────────────
	//
	// Unified transaction surface: each route validates the instrument exists in
	// the seeded catalog DB BEFORE forwarding to IRIS. This ensures:
	//  1. We never transact on a stale/unknown product ID
	//  2. All writes are idempotent (idempotency key required in body)
	//  3. Every transaction log includes catalog_source and engine_version
	//  4. FASP-AI v1.0: AI is Decision Support only — these routes require
	//     explicit advisor confirmation (requireTransactionCompliance gate)
	//
	// Pattern: GET /api/iris/catalog/:type/:productId  → browse (DB-backed)
	//          POST /api/iris/catalog/:type/:productId/invest → transact (IRIS live)

	/**
	 * GET /api/iris/catalog/fixed-deposits/:productId
	 * Single FD product detail from catalog.
	 */
	app.get(
		"/api/iris/catalog/fixed-deposits/:productId",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const { db } = await import("../db");
				const { irisFdProducts } = await import("@shared/schema");
				const { eq } = await import("drizzle-orm");

				const [product] = await db
					.select()
					.from(irisFdProducts)
					.where(eq(irisFdProducts.irisProductId, req.params.productId))
					.limit(1);

				if (!product) return res.status(404).json({ success: false, error_code: "FD_NOT_FOUND", message: "FD product not found in catalog", retryable: false });

				res.json({
					success: true,
					data: product,
					meta: { source: "iris_fd_products", timestamp: new Date().toISOString(), version: "FASP-AI-v3.0", latency_ms: Date.now() - t0 },
				});
			} catch (err: any) {
				res.status(500).json({ success: false, error_code: "FD_DETAIL_FAILED", message: err.message, retryable: true });
			}
		},
	);

	/**
	 * POST /api/iris/catalog/fixed-deposits/:productId/invest
	 * Place an FD order — validates product exists in catalog first.
	 * Required body: { pan, amount, tenureMonths, paymentMode, idempotencyKey }
	 *
	 * FASP-AI: requireTransactionCompliance gate enforces advisor approval.
	 */
	app.post(
		"/api/iris/catalog/fixed-deposits/:productId/invest",
		requireAuth,
		requireAgent,
		requireTransactionCompliance,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const { db } = await import("../db");
				const { irisFdProducts } = await import("@shared/schema");
				const { eq } = await import("drizzle-orm");

				// 1. Validate product exists in catalog
				const [product] = await db
					.select()
					.from(irisFdProducts)
					.where(eq(irisFdProducts.irisProductId, req.params.productId))
					.limit(1);

				if (!product) return res.status(404).json({
					success: false,
					error_code: "FD_NOT_IN_CATALOG",
					message: "FD product not found. Trigger a catalog seed first.",
					retryable: false,
				});

				// 2. Validate required fields
				const { pan, amount, tenureMonths, paymentMode, idempotencyKey } = req.body ?? {};
				if (!pan || !amount || !tenureMonths || !paymentMode || !idempotencyKey) {
					return res.status(400).json({
						success: false,
						error_code: "MISSING_REQUIRED_FIELDS",
						message: "Required: pan, amount, tenureMonths, paymentMode, idempotencyKey",
						retryable: false,
					});
				}

				// 3. Place order via IRIS with catalog metadata for auditability
				const orderPayload = {
					...req.body,
					productId:     req.params.productId,
					issuerName:    product.issuerName,
					interestRate:  product.interestRate,
					catalogSource: "iris_fd_products",
					engineVersion: "FASP-AI-v3.0",
				};

				const result = await irisKfintechService.placeFdOrder(orderPayload);

				res.json({
					success: true,
					data: result,
					meta: {
						product: { id: product.irisProductId, name: product.productName, issuer: product.issuerName, rate: product.interestRate },
						catalog_source: "iris_fd_products",
						timestamp: new Date().toISOString(),
						version: "FASP-AI-v3.0",
						latency_ms: Date.now() - t0,
					},
				});
			} catch (err: any) {
				res.status(500).json({ success: false, error_code: "FD_ORDER_FAILED", message: err.message, retryable: true });
			}
		},
	);

	/**
	 * GET /api/iris/catalog/fixed-deposits/:productId/orders
	 * List all FD orders for a PAN on this product.
	 */
	app.get(
		"/api/iris/catalog/fixed-deposits/:productId/orders",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const pan = req.query.pan as string;
				if (!pan) return res.status(400).json({ success: false, error_code: "PAN_REQUIRED", message: "?pan= is required", retryable: false });
				const data = await irisKfintechService.getFdOrders(pan);
				res.json({ success: true, data, meta: { timestamp: new Date().toISOString(), version: "FASP-AI-v3.0", latency_ms: Date.now() - t0 } });
			} catch (err: any) {
				res.status(500).json({ success: false, error_code: "FD_ORDERS_FAILED", message: err.message, retryable: true });
			}
		},
	);

	/**
	 * GET /api/iris/catalog/nps-funds/:fundCode
	 * Single NPS fund detail from catalog.
	 */
	app.get(
		"/api/iris/catalog/nps-funds/:fundCode",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const { db } = await import("../db");
				const { irisNpsFunds } = await import("@shared/schema");
				const { eq } = await import("drizzle-orm");

				const [fund] = await db
					.select()
					.from(irisNpsFunds)
					.where(eq(irisNpsFunds.irisFundCode, req.params.fundCode))
					.limit(1);

				if (!fund) return res.status(404).json({ success: false, error_code: "NPS_FUND_NOT_FOUND", message: "NPS fund not found in catalog", retryable: false });

				res.json({
					success: true,
					data: fund,
					meta: { source: "iris_nps_funds", timestamp: new Date().toISOString(), version: "FASP-AI-v3.0", latency_ms: Date.now() - t0 },
				});
			} catch (err: any) {
				res.status(500).json({ success: false, error_code: "NPS_FUND_DETAIL_FAILED", message: err.message, retryable: true });
			}
		},
	);

	/**
	 * POST /api/iris/catalog/nps-funds/:fundCode/contribute
	 * Place an NPS contribution — validates fund exists in catalog first.
	 * Required body: { pran, amount, tier, paymentMode, idempotencyKey }
	 *
	 * FASP-AI: requireTransactionCompliance gate enforces advisor approval.
	 */
	app.post(
		"/api/iris/catalog/nps-funds/:fundCode/contribute",
		requireAuth,
		requireAgent,
		requireTransactionCompliance,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const { db } = await import("../db");
				const { irisNpsFunds } = await import("@shared/schema");
				const { eq } = await import("drizzle-orm");

				// 1. Validate fund in catalog
				const [fund] = await db
					.select()
					.from(irisNpsFunds)
					.where(eq(irisNpsFunds.irisFundCode, req.params.fundCode))
					.limit(1);

				if (!fund) return res.status(404).json({
					success: false,
					error_code: "NPS_FUND_NOT_IN_CATALOG",
					message: "NPS fund not found in catalog. Run a catalog seed first.",
					retryable: false,
				});

				const { pran, amount, tier, paymentMode, idempotencyKey } = req.body ?? {};
				if (!pran || !amount || !tier || !paymentMode || !idempotencyKey) {
					return res.status(400).json({
						success: false,
						error_code: "MISSING_REQUIRED_FIELDS",
						message: "Required: pran, amount, tier, paymentMode, idempotencyKey",
						retryable: false,
					});
				}

				const result = await irisKfintechService.placeNpsContribution({
					...req.body,
					fundCode:      req.params.fundCode,
					pfmCode:       fund.pfmCode,
					fundManager:   fund.fundManagerName,
					catalogSource: "iris_nps_funds",
					engineVersion: "FASP-AI-v3.0",
				});

				res.json({
					success: true,
					data: result,
					meta: {
						fund: { code: fund.irisFundCode, manager: fund.fundManagerName, tier: fund.tier },
						catalog_source: "iris_nps_funds",
						timestamp: new Date().toISOString(),
						version: "FASP-AI-v3.0",
						latency_ms: Date.now() - t0,
					},
				});
			} catch (err: any) {
				res.status(500).json({ success: false, error_code: "NPS_CONTRIBUTION_FAILED", message: err.message, retryable: true });
			}
		},
	);

	/**
	 * GET /api/iris/catalog/pms/:productId
	 * Single PMS strategy detail from catalog.
	 */
	app.get(
		"/api/iris/catalog/pms/:productId",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const { db } = await import("../db");
				const { irisPmsAifProducts } = await import("@shared/schema");
				const { eq, and } = await import("drizzle-orm");

				const [product] = await db
					.select()
					.from(irisPmsAifProducts)
					.where(and(eq(irisPmsAifProducts.irisProductId, req.params.productId), eq(irisPmsAifProducts.productType, "pms")))
					.limit(1);

				if (!product) return res.status(404).json({ success: false, error_code: "PMS_NOT_FOUND", message: "PMS product not found in catalog", retryable: false });

				res.json({ success: true, data: product, meta: { source: "iris_pms_aif_products", timestamp: new Date().toISOString(), version: "FASP-AI-v3.0", latency_ms: Date.now() - t0 } });
			} catch (err: any) {
				res.status(500).json({ success: false, error_code: "PMS_DETAIL_FAILED", message: err.message, retryable: true });
			}
		},
	);

	/**
	 * POST /api/iris/catalog/pms/:productId/onboard
	 * Initiate PMS onboarding — validates strategy exists in catalog first.
	 * Required body: { pan, amount, strategyCode, paymentMode, idempotencyKey }
	 *
	 * FASP-AI: requireTransactionCompliance + advisor approval mandatory.
	 */
	app.post(
		"/api/iris/catalog/pms/:productId/onboard",
		requireAuth,
		requireAgent,
		requireTransactionCompliance,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const { db } = await import("../db");
				const { irisPmsAifProducts } = await import("@shared/schema");
				const { eq, and } = await import("drizzle-orm");

				const [product] = await db
					.select()
					.from(irisPmsAifProducts)
					.where(and(eq(irisPmsAifProducts.irisProductId, req.params.productId), eq(irisPmsAifProducts.productType, "pms")))
					.limit(1);

				if (!product) return res.status(404).json({ success: false, error_code: "PMS_NOT_IN_CATALOG", message: "PMS product not found. Trigger a catalog seed first.", retryable: false });

				const { pan, amount, paymentMode, idempotencyKey } = req.body ?? {};
				if (!pan || !amount || !paymentMode || !idempotencyKey) {
					return res.status(400).json({ success: false, error_code: "MISSING_REQUIRED_FIELDS", message: "Required: pan, amount, paymentMode, idempotencyKey", retryable: false });
				}

				const result = await irisKfintechService.getPmsLinks(); // initiation via links flow
				res.json({
					success: true,
					data: result,
					meta: {
						product: { id: product.irisProductId, name: product.strategyName, house: product.fundHouse, minInvestment: product.minInvestment },
						catalog_source: "iris_pms_aif_products",
						disclaimer: "PMS investments carry high risk. Past performance is not indicative of future results. SEBI registration mandatory.",
						timestamp: new Date().toISOString(),
						version: "FASP-AI-v3.0",
						latency_ms: Date.now() - t0,
					},
				});
			} catch (err: any) {
				res.status(500).json({ success: false, error_code: "PMS_ONBOARD_FAILED", message: err.message, retryable: true });
			}
		},
	);

	/**
	 * GET /api/iris/catalog/aif/:productId
	 * Single AIF product detail from catalog.
	 */
	app.get(
		"/api/iris/catalog/aif/:productId",
		requireAuth,
		requireAgent,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const { db } = await import("../db");
				const { irisPmsAifProducts } = await import("@shared/schema");
				const { eq, and } = await import("drizzle-orm");

				const [product] = await db
					.select()
					.from(irisPmsAifProducts)
					.where(and(eq(irisPmsAifProducts.irisProductId, req.params.productId), eq(irisPmsAifProducts.productType, "aif")))
					.limit(1);

				if (!product) return res.status(404).json({ success: false, error_code: "AIF_NOT_FOUND", message: "AIF product not found in catalog", retryable: false });

				res.json({ success: true, data: product, meta: { source: "iris_pms_aif_products", timestamp: new Date().toISOString(), version: "FASP-AI-v3.0", latency_ms: Date.now() - t0 } });
			} catch (err: any) {
				res.status(500).json({ success: false, error_code: "AIF_DETAIL_FAILED", message: err.message, retryable: true });
			}
		},
	);

	/**
	 * POST /api/iris/catalog/aif/:productId/subscribe
	 * Subscribe to an AIF — validates product exists in catalog first.
	 * Required body: { pan, commitmentAmount, paymentMode, idempotencyKey }
	 *
	 * FASP-AI: requireTransactionCompliance + advisor approval mandatory.
	 * Minimum investment is typically ₹1 Cr — validated against catalog.
	 */
	app.post(
		"/api/iris/catalog/aif/:productId/subscribe",
		requireAuth,
		requireAgent,
		requireTransactionCompliance,
		async (req, res) => {
			const t0 = Date.now();
			try {
				const { db } = await import("../db");
				const { irisPmsAifProducts } = await import("@shared/schema");
				const { eq, and } = await import("drizzle-orm");

				const [product] = await db
					.select()
					.from(irisPmsAifProducts)
					.where(and(eq(irisPmsAifProducts.irisProductId, req.params.productId), eq(irisPmsAifProducts.productType, "aif")))
					.limit(1);

				if (!product) return res.status(404).json({ success: false, error_code: "AIF_NOT_IN_CATALOG", message: "AIF product not found. Trigger a catalog seed first.", retryable: false });

				const { pan, commitmentAmount, paymentMode, idempotencyKey } = req.body ?? {};
				if (!pan || !commitmentAmount || !paymentMode || !idempotencyKey) {
					return res.status(400).json({ success: false, error_code: "MISSING_REQUIRED_FIELDS", message: "Required: pan, commitmentAmount, paymentMode, idempotencyKey", retryable: false });
				}

				// Guard: minimum investment check against catalog
				const minInvest = parseFloat(String(product.minInvestment ?? "0"));
				if (minInvest > 0 && parseFloat(String(commitmentAmount)) < minInvest) {
					return res.status(400).json({
						success: false,
						error_code: "BELOW_MIN_INVESTMENT",
						message: `Minimum investment for this AIF is ₹${minInvest.toLocaleString("en-IN")}`,
						retryable: false,
					});
				}

				const result = await irisKfintechService.getAifLinks(); // initiation via links flow
				res.json({
					success: true,
					data: result,
					meta: {
						product: { id: product.irisProductId, name: product.strategyName, house: product.fundHouse, category: product.sebiCategory, minInvestment: product.minInvestment },
						catalog_source: "iris_pms_aif_products",
						disclaimer: "AIF investments are for accredited investors only. High risk. Not suitable for retail investors. SEBI Category I/II/III regulations apply.",
						timestamp: new Date().toISOString(),
						version: "FASP-AI-v3.0",
						latency_ms: Date.now() - t0,
					},
				});
			} catch (err: any) {
				res.status(500).json({ success: false, error_code: "AIF_SUBSCRIBE_FAILED", message: err.message, retryable: true });
			}
		},
	);

	logger.info("IRIS KFintech routes registered");
}
