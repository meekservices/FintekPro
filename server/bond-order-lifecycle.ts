import { db } from "./db";
import {
	bondOrders,
	fixedIncomeSettlements,
	bondHoldings,
} from "@shared/schema";
import { eq, and, lte } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Bond Order Lifecycle Management
 * Tracks orders through: Placed → Processing → Settlement → Allotted → Credited
 */

export type OrderLifecycleStatus =
	| "placed" // Order received
	| "processing" // Payment being verified
	| "confirmed" // Payment confirmed, awaiting settlement
	| "settlement" // T+1/T+2 settlement in progress
	| "allotted" // Units allotted by exchange
	| "credited" // Credited to demat account
	| "failed" // Order failed
	| "cancelled"; // Order cancelled

export interface OrderLifecycleEvent {
	status: OrderLifecycleStatus;
	timestamp: Date;
	message: string;
	details?: any;
}

export interface SettlementInfo {
	settlementCycle: "T+0" | "T+1" | "T+2";
	expectedSettlementDate: Date;
	depository: "NSDL" | "CDSL";
	dpId?: string;
	clientId?: string;
}

/**
 * Calculate expected settlement date based on settlement cycle
 */
export function calculateSettlementDate(
	orderDate: Date,
	cycle: "T+0" | "T+1" | "T+2",
): Date {
	const days = cycle === "T+0" ? 0 : cycle === "T+1" ? 1 : 2;
	const settlementDate = new Date(orderDate);

	// Add business days (skip weekends)
	let addedDays = 0;
	while (addedDays < days) {
		settlementDate.setDate(settlementDate.getDate() + 1);
		const dayOfWeek = settlementDate.getDay();
		if (dayOfWeek !== 0 && dayOfWeek !== 6) {
			addedDays++;
		}
	}

	return settlementDate;
}

/**
 * Get settlement cycle based on bond type
 */
export function getSettlementCycle(bondType: string): "T+0" | "T+1" | "T+2" {
	switch (bondType) {
		case "g_sec":
		case "treasury":
		case "t_bill":
			return "T+1"; // Government securities settle T+1
		case "corporate":
		case "ncd":
			return "T+2"; // Corporate bonds settle T+2
		case "sgb":
			return "T+2"; // Sovereign Gold Bonds T+2
		case "sdl":
			return "T+1"; // State Development Loans T+1
		case "tax_free":
			return "T+2"; // Tax-free bonds T+2
		default:
			return "T+2"; // Default to T+2
	}
}

/**
 * Create order and initiate lifecycle
 */
export async function createBondOrder(params: {
	userId: string;
	isin: string;
	bondName: string;
	bondType: string;
	quantity: number;
	faceValue: number;
	pricePerUnit: number;
	totalAmount: number;
	paymentMethod: string;
	depository?: "NSDL" | "CDSL";
	dpId?: string;
	clientId?: string;
	dematAccountNumber?: string;
}): Promise<{ orderId: string; settlementInfo: SettlementInfo }> {
	const orderNumber = `BO-${nanoid(12)}`;
	const orderDate = new Date();
	const settlementCycle = getSettlementCycle(params.bondType);
	const expectedSettlementDate = calculateSettlementDate(
		orderDate,
		settlementCycle,
	);
	const settlementDateStr = expectedSettlementDate.toISOString().split("T")[0];
	const tradeDateStr = orderDate.toISOString().split("T")[0];

	// Create order record using actual schema columns
	const [order] = await db
		.insert(bondOrders)
		.values({
			orderNumber,
			userId: params.userId,
			isin: params.isin,
			bondName: params.bondName,
			bondType: params.bondType,
			orderType: "buy",
			orderCategory: "market",
			quantity: params.quantity,
			faceValue: params.faceValue.toString(),
			totalFaceValue: (params.faceValue * params.quantity).toString(),
			orderPrice: params.pricePerUnit.toString(),
			grossAmount: params.totalAmount.toString(),
			netAmount: params.totalAmount.toString(),
			orderStatus: "pending",
			paymentStatus: "pending",
			paymentMethod: params.paymentMethod,
			dematAccountNumber: params.dematAccountNumber || null,
			orderDate: orderDate,
			settlementDate: settlementDateStr,
		})
		.returning();

	// Create settlement tracking record
	await db.insert(fixedIncomeSettlements).values({
		userId: params.userId,
		orderId: order.id,
		isin: params.isin,
		securityName: params.bondName,
		settlementType: "regular",
		settlementCycle: settlementCycle,
		quantity: params.quantity,
		settlementValue: params.totalAmount.toString(),
		depository: (params.depository || "nsdl").toLowerCase(),
		dpId: params.dpId || "",
		clientId: params.clientId || "",
		dematAccountNumber: params.dematAccountNumber || "",
		tradeDate: tradeDateStr,
		expectedSettlementDate: settlementDateStr,
		settlementStatus: "pending",
	});

	console.log(
		`[Bond Order] Created order ${orderNumber} - Settlement ${settlementCycle} expected on ${settlementDateStr}`,
	);

	return {
		orderId: order.id,
		settlementInfo: {
			settlementCycle,
			expectedSettlementDate,
			depository: params.depository || "NSDL",
			dpId: params.dpId,
			clientId: params.clientId,
		},
	};
}

