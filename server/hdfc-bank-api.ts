import * as crypto from "crypto";
import axios, { AxiosInstance } from "axios";

export interface HDFCBankConfig {
	clientId: string;
	clientSecret: string;
	baseUrl: string;
	environment: "sandbox" | "uat" | "production";
	certificatePath?: string;
}

export interface HDFCBankResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	code?: string;
	message?: string;
	status?: string;
}

export interface HDFCAccountBalance {
	accountNumber: string;
	availableBalance: number;
	ledgerBalance: number;
	currency: string;
	accountType: string;
	accountStatus: string;
	lastUpdated: string;
	branchCode?: string;
}

export interface HDFCTransaction {
	transactionId: string;
	accountNumber: string;
	amount: number;
	transactionType: "CREDIT" | "DEBIT";
	description: string;
	referenceNumber: string;
	valueDate: string;
	transactionDate: string;
	balance: number;
	narration?: string;
	chequeNumber?: string;
}

export interface HDFCPaymentRequest {
	debitAccountNumber: string;
	creditAccountNumber: string;
	creditIFSC: string;
	amount: number;
	currency: string;
	purpose: string;
	remarks?: string;
	beneficiaryName: string;
	paymentMode: "IMPS" | "NEFT" | "RTGS";
}

export interface HDFCPaymentResponse {
	transactionId: string;
	referenceNumber: string;
	rrn?: string;
	status: "SUCCESS" | "PENDING" | "FAILED" | "PROCESSING";
	amount: number;
	charges?: number;
	message: string;
	utr?: string;
}

export interface HDFCAccountValidation {
	accountNumber: string;
	ifscCode: string;
	accountName?: string;
	bankName?: string;
	branchName?: string;
	isValid: boolean;
}

export interface HDFCStatementRequest {
	accountNumber: string;
	fromDate: string;
	toDate: string;
	format: "PDF" | "EXCEL" | "CSV";
	emailId?: string;
}

export interface OAuthToken {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token?: string;
	scope?: string;
}

export class HDFCBankAPI {
	private client: AxiosInstance;
	private config: HDFCBankConfig;
	private accessToken?: string;
	private tokenExpiry?: number;

	constructor(config: HDFCBankConfig) {
		this.config = config;

		// Set base URL based on environment
		const baseUrls = {
			sandbox: "https://api-sandbox.hdfcbank.com",
			uat: "https://api-uat.hdfcbank.com",
			production: "https://api.hdfcbank.com",
		};

		this.client = axios.create({
			baseURL:
				config.baseUrl || baseUrls[config.environment] || baseUrls.sandbox,
			timeout: 30000,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
		});

		// Add request interceptor for authentication
		this.client.interceptors.request.use(
			async (request) => {
				// Ensure we have a valid access token
				await this.ensureValidToken();

				if (this.accessToken) {
					request.headers.Authorization = `Bearer ${this.accessToken}`;
				}

				// Add correlation ID for tracking
				request.headers["X-Correlation-ID"] = this.generateCorrelationId();

				return request;
			},
			(error) => Promise.reject(error),
		);

		// Add response interceptor for error handling
		this.client.interceptors.response.use(
			(response) => response,
			async (error) => {
				if (error.response?.status === 401) {
					// Token might be expired, try to refresh
					this.accessToken = undefined;
					this.tokenExpiry = undefined;

					// Retry the request once with new token
					if (!error.config._retry) {
						error.config._retry = true;
						await this.ensureValidToken();

						if (this.accessToken) {
							error.config.headers.Authorization = `Bearer ${this.accessToken}`;
							return this.client.request(error.config);
						}
					}
				}
				return Promise.reject(error);
			},
		);
	}

	private generateCorrelationId(): string {
		return crypto.randomUUID();
	}

	private async ensureValidToken(): Promise<void> {
		const now = Date.now();

		// Check if token is still valid (with 5 minute buffer)
		if (
			this.accessToken &&
			this.tokenExpiry &&
			this.tokenExpiry - now > 300000
		) {
			return;
		}

		try {
			await this.authenticate();
		} catch (error) {
			console.error("HDFC Bank authentication failed:", error);
			throw new Error("Authentication failed");
		}
	}

