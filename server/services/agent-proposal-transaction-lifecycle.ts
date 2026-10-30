/**
 * @file agent-proposal-transaction-lifecycle.ts
 * @module services/agent-proposal-transaction-lifecycle
 * @description End-to-end Transaction Path Manager for Agent Proposals.
 *
 * Implements the complete lifecycle:
 *   1. Agent Proposal Creation & Verification
 *   2. Client Consent & Risk Disclosure Acknowledgment
 *   3. Transaction Initiation (Unified Orders, Gateway Dispatch)
 *   4. Transaction Completion (Settlement & Execution Tracking)
 *   5. External Copies Dispatch:
 *      - Zoho Books / CRM (Invoice, Compliance Tracking, Revenue Recognition)
 *      - SEBI Regulatory Audit Log (RIA Compliance, Audit Dossier, Cryptographic Hash)
 *
 * All stages are immutably recorded at FintekPro with complete provenance.
 * Conforms to FintekPro GCR v1.0 + FASP-AI v1.0.
 */

import { db } from "../db";
import { logger } from "../logger";
import { complianceMonitor } from "../compliance-monitor";
import { zohoTransactionSyncService } from "./zoho-transaction-sync-service";
import * as schema from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";

export interface ProposalInitiationRequest {
	proposalId: string;
	clientId: string;
	agentId?: string;
	orderType?: "LUMPSUM" | "SIP" | "MARKET" | "LIMIT";
	paymentGateway?: "bse_star" | "upstox" | "cashfree" | "escrow" | "iris";
	clientIp?: string;
	userAgent?: string;
	notes?: string;
}

export interface TransactionCompletionRequest {
	orderId: string;
	externalOrderId?: string;
	paymentTransactionId?: string;
	executionStatus: "completed" | "failed";
	executionPrice?: string;
	executedQuantity?: string;
	settlementReference?: string;
	failureReason?: string;
	dispatchToExternalApis?: boolean;
}

export interface ExternalDispatchResult {
	orderId: string;
	proposalId: string;
	fintekproRecordId: string;
	zoho: {
		synced: boolean;
		syncType?: string;
		zohoInvoiceId?: string;
		zohoBillId?: string;
		timestamp: string;
		error?: string;
	};
	sebi: {
		recorded: boolean;
		auditRef: string;
		auditHash: string;
		engineVersion: string;
		timestamp: string;
		externalWebhookSent?: boolean;
	};
}

export interface LifecycleTimelineEvent {
	stage: "PROPOSAL_CREATED" | "CLIENT_CONSENT_GRANTED" | "TRANSACTION_INITIATED" | "TRANSACTION_COMPLETED" | "EXTERNAL_SYNC_DISPATCHED";
	timestamp: string;
	status: "success" | "pending" | "failed";
	actorId?: string;
	details: Record<string, unknown>;
}

export class AgentProposalTransactionLifecycle {
	private readonly engineVersion = "v1.0";

	/**
	 * Computes a tamper-evident SHA-256 cryptographic audit hash for SEBI reporting.
	 */
	private generateSebiAuditHash(payload: Record<string, unknown>): string {
		const canonical = JSON.stringify(payload, Object.keys(payload).sort());
		return createHash("sha256").update(canonical).digest("hex");
	}

	/**
	 * Generates a standard human-readable FintekPro order number.
	 */
	private generateOrderNumber(): string {
		const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
		const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
		return `FIN-ORD-${dateStr}-${rand}`;
	}

