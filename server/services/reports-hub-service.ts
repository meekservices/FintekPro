/**
 * Reports Hub Service
 *
 * Centralized service for fetching financial reports from various sources:
 * - BSE STAR MF: Mutual Fund Holdings, Transactions, SIP, Capital Gains
 * - NSDL/CDSL: Demat holdings via Account Aggregator
 * - EPFO: EPF Passbook via Aadhaar OTP
 * - NPS CRA: NPS Statements
 * - Income Tax: AIS, Form 26AS
 */

import {
	BSEStarCASService,
	MutualFundHolding,
	CASFetchResponse,
} from "./bse-star-cas-service";

export interface ReportRequest {
	userId: string;
	panNumber: string;
	financialYear?: string;
	fromDate?: string;
	toDate?: string;
}

export interface MFHoldingsReport {
	success: boolean;
	source: string;
	fetchedAt: string;
	holdings: MutualFundHolding[];
	summary: {
		totalHoldings: number;
		totalCurrentValue: number;
		totalInvestedAmount: number;
		totalReturns: number;
		totalReturnsPercentage: number;
	};
	rtaSummary: {
		camsHoldings: number;
		karvyHoldings: number;
		franklinHoldings: number;
	};
}

export interface MFTransactionReport {
	success: boolean;
	source: string;
	fetchedAt: string;
	transactions: MFTransaction[];
	summary: {
		totalTransactions: number;
		totalPurchases: number;
		totalRedemptions: number;
		totalSwitches: number;
		totalDividends: number;
	};
}

export interface MFTransaction {
	id: string;
	folioNumber: string;
	schemeName: string;
	transactionType:
		| "Purchase"
		| "Redemption"
		| "Switch-In"
		| "Switch-Out"
		| "Dividend";
	transactionDate: string;
	units: number;
	nav: number;
	amount: number;
	status: string;
}

export interface SIPSummaryReport {
	success: boolean;
	source: string;
	fetchedAt: string;
	activeSIPs: SIPDetails[];
	summary: {
		totalActiveSIPs: number;
		totalMonthlyAmount: number;
		totalSIPsCompleted: number;
		totalSIPsPaused: number;
	};
}

export interface SIPDetails {
	id: string;
	folioNumber: string;
	schemeName: string;
	amcName: string;
	sipAmount: number;
	frequency: "Monthly" | "Quarterly" | "Weekly";
	startDate: string;
	endDate?: string;
	nextInstallmentDate: string;
	installmentsDone: number;
	totalInstallments: number;
	status: "Active" | "Paused" | "Completed" | "Cancelled";
}

export interface DematSnapshotReport {
	success: boolean;
	source: string;
	depository: "NSDL" | "CDSL";
	fetchedAt: string;
	holdings: DematHolding[];
	summary: {
		totalHoldings: number;
		totalCurrentValue: number;
		totalUnits: number;
	};
}

export interface DematHolding {
	isin: string;
	symbol: string;
	companyName: string;
	quantity: number;
	averagePrice: number;
	currentPrice: number;
	currentValue: number;
	gainLoss: number;
	gainLossPercentage: number;
	sector?: string;
}

export interface EPFPassbookReport {
	success: boolean;
	source: string;
	fetchedAt: string;
	accountDetails: {
		uanNumber: string;
		memberName: string;
		establishmentName: string;
		dateOfJoining: string;
	};
	balance: {
		employeeShare: number;
		employerShare: number;
		pensionShare: number;
		totalBalance: number;
	};
	contributions: EPFContribution[];
}

export interface EPFContribution {
	month: string;
	year: number;
	wageMonth: string;
	employeeContribution: number;
	employerContribution: number;
	pensionContribution: number;
	status: "Credited" | "Pending";
}

export interface NPSStatementReport {
	success: boolean;
	source: string;
	fetchedAt: string;
	accountDetails: {
		pranNumber: string;
		subscriberName: string;
		accountType: "Tier I" | "Tier II" | "Both";
		pfmName: string;
	};
	balances: {
		tierI: number;
		tierII: number;
		totalBalance: number;
	};
	allocation: {
		equityE: number;
		corporateBondC: number;
		governmentBondG: number;
		alternativeA: number;
	};
	contributions: NPSContribution[];
}

export interface NPSContribution {
	transactionDate: string;
	transactionType: "Contribution" | "Withdrawal";
	tier: "Tier I" | "Tier II";
	amount: number;
	nav: number;
	units: number;
}

export class ReportsHubService {
	private bseCasService: BSEStarCASService;

