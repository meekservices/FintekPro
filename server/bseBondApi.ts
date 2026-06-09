/**
 * BSE Bond API Service
 *
 * For Corporate Bonds, NCDs (Non-Convertible Debentures), and Debt instruments
 * via BSE Bond platform
 */

import { randomUUID } from "crypto";
import axios from "axios";
import {
	calculateYieldToMaturity,
	calculateCurrentYield,
	calculateAccruedInterest,
	calculateBondPrice,
} from "./bond-calculator";

const bseWarnThrottle: Record<string, number> = {};
function bseWarn(key: string, msg: string) {
	const now = Date.now();
	if (!bseWarnThrottle[key] || now - bseWarnThrottle[key] > 3600000) {
		console.warn(msg);
		bseWarnThrottle[key] = now;
	}
}

// BSE Bond API Configuration
const BSE_BOND_CONFIG = {
	demo: {
		baseUrl: "https://demo.bond.bseindia.com/api",
		tradingUrl: "https://demo.bseindia.com/bond/api",
	},
	production: {
		baseUrl: "https://bond.bseindia.com/api",
		tradingUrl: "https://www.bseindia.com/bond/api",
	},
};

const IS_PRODUCTION = process.env.BSE_BOND_ENVIRONMENT === "production";
const API_CONFIG = IS_PRODUCTION
	? BSE_BOND_CONFIG.production
	: BSE_BOND_CONFIG.demo;

// BSE Bond Credentials
const BSE_BOND_CREDENTIALS = {
	userId: process.env.BSE_BOND_USER_ID || "demo_user",
	password: process.env.BSE_BOND_PASSWORD || "demo_password",
	memberId: process.env.BSE_BOND_MEMBER_ID || "demo_member",
};

export interface CorporateBond {
	isin: string;
	securityCode: string;
	bondName: string;
	issuer: string;
	bondType: "corporate_bond" | "ncd" | "debenture" | "commercial_paper";
	faceValue: number;
	couponType: "fixed" | "floating" | "zero_coupon";
	couponRate: number;
	couponFrequency: "annual" | "semi_annual" | "quarterly" | "monthly";
	maturityDate: string;
	tenorYears: number;
	currentPrice: number;
	yieldToMaturity: number;
	creditRating: string;
	ratingAgency: string;
	tradingStatus: "active" | "suspended" | "matured";
	minimumLotSize: number;
	lastTradedPrice: number;
	volume: number;
}

export interface BondOrderRequest {
	userId: string;
	clientCode: string;
	isin: string;
	bondType: "corporate";
	orderType: "buy" | "sell";
	quantity: number;
	orderCategory: "market" | "limit";
	limitPrice?: number;
	dematAccountNumber: string;
}

export interface BondOrderResponse {
	success: boolean;
	orderId?: string;
	orderNumber?: string;
	message: string;
	executionDetails?: {
		executionPrice: number;
		grossAmount: number;
		accruedInterest: number;
		netAmount: number;
		settlementDate: string;
	};
}

/**
 * BSE Bond API Service Class
 */
export class BSEBondApiService {
	/**
	 * Validate BSE Bond credentials
	 */
	private validateCredentials(): boolean {
		if (IS_PRODUCTION) {
			return !!(
				BSE_BOND_CREDENTIALS.userId &&
				BSE_BOND_CREDENTIALS.password &&
				BSE_BOND_CREDENTIALS.memberId &&
				BSE_BOND_CREDENTIALS.userId !== "demo_user"
			);
		}
		return true; // Demo mode always valid
	}