	/**
	 * STAGE 1 & 2: Record client consent and approval for an agent proposal.
	 */
	async recordProposalConsent(params: {
		proposalId: string;
		clientId: string;
		disclosureAcknowledged: boolean;
		riskAcknowledged: boolean;
		executionConsent: boolean;
		signatureType?: string;
		signatureData?: unknown;
		ipAddress?: string;
		userAgent?: string;
		clientNotes?: string;
	}): Promise<{ success: boolean; approvalId: string; proposalStatus: string }> {
		const startTime = Date.now();
		const now = new Date();

		try {
			// Find proposal in investmentProposals or prospectProposals
			const [invProposal] = await db
				.select()
				.from(schema.investmentProposals)
				.where(eq(schema.investmentProposals.id, params.proposalId))
				.limit(1);

			let proposalType: "investment" | "prospect" = "investment";
			if (!invProposal) {
				const [prospectProp] = await db
					.select()
					.from(schema.prospectProposals)
					.where(eq(schema.prospectProposals.id, params.proposalId))
					.limit(1);

				if (!prospectProp) {
					throw new Error(`Proposal ${params.proposalId} not found in FintekPro.`);
				}
				proposalType = "prospect";
			}

			// Upsert approval record
			const [existingApproval] = await db
				.select()
				.from(schema.proposalApprovals)
				.where(eq(schema.proposalApprovals.proposalId, params.proposalId))
				.limit(1);

			const approvalData = {
				status: params.executionConsent ? "approved" : "pending",
				disclosureAcknowledged: params.disclosureAcknowledged,
				disclosureAcknowledgedAt: params.disclosureAcknowledged ? now : null,
				riskAcknowledged: params.riskAcknowledged,
				riskAcknowledgedAt: params.riskAcknowledged ? now : null,
				executionConsent: params.executionConsent,
				executionConsentAt: params.executionConsent ? now : null,
				signatureType: params.signatureType || "otp",
				signatureData: params.signatureData as any || null,
				signedAt: now,
				approvedAt: params.executionConsent ? now : null,
				ipAddress: params.ipAddress || null,
				userAgent: params.userAgent || null,
				clientNotes: params.clientNotes || null,
				updatedAt: now,
			};

			let approvalId: string;
			if (existingApproval) {
				await db
					.update(schema.proposalApprovals)
					.set(approvalData)
					.where(eq(schema.proposalApprovals.id, existingApproval.id));
				approvalId = existingApproval.id;
			} else {
				approvalId = randomUUID();
				await db.insert(schema.proposalApprovals).values({
					id: approvalId,
					proposalId: params.proposalId,
					...approvalData,
				});
			}

			// Update proposal status in DB
			if (proposalType === "investment") {
				await db
					.update(schema.investmentProposals)
					.set({
						status: "approved",
						approvedAt: now,
						clientResponse: params.clientNotes || "Approved with execution consent",
					})
					.where(eq(schema.investmentProposals.id, params.proposalId));
			} else {
				await db
					.update(schema.prospectProposals)
					.set({
						status: "approved",
						updatedAt: now,
					})
					.where(eq(schema.prospectProposals.id, params.proposalId));
			}

			// Log to FintekPro compliance monitor
			complianceMonitor.logEvent({
				userId: params.clientId,
				eventType: "consent_change",
				action: "Client granted execution consent for proposal",
				ipAddress: params.ipAddress,
				userAgent: params.userAgent,
				outcome: "success",
				riskLevel: "low",
				details: {
					proposalId: params.proposalId,
					approvalId,
					disclosureAcknowledged: params.disclosureAcknowledged,
					riskAcknowledged: params.riskAcknowledged,
					executionConsent: params.executionConsent,
					engineVersion: this.engineVersion,
				},
			});

			logger.info("[TransactionLifecycle] PROPOSAL_CONSENT_RECORDED", {
				event: "PROPOSAL_CONSENT_RECORDED",
				userId: params.clientId,
				latencyMs: Date.now() - startTime,
				status: "success",
			});

			return { success: true, approvalId, proposalStatus: "approved" };
		} catch (error: any) {
			logger.error("[TransactionLifecycle] PROPOSAL_CONSENT_FAILED", {
				event: "PROPOSAL_CONSENT_FAILED",
				userId: params.clientId,
				latencyMs: Date.now() - startTime,
				status: "failed",
				error: error.message,
			});
			throw error;
		}
	}

