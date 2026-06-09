// @ts-nocheck
/**
 * M2P Fintech — Credit Card Distribution API Routes
 *
 * Mount prefix: registered directly on app (no sub-mount)
 *
 * Public (no auth):
 *   GET  /api/cards/products          — Browse credit card catalog
 *   GET  /api/m2p/status              — Service health + config check
 *
 * Authenticated (requireAuth):
 *   POST /api/cards/eligibility        — Pre-qualify for a card (soft pull)
 *   POST /api/cards/apply              — Submit card application
 *   GET  /api/cards/applications/:id   — Application status
 *   GET  /api/cards/my-cards           — Cards linked to the current user
 *   GET  /api/cards/:cardId            — Card details
 *   POST /api/cards/:cardId/activate   — Activate card
 *   POST /api/cards/:cardId/block      — Block card
 *   POST /api/cards/:cardId/unblock    — Unblock card
 *   POST /api/cards/:cardId/replace    — Request card replacement
 *   PUT  /api/cards/:cardId/limit      — Update credit limit (admin)
 *   GET  /api/cards/:cardId/transactions — Transaction history
 *   POST /api/cards/:cardId/transactions/:txId/dispute — Raise dispute
 *   GET  /api/cards/:cardId/statements         — Statement list
 *   POST /api/cards/:cardId/statements/generate — Generate statement
 *   GET  /api/cards/:cardId/statements/:sid    — Fetch statement
 *
 * Webhook (no auth, signature-verified):
 *   POST /api/webhooks/m2p             — M2P event callbacks
 */

import { Express, Request, Response } from "express";
import {
	m2pCardService,
	CREDIT_CARD_CATALOG,
} from "../services/m2p-card-service";

function requireAuth(req: Request, res: Response, next: Function) {
	if (!(req as any).user && !(req as any).isAuthenticated?.()) {
		return res
			.status(401)
			.json({ success: false, message: "Authentication required" });
	}
	next();
}

