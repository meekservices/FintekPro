/**
 * NPS (National Pension System) Service
 *
 * Connects to NPS Central Recordkeeping Agency (CRA) to fetch:
 * - Tier I and Tier II account details
 * - Current balances and asset allocation
 * - Contribution history
 * - PRAN (Permanent Retirement Account Number) details
 *
 * NPS is a government-sponsored pension scheme regulated by PFRDA
 */

import axios from "axios";

export interface NPSAccount {
	pran: string; // Permanent Retirement Account Number
	accountHolderName: string;
	tier: "Tier I" | "Tier II" | "Both";
	tierIBalance: number;
	tierIIBalance: number;
	totalBalance: number;
	fundManager: string;
	scheme: string; // Active Choice (E, C, G) or Auto Choice (LC, LC-50, LC-75)
	status: "active" | "frozen" | "closed";
}

export interface NPSAssetAllocation {
	equityPercent: number; // E - Equity
	corporateBondPercent: number; // C - Corporate Bonds
	governmentBondPercent: number; // G - Government Bonds
	alternativePercent: number; // A - Alternative Assets
}

export interface NPSContribution {
	date: string;
	tier: "Tier I" | "Tier II";
	amount: number;
	contributionType: "employee" | "employer" | "self" | "voluntary";
	transactionId: string;
}

export interface NPSHolding {
	pran: string;
	accountHolderName: string;
	dateOfBirth: string;
	tier: "Tier I" | "Tier II" | "Both";
	// Tier I Details
	tierIBalance: number;
	tierIContributions: number;
	tierIReturns: number;
	tierIAssetAllocation: NPSAssetAllocation;
	// Tier II Details
	tierIIBalance: number;
	tierIIContributions: number;
	tierIIReturns: number;
	tierIIAssetAllocation: NPSAssetAllocation | null;
	// Total
	totalBalance: number;
	totalContributions: number;
	totalReturns: number;
	returnsPercentage: number;
	// Account Details
	fundManager: string;
	scheme: string;
	nominee: string;
	nomineeRelation: string;
	registrationDate: string;
	lastContributionDate: string | null;
	status: "active" | "frozen" | "closed";
}

export interface NPSFetchRequest {
	panNumber: string;
	dateOfBirth: string; // YYYY-MM-DD
	name: string;
	mobile?: string;
}

export interface NPSFetchResponse {
	success: boolean;
	accounts: NPSAccount[];
	holdings: NPSHolding[];
	totalBalance: number;
	totalContributions: number;
	totalReturns: number;
	returnsPercentage: number;
	message?: string;
	fetchedAt: string;
}

export class NPSService {
	private apiBaseUrl: string;
	private apiKey: string;
	private useMockData: boolean;

	constructor() {
		this.apiBaseUrl =
			process.env.NPS_CRA_API_URL || "https://api.npscra.gov.in/v1";
		this.apiKey = process.env.NPS_CRA_API_KEY || "";
		this.useMockData = !this.apiKey;
	}

	private hasValidCredentials(): boolean {
		return !!this.apiKey;
	}

	private getComingSoonResponse(): NPSFetchResponse {
		return {
			success: false,
			accounts: [],
			holdings: [],
			totalBalance: 0,
			totalContributions: 0,
			totalReturns: 0,
			returnsPercentage: 0,
			message:
				"Coming Soon - NPS CRA integration will be available once API credentials are configured. Please contact support to enable this feature.",
			fetchedAt: new Date().toISOString(),
		};
	}

	/**
	 * Fetch NPS accounts and holdings for a user
	 */
	async fetchNPSAccounts(request: NPSFetchRequest): Promise<NPSFetchResponse> {
		try {
			console.log(`🔍 Fetching NPS accounts for user...`);

			if (!this.hasValidCredentials()) {
				console.log("⏳ NPS CRA API credentials not configured - Coming Soon");
				return this.getComingSoonResponse();
			}

			// Production NPS CRA API call
			return await this.fetchFromNPSCRA(request);
		} catch (error) {
			console.error("❌ Error fetching NPS accounts:", error);
			return {
				success: false,
				accounts: [],
				holdings: [],
				totalBalance: 0,
				totalContributions: 0,
				totalReturns: 0,
				returnsPercentage: 0,
				message:
					error instanceof Error ? error.message : "Failed to fetch NPS data",
				fetchedAt: new Date().toISOString(),
			};
		}
	}