	constructor() {
		this.bseCasService = new BSEStarCASService();
	}

	private isBSEConfigured(): boolean {
		return this.bseCasService.isConfigured();
	}

	private isEPFOConfigured(): boolean {
		return !!process.env.EPFO_API_KEY;
	}

	private isNPSConfigured(): boolean {
		return !!process.env.NPS_CRA_API_KEY;
	}

	private isDematConfigured(): boolean {
		return !!process.env.AA_API_KEY;
	}

	/**
	 * Fetch Mutual Fund Holdings from BSE STAR MF
	 */
	async fetchMFHoldings(request: ReportRequest): Promise<MFHoldingsReport> {
		try {
			console.log(
				`📊 [Reports Hub] Fetching MF Holdings for user ${request.userId}`,
			);

			const casResponse = await this.bseCasService.fetchCAS({
				panNumber: request.panNumber,
				name: "",
				dob: "",
			});

			if (!casResponse.success) {
				return {
					success: false,
					source: "BSE STAR MF - GetHoldingReport",
					fetchedAt: new Date().toISOString(),
					holdings: [],
					summary: {
						totalHoldings: 0,
						totalCurrentValue: 0,
						totalInvestedAmount: 0,
						totalReturns: 0,
						totalReturnsPercentage: 0,
					},
					rtaSummary: {
						camsHoldings: 0,
						karvyHoldings: 0,
						franklinHoldings: 0,
					},
				};
			}

			return {
				success: true,
				source: "BSE STAR MF - GetHoldingReport",
				fetchedAt: new Date().toISOString(),
				holdings: casResponse.holdings,
				summary: {
					totalHoldings: casResponse.totalHoldings,
					totalCurrentValue: casResponse.totalValue,
					totalInvestedAmount: casResponse.totalInvestedAmount,
					totalReturns: casResponse.totalReturns,
					totalReturnsPercentage: casResponse.totalReturnsPercentage,
				},
				rtaSummary: casResponse.rtaSummary,
			};
		} catch (error) {
			console.error("Error fetching MF holdings:", error);
			throw error;
		}
	}

	/**
	 * Fetch Mutual Fund Transactions from BSE STAR MF
	 */
	async fetchMFTransactions(
		request: ReportRequest,
	): Promise<MFTransactionReport> {
		console.log(
			`📊 [Reports Hub] Fetching MF Transactions for user ${request.userId}`,
		);

		if (!this.isBSEConfigured()) {
			console.log("⏳ BSE STAR MF API not configured - Coming Soon");
			return {
				success: false,
				source: "BSE STAR MF - GetTransactionReport (Coming Soon)",
				fetchedAt: new Date().toISOString(),
				transactions: [],
				summary: {
					totalTransactions: 0,
					totalPurchases: 0,
					totalRedemptions: 0,
					totalSwitches: 0,
					totalDividends: 0,
				},
			};
		}

		// TODO: Call real BSE STAR MF Transaction API when credentials are configured
		return {
			success: true,
			source: "BSE STAR MF - GetTransactionReport",
			fetchedAt: new Date().toISOString(),
			transactions: [],
			summary: {
				totalTransactions: 0,
				totalPurchases: 0,
				totalRedemptions: 0,
				totalSwitches: 0,
				totalDividends: 0,
			},
		};
	}

	/**
	 * Fetch SIP Summary from BSE STAR MF
	 */
	async fetchSIPSummary(request: ReportRequest): Promise<SIPSummaryReport> {
		console.log(
			`📊 [Reports Hub] Fetching SIP Summary for user ${request.userId}`,
		);

		if (!this.isBSEConfigured()) {
			console.log("⏳ BSE STAR MF API not configured - Coming Soon");
			return {
				success: false,
				source: "BSE STAR MF - SIPReport (Coming Soon)",
				fetchedAt: new Date().toISOString(),
				activeSIPs: [],
				summary: {
					totalActiveSIPs: 0,
					totalMonthlyAmount: 0,
					totalSIPsCompleted: 0,
					totalSIPsPaused: 0,
				},
			};
		}

		// TODO: Call real BSE STAR MF SIP API when credentials are configured
		return {
			success: true,
			source: "BSE STAR MF - SIPReport",
			fetchedAt: new Date().toISOString(),
			activeSIPs: [],
			summary: {
				totalActiveSIPs: 0,
				totalMonthlyAmount: 0,
				totalSIPsCompleted: 0,
				totalSIPsPaused: 0,
			},
		};
	}

