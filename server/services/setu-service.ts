import axios from "axios";
import {
	getSetuClientId,
	getSetuSecret,
	getSetuBaseUrl,
} from "../utils/setu-config";
import { logger } from "../logger";

export interface SetuResponse<T = any> {
	status: number;
	success: boolean;
	data?: T;
	error?: any;
}

export class SetuService {
	private getHeaders() {
		return {
			"x-client-id": getSetuClientId(),
			"x-client-secret": getSetuSecret(),
			"Content-Type": "application/json",
		};
	}

	/**
	 * Create a UPI Payment Link
	 */
	async createPaymentLink(amount: number, description: string) {
		try {
			const baseUrl = getSetuBaseUrl();
			const response = await axios.post(
				`${baseUrl}/payments/v1/payment-links`,
				{
					amount: { value: amount * 100, currencyCode: "INR" },
					productInstanceId: getSetuClientId(),
					additionalInfo: { description },
				},
				{ headers: this.getHeaders() },
			);

			return {
				success: true,
				data: response.data,
			};
		} catch (error: any) {
			logger.error(
				"[SetuService] Payment link creation failed:",
				error.response?.data || error.message,
			);
			return {
				success: false,
				message:
					error.response?.data?.message || "Payment link creation failed",
			};
		}
	}

	/**
	 * Initiate Account Aggregator Consent (General / Deposits)
	 */
	async initiateConsent(phoneNumber: string) {
		try {
			const baseUrl = getSetuBaseUrl();
			const response = await axios.post(
				`${baseUrl}/reports/v1/consents`,
				{
					phoneNumber,
					details: {
						consentTypes: ["TRANSACTIONS", "PROFILE", "SUMMARY"],
						fiTypes: ["DEPOSIT", "TERM_DEPOSIT"],
						dataConsumerId: getSetuClientId(),
					},
				},
				{ headers: this.getHeaders() },
			);

			return {
				success: true,
				consentId: response.data.id,
				url: response.data.url,
			};
		} catch (error: any) {
			logger.error(
				"[SetuService] Consent initiation failed:",
				error.response?.data || error.message,
			);
			return {
				success: false,
				message: error.response?.data?.message || "Consent initiation failed",
			};
		}
	}

	/**
	 * Initiate Account Aggregator Consent specifically for Mutual Funds
	 * Uses RBI Account Aggregator specification for FI Type: MUTUAL_FUNDS
	 */
	async initiateMFConsent(phoneNumber: string, redirectUrl?: string) {
		try {
			const baseUrl = getSetuBaseUrl();
			const payload: any = {
				phoneNumber,
				details: {
					consentTypes: ["SUMMARY", "PROFILE", "TRANSACTIONS"],
					fiTypes: ["MUTUAL_FUNDS"],
					dataConsumerId: getSetuClientId(),
					purpose: {
						code: "101",
						refUri: "https://api.rebit.org.in",
						text: "Wealth portfolio analytics and advisory aggregation",
						category: {
							type: "PortfolioReview",
						},
					},
					dataFilter: [
						{
							type: "TRANSACTION",
							operator: ">=",
							value: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
						},
					],
				},
			};

			if (redirectUrl) {
				payload.redirectUrl = redirectUrl;
			}

			const response = await axios.post(
				`${baseUrl}/reports/v1/consents`,
				payload,
				{ headers: this.getHeaders() },
			);

			logger.info("[SetuService] MF AA Consent initiated successfully", {
				consentId: response.data.id,
				phoneNumber: phoneNumber.slice(-4), // Masked
			});

			return {
				success: true,
				consentId: response.data.id,
				url: response.data.url,
				status: response.data.status || "PENDING",
			};
		} catch (error: any) {
			logger.error(
				"[SetuService] MF Consent initiation failed:",
				error.response?.data || error.message,
			);
			return {
				success: false,
				message: error.response?.data?.message || "Mutual Fund AA Consent initiation failed",
			};
		}
	}

	/**
	 * Check Consent Status from Setu AA
	 */
	async getConsentStatus(consentId: string) {
		try {
			const baseUrl = getSetuBaseUrl();
			const response = await axios.get(
				`${baseUrl}/reports/v1/consents/${consentId}`,
				{ headers: this.getHeaders() },
			);

			return {
				success: true,
				status: response.data.status, // "PENDING" | "ACTIVE" | "REJECTED" | "REVOKED"
				data: response.data,
			};
		} catch (error: any) {
			logger.error("[SetuService] Error checking consent status:", error.response?.data || error.message);
			return {
				success: false,
				message: error.response?.data?.message || "Failed to check consent status",
			};
		}
	}

	/**
	 * Fetch Mutual Fund financial information using approved consent
	 */
	async fetchMFHoldings(consentId: string) {
		try {
			const baseUrl = getSetuBaseUrl();
			const response = await axios.get(
				`${baseUrl}/reports/v1/consents/${consentId}/data`,
				{ headers: this.getHeaders() },
			);

			// Standardized RBI AA payload parsing
			const rawHoldings = response.data?.fipData || [];
			const normalizedHoldings: Array<{
				amc: string;
				folioNumber: string;
				schemeName: string;
				isin: string;
				units: number;
				nav: number;
				currentValue: number;
				costValue?: number;
			}> = [];

			for (const fip of rawHoldings) {
				for (const account of fip.accounts || []) {
					for (const holding of account.holdings || []) {
						const units = Number.parseFloat(holding.units || "0");
						const nav = Number.parseFloat(holding.nav || "0");
						const currentValue = Number.parseFloat(holding.currentValue || (units * nav).toFixed(2));

						normalizedHoldings.push({
							amc: account.amc || fip.fipName || "Unknown AMC",
							folioNumber: account.folioNumber || account.accountNumber || "",
							schemeName: holding.schemeName || holding.scheme || "Unknown Scheme",
							isin: holding.isin || "",
							units,
							nav,
							currentValue,
							costValue: holding.costValue ? Number.parseFloat(holding.costValue) : undefined,
						});
					}
				}
			}

			return {
				success: true,
				consentId,
				count: normalizedHoldings.length,
				holdings: normalizedHoldings,
			};
		} catch (error: any) {
			logger.error("[SetuService] Error fetching MF AA holdings:", error.response?.data || error.message);
			return {
				success: false,
				message: error.response?.data?.message || "Failed to fetch AA holdings",
				holdings: [],
			};
		}
	}
}

export const setuService = new SetuService();