/**
 * Update order status with lifecycle event
 */
export async function updateOrderStatus(
	orderId: string,
	status: OrderLifecycleStatus,
	message: string,
	details?: any,
): Promise<void> {
	const now = new Date();

	await db
		.update(bondOrders)
		.set({
			orderStatus: status,
			lastUpdated: now,
		})
		.where(eq(bondOrders.id, orderId));

	console.log(
		`[Bond Order] ${orderId} status updated to: ${status} - ${message}`,
	);
}

/**
 * Process payment confirmation and move to settlement
 */
export async function confirmPayment(
	orderId: string,
	paymentReference: string,
): Promise<void> {
	await updateOrderStatus(
		orderId,
		"confirmed",
		"Payment confirmed, awaiting settlement",
		{
			paymentReference,
			confirmedAt: new Date(),
		},
	);

	// Update settlement record
	await db
		.update(fixedIncomeSettlements)
		.set({
			settlementStatus: "processing",
			updatedAt: new Date(),
		})
		.where(eq(fixedIncomeSettlements.orderId, orderId));
}

/**
 * Process settlement completion - allot units
 */
export async function processAllotment(
	orderId: string,
	allotmentDetails: {
		allotmentNumber?: string;
		allottedQuantity: number;
		allotmentPrice: number;
	},
): Promise<void> {
	await updateOrderStatus(orderId, "allotted", "Units allotted by exchange", {
		...allotmentDetails,
		allottedAt: new Date(),
	});

	// Update settlement record status
	await db
		.update(fixedIncomeSettlements)
		.set({
			settlementStatus: "in_transit",
			updatedAt: new Date(),
		})
		.where(eq(fixedIncomeSettlements.orderId, orderId));
}

/**
 * Credit units to demat account
 */
export async function creditToDemat(
	orderId: string,
	creditDetails: {
		transactionId: string;
		creditedQuantity: number;
		dematAccountNumber: string;
		depositoryReference: string;
	},
): Promise<void> {
	await updateOrderStatus(
		orderId,
		"credited",
		"Units credited to Demat account",
		{
			...creditDetails,
			creditedAt: new Date(),
		},
	);

	const now = new Date();
	const settlementDateStr = now.toISOString().split("T")[0];

	// Update settlement record
	await db
		.update(fixedIncomeSettlements)
		.set({
			settlementStatus: "credited",
			actualSettlementDate: settlementDateStr,
			depositoryTransactionId: creditDetails.transactionId,
			depositoryRefNumber: creditDetails.depositoryReference,
			updatedAt: now,
		})
		.where(eq(fixedIncomeSettlements.orderId, orderId));

	// Create/update holding record
	const [order] = await db
		.select()
		.from(bondOrders)
		.where(eq(bondOrders.id, orderId));
	if (order) {
		const purchaseDateStr = order.orderDate
			? new Date(order.orderDate).toISOString().split("T")[0]
			: now.toISOString().split("T")[0];
		const maturityDateStr =
			order.settlementDate ||
			new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];

		await db.insert(bondHoldings).values({
			userId: order.userId,
			isin: order.isin,
			bondName: order.bondName || "",
			bondType: order.bondType || "corporate",
			issuer: "Unknown", // Will be updated from bond catalog
			quantity: creditDetails.creditedQuantity,
			faceValue: order.faceValue || "1000",
			totalFaceValue: order.totalFaceValue || "1000",
			purchaseDate: purchaseDateStr,
			purchasePrice: order.orderPrice || "0",
			totalInvestedAmount: order.netAmount || "0",
			maturityDate: maturityDateStr,
			dematAccountNumber: creditDetails.dematAccountNumber,
			holdingStatus: "active",
		});

		console.log(`[Bond Order] Created holding for order ${orderId}`);
	}
}