	/**
	 * Production API call to NPS CRA
	 */
	private async fetchFromNPSCRA(
		request: NPSFetchRequest,
	): Promise<NPSFetchResponse> {
		try {
			// Authenticate with NPS CRA
			const authResponse = await axios.post(`${this.apiBaseUrl}/auth/token`, {
				client_id: this.apiKey,
				grant_type: "client_credentials",
			});

			const accessToken = authResponse.data.access_token;

			// Fetch PRAN using PAN and DOB
			const pranResponse = await axios.post(
				`${this.apiBaseUrl}/accounts/lookup`,
				{
					pan: request.panNumber,
					dob: request.dateOfBirth,
					name: request.name,
				},
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
						"Content-Type": "application/json",
					},
				},
			);

			if (!pranResponse.data.pran) {
				return {
					success: true,
					accounts: [],
					holdings: [],
					totalBalance: 0,
					totalContributions: 0,
					totalReturns: 0,
					returnsPercentage: 0,
					message: "No NPS account found",
					fetchedAt: new Date().toISOString(),
				};
			}

			// Fetch account details
			const accountResponse = await axios.get(
				`${this.apiBaseUrl}/accounts/${pranResponse.data.pran}`,
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				},
			);

			// Parse and normalize response
			return this.parseNPSResponse(accountResponse.data);
		} catch (error) {
			throw new Error(
				`NPS CRA API error: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Parse NPS CRA API response
	 */
	private parseNPSResponse(data: any): NPSFetchResponse {
		const accounts: NPSAccount[] = [];
		const holdings: NPSHolding[] = [];

		// Parse account data
		const pran = data.pran;
		const hasTierI = data.tier_i?.is_active;
		const hasTierII = data.tier_ii?.is_active;

		const tierIBalance = Number.parseFloat(data.tier_i?.current_balance || "0");
		const tierIIBalance = Number.parseFloat(
			data.tier_ii?.current_balance || "0",
		);
		const totalBalance = tierIBalance + tierIIBalance;

		accounts.push({
			pran,
			accountHolderName: data.subscriber_name,
			tier: hasTierI && hasTierII ? "Both" : hasTierI ? "Tier I" : "Tier II",
			tierIBalance,
			tierIIBalance,
			totalBalance,
			fundManager: data.pension_fund_name || "Not assigned",
			scheme: data.investment_option || "Auto Choice",
			status: data.account_status,
		});

		// Parse holdings with detailed info
		const tierIContributions = Number.parseFloat(
			data.tier_i?.total_contributions || "0",
		);
		const tierIIContributions = Number.parseFloat(
			data.tier_ii?.total_contributions || "0",
		);
		const totalContributions = tierIContributions + tierIIContributions;
		const totalReturns = totalBalance - totalContributions;
		const returnsPercentage =
			totalContributions > 0 ? (totalReturns / totalContributions) * 100 : 0;

		holdings.push({
			pran,
			accountHolderName: data.subscriber_name,
			dateOfBirth: data.date_of_birth,
			tier: hasTierI && hasTierII ? "Both" : hasTierI ? "Tier I" : "Tier II",
			tierIBalance,
			tierIContributions,
			tierIReturns: tierIBalance - tierIContributions,
			tierIAssetAllocation: data.tier_i?.asset_allocation || {
				equityPercent: 0,
				corporateBondPercent: 0,
				governmentBondPercent: 0,
				alternativePercent: 0,
			},
			tierIIBalance,
			tierIIContributions,
			tierIIReturns: tierIIBalance - tierIIContributions,
			tierIIAssetAllocation: hasTierII
				? data.tier_ii?.asset_allocation || null
				: null,
			totalBalance,
			totalContributions,
			totalReturns,
			returnsPercentage,
			fundManager: data.pension_fund_name || "Not assigned",
			scheme: data.investment_option || "Auto Choice",
			nominee: data.nominee_name || "",
			nomineeRelation: data.nominee_relation || "",
			registrationDate: data.registration_date,
			lastContributionDate: data.last_contribution_date || null,
			status: data.account_status,
		});

		return {
			success: true,
			accounts,
			holdings,
			totalBalance,
			totalContributions,
			totalReturns,
			returnsPercentage,
			fetchedAt: new Date().toISOString(),
		};
	}
}
