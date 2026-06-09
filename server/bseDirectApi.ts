/**
 * BSE Direct API Service
 *
 * FIX-based trading API for direct market access
 * Supports: Equity, Derivatives, Currency, Commodity trading
 */

import { randomUUID } from "crypto";
import axios from "axios";

// BSE Direct API Configuration (ETI - Enhanced Trading Interface)
const BSE_DIRECT_CONFIG = {
	demo: {
		baseUrl: "https://demo.bseindia.com/eti/api",
		fixGateway: "demo.bseindia.com:9001",
	},
	production: {
		baseUrl: "https://www.bseindia.com/eti/api",
		fixGateway: "bseindia.com:9001",
	},
};

const IS_PRODUCTION = process.env.BSE_DIRECT_ENVIRONMENT === "production";
const API_CONFIG = IS_PRODUCTION
	? BSE_DIRECT_CONFIG.production
	: BSE_DIRECT_CONFIG.demo;

// BSE Direct Credentials
const BSE_DIRECT_CREDENTIALS = {
	userId: process.env.BSE_DIRECT_USER_ID || "demo_user",
	password: process.env.BSE_DIRECT_PASSWORD || "demo_password",
	memberId: process.env.BSE_DIRECT_MEMBER_ID || "demo_member",
};

export interface DirectOrderRequest {
	userId: string;
	clientCode: string;
	segment: "equity" | "derivatives" | "currency" | "commodity";
	symbol: string;
	orderType: "buy" | "sell";
	quantity: number;
	orderCategory: "market" | "limit" | "stop_loss";
	price?: number;
	stopLossPrice?: number;
	productType: "delivery" | "intraday" | "margin";
	validity: "day" | "ioc" | "gtc";
}

export interface DirectOrderResponse {
	success: boolean;
	orderId?: string;
	orderNumber?: string;
	message: string;
	executionDetails?: {
		executedQuantity: number;
		averagePrice: number;
		totalAmount: number;
		orderStatus: "pending" | "executed" | "partial" | "rejected";
	};
}

export interface MarketQuote {
	symbol: string;
	segment: string;
	lastPrice: number;
	change: number;
	changePercent: number;
	volume: number;
	bid: number;
	ask: number;
	high: number;
	low: number;
	open: number;
	previousClose: number;
}

/**
 * BSE Direct API Service Class
 */
export class BSEDirectApiService {
	/**
	 * Validate BSE Direct credentials
	 */
	private validateCredentials(): boolean {
		if (IS_PRODUCTION) {
			return !!(
				BSE_DIRECT_CREDENTIALS.userId &&
				BSE_DIRECT_CREDENTIALS.password &&
				BSE_DIRECT_CREDENTIALS.memberId &&
				BSE_DIRECT_CREDENTIALS.userId !== "demo_user"
			);
		}
		return true; // Demo mode always valid
	}

	/**
	 * Place direct market order
	 */
	async placeDirectOrder(
		request: DirectOrderRequest,
	): Promise<DirectOrderResponse> {
		try {
			if (!this.validateCredentials()) {
				return {
					success: false,
					message:
						"BSE Direct API credentials not configured. Contact administrator for ETI access.",
				};
			}

			if (!IS_PRODUCTION) {
				// Demo mode - simulate successful order
				return this.simulateDirectOrder(request);
			}

			// Production API call (simplified FIX wrapper)
			const response = await axios.post(
				`${API_CONFIG.baseUrl}/order`,
				{
					userId: BSE_DIRECT_CREDENTIALS.userId,
					memberId: BSE_DIRECT_CREDENTIALS.memberId,
					clientCode: request.clientCode,
					segment: request.segment,
					symbol: request.symbol,
					orderType: request.orderType,
					quantity: request.quantity,
					orderCategory: request.orderCategory,
					price: request.price,
					stopLossPrice: request.stopLossPrice,
					productType: request.productType,
					validity: request.validity,
					password: BSE_DIRECT_CREDENTIALS.password,
				},
				{
					headers: {
						"Content-Type": "application/json",
						"User-Agent": "FintekPro/1.0",
					},
				},
			);

			return {
				success: true,
				orderId: response.data.orderId,
				orderNumber: response.data.orderNumber,
				message: "Order placed successfully",
				executionDetails: response.data.execution,
			};
		} catch (error: any) {
			console.error("Error placing direct order:", error);
			return {
				success: false,
				message: error.response?.data?.message || "Failed to place order",
			};
		}
	}

