import { alpacaClient } from "./alpacaClient";
import { logger } from "../../../logger";
import crypto from "crypto";

export interface OrderPayload {
	symbol: string;
	qty?: number;
	notional?: number;
	side: "buy" | "sell";
	type: "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";
	time_in_force: "day" | "gtc" | "opg" | "cls" | "ioc" | "fok";
	limit_price?: number;
	stop_price?: number;
	client_order_id?: string;
}

export class AlpacaTradingEngine {
	/**
	 * Dispatches an order to Alpaca Broker API with Idempotency.
	 */
	async dispatchOrder(alpacaAccountId: string, payload: OrderPayload) {
		try {
			// Ensure idempotency key (client_order_id) is set
			if (!payload.client_order_id) {
				payload.client_order_id = `fp_ord_${crypto.randomUUID()}`;
			}

			logger.info(
				`[AlpacaTradingEngine] Dispatching order for ${alpacaAccountId}: ${payload.side} ${payload.symbol}`,
			);

			const orderResult = await alpacaClient.placeOrder(
				alpacaAccountId,
				payload,
			);
			return orderResult;
		} catch (error: any) {
			logger.error(
				`[AlpacaTradingEngine] Order failed for ${alpacaAccountId}`,
				error.response?.data || error.message,
			);
			throw new Error(
				`Alpaca Order Failed: ${error.response?.data?.message || error.message}`,
			);
		}
	}

	async getOpenOrders(alpacaAccountId: string) {
		return alpacaClient.getOrders(alpacaAccountId, { status: "open" });
	}

	async cancelOrder(alpacaAccountId: string, orderId: string) {
		return alpacaClient.call(
			`/trading/accounts/${alpacaAccountId}/orders/${orderId}`,
			"DELETE",
		);
	}
}

export const alpacaTradingEngine = new AlpacaTradingEngine();
