/**
 * NSE NCB (Non-Competitive Bidding) API Service
 *
 * For Government Securities (G-Secs), Treasury Bills (T-Bills), and State Development Loans (SDLs)
 * via NSE goBID platform
 */

import { randomUUID } from "crypto";
import axios from "axios";
import {
	calculateYieldToMaturity,
	calculateBondPrice,
	calculateMacaulayDuration,
	calculateModifiedDuration,
} from "./bond-calculator";

const nseWarnThrottle: Record<string, number> = {};
function nseWarn(key: string, msg: string) {
	const now = Date.now();
	if (!nseWarnThrottle[key] || now - nseWarnThrottle[key] > 3600000) {
		console.warn(msg);
		nseWarnThrottle[key] = now;
	}
}

// NSE NCB API Configuration
const NSE_NCB_CONFIG = {
	demo: {
		baseUrl: "https://demo.nseindia.com/api/ncb",
		goBidUrl: "https://demo.eipo.nseindia.com/api",
	},
	production: {
		baseUrl: "https://www.nseindia.com/api/ncb",
		goBidUrl: "https://eipo.nseindia.com/api",
	},
};

const IS_PRODUCTION = process.env.NSE_ENVIRONMENT === "production";
const API_CONFIG = IS_PRODUCTION
	? NSE_NCB_CONFIG.production
	: NSE_NCB_CONFIG.demo;

// NSE Credentials
const NSE_CREDENTIALS = {
	userId: process.env.NSE_USER_ID || "demo_user",
	password: process.env.NSE_PASSWORD || "demo_password",
	memberId: process.env.NSE_MEMBER_ID || "demo_member",
};

export interface GSecurityAuction {
	isin: string;
	securityName: string;
	securityType: "g_sec" | "t_bill" | "sdl";
	issuer: string;
	auctionDate: string;
	auctionNumber: string;
	notifiedAmount: number;
	couponRate?: number;
	maturityDate: string;
	tenorYears: number;
	minimumBid: number;
	cutOffPrice?: number;
	cutOffYield?: number;
	status: "upcoming" | "ongoing" | "completed";
}

export interface NCBOrderRequest {
	userId: string;
	clientCode: string;
	isin: string;
	auctionNumber: string;
	bidAmount: number; // In multiples of ₹10,000
	panNumber: string;
	dematAccountNumber: string;
}

export interface NCBOrderResponse {
	success: boolean;
	orderId?: string;
	message: string;
	allotmentDetails?: {
		isin: string;
		allottedAmount: number;
		allottedPrice: number;
		allottedYield: number;
		settlementDate: string;
	};
}

/**
 * NSE NCB API Service Class
 */
export class NSENCBApiService {
	/**
	 * Validate NSE credentials
	 */
	private validateCredentials(): boolean {
		if (IS_PRODUCTION) {
			return !!(
				NSE_CREDENTIALS.userId &&
				NSE_CREDENTIALS.password &&
				NSE_CREDENTIALS.memberId &&
				NSE_CREDENTIALS.userId !== "demo_user"
			);
		}
		return true; // Demo mode always valid
	}

