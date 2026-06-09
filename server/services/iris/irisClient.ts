import axios, { AxiosInstance } from "axios";
import { logger } from "../../logger";
import { irisAuthManager } from "./irisAuthManager";

const IRIS_BASE_URL = "https://iris-api.kfintech.com/v2";

export class IrisClient {
	private client: AxiosInstance;
	private pendingOtp: { mobile?: string; txnId?: string } | null = null;
	// Circuit breaker state
	private failureCount = 0;
	private lastFailureTime = 0;
	private readonly MAX_FAILURES = 5;
	private readonly RESET_TIMEOUT = 60000; // 1 minute

	constructor() {
		this.client = axios.create({
			baseURL: IRIS_BASE_URL,
			timeout: 30000,
			headers: { "Content-Type": "application/json" },
		});
		logger.info("[IRIS] Resilient Client initialized", {
			baseUrl: IRIS_BASE_URL,
		});
	}

	private isCircuitOpen(): boolean {
		if (this.failureCount >= this.MAX_FAILURES) {
			if (Date.now() - this.lastFailureTime > this.RESET_TIMEOUT) {
				// Reset after timeout
				this.failureCount = 0;
				return false;
			}
			return true;
		}
		return false;
	}

	private recordFailure() {
		this.failureCount++;
		this.lastFailureTime = Date.now();
		if (this.failureCount >= this.MAX_FAILURES) {
			logger.error("[IRIS] Circuit Breaker OPEN. Too many failures.");
		}
	}

	private recordSuccess() {
		this.failureCount = 0;
	}

	async authenticate(): Promise<{
		success: boolean;
		requiresOtp?: boolean;
		message?: string;
	}> {
		const credentials = irisAuthManager.getCredentials();
		if (!credentials.username || !credentials.password) {
			return { success: false, message: "IRIS credentials not configured" };
		}

		try {
			const resp = await this.client.post("/auth/login", credentials);
			const data = resp.data;

			if (data?.token) {
				const expiresAt = Date.now() + (data.expiresIn ?? 3600) * 1000;
				await irisAuthManager.saveToken(data.token, expiresAt);
				this.client.defaults.headers.common.Authorization = `Bearer ${data.token}`;
				return { success: true };
			}

			if (data?.requiresOtp || data?.otpRequired) {
				this.pendingOtp = { txnId: data.txnId };
				return {
					success: false,
					requiresOtp: true,
					message: data.message || "OTP required",
				};
			}

			return { success: false, message: data?.message || "Login failed" };
		} catch (err: any) {
			logger.error("[IRIS] Login failed", {
				error: err?.response?.data || err.message,
			});
			return {
				success: false,
				message: err?.response?.data?.message || err.message,
			};
		}
	}

	async ensureAuth(): Promise<boolean> {
		const token = await irisAuthManager.loadToken();
		if (token) {
			this.client.defaults.headers.common.Authorization = `Bearer ${token.token}`;
			return true;
		}

		try {
			const refreshed = await this.client.post("/auth/refresh-token");
			const data = refreshed.data;
			if (data?.token) {
				const expiresAt = Date.now() + (data.expiresIn ?? 3600) * 1000;
				await irisAuthManager.saveToken(data.token, expiresAt);
				this.client.defaults.headers.common.Authorization = `Bearer ${data.token}`;
				return true;
			}
		} catch {
			// Fallthrough to full authentication
		}

		const result = await this.authenticate();
		return result.success;
	}

	async call<T = any>(
		endpoint: string,
		method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
		body?: any,
		retryCount = 0,
	): Promise<T> {
		if (this.isCircuitOpen()) {
			throw new Error(
				"IRIS API is currently unavailable (Circuit Breaker Open)",
			);
		}

		const authed = await this.ensureAuth();
		if (!authed) throw new Error("IRIS authentication failed");

		try {
			const resp = await this.client.request<T>({
				url: endpoint,
				method,
				...(body ? { data: body } : {}),
			});

			this.recordSuccess();
			return resp.data;
		} catch (err: any) {
			if (err.response?.status === 401 && retryCount === 0) {
				logger.info("[IRIS] Token expired during call, forcing re-auth");
				await this.authenticate(); // Force re-auth
				return this.call(endpoint, method, body, retryCount + 1);
			}

			if (err.response?.status >= 500 || err.code === "ECONNABORTED") {
				this.recordFailure();
				// Exponential backoff retry logic for 5xx errors
				if (retryCount < 2) {
					const backoff = 2 ** retryCount * 1000;
					logger.warn(`[IRIS] API error 5xx, retrying in ${backoff}ms...`);
					await new Promise((r) => setTimeout(r, backoff));
					return this.call(endpoint, method, body, retryCount + 1);
				}
			}

			throw err;
		}
	}

	// CORE APIS
	async createInvestorProfile(body: any) {
		return this.call("/user/onboarding/initiate", "POST", {
			...body,
			partnerCode: "FINTEKPRO",
		});
	}

	async fetchProducts(type: "mf" | "pms" | "aif" | "fd") {
		switch (type) {
			case "mf":
				return this.call("/sif/schemes");
			case "pms":
				return this.call("/pms/links");
			case "aif":
				return this.call("/aif/links");
			case "fd":
				return this.call("/user/fixed-deposit/products");
			default:
				throw new Error("Unsupported product type");
		}
	}

	async placeOrder(orderPayload: any) {
		return this.call("/sif/transactions/purchase", "POST", {
			...orderPayload,
			partnerCode: "FINTEKPRO",
		});
	}

	async getOrderStatus(orderId: string) {
		return this.call(`/sif/transactions/orders/${orderId}`);
	}

	async fetchPortfolio(pan: string) {
		return this.call(`/reports/portfolio-summary/${encodeURIComponent(pan)}`);
	}
}

export const irisClient = new IrisClient();
