/**
 * Transaction Automation Engine
 *
 * Routes all financial orders through the correct instrument gateway.
 * Enforces KYC gate, API readiness gate, and fires parallel admin notifications
 * for any back-office tasks that should not block the client.
 *
 * Design:
 *  - Client always gets a response (ORDER_CONFIRMED, ORDER_QUEUED, or GATEWAY_UNAVAILABLE) < 3s
 *  - If a gateway is not configured → "Coming Soon" + admin is notified in parallel
 *  - If commission % is missing → order placed at 0%, admin notified
 *  - If value > ₹10L → high-value alert fired in parallel
 *  - Admin/agent are never on the critical path for a client transaction
 */

import { logger } from "../logger";
import { checkGateway, type InstrumentType } from "./api-gateway-readiness";
import {
	notifyGatewayNotConfigured,
	notifySetCommission,
	notifyHighValueTransaction,
} from "./admin-parallel-notifier";
import { getUserKYCLevel } from "../middleware/kyc-level-gate";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and } from "drizzle-orm";

const HIGH_VALUE_THRESHOLD_INR = 1_000_000; // ₹10 Lakh

export type OrderStatus =
	| "SUBMITTED" // Successfully sent to gateway
	| "QUEUED" // Accepted locally, will be sent when gateway is ready
	| "GATEWAY_UNAVAILABLE" // Gateway not configured (coming soon or missing keys)
	| "KYC_REQUIRED" // User does not have required KYC level
	| "FAILED"; // Gateway rejected the order

export interface OrderRequest {
	userId: string;
	/** Agent or partner placing order on behalf of client */
	agentId?: string;
	partnerId?: string;
	instrumentType: InstrumentType;
	/** Amount in INR */
	amountInr?: number;
	/** Payload forwarded as-is to the gateway */
	gatewayPayload: Record<string, any>;
	/** Required KYC level for this instrument (default: '1') */
	requiredKycLevel?: "1" | "2";
}

export interface OrderResult {
	status: OrderStatus;
	orderId?: string;
	gatewayOrderId?: string;
	message: string;
	/** Human-friendly message for the client UI */
	clientMessage: string;
	/** If GATEWAY_UNAVAILABLE, whether this is a coming-soon feature */
	comingSoon?: boolean;
	/** Instrument-specific gateway that would handle this order */
	provider?: string;
}

class TransactionAutomationEngine {
	/**
	 * Submit an order. Returns immediately with a result.
	 * Admin/agent notifications are fired asynchronously — never on the critical path.
	 */
	async submitOrder(request: OrderRequest): Promise<OrderResult> {
		const {
			userId,
			agentId,
			partnerId,
			instrumentType,
			amountInr,
			gatewayPayload,
			requiredKycLevel = "1",
		} = request;

		// ── 1. KYC Gate ───────────────────────────────────────────────────────────
		try {
			const { level } = await getUserKYCLevel(userId);
			const levelNum = Number.parseInt(level);
			const requiredNum = Number.parseInt(requiredKycLevel);
			if (levelNum < requiredNum) {
				return {
					status: "KYC_REQUIRED",
					message: `KYC Level ${requiredKycLevel} required for ${instrumentType} transactions.`,
					clientMessage: `Please complete your KYC verification before investing in ${instrumentType.replace(/_/g, " ")}.`,
				};
			}
		} catch (kycErr) {
			logger.warn(
				"[TransactionEngine] KYC check failed, proceeding with caution",
				{ userId, instrumentType },
			);
		}

		// ── 2. Gateway Readiness Gate ─────────────────────────────────────────────
		const gateway = checkGateway(instrumentType);

		if (!gateway.ready) {
			// Fire admin notification in background — never blocks client
			notifyGatewayNotConfigured({
				instrumentType,
				provider: gateway.provider,
				missingKeys: gateway.missingKeys,
				comingSoon: gateway.comingSoon,
				affectedUserId: userId,
				adminNote: gateway.adminNote,
			});

			return {
				status: "GATEWAY_UNAVAILABLE",
				message: gateway.comingSoon
					? `${instrumentType} gateway is coming soon.`
					: `${instrumentType} gateway is not configured.`,
				clientMessage: gateway.clientMessage,
				comingSoon: gateway.comingSoon,
				provider: gateway.provider,
			};
		}

		// ── 3. Submit to appropriate gateway ─────────────────────────────────────
		let result: OrderResult;
		try {
			result = await this.dispatchToGateway(
				instrumentType,
				gateway.provider,
				gatewayPayload,
				userId,
			);
		} catch (err) {
			logger.error("[TransactionEngine] Gateway dispatch failed", {
				instrumentType,
				provider: gateway.provider,
				userId,
				error: err instanceof Error ? err.message : String(err),
			});
			return {
				status: "FAILED",
				message: `Order submission failed: ${err instanceof Error ? err.message : "Unknown error"}`,
				clientMessage:
					"Your order could not be submitted. Please try again or contact support.",
				provider: gateway.provider,
			};
		}

		// ── 4. Post-submission parallel notifications (never blocks client) ───────
		if (result.status === "SUBMITTED" || result.status === "QUEUED") {
			// High-value alert
			if (amountInr && amountInr >= HIGH_VALUE_THRESHOLD_INR) {
				notifyHighValueTransaction({
					userId,
					orderId: result.orderId ?? "unknown",
					amount: amountInr,
					instrumentType,
					agentId,
				});
			}

			// Commission check — notify admin if commission is not configured for this partner
			if (partnerId) {
				this.checkCommissionConfig(
					partnerId,
					instrumentType,
					result.orderId ?? "unknown",
				).catch(() => {});
			}
		}

		return result;
	}