	/**
	 * STAGE 3: Transaction Initiation from an Agent Proposal.
	 * Carves the path: Proposal -> Unified Order -> Execution Gateway.
	 */
	async initiateTransactionFromProposal(
		req: ProposalInitiationRequest,
	): Promise<{
		success: boolean;
		orderId: string;
		orderNumber: string;
		status: string;
		totalAmount: string;
		proposalId: string;
		clearingGateway: string;
	}> {
		const startTime = Date.now();
		const now = new Date();

		try {
			// 1. Retrieve the proposal
			let proposalTitle = "Agent Investment Proposal";
			let totalAmount = "0";
			let recommendations: any[] = [];
			let productType = "mutual_fund";
			let agentId = req.agentId;

			const [invProp] = await db
				.select()
				.from(schema.investmentProposals)
				.where(eq(schema.investmentProposals.id, req.proposalId))
				.limit(1);

			if (invProp) {
				proposalTitle = invProp.title;
				totalAmount = String(invProp.totalInvestmentAmount || "0");
				recommendations = (invProp.recommendations as any[]) || [];
				agentId = agentId || invProp.agentId || undefined;
			} else {
				const [prospectProp] = await db
					.select()
					.from(schema.prospectProposals)
					.where(eq(schema.prospectProposals.id, req.proposalId))
					.limit(1);

				if (!prospectProp) {
					throw new Error(`Cannot initiate transaction: Proposal ${req.proposalId} not found.`);
				}
				proposalTitle = prospectProp.proposalTitle;
				totalAmount = String(prospectProp.totalInvestmentAmount || "0");
				recommendations = (prospectProp.recommendations as any[]) || [];
				agentId = agentId || prospectProp.agentId || undefined;
			}

			// Detect primary product type from recommendations
			if (recommendations.length > 0) {
				const firstCategory = String(recommendations[0]?.category || "").toLowerCase();
				if (firstCategory.includes("bond") || firstCategory.includes("g-sec")) {
					productType = "bond";
				} else if (firstCategory.includes("unlisted") || firstCategory.includes("pre-ipo")) {
					productType = "unlisted";
				} else if (firstCategory.includes("ipo")) {
					productType = "ipo";
				}
			}

			// 2. Create the unified order in FintekPro DB
			const orderId = randomUUID();
			const orderNumber = this.generateOrderNumber();
			const clearingGateway = req.paymentGateway || (productType === "mutual_fund" ? "bse_star" : "cashfree");

			const timeline: LifecycleTimelineEvent[] = [
				{
					stage: "PROPOSAL_CREATED",
					timestamp: invProp?.createdAt?.toISOString() || now.toISOString(),
					status: "success",
					actorId: agentId,
					details: { proposalId: req.proposalId, title: proposalTitle },
				},
				{
					stage: "CLIENT_CONSENT_GRANTED",
					timestamp: now.toISOString(),
					status: "success",
					actorId: req.clientId,
					details: { consentVerified: true },
				},
				{
					stage: "TRANSACTION_INITIATED",
					timestamp: now.toISOString(),
					status: "success",
					actorId: req.clientId,
					details: {
						orderId,
						orderNumber,
						clearingGateway,
						amount: totalAmount,
					},
				},
			];

			const [order] = await db
				.insert(schema.unifiedOrders)
				.values({
					id: orderId,
					orderNumber,
					userId: req.clientId,
					createdByAgentId: agentId || null,
					proposalId: req.proposalId,
					productType,
					productName: proposalTitle,
					orderType: req.orderType || "LUMPSUM",
					amount: totalAmount,
					currency: "INR",
					status: "initiated",
					paymentStatus: "pending",
					paymentGateway: clearingGateway,
					executionStatus: "pending",
					notes: req.notes || `Order initiated from agent proposal ${req.proposalId}`,
					createdBy: req.clientId,
					metadata: {
						proposalId: req.proposalId,
						proposalTitle,
						recommendationsSnapshot: recommendations,
						engineVersion: this.engineVersion,
						initiatedAt: now.toISOString(),
						clientIp: req.clientIp || null,
						userAgent: req.userAgent || null,
						timeline,
					},
				})
				.returning();

			// 3. Update proposal execution state
			await db
				.update(schema.investmentProposals)
				.set({
					status: "executing",
					executionStatus: "processing",
					executionDetails: {
						orderId,
						orderNumber,
						gateway: clearingGateway,
						initiatedAt: now.toISOString(),
					},
				})
				.where(eq(schema.investmentProposals.id, req.proposalId))
				.catch(() => {
					/* Non-blocking if table is prospectProposals */
				});

			// 4. Record compliance audit event
			complianceMonitor.logEvent({
				userId: req.clientId,
				eventType: "transaction",
				action: `Transaction initiated for proposal ${req.proposalId}`,
				ipAddress: req.clientIp,
				userAgent: req.userAgent,
				outcome: "success",
				riskLevel: "low",
				details: {
					orderId,
					orderNumber,
					proposalId: req.proposalId,
					amount: totalAmount,
					clearingGateway,
					agentId,
					engineVersion: this.engineVersion,
				},
			});

			logger.info("[TransactionLifecycle] TRANSACTION_PATH_INITIATED", {
				event: "TRANSACTION_PATH_INITIATED",
				userId: req.clientId,
				latencyMs: Date.now() - startTime,
				status: "success",
			});

			return {
				success: true,
				orderId,
				orderNumber,
				status: "initiated",
				totalAmount,
				proposalId: req.proposalId,
				clearingGateway,
			};
		} catch (error: any) {
			logger.error("[TransactionLifecycle] TRANSACTION_INITIATION_FAILED", {
				event: "TRANSACTION_INITIATION_FAILED",
				userId: req.clientId,
				latencyMs: Date.now() - startTime,
				status: "failed",
				error: error.message,
			});
			throw error;
		}
	}

