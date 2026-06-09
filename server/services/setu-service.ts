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
	 * Initiate Account Aggregator Consent
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
}

export const setuService = new SetuService();
