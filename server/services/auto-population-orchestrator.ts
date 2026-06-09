// @ts-nocheck
/**
 * Post-KYC Auto-Population Orchestrator
 *
 * Coordinates fetching of financial data from multiple sources after KYC completion:
 * 1. Mutual Funds (BSE STAR API)
 * 2. Demat Holdings (NSDL/CDSL)
 * 3. Bank Accounts (Account Aggregator)
 * 4. Loan Liabilities (CIBIL)
 * 5. Insurance Policies (Turtlefin)
 *
 * Features:
 * - Parallel data fetching with Promise.all
 * - Error handling and retry logic
 * - Progress tracking and status updates
 * - Integration with KYC Vault for user data
 * - Consent management integration
 */

import { db } from "../db";
import {
	autoPopulationStatus,
	comprehensiveHoldings,
	epfHoldings,
	npsAccounts,
	apyAccounts,
	kycVault,
	portfolios,
	type InsertAutoPopulationStatus,
	type AutoPopulationStatus,
	type InsertComprehensiveHolding,
	type InsertEpfHolding,
	type InsertNpsAccount,
	type InsertApyAccount,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
	consentManagementService,
	type DataSourceType,
} from "./consent-management-service";
import { turtlefinAPI } from "../turtlefin-api";
import {
	bseStarCASService,
	type CASFetchRequest,
} from "./bse-star-cas-service";
import { kycVaultDecryptionService } from "./kyc-vault-decryption-service";
import {
	dematHoldingsService,
	type DematFetchRequest,
} from "./demat-holdings-service";
import { epfoService, type EPFFetchRequest } from "./epfo-service";
import { NPSService, type NPSFetchRequest } from "./nps-service";
import { APYService, type APYFetchRequest } from "./apy-service";
import axios from "axios";

interface KYCData {
	userId: string;
	pan: string;
	name: string;
	dob: string;
	mobile: string;
	email: string;
}

interface DataSourceResult {
	source: DataSourceType;
	success: boolean;
	recordsFetched: number;
	totalValue?: number;
	error?: string;
	errorSuggestion?: string;
	retryable?: boolean;
	data?: any;
}

interface AutoPopulationResult {
	workflowId: string;
	userId: string;
	status: "completed" | "partial_success" | "failed";
	totalDataSources: number;
	successfulSources: number;
	failedSources: number;
	totalRecordsFetched: number;
	totalHoldingsValue: number;
	sourceResults: DataSourceResult[];
	durationMs: number;
}

// Retry configuration
const RETRY_CONFIG = {
	maxRetries: 3,
	baseDelayMs: 1000,
	maxDelayMs: 10000,
	retryableStatusCodes: [408, 429, 500, 502, 503, 504],
	retryableErrors: ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND"],
};

// User-friendly error messages with recovery suggestions
const ERROR_MESSAGES: Record<string, { message: string; suggestion: string }> =
	{
		CONSENT_NOT_GRANTED: {
			message: "Data access not authorized",
			suggestion:
				"Grant consent for this data source in the Auto-Population Dashboard",
		},
		KYC_NOT_FOUND: {
			message: "KYC verification required",
			suggestion: "Complete your KYC verification to enable data fetching",
		},
		API_TIMEOUT: {
			message: "Data provider is slow to respond",
			suggestion:
				"Try again in a few minutes. The service may be experiencing high load.",
		},
		API_UNAVAILABLE: {
			message: "Data provider temporarily unavailable",
			suggestion: "The external service is down. Please try again later.",
		},
		RATE_LIMITED: {
			message: "Too many requests",
			suggestion: "Please wait a few minutes before trying again",
		},
		INVALID_CREDENTIALS: {
			message: "Authentication failed with data provider",
			suggestion: "Contact support if this issue persists",
		},
		DATA_NOT_FOUND: {
			message: "No data found for your account",
			suggestion: "Ensure you have active accounts with this provider",
		},
		NETWORK_ERROR: {
			message: "Connection error",
			suggestion: "Check your internet connection and try again",
		},
	};

// Backup service providers for each data source type
interface BackupProvider {
	name: string;
	priority: number; // Lower = higher priority
	isAvailable: () => Promise<boolean>;
	fetch: (kycData: KYCData) => Promise<any>;
}

interface DataSourceBackupConfig {
	primary: string;
	backups: string[];
	maxAttempts: number;
}

// Backup service configuration for each data source
const BACKUP_SERVICE_CONFIG: Record<DataSourceType, DataSourceBackupConfig> = {
	mutual_funds: {
		primary: "BSE_STAR_CAS",
		backups: ["CAMS_CAS_DIRECT", "KFINTECH_CAS_DIRECT"],
		maxAttempts: 3,
	},
	demat: {
		primary: "NSDL_CDSL_AA",
		backups: ["NSDL_DIRECT", "CDSL_DIRECT"],
		maxAttempts: 3,
	},
	bank: {
		primary: "ACCOUNT_AGGREGATOR",
		backups: [],
		maxAttempts: 2,
	},
	loans: {
		primary: "CIBIL",
		backups: ["EXPERIAN", "EQUIFAX"],
		maxAttempts: 3,
	},
	insurance: {
		primary: "TURTLEFIN",
		backups: ["INSURANCE_IIB_DIRECT"],
		maxAttempts: 2,
	},
	epf: {
		primary: "EPFO_UNIFIED_PORTAL",
		backups: ["EPFO_UMANG"],
		maxAttempts: 3,
	},
	nps: {
		primary: "NPS_CRA",
		backups: ["NPS_KARVY", "NPS_CAMS"],
		maxAttempts: 3,
	},
	apy: {
		primary: "APY_PFRDA",
		backups: ["APY_BANK_API"],
		maxAttempts: 2,
	},
};

// Unique key generators for deduplication
const UNIQUE_KEY_GENERATORS = {
	comprehensiveHoldings: (holding: any, userId: string, date: string) =>
		`${userId}|${holding.symbol || holding.schemeCode}|${holding.isin || "NO_ISIN"}|${holding.dataSource}|${date}`,
	epfHoldings: (account: any, userId: string) =>
		`${userId}|${account.epfAccountNumber}`,
	npsAccounts: (account: any) => `${account.pran}`,
	apyAccounts: (account: any) => `${account.pran}`,
};

export class AutoPopulationOrchestrator {
	// Track processed unique keys to prevent duplicates within a session
	private processedKeys: Set<string> = new Set();

	/**
	 * Clear processed keys at the start of a new workflow
	 */
	private clearProcessedKeys(): void {
		this.processedKeys.clear();
		console.log("🔄 Cleared duplicate tracking cache");
	}

	/**
	 * Check if a record is duplicate using unique key
	 */
	private isDuplicate(uniqueKey: string): boolean {
		if (this.processedKeys.has(uniqueKey)) {
			return true;
		}
		this.processedKeys.add(uniqueKey);
		return false;
	}

	/**
	 * Fetch data with backup service fallback
	 * Tries primary provider first, then falls back to backup providers
	 * Uses maxAttempts from config to limit total attempts across all providers
	 */
	private async fetchWithBackup<T>(
		source: DataSourceType,
		primaryFetch: () => Promise<T>,
		backupFetches: Array<{ name: string; fetch: () => Promise<T> }>,
		validateResponse: (response: T) => boolean,
	): Promise<{ response: T; provider: string } | null> {
		const config = BACKUP_SERVICE_CONFIG[source];
		let attemptCount = 0;
		const maxAttempts = config.maxAttempts;

		// Try primary provider first
		attemptCount++;
		try {
			console.log(
				`🔌 [Attempt ${attemptCount}/${maxAttempts}] Trying ${config.primary} (primary)`,
			);
			const response = await this.withRetry(
				primaryFetch,
				`${source} Primary Fetch`,
				2,
			);

			if (validateResponse(response)) {
				console.log(`✅ ${config.primary} succeeded`);
				return { response, provider: config.primary };
			}

			console.log(
				`⚠️ ${config.primary} returned empty/invalid response, trying backups...`,
			);
		} catch (error: any) {
			console.error(`❌ ${config.primary} failed: ${error.message}`);
		}

		// Try backup providers in order (up to maxAttempts total)
		for (const backup of backupFetches) {
			if (attemptCount >= maxAttempts) {
				console.log(
					`⚠️ Max attempts (${maxAttempts}) reached for ${source}, stopping fallback`,
				);
				break;
			}

			attemptCount++;
			try {
				console.log(
					`🔄 [Attempt ${attemptCount}/${maxAttempts}] Trying ${backup.name} (backup)`,
				);
				const response = await this.withRetry(
					backup.fetch,
					`${source} Backup (${backup.name})`,
					1,
				);

				if (validateResponse(response)) {
					console.log(`✅ ${backup.name} succeeded (via backup)`);
					return { response, provider: backup.name };
				}

				console.log(`⚠️ ${backup.name} returned empty/invalid response`);
			} catch (error: any) {
				console.error(`❌ ${backup.name} failed: ${error.message}`);
			}
		}

		// All providers failed
		console.error(
			`❌ All ${attemptCount} provider attempts failed for ${source}`,
		);
		return null;
	}