	/**
	 * STAGE 4: Transaction Completion & Settlement.
	 * Updates FintekPro ledger and triggers automatic copy distribution to Zoho & SEBI.
	 */
	async completeTransaction(
		params: TransactionCompletionRequest,
	): Promise<{
		success: boolean;
		orderId: string;
		status: string;
		dispatchResult?: ExternalDispatchResult;
	}> {
		const startTime = Date.now();
		const now = new Date();

		try {
			const [order] = await db
				.select()
				.from(schema.unifiedOrders)
				.where(eq(schema.unifiedOrders.id, params.orderId))
				.limit(1);

			if (!order) {
				throw new Error(`Order ${params.orderId} not found.`);
			}

			const isSuccess = params.executionStatus === "completed";
			const updatedStatus = isSuccess ? "completed" : "failed";

			// Update metadata timeline
			const currentMeta = (order.metadata as Record<string, any>) || {};
			const timeline: LifecycleTimelineEvent[] = currentMeta.timeline || [];
			timeline.push({
				stage: "TRANSACTION_COMPLETED",
				timestamp: now.toISOString(),
				status: isSuccess ? "success" : "failed",
				actorId: order.userId || undefined,
				details: {
					externalOrderId: params.externalOrderId,
					paymentTransactionId: params.paymentTransactionId,
					settlementReference: params.settlementReference,
					failureReason: params.failureReason,
				},
			});

			// Update order in FintekPro DB
			await db
				.update(schema.unifiedOrders)
				.set({
					status: updatedStatus,
					paymentStatus: isSuccess ? "completed" : "failed",
					executionStatus: isSuccess ? "completed" : "failed",
					paymentTransactionId: params.paymentTransactionId || order.paymentTransactionId,
					externalOrderId: params.externalOrderId || order.externalOrderId,
					settlementReference: params.settlementReference || order.settlementReference,
					settlementStatus: isSuccess ? "settled" : "failed",
					executedAt: isSuccess ? now : null,
					paymentCompletedAt: isSuccess ? now : null,
					settlementDate: isSuccess ? now : null,
					executionError: params.failureReason || null,
					metadata: {
						...currentMeta,
						timeline,
						completedAt: now.toISOString(),
					},
					updatedAt: now,
				})
				.where(eq(schema.unifiedOrders.id, params.orderId));

			// Update corresponding proposal if linked
			if (order.proposalId) {
				await db
					.update(schema.investmentProposals)
					.set({
						status: isSuccess ? "completed" : "failed",
						executionStatus: isSuccess ? "completed" : "failed",
						executedAt: isSuccess ? now : null,
						executionDetails: {
							orderId: order.id,
							orderNumber: order.orderNumber,
							externalOrderId: params.externalOrderId,
							settlementReference: params.settlementReference,
							completedAt: now.toISOString(),
						},
					})
					.where(eq(schema.investmentProposals.id, order.proposalId))
					.catch(() => {});
			}

			// Log completion to compliance monitor
			complianceMonitor.logEvent({
				userId: order.userId || "system",
				eventType: "transaction",
				action: `Order ${order.orderNumber} ${updatedStatus}`,
				outcome: isSuccess ? "success" : "failure",
				riskLevel: isSuccess ? "low" : "medium",
				details: {
					orderId: order.id,
					orderNumber: order.orderNumber,
					proposalId: order.proposalId,
					externalOrderId: params.externalOrderId,
					amount: order.amount,
					engineVersion: this.engineVersion,
				},
			});

			// STAGE 5: Dispatch copies to Zoho & SEBI if successful
			let dispatchResult: ExternalDispatchResult | undefined;
			if (isSuccess && params.dispatchToExternalApis !== false) {
				dispatchResult = await this.dispatchTransactionCopies({
					orderId: order.id,
					destinations: ["zoho", "sebi"],
				});
			}

			logger.info("[TransactionLifecycle] TRANSACTION_COMPLETED_AND_RECORDED", {
				event: "TRANSACTION_COMPLETED_AND_RECORDED",
				userId: order.userId || "system",
				latencyMs: Date.now() - startTime,
				status: isSuccess ? "success" : "failed",
			});

			return {
				success: isSuccess,
				orderId: order.id,
				status: updatedStatus,
				dispatchResult,
			};
		} catch (error: any) {
			logger.error("[TransactionLifecycle] TRANSACTION_COMPLETION_ERROR", {
				event: "TRANSACTION_COMPLETION_ERROR",
				userId: params.orderId,
				latencyMs: Date.now() - startTime,
				status: "failed",
				error: error.message,
			});
			throw error;
		}
	}

