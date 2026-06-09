/**
 * Cached Verification Service
 *
 * Wraps Cashfree and Sandbox verification services with cache-first pattern.
 *
 * Cache Strategy:
 * - PAN Verification: 24 months (per SEBI KYC norms)
 * - Aadhaar Verification: 24 months
 * - GSTIN Verification: 24 months
 * - Bank Account: 24 months
 */

import { CashfreePANService } from "./cashfree-pan-service";
import { SandboxKYCService } from "./sandbox-kyc-service";
import { dataCacheService, hashIdentifier } from "./unified-data-cache-service";

export interface CachedVerificationResult {
	verified: boolean;
	fromCache: boolean;
	registeredName?: string;
	nameMatchScore?: number;
	status?: string;
	additionalData?: any;
	provider?: string;
	verifiedAt?: Date;
	expiresAt?: Date;
}

export class CachedVerificationService {
	private sandboxService = new SandboxKYCService();

	/**
	 * Verify PAN with cache-first pattern
	 * Uses 24-month cache per SEBI KYC norms
	 */
	async verifyPAN(
		pan: string,
		name: string,
		requestedBy?: string,
	): Promise<CachedVerificationResult> {
		const panUpper = pan.toUpperCase();

		// 1. Check cache first
		const cached = await dataCacheService.getVerificationResult(
			"pan",
			panUpper,
		);
		if (cached) {
			console.log(
				`[CachedVerification] Cache HIT for PAN: ${panUpper.slice(0, 4)}****`,
			);
			return {
				verified: cached.verified,
				fromCache: true,
				registeredName: cached.registered_name,
				nameMatchScore: cached.name_match_score,
				status: cached.verification_status,
				additionalData:
					typeof cached.additional_data === "string"
						? JSON.parse(cached.additional_data)
						: cached.additional_data,
				provider: cached.provider,
				verifiedAt: new Date(cached.verified_at),
				expiresAt: new Date(cached.expires_at),
			};
		}

		console.log(
			`[CachedVerification] Cache MISS for PAN: ${panUpper.slice(0, 4)}****, calling Cashfree API`,
		);

		// 2. Call Cashfree API
		const apiResult = await CashfreePANService.verifyPAN(panUpper, name);

		// 3. Save to cache with 24-month TTL
		if (apiResult.success && apiResult.data) {
			await dataCacheService.saveVerificationResult({
				type: "pan",
				identifier: panUpper,
				verified: apiResult.verified,
				verificationStatus: apiResult.data.panStatus,
				registeredName: apiResult.data.registeredName,
				nameMatchScore: apiResult.data.nameMatchScore,
				additionalData: {
					type: apiResult.data.type,
					aadhaarSeedingStatus: apiResult.data.aadhaarSeedingStatus,
					nameMatchResult: apiResult.data.nameMatchResult,
				},
				provider: "cashfree-pan",
				providerReferenceId: apiResult.data.referenceId?.toString(),
				requestedBy,
				requestContext: "kyc_verification",
			});

			// Track API usage
			await dataCacheService.trackApiUsage(
				"cashfree-pan",
				"pan_verification",
				false,
				hashIdentifier(panUpper),
			);
		}

		return {
			verified: apiResult.verified,
			fromCache: false,
			registeredName: apiResult.data?.registeredName,
			nameMatchScore: apiResult.data?.nameMatchScore,
			status: apiResult.data?.panStatus,
			additionalData: apiResult.data,
			provider: "cashfree-pan",
		};
	}