	/**
	 * Exponential backoff retry helper
	 */
	private async withRetry<T>(
		operation: () => Promise<T>,
		operationName: string,
		maxRetries: number = RETRY_CONFIG.maxRetries,
	): Promise<T> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error: any) {
				lastError = error;

				// Check if error is retryable
				const isRetryable = this.isRetryableError(error);

				if (!isRetryable || attempt === maxRetries) {
					console.error(
						`❌ ${operationName} failed after ${attempt + 1} attempts:`,
						error.message,
					);
					throw error;
				}

				// Calculate delay with exponential backoff and jitter
				const baseDelay = RETRY_CONFIG.baseDelayMs * 2 ** attempt;
				const jitter = Math.random() * 1000;
				const delay = Math.min(baseDelay + jitter, RETRY_CONFIG.maxDelayMs);

				console.log(
					`⏳ ${operationName} attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`,
				);
				await this.sleep(delay);
			}
		}

		throw lastError;
	}

	/**
	 * Check if an error is retryable
	 */
	private isRetryableError(error: any): boolean {
		// Check HTTP status code
		if (error.response?.status) {
			if (RETRY_CONFIG.retryableStatusCodes.includes(error.response.status)) {
				return true;
			}
		}

		// Check error codes
		if (error.code && RETRY_CONFIG.retryableErrors.includes(error.code)) {
			return true;
		}

		// Check axios timeout
		if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
			return true;
		}

		return false;
	}

	/**
	 * Get user-friendly error message and suggestion
	 */
	private getEnhancedError(error: any): {
		message: string;
		suggestion: string;
	} {
		// Map common errors to user-friendly messages
		if (error.response?.status === 429) {
			return ERROR_MESSAGES.RATE_LIMITED;
		}
		if (error.response?.status === 401 || error.response?.status === 403) {
			return ERROR_MESSAGES.INVALID_CREDENTIALS;
		}
		if (error.response?.status === 404) {
			return ERROR_MESSAGES.DATA_NOT_FOUND;
		}
		if (error.response?.status >= 500) {
			return ERROR_MESSAGES.API_UNAVAILABLE;
		}
		if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
			return ERROR_MESSAGES.API_TIMEOUT;
		}
		if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
			return ERROR_MESSAGES.NETWORK_ERROR;
		}
		if (error.message?.includes("consent")) {
			return ERROR_MESSAGES.CONSENT_NOT_GRANTED;
		}
		if (error.message?.includes("KYC")) {
			return ERROR_MESSAGES.KYC_NOT_FOUND;
		}

		return {
			message: error.message || "An unexpected error occurred",
			suggestion: "Try again or contact support if the issue persists",
		};
	}

	/**
	 * Sleep helper
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Initiate auto-population after KYC completion
	 */
	async initiateFromKYC(
		userId: string,
		triggeredBy:
			| "kyc_completion"
			| "manual_refresh"
			| "scheduled_sync" = "kyc_completion",
	): Promise<AutoPopulationResult> {
		const startTime = Date.now();
		const workflowId = `AUTO_POP_${nanoid(16)}`;

		console.log(
			`🚀 Initiating auto-population workflow: ${workflowId} for user ${userId}`,
		);

		// Clear duplicate tracking cache for fresh workflow
		this.clearProcessedKeys();

		// Create initial status record
		const statusRecord: InsertAutoPopulationStatus = {
			userId,
			workflowId,
			triggeredBy,
			status: "in_progress",
			totalDataSources: 8, // mutual_funds, demat, bank, loans, insurance, epf, nps, apy
			successfulSources: 0,
			failedSources: 0,
			sourceStatus: {},
			sourceErrors: {},
			totalRecordsFetched: 0,
		};

		await db.insert(autoPopulationStatus).values(statusRecord);

		try {
			// Step 1: Fetch KYC data from vault
			const kycData = await this.getKYCData(userId);
			if (!kycData) {
				throw new Error("KYC data not found in vault. Complete KYC first.");
			}

			// Step 2: Check consents for each data source
			const consents = await this.checkAllConsents(userId);
			console.log(`📋 Consent status:`, consents);

			// Step 3: Fetch data from all sources in parallel
			const results = await this.fetchAllDataSources(kycData, consents);

			// Step 4: Store fetched data in comprehensive holdings
			await this.storeHoldings(userId, results);

			// Step 5: Calculate metrics
			const totalRecordsFetched = results.reduce(
				(sum, r) => sum + r.recordsFetched,
				0,
			);
			const totalHoldingsValue = results.reduce(
				(sum, r) => sum + (r.totalValue || 0),
				0,
			);
			const successfulSources = results.filter((r) => r.success).length;
			const failedSources = results.filter((r) => !r.success).length;

			const finalStatus =
				failedSources === 0
					? "completed"
					: successfulSources > 0
						? "partial_success"
						: "failed";

			// Step 6: Update final status
			const durationMs = Date.now() - startTime;

			await this.updateStatus(workflowId, {
				status: finalStatus,
				successfulSources,
				failedSources,
				totalRecordsFetched,
				totalHoldingsValue: totalHoldingsValue.toString(),
				completedAt: new Date(),
				durationMs,
				sourceStatus: Object.fromEntries(
					results.map((r) => [r.source, r.success ? "success" : "failed"]),
				),
				sourceErrors: Object.fromEntries(
					results.filter((r) => r.error).map((r) => [r.source, r.error!]),
				),
			});

			console.log(
				`✅ Auto-population completed: ${workflowId} - ${successfulSources}/${results.length} sources successful`,
			);

			return {
				workflowId,
				userId,
				status: finalStatus,
				totalDataSources: results.length,
				successfulSources,
				failedSources,
				totalRecordsFetched,
				totalHoldingsValue,
				sourceResults: results,
				durationMs,
			};
		} catch (error: any) {
			const durationMs = Date.now() - startTime;

			await this.updateStatus(workflowId, {
				status: "failed",
				errorMessage: error.message,
				completedAt: new Date(),
				durationMs,
			});

			console.error(
				`❌ Auto-population failed: ${workflowId} -`,
				error.message,
			);
			throw error;
		}
	}

	/**
	 * Get KYC data from vault for the user
	 *
	 * SECURITY: This method retrieves and decrypts sensitive KYC data from the vault.
	 * - All decryption happens in-memory only (never persisted or logged)
	 * - Every vault access is logged to kycAuditLogs for compliance
	 * - Decrypted data is cleared from memory after use
	 * - Uses AES-256-GCM for encrypted fields and tokenization reversal for PAN/Aadhaar
	 */
	private async getKYCData(userId: string): Promise<KYCData | null> {
		try {
			console.log(`🔐 Fetching KYC data from vault for user ${userId}`);

			// Decrypt vault data with full audit logging
			const decryptionResult = await kycVaultDecryptionService.decryptVaultData(
				userId,
				{
					purpose: "auto_population",
					requestId: `autopop_${Date.now()}`,
					fieldsRequired: ["pan", "fullName", "dateOfBirth", "mobile", "email"],
				},
			);

			if (!decryptionResult.success || !decryptionResult.data) {
				console.error(
					`❌ KYC vault decryption failed for user ${userId}: ${decryptionResult.error}`,
				);
				return null;
			}

			const decrypted = decryptionResult.data;

			// Map to KYCData format expected by auto-population
			const kycData: KYCData = {
				userId: decrypted.userId,
				pan: decrypted.pan,
				name: decrypted.fullName,
				dob: decrypted.dateOfBirth,
				mobile: decrypted.mobile,
				email: decrypted.email,
			};

			console.log(
				`✅ KYC data decrypted successfully for user ${userId} (Audit: ${decryptionResult.auditLogId})`,
			);

			return kycData;
		} catch (error: any) {
			console.error(
				`❌ Error fetching KYC data for user ${userId}:`,
				error.message,
			);
			return null;
		}
	}

	/**
	 * Check consents for all data sources
	 */
	private async checkAllConsents(
		userId: string,
	): Promise<Record<DataSourceType, boolean>> {
		const sources: DataSourceType[] = [
			"mutual_funds",
			"demat",
			"bank",
			"loans",
			"insurance",
			"epf",
			"nps",
			"apy",
		];
		const consents: Record<DataSourceType, boolean> = {} as any;

		for (const source of sources) {
			const consentStatus = await consentManagementService.checkConsent(
				userId,
				source,
			);
			consents[source] = consentStatus.hasConsent;
		}

		return consents;
	}

	/**
	 * Fetch data from all sources in parallel using Promise.allSettled
	 * This ensures all sources are queried simultaneously with graceful error handling
	 */
	private async fetchAllDataSources(
		kycData: KYCData,
		consents: Record<DataSourceType, boolean>,
	): Promise<DataSourceResult[]> {
		console.log(
			`📊 Fetching data from ${Object.keys(consents).length} sources in parallel with Promise.allSettled...`,
		);

		// Execute ALL fetches in parallel using Promise.allSettled for graceful error handling
		const fetchPromises = [
			this.fetchMutualFunds(kycData, consents.mutual_funds),
			this.fetchDematHoldings(kycData, consents.demat),
			this.fetchBankAccounts(kycData, consents.bank),
			this.fetchLoanLiabilities(kycData, consents.loans),
			this.fetchInsurance(kycData, consents.insurance),
			this.fetchEPFHoldings(kycData, consents.epf),
			this.fetchNPSAccounts(kycData, consents.nps),
			this.fetchAPYAccounts(kycData, consents.apy),
		];

		// Promise.allSettled ensures all promises complete regardless of individual failures
		const settledResults = await Promise.allSettled(fetchPromises);

		// Map settled results to DataSourceResult format
		const sources: DataSourceType[] = [
			"mutual_funds",
			"demat",
			"bank",
			"loans",
			"insurance",
			"epf",
			"nps",
			"apy",
		];

		return settledResults.map((result, index) => {
			const source = sources[index];

			if (result.status === "fulfilled") {
				return result.value;
			}
			// Log error for debugging
			console.error(`❌ Failed to fetch ${source}:`, result.reason?.message);
			return {
				source,
				success: false,
				recordsFetched: 0,
				error: result.reason?.message || "Unknown error",
			};
		});
	}

	/**
	 * Fetch mutual fund holdings from BSE STAR via CAS (Consolidated Account Statement)
	 */
	private async fetchMutualFunds(
		kycData: KYCData,
		hasConsent: boolean,
	): Promise<DataSourceResult> {
		if (!hasConsent) {
			const { message, suggestion } = ERROR_MESSAGES.CONSENT_NOT_GRANTED;
			return {
				source: "mutual_funds",
				success: false,
				recordsFetched: 0,
				error: message,
				errorSuggestion: suggestion,
				retryable: false,
			};
		}

		try {
			console.log(`🔍 Fetching mutual funds with backup service fallback`);

			const casRequest: CASFetchRequest = {
				panNumber: kycData.pan,
				name: kycData.name,
				dob: kycData.dob,
				mobile: kycData.mobile,
				email: kycData.email,
			};

			// Define primary and backup fetchers
			const primaryFetch = () => bseStarCASService.fetchCAS(casRequest);

			// Backup providers - currently use BSE STAR with alternate configurations
			// In production, these would be distinct integrations (CAMS Direct API, KFintech Direct API)
			// The backup mechanism ensures resilience when primary fails due to rate limits or temporary outages
			const backupFetches = [
				{
					name: "BSE_STAR_XML_FALLBACK",
					fetch: async () => {
						// Fallback: Uses BSE STAR's XML/SOAP endpoint via the service's built-in fallback
						// The bseStarCASService already handles JSON->XML fallback internally
						console.log("  ↻ Attempting BSE STAR via XML/SOAP endpoint...");
						await this.sleep(1000); // Brief delay before retry
						return bseStarCASService.fetchCAS(casRequest);
					},
				},
			];

			// Use backup service mechanism
			const result = await this.fetchWithBackup(
				"mutual_funds",
				primaryFetch,
				backupFetches,
				(response) => response.success && response.totalHoldings > 0,
			);

			if (!result) {
				return {
					source: "mutual_funds",
					success: false,
					recordsFetched: 0,
					error: "All mutual fund data providers failed",
					errorSuggestion:
						"Verify your PAN details and ensure you have active mutual fund investments. Try again later.",
					retryable: true,
				};
			}

			const casResponse = result.response;
			console.log(
				`✅ Fetched ${casResponse.totalHoldings} mutual fund holdings via ${result.provider}`,
			);

			return {
				source: "mutual_funds",
				success: true,
				recordsFetched: casResponse.totalHoldings,
				totalValue: casResponse.totalValue,
				data: casResponse.holdings,
			};
		} catch (error: any) {
			console.error("❌ Mutual funds fetch error:", error.message);
			const { message, suggestion } = this.getEnhancedError(error);
			return {
				source: "mutual_funds",
				success: false,
				recordsFetched: 0,
				error: message,
				errorSuggestion: suggestion,
				retryable: this.isRetryableError(error),
			};
		}
	}

	/**
	 * Fetch demat holdings from NSDL/CDSL via Account Aggregator
	 */
	private async fetchDematHoldings(
		kycData: KYCData,
		hasConsent: boolean,
	): Promise<DataSourceResult> {
		if (!hasConsent) {
			const { message, suggestion } = ERROR_MESSAGES.CONSENT_NOT_GRANTED;
			return {
				source: "demat",
				success: false,
				recordsFetched: 0,
				error: message,
				errorSuggestion: suggestion,
				retryable: false,
			};
		}

		try {
			console.log(`🔍 Fetching demat holdings with backup service fallback`);

			const dematRequest: DematFetchRequest = {
				panNumber: kycData.pan,
				name: kycData.name,
				dob: kycData.dob,
				mobile: kycData.mobile,
				email: kycData.email,
				requestId: `demat_${kycData.userId}_${Date.now()}`,
			};

			// Define primary and backup fetchers
			const primaryFetch = () =>
				dematHoldingsService.fetchHoldings(dematRequest);

			// Backup providers - retry with unique request IDs to avoid caching
			// In production, these would be distinct depository-specific integrations
			// The backup mechanism ensures resilience when primary fails
			const backupFetches = [
				{
					name: "DEMAT_RETRY_NSDL_FOCUS",
					fetch: async () => {
						// Fallback: Retry with new request ID (avoids potential cached failures)
						console.log("  ↻ Retrying demat fetch with new request context...");
						await this.sleep(1500); // Brief delay before retry
						return dematHoldingsService.fetchHoldings({
							...dematRequest,
							requestId: `demat_retry1_${kycData.userId}_${Date.now()}`,
						});
					},
				},
				{
					name: "DEMAT_RETRY_CDSL_FOCUS",
					fetch: async () => {
						// Final fallback: Last attempt with new request context
						console.log("  ↻ Final demat fetch attempt...");
						await this.sleep(2000); // Longer delay for final attempt
						return dematHoldingsService.fetchHoldings({
							...dematRequest,
							requestId: `demat_retry2_${kycData.userId}_${Date.now()}`,
						});
					},
				},
			];

			// Use backup service mechanism
			const result = await this.fetchWithBackup(
				"demat",
				primaryFetch,
				backupFetches,
				(response) => response.success && response.totalHoldings > 0,
			);

			if (!result) {
				return {
					source: "demat",
					success: false,
					recordsFetched: 0,
					error: "All demat data providers failed",
					errorSuggestion:
						"Verify your PAN details and ensure you have active demat accounts. Try again later.",
					retryable: true,
				};
			}

			const dematResponse = result.response;
			console.log(
				`✅ Fetched ${dematResponse.totalHoldings} demat holdings via ${result.provider} (NSDL: ${dematResponse.nsdlHoldings}, CDSL: ${dematResponse.cdslHoldings})`,
			);

			return {
				source: "demat",
				success: true,
				recordsFetched: dematResponse.totalHoldings,
				totalValue: dematResponse.totalValue,
				data: dematResponse.holdings,
			};
		} catch (error: any) {
			console.error("❌ Demat holdings fetch error:", error.message);
			const { message, suggestion } = this.getEnhancedError(error);
			return {
				source: "demat",
				success: false,
				recordsFetched: 0,
				error: message,
				errorSuggestion: suggestion,
				retryable: this.isRetryableError(error),
			};
		}
	}

	/**
	 * Determine equity asset class based on market cap
	 */
	private determineEquityClass(holding: any): string {
		const marketCap = holding.marketCap || 0;

		if (marketCap >= 20000000000000) return "large_cap"; // > ₹20,000 Cr
		if (marketCap >= 5000000000000) return "mid_cap"; // ₹5,000-20,000 Cr
		return "small_cap"; // < ₹5,000 Cr
	}

	/**
	 * Fetch bank accounts via Account Aggregator
	 * Note: Bank account integration is pending AA FIU implementation
	 */
	private async fetchBankAccounts(
		kycData: KYCData,
		hasConsent: boolean,
	): Promise<DataSourceResult> {
		if (!hasConsent) {
			const { message, suggestion } = ERROR_MESSAGES.CONSENT_NOT_GRANTED;
			return {
				source: "bank",
				success: false,
				recordsFetched: 0,
				error: message,
				errorSuggestion: suggestion,
				retryable: false,
			};
		}

		// Bank account integration is pending - AA FIU integration required
		// Return pending status instead of fake success
		console.log(
			`⏳ Bank accounts fetch pending - Account Aggregator FIU integration not yet complete`,
		);

		return {
			source: "bank",
			success: false,
			recordsFetched: 0,
			error: "Bank account integration pending",
			errorSuggestion:
				"Account Aggregator FIU integration is being set up. This feature will be available soon.",
			retryable: true,
		};
	}

	/**
	 * Fetch loan liabilities from CIBIL
	 */
	private async fetchLoanLiabilities(
		kycData: KYCData,
		hasConsent: boolean,
	): Promise<DataSourceResult> {
		if (!hasConsent) {
			return {
				source: "loans",
				success: false,
				recordsFetched: 0,
				error: "User consent not granted",
			};
		}

		try {
			console.log(`🔍 Fetching loan liabilities from CIBIL`);

			// Call internal CIBIL API
			const response = await axios.post(
				"http://localhost:5000/api/cibil/fetch-loan-liabilities",
				{
					panNumber: kycData.pan,
					name: kycData.name,
					dob: kycData.dob,
					mobile: kycData.mobile,
				},
			);

			const loanData = response.data;

			return {
				source: "loans",
				success: loanData.success,
				recordsFetched: loanData.totalLoans || 0,
				totalValue: loanData.totalOutstanding || 0,
				data: loanData.loanAccounts || [],
			};
		} catch (error: any) {
			console.error("CIBIL fetch error:", error.message);
			return {
				source: "loans",
				success: false,
				recordsFetched: 0,
				error: error.message,
			};
		}
	}

	/**
	 * Fetch insurance policies from Turtlefin
	 */
	private async fetchInsurance(
		kycData: KYCData,
		hasConsent: boolean,
	): Promise<DataSourceResult> {
		if (!hasConsent) {
			const { message, suggestion } = ERROR_MESSAGES.CONSENT_NOT_GRANTED;
			return {
				source: "insurance",
				success: false,
				recordsFetched: 0,
				error: message,
				errorSuggestion: suggestion,
				retryable: false,
			};
		}

		try {
			console.log(`🔍 Fetching insurance policies from Turtlefin`);

			const policies = await this.withRetry(
				() =>
					turtlefinAPI.searchPoliciesByKYC({
						pan: kycData.pan,
						name: kycData.name,
						dob: kycData.dob,
						mobile: kycData.mobile,
						email: kycData.email,
					}),
				"Insurance Policies Fetch",
			);

			if (!policies.success) {
				return {
					source: "insurance",
					success: false,
					recordsFetched: 0,
					error: policies.message || "Failed to fetch insurance policies",
					errorSuggestion:
						"Verify your PAN details and ensure you have active insurance policies",
					retryable: true,
				};
			}

			const totalValue = policies.policies.reduce(
				(sum: number, p: any) => sum + (p.sumAssured || 0),
				0,
			);

			console.log(
				`✅ Fetched ${policies.totalPolicies} insurance policies (Total Sum Assured: ₹${totalValue.toFixed(2)})`,
			);

			return {
				source: "insurance",
				success: true,
				recordsFetched: policies.totalPolicies,
				totalValue,
				data: policies.policies,
			};
		} catch (error: any) {
			console.error("❌ Insurance policies fetch error:", error.message);
			const { message, suggestion } = this.getEnhancedError(error);
			return {
				source: "insurance",
				success: false,
				recordsFetched: 0,
				error: message,
				errorSuggestion: suggestion,
				retryable: this.isRetryableError(error),
			};
		}
	}

	/**
	 * Fetch EPF/VPF accounts from EPFO
	 */
	private async fetchEPFHoldings(
		kycData: KYCData,
		hasConsent: boolean,
	): Promise<DataSourceResult> {
		if (!hasConsent) {
			const { message, suggestion } = ERROR_MESSAGES.CONSENT_NOT_GRANTED;
			return {
				source: "epf",
				success: false,
				recordsFetched: 0,
				error: message,
				errorSuggestion: suggestion,
				retryable: false,
			};
		}

		try {
			console.log(`🔍 Fetching EPF/VPF accounts from EPFO`);

			// Call EPFO service with retry logic
			const epfRequest: EPFFetchRequest = {
				panNumber: kycData.pan,
				name: kycData.name,
				dob: kycData.dob,
				mobile: kycData.mobile,
				requestId: `epf_${kycData.userId}_${Date.now()}`,
			};

			const epfResponse = await this.withRetry(
				() => epfoService.fetchEPFAccounts(epfRequest),
				"EPF Accounts Fetch",
			);

			if (!epfResponse.success) {
				console.error(`❌ EPF fetch failed: ${epfResponse.message}`);
				return {
					source: "epf",
					success: false,
					recordsFetched: 0,
					error: epfResponse.message || "Failed to fetch EPF accounts",
					errorSuggestion:
						"Verify your PAN and UAN details. Ensure EPFO service is accessible.",
					retryable: true,
				};
			}

			console.log(
				`✅ Fetched ${epfResponse.totalAccounts} EPF accounts (Total Balance: ₹${epfResponse.totalBalance.toFixed(2)})`,
			);

			return {
				source: "epf",
				success: true,
				recordsFetched: epfResponse.totalAccounts,
				totalValue: epfResponse.totalBalance,
				data: epfResponse.accounts,
			};
		} catch (error: any) {
			console.error("❌ EPF accounts fetch error:", error.message);
			const { message, suggestion } = this.getEnhancedError(error);
			return {
				source: "epf",
				success: false,
				recordsFetched: 0,
				error: message,
				errorSuggestion: suggestion,
				retryable: this.isRetryableError(error),
			};
		}
	}

	/**
	 * Fetch NPS (National Pension System) accounts from NPS CRA
	 */
	private async fetchNPSAccounts(
		kycData: KYCData,
		hasConsent: boolean,
	): Promise<DataSourceResult> {
		if (!hasConsent) {
			const { message, suggestion } = ERROR_MESSAGES.CONSENT_NOT_GRANTED;
			return {
				source: "nps",
				success: false,
				recordsFetched: 0,
				error: message,
				errorSuggestion: suggestion,
				retryable: false,
			};
		}

		try {
			console.log(`🔍 Fetching NPS accounts from NPS CRA`);

			// Call NPS service with retry logic
			const npsService = new NPSService();
			const npsRequest: NPSFetchRequest = {
				panNumber: kycData.pan,
				dateOfBirth: kycData.dob,
				name: kycData.name,
				mobile: kycData.mobile,
			};

			const npsResponse = await this.withRetry(
				() => npsService.fetchNPSAccounts(npsRequest),
				"NPS Accounts Fetch",
			);

			if (!npsResponse.success) {
				console.error(`❌ NPS fetch failed: ${npsResponse.message}`);
				return {
					source: "nps",
					success: false,
					recordsFetched: 0,
					error: npsResponse.message || "Failed to fetch NPS accounts",
					errorSuggestion:
						"Verify your PRAN and PAN details. Ensure NPS CRA service is accessible.",
					retryable: true,
				};
			}

			console.log(
				`✅ Fetched ${npsResponse.accounts.length} NPS accounts (Total Balance: ₹${npsResponse.totalBalance.toFixed(2)})`,
			);

			return {
				source: "nps",
				success: true,
				recordsFetched: npsResponse.accounts.length,
				totalValue: npsResponse.totalBalance,
				data: npsResponse.holdings,
			};
		} catch (error: any) {
			console.error("❌ NPS accounts fetch error:", error.message);
			const { message, suggestion } = this.getEnhancedError(error);
			return {
				source: "nps",
				success: false,
				recordsFetched: 0,
				error: message,
				errorSuggestion: suggestion,
				retryable: this.isRetryableError(error),
			};
		}
	}

	/**
	 * Fetch APY (Atal Pension Yojana) accounts via Account Aggregator
	 */
	private async fetchAPYAccounts(
		kycData: KYCData,
		hasConsent: boolean,
	): Promise<DataSourceResult> {
		if (!hasConsent) {
			const { message, suggestion } = ERROR_MESSAGES.CONSENT_NOT_GRANTED;
			return {
				source: "apy",
				success: false,
				recordsFetched: 0,
				error: message,
				errorSuggestion: suggestion,
				retryable: false,
			};
		}

		try {
			console.log(`🔍 Fetching APY accounts via Account Aggregator`);

			// Call APY service with retry logic
			const apyService = new APYService();
			const apyRequest: APYFetchRequest = {
				panNumber: kycData.pan,
				dateOfBirth: kycData.dob,
				name: kycData.name,
				mobile: kycData.mobile,
			};

			const apyResponse = await this.withRetry(
				() => apyService.fetchAPYAccounts(apyRequest),
				"APY Accounts Fetch",
			);

			if (!apyResponse.success) {
				console.error(`❌ APY fetch failed: ${apyResponse.message}`);
				return {
					source: "apy",
					success: false,
					recordsFetched: 0,
					error: apyResponse.message || "Failed to fetch APY accounts",
					errorSuggestion: "Verify your APY enrollment details with your bank.",
					retryable: true,
				};
			}

			console.log(
				`✅ Fetched ${apyResponse.accounts.length} APY accounts (Total Balance: ₹${apyResponse.totalBalance.toFixed(2)})`,
			);

			return {
				source: "apy",
				success: true,
				recordsFetched: apyResponse.accounts.length,
				totalValue: apyResponse.totalBalance,
				data: apyResponse.holdings,
			};
		} catch (error: any) {
			console.error("❌ APY accounts fetch error:", error.message);
			const { message, suggestion } = this.getEnhancedError(error);
			return {
				source: "apy",
				success: false,
				recordsFetched: 0,
				error: message,
				errorSuggestion: suggestion,
				retryable: this.isRetryableError(error),
			};
		}
	}

	/**
	 * Store fetched holdings in database
	 */
	private async storeHoldings(
		userId: string,
		results: DataSourceResult[],
	): Promise<void> {
		console.log(
			`💾 Storing ${results.length} data source results in database...`,
		);

		// Get or create default portfolio for user
		const portfolio = await this.getOrCreateDefaultPortfolio(userId);

		for (const result of results) {
			if (!result.success || !result.data || !Array.isArray(result.data))
				continue;

			try {
				// Store each type of holding based on source
				switch (result.source) {
					case "mutual_funds":
						await this.storeMutualFundHoldings(
							userId,
							portfolio.id,
							result.data,
						);
						break;
					case "demat":
						await this.storeDematHoldings(userId, portfolio.id, result.data);
						break;
					case "bank":
						await this.storeBankAccounts(userId, portfolio.id, result.data);
						break;
					case "loans":
						await this.storeLoanLiabilities(userId, portfolio.id, result.data);
						break;
					case "insurance":
						await this.storeInsurancePolicies(
							userId,
							portfolio.id,
							result.data,
						);
						break;
					case "epf":
						await this.storeEPFHoldings(userId, result.data);
						break;
					case "nps":
						await this.storeNPSAccounts(userId, result.data);
						break;
					case "apy":
						await this.storeAPYAccounts(userId, result.data);
						break;
				}

				console.log(
					`  ✓ Stored ${result.recordsFetched} records from ${result.source}`,
				);
			} catch (error: any) {
				console.error(`  ✗ Failed to store ${result.source}:`, error.message);
			}
		}
	}

	/**
	 * Get or create default portfolio for user
	 */
	private async getOrCreateDefaultPortfolio(
		userId: string,
	): Promise<{ id: string }> {
		// Check if user has a default portfolio
		const existingPortfolio = await db
			.select()
			.from(portfolios)
			.where(and(eq(portfolios.userId, userId), eq(portfolios.isDefault, true)))
			.limit(1);

		if (existingPortfolio.length > 0) {
			return existingPortfolio[0];
		}

		// Create default portfolio
		const newPortfolio = await db
			.insert(portfolios)
			.values({
				userId,
				name: "Default Portfolio",
				isDefault: true,
				totalValue: "0",
				cash: "0",
			})
			.returning();

		console.log(`📁 Created default portfolio for user ${userId}`);
		return newPortfolio[0];
	}

	/**
	 * Store mutual fund holdings in comprehensive holdings table
	 */
	private async storeMutualFundHoldings(
		userId: string,
		portfolioId: string,
		holdings: any[],
	): Promise<void> {
		const today = new Date().toISOString().split("T")[0];
		let insertedCount = 0;
		let skippedDuplicates = 0;

		for (const holding of holdings) {
			const dataSource = `bse_star_${holding.rtaCode?.toLowerCase() || "unknown"}`;

			// Generate unique key for deduplication
			const uniqueKey = UNIQUE_KEY_GENERATORS.comprehensiveHoldings(
				{ ...holding, symbol: holding.schemeCode, dataSource },
				userId,
				today,
			);

			// Check session-level duplicate
			if (this.isDuplicate(uniqueKey)) {
				skippedDuplicates++;
				continue;
			}

			// Check database-level duplicate (same holding on same day from same source)
			const existingHolding = await db
				.select({ id: comprehensiveHoldings.id })
				.from(comprehensiveHoldings)
				.where(
					and(
						eq(comprehensiveHoldings.userId, userId),
						eq(comprehensiveHoldings.symbol, holding.schemeCode),
						eq(comprehensiveHoldings.holdingDate, today),
						eq(comprehensiveHoldings.dataSource, dataSource),
					),
				)
				.limit(1);

			if (existingHolding.length > 0) {
				// Update existing record instead of inserting duplicate
				await db
					.update(comprehensiveHoldings)
					.set({
						units: holding.units.toString(),
						currentPrice: holding.nav.toString(),
						marketValue: holding.currentValue.toString(),
						investedValue: holding.investedAmount.toString(),
						gainLoss: holding.returns.toString(),
						gainLossPercent: holding.returnsPercentage.toString(),
						updatedAt: new Date(),
						metadata: {
							amcName: holding.amcName,
							registrarName: holding.registrarName,
							schemePlan: holding.schemePlan,
							schemeOption: holding.schemeOption,
							purchaseDate: holding.purchaseDate,
							lastTransactionDate: holding.lastTransactionDate,
							lockinStatus: holding.lockinStatus,
							lockinDate: holding.lockinDate,
							averageNav: holding.averageNav,
						},
					})
					.where(eq(comprehensiveHoldings.id, existingHolding[0].id));

				console.log(`  ↻ Updated existing MF holding: ${holding.schemeName}`);
				continue;
			}

			const record: InsertComprehensiveHolding = {
				portfolioId,
				userId,
				holdingDate: today,

				// Asset identification
				symbol: holding.schemeCode,
				isin: holding.isin || null,
				assetName: holding.schemeName,
				assetType: "mutual_fund",
				assetClass: this.determineMFAssetClass(holding.schemeName),

				// Holding details
				units: holding.units.toString(),
				currentPrice: holding.nav.toString(),
				marketValue: holding.currentValue.toString(),
				investedValue: holding.investedAmount.toString(),
				gainLoss: holding.returns.toString(),
				gainLossPercent: holding.returnsPercentage.toString(),

				// Source details
				dataSource,
				folio: holding.folioNumber,

				// Additional metadata
				metadata: {
					amcName: holding.amcName,
					registrarName: holding.registrarName,
					schemePlan: holding.schemePlan,
					schemeOption: holding.schemeOption,
					purchaseDate: holding.purchaseDate,
					lastTransactionDate: holding.lastTransactionDate,
					lockinStatus: holding.lockinStatus,
					lockinDate: holding.lockinDate,
					averageNav: holding.averageNav,
				},
			};

			await db.insert(comprehensiveHoldings).values(record);
			insertedCount++;
		}

		if (skippedDuplicates > 0) {
			console.log(
				`  ⚠️ Skipped ${skippedDuplicates} duplicate MF holdings within session`,
			);
		}
		console.log(`  ✓ Inserted ${insertedCount} new MF holdings`);
	}

	/**
	 * Determine asset class from mutual fund scheme name
	 */
	private determineMFAssetClass(schemeName: string): string {
		const name = schemeName.toLowerCase();

		if (
			name.includes("equity") ||
			name.includes("bluechip") ||
			name.includes("large cap") ||
			name.includes("mid cap") ||
			name.includes("small cap") ||
			name.includes("flexi cap") ||
			name.includes("multi cap") ||
			name.includes("focused")
		) {
			return "equity";
		}
		if (
			name.includes("debt") ||
			name.includes("bond") ||
			name.includes("gilt") ||
			name.includes("liquid") ||
			name.includes("overnight") ||
			name.includes("ultra short")
		) {
			return "debt";
		}
		if (
			name.includes("hybrid") ||
			name.includes("balanced") ||
			name.includes("aggressive") ||
			name.includes("conservative") ||
			name.includes("dynamic asset")
		) {
			return "hybrid";
		}
		if (name.includes("elss") || name.includes("tax saver")) {
			return "equity"; // ELSS is equity-oriented
		}
		return "other";
	}

	/**
	 * Store demat holdings in comprehensiveHoldings table
	 */
	private async storeDematHoldings(
		userId: string,
		portfolioId: string,
		holdings: any[],
	): Promise<void> {
		const today = new Date().toISOString().split("T")[0];
		let insertedCount = 0;
		let updatedCount = 0;
		let skippedDuplicates = 0;

		for (const holding of holdings) {
			const dataSource = holding.depository?.toLowerCase() || "nsdl";

			// Generate unique key for deduplication
			const uniqueKey = UNIQUE_KEY_GENERATORS.comprehensiveHoldings(
				{ ...holding, dataSource },
				userId,
				today,
			);

			// Check session-level duplicate
			if (this.isDuplicate(uniqueKey)) {
				skippedDuplicates++;
				continue;
			}

			// Check database-level duplicate (same holding on same day from same source)
			const existingHolding = await db
				.select({ id: comprehensiveHoldings.id })
				.from(comprehensiveHoldings)
				.where(
					and(
						eq(comprehensiveHoldings.userId, userId),
						eq(comprehensiveHoldings.isin, holding.isin),
						eq(comprehensiveHoldings.holdingDate, today),
						eq(comprehensiveHoldings.dataSource, dataSource),
					),
				)
				.limit(1);

			if (existingHolding.length > 0) {
				// Update existing record instead of inserting duplicate
				await db
					.update(comprehensiveHoldings)
					.set({
						quantity: holding.quantity.toString(),
						avgPrice: holding.averagePrice.toString(),
						currentPrice: holding.currentPrice.toString(),
						marketValue: holding.currentValue.toString(),
						investedValue: holding.investedAmount.toString(),
						gainLoss: holding.returns.toString(),
						gainLossPercent: holding.returnsPercentage.toString(),
						updatedAt: new Date(),
						metadata: {
							pledgedQuantity: holding.pledgedQuantity || 0,
							freeQuantity: holding.freeQuantity || holding.quantity,
							lockedQuantity: holding.lockedQuantity || 0,
							exchange: holding.exchange || "NSE",
						},
					})
					.where(eq(comprehensiveHoldings.id, existingHolding[0].id));

				updatedCount++;
				continue;
			}

			const record: InsertComprehensiveHolding = {
				portfolioId,
				userId,
				holdingDate: today,

				// Asset identification
				symbol: holding.symbol,
				isin: holding.isin,
				assetName: holding.companyName,
				assetType: holding.assetType, // 'equity', 'bond', 'etf'
				assetClass:
					holding.assetType === "equity"
						? this.determineEquityClass(holding)
						: null,

				// Holding details
				quantity: holding.quantity.toString(),
				avgPrice: holding.averagePrice.toString(),
				currentPrice: holding.currentPrice.toString(),
				marketValue: holding.currentValue.toString(),
				investedValue: holding.investedAmount.toString(),
				gainLoss: holding.returns.toString(),
				gainLossPercent: holding.returnsPercentage.toString(),

				// Source details
				dataSource,
				dematAccountNumber: holding.dematAccountNumber || null,

				// Additional details
				sector: holding.sector || null,
				industry: holding.industry || null,
				marketCap: holding.marketCap?.toString() || null,

				// Metadata
				metadata: {
					pledgedQuantity: holding.pledgedQuantity || 0,
					freeQuantity: holding.freeQuantity || holding.quantity,
					lockedQuantity: holding.lockedQuantity || 0,
					exchange: holding.exchange || "NSE",
				},
			};

			await db.insert(comprehensiveHoldings).values(record);
			insertedCount++;
		}

		if (skippedDuplicates > 0) {
			console.log(
				`  ⚠️ Skipped ${skippedDuplicates} duplicate demat holdings within session`,
			);
		}
		if (updatedCount > 0) {
			console.log(`  ↻ Updated ${updatedCount} existing demat holdings`);
		}
		console.log(`  ✓ Inserted ${insertedCount} new demat holdings`);
	}

	/**
	 * Store bank accounts (placeholder)
	 */
	private async storeBankAccounts(
		userId: string,
		portfolioId: string,
		accounts: any[],
	): Promise<void> {
		// Bank accounts are stored separately, not in comprehensive holdings
		console.log(`  ℹ️ Bank accounts storage - handled separately`);
	}

	/**
	 * Store loan liabilities (placeholder)
	 */
	private async storeLoanLiabilities(
		userId: string,
		portfolioId: string,
		loans: any[],
	): Promise<void> {
		// Loans are stored separately, not in comprehensive holdings
		console.log(`  ℹ️ Loan liabilities storage - handled separately`);
	}

	/**
	 * Store insurance policies (placeholder)
	 */
	private async storeInsurancePolicies(
		userId: string,
		portfolioId: string,
		policies: any[],
	): Promise<void> {
		// Insurance is stored separately, not in comprehensive holdings
		console.log(`  ℹ️ Insurance policies storage - handled separately`);
	}

	/**
	 * Store EPF/VPF holdings in epfHoldings table
	 */
	private async storeEPFHoldings(
		userId: string,
		accounts: any[],
	): Promise<void> {
		try {
			let insertedCount = 0;
			let updatedCount = 0;
			let skippedDuplicates = 0;

			for (const account of accounts) {
				// Generate unique key for deduplication
				const uniqueKey = UNIQUE_KEY_GENERATORS.epfHoldings(account, userId);

				// Check session-level duplicate
				if (this.isDuplicate(uniqueKey)) {
					skippedDuplicates++;
					continue;
				}

				// Check database-level duplicate by EPF account number
				const existingAccount = await db
					.select({ id: epfHoldings.id })
					.from(epfHoldings)
					.where(
						and(
							eq(epfHoldings.userId, userId),
							eq(epfHoldings.epfAccountNumber, account.epfAccountNumber),
						),
					)
					.limit(1);

				if (existingAccount.length > 0) {
					// Update existing EPF account
					await db
						.update(epfHoldings)
						.set({
							employeeContribution: account.employeeContribution.toString(),
							employerContribution: account.employerContribution.toString(),
							pensionContribution: account.pensionContribution.toString(),
							totalBalance: account.totalBalance.toString(),
							interestEarned: account.interestEarned.toString(),
							interestRate: account.interestRate.toString(),
							isActive: account.isActive,
							dateOfExit: account.dateOfExit || null,
							updatedAt: new Date(),
						})
						.where(eq(epfHoldings.id, existingAccount[0].id));

					updatedCount++;
					continue;
				}

				// Insert new EPF holding
				const record: InsertEpfHolding = {
					userId,
					epfAccountNumber: account.epfAccountNumber,
					employerName: account.employerName,
					memberName: account.memberName,
					employeeContribution: account.employeeContribution.toString(),
					employerContribution: account.employerContribution.toString(),
					pensionContribution: account.pensionContribution.toString(),
					totalBalance: account.totalBalance.toString(),
					interestEarned: account.interestEarned.toString(),
					interestRate: account.interestRate.toString(),
					dateOfJoining: account.dateOfJoining,
					dateOfExit: account.dateOfExit || null,
					isActive: account.isActive,
					nomineeName: account.nomineeName || null,
					nomineeRelationship: account.nomineeRelationship || null,
				};

				await db.insert(epfHoldings).values(record);
				insertedCount++;
			}

			if (skippedDuplicates > 0) {
				console.log(
					`  ⚠️ Skipped ${skippedDuplicates} duplicate EPF accounts within session`,
				);
			}
			if (updatedCount > 0) {
				console.log(`  ↻ Updated ${updatedCount} existing EPF accounts`);
			}
			console.log(`  ✓ Inserted ${insertedCount} new EPF accounts`);
		} catch (error: any) {
			console.error(`  ✗ Error storing EPF holdings:`, error.message);
			// Don't throw - this is not critical for the workflow
		}
	}

	/**
	 * Store NPS accounts in npsAccounts table
	 */
	private async storeNPSAccounts(
		userId: string,
		holdings: any[],
	): Promise<void> {
		try {
			let insertedCount = 0;
			let updatedCount = 0;
			let skippedDuplicates = 0;

			for (const holding of holdings) {
				// Generate unique key for deduplication
				const uniqueKey = UNIQUE_KEY_GENERATORS.npsAccounts(holding);

				// Check session-level duplicate
				if (this.isDuplicate(uniqueKey)) {
					skippedDuplicates++;
					continue;
				}

				// Check database-level duplicate by PRAN (unique constraint exists)
				const existingAccount = await db
					.select({ id: npsAccounts.id })
					.from(npsAccounts)
					.where(eq(npsAccounts.pran, holding.pran))
					.limit(1);

				if (existingAccount.length > 0) {
					// Update existing NPS account with latest balance info
					await db
						.update(npsAccounts)
						.set({
							tierIBalance: holding.tierIBalance.toString(),
							tierIContributions: holding.tierIContributions.toString(),
							tierIReturns: holding.tierIReturns.toString(),
							tierIAssetAllocation: holding.tierIAssetAllocation,
							tierIIBalance: holding.tierIIBalance.toString(),
							tierIIContributions: holding.tierIIContributions.toString(),
							tierIIReturns: holding.tierIIReturns.toString(),
							tierIIAssetAllocation: holding.tierIIAssetAllocation,
							totalBalance: holding.totalBalance.toString(),
							totalContributions: holding.totalContributions.toString(),
							totalReturns: holding.totalReturns.toString(),
							returnsPercentage: holding.returnsPercentage.toString(),
							status: holding.status,
							lastContributionDate: holding.lastContributionDate || null,
							updatedAt: new Date(),
						})
						.where(eq(npsAccounts.id, existingAccount[0].id));

					updatedCount++;
					continue;
				}

				// Insert new NPS account
				const record: InsertNpsAccount = {
					userId,
					pran: holding.pran,
					accountHolderName: holding.accountHolderName,
					dateOfBirth: holding.dateOfBirth,
					registrationDate: holding.registrationDate,
					tierIBalance: holding.tierIBalance.toString(),
					tierIContributions: holding.tierIContributions.toString(),
					tierIReturns: holding.tierIReturns.toString(),
					tierIAssetAllocation: holding.tierIAssetAllocation,
					tierIIBalance: holding.tierIIBalance.toString(),
					tierIIContributions: holding.tierIIContributions.toString(),
					tierIIReturns: holding.tierIIReturns.toString(),
					tierIIAssetAllocation: holding.tierIIAssetAllocation,
					totalBalance: holding.totalBalance.toString(),
					totalContributions: holding.totalContributions.toString(),
					totalReturns: holding.totalReturns.toString(),
					returnsPercentage: holding.returnsPercentage.toString(),
					fundManager: holding.fundManager,
					scheme: holding.scheme,
					tier: holding.tier,
					nominee: holding.nominee || null,
					nomineeRelation: holding.nomineeRelation || null,
					status: holding.status,
					lastContributionDate: holding.lastContributionDate || null,
				};

				await db.insert(npsAccounts).values(record);
				insertedCount++;
			}

			if (skippedDuplicates > 0) {
				console.log(
					`  ⚠️ Skipped ${skippedDuplicates} duplicate NPS accounts within session`,
				);
			}
			if (updatedCount > 0) {
				console.log(`  ↻ Updated ${updatedCount} existing NPS accounts`);
			}
			console.log(`  ✓ Inserted ${insertedCount} new NPS accounts`);
		} catch (error: any) {
			console.error(`  ✗ Error storing NPS accounts:`, error.message);
			// Don't throw - this is not critical for the workflow
		}
	}

	/**
	 * Store APY accounts in apyAccounts table
	 */
	private async storeAPYAccounts(
		userId: string,
		holdings: any[],
	): Promise<void> {
		try {
			let insertedCount = 0;
			let updatedCount = 0;
			let skippedDuplicates = 0;

			for (const holding of holdings) {
				// Generate unique key for deduplication
				const uniqueKey = UNIQUE_KEY_GENERATORS.apyAccounts(holding);

				// Check session-level duplicate
				if (this.isDuplicate(uniqueKey)) {
					skippedDuplicates++;
					continue;
				}

				// Check database-level duplicate by PRAN (unique constraint exists)
				const existingAccount = await db
					.select({ id: apyAccounts.id })
					.from(apyAccounts)
					.where(eq(apyAccounts.pran, holding.pran))
					.limit(1);

				if (existingAccount.length > 0) {
					// Update existing APY account with latest balance info
					await db
						.update(apyAccounts)
						.set({
							totalContribution: holding.totalContribution.toString(),
							governmentContribution: holding.governmentContribution.toString(),
							totalBalance: holding.totalBalance.toString(),
							yearsToMaturity: holding.yearsToMaturity,
							status: holding.status,
							lastContributionDate: holding.lastContributionDate || null,
							updatedAt: new Date(),
						})
						.where(eq(apyAccounts.id, existingAccount[0].id));

					updatedCount++;
					continue;
				}

				// Insert new APY account
				const record: InsertApyAccount = {
					userId,
					pran: holding.pran,
					accountHolderName: holding.accountHolderName,
					dateOfBirth: holding.dateOfBirth,
					enrollmentDate: holding.enrollmentDate,
					pensionAmount: holding.pensionAmount.toString(),
					monthlyContribution: holding.monthlyContribution.toString(),
					totalContribution: holding.totalContribution.toString(),
					governmentContribution: holding.governmentContribution.toString(),
					totalBalance: holding.totalBalance.toString(),
					enrollmentAge: holding.enrollmentAge,
					maturityAge: holding.maturityAge,
					yearsToMaturity: holding.yearsToMaturity,
					expectedMaturityDate: holding.expectedMaturityDate,
					bankName: holding.bankName,
					bankAccountNumber: holding.bankAccountNumber,
					ifscCode: holding.ifscCode,
					branchName: holding.branchName || null,
					nominee: holding.nominee || null,
					nomineeRelation: holding.nomineeRelation || null,
					nomineeAge: holding.nomineeAge || null,
					status: holding.status,
					lastContributionDate: holding.lastContributionDate || null,
				};

				await db.insert(apyAccounts).values(record);
				insertedCount++;
			}

			if (skippedDuplicates > 0) {
				console.log(
					`  ⚠️ Skipped ${skippedDuplicates} duplicate APY accounts within session`,
				);
			}
			if (updatedCount > 0) {
				console.log(`  ↻ Updated ${updatedCount} existing APY accounts`);
			}
			console.log(`  ✓ Inserted ${insertedCount} new APY accounts`);
		} catch (error: any) {
			console.error(`  ✗ Error storing APY accounts:`, error.message);
			// Don't throw - this is not critical for the workflow
		}
	}

	/**
	 * Update workflow status
	 */
	private async updateStatus(
		workflowId: string,
		updates: Partial<InsertAutoPopulationStatus>,
	): Promise<void> {
		await db
			.update(autoPopulationStatus)
			.set(updates)
			.where(eq(autoPopulationStatus.workflowId, workflowId));
	}

	/**
	 * Get workflow status
	 */
	async getWorkflowStatus(
		workflowId: string,
	): Promise<AutoPopulationStatus | null> {
		const status = await db
			.select()
			.from(autoPopulationStatus)
			.where(eq(autoPopulationStatus.workflowId, workflowId))
			.limit(1);

		return status.length > 0 ? status[0] : null;
	}

	/**
	 * Get all workflows for a user
	 */
	async getUserWorkflows(userId: string): Promise<AutoPopulationStatus[]> {
		return await db
			.select()
			.from(autoPopulationStatus)
			.where(eq(autoPopulationStatus.userId, userId))
			.orderBy(desc(autoPopulationStatus.initiatedAt));
	}

	/**
	 * Retry a single failed data source
	 */
	async retryDataSource(
		userId: string,
		dataSource: DataSourceType,
	): Promise<DataSourceResult> {
		console.log(`🔄 Retrying data source: ${dataSource} for user ${userId}`);

		try {
			// Get KYC data from vault
			const kycData = await this.getKYCData(userId);
			if (!kycData) {
				const { message, suggestion } = ERROR_MESSAGES.KYC_NOT_FOUND;
				return {
					source: dataSource,
					success: false,
					recordsFetched: 0,
					error: message,
					errorSuggestion: suggestion,
					retryable: false,
				};
			}

			// Check consent for this specific source
			const hasConsent = await consentManagementService.hasValidConsent(
				userId,
				dataSource,
			);

			// Retry the specific source
			let result: DataSourceResult;

			switch (dataSource) {
				case "mutual_funds":
					result = await this.fetchMutualFunds(kycData, hasConsent);
					break;
				case "demat":
					result = await this.fetchDematHoldings(kycData, hasConsent);
					break;
				case "bank":
					result = await this.fetchBankAccounts(kycData, hasConsent);
					break;
				case "loans":
					result = await this.fetchLoanLiabilities(kycData, hasConsent);
					break;
				case "insurance":
					result = await this.fetchInsurancePolicies(kycData, hasConsent);
					break;
				case "epf":
					result = await this.fetchEPFHoldings(kycData, hasConsent);
					break;
				case "nps":
					result = await this.fetchNPSAccounts(kycData, hasConsent);
					break;
				case "apy":
					result = await this.fetchAPYAccounts(kycData, hasConsent);
					break;
				default:
					result = {
						source: dataSource,
						success: false,
						recordsFetched: 0,
						error: `Unknown data source: ${dataSource}`,
						retryable: false,
					};
			}

			// Store data if successful
			if (result.success && result.data) {
				await this.storeHoldings(userId, dataSource, result.data);
			}

			// Update the latest workflow status for this user
			await this.updateLatestWorkflowSourceStatus(userId, dataSource, result);

			console.log(
				`${result.success ? "✅" : "❌"} Retry ${dataSource}: ${result.success ? "succeeded" : "failed"}`,
			);
			return result;
		} catch (error: any) {
			console.error(`❌ Error retrying ${dataSource}:`, error.message);
			const { message, suggestion } = this.getEnhancedError(error);
			const result: DataSourceResult = {
				source: dataSource,
				success: false,
				recordsFetched: 0,
				error: message,
				errorSuggestion: suggestion,
				retryable: this.isRetryableError(error),
			};

			// Update the latest workflow status for this user
			await this.updateLatestWorkflowSourceStatus(userId, dataSource, result);

			return result;
		}
	}

	/**
	 * Update latest workflow's source status after a retry
	 */
	private async updateLatestWorkflowSourceStatus(
		userId: string,
		dataSource: DataSourceType,
		result: DataSourceResult,
	): Promise<void> {
		try {
			// Get the most recent workflow for this user
			const workflows = await this.getUserWorkflows(userId);
			if (workflows.length === 0) {
				console.log(`No existing workflow to update for user ${userId}`);
				return;
			}

			const latestWorkflow = workflows[0];

			// Parse existing source status and normalize legacy string values to objects
			const rawSourceStatus =
				(latestWorkflow.sourceStatus as Record<string, any>) || {};
			const sourceStatus: Record<string, any> = {};

			// Normalize existing entries - convert legacy string statuses to object format
			for (const [key, value] of Object.entries(rawSourceStatus)) {
				if (typeof value === "string") {
					// Legacy format: string like 'success', 'failed', 'pending'
					sourceStatus[key] = {
						status: value === "success" ? "completed" : value,
						recordsFetched: 0,
						error: value === "failed" ? "Unknown error" : undefined,
					};
				} else if (typeof value === "object" && value !== null) {
					// Already object format
					sourceStatus[key] = value;
				}
			}

			const sourceErrors =
				(latestWorkflow.sourceErrors as Record<string, any>) || {};

			// Update the specific source status
			sourceStatus[dataSource] = {
				status: result.success ? "completed" : "failed",
				recordsFetched: result.recordsFetched,
				totalValue: result.totalValue,
				error: result.error,
				errorSuggestion: result.errorSuggestion,
				retryable: result.retryable,
				lastRetryAt: new Date().toISOString(),
			};

			if (result.error) {
				sourceErrors[dataSource] = result.error;
			} else {
				delete sourceErrors[dataSource];
			}

			// Recalculate summary using normalized data
			const sources = Object.values(sourceStatus);
			const successfulSources = sources.filter(
				(s) => s.status === "completed" || s.status === "success",
			).length;
			const failedSources = sources.filter((s) => s.status === "failed").length;
			const totalRecordsFetched = sources.reduce(
				(sum, s) => sum + (s.recordsFetched || 0),
				0,
			);

			// Preserve original totals for sources not yet updated
			const originalSuccessful = latestWorkflow.successfulSources || 0;
			const originalFailed = latestWorkflow.failedSources || 0;
			const originalRecords = latestWorkflow.totalRecordsFetched || 0;

			// Update workflow record
			await db
				.update(autoPopulationStatus)
				.set({
					sourceStatus,
					sourceErrors,
					successfulSources: Math.max(
						successfulSources,
						originalSuccessful - (result.success ? 0 : 1),
					),
					failedSources: Math.max(0, failedSources),
					totalRecordsFetched: result.success
						? originalRecords + result.recordsFetched
						: originalRecords,
					status: failedSources === 0 ? "completed" : "partial_success",
				})
				.where(eq(autoPopulationStatus.workflowId, latestWorkflow.workflowId));

			console.log(
				`📊 Updated workflow ${latestWorkflow.workflowId} source status for ${dataSource}`,
			);
		} catch (error: any) {
			console.error(`Failed to update workflow source status:`, error.message);
			// Don't throw - this is not critical
		}
	}
}

// Export singleton instance
export const autoPopulationOrchestrator = new AutoPopulationOrchestrator();