/**
 * Get order lifecycle history
 */
export async function getOrderLifecycle(orderId: string): Promise<{
	order: any;
	settlement: any;
	timeline: OrderLifecycleEvent[];
}> {
	const [order] = await db
		.select()
		.from(bondOrders)
		.where(eq(bondOrders.id, orderId));
	const [settlement] = await db
		.select()
		.from(fixedIncomeSettlements)
		.where(eq(fixedIncomeSettlements.orderId, orderId));

	// Build timeline from status
	const timeline: OrderLifecycleEvent[] = [];

	if (order) {
		timeline.push({
			status: "placed",
			timestamp: order.createdAt || new Date(),
			message: "Order placed successfully",
		});

		if (
			order.orderStatus === "confirmed" ||
			order.orderStatus === "settlement" ||
			order.orderStatus === "allotted" ||
			order.orderStatus === "credited"
		) {
			timeline.push({
				status: "confirmed",
				timestamp: order.lastUpdated || new Date(),
				message: "Payment confirmed",
			});
		}

		if (
			order.orderStatus === "settlement" ||
			order.orderStatus === "allotted" ||
			order.orderStatus === "credited"
		) {
			timeline.push({
				status: "settlement",
				timestamp: order.lastUpdated || new Date(),
				message: `Settlement in progress (${settlement?.settlementCycle || "T+2"})`,
			});
		}

		if (order.orderStatus === "allotted" || order.orderStatus === "credited") {
			timeline.push({
				status: "allotted",
				timestamp: order.lastUpdated || new Date(),
				message: "Units allotted by exchange",
			});
		}

		if (order.orderStatus === "credited") {
			timeline.push({
				status: "credited",
				timestamp: order.lastUpdated || new Date(),
				message: "Credited to Demat account",
			});
		}
	}

	return { order, settlement, timeline };
}

/**
 * Cron job: Process pending settlements (run every hour)
 */
export async function processSettlements(): Promise<void> {
	const todayStr = new Date().toISOString().split("T")[0];

	// Find settlements due today or overdue (compare as strings since dates are stored as strings)
	const pendingSettlements = await db
		.select()
		.from(fixedIncomeSettlements)
		.where(
			and(
				eq(fixedIncomeSettlements.settlementStatus, "processing"),
				lte(fixedIncomeSettlements.expectedSettlementDate, todayStr),
			),
		);

	console.log(
		`[Settlement Cron] Processing ${pendingSettlements.length} pending settlements`,
	);

	for (const settlement of pendingSettlements) {
		try {
			const quantity = settlement.quantity || 0;
			const settlementValue = Number.parseFloat(
				settlement.settlementValue || "0",
			);
			const pricePerUnit = quantity > 0 ? settlementValue / quantity : 0;

			// Simulate allotment (in production, this would call exchange API)
			await processAllotment(settlement.orderId, {
				allottedQuantity: quantity,
				allotmentPrice: pricePerUnit,
			});

			// Simulate demat credit (in production, this would call depository API)
			await creditToDemat(settlement.orderId, {
				transactionId: `DEP-${nanoid(10)}`,
				creditedQuantity: quantity,
				dematAccountNumber: settlement.dematAccountNumber || "AUTO",
				depositoryReference: `${settlement.depository}-${nanoid(8)}`,
			});

			console.log(
				`[Settlement Cron] Completed settlement for order ${settlement.orderId}`,
			);
		} catch (error) {
			console.error(
				`[Settlement Cron] Error processing settlement ${settlement.id}:`,
				error,
			);
		}
	}
}
