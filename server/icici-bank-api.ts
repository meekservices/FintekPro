import * as crypto from "crypto";
import axios, { AxiosInstance } from "axios";

export interface ICICIBankConfig {
	appKey: string;
	secretKey: string;
	baseUrl: string;
	environment: "sandbox" | "uat" | "production";
}

export interface ICICIBankResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	code?: string;
	message?: string;
}

export interface AccountBalance {
	accountNumber: string;
	availableBalance: number;
	ledgerBalance: number;
	currency: string;
	accountType: string;
	lastUpdated: string;
}

export interface TransactionRecord {
	transactionId: string;
	accountNumber: string;
	amount: number;
	transactionType: "CREDIT" | "DEBIT";
	description: string;
	referenceNumber: string;
	valueDate: string;
	transactionDate: string;
	balance: number;
}

export interface PaymentRequest {
	accountNumber: string;
	beneficiaryAccountNumber: string;
	beneficiaryIFSC: string;
	amount: number;
	purpose: string;
	remarks?: string;
	beneficiaryName: string;
}

export interface PaymentResponse {
	transactionId: string;
	referenceNumber: string;
	status: "SUCCESS" | "PENDING" | "FAILED";
	amount: number;
	charges?: number;
	message: string;
}

// Loan Origination System (LOS) Interfaces
export interface LoanApplication {
	applicationId?: string;
	loanType: "personal" | "home" | "business" | "education" | "vehicle";
	applicantDetails: {
		firstName: string;
		lastName: string;
		middleName?: string;
		dateOfBirth: string;
		panNumber: string;
		aadharNumber?: string;
		mobileNumber: string;
		emailId: string;
		fatherName?: string;
		motherName?: string;
		spouseName?: string;
		maritalStatus: "single" | "married" | "divorced" | "widowed";
		nationality: string;
		residentialStatus: "resident" | "nri" | "pio" | "oci";
	};
	addressDetails: {
		currentAddress: {
			addressLine1: string;
			addressLine2?: string;
			city: string;
			state: string;
			pincode: string;
			addressType: "owned" | "rented" | "family";
			yearsAtAddress: number;
		};
		permanentAddress?: {
			addressLine1: string;
			addressLine2?: string;
			city: string;
			state: string;
			pincode: string;
			isSameAsCurrent: boolean;
		};
	};
	employmentDetails: {
		employmentType:
			| "salaried"
			| "self_employed"
			| "business"
			| "professional"
			| "retired";
		companyName?: string;
		designation?: string;
		workExperience?: number;
		companyAddress?: {
			addressLine1: string;
			city: string;
			state: string;
			pincode: string;
		};
		monthlyIncome: number;
		annualIncome: number;
		incomeProof: string[]; // Document types
	};
	loanDetails: {
		loanAmount: number;
		tenure: number; // in months
		purpose: string;
		collateral?: {
			type: string;
			value: number;
			description: string;
		};
	};
	bankingDetails: {
		accountNumber: string;
		ifscCode: string;
		bankName: string;
		accountType: "savings" | "current";
		accountHolderName: string;
	};
	documents: {
		type: string;
		fileName: string;
		fileUrl: string;
		verified: boolean;
	}[];
	cibilConsent: boolean;
	termsAccepted: boolean;
	applicationDate: string;
}

export interface LoanApplicationResponse {
	applicationId: string;
	status:
		| "submitted"
		| "under_review"
		| "approved"
		| "rejected"
		| "pending_documents";
	loanAmount: number;
	sanctionedAmount?: number;
	interestRate?: number;
	tenure?: number;
	emi?: number;
	processingFee?: number;
	message: string;
	nextSteps?: string[];
	documentsRequired?: string[];
	applicationDate: string;
	expectedDecisionDate?: string;
}