	/**
	 * Verify GSTIN with cache-first pattern
	 */
	async verifyGSTIN(
		gstin: string,
		requestedBy?: string,
	): Promise<CachedVerificationResult> {
		const gstinUpper = gstin.toUpperCase();

		// 1. Check cache first
		const cached = await dataCacheService.getVerificationResult(
			"gstin",
			gstinUpper,
		);
		if (cached) {
			console.log(
				`[CachedVerification] Cache HIT for GSTIN: ${gstinUpper.slice(0, 4)}****`,
			);
			return {
				verified: cached.verified,
				fromCache: true,
				registeredName: cached.registered_name,
				status: cached.verification_status,
				additionalData:
					typeof cached.additional_data === "string"
						? JSON.parse(cached.additional_data)
						: cached.additional_data,
				provider: cached.provider,
				verifiedAt: new Date(cached.verified_at),
				expiresAt: new Date(cached.expires_at),
			};
		}

		console.log(
			`[CachedVerification] Cache MISS for GSTIN: ${gstinUpper.slice(0, 4)}****, calling Sandbox API`,
		);

		// 2. Call Sandbox API
		try {
			const apiResult = await this.sandboxService.verifyGSTIN(gstinUpper);

			// 3. Save to cache
			await dataCacheService.saveVerificationResult({
				type: "gstin",
				identifier: gstinUpper,
				verified: apiResult.gstinStatus === "Active",
				verificationStatus: apiResult.gstinStatus,
				registeredName: apiResult.legalNameOfBusiness,
				additionalData: {
					tradeName: apiResult.tradeName,
					businessType: apiResult.businessType,
					dateOfRegistration: apiResult.dateOfRegistration,
					taxpayerType: apiResult.taxpayerType,
					principalPlace: apiResult.principalPlaceOfBusiness,
				},
				provider: "sandbox-gstin",
				requestedBy,
				requestContext: "kyc_verification",
			});

			await dataCacheService.trackApiUsage(
				"sandbox-gstin",
				"gstin_verification",
				false,
				hashIdentifier(gstinUpper),
			);

			return {
				verified: apiResult.gstinStatus === "Active",
				fromCache: false,
				registeredName: apiResult.legalNameOfBusiness,
				status: apiResult.gstinStatus,
				additionalData: apiResult,
				provider: "sandbox-gstin",
			};
		} catch (error: any) {
			console.error(
				"[CachedVerification] GSTIN verification failed:",
				error.message,
			);
			return {
				verified: false,
				fromCache: false,
				status: "ERROR",
				additionalData: { error: error.message },
			};
		}
	}

	/**
	 * Verify company by CIN with cache-first pattern
	 */
	async verifyCompanyByCIN(
		cin: string,
		requestedBy?: string,
	): Promise<CachedVerificationResult> {
		const cinUpper = cin.toUpperCase();

		// 1. Check company master cache first (permanent)
		const cached = await dataCacheService.getCompanyByCIN(cinUpper);
		if (cached) {
			console.log(`[CachedVerification] Cache HIT for CIN: ${cinUpper}`);
			return {
				verified: cached.company_status === "Active",
				fromCache: true,
				registeredName: cached.company_name,
				status: cached.company_status,
				additionalData: {
					pan: cached.pan,
					gstin: cached.gstin,
					registeredAddress: cached.registered_address,
					dateOfIncorporation: cached.date_of_incorporation,
					authorizedCapital: cached.authorized_capital,
					paidUpCapital: cached.paid_up_capital,
					directors: cached.directors,
				},
				provider: cached.data_source,
				verifiedAt: new Date(cached.last_verified_at),
			};
		}

		console.log(
			`[CachedVerification] Cache MISS for CIN: ${cinUpper}, calling Sandbox API`,
		);

		// 2. Call Sandbox MCA API
		try {
			const apiResult =
				await this.sandboxService.getMCACompanyDetails(cinUpper);

			// 3. Save to permanent company cache
			await dataCacheService.saveCompanyToCache({
				cin: cinUpper,
				pan: undefined, // MCA doesn't return PAN
				companyName: apiResult.companyName,
				companyStatus: apiResult.companyStatus,
				companyClass: apiResult.companyClass,
				companyCategory: apiResult.companyCategory,
				dateOfIncorporation: apiResult.dateOfIncorporation
					? new Date(apiResult.dateOfIncorporation)
					: undefined,
				registrationNumber: apiResult.registrationNumber,
				registeredAddress: apiResult.registeredAddress,
				authorizedCapital:
					Number.parseFloat(
						apiResult.authorizedCapital?.replace(/[^0-9.]/g, ""),
					) || undefined,
				paidUpCapital:
					Number.parseFloat(apiResult.paidUpCapital?.replace(/[^0-9.]/g, "")) ||
					undefined,
				directors: apiResult.directors,
				dataSource: "sandbox",
			});

			await dataCacheService.trackApiUsage(
				"sandbox-mca",
				"mca_company",
				false,
				cinUpper,
			);

			return {
				verified: apiResult.companyStatus === "Active",
				fromCache: false,
				registeredName: apiResult.companyName,
				status: apiResult.companyStatus,
				additionalData: apiResult,
				provider: "sandbox-mca",
			};
		} catch (error: any) {
			console.error(
				"[CachedVerification] CIN verification failed:",
				error.message,
			);
			return {
				verified: false,
				fromCache: false,
				status: "ERROR",
				additionalData: { error: error.message },
			};
		}
	}

	/**
	 * Get cache statistics for monitoring
	 */
	async getCacheStats() {
		return dataCacheService.getCacheStats();
	}
}

// Singleton instance
export const cachedVerificationService = new CachedVerificationService();
