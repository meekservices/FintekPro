import * as soap from "soap";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import FormData from "form-data";
import axios from "axios";

interface CamsConfig {
	baseUrl: string;
	apiKey: string;
	memberId: string;
	password: string;
	environment: "production" | "staging" | "sandbox";
}

interface MutualFundTransaction {
	folio: string;
	scheme: string;
	amount: number;
	units?: number;
	nav?: number;
	transactionType:
		| "PURCHASE"
		| "REDEMPTION"
		| "SWITCH_IN"
		| "SWITCH_OUT"
		| "STP"
		| "SWP";
	transactionDate: string;
	settlementDate?: string;
	investorName: string;
	pan: string;
}

interface InvestorDetails {
	folio: string;
	investorName: string;
	pan: string;
	email?: string;
	mobile?: string;
	address?: string;
	nomineeName?: string;
	nomineeRelation?: string;
	kycStatus: "VERIFIED" | "PENDING" | "REJECTED";
}

interface FolioDetails {
	folio: string;
	schemeCode: string;
	schemeName: string;
	currentUnits: number;
	currentValue: number;
	nav: number;
	navDate: string;
	investorDetails: InvestorDetails;
}

interface SipDetails {
	sipId: string;
	folio: string;
	schemeCode: string;
	amount: number;
	frequency: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
	startDate: string;
	endDate?: string;
	nextInstallmentDate: string;
	status: "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";
}

export class CamsApiService {
	private config: CamsConfig;
	private xmlParser: XMLParser;
	private xmlBuilder: XMLBuilder;

	constructor() {
		this.config = {
			baseUrl: process.env.CAMS_BASE_URL || "https://camsonline.com/api",
			apiKey: process.env.CAMS_API_KEY || "",
			memberId: process.env.CAMS_MEMBER_ID || "",
			password: process.env.CAMS_PASSWORD || "",
			environment:
				(process.env.CAMS_ENVIRONMENT as
					| "production"
					| "staging"
					| "sandbox") || "sandbox",
		};

		this.xmlParser = new XMLParser({
			ignoreAttributes: false,
			parseAttributeValue: true,
			trimValues: true,
		});

		this.xmlBuilder = new XMLBuilder({
			ignoreAttributes: false,
			format: true,
		});
	}

	private getHeaders() {
		return {
			"Content-Type": "application/xml",
			Authorization: `Bearer ${this.config.apiKey}`,
			"X-Member-ID": this.config.memberId,
			Accept: "application/xml",
		};
	}

	private async makeRequest(
		endpoint: string,
		data: any,
		method: "GET" | "POST" = "POST",
	) {
		const url = `${this.config.baseUrl}/${endpoint}`;
		const headers = this.getHeaders();

		try {
			let response;

			if (method === "GET") {
				response = await axios.get(url, { headers, params: data });
			} else {
				const xmlData = this.xmlBuilder.build(data);
				response = await axios.post(url, xmlData, { headers });
			}

			if (response.data) {
				return this.xmlParser.parse(response.data);
			}

			return response.data;
		} catch (error) {
			console.error("CAMS API Error:", error);
			throw new Error(`CAMS API request failed: ${error}`);
		}
	}

	// Get investor portfolio details
	async getInvestorPortfolio(
		pan: string,
		folio?: string,
	): Promise<FolioDetails[]> {
		const requestData = {
			PortfolioRequest: {
				MemberCode: this.config.memberId,
				Password: this.config.password,
				PAN: pan,
				...(folio && { Folio: folio }),
			},
		};

		const response = await this.makeRequest("portfolio/details", requestData);

		// Parse and transform response to FolioDetails[]
		const portfolios = response?.PortfolioResponse?.FolioDetails || [];
		return Array.isArray(portfolios) ? portfolios : [portfolios];
	}