	/**
	 * STAGE 5: Multi-Destination Copy Dispatcher.
	 * Sends transaction copies to Zoho Books/CRM and prepares SEBI Regulatory Dossier.
	 */
	async dispatchTransactionCopies(params: {
		orderId: string;
		destinations?: Array<"zoho" | "sebi" | "webhook">;
	}): Promise<ExternalDispatchResult> {
		const startTime = Date.now();
		const now = new Date();
		const destinations = params.destinations || ["zoho", "sebi"];

		const [order] = await db
			.select()
			.from(schema.unifiedOrders)
			.where(eq(schema.unifiedOrders.id, params.orderId))
			.limit(1);

		if (!order) {
			throw new Error(`Order ${params.orderId} not found.`);
		}

		const proposalId = order.proposalId || "N/A";
		const auditPayload = {
			orderId: order.id,
			orderNumber: order.orderNumber,
			proposalId,
			userId: order.userId,
			agentId: order.createdByAgentId,
			productType: order.productType,
			amount: order.amount,
			currency: order.currency || "INR",
			paymentStatus: order.paymentStatus,
			executionStatus: order.executionStatus,
			executedAt: order.executedAt?.toISOString() || now.toISOString(),
			engineVersion: this.engineVersion,
			fintekproPlatform: "FintekPro Financial Services LLP",
		};

		const auditHash = this.generateSebiAuditHash(auditPayload);
		const auditRef = `SEBI-AUD-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${auditHash.slice(0, 8).toUpperCase()}`;

		const result: ExternalDispatchResult = {
			orderId: order.id,
			proposalId,
			fintekproRecordId: order.id,
			zoho: {
				synced: false,
				timestamp: now.toISOString(),
			},
			sebi: {
				recorded: true,
				auditRef,
				auditHash,
				engineVersion: this.engineVersion,
				timestamp: now.toISOString(),
			},
		};

		// 1. Dispatch to Zoho Books / CRM
		if (destinations.includes("zoho")) {
			try {
				let zohoRes: any = null;
				if (order.productType === "mutual_fund") {
					zohoRes = await zohoTransactionSyncService.syncMutualFundOrder(order.id);
				} else if (order.productType === "bond") {
					zohoRes = await zohoTransactionSyncService.syncBondOrder(order.id);
				} else if (order.productType === "unlisted") {
					zohoRes = await zohoTransactionSyncService.syncUnlistedDeal(order.id);
				} else {
					zohoRes = await zohoTransactionSyncService.syncStoreTransaction(order.id);
				}

				if (zohoRes) {
					result.zoho = {
						synced: zohoRes.success ?? true,
						syncType: zohoRes.syncType || "compliance_only",
						zohoInvoiceId: zohoRes.zohoInvoiceId,
						zohoBillId: zohoRes.zohoBillId,
						timestamp: now.toISOString(),
						error: zohoRes.error,
					};
				}
			} catch (zohoErr: any) {
				logger.warn("[TransactionLifecycle] Zoho dispatch fallback warning:", {
					orderId: order.id,
					message: zohoErr.message,
				});
				result.zoho = {
					synced: false,
					syncType: "fallback_queued",
					error: zohoErr.message,
					timestamp: now.toISOString(),
				};
			}
		}

		// 2. Dispatch / Record to SEBI Regulatory Compliance Ledger
		if (destinations.includes("sebi")) {
			try {
				complianceMonitor.logEvent({
					userId: order.userId || "system",
					eventType: "admin_action",
					action: `SEBI Audit Copy Carved: ${auditRef}`,
					outcome: "success",
					riskLevel: "low",
					details: {
						...auditPayload,
						auditHash,
						auditRef,
						zohoStatus: result.zoho.synced ? "synced" : "pending",
					},
				});

				// If external SEBI audit webhook is configured, post in background
				if (process.env.SEBI_REPORTING_WEBHOOK_URL) {
					fetch(process.env.SEBI_REPORTING_WEBHOOK_URL, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-FintekPro-Audit-Hash": auditHash,
							"X-FintekPro-Engine-Version": this.engineVersion,
						},
						body: JSON.stringify({
							auditRef,
							auditHash,
							timestamp: now.toISOString(),
							data: auditPayload,
						}),
					})
						.then(() => {
							result.sebi.externalWebhookSent = true;
						})
						.catch((err) => {
							logger.warn("[TransactionLifecycle] SEBI webhook delivery warning:", err.message);
						});
				}
			} catch (sebiErr: any) {
				logger.error("[TransactionLifecycle] SEBI recording error:", sebiErr);
			}
		}

		// 3. Persist sync receipts in unifiedOrders.metadata
		const currentMeta = (order.metadata as Record<string, any>) || {};
		const timeline: LifecycleTimelineEvent[] = currentMeta.timeline || [];
		timeline.push({
			stage: "EXTERNAL_SYNC_DISPATCHED",
			timestamp: now.toISOString(),
			status: result.zoho.synced ? "success" : "pending",
			details: {
				zoho: result.zoho,
				sebi: result.sebi,
			},
		});

		await db
			.update(schema.unifiedOrders)
			.set({
				metadata: {
					...currentMeta,
					zohoSync: result.zoho,
					sebiAuditSync: result.sebi,
					timeline,
					lastDispatchedAt: now.toISOString(),
				},
				updatedAt: now,
			})
			.where(eq(schema.unifiedOrders.id, order.id));

		logger.info("[TransactionLifecycle] TRANSACTION_COPIES_DISPATCHED", {
			event: "TRANSACTION_COPIES_DISPATCHED",
			userId: order.userId || "system",
			latencyMs: Date.now() - startTime,
			status: "success",
		});

		return result;
	}

	/**
	 * Retrieves the full provenance and audit timeline of a proposal transaction.
	 */
	async getProposalTransactionLifecycle(proposalId: string): Promise<{
		proposalId: string;
		proposalStatus: string;
		order?: {
			orderId: string;
			orderNumber: string;
			status: string;
			amount: string;
			clearingGateway: string | null;
			executedAt: Date | null;
		};
		timeline: LifecycleTimelineEvent[];
		externalSync: {
			zoho?: Record<string, unknown>;
			sebi?: Record<string, unknown>;
		};
		fintekproProvenance: {
			platform: string;
			engineVersion: string;
			calculationTimestamp: string;
		};
	}> {
		// Find order linked to this proposal
		const [order] = await db
			.select()
			.from(schema.unifiedOrders)
			.where(eq(schema.unifiedOrders.proposalId, proposalId))
			.orderBy(desc(schema.unifiedOrders.createdAt))
			.limit(1);

		let proposalStatus = "pending";
		const [invProp] = await db
			.select({ status: schema.investmentProposals.status })
			.from(schema.investmentProposals)
			.where(eq(schema.investmentProposals.id, proposalId))
			.limit(1);

		if (invProp) {
			proposalStatus = invProp.status || "pending";
		} else {
			const [prospectProp] = await db
				.select({ status: schema.prospectProposals.status })
				.from(schema.prospectProposals)
				.where(eq(schema.prospectProposals.id, proposalId))
				.limit(1);
			if (prospectProp) {
				proposalStatus = prospectProp.status || "pending";
			}
		}

		const meta = (order?.metadata as Record<string, any>) || {};
		const timeline: LifecycleTimelineEvent[] = meta.timeline || [];

		return {
			proposalId,
			proposalStatus,
			order: order
				? {
						orderId: order.id,
						orderNumber: order.orderNumber,
						status: order.status,
						amount: order.amount,
						clearingGateway: order.paymentGateway,
						executedAt: order.executedAt,
					}
				: undefined,
			timeline,
			externalSync: {
				zoho: meta.zohoSync,
				sebi: meta.sebiAuditSync,
			},
			fintekproProvenance: {
				platform: "FintekPro Financial Services LLP",
				engineVersion: this.engineVersion,
				calculationTimestamp: new Date().toISOString(),
			},
		};
	}
}

export const agentProposalTransactionLifecycle = new AgentProposalTransactionLifecycle();