	/**
	 * Get list of tradable corporate bonds
	 */
	async getTradableBonds(filters?: {
		minRating?: string;
		maxTenor?: number;
		minYield?: number;
		issuerSector?: string;
	}): Promise<CorporateBond[]> {
		try {
			if (!this.validateCredentials()) {
				if (IS_PRODUCTION) {
					throw new Error("BSE Bond credentials not configured in production");
				}
				console.log("BSE Bond: Using demo mode - returning sample bonds");
				return this.getDemoBonds();
			}

			if (!IS_PRODUCTION) {
				return this.getDemoBonds();
			}

			// Production API call
			const response = await axios.get(`${API_CONFIG.baseUrl}/bonds/tradable`, {
				params: filters,
				headers: {
					"User-Agent": "FintekPro/1.0",
					Accept: "application/json",
				},
			});

			return response.data.bonds || [];
		} catch (error: any) {
			const msg =
				error?.code === "ETIMEDOUT"
					? `ETIMEDOUT ${error?.address}:${error?.port}`
					: error?.message || "Unknown error";
			bseWarn("tradable", `[BSE Bond] Tradable bonds fetch failed: ${msg}`);
			if (IS_PRODUCTION) {
				return [];
			}
			return this.getDemoBonds();
		}
	}

	/**
	 * Get demo corporate bond data
	 */
	private getDemoBonds(): CorporateBond[] {
		const in5Years = new Date();
		in5Years.setFullYear(in5Years.getFullYear() + 5);

		const in7Years = new Date();
		in7Years.setFullYear(in7Years.getFullYear() + 7);

		const in3Years = new Date();
		in3Years.setFullYear(in3Years.getFullYear() + 3);

		return [
			{
				isin: "INE001A07001",
				securityCode: "950361",
				bondName: "HDFC Bank Ltd 8.25% 2030",
				issuer: "HDFC Bank Limited",
				bondType: "corporate_bond",
				faceValue: 1000,
				couponType: "fixed",
				couponRate: 8.25,
				couponFrequency: "annual",
				maturityDate: in5Years.toISOString().split("T")[0],
				tenorYears: 5,
				currentPrice: 1050.0,
				yieldToMaturity: 7.45,
				creditRating: "AAA",
				ratingAgency: "CRISIL",
				tradingStatus: "active",
				minimumLotSize: 10,
				lastTradedPrice: 1050.0,
				volume: 5000,
			},
			{
				isin: "INE002A07002",
				securityCode: "950362",
				bondName: "Reliance Industries NCD 7.95% 2032",
				issuer: "Reliance Industries Limited",
				bondType: "ncd",
				faceValue: 1000,
				couponType: "fixed",
				couponRate: 7.95,
				couponFrequency: "semi_annual",
				maturityDate: in7Years.toISOString().split("T")[0],
				tenorYears: 7,
				currentPrice: 985.0,
				yieldToMaturity: 8.15,
				creditRating: "AA+",
				ratingAgency: "ICRA",
				tradingStatus: "active",
				minimumLotSize: 5,
				lastTradedPrice: 985.0,
				volume: 3000,
			},
			{
				isin: "INE003A07003",
				securityCode: "950363",
				bondName: "Tata Motors Debenture 9.10% 2028",
				issuer: "Tata Motors Limited",
				bondType: "debenture",
				faceValue: 1000,
				couponType: "fixed",
				couponRate: 9.1,
				couponFrequency: "annual",
				maturityDate: in3Years.toISOString().split("T")[0],
				tenorYears: 3,
				currentPrice: 1025.0,
				yieldToMaturity: 8.35,
				creditRating: "AA",
				ratingAgency: "CARE",
				tradingStatus: "active",
				minimumLotSize: 20,
				lastTradedPrice: 1025.0,
				volume: 2500,
			},
			{
				isin: "INE004A07004",
				securityCode: "950364",
				bondName: "LIC Housing Finance NCD 8.50% 2029",
				issuer: "LIC Housing Finance Limited",
				bondType: "ncd",
				faceValue: 1000,
				couponType: "fixed",
				couponRate: 8.5,
				couponFrequency: "annual",
				maturityDate: in5Years.toISOString().split("T")[0],
				tenorYears: 5,
				currentPrice: 1010.0,
				yieldToMaturity: 8.25,
				creditRating: "AAA",
				ratingAgency: "India Ratings",
				tradingStatus: "active",
				minimumLotSize: 10,
				lastTradedPrice: 1010.0,
				volume: 4000,
			},
		];
	}