	// Get transaction history
	async getTransactionHistory(
		pan: string,
		fromDate: string,
		toDate: string,
		folio?: string,
	): Promise<MutualFundTransaction[]> {
		const requestData = {
			TransactionRequest: {
				MemberCode: this.config.memberId,
				Password: this.config.password,
				PAN: pan,
				FromDate: fromDate,
				ToDate: toDate,
				...(folio && { Folio: folio }),
			},
		};

		const response = await this.makeRequest(
			"transactions/history",
			requestData,
		);

		const transactions =
			response?.TransactionResponse?.TransactionDetails || [];
		return Array.isArray(transactions) ? transactions : [transactions];
	}

	// Create new mutual fund purchase transaction
	async createPurchaseTransaction(transaction: {
		pan: string;
		schemeCode: string;
		amount: number;
		folioNumber?: string;
		investorName: string;
		bankAccount: string;
		ifscCode: string;
	}): Promise<{ transactionId: string; status: string; message: string }> {
		const requestData = {
			PurchaseRequest: {
				MemberCode: this.config.memberId,
				Password: this.config.password,
				TransactionDetails: {
					PAN: transaction.pan,
					SchemeCode: transaction.schemeCode,
					Amount: transaction.amount,
					FolioNumber: transaction.folioNumber || "NEW",
					InvestorName: transaction.investorName,
					BankAccount: transaction.bankAccount,
					IFSCCode: transaction.ifscCode,
					TransactionType: "PURCHASE",
				},
			},
		};

		const response = await this.makeRequest(
			"transactions/purchase",
			requestData,
		);

		return {
			transactionId: response?.PurchaseResponse?.TransactionID || "",
			status: response?.PurchaseResponse?.Status || "PENDING",
			message: response?.PurchaseResponse?.Message || "Transaction submitted",
		};
	}

	// Create redemption transaction
	async createRedemptionTransaction(redemption: {
		pan: string;
		folio: string;
		schemeCode: string;
		units?: number;
		amount?: number;
		redemptionType: "FULL" | "PARTIAL";
		bankAccount: string;
		ifscCode: string;
	}): Promise<{ transactionId: string; status: string; message: string }> {
		const requestData = {
			RedemptionRequest: {
				MemberCode: this.config.memberId,
				Password: this.config.password,
				TransactionDetails: {
					PAN: redemption.pan,
					FolioNumber: redemption.folio,
					SchemeCode: redemption.schemeCode,
					RedemptionType: redemption.redemptionType,
					...(redemption.units && { Units: redemption.units }),
					...(redemption.amount && { Amount: redemption.amount }),
					BankAccount: redemption.bankAccount,
					IFSCCode: redemption.ifscCode,
					TransactionType: "REDEMPTION",
				},
			},
		};

		const response = await this.makeRequest(
			"transactions/redemption",
			requestData,
		);

		return {
			transactionId: response?.RedemptionResponse?.TransactionID || "",
			status: response?.RedemptionResponse?.Status || "PENDING",
			message: response?.RedemptionResponse?.Message || "Redemption submitted",
		};
	}

	// Setup SIP
	async setupSip(sipDetails: {
		pan: string;
		schemeCode: string;
		amount: number;
		frequency: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
		startDate: string;
		endDate?: string;
		installments?: number;
		folioNumber?: string;
		bankAccount: string;
		ifscCode: string;
	}): Promise<{ sipId: string; status: string; message: string }> {
		const requestData = {
			SIPRequest: {
				MemberCode: this.config.memberId,
				Password: this.config.password,
				SIPDetails: {
					PAN: sipDetails.pan,
					SchemeCode: sipDetails.schemeCode,
					Amount: sipDetails.amount,
					Frequency: sipDetails.frequency,
					StartDate: sipDetails.startDate,
					...(sipDetails.endDate && { EndDate: sipDetails.endDate }),
					...(sipDetails.installments && {
						NoOfInstallments: sipDetails.installments,
					}),
					FolioNumber: sipDetails.folioNumber || "NEW",
					BankAccount: sipDetails.bankAccount,
					IFSCCode: sipDetails.ifscCode,
				},
			},
		};

		const response = await this.makeRequest("sip/setup", requestData);

		return {
			sipId: response?.SIPResponse?.SIPID || "",
			status: response?.SIPResponse?.Status || "PENDING",
			message: response?.SIPResponse?.Message || "SIP setup initiated",
		};
	}

