import { logger } from "../../../logger";
import { db } from "../../../db";
import { users, alpacaOrders } from "../../../../shared/schema";
import { eq } from "drizzle-orm";
import { alpacaTradingEngine, OrderPayload } from "../core/alpacaTradingEngine";
import crypto from "crypto";

export class AlpacaCryptoService {
	/**
	 * Places a crypto order.
	 * Note: Crypto orders at Alpaca have specific rounding and asset class requirements.
	 */
	async placeCryptoOrder(
		userId: string,
		symbol: string,
		qty: number | null,
		notional: number | null,
		side: "buy" | "sell",
	) {
		logger.info(
			`[AlpacaCryptoService] User ${userId} requesting crypto order: ${side} ${symbol}`,
		);

		const userRecord = await db.query.users.findFirst({
			where: eq(users.id, userId),
		});

		if (!userRecord || !userRecord.alpacaAccountId) {
			throw new Error(`User does not have an active Alpaca Account mapped.`);
		}

		const alpacaAccountId = userRecord.alpacaAccountId;

		// 1. Prepare Order Payload
		const clientOrderId = `fp_cryp_${crypto.randomUUID()}`;
		const payload: any = {
			symbol,
			side,
			type: "market", // Crypto usually uses market orders for simplicity in this bridge
			time_in_force: "gtc",
			client_order_id: clientOrderId,
			asset_class: "crypto",
		};

		if (qty) payload.qty = qty;
		if (notional) payload.notional = notional;

		// 2. Audit Trail
		await db.insert(alpacaOrders).values({
			userId,
			alpacaAccountId,
			clientOrderId,
			providerOrderId: "PENDING",
			symbol,
			qty: qty ? qty.toString() : null,
			notional: notional ? notional.toString() : null,
			side,
			type: "market",
			timeInForce: "gtc",
			status: "pending_new",
		});

		try {
			const orderResult = await alpacaTradingEngine.dispatchOrder(
				alpacaAccountId,
				payload,
			);

			await db
				.update(alpacaOrders)
				.set({
					providerOrderId: orderResult.id,
					status: orderResult.status,
				})
				.where(eq(alpacaOrders.clientOrderId, clientOrderId));

			return orderResult;
		} catch (error: any) {
			logger.error(
				`[AlpacaCryptoService] Crypto order failed for user ${userId}`,
				error.response?.data || error.message,
			);

			await db
				.update(alpacaOrders)
				.set({ status: "rejected" })
				.where(eq(alpacaOrders.clientOrderId, clientOrderId));

			throw new Error(
				`Crypto Order Failed: ${error.response?.data?.message || error.message}`,
			);
		}
	}
}

export const alpacaCryptoService = new AlpacaCryptoService();