	private async authenticate(): Promise<void> {
		const tokenUrl = "/oauth/token";

		const credentials = Buffer.from(
			`${this.config.clientId}:${this.config.clientSecret}`,
		).toString("base64");

		try {
			const response = await axios.post(
				`${this.client.defaults.baseURL}${tokenUrl}`,
				"grant_type=client_credentials&scope=account_balance transaction_history payments account_validation",
				{
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
						Authorization: `Basic ${credentials}`,
						Accept: "application/json",
					},
					timeout: 30000,
				},
			);

			const tokenData: OAuthToken = response.data;
			this.accessToken = tokenData.access_token;
			this.tokenExpiry = Date.now() + tokenData.expires_in * 1000;
		} catch (error: any) {
			console.error(
				"HDFC Bank OAuth authentication error:",
				error.response?.data || error.message,
			);
			throw error;
		}
	}

	async getAccountBalance(
		accountNumber: string,
	): Promise<HDFCBankResponse<HDFCAccountBalance>> {
		try {
			const response = await this.client.get(
				`/api/v1/accounts/${accountNumber}/balance`,
			);

			const balanceData = response.data;

			return {
				success: true,
				data: {
					accountNumber: balanceData.accountNumber,
					availableBalance: Number.parseFloat(
						balanceData.availableBalance || "0",
					),
					ledgerBalance: Number.parseFloat(balanceData.ledgerBalance || "0"),
					currency: balanceData.currency || "INR",
					accountType: balanceData.accountType || "SAVINGS",
					accountStatus: balanceData.accountStatus || "ACTIVE",
					lastUpdated: new Date().toISOString(),
					branchCode: balanceData.branchCode,
				},
			};
		} catch (error: any) {
			console.error(
				"HDFC Bank account balance error:",
				error.response?.data || error.message,
			);
			return {
				success: false,
				error:
					error.response?.data?.message || "Failed to fetch account balance",
				code: error.response?.data?.code || "BALANCE_ERROR",
			};
		}
	}

	async getTransactionHistory(
		accountNumber: string,
		fromDate: string,
		toDate: string,
		limit: number = 50,
	): Promise<HDFCBankResponse<HDFCTransaction[]>> {
		try {
			const params = {
				fromDate,
				toDate,
				limit: limit.toString(),
				offset: "0",
			};

			const response = await this.client.get(
				`/api/v1/accounts/${accountNumber}/transactions`,
				{ params },
			);

			const transactions = response.data.transactions || [];

			const formattedTransactions: HDFCTransaction[] = transactions.map(
				(txn: any) => ({
					transactionId: txn.transactionId || txn.id,
					accountNumber: accountNumber,
					amount: Number.parseFloat(txn.amount || "0"),
					transactionType:
						txn.type === "C" || txn.type === "CREDIT" ? "CREDIT" : "DEBIT",
					description: txn.description || txn.narration || "Transaction",
					referenceNumber: txn.referenceNumber || txn.refNumber || "",
					valueDate: txn.valueDate || txn.date,
					transactionDate: txn.transactionDate || txn.date,
					balance: Number.parseFloat(txn.balance || "0"),
					narration: txn.narration,
					chequeNumber: txn.chequeNumber,
				}),
			);

			return {
				success: true,
				data: formattedTransactions,
			};
		} catch (error: any) {
			console.error(
				"HDFC Bank transaction history error:",
				error.response?.data || error.message,
			);
			return {
				success: false,
				error:
					error.response?.data?.message ||
					"Failed to fetch transaction history",
				code: error.response?.data?.code || "TRANSACTION_ERROR",
			};
		}
	}

	async initiatePayment(
		paymentRequest: HDFCPaymentRequest,
	): Promise<HDFCBankResponse<HDFCPaymentResponse>> {
		try {
			const payload = {
				debitAccount: paymentRequest.debitAccountNumber,
				creditAccount: paymentRequest.creditAccountNumber,
				ifscCode: paymentRequest.creditIFSC,
				amount: paymentRequest.amount.toString(),
				currency: paymentRequest.currency,
				purpose: paymentRequest.purpose,
				remarks: paymentRequest.remarks || "",
				beneficiaryName: paymentRequest.beneficiaryName,
				paymentMode: paymentRequest.paymentMode,
				requestId: this.generateCorrelationId(),
			};

			const response = await this.client.post(
				"/api/v1/payments/transfer",
				payload,
			);

			const paymentData = response.data;

			return {
				success: true,
				data: {
					transactionId: paymentData.transactionId || paymentData.txnId,
					referenceNumber: paymentData.referenceNumber || paymentData.refNumber,
					rrn: paymentData.rrn,
					status: paymentData.status || "PENDING",
					amount: paymentRequest.amount,
					charges: Number.parseFloat(paymentData.charges || "0"),
					message: paymentData.message || "Payment initiated successfully",
					utr: paymentData.utr,
				},
			};
		} catch (error: any) {
			console.error(
				"HDFC Bank payment error:",
				error.response?.data || error.message,
			);
			return {
				success: false,
				error: error.response?.data?.message || "Payment failed",
				code: error.response?.data?.code || "PAYMENT_ERROR",
			};
		}
	}

	async validateAccount(
		accountNumber: string,
		ifscCode: string,
	): Promise<HDFCBankResponse<HDFCAccountValidation>> {
		try {
			const response = await this.client.post("/api/v1/accounts/validate", {
				accountNumber,
				ifscCode,
			});

			const validationData = response.data;

			return {
				success: true,
				data: {
					accountNumber,
					ifscCode,
					accountName: validationData.accountName,
					bankName: validationData.bankName || "HDFC Bank",
					branchName: validationData.branchName,
					isValid: validationData.valid || validationData.isValid || false,
				},
			};
		} catch (error: any) {
			console.error(
				"HDFC Bank account validation error:",
				error.response?.data || error.message,
			);
			return {
				success: false,
				error: error.response?.data?.message || "Account validation failed",
				code: error.response?.data?.code || "VALIDATION_ERROR",
			};
		}
	}

	async generateStatement(
		request: HDFCStatementRequest,
	): Promise<HDFCBankResponse<{ downloadUrl: string }>> {
		try {
			const response = await this.client.post("/api/v1/accounts/statement", {
				accountNumber: request.accountNumber,
				fromDate: request.fromDate,
				toDate: request.toDate,
				format: request.format,
				emailId: request.emailId,
				requestId: this.generateCorrelationId(),
			});

			const statementData = response.data;

			return {
				success: true,
				data: {
					downloadUrl:
						statementData.downloadUrl || statementData.fileUrl || "#",
				},
			};
		} catch (error: any) {
			console.error(
				"HDFC Bank statement generation error:",
				error.response?.data || error.message,
			);
			return {
				success: false,
				error: error.response?.data?.message || "Statement generation failed",
				code: error.response?.data?.code || "STATEMENT_ERROR",
			};
		}
	}

	async getPaymentStatus(
		transactionId: string,
	): Promise<HDFCBankResponse<HDFCPaymentResponse>> {
		try {
			const response = await this.client.get(
				`/api/v1/payments/status/${transactionId}`,
			);

			const statusData = response.data;

			return {
				success: true,
				data: {
					transactionId,
					referenceNumber: statusData.referenceNumber,
					rrn: statusData.rrn,
					status: statusData.status,
					amount: Number.parseFloat(statusData.amount || "0"),
					charges: Number.parseFloat(statusData.charges || "0"),
					message: statusData.message || statusData.remarks,
					utr: statusData.utr,
				},
			};
		} catch (error: any) {
			console.error(
				"HDFC Bank payment status error:",
				error.response?.data || error.message,
			);
			return {
				success: false,
				error: error.response?.data?.message || "Failed to get payment status",
				code: error.response?.data?.code || "STATUS_ERROR",
			};
		}
	}

	async healthCheck(): Promise<
		HDFCBankResponse<{ status: string; timestamp: string }>
	> {
		try {
			// Simple token validation call
			await this.ensureValidToken();

			return {
				success: true,
				data: {
					status: "healthy",
					timestamp: new Date().toISOString(),
				},
			};
		} catch (error: any) {
			return {
				success: false,
				error: "HDFC Bank API health check failed",
				code: "HEALTH_CHECK_ERROR",
			};
		}
	}
}

// Initialize the API client
export const hdfcBankAPI = new HDFCBankAPI({
	clientId: process.env.HDFC_BANK_CLIENT_ID || "",
	clientSecret: process.env.HDFC_BANK_CLIENT_SECRET || "",
	baseUrl: process.env.HDFC_BANK_BASE_URL || "",
	environment:
		(process.env.HDFC_BANK_ENVIRONMENT as "sandbox" | "uat" | "production") ||
		"sandbox",
});