export interface LoanStatusResponse {
	applicationId: string;
	currentStatus:
		| "submitted"
		| "document_verification"
		| "credit_check"
		| "underwriting"
		| "approved"
		| "rejected"
		| "disbursed";
	statusHistory: {
		status: string;
		timestamp: string;
		remarks?: string;
	}[];
	loanDetails?: {
		sanctionedAmount: number;
		interestRate: number;
		tenure: number;
		emi: number;
		processingFee: number;
	};
	disbursementDetails?: {
		disbursementDate: string;
		disbursementAmount: number;
		accountCredited: string;
	};
	nextAction?: {
		actionRequired: string;
		deadline?: string;
		description: string;
	};
}

export interface CreditScoreResponse {
	cibilScore: number;
	scoreDate: string;
	factors: {
		factor: string;
		impact: "positive" | "negative" | "neutral";
		description: string;
	}[];
	recommendations: string[];
}

export class ICICIBankAPI {
	private client: AxiosInstance;
	private config: ICICIBankConfig;

	constructor(config: ICICIBankConfig) {
		this.config = config;

		// Set base URL based on environment
		const baseUrls = {
			sandbox: "https://apigwuat.icicibank.com",
			uat: "https://apigwuat.icicibank.com",
			production: "https://apigw.icicibank.com",
		};

		this.client = axios.create({
			baseURL: baseUrls[config.environment] || baseUrls.sandbox,
			timeout: 30000,
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				"X-Application-Key": config.appKey,
			},
		});