	/**
	 * Fetch Demat Snapshot from NSDL/CDSL via Account Aggregator
	 */
	async fetchDematSnapshot(
		request: ReportRequest,
		depository: "NSDL" | "CDSL" = "NSDL",
	): Promise<DematSnapshotReport> {
		console.log(
			`📊 [Reports Hub] Fetching ${depository} Demat Snapshot for user ${request.userId}`,
		);

		if (!this.isDematConfigured()) {
			console.log("⏳ Account Aggregator API not configured - Coming Soon");
			return {
				success: false,
				source: `Account Aggregator - ${depository} Statement API (Coming Soon)`,
				depository,
				fetchedAt: new Date().toISOString(),
				holdings: [],
				summary: {
					totalHoldings: 0,
					totalCurrentValue: 0,
					totalUnits: 0,
				},
			};
		}

		// TODO: Call real Account Aggregator API when credentials are configured
		return {
			success: true,
			source: `Account Aggregator - ${depository} Statement API`,
			depository,
			fetchedAt: new Date().toISOString(),
			holdings: [],
			summary: {
				totalHoldings: 0,
				totalCurrentValue: 0,
				totalUnits: 0,
			},
		};
	}

	/**
	 * Fetch EPF Passbook from EPFO
	 */
	async fetchEPFPassbook(request: ReportRequest): Promise<EPFPassbookReport> {
		console.log(
			`📊 [Reports Hub] Fetching EPF Passbook for user ${request.userId}`,
		);

		if (!this.isEPFOConfigured()) {
			console.log("⏳ EPFO API not configured - Coming Soon");
			return {
				success: false,
				source: "EPFO Passbook API (Coming Soon)",
				fetchedAt: new Date().toISOString(),
				accountDetails: {
					uanNumber: "",
					memberName: "",
					establishmentName: "",
					dateOfJoining: "",
				},
				balance: {
					employeeShare: 0,
					employerShare: 0,
					pensionShare: 0,
					totalBalance: 0,
				},
				contributions: [],
			};
		}

		// TODO: Call real EPFO API when credentials are configured
		return {
			success: true,
			source: "EPFO Passbook API",
			fetchedAt: new Date().toISOString(),
			accountDetails: {
				uanNumber: "",
				memberName: "",
				establishmentName: "",
				dateOfJoining: "",
			},
			balance: {
				employeeShare: 0,
				employerShare: 0,
				pensionShare: 0,
				totalBalance: 0,
			},
			contributions: [],
		};
	}

	/**
	 * Fetch NPS Statement from CRA
	 */
	async fetchNPSStatement(request: ReportRequest): Promise<NPSStatementReport> {
		console.log(
			`📊 [Reports Hub] Fetching NPS Statement for user ${request.userId}`,
		);

		if (!this.isNPSConfigured()) {
			console.log("⏳ NPS CRA API not configured - Coming Soon");
			return {
				success: false,
				source: "Protean CRA API (Coming Soon)",
				fetchedAt: new Date().toISOString(),
				accountDetails: {
					pranNumber: "",
					subscriberName: "",
					accountType: "Tier I",
					pfmName: "",
				},
				balances: {
					tierI: 0,
					tierII: 0,
					totalBalance: 0,
				},
				allocation: {
					equityE: 0,
					corporateBondC: 0,
					governmentBondG: 0,
					alternativeA: 0,
				},
				contributions: [],
			};
		}

		// TODO: Call real NPS CRA API when credentials are configured
		return {
			success: true,
			source: "Protean CRA API",
			fetchedAt: new Date().toISOString(),
			accountDetails: {
				pranNumber: "",
				subscriberName: "",
				accountType: "Tier I",
				pfmName: "",
			},
			balances: {
				tierI: 0,
				tierII: 0,
				totalBalance: 0,
			},
			allocation: {
				equityE: 0,
				corporateBondC: 0,
				governmentBondG: 0,
				alternativeA: 0,
			},
			contributions: [],
		};
	}

	/**
	 * Sync MF holdings to user's portfolio in database
	 */
	async syncMFHoldingsToPortfolio(
		userId: string,
		portfolioId: string,
		holdings: MutualFundHolding[],
	): Promise<number> {
		console.log(
			`🔄 [Reports Hub] Syncing ${holdings.length} MF holdings to portfolio ${portfolioId}`,
		);

		// In production, this would:
		// 1. Clear existing MF holdings for this portfolio
		// 2. Insert new holdings from BSE STAR
		// 3. Return the number of synced holdings

		return holdings.length;
	}
}

export const reportsHubService = new ReportsHubService();