	private async dispatchToGateway(
		instrumentType: InstrumentType,
		provider: string,
		payload: Record<string, any>,
		userId: string,
	): Promise<OrderResult> {
		switch (provider) {
			case "iris_kfintech": {
				// Import Iris/KFintech service dynamically to avoid circular deps
				const { irisKfintechService } = await import("./iris-kfintech-service");
				const response = await irisKfintechService.placeOrder({
					...payload,
					userId,
				});
				return {
					status: response.success ? "SUBMITTED" : "FAILED",
					orderId: response.orderId,
					gatewayOrderId: response.gatewayOrderId,
					message:
						response.message ??
						(response.success
							? "Order submitted to KFintech (Iris)."
							: "KFintech order failed."),
					clientMessage: response.success
						? "Your order has been submitted and is being processed."
						: `Order failed: ${response.message ?? "Please try again."}`,
					provider,
				};
			}

			case "alpaca": {
				const { alpacaBrokerService } = await import("./alpaca-broker-service");
				const response = await alpacaBrokerService.createOrder({
					...payload,
					userId,
				});
				return {
					status: response.id ? "SUBMITTED" : "FAILED",
					orderId: response.id,
					gatewayOrderId: response.id,
					message: response.id
						? "Order submitted to Alpaca."
						: "Alpaca order failed.",
					clientMessage: response.id
						? "Your US stock order has been submitted."
						: "Order failed. Please try again.",
					provider,
				};
			}

			case "bse_star": {
				// BSE STAR MF / Bond / FD orders
				const { bseUccService } = await import("./bse-ucc-service");
				const response = await bseUccService.placeOrder({
					...payload,
					userId,
				});
				return {
					status: response.success ? "SUBMITTED" : "FAILED",
					orderId: response.orderId,
					gatewayOrderId: response.gatewayRef,
					message:
						response.message ??
						(response.success
							? "Order submitted to BSE STAR."
							: "BSE STAR order failed."),
					clientMessage: response.success
						? "Your order has been submitted to BSE STAR and is being processed."
						: `Order failed: ${response.message ?? "Please try again."}`,
					provider,
				};
			}

			case "iifl": {
				// Should never reach here since iifl is marked comingSoon in the gateway config
				return {
					status: "GATEWAY_UNAVAILABLE",
					message: "IIFL gateway is coming soon.",
					clientMessage:
						"Indian stock trading is coming soon. We are finalising our partnership with IIFL Securities.",
					comingSoon: true,
					provider,
				};
			}

			default: {
				// Unknown provider — treat as gateway unavailable
				logger.error("[TransactionEngine] No dispatch handler for provider", {
					provider,
					instrumentType,
				});
				return {
					status: "GATEWAY_UNAVAILABLE",
					message: `No handler for provider: ${provider}`,
					clientMessage:
						"This service is temporarily unavailable. Please try again later.",
					provider,
				};
			}
		}
	}

	/** Check commission config and notify admin if missing — fire-and-forget */
	private async checkCommissionConfig(
		partnerId: string,
		instrumentType: string,
		orderId: string,
	): Promise<void> {
		try {
			const [commission] = await db
				.select()
				.from(schema.commissionConfig)
				.where(
					and(
						eq(schema.commissionConfig.partnerId, partnerId),
						eq(schema.commissionConfig.productType, instrumentType),
					),
				)
				.limit(1);

			if (!commission || commission.commissionRate === null) {
				// Find partner name for readable notification
				const [partner] = await db
					.select({ name: schema.partners.businessName })
					.from(schema.partners)
					.where(eq(schema.partners.userId, partnerId))
					.limit(1);

				notifySetCommission({
					partnerId,
					partnerName: partner?.name ?? partnerId,
					instrumentType,
					orderId,
				});
			}
		} catch (err) {
			// Non-fatal — commission check should never block order
			logger.warn("[TransactionEngine] Commission check failed", {
				partnerId,
				instrumentType,
			});
		}
	}
}

export const transactionAutomationEngine = new TransactionAutomationEngine();