		// Add request interceptor for authentication
		this.client.interceptors.request.use(
			(request) => {
				const timestamp = Date.now().toString();
				const jsonData = request.data ? JSON.stringify(request.data) : "";
				const checksum = this.generateChecksum(timestamp, jsonData);

				request.headers["X-Timestamp"] = timestamp;
				request.headers["X-Checksum"] = checksum;

				return request;
			},
			(error) => Promise.reject(error),
		);
	}

	private generateChecksum(timestamp: string, jsonData: string): string {
		const dataToHash = timestamp + jsonData + this.config.secretKey;
		return crypto.createHash("sha256").update(dataToHash).digest("hex");
	}

	/**
	 * Get account balance for a specific account
	 */
	async getAccountBalance(
		accountNumber: string,
	): Promise<ICICIBankResponse<AccountBalance>> {
		try {
			const response = await this.client.post("/api/v1/accounts/balance", {
				accountNumber: accountNumber,
			});

			return {
				success: true,
				data: {
					accountNumber: response.data.accountNumber,
					availableBalance: Number.parseFloat(response.data.availableBalance),
					ledgerBalance: Number.parseFloat(response.data.ledgerBalance),
					currency: response.data.currency || "INR",
					accountType: response.data.accountType,
					lastUpdated: new Date().toISOString(),
				},
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.response?.data?.message || error.message,
				code: error.response?.status?.toString(),
			};
		}
	}

	/**
	 * Get transaction history for an account
	 */
	async getTransactionHistory(
		accountNumber: string,
		fromDate: string,
		toDate: string,
		limit: number = 100,
	): Promise<ICICIBankResponse<TransactionRecord[]>> {
		try {
			const response = await this.client.post("/api/v1/accounts/transactions", {
				accountNumber,
				fromDate,
				toDate,
				limit,
			});

			const transactions =
				response.data.transactions?.map((txn: any) => ({
					transactionId: txn.transactionId,
					accountNumber: txn.accountNumber,
					amount: Number.parseFloat(txn.amount),
					transactionType: txn.transactionType,
					description: txn.description,
					referenceNumber: txn.referenceNumber,
					valueDate: txn.valueDate,
					transactionDate: txn.transactionDate,
					balance: Number.parseFloat(txn.balance),
				})) || [];

			return {
				success: true,
				data: transactions,
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.response?.data?.message || error.message,
				code: error.response?.status?.toString(),
			};
		}
	}

	/**
	 * Make IMPS payment
	 */
	async makeIMPSPayment(
		paymentRequest: PaymentRequest,
	): Promise<ICICIBankResponse<PaymentResponse>> {
		try {
			const response = await this.client.post("/api/v1/payments/imps", {
				debitAccount: paymentRequest.accountNumber,
				creditAccount: paymentRequest.beneficiaryAccountNumber,
				ifscCode: paymentRequest.beneficiaryIFSC,
				amount: paymentRequest.amount,
				purpose: paymentRequest.purpose,
				remarks: paymentRequest.remarks || "",
				beneficiaryName: paymentRequest.beneficiaryName,
				transactionDate: new Date().toISOString().split("T")[0],
			});

			return {
				success: true,
				data: {
					transactionId: response.data.transactionId,
					referenceNumber: response.data.referenceNumber,
					status: response.data.status,
					amount: Number.parseFloat(response.data.amount),
					charges: response.data.charges
						? Number.parseFloat(response.data.charges)
						: 0,
					message: response.data.message,
				},
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.response?.data?.message || error.message,
				code: error.response?.status?.toString(),
			};
		}
	}

	/**
	 * Get payment status
	 */
	async getPaymentStatus(
		transactionId: string,
	): Promise<ICICIBankResponse<{ status: string; message: string }>> {
		try {
			const response = await this.client.post("/api/v1/payments/status", {
				transactionId,
			});

			return {
				success: true,
				data: {
					status: response.data.status,
					message: response.data.message,
				},
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.response?.data?.message || error.message,
				code: error.response?.status?.toString(),
			};
		}
	}

	/**
	 * Validate account number and IFSC code
	 */
	async validateAccount(
		accountNumber: string,
		ifscCode: string,
	): Promise<ICICIBankResponse<{ valid: boolean; accountName?: string }>> {
		try {
			const response = await this.client.post("/api/v1/accounts/validate", {
				accountNumber,
				ifscCode,
			});

			return {
				success: true,
				data: {
					valid: response.data.valid,
					accountName: response.data.accountName,
				},
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.response?.data?.message || error.message,
				code: error.response?.status?.toString(),
			};
		}
	}

	/**
	 * Get account statement
	 */
	async getAccountStatement(
		accountNumber: string,
		fromDate: string,
		toDate: string,
		format: "pdf" | "excel" = "pdf",
	): Promise<ICICIBankResponse<{ downloadUrl: string; fileSize: number }>> {
		try {
			const response = await this.client.post("/api/v1/accounts/statement", {
				accountNumber,
				fromDate,
				toDate,
				format,
			});

			return {
				success: true,
				data: {
					downloadUrl: response.data.downloadUrl,
					fileSize: response.data.fileSize,
				},
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.response?.data?.message || error.message,
				code: error.response?.status?.toString(),
			};
		}
	}

	/**
	 * Submit loan application to ICICI Bank LOS
	 */
	async submitLoanApplication(
		application: LoanApplication,
	): Promise<ICICIBankResponse<LoanApplicationResponse>> {
		try {
			const response = await this.client.post("/api/v1/loans/apply", {
				loanType: application.loanType,
				applicantDetails: application.applicantDetails,
				addressDetails: application.addressDetails,
				employmentDetails: application.employmentDetails,
				loanDetails: application.loanDetails,
				bankingDetails: application.bankingDetails,
				documents: application.documents,
				cibilConsent: application.cibilConsent,
				termsAccepted: application.termsAccepted,
				channel: "api",
				source: "partner",
				timestamp: new Date().toISOString(),
			});

			return {
				success: true,
				data: {
					applicationId: response.data.applicationId,
					status: response.data.status,
					loanAmount: response.data.loanAmount,
					sanctionedAmount: response.data.sanctionedAmount,
					interestRate: response.data.interestRate,
					tenure: response.data.tenure,
					emi: response.data.emi,
					processingFee: response.data.processingFee,
					message: response.data.message,
					nextSteps: response.data.nextSteps,
					documentsRequired: response.data.documentsRequired,
					applicationDate: response.data.applicationDate,
					expectedDecisionDate: response.data.expectedDecisionDate,
				},
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.response?.data?.message || error.message,
				code: error.response?.status?.toString(),
			};
		}
	}

	/**
	 * Get loan application status
	 */
	async getLoanStatus(
		applicationId: string,
	): Promise<ICICIBankResponse<LoanStatusResponse>> {
		try {
			const response = await this.client.post("/api/v1/loans/status", {
				applicationId,
			});

			return {
				success: true,
				data: {
					applicationId: response.data.applicationId,
					currentStatus: response.data.currentStatus,
					statusHistory: response.data.statusHistory,
					loanDetails: response.data.loanDetails,
					disbursementDetails: response.data.disbursementDetails,
					nextAction: response.data.nextAction,
				},
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.response?.data?.message || error.message,
				code: error.response?.status?.toString(),
			};
		}
	}

	/**
	 * Check CIBIL credit score
	 */
	async getCreditScore(
		panNumber: string,
		mobileNumber: string,
	): Promise<ICICIBankResponse<CreditScoreResponse>> {
		try {
			const response = await this.client.post("/api/v1/credit/score", {
				panNumber,
				mobileNumber,
				consentDate: new Date().toISOString(),
			});

			return {
				success: true,
				data: {
					cibilScore: response.data.cibilScore,
					scoreDate: response.data.scoreDate,
					factors: response.data.factors,
					recommendations: response.data.recommendations,
				},
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.response?.data?.message || error.message,
				code: error.response?.status?.toString(),
			};
		}
	}

	/**
	 * Upload loan documents
	 */
	async uploadLoanDocument(
		applicationId: string,
		documentType: string,
		fileName: string,
		fileContent: Buffer,
	): Promise<ICICIBankResponse<{ documentId: string; status: string }>> {
		try {
			const formData = new FormData();
			formData.append("applicationId", applicationId);
			formData.append("documentType", documentType);
			formData.append("file", new Blob([fileContent as any]), fileName);

			const response = await this.client.post(
				"/api/v1/loans/documents/upload",
				formData,
				{
					headers: {
						"Content-Type": "multipart/form-data",
					},
				},
			);

			return {
				success: true,
				data: {
					documentId: response.data.documentId,
					status: response.data.status,
				},
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.response?.data?.message || error.message,
				code: error.response?.status?.toString(),
			};
		}
	}

	/**
	 * Get loan eligibility
	 */
	async getLoanEligibility(
		loanType: string,
		monthlyIncome: number,
		existingEmi: number,
		loanAmount: number,
		tenure: number,
	): Promise<
		ICICIBankResponse<{
			eligible: boolean;
			maxAmount: number;
			interestRate: number;
			emi: number;
		}>
	> {
		try {
			const response = await this.client.post("/api/v1/loans/eligibility", {
				loanType,
				monthlyIncome,
				existingEmi,
				loanAmount,
				tenure,
			});

			return {
				success: true,
				data: {
					eligible: response.data.eligible,
					maxAmount: response.data.maxAmount,
					interestRate: response.data.interestRate,
					emi: response.data.emi,
				},
			};
		} catch (error: any) {
			return {
				success: false,
				error: error.response?.data?.message || error.message,
				code: error.response?.status?.toString(),
			};
		}
	}

	/**
	 * Health check for API connectivity
	 */
	async healthCheck(): Promise<
		ICICIBankResponse<{ status: string; timestamp: string }>
	> {
		try {
			const response = await this.client.get("/api/v1/health");

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
				error:
					error.response?.data?.message ||
					error.message ||
					"Health check failed",
				code: error.response?.status?.toString(),
			};
		}
	}
}

// Export configured instance
export const iciciBankAPI = new ICICIBankAPI({
	appKey: process.env.ICICI_BANK_APP_KEY || "",
	secretKey: process.env.ICICI_BANK_SECRET_KEY || "",
	baseUrl: process.env.ICICI_BANK_BASE_URL || "",
	environment:
		(process.env.ICICI_BANK_ENVIRONMENT as "sandbox" | "uat" | "production") ||
		"sandbox",
});