	/**
	 * Place bond order (buy/sell)
	 */
	async placeBondOrder(request: BondOrderRequest): Promise<BondOrderResponse> {
		try {
			if (!this.validateCredentials()) {
				return {
					success: false,
					message: "BSE Bond API credentials not configured",
				};
			}

			if (!IS_PRODUCTION) {
				// Demo mode - simulate successful order
				return this.simulateBondOrder(request);
			}

			// Production API call
			const response = await axios.post(
				`${API_CONFIG.tradingUrl}/order`,
				{
					userId: BSE_BOND_CREDENTIALS.userId,
					memberId: BSE_BOND_CREDENTIALS.memberId,
					clientCode: request.clientCode,
					isin: request.isin,
					orderType: request.orderType,
					quantity: request.quantity,
					orderCategory: request.orderCategory,
					limitPrice: request.limitPrice,
					dematAccountNumber: request.dematAccountNumber,
					password: BSE_BOND_CREDENTIALS.password,
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
				message: "Bond order placed successfully",
				executionDetails: response.data.execution,
			};
		} catch (error: any) {
			console.warn(
				`[BSE Bond] Order placement failed: ${error?.message || "Unknown error"}`,
			);
			return {
				success: false,
				message: error.response?.data?.message || "Failed to place bond order",
			};
		}
	}

	/**
	 * Simulate bond order in demo mode
	 */
	private simulateBondOrder(request: BondOrderRequest): BondOrderResponse {
		const orderId = `BOND-${randomUUID().substring(0, 8).toUpperCase()}`;
		const orderNumber = `BO${Date.now().toString().substring(5)}`;

		// Try to find bond in demo bonds for pricing, but allow any ISIN in demo mode
		const demoBonds = this.getDemoBonds();
		const bond = demoBonds.find((b) => b.isin === request.isin);

		// In demo mode, use provided limit price or a default price if bond not in demo list
		const defaultFaceValue = 1000;
		const defaultCouponRate = 8.0;
		const defaultPrice = request.limitPrice || 1000;

		// Calculate execution details
		const executionPrice = bond
			? request.orderCategory === "market"
				? bond.lastTradedPrice
				: request.limitPrice || bond.lastTradedPrice
			: defaultPrice;

		const grossAmount = executionPrice * request.quantity;

		// Calculate accrued interest (simplified for demo)
		const accruedInterest =
			calculateAccruedInterest({
				faceValue: bond?.faceValue || defaultFaceValue,
				couponRate: bond?.couponRate || defaultCouponRate,
				lastCouponDate: new Date(
					new Date().setMonth(new Date().getMonth() - 6),
				),
				settlementDate: new Date(),
				frequency: bond?.couponFrequency || "annual",
			}) * request.quantity;

		const netAmount =
			request.orderType === "buy"
				? grossAmount + accruedInterest
				: grossAmount - accruedInterest;

		const settlementDate = new Date();
		settlementDate.setDate(settlementDate.getDate() + 2); // T+2 settlement

		return {
			success: true,
			orderId: orderId,
			orderNumber: orderNumber,
			message: `Bond ${request.orderType} order placed successfully in demo mode`,
			executionDetails: {
				executionPrice: executionPrice,
				grossAmount: grossAmount,
				accruedInterest: accruedInterest,
				netAmount: netAmount,
				settlementDate: settlementDate.toISOString().split("T")[0],
			},
		};
	}

	/**
	 * Get bond order status
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
				`${API_CONFIG.tradingUrl}/order/${orderId}`,
				{
					headers: {
						"User-Agent": "FintekPro/1.0",
						Accept: "application/json",
					},
				},
			);

			return response.data;
		} catch (error: any) {
			console.warn(
				`[BSE Bond] Order status fetch failed: ${error?.message || "Unknown error"}`,
			);
			throw error;
		}
	}

	/**
	 * Get bond details by ISIN
	 */
	async getBondDetails(isin: string): Promise<CorporateBond | null> {
		try {
			if (!IS_PRODUCTION) {
				const demoBonds = this.getDemoBonds();
				return demoBonds.find((b) => b.isin === isin) || null;
			}

			const response = await axios.get(`${API_CONFIG.baseUrl}/bond/${isin}`, {
				headers: {
					"User-Agent": "FintekPro/1.0",
					Accept: "application/json",
				},
			});

			return response.data;
		} catch (error: any) {
			console.warn(
				`[BSE Bond] Bond details fetch failed: ${error?.message || "Unknown error"}`,
			);
			return null;
		}
	}

	/**
	 * Search bonds by criteria
	 */
	async searchBonds(query: {
		issuer?: string;
		minRating?: string;
		maxYield?: number;
		bondType?: string;
	}): Promise<CorporateBond[]> {
		try {
			const allBonds = await this.getTradableBonds();

			return allBonds.filter((bond) => {
				if (
					query.issuer &&
					!bond.issuer.toLowerCase().includes(query.issuer.toLowerCase())
				) {
					return false;
				}
				if (query.bondType && bond.bondType !== query.bondType) {
					return false;
				}
				if (query.maxYield && bond.yieldToMaturity > query.maxYield) {
					return false;
				}
				return true;
			});
		} catch (error: any) {
			console.warn(
				`[BSE Bond] Bond search failed: ${error?.message || "Unknown error"}`,
			);
			return [];
		}
	}

	/**
	 * Advanced bond search with comprehensive filters
	 */
	async advancedSearch(filters: {
		creditRatings?: string[];
		minYield?: number;
		maxYield?: number;
		minMaturityYears?: number;
		maxMaturityYears?: number;
		bondTypes?: string[];
		issuers?: string[];
		minCouponRate?: number;
		maxCouponRate?: number;
		couponTypes?: string[];
		tradingStatus?: string;
	}): Promise<CorporateBond[]> {
		try {
			const allBonds = await this.getTradableBonds();

			return allBonds.filter((bond) => {
				// Credit rating filter
				if (filters.creditRatings && filters.creditRatings.length > 0) {
					if (!filters.creditRatings.includes(bond.creditRating)) {
						return false;
					}
				}

				// Yield range filter
				if (
					filters.minYield !== undefined &&
					bond.yieldToMaturity < filters.minYield
				) {
					return false;
				}
				if (
					filters.maxYield !== undefined &&
					bond.yieldToMaturity > filters.maxYield
				) {
					return false;
				}

				// Maturity filter
				if (
					filters.minMaturityYears !== undefined &&
					bond.tenorYears < filters.minMaturityYears
				) {
					return false;
				}
				if (
					filters.maxMaturityYears !== undefined &&
					bond.tenorYears > filters.maxMaturityYears
				) {
					return false;
				}

				// Bond type filter
				if (filters.bondTypes && filters.bondTypes.length > 0) {
					if (!filters.bondTypes.includes(bond.bondType)) {
						return false;
					}
				}

				// Issuer filter
				if (filters.issuers && filters.issuers.length > 0) {
					const matchesIssuer = filters.issuers.some((issuer) =>
						bond.issuer.toLowerCase().includes(issuer.toLowerCase()),
					);
					if (!matchesIssuer) {
						return false;
					}
				}

				// Coupon rate filter
				if (
					filters.minCouponRate !== undefined &&
					bond.couponRate < filters.minCouponRate
				) {
					return false;
				}
				if (
					filters.maxCouponRate !== undefined &&
					bond.couponRate > filters.maxCouponRate
				) {
					return false;
				}

				// Coupon type filter
				if (filters.couponTypes && filters.couponTypes.length > 0) {
					if (!filters.couponTypes.includes(bond.couponType)) {
						return false;
					}
				}

				// Trading status filter
				if (
					filters.tradingStatus &&
					bond.tradingStatus !== filters.tradingStatus
				) {
					return false;
				}

				return true;
			});
		} catch (error) {
			console.error("Error in advanced bond search:", error);
			return [];
		}
	}

	/**
	 * Get bonds by credit rating
	 */
	async getBondsByRating(ratings: string[]): Promise<CorporateBond[]> {
		try {
			const allBonds = await this.getTradableBonds();
			return allBonds.filter((bond) => ratings.includes(bond.creditRating));
		} catch (error) {
			console.error("Error fetching bonds by rating:", error);
			return [];
		}
	}

	/**
	 * Get bonds by yield range
	 */
	async getBondsByYieldRange(
		minYield: number,
		maxYield: number,
	): Promise<CorporateBond[]> {
		try {
			const allBonds = await this.getTradableBonds();
			return allBonds.filter(
				(bond) =>
					bond.yieldToMaturity >= minYield && bond.yieldToMaturity <= maxYield,
			);
		} catch (error) {
			console.error("Error fetching bonds by yield range:", error);
			return [];
		}
	}

	/**
	 * Get bonds by maturity period
	 */
	async getBondsByMaturity(params: {
		minYears?: number;
		maxYears?: number;
		exactYears?: number;
	}): Promise<CorporateBond[]> {
		try {
			const allBonds = await this.getTradableBonds();

			return allBonds.filter((bond) => {
				if (params.exactYears !== undefined) {
					return bond.tenorYears === params.exactYears;
				}

				if (
					params.minYears !== undefined &&
					bond.tenorYears < params.minYears
				) {
					return false;
				}

				if (
					params.maxYears !== undefined &&
					bond.tenorYears > params.maxYears
				) {
					return false;
				}

				return true;
			});
		} catch (error: any) {
			console.warn(
				`[BSE Bond] Bonds by maturity fetch failed: ${error?.message || "Unknown error"}`,
			);
			return [];
		}
	}

	/**
	 * Get tax-free bonds (special category bonds with tax benefits)
	 */
	async getTaxFreeBonds(): Promise<any[]> {
		try {
			if (!IS_PRODUCTION) {
				return this.getDemoTaxFreeBonds();
			}

			const response = await axios.get(`${API_CONFIG.baseUrl}/bonds/tax-free`, {
				headers: {
					"User-Agent": "FintekPro/1.0",
					Accept: "application/json",
				},
			});

			return response.data.bonds || [];
		} catch (error: any) {
			const msg =
				error?.code === "ETIMEDOUT"
					? `ETIMEDOUT ${error?.address}:${error?.port}`
					: error?.message || "Unknown error";
			bseWarn("taxfree", `[BSE Bond] Tax-free bonds fetch failed: ${msg}`);
			if (IS_PRODUCTION) {
				return [];
			}
			return this.getDemoTaxFreeBonds();
		}
	}

	/**
	 * Get demo tax-free bonds
	 */
	private getDemoTaxFreeBonds(): any[] {
		const in10Years = new Date();
		in10Years.setFullYear(in10Years.getFullYear() + 10);

		return [
			{
				isin: "INE005A07005",
				securityCode: "950365",
				bondName: "NHAI Tax-Free Bonds 7.35% 2035",
				issuer: "National Highways Authority of India",
				bondType: "tax_free_bond",
				faceValue: 1000,
				couponType: "fixed",
				couponRate: 7.35,
				couponFrequency: "annual",
				maturityDate: in10Years.toISOString().split("T")[0],
				tenorYears: 10,
				currentPrice: 1020.0,
				yieldToMaturity: 7.1,
				creditRating: "AAA",
				ratingAgency: "CRISIL",
				taxBenefit: "Interest income exempt from tax under Section 10",
				tradingStatus: "active",
				minimumLotSize: 10,
				lastTradedPrice: 1020.0,
				volume: 1500,
			},
			{
				isin: "INE006A07006",
				securityCode: "950366",
				bondName: "IRFC Tax-Free Bonds 7.28% 2034",
				issuer: "Indian Railway Finance Corporation",
				bondType: "tax_free_bond",
				faceValue: 1000,
				couponType: "fixed",
				couponRate: 7.28,
				couponFrequency: "annual",
				maturityDate: in10Years.toISOString().split("T")[0],
				tenorYears: 10,
				currentPrice: 1015.0,
				yieldToMaturity: 7.05,
				creditRating: "AAA",
				ratingAgency: "ICRA",
				taxBenefit: "Tax-exempt interest under Section 10(15)(iv)(h)",
				tradingStatus: "active",
				minimumLotSize: 10,
				lastTradedPrice: 1015.0,
				volume: 2000,
			},
		];
	}

	/**
	 * Get infrastructure bonds (special infrastructure financing bonds)
	 */
	async getInfrastructureBonds(): Promise<any[]> {
		try {
			if (!IS_PRODUCTION) {
				return this.getDemoInfrastructureBonds();
			}

			const response = await axios.get(
				`${API_CONFIG.baseUrl}/bonds/infrastructure`,
				{
					headers: {
						"User-Agent": "FintekPro/1.0",
						Accept: "application/json",
					},
				},
			);

			return response.data.bonds || [];
		} catch (error: any) {
			const msg =
				error?.code === "ETIMEDOUT"
					? `ETIMEDOUT ${error?.address}:${error?.port}`
					: error?.message || "Unknown error";
			bseWarn("infra", `[BSE Bond] Infrastructure bonds fetch failed: ${msg}`);
			if (IS_PRODUCTION) {
				return [];
			}
			return this.getDemoInfrastructureBonds();
		}
	}

	/**
	 * Get demo infrastructure bonds
	 */
	private getDemoInfrastructureBonds(): any[] {
		const in8Years = new Date();
		in8Years.setFullYear(in8Years.getFullYear() + 8);

		return [
			{
				isin: "INE007A07007",
				securityCode: "950367",
				bondName: "NTPC Infrastructure Bond 8.15% 2033",
				issuer: "NTPC Limited",
				bondType: "infrastructure_bond",
				faceValue: 1000,
				couponType: "fixed",
				couponRate: 8.15,
				couponFrequency: "annual",
				maturityDate: in8Years.toISOString().split("T")[0],
				tenorYears: 8,
				currentPrice: 1030.0,
				yieldToMaturity: 7.75,
				creditRating: "AAA",
				ratingAgency: "CRISIL",
				sector: "Power",
				projectType: "Green Energy Infrastructure",
				tradingStatus: "active",
				minimumLotSize: 10,
				lastTradedPrice: 1030.0,
				volume: 3500,
			},
			{
				isin: "INE008A07008",
				securityCode: "950368",
				bondName: "L&T Infrastructure Bond 8.45% 2032",
				issuer: "Larsen & Toubro Limited",
				bondType: "infrastructure_bond",
				faceValue: 1000,
				couponType: "fixed",
				couponRate: 8.45,
				couponFrequency: "semi_annual",
				maturityDate: in8Years.toISOString().split("T")[0],
				tenorYears: 8,
				currentPrice: 1025.0,
				yieldToMaturity: 8.05,
				creditRating: "AA+",
				ratingAgency: "ICRA",
				sector: "Infrastructure & Construction",
				projectType: "Highway & Metro Projects",
				tradingStatus: "active",
				minimumLotSize: 5,
				lastTradedPrice: 1025.0,
				volume: 2800,
			},
		];
	}
}

// Export singleton instance
export const bseBondApi = new BSEBondApiService();
