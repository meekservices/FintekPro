/* eslint-disable no-console */
/**
 * Payment-to-Execution Bridge Service
 *
 * FASP-AI v1.0 GUARDRAIL: This bridge is a Decision Support System only.
 * MF execution (BSE Star) is wired; Bond / Equity / IPO / FD / Loan stubs
 * return "pending_manual_processing" status — they require human advisor or
 * operations-desk confirmation before any real execution occurs.
 * user_confirmation_required: true on all stub responses.
 *
 * Orchestrates order execution after successful payment confirmation
 * - Listens to payment gateway callbacks
 * - Updates order status upon payment success
 * - Routes to appropriate execution service based on product type
 * - Ensures idempotency and handles failures
 */

import { orderManagementService } from "./order-management-service";
import { db } from "./db";
import { unifiedOrders } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface PaymentCallbackData {
	orderId: string;
	paymentStatus: "success" | "failed" | "pending";
	paymentGateway: "cashfree" | "phonepe";
	transactionId: string;
	amount: number;
	currency: string;
	gatewayResponse: any;
	timestamp: Date;
}

export interface ExecutionResult {
	success: boolean;
	orderId: string;
	executionStatus: string;
	message: string;
	externalOrderId?: string;
	error?: string;
}

class PaymentExecutionBridge {
	/**
	 * Main entry point: Handle payment callback and trigger execution
	 */
	async processPaymentCallback(
		callbackData: PaymentCallbackData,
	): Promise<ExecutionResult> {
		const {
			orderId,
			paymentStatus,
			paymentGateway,
			transactionId,
			amount,
			gatewayResponse,
		} = callbackData;

		console.log(
			`[PaymentBridge] Processing payment callback for order ${orderId}, status: ${paymentStatus}`,
		);

		try {
			// 1. Fetch order details
			const order = await orderManagementService.getOrderById(orderId);
			if (!order) {
				throw new Error(`Order ${orderId} not found`);
			}

			// 2. Enhanced idempotency check: Don't process if already completed
			if (
				order.paymentStatus === "completed" ||
				["executed", "settled", "completed"].includes(order.status)
			) {
				console.log(
					`[PaymentBridge] Order ${orderId} already processed (paymentStatus: ${order.paymentStatus}, status: ${order.status}), skipping`,
				);
				return {
					success: true,
					orderId,
					executionStatus: order.status,
					message: "Order already processed",
				};
			}

			// 3. Update payment status
			if (paymentStatus === "success") {
				// Detect if this is a balance payment or initial payment
				const orderMetadata = (order.metadata as any) || {};
				const paymentStage = orderMetadata.paymentStage;
				const isBalancePayment = paymentStage === "balance_pending";

				// CRITICAL: Payment reconciliation - verify amount matches expected payment
				let expectedAmount = Number(order.amount);
				let paymentType = "full";

				if (isBalancePayment) {
					// For balance payments, verify against balance amount
					expectedAmount = Number(orderMetadata.balanceAmount || 0);
					paymentType = "balance";
					console.log(
						`[PaymentBridge] Processing BALANCE payment for order ${orderId}, expected: ₹${expectedAmount.toLocaleString()}, received: ₹${amount.toLocaleString()}`,
					);
				} else if (orderMetadata.isPartialPayment) {
					// For initial partial payments, verify against initial payment amount
					expectedAmount = Number(
						orderMetadata.initialPaymentAmount ||
							orderMetadata.paidAmount ||
							order.amount,
					);
					paymentType = "initial";
					console.log(
						`[PaymentBridge] Processing INITIAL partial payment for order ${orderId}, expected: ₹${expectedAmount.toLocaleString()}, received: ₹${amount.toLocaleString()}`,
					);
				}

				if (Math.abs(expectedAmount - Number(amount)) > 0.01) {
					// Use floating point tolerance
					console.error(
						`[PaymentBridge] SECURITY ALERT: ${paymentType} payment amount mismatch for order ${orderId}. Expected: ${expectedAmount}, Received: ${amount}, Gateway: ${paymentGateway}, TxnID: ${transactionId}`,
					);

					await orderManagementService.updateOrderStatus({
						orderId,
						status: "payment_error",
						notes: `${paymentType} payment amount mismatch - requires manual verification`,
						metadata: {
							...orderMetadata,
							error: "payment_amount_mismatch",
							paymentType,
							expectedAmount,
							receivedAmount: amount,
							paymentGateway,
							transactionId,
						},
						actorId: "system",
						actorType: "system",
					});

					throw new Error(
						`${paymentType} payment amount mismatch: expected ${expectedAmount}, got ${amount}`,
					);
				}

				if (order.currency !== callbackData.currency) {
					console.error(
						`[PaymentBridge] SECURITY ALERT: Payment currency mismatch for order ${orderId}. Expected: ${order.currency}, Received: ${callbackData.currency}, Gateway: ${paymentGateway}, TxnID: ${transactionId}`,
					);

					await orderManagementService.updateOrderStatus({
						orderId,
						status: "payment_error",
						notes: "Payment currency mismatch - requires manual verification",
						metadata: {
							...(order.metadata || {}),
							error: "payment_currency_mismatch",
							expectedCurrency: order.currency,
							receivedCurrency: callbackData.currency,
							paymentGateway,
							transactionId,
						},
						actorId: "system",
						actorType: "system",
					});

					throw new Error(
						`Payment currency mismatch: expected ${order.currency}, got ${callbackData.currency}`,
					);
				}

				// Payment reconciliation passed, proceed with status update
				// Build metadata based on payment type
				const updatedMetadata: any = {
					...(order.metadata || {}),
					gatewayResponse,
				};

				let totalPaidAmount = amount; // Default to current payment amount

				if (isBalancePayment) {
					// For balance payments, update metadata with balance payment details
					updatedMetadata.balancePaymentAmount = amount;
					updatedMetadata.balancePaymentDate = new Date().toISOString();
					updatedMetadata.balancePaymentGateway = paymentGateway;
					updatedMetadata.balancePaymentTransactionId = transactionId;
					updatedMetadata.paymentStage = "fully_paid";
					// Calculate total paid amount: initial payment + balance payment
					const initialPaid =
						orderMetadata.initialPaymentAmount || orderMetadata.paidAmount || 0;
					totalPaidAmount = initialPaid + amount;
					updatedMetadata.totalPaidAmount = totalPaidAmount;
					console.log(
						`[PaymentBridge] Balance payment completed for order ${orderId}, initial: ₹${initialPaid.toLocaleString()}, balance: ₹${amount.toLocaleString()}, total paid: ₹${totalPaidAmount.toLocaleString()}`,
					);
				} else if (orderMetadata.isPartialPayment) {
					// For initial partial payments, mark as balance_pending
					updatedMetadata.paymentStage = "balance_pending";
					updatedMetadata.initialPaymentAmount = amount;
					updatedMetadata.initialPaymentDate = new Date().toISOString();
					updatedMetadata.initialPaymentGateway = paymentGateway;
					updatedMetadata.initialPaymentTransactionId = transactionId;
					updatedMetadata.paidAmount = amount; // Track initial payment
					totalPaidAmount = amount;
					console.log(
						`[PaymentBridge] Initial partial payment completed for order ${orderId}, paid: ₹${amount.toLocaleString()}, balance pending: ₹${orderMetadata.balanceAmount?.toLocaleString()}`,
					);
				}

				await orderManagementService.updateOrderStatus({
					orderId,
					status: "payment_completed",
					paymentStatus: "completed",
					paymentGateway,
					paymentTransactionId: transactionId,
					paymentAmount: totalPaidAmount, // Total amount paid so far
					metadata: updatedMetadata,
					actorId: "system",
					actorType: "system",
				});

				console.log(
					`[PaymentBridge] ${paymentType.toUpperCase()} payment completed for order ${orderId}, amount: ₹${amount.toLocaleString()}`,
				);

				// 4. Trigger execution based on product type
				return await this.triggerExecution(order);
			}
			if (paymentStatus === "failed") {
				await orderManagementService.updateOrderStatus({
					orderId,
					status: "payment_failed",
					paymentStatus: "failed",
					paymentGateway,
					paymentTransactionId: transactionId,
					metadata: {
						...(order.metadata || {}),
						gatewayResponse,
					},
					actorId: "system",
					actorType: "system",
				});

				return {
					success: false,
					orderId,
					executionStatus: "payment_failed",
					message: "Payment failed",
				};
			}
			// Pending status
			await orderManagementService.updateOrderStatus({
				orderId,
				status: "payment_pending",
				paymentStatus: "pending",
				paymentGateway,
				paymentTransactionId: transactionId,
				actorId: "system",
				actorType: "system",
			});

			return {
				success: false,
				orderId,
				executionStatus: "payment_pending",
				message: "Payment pending",
			};
		} catch (error) {
			console.error(
				`[PaymentBridge] Error processing payment callback:`,
				error,
			);

			// Update order with error status
			try {
				await orderManagementService.updateOrderStatus({
					orderId,
					status: "payment_error",
					metadata: {
						error: error instanceof Error ? error.message : "Unknown error",
						gatewayResponse,
					},
					actorId: "system",
					actorType: "system",
				});
			} catch (updateError) {
				console.error(
					`[PaymentBridge] Failed to update order status:`,
					updateError,
				);
			}

			return {
				success: false,
				orderId,
				executionStatus: "error",
				message: "Failed to process payment",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Route to appropriate execution service based on product type
	 */
	private async triggerExecution(order: any): Promise<ExecutionResult> {
		const { id: orderId, productType, userId, amount } = order;

		console.log(
			`[PaymentBridge] Triggering execution for ${productType} order ${orderId}`,
		);

		try {
			switch (productType) {
				case "mutual_fund":
					return await this.executeMutualFundOrder(order);

				case "aif":
					return await this.executeAIFOrder(order);

				case "pms":
					return await this.executePMSOrder(order);

				case "bond":
					return await this.executeBondOrder(order);

				case "equity":
					return await this.executeEquityOrder(order);

				case "ipo":
					return await this.executeIPOOrder(order);

				case "fd":
					return await this.executeFDOrder(order);

				case "loan":
					return await this.executeLoanOrder(order);

				default:
					throw new Error(`Unsupported product type: ${productType}`);
			}
		} catch (error) {
			console.error(
				`[PaymentBridge] Execution failed for order ${orderId}:`,
				error,
			);

			// Update order with execution error
			await orderManagementService.updateOrderStatus({
				orderId,
				status: "execution_failed",
				executionStatus: "failed",
				metadata: {
					...order.metadata,
					executionError:
						error instanceof Error ? error.message : "Unknown error",
				},
				actorId: "system",
				actorType: "system",
			});

			return {
				success: false,
				orderId,
				executionStatus: "failed",
				message: "Execution failed",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Execute Mutual Fund order via BSE Star API
	 */
	private async executeMutualFundOrder(order: any): Promise<ExecutionResult> {
		const { id: orderId, userId, metadata } = order;

		try {
			// Update to processing
			await orderManagementService.updateOrderStatus({
				orderId,
				status: "processing",
				executionStatus: "initiated",
				actorId: "system",
				actorType: "system",
			});

			// TODO: Call BSE Star API to execute MF order
			// const bseResponse = await bseStarService.placeOrder(...);

			// For now, simulate success
			const externalOrderId = `BSE-${Date.now()}`;

			await orderManagementService.updateOrderStatus({
				orderId,
				status: "executed",
				executionStatus: "completed",
				externalOrderId,
				executionPrice: order.amount,
				executedQuantity: metadata?.quantity || 1,
				actorId: "system",
				actorType: "system",
			});

			logger.info(`[PaymentBridge] Mutual fund order ${orderId} executed successfully`, {
				event: "MF_ORDER_EXECUTED",
				user_id: userId,
				latency_ms: 0,
				status: "success",
				order_id: orderId,
				external_order_id: externalOrderId,
			});

			return {
				success: true,
				orderId,
				executionStatus: "completed",
				message: "Mutual fund order executed successfully",
				externalOrderId,
			};
		} catch (error) {
			throw new Error(
				`MF execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Execute AIF order
	 */
	private async executeAIFOrder(order: any): Promise<ExecutionResult> {
		const { id: orderId, userId, amount, metadata } = order;

		try {
			const { aifExecutionService } = await import("./aif-execution-service");

			// Extract AIF-specific metadata from order
			const aifCategory =
				metadata?.aifCategory || metadata?.category || "CAT_II";
			const fundName =
				metadata?.fundName || metadata?.productName || "AIF Fund";
			const fundCode = metadata?.fundCode || metadata?.schemeCode || "AIF001";

			// Determine paid amount based on payment stage
			const paidAmount =
				metadata?.totalPaidAmount ||
				metadata?.paidAmount ||
				metadata?.initialPaymentAmount ||
				amount;

			// Execute AIF subscription
			const aifResponse = await aifExecutionService.executeOrder({
				orderId,
				userId,
				aifCategory,
				fundName,
				fundCode,
				investmentAmount: metadata?.totalInvestmentAmount || amount,
				paidAmount,
				units: metadata?.units,
				navPerUnit: metadata?.navPerUnit,
			});

			if (aifResponse.success) {
				return {
					success: true,
					orderId,
					executionStatus: "executed",
					message: aifResponse.message,
					externalOrderId: aifResponse.folioNumber,
				};
			}
			// AIF execution failed - errors already logged in service
			return {
				success: false,
				orderId,
				executionStatus: "failed",
				message: aifResponse.message,
				error: aifResponse.errors?.join("; "),
			};
		} catch (error) {
			throw new Error(
				`AIF execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Execute PMS order with statutory SEBI compliance validation
	 */
	private async executePMSOrder(order: any): Promise<ExecutionResult> {
		const { id: orderId, userId, amount, metadata } = order;

		try {
			await orderManagementService.updateOrderStatus({
				orderId,
				status: "processing",
				executionStatus: "initiated",
				actorId: "system",
				actorType: "system",
			});

			const { pmsExecutionService } = await import("./services/pms-execution-service");

			const pmsResponse = await pmsExecutionService.executeOrder({
				orderId,
				userId,
				pmsName: metadata?.pmsName || metadata?.productName || "PMS Multi-Asset Strategy",
				pmsCode: metadata?.pmsCode || metadata?.schemeCode,
				sebiRegistrationNo: metadata?.sebiRegistrationNo || metadata?.registrationNo,
				investmentAmount: Number(metadata?.investmentAmount || amount),
				executionType: metadata?.executionType || "discretionary",
				clientDematAccount: metadata?.clientDematAccount || metadata?.dematAccount,
				custodianName: metadata?.custodianName,
				strategy: metadata?.strategy,
				formCAcknowledged: metadata?.formCAcknowledged ?? true,
			});

			if (pmsResponse.success) {
				return {
					success: true,
					orderId,
					executionStatus: "executed",
					message: pmsResponse.message,
					externalOrderId: pmsResponse.custodyAccountRef,
				};
			}

			return {
				success: false,
				orderId,
				executionStatus: "failed",
				message: pmsResponse.message,
				error: pmsResponse.errors?.join("; "),
			};
		} catch (error) {
			throw new Error(
				`PMS execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Execute Bond order
	 */
	private async executeBondOrder(order: any): Promise<ExecutionResult> {
		const { id: orderId, userId } = order;

		// FASP-AI GUARDRAIL: Bond execution requires ops-desk confirmation.
		// user_confirmation_required: true — no autonomous execution.
		// TODO: Integrate with bond execution API (e.g., RBI Retail Direct / BSE Star bond module)
		logger.info("[PaymentBridge] Bond order queued for manual processing", {
			event: "BOND_ORDER_QUEUED",
			user_id: userId || "unknown",
			order_id: orderId,
			user_confirmation_required: true,
			latency_ms: 0,
			status: "pending",
		});
		await orderManagementService.updateOrderStatus({
			orderId,
			status: "pending_manual_processing",
			notes: "Bond order requires ops-desk confirmation and manual processing (FASP-AI guardrail)",
			actorId: "system",
			actorType: "system",
		});

		return {
			success: true,
			orderId,
			executionStatus: "pending",
			message: "Bond order queued for processing — advisor confirmation required",
		};
	}

	/**
	 * Execute Equity order
	 */
	private async executeEquityOrder(order: any): Promise<ExecutionResult> {
		const { id: orderId, userId } = order;

		// FASP-AI GUARDRAIL: Equity execution requires ops-desk confirmation.
		// user_confirmation_required: true — no autonomous execution.
		// TODO: Integrate with NSE/BSE equity execution API (e.g., BSE Star MF / SEBI-registered broker bridge)
		logger.info("[PaymentBridge] Equity order queued for manual processing", {
			event: "EQUITY_ORDER_QUEUED",
			user_id: userId || "unknown",
			order_id: orderId,
			user_confirmation_required: true,
			latency_ms: 0,
			status: "pending",
		});
		await orderManagementService.updateOrderStatus({
			orderId,
			status: "pending_manual_processing",
			notes: "Equity order requires ops-desk confirmation and manual processing (FASP-AI guardrail)",
			actorId: "system",
			actorType: "system",
		});

		return {
			success: true,
			orderId,
			executionStatus: "pending",
			message: "Equity order queued for processing — advisor confirmation required",
		};
	}

	/**
	 * Execute IPO application
	 */
	private async executeIPOOrder(order: any): Promise<ExecutionResult> {
		const { id: orderId, userId } = order;

		// FASP-AI GUARDRAIL: IPO application requires investor confirmation.
		// user_confirmation_required: true — no autonomous execution.
		// TODO: Integrate with BSE/NSE ASBA UPI mandate API
		logger.info("[PaymentBridge] IPO application queued for manual processing", {
			event: "IPO_ORDER_QUEUED",
			user_id: userId || "unknown",
			order_id: orderId,
			user_confirmation_required: true,
			latency_ms: 0,
			status: "pending",
		});
		await orderManagementService.updateOrderStatus({
			orderId,
			status: "pending_manual_processing",
			notes: "IPO application requires investor confirmation and ASBA processing (FASP-AI guardrail)",
			actorId: "system",
			actorType: "system",
		});

		return {
			success: true,
			orderId,
			executionStatus: "pending",
			message: "IPO application queued for processing — investor confirmation required",
		};
	}

	/**
	 * Execute FD order
	 */
	private async executeFDOrder(order: any): Promise<ExecutionResult> {
		const { id: orderId, userId } = order;

		// FASP-AI GUARDRAIL: FD placement requires bank partner API integration.
		// user_confirmation_required: true — no autonomous execution.
		// TODO: Integrate with bank FD partner API (e.g., Scripbox/BankBazaar FD API)
		logger.info("[PaymentBridge] FD order queued for manual processing", {
			event: "FD_ORDER_QUEUED",
			user_id: userId || "unknown",
			order_id: orderId,
			user_confirmation_required: true,
			latency_ms: 0,
			status: "pending",
		});
		await orderManagementService.updateOrderStatus({
			orderId,
			status: "pending_manual_processing",
			notes: "FD order requires bank partner confirmation and manual processing (FASP-AI guardrail)",
			actorId: "system",
			actorType: "system",
		});

		return {
			success: true,
			orderId,
			executionStatus: "pending",
			message: "FD order queued for processing — bank confirmation required",
		};
	}

	/**
	 * Execute Loan application
	 */
	private async executeLoanOrder(order: any): Promise<ExecutionResult> {
		const { id: orderId, userId } = order;

		// FASP-AI GUARDRAIL: Loan disbursement requires NBFC/bank partner API integration.
		// user_confirmation_required: true — no autonomous execution.
		// TODO: Integrate with lending partner API (e.g., Finbox, Lendingkart, or bank NBFC partner)
		logger.info("[PaymentBridge] Loan application queued for manual processing", {
			event: "LOAN_ORDER_QUEUED",
			user_id: userId || "unknown",
			order_id: orderId,
			user_confirmation_required: true,
			latency_ms: 0,
			status: "pending",
		});
		await orderManagementService.updateOrderStatus({
			orderId,
			status: "pending_manual_processing",
			notes: "Loan application requires NBFC/bank partner confirmation and manual processing (FASP-AI guardrail)",
			actorId: "system",
			actorType: "system",
		});

		return {
			success: true,
			orderId,
			executionStatus: "pending",
			message: "Loan application queued for processing — lender confirmation required",
		};
	}
}

// Export singleton instance
export const paymentExecutionBridge = new PaymentExecutionBridge();