export function registerM2PCardRoutes(app: Express): void {
	// ══════════════════════════════════════════════════════════════════════════
	// SERVICE STATUS
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * GET /api/m2p/status
	 * Returns configuration status and endpoint inventory.
	 */
	app.get("/api/m2p/status", (_req: Request, res: Response) => {
		res.json({
			provider: "M2P Fintech",
			website: "https://m2pfintech.com",
			docs: "https://docs.m2pfintech.com",
			configured: m2pCardService.isConfigured(),
			mode: process.env.M2P_PUBLIC_KEY ? "production-pki" : "sandbox",
			catalogSize: CREDIT_CARD_CATALOG.length,
			endpoints: {
				catalog: "GET  /api/cards/products",
				eligibility: "POST /api/cards/eligibility",
				apply: "POST /api/cards/apply",
				applicationStatus: "GET /api/cards/applications/:id",
				myCards: "GET  /api/cards/my-cards",
				cardDetail: "GET  /api/cards/:cardId",
				activate: "POST /api/cards/:cardId/activate",
				block: "POST /api/cards/:cardId/block",
				unblock: "POST /api/cards/:cardId/unblock",
				replace: "POST /api/cards/:cardId/replace",
				updateLimit: "PUT  /api/cards/:cardId/limit",
				transactions: "GET  /api/cards/:cardId/transactions",
				dispute: "POST /api/cards/:cardId/transactions/:txId/dispute",
				statements: "GET  /api/cards/:cardId/statements",
				genStatement: "POST /api/cards/:cardId/statements/generate",
				getStatement: "GET  /api/cards/:cardId/statements/:sid",
				webhook: "POST /api/webhooks/m2p",
			},
			onboarding: {
				step1:
					"Contact M2P: business@m2pfintech.com or https://m2pfintech.com/connect",
				step2: "Sign NDA + Partnership Agreement",
				step3:
					"Receive sandbox credentials (M2P_BASE_URL, M2P_API_KEY, M2P_SECRET_KEY, M2P_PROGRAM_ID)",
				step4: "Set env vars and test in sandbox (no PKI needed for sandbox)",
				step5:
					"Receive production PKI keys (M2P_PUBLIC_KEY, M2P_PRIVATE_KEY) + IP whitelist",
				step6: "Set M2P_WEBHOOK_SECRET for inbound event verification",
			},
		});
	});

	// ══════════════════════════════════════════════════════════════════════════
	// CREDIT CARD CATALOG (public)
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * GET /api/cards/products
	 * Returns all available credit card products.
	 * When M2P is configured, fetches live catalog; otherwise returns local catalog.
	 * Query params: network (visa/mastercard/rupay), category, maxAnnualFee, minIncome
	 */
	app.get("/api/cards/products", async (req: Request, res: Response) => {
		try {
			let products = CREDIT_CARD_CATALOG;

			// Apply filters from query params
			const { network, maxAnnualFee, minIncome, search } = req.query;
			if (network) {
				products = products.filter((p) => p.network === network);
			}
			if (maxAnnualFee !== undefined) {
				products = products.filter((p) => p.annualFee <= Number(maxAnnualFee));
			}
			if (minIncome !== undefined) {
				products = products.filter(
					(p) => p.eligibility.minIncome <= Number(minIncome),
				);
			}
			if (search) {
				const q = String(search).toLowerCase();
				products = products.filter(
					(p) =>
						p.name.toLowerCase().includes(q) ||
						p.issuerBank.toLowerCase().includes(q) ||
						p.cardType.toLowerCase().includes(q) ||
						p.rewardRate.toLowerCase().includes(q) ||
						p.features.some((f) => f.toLowerCase().includes(q)),
				);
			}

			res.json({
				success: true,
				configured: m2pCardService.isConfigured(),
				total: products.length,
				products,
			});
		} catch (error) {
			console.error("[M2P Cards] Get products error:", error);
			res
				.status(500)
				.json({
					success: false,
					message:
						error instanceof Error
							? error.message
							: "Failed to fetch card products",
				});
		}
	});

	// ══════════════════════════════════════════════════════════════════════════
	// ELIGIBILITY CHECK
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * POST /api/cards/eligibility
	 * Pre-qualify a user for a credit card (soft pull, no CIBIL impact).
	 * Body: { pan, mobile, annualIncome, employmentType, creditScore? }
	 * Returns: { eligible, preApprovedLimit, recommendedCards, referenceId }
	 *
	 * Works without M2P credentials — uses local catalog + income/score filter.
	 * When M2P is configured, calls M2P's eligibility engine.
	 */
	app.post(
		"/api/cards/eligibility",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				const { pan, mobile, annualIncome, employmentType, creditScore } =
					req.body;

				if (!pan || !mobile || !annualIncome || !employmentType) {
					return res.status(400).json({
						success: false,
						message:
							"pan, mobile, annualIncome and employmentType are required",
					});
				}
				if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
					return res
						.status(400)
						.json({ success: false, message: "Invalid PAN format" });
				}
				if (
					!["salaried", "self_employed", "business"].includes(employmentType)
				) {
					return res.status(400).json({
						success: false,
						message:
							"employmentType must be salaried, self_employed, or business",
					});
				}

				const result = await m2pCardService.checkEligibility({
					pan,
					mobile,
					annualIncome: Number(annualIncome),
					employmentType,
					...(creditScore && { creditScore: Number(creditScore) }),
				});

				return res.json({ success: true, ...result });
			} catch (error) {
				console.error("[M2P Cards] Eligibility check error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Eligibility check failed",
					});
			}
		},
	);

	// ══════════════════════════════════════════════════════════════════════════
	// CARD APPLICATION
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * POST /api/cards/apply
	 * Submit a credit card application.
	 * Body: { programId, customer: { name, mobile, email, pan, dob, gender, annualIncome, employmentType, address }, referenceId? }
	 * Returns: { applicationId, status, estimatedDispatch }
	 */
	app.post(
		"/api/cards/apply",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				if (!m2pCardService.isConfigured()) {
					return res.status(503).json({
						success: false,
						message:
							"M2P API not configured. Contact business@m2pfintech.com to onboard and set M2P_BASE_URL, M2P_API_KEY, M2P_SECRET_KEY, M2P_PROGRAM_ID.",
					});
				}

				const { programId, customer, referenceId } = req.body;
				if (!programId || !customer) {
					return res
						.status(400)
						.json({
							success: false,
							message: "programId and customer are required",
						});
				}

				const required = [
					"name",
					"mobile",
					"email",
					"pan",
					"dob",
					"gender",
					"annualIncome",
					"employmentType",
					"address",
				];
				const missing = required.filter((f) => !customer[f]);
				if (missing.length > 0) {
					return res
						.status(400)
						.json({
							success: false,
							message: `Missing customer fields: ${missing.join(", ")}`,
						});
				}

				const result = await m2pCardService.applyForCard({
					programId,
					customer,
					referenceId,
				});
				return res.json({ success: true, application: result });
			} catch (error) {
				console.error("[M2P Cards] Apply error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Card application failed",
					});
			}
		},
	);

	/**
	 * GET /api/cards/applications/:id
	 * Get credit card application status.
	 */
	app.get(
		"/api/cards/applications/:id",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				if (!m2pCardService.isConfigured()) {
					return res
						.status(503)
						.json({ success: false, message: "M2P API not configured" });
				}
				const result = await m2pCardService.getApplicationStatus(req.params.id);
				return res.json({ success: true, application: result });
			} catch (error) {
				console.error("[M2P Cards] Application status error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to get application status",
					});
			}
		},
	);

	// ══════════════════════════════════════════════════════════════════════════
	// CARD MANAGEMENT
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * GET /api/cards/my-cards
	 * List all cards for the logged-in user (by M2P customerId).
	 * Requires M2P_CUSTOMER_ID to be stored post-application.
	 */
	app.get(
		"/api/cards/my-cards",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				if (!m2pCardService.isConfigured()) {
					return res
						.status(503)
						.json({
							success: false,
							message: "M2P API not configured",
							cards: [],
						});
				}
				const customerId = req.query.customerId as string;
				if (!customerId) {
					return res
						.status(400)
						.json({
							success: false,
							message: "customerId query param required",
						});
				}
				const cards = await m2pCardService.listCards(customerId);
				return res.json({ success: true, cards });
			} catch (error) {
				console.error("[M2P Cards] List cards error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error ? error.message : "Failed to list cards",
					});
			}
		},
	);

	/**
	 * GET /api/cards/:cardId
	 * Get card details.
	 */
	app.get(
		"/api/cards/:cardId",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				if (!m2pCardService.isConfigured()) {
					return res
						.status(503)
						.json({ success: false, message: "M2P API not configured" });
				}
				const card = await m2pCardService.getCard(req.params.cardId);
				return res.json({ success: true, card });
			} catch (error) {
				console.error("[M2P Cards] Get card error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error ? error.message : "Failed to get card",
					});
			}
		},
	);

	/**
	 * POST /api/cards/:cardId/activate
	 * Activate a newly issued physical credit card.
	 */
	app.post(
		"/api/cards/:cardId/activate",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				if (!m2pCardService.isConfigured()) {
					return res
						.status(503)
						.json({ success: false, message: "M2P API not configured" });
				}
				const result = await m2pCardService.activateCard(req.params.cardId);
				return res.json({ success: true, ...result });
			} catch (error) {
				console.error("[M2P Cards] Activate card error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to activate card",
					});
			}
		},
	);

	/**
	 * POST /api/cards/:cardId/block
	 * Block a credit card (lost, stolen, suspicious activity).
	 * Body: { reason }
	 */
	app.post(
		"/api/cards/:cardId/block",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				if (!m2pCardService.isConfigured()) {
					return res
						.status(503)
						.json({ success: false, message: "M2P API not configured" });
				}
				const { reason } = req.body;
				if (!reason)
					return res
						.status(400)
						.json({ success: false, message: "reason is required" });
				const result = await m2pCardService.blockCard(
					req.params.cardId,
					reason,
				);
				return res.json({ success: true, ...result });
			} catch (error) {
				console.error("[M2P Cards] Block card error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error ? error.message : "Failed to block card",
					});
			}
		},
	);

	/**
	 * POST /api/cards/:cardId/unblock
	 * Unblock a previously blocked card.
	 */
	app.post(
		"/api/cards/:cardId/unblock",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				if (!m2pCardService.isConfigured()) {
					return res
						.status(503)
						.json({ success: false, message: "M2P API not configured" });
				}
				const result = await m2pCardService.unblockCard(req.params.cardId);
				return res.json({ success: true, ...result });
			} catch (error) {
				console.error("[M2P Cards] Unblock card error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error ? error.message : "Failed to unblock card",
					});
			}
		},
	);

	/**
	 * POST /api/cards/:cardId/replace
	 * Request a replacement card.
	 * Body: { reason: 'lost' | 'damaged' | 'expired' }
	 */
	app.post(
		"/api/cards/:cardId/replace",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				if (!m2pCardService.isConfigured()) {
					return res
						.status(503)
						.json({ success: false, message: "M2P API not configured" });
				}
				const { reason } = req.body;
				if (!["lost", "damaged", "expired"].includes(reason)) {
					return res
						.status(400)
						.json({
							success: false,
							message: "reason must be lost, damaged, or expired",
						});
				}
				const result = await m2pCardService.replaceCard(
					req.params.cardId,
					reason,
				);
				return res.json({ success: true, ...result });
			} catch (error) {
				console.error("[M2P Cards] Replace card error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to request card replacement",
					});
			}
		},
	);

	/**
	 * PUT /api/cards/:cardId/limit
	 * Update credit limit for a card. Admin/agent action.
	 * Body: { limit, reason? }
	 */
	app.put(
		"/api/cards/:cardId/limit",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				if (!m2pCardService.isConfigured()) {
					return res
						.status(503)
						.json({ success: false, message: "M2P API not configured" });
				}
				const { limit, reason } = req.body;
				if (!limit || Number.isNaN(Number(limit))) {
					return res
						.status(400)
						.json({ success: false, message: "limit (number) is required" });
				}
				const result = await m2pCardService.updateCreditLimit(
					req.params.cardId,
					Number(limit),
					reason,
				);
				return res.json({ success: true, ...result });
			} catch (error) {
				console.error("[M2P Cards] Update limit error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to update credit limit",
					});
			}
		},
	);

	// ══════════════════════════════════════════════════════════════════════════
	// TRANSACTIONS
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * GET /api/cards/:cardId/transactions
	 * List transactions with optional filters.
	 * Query params: from (YYYY-MM-DD), to, type, limit, offset
	 */
	app.get(
		"/api/cards/:cardId/transactions",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				if (!m2pCardService.isConfigured()) {
					return res
						.status(503)
						.json({
							success: false,
							message: "M2P API not configured",
							transactions: [],
						});
				}
				const { from, to, type, limit, offset } = req.query;
				const result = await m2pCardService.listTransactions(
					req.params.cardId,
					{
						...(from && { from: String(from) }),
						...(to && { to: String(to) }),
						...(type && { type: type as any }),
						...(limit && { limit: Number(limit) }),
						...(offset && { offset: Number(offset) }),
					},
				);
				return res.json({ success: true, ...result });
			} catch (error) {
				console.error("[M2P Cards] Transactions error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to fetch transactions",
					});
			}
		},
	);

	/**
	 * POST /api/cards/:cardId/transactions/:txId/dispute
	 * Raise a transaction dispute.
	 * Body: { reason }
	 */
	app.post(
		"/api/cards/:cardId/transactions/:txId/dispute",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				if (!m2pCardService.isConfigured()) {
					return res
						.status(503)
						.json({ success: false, message: "M2P API not configured" });
				}
				const { reason } = req.body;
				if (!reason)
					return res
						.status(400)
						.json({ success: false, message: "reason is required" });
				const result = await m2pCardService.disputeTransaction(
					req.params.cardId,
					req.params.txId,
					reason,
				);
				return res.json({ success: true, ...result });
			} catch (error) {
				console.error("[M2P Cards] Dispute error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to raise dispute",
					});
			}
		},
	);

	// ══════════════════════════════════════════════════════════════════════════
	// STATEMENTS
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * GET /api/cards/:cardId/statements
	 * List all statements for a card.
	 */
	app.get(
		"/api/cards/:cardId/statements",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				if (!m2pCardService.isConfigured()) {
					return res
						.status(503)
						.json({
							success: false,
							message: "M2P API not configured",
							statements: [],
						});
				}
				const statements = await m2pCardService.listStatements(
					req.params.cardId,
				);
				return res.json({ success: true, statements });
			} catch (error) {
				console.error("[M2P Cards] Statements error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to fetch statements",
					});
			}
		},
	);

	/**
	 * POST /api/cards/:cardId/statements/generate
	 * Trigger statement generation for a billing month.
	 * Body: { billingMonth } — format: YYYY-MM
	 */
	app.post(
		"/api/cards/:cardId/statements/generate",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				if (!m2pCardService.isConfigured()) {
					return res
						.status(503)
						.json({ success: false, message: "M2P API not configured" });
				}
				const { billingMonth } = req.body;
				if (!billingMonth)
					return res
						.status(400)
						.json({
							success: false,
							message: "billingMonth (YYYY-MM) required",
						});
				const result = await m2pCardService.generateStatement(
					req.params.cardId,
					billingMonth,
				);
				return res.json({ success: true, ...result });
			} catch (error) {
				console.error("[M2P Cards] Generate statement error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to generate statement",
					});
			}
		},
	);

	/**
	 * GET /api/cards/:cardId/statements/:sid
	 * Fetch a specific statement.
	 */
	app.get(
		"/api/cards/:cardId/statements/:sid",
		requireAuth,
		async (req: Request, res: Response) => {
			try {
				if (!m2pCardService.isConfigured()) {
					return res
						.status(503)
						.json({ success: false, message: "M2P API not configured" });
				}
				const statement = await m2pCardService.getStatement(
					req.params.cardId,
					req.params.sid,
				);
				return res.json({ success: true, statement });
			} catch (error) {
				console.error("[M2P Cards] Get statement error:", error);
				return res
					.status(500)
					.json({
						success: false,
						message:
							error instanceof Error
								? error.message
								: "Failed to get statement",
					});
			}
		},
	);

	// ══════════════════════════════════════════════════════════════════════════
	// WEBHOOK RECEIVER
	// ══════════════════════════════════════════════════════════════════════════

	/**
	 * POST /api/webhooks/m2p
	 * Receives M2P card lifecycle & transaction events.
	 * Verifies HMAC-SHA256 signature from x-m2p-signature header.
	 *
	 * Supported events:
	 *   card.issued, card.activated, card.blocked, card.replaced
	 *   transaction.approved, transaction.declined
	 *   statement.generated, limit.updated
	 *   application.approved, application.rejected
	 */
	app.post("/api/webhooks/m2p", async (req: Request, res: Response) => {
		try {
			const signature = req.headers["x-m2p-signature"] as string | undefined;
			const rawBody = JSON.stringify(req.body);

			if (!signature) {
				console.warn(
					"[M2P Webhook] Missing x-m2p-signature header — rejecting",
				);
				return res
					.status(400)
					.json({ success: false, message: "Missing webhook signature" });
			}

			if (process.env.M2P_WEBHOOK_SECRET) {
				const valid = m2pCardService.verifyWebhookSignature(rawBody, signature);
				if (!valid) {
					console.warn("[M2P Webhook] Signature verification failed");
					return res
						.status(401)
						.json({ success: false, message: "Invalid webhook signature" });
				}
			}

			const event = req.body as {
				eventId: string;
				eventType: string;
				timestamp: string;
				programId: string;
				data: Record<string, unknown>;
			};

			console.log(
				`[M2P Webhook] Event received: ${event.eventType} (${event.eventId})`,
			);

			switch (event.eventType) {
				case "card.issued":
					console.log("[M2P Webhook] Card issued:", event.data.cardId);
					break;
				case "card.activated":
					console.log("[M2P Webhook] Card activated:", event.data.cardId);
					break;
				case "card.blocked":
					console.log(
						"[M2P Webhook] Card blocked:",
						event.data.cardId,
						"— reason:",
						event.data.reason,
					);
					break;
				case "card.replaced":
					console.log(
						"[M2P Webhook] Card replaced — old:",
						event.data.oldCardId,
						"→ new:",
						event.data.newCardId,
					);
					break;
				case "transaction.approved":
					console.log(
						"[M2P Webhook] Transaction approved:",
						event.data.transactionId,
						"₹",
						event.data.amount,
					);
					break;
				case "transaction.declined":
					console.log(
						"[M2P Webhook] Transaction declined:",
						event.data.transactionId,
						"— reason:",
						event.data.declineReason,
					);
					break;
				case "statement.generated":
					console.log(
						"[M2P Webhook] Statement generated:",
						event.data.statementId,
						"for card:",
						event.data.cardId,
					);
					break;
				case "limit.updated":
					console.log(
						"[M2P Webhook] Limit updated:",
						event.data.cardId,
						"→",
						event.data.newLimit,
					);
					break;
				case "application.approved":
					console.log(
						"[M2P Webhook] Application approved:",
						event.data.applicationId,
						"— limit:",
						event.data.approvedLimit,
					);
					break;
				case "application.rejected":
					console.log(
						"[M2P Webhook] Application rejected:",
						event.data.applicationId,
						"— reason:",
						event.data.rejectionReason,
					);
					break;
				default:
					console.log("[M2P Webhook] Unknown event type:", event.eventType);
			}

			return res.json({ success: true, received: true });
		} catch (error) {
			console.error("[M2P Webhook] Processing error:", error);
			return res
				.status(500)
				.json({ success: false, message: "Webhook processing failed" });
		}
	});

	console.log(
		"✅ M2P Credit Card routes registered (/api/cards/*, /api/webhooks/m2p, /api/m2p/status)",
	);
}