	/**
	 * Get upcoming and ongoing G-Sec auctions
	 */
	async getUpcomingAuctions(): Promise<GSecurityAuction[]> {
		try {
			if (!this.validateCredentials()) {
				if (IS_PRODUCTION) {
					throw new Error("NSE NCB credentials not configured in production");
				}
				console.log("NSE NCB: Using demo mode - returning sample auctions");
				return this.getDemoAuctions();
			}

			if (!IS_PRODUCTION) {
				return this.getDemoAuctions();
			}

			// Production API call
			const response = await axios.get(`${API_CONFIG.baseUrl}/auctions`, {
				headers: {
					"User-Agent": "FintekPro/1.0",
					Accept: "application/json",
				},
				timeout: 15000,
			});

			return response.data.auctions || [];
		} catch (error) {
			nseWarn(
				"auctions",
				`[NSE NCB] Auctions fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			if (IS_PRODUCTION) {
				return []; // Never return demo data in production
			}
			return this.getDemoAuctions();
		}
	}

	/**
	 * Get demo auction data for testing with realistic RBI auction data
	 */
	private getDemoAuctions(): GSecurityAuction[] {
		const today = new Date();
		const nextWeek = new Date(today);
		nextWeek.setDate(nextWeek.getDate() + 7);

		const in10Years = new Date(today);
		in10Years.setFullYear(in10Years.getFullYear() + 10);

		const in5Years = new Date(today);
		in5Years.setFullYear(in5Years.getFullYear() + 5);

		const in364Days = new Date(today);
		in364Days.setDate(in364Days.getDate() + 364);

		const in182Days = new Date(today);
		in182Days.setDate(in182Days.getDate() + 182);

		const in91Days = new Date(today);
		in91Days.setDate(in91Days.getDate() + 91);

		return [
			{
				isin: "IN0020250111",
				securityName: "7.18% GS 2033",
				securityType: "g_sec",
				issuer: "Government of India",
				auctionDate: nextWeek.toISOString().split("T")[0],
				auctionNumber: "GOI-2025-01",
				notifiedAmount: 25000000000,
				couponRate: 7.18,
				maturityDate: in10Years.toISOString().split("T")[0],
				tenorYears: 10,
				minimumBid: 10000,
				cutOffPrice: 99.25,
				cutOffYield: 7.28,
				status: "upcoming",
			},
			{
				isin: "IN0020610225",
				securityName: "6.95% GS 2061",
				securityType: "g_sec",
				issuer: "Government of India",
				auctionDate: nextWeek.toISOString().split("T")[0],
				auctionNumber: "GOI-2025-02",
				notifiedAmount: 15000000000,
				couponRate: 6.95,
				maturityDate: "2061-02-05",
				tenorYears: 36,
				minimumBid: 10000,
				cutOffPrice: 94.8,
				cutOffYield: 7.35,
				status: "upcoming",
			},
			{
				isin: "IN002025T364",
				securityName: "364 Days T-Bill",
				securityType: "t_bill",
				issuer: "Government of India",
				auctionDate: nextWeek.toISOString().split("T")[0],
				auctionNumber: "TB-2025-03",
				notifiedAmount: 10000000000,
				maturityDate: in364Days.toISOString().split("T")[0],
				tenorYears: 1,
				minimumBid: 10000,
				cutOffPrice: 93.28,
				cutOffYield: 7.2,
				status: "upcoming",
			},
			{
				isin: "IN002025T182",
				securityName: "182 Days T-Bill",
				securityType: "t_bill",
				issuer: "Government of India",
				auctionDate: nextWeek.toISOString().split("T")[0],
				auctionNumber: "TB-2025-04",
				notifiedAmount: 8000000000,
				maturityDate: in182Days.toISOString().split("T")[0],
				tenorYears: 0.5,
				minimumBid: 10000,
				cutOffPrice: 96.52,
				cutOffYield: 7.05,
				status: "upcoming",
			},
			{
				isin: "IN002025T091",
				securityName: "91 Days T-Bill",
				securityType: "t_bill",
				issuer: "Government of India",
				auctionDate: nextWeek.toISOString().split("T")[0],
				auctionNumber: "TB-2025-05",
				notifiedAmount: 6000000000,
				maturityDate: in91Days.toISOString().split("T")[0],
				tenorYears: 0.25,
				minimumBid: 10000,
				cutOffPrice: 98.28,
				cutOffYield: 6.95,
				status: "upcoming",
			},
			{
				isin: "SDLMH2030001",
				securityName: "7.35% Maharashtra SDL 2030",
				securityType: "sdl",
				issuer: "Government of Maharashtra",
				auctionDate: nextWeek.toISOString().split("T")[0],
				auctionNumber: "MH-SDL-2025-01",
				notifiedAmount: 5000000000,
				couponRate: 7.35,
				maturityDate: in5Years.toISOString().split("T")[0],
				tenorYears: 5,
				minimumBid: 10000,
				cutOffPrice: 99.5,
				cutOffYield: 7.45,
				status: "upcoming",
			},
			{
				isin: "SDLGJ2032001",
				securityName: "7.42% Gujarat SDL 2032",
				securityType: "sdl",
				issuer: "Government of Gujarat",
				auctionDate: nextWeek.toISOString().split("T")[0],
				auctionNumber: "GJ-SDL-2025-01",
				notifiedAmount: 4000000000,
				couponRate: 7.42,
				maturityDate: "2032-06-15",
				tenorYears: 7,
				minimumBid: 10000,
				cutOffPrice: 99.15,
				cutOffYield: 7.52,
				status: "upcoming",
			},
		];
	}

	/**
	 * Place NCB order for G-Sec/T-Bill/SDL
	 */
	async placeNCBOrder(request: NCBOrderRequest): Promise<NCBOrderResponse> {
		try {
			// Validate bid amount (must be in multiples of ₹10,000)
			if (request.bidAmount < 10000 || request.bidAmount % 10000 !== 0) {
				return {
					success: false,
					message:
						"Bid amount must be in multiples of ₹10,000 with minimum ₹10,000",
				};
			}

			// Validate maximum bid (₹2 crore for retail NCB)
			if (request.bidAmount > 20000000) {
				return {
					success: false,
					message: "Maximum bid amount is ₹2 crore for retail NCB investors",
				};
			}

			if (!this.validateCredentials()) {
				return {
					success: false,
					message: "NSE NCB credentials not configured",
				};
			}

			if (!IS_PRODUCTION) {
				// Demo mode - simulate successful order
				return this.simulateNCBOrder(request);
			}

			// Production API call
			const response = await axios.post(
				`${API_CONFIG.goBidUrl}/order`,
				{
					userId: NSE_CREDENTIALS.userId,
					memberId: NSE_CREDENTIALS.memberId,
					clientCode: request.clientCode,
					isin: request.isin,
					auctionNumber: request.auctionNumber,
					bidAmount: request.bidAmount,
					panNumber: request.panNumber,
					dematAccountNumber: request.dematAccountNumber,
					password: NSE_CREDENTIALS.password,
				},
				{
					headers: {
						"Content-Type": "application/json",
						"User-Agent": "FintekPro/1.0",
					},
					timeout: 15000,
				},
			);

			return {
				success: true,
				orderId: response.data.orderId,
				message: "NCB order placed successfully",
				allotmentDetails: response.data.allotment,
			};
		} catch (error: any) {
			console.error(
				"Error placing NSE NCB order:",
				error instanceof Error ? error.message : "Unknown error",
			);
			return {
				success: false,
				message: error.response?.data?.message || "Failed to place NCB order",
			};
		}
	}

	/**
	 * Simulate NCB order in demo mode
	 */
	private simulateNCBOrder(request: NCBOrderRequest): NCBOrderResponse {
		const orderId = `NCB-${randomUUID().substring(0, 8).toUpperCase()}`;

		// Simulate allotment at weighted average price
		const simulatedPrice = 98.5; // ₹98.50 per ₹100 face value
		const simulatedYield = 7.2; // 7.20% yield

		const settlementDate = new Date();
		settlementDate.setDate(settlementDate.getDate() + 2); // T+2 settlement

		return {
			success: true,
			orderId: orderId,
			message: "NCB order placed successfully in demo mode",
			allotmentDetails: {
				isin: request.isin,
				allottedAmount: request.bidAmount,
				allottedPrice: simulatedPrice,
				allottedYield: simulatedYield,
				settlementDate: settlementDate.toISOString().split("T")[0],
			},
		};
	}

	/**
	 * Get NCB order status
	 */
	async getOrderStatus(orderId: string): Promise<any> {
		try {
			if (!IS_PRODUCTION) {
				return {
					orderId: orderId,
					status: "allotted",
					message: "Order allotted successfully (Demo mode)",
				};
			}

			const response = await axios.get(
				`${API_CONFIG.goBidUrl}/order/${orderId}`,
				{
					headers: {
						"User-Agent": "FintekPro/1.0",
						Accept: "application/json",
					},
					timeout: 15000,
				},
			);

			return response.data;
		} catch (error) {
			console.error(
				"Error fetching order status:",
				error instanceof Error ? error.message : "Unknown error",
			);
			throw error;
		}
	}

	/**
	 * Get G-Sec details by ISIN
	 */
	async getGSecDetails(isin: string): Promise<any> {
		try {
			if (!IS_PRODUCTION) {
				const demoAuctions = this.getDemoAuctions();
				const gsec = demoAuctions.find((a) => a.isin === isin);

				if (gsec) {
					// Calculate bond pricing metrics
					const currentPrice = calculateBondPrice({
						faceValue: 100,
						couponRate: gsec.couponRate || 0,
						yieldToMaturity: gsec.cutOffYield || 7.0,
						yearsToMaturity: gsec.tenorYears,
						frequency: "semi_annual",
					});

					return {
						...gsec,
						currentPrice: currentPrice,
						faceValue: 100,
						frequency: "semi_annual",
					};
				}

				return null;
			}

			const response = await axios.get(
				`${API_CONFIG.baseUrl}/security/${isin}`,
				{
					headers: {
						"User-Agent": "FintekPro/1.0",
						Accept: "application/json",
					},
					timeout: 15000,
				},
			);

			return response.data;
		} catch (error) {
			nseWarn(
				"gsec",
				`[NSE NCB] G-Sec details fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			return null;
		}
	}

	/**
	 * Get government securities yield curve data
	 */
	async getYieldCurve(): Promise<any[]> {
		try {
			if (!IS_PRODUCTION) {
				return this.getDemoYieldCurve();
			}

			const response = await axios.get(`${API_CONFIG.baseUrl}/yield-curve`, {
				headers: {
					"User-Agent": "FintekPro/1.0",
					Accept: "application/json",
				},
				timeout: 15000,
			});

			return response.data.yieldCurve || [];
		} catch (error) {
			nseWarn(
				"yieldcurve",
				`[NSE NCB] Yield curve fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			if (IS_PRODUCTION) {
				return [];
			}
			return this.getDemoYieldCurve();
		}
	}

	/**
	 * Get demo yield curve data
	 */
	private getDemoYieldCurve(): any[] {
		return [
			{ tenor: "91 Days", tenorMonths: 3, yield: 6.85 },
			{ tenor: "182 Days", tenorMonths: 6, yield: 7.0 },
			{ tenor: "364 Days", tenorMonths: 12, yield: 7.1 },
			{ tenor: "2 Years", tenorYears: 2, yield: 7.15 },
			{ tenor: "3 Years", tenorYears: 3, yield: 7.2 },
			{ tenor: "5 Years", tenorYears: 5, yield: 7.25 },
			{ tenor: "10 Years", tenorYears: 10, yield: 7.3 },
			{ tenor: "15 Years", tenorYears: 15, yield: 7.35 },
			{ tenor: "20 Years", tenorYears: 20, yield: 7.38 },
			{ tenor: "30 Years", tenorYears: 30, yield: 7.4 },
		];
	}

	/**
	 * Get historical auction results
	 */
	async getHistoricalAuctions(params: {
		securityType?: string;
		fromDate?: string;
		toDate?: string;
		limit?: number;
	}): Promise<any[]> {
		try {
			if (!IS_PRODUCTION) {
				return this.getDemoHistoricalAuctions(params);
			}

			const queryParams = new URLSearchParams();
			if (params.securityType) queryParams.append("type", params.securityType);
			if (params.fromDate) queryParams.append("from", params.fromDate);
			if (params.toDate) queryParams.append("to", params.toDate);
			if (params.limit) queryParams.append("limit", params.limit.toString());

			const response = await axios.get(
				`${API_CONFIG.baseUrl}/auctions/historical?${queryParams.toString()}`,
				{
					headers: {
						"User-Agent": "FintekPro/1.0",
						Accept: "application/json",
					},
					timeout: 15000,
				},
			);

			return response.data.auctions || [];
		} catch (error) {
			nseWarn(
				"historical",
				`[NSE NCB] Historical auctions fetch failed: ${error instanceof Error ? error.message : "Unknown error"} — skipping (production)`,
			);
			return []; // Never persist demo data in production
		}
	}

	/**
	 * Get demo historical auction data
	 */
	private getDemoHistoricalAuctions(params: any): any[] {
		const results = [
			{
				isin: "INE000000004",
				securityName: "7.26% GS 2033",
				securityType: "g_sec",
				auctionDate: "2025-09-15",
				auctionNumber: "GOI-2025-04",
				notifiedAmount: 20000000000,
				couponRate: 7.26,
				maturityDate: "2033-01-14",
				cutOffPrice: 99.75,
				cutOffYield: 7.28,
				devolvedAmount: 0,
				acceptedAmount: 20000000000,
			},
			{
				isin: "INE000000005",
				securityName: "182 Days T-Bill",
				securityType: "t_bill",
				auctionDate: "2025-09-20",
				auctionNumber: "TB-2025-05",
				notifiedAmount: 8000000000,
				maturityDate: "2026-03-20",
				cutOffPrice: 96.55,
				cutOffYield: 7.02,
				acceptedAmount: 8000000000,
			},
		];

		return results.slice(0, params.limit || 10);
	}

	/**
	 * Get Sovereign Gold Bond (SGB) data
	 */
	async getSGBData(): Promise<any[]> {
		try {
			if (!IS_PRODUCTION) {
				return this.getDemoSGBData();
			}

			const response = await axios.get(`${API_CONFIG.baseUrl}/sgb`, {
				headers: {
					"User-Agent": "FintekPro/1.0",
					Accept: "application/json",
				},
				timeout: 15000,
			});

			return response.data.sgbs || [];
		} catch (error) {
			nseWarn(
				"sgb",
				`[NSE NCB] SGB data fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			if (IS_PRODUCTION) {
				return [];
			}
			return this.getDemoSGBData();
		}
	}

	/**
	 * Get demo SGB data
	 */
	private getDemoSGBData(): any[] {
		const today = new Date();
		const subscriptionEnd = new Date(today);
		subscriptionEnd.setDate(subscriptionEnd.getDate() + 5);

		const maturityDate = new Date(today);
		maturityDate.setFullYear(maturityDate.getFullYear() + 8);

		return [
			{
				isin: "INE000S01SG1",
				securityName: "Sovereign Gold Bond 2025-26 Series I",
				securityType: "sgb",
				issuer: "Government of India",
				subscriptionStartDate: today.toISOString().split("T")[0],
				subscriptionEndDate: subscriptionEnd.toISOString().split("T")[0],
				issuePrice: 6500, // ₹6,500 per gram
				goldReferencePrice: 6450, // ₹6,450 per gram (RBI reference price)
				goldWeight: 1, // 1 gram per unit
				couponRate: 2.5, // 2.50% per annum
				maturityDate: maturityDate.toISOString().split("T")[0],
				tenorYears: 8,
				minimumInvestment: 1, // 1 gram
				maximumInvestment: 4000, // 4 kg per individual per fiscal year
				earlyRedemptionAllowed: true,
				earlyRedemptionPeriod: "after 5 years",
				taxStatus: "tax_exempt_on_redemption",
			},
		];
	}

	/**
	 * Get real-time G-Sec market prices
	 */
	async getMarketPrices(isins: string[]): Promise<any[]> {
		try {
			if (!IS_PRODUCTION) {
				return this.getDemoMarketPrices(isins);
			}

			const response = await axios.post(
				`${API_CONFIG.baseUrl}/market-prices`,
				{ isins },
				{
					headers: {
						"User-Agent": "FintekPro/1.0",
						Accept: "application/json",
						"Content-Type": "application/json",
					},
					timeout: 15000,
				},
			);

			return response.data.prices || [];
		} catch (error) {
			nseWarn(
				"marketprices",
				`[NSE NCB] Market prices fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			if (IS_PRODUCTION) {
				return [];
			}
			return this.getDemoMarketPrices(isins);
		}
	}

	/**
	 * Get demo market prices
	 */
	private getDemoMarketPrices(isins: string[]): any[] {
		return isins.map((isin) => ({
			isin,
			lastTradedPrice: 98.5 + Math.random() * 3,
			lastTradedYield: 7.1 + Math.random() * 0.4,
			volume: Math.floor(Math.random() * 10000000),
			timestamp: new Date().toISOString(),
		}));
	}
}

// Export singleton instance
export const nseNcbApi = new NSENCBApiService();