	// Get SIP details
	async getSipDetails(pan: string, sipId?: string): Promise<SipDetails[]> {
		const requestData = {
			SIPInquiryRequest: {
				MemberCode: this.config.memberId,
				Password: this.config.password,
				PAN: pan,
				...(sipId && { SIPID: sipId }),
			},
		};

		const response = await this.makeRequest("sip/inquiry", requestData);

		const sipDetails = response?.SIPInquiryResponse?.SIPDetails || [];
		return Array.isArray(sipDetails) ? sipDetails : [sipDetails];
	}

	// Cancel SIP
	async cancelSip(
		sipId: string,
		pan: string,
	): Promise<{ status: string; message: string }> {
		const requestData = {
			SIPCancelRequest: {
				MemberCode: this.config.memberId,
				Password: this.config.password,
				SIPID: sipId,
				PAN: pan,
			},
		};

		const response = await this.makeRequest("sip/cancel", requestData);

		return {
			status: response?.SIPCancelResponse?.Status || "PENDING",
			message:
				response?.SIPCancelResponse?.Message || "SIP cancellation initiated",
		};
	}

	// Get scheme details
	async getSchemeDetails(schemeCode?: string): Promise<any[]> {
		const requestData = {
			SchemeInquiryRequest: {
				MemberCode: this.config.memberId,
				Password: this.config.password,
				...(schemeCode && { SchemeCode: schemeCode }),
			},
		};

		const response = await this.makeRequest("schemes/details", requestData);

		const schemes = response?.SchemeInquiryResponse?.SchemeDetails || [];
		return Array.isArray(schemes) ? schemes : [schemes];
	}

	// Get NAV data
	async getNavData(
		schemeCode: string,
		date?: string,
	): Promise<{ nav: number; navDate: string }> {
		const requestData = {
			NAVRequest: {
				MemberCode: this.config.memberId,
				Password: this.config.password,
				SchemeCode: schemeCode,
				...(date && { Date: date }),
			},
		};

		const response = await this.makeRequest("nav/inquiry", requestData);

		return {
			nav: response?.NAVResponse?.NAV || 0,
			navDate:
				response?.NAVResponse?.NAVDate ||
				new Date().toISOString().split("T")[0],
		};
	}

	// Validate PAN and get investor details
	async validateInvestor(pan: string): Promise<{
		isValid: boolean;
		investorName?: string;
		kycStatus?: string;
		details?: any;
	}> {
		const requestData = {
			InvestorValidationRequest: {
				MemberCode: this.config.memberId,
				Password: this.config.password,
				PAN: pan,
			},
		};

		try {
			const response = await this.makeRequest("investor/validate", requestData);

			return {
				isValid: response?.ValidationResponse?.IsValid === "TRUE",
				investorName: response?.ValidationResponse?.InvestorName,
				kycStatus: response?.ValidationResponse?.KYCStatus,
				details: response?.ValidationResponse?.InvestorDetails,
			};
		} catch (error) {
			return { isValid: false };
		}
	}

	// Get statement (consolidated account statement)
	async getConsolidatedStatement(
		pan: string,
		fromDate: string,
		toDate: string,
		format: "PDF" | "EXCEL" = "PDF",
	): Promise<{ fileUrl: string; fileName: string }> {
		const requestData = {
			StatementRequest: {
				MemberCode: this.config.memberId,
				Password: this.config.password,
				PAN: pan,
				FromDate: fromDate,
				ToDate: toDate,
				Format: format,
			},
		};

		const response = await this.makeRequest("statement/generate", requestData);

		return {
			fileUrl: response?.StatementResponse?.FileURL || "",
			fileName:
				response?.StatementResponse?.FileName ||
				`statement_${pan}_${Date.now()}.${format.toLowerCase()}`,
		};
	}
}

export const camsApi = new CamsApiService();
