// @ts-nocheck
import { Express } from "express";
import { storage } from "../storage";
import { requireAdmin, requireAgent } from "../middleware/roleMiddleware";
import { requireLevel2 } from "../middleware/kyc-level-gate";
import { comprehensiveAIFPMSAPI } from "../comprehensive-aif-pms-api";
import { kfintechApi } from "../kfintech-api";
import {
	errorMonitor,
	errorMonitoringMiddleware,
	globalErrorHandler,
} from "../error-monitor";
import { and, or, count } from "drizzle-orm";
import * as geminiService from "../gemini-service";

// Stub for aiPortfolioService — delegates to geminiService at runtime
const aiPortfolioService: any = geminiService;

const authenticateUser = async (req: any, res: any, next: any) => {
	if (req.isAuthenticated?.() && req.user) return next();
	const authHeader = req.headers.authorization;
	if (!authHeader)
		return res.status(401).json({ error: "Authentication required" });
	return res
		.status(401)
		.json({ error: "Please sign in to access this resource" });
};

const hasRole = (user: any, requiredRoles: string[]): boolean => {
	if (!user) return false;
	const userRoles = user.roles || (user.role ? [user.role] : []);
	return requiredRoles.some((role) => userRoles.includes(role));
};

export function registerAIFPMSSystemPart3Part1Routes(app: Express): void {
	app.post(
		"/api/proposals/:proposalId/approve",
		authenticateUser,
		async (req, res) => {
			try {
				const { proposalId } = req.params;
				const { clientResponse } = req.body;

				const proposal = await storage.getInvestmentProposal(proposalId);
				if (!proposal) {
					return res.status(404).json({ error: "Proposal not found" });
				}

				// Only the client can approve their proposal
				if (
					proposal.clientId !== (req.user as any).id &&
					(req.user as any).role !== "admin"
				) {
					return res
						.status(403)
						.json({ error: "Only the client can approve this proposal" });
				}

				if (proposal.status !== "pending") {
					return res
						.status(400)
						.json({ error: "Proposal is not in pending status" });
				}

				const approved = await storage.approveProposal(
					proposalId,
					clientResponse,
				);
				res.json(approved);
			} catch (error) {
				console.error("Error approving proposal:", error);
				res.status(500).json({ error: "Failed to approve proposal" });
			}
		},
	);

	app.post(
		"/api/proposals/:proposalId/reject",
		authenticateUser,
		async (req, res) => {
			try {
				const { proposalId } = req.params;
				const { clientResponse } = req.body;

				if (!clientResponse) {
					return res
						.status(400)
						.json({ error: "Client response is required for rejection" });
				}

				const proposal = await storage.getInvestmentProposal(proposalId);
				if (!proposal) {
					return res.status(404).json({ error: "Proposal not found" });
				}

				// Only the client can reject their proposal
				if (
					proposal.clientId !== (req.user as any).id &&
					(req.user as any).role !== "admin"
				) {
					return res
						.status(403)
						.json({ error: "Only the client can reject this proposal" });
				}

				if (proposal.status !== "pending") {
					return res
						.status(400)
						.json({ error: "Proposal is not in pending status" });
				}

				const rejected = await storage.rejectProposal(
					proposalId,
					clientResponse,
				);
				res.json(rejected);
			} catch (error) {
				console.error("Error rejecting proposal:", error);
				res.status(500).json({ error: "Failed to reject proposal" });
			}
		},
	);

	// Generate AI proposals for monthly surplus allocation
	app.post("/api/proposals/generate-ai", authenticateUser, async (req, res) => {
		try {
			const userId = (req.user as any).id;
			const { targetAmount = 72000 } = req.body; // Default to ₹72,000 monthly surplus

			// Generate AI proposal using the portfolio service
			const proposal =
				await aiPortfolioService.generateMonthlySurplusAllocationProposal(
					userId,
					targetAmount,
				);

			res.status(201).json({
				success: true,
				proposal,
				message: `AI proposal generated for ₹${targetAmount.toLocaleString()} monthly surplus allocation`,
			});
		} catch (error) {
			console.error("Error generating AI proposal:", error);
			res.status(500).json({
				error: "Failed to generate AI investment proposal",
				details: error instanceof Error ? error.message : "Unknown error",
			});
		}
	});

	// Proposal Items API
	app.get(
		"/api/proposals/:proposalId/items",
		authenticateUser,
		async (req, res) => {
			try {
				const { proposalId } = req.params;

				// Verify user has access to this proposal
				const proposal = await storage.getInvestmentProposal(proposalId);
				if (!proposal) {
					return res.status(404).json({ error: "Proposal not found" });
				}

				if (
					!hasRole(req.user, ["admin"]) &&
					proposal.clientId !== (req.user as any).id &&
					proposal.agentId !== (req.user as any).id
				) {
					return res.status(403).json({ error: "Access denied" });
				}

				const items = await storage.getProposalItems(proposalId);
				res.json(items);
			} catch (error) {
				console.error("Error fetching proposal items:", error);
				res.status(500).json({ error: "Failed to fetch proposal items" });
			}
		},
	);

	app.post(
		"/api/proposals/:proposalId/items",
		authenticateUser,
		async (req, res) => {
			try {
				const { proposalId } = req.params;

				// Verify user is the agent who created the proposal
				const proposal = await storage.getInvestmentProposal(proposalId);
				if (!proposal) {
					return res.status(404).json({ error: "Proposal not found" });
				}

				if (
					!hasRole(req.user, ["admin"]) &&
					proposal.agentId !== (req.user as any).id
				) {
					return res
						.status(403)
						.json({ error: "Only the agent can add items to their proposals" });
				}

				if (proposal.status !== "pending") {
					return res
						.status(400)
						.json({ error: "Cannot add items to non-pending proposals" });
				}

				const itemData = { ...req.body, proposalId };
				const item = await storage.createProposalItem(itemData);
				res.status(201).json(item);
			} catch (error) {
				console.error("Error creating proposal item:", error);
				res.status(500).json({ error: "Failed to create proposal item" });
			}
		},
	);

	// Payment Integration Routes
	app.get(
		"/api/proposals/:proposalId/payments",
		authenticateUser,
		async (req, res) => {
			try {
				const { proposalId } = req.params;

				// Verify user has access to this proposal
				const proposal = await storage.getInvestmentProposal(proposalId);
				if (!proposal) {
					return res.status(404).json({ error: "Proposal not found" });
				}

				if (
					!hasRole(req.user, ["admin"]) &&
					proposal.clientId !== (req.user as any).id &&
					proposal.agentId !== (req.user as any).id
				) {
					return res.status(403).json({ error: "Access denied" });
				}

				const payments = await storage.getProposalPayments(proposalId);
				res.json(payments);
			} catch (error) {
				console.error("Error fetching proposal payments:", error);
				res.status(500).json({ error: "Failed to fetch payments" });
			}
		},
	);

	// Initiate payment for approved proposals
	app.post(
		"/api/proposals/:proposalId/payments",
		authenticateUser,
		async (req, res) => {
			try {
				const { proposalId } = req.params;
				const { gateway, paymentMethod, amount } = req.body;

				const proposal = await storage.getInvestmentProposal(proposalId);
				if (!proposal) {
					return res.status(404).json({ error: "Proposal not found" });
				}

				// Only approved proposals can have payments initiated
				if (proposal.status !== "approved") {
					return res
						.status(400)
						.json({
							error: "Only approved proposals can have payments initiated",
						});
				}

				// Only the client can initiate payment
				if (
					proposal.clientId !== (req.user as any).id &&
					(req.user as any).role !== "admin"
				) {
					return res
						.status(403)
						.json({ error: "Only the client can initiate payment" });
				}

				if (!gateway || !["iris", "cams", "kfintech"].includes(gateway)) {
					return res
						.status(400)
						.json({ error: "Valid payment gateway is required" });
				}

				const paymentData = {
					proposalId,
					gateway,
					paymentMethod: paymentMethod || "netbanking",
					amount: amount || proposal.totalInvestmentAmount,
					clientId: proposal.clientId,
					agentId: proposal.agentId,
					status: "initiated",
				};

				const payment = await storage.createProposalPayment(paymentData);

				// Update proposal payment status
				await storage.updateInvestmentProposal(proposalId, {
					paymentMethod: gateway,
					paymentStatus: "processing",
					paymentId: payment.id,
				});

				res.status(201).json(payment);
			} catch (error) {
				console.error("Error initiating payment:", error);
				res.status(500).json({ error: "Failed to initiate payment" });
			}
		},
	);

	// ============ AGENT TRANSACTION REPORTS ROUTES ============

	// Agent requests client transaction report
	app.post(
		"/api/agent/transaction-reports/request",
		requireAgent,
		async (req, res) => {
			try {
				const {
					clientId,
					reportType,
					reportPeriod,
					startDate,
					endDate,
					apiProvider,
				} = req.body;

				if (!clientId || !reportType || !apiProvider) {
					return res.status(400).json({ error: "Missing required fields" });
				}

				// Verify agent has access to this client
				const relationship = await storage.getClientAgentRelationship(
					clientId,
					(req.user as any).id,
				);
				if (!relationship || relationship.status !== "active") {
					return res
						.status(403)
						.json({ error: "No active relationship with this client" });
				}

				const reportData = {
					clientId,
					agentId: (req.user as any).id,
					reportType,
					reportPeriod: reportPeriod || "yearly",
					startDate:
						startDate ||
						new Date(new Date().getFullYear(), 0, 1)
							.toISOString()
							.split("T")[0],
					endDate: endDate || new Date().toISOString().split("T")[0],
					apiProvider,
					status: "requested",
					reportFee: reportType === "portfolio_statement" ? "10" : "5",
				};

				const report = await storage.createTransactionReport(reportData);

				res.status(201).json({
					success: true,
					report,
					message: "Transaction report request created successfully",
				});
			} catch (error) {
				console.error("Error requesting transaction report:", error);
				res.status(500).json({ error: "Failed to request transaction report" });
			}
		},
	);

	// Agent gets list of transaction reports for their clients
}