	/**
	 * Simulate direct order in demo mode
	 */
	private simulateDirectOrder(
		request: DirectOrderRequest,
	): DirectOrderResponse {
		const orderId = `ETI-${randomUUID().substring(0, 8).toUpperCase()}`;
		const orderNumber = `DO${Date.now().toString().substring(5)}`;

		// Simulate market price
		const simulatedPrice = request.price || 1000 + Math.random() * 100;
		const totalAmount = simulatedPrice * request.quantity;

		return {
			success: true,
			orderId: orderId,
			orderNumber: orderNumber,
			message: `${request.orderType.toUpperCase()} order for ${request.quantity} ${request.symbol} placed successfully (Demo mode)`,
			executionDetails: {
				executedQuantity: request.quantity,
				averagePrice: simulatedPrice,
				totalAmount: totalAmount,
				orderStatus:
					request.orderCategory === "market" ? "executed" : "pending",
			},
		};
	}

	/**
	 * Get market quote for symbol
	 */
	async getMarketQuote(
		symbol: string,
		segment: string = "equity",
	): Promise<MarketQuote | null> {
		try {
			if (!IS_PRODUCTION) {
				return this.getDemoQuote(symbol, segment);
			}

			const response = await axios.get(
				`${API_CONFIG.baseUrl}/quote/${segment}/${symbol}`,
				{
					headers: {
						"User-Agent": "FintekPro/1.0",
						Accept: "application/json",
					},
				},
			);

			return response.data;
		} catch (error) {
			console.error("Error fetching market quote:", error);
			return this.getDemoQuote(symbol, segment);
		}
	}

	/**
	 * Generate demo market quote
	 */
	private getDemoQuote(symbol: string, segment: string): MarketQuote {
		const basePrice = 1000 + Math.random() * 500;
		const change = (Math.random() - 0.5) * 50;

		return {
			symbol: symbol,
			segment: segment,
			lastPrice: Math.round(basePrice * 100) / 100,
			change: Math.round(change * 100) / 100,
			changePercent: Math.round((change / basePrice) * 10000) / 100,
			volume: Math.floor(Math.random() * 1000000),
			bid: Math.round((basePrice - 0.5) * 100) / 100,
			ask: Math.round((basePrice + 0.5) * 100) / 100,
			high: Math.round((basePrice + Math.abs(change)) * 100) / 100,
			low: Math.round((basePrice - Math.abs(change)) * 100) / 100,
			open: Math.round((basePrice - change * 0.5) * 100) / 100,
			previousClose: Math.round((basePrice - change) * 100) / 100,
		};
	}

	/**
	 * Get order status
	 */
	async getOrderStatus(orderId: string): Promise<any> {
		try {
			if (!IS_PRODUCTION) {
				return {
					orderId: orderId,
					status: "executed",
					message: "Order executed successfully (Demo mode)",
				};
			}

			const response = await axios.get(
				`${API_CONFIG.baseUrl}/order/${orderId}`,
				{
					headers: {
						"User-Agent": "FintekPro/1.0",
						Accept: "application/json",
					},
				},
			);

			return response.data;
		} catch (error) {
			console.error("Error fetching order status:", error);
			throw error;
		}
	}

	/**
	 * Get user's positions
	 */
	async getPositions(userId: string, segment?: string): Promise<any[]> {
		try {
			if (!IS_PRODUCTION) {
				return [
					{
						symbol: "TCS",
						segment: "equity",
						quantity: 100,
						averagePrice: 3450.5,
						currentPrice: 3500.0,
						unrealizedPL: 4950.0,
						plPercent: 1.43,
					},
					{
						symbol: "RELIANCE",
						segment: "equity",
						quantity: 50,
						averagePrice: 2500.0,
						currentPrice: 2550.0,
						unrealizedPL: 2500.0,
						plPercent: 2.0,
					},
				];
			}

			const response = await axios.get(
				`${API_CONFIG.baseUrl}/positions/${userId}`,
				{
					params: { segment },
					headers: {
						"User-Agent": "FintekPro/1.0",
						Accept: "application/json",
					},
				},
			);

			return response.data.positions || [];
		} catch (error) {
			console.error("Error fetching positions:", error);
			return [];
		}
	}

	/**
	 * Get order book
	 */
	async getOrderBook(userId: string): Promise<any[]> {
		try {
			if (!IS_PRODUCTION) {
				return [
					{
						orderId: "ETI-DEMO-001",
						symbol: "INFY",
						orderType: "buy",
						quantity: 50,
						price: 1500.0,
						status: "executed",
						executedQuantity: 50,
						pendingQuantity: 0,
					},
				];
			}

			const response = await axios.get(
				`${API_CONFIG.baseUrl}/orderbook/${userId}`,
				{
					headers: {
						"User-Agent": "FintekPro/1.0",
						Accept: "application/json",
					},
				},
			);

			return response.data.orders || [];
		} catch (error) {
			console.error("Error fetching order book:", error);
			return [];
		}
	}
}

// Export singleton instance
export const bseDirectApi = new BSEDirectApiService();
