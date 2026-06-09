/**
 * Unified Aadhaar Verification Service
 *
 * Provider abstraction layer for Aadhaar verification
 * Supports multiple providers: Cashfree, Truthscreen
 * Admin can toggle active provider based on pricing and availability
 */

import { CashfreeAadhaarService } from "./cashfree-aadhaar-service";
import { TruthscreenAadhaarService } from "./truthscreen-aadhaar-service";
import { sandboxKYCService } from "./sandbox-kyc-service";
import { hasSandboxCredentials } from "../utils/sandbox-config";

export type AadhaarProvider =
	| "cashfree-bank"
	| "truthscreen-aadhaar"
	| "sandbox-pan"
	| "offline_xml";

export interface AadhaarProviderConfig {
	provider: AadhaarProvider;
	name: string;
	description: string;
	pricePerVerification: number;
	pricingCurrency: string;
	isActive: boolean;
	isConfigured: boolean;
	features: string[];
}

export interface AadhaarOTPResponse {
	success: boolean;
	message: string;
	refId?: string;
	status?: string;
	maskedAadhaar?: string;
	provider: AadhaarProvider;
}

export interface AadhaarVerificationResponse {
	success: boolean;
	message: string;
	verified: boolean;
	provider: AadhaarProvider;
	data?: {
		aadhaarNumber: string;
		name: string;
		dob: string;
		gender: string;
		fatherName?: string;
		address: {
			house: string;
			street: string;
			landmark: string;
			locality: string;
			city: string;
			state: string;
			pincode: string;
			country: string;
		};
		mobile?: string;
		email?: string;
		photoUrl?: string;
	};
}

export interface AadhaarValidationResponse {
	success: boolean;
	message: string;
	valid: boolean;
	maskedAadhaar?: string;
	provider: AadhaarProvider;
}

export interface PanAadhaarLinkageResponse {
	success: boolean;
	message: string;
	linked: boolean;
	linkStatus?: "LINKED" | "NOT_LINKED" | "DEACTIVATED" | "PENDING";
	pan?: string;
	aadhaarLastFour?: string;
	linkDate?: string;
	provider: AadhaarProvider;
}

interface ProviderSwitchLog {
	timestamp: Date;
	adminId: string;
	fromProvider: AadhaarProvider | null;
	toProvider: AadhaarProvider;
}

class UnifiedAadhaarService {
	private activeProvider: AadhaarProvider = "truthscreen-aadhaar";
	private providerSwitchLogs: ProviderSwitchLog[] = [];

	private providerConfigs: Map<AadhaarProvider, AadhaarProviderConfig> =
		new Map([
			[
				"cashfree-bank",
				{
					provider: "cashfree-bank",
					name: "Cashfree Aadhaar OKYC",
					description: "Cashfree Offline Aadhaar verification with OTP",
					pricePerVerification: 4.0,
					pricingCurrency: "INR",
					isActive: true,
					isConfigured: false,
					features: [
						"Aadhaar OTP",
						"eKYC Data",
						"Photo Retrieval",
						"Address Verification",
					],
				},
			],
			[
				"truthscreen-aadhaar",
				{
					provider: "truthscreen-aadhaar",
					name: "Truthscreen Aadhaar eKYC",
					description: "Truthscreen Aadhaar verification with encrypted API",
					pricePerVerification: 3.0,
					pricingCurrency: "INR",
					isActive: false,
					isConfigured: false,
					features: [
						"Aadhaar OTP",
						"eKYC Data",
						"PAN-Aadhaar Linkage",
						"Aadhaar Validation",
					],
				},
			],
			[
				"sandbox-pan",
				{
					provider: "sandbox-pan",
					name: "Sandbox.co.in Aadhaar API",
					description:
						"Government-sourced Aadhaar verification via Sandbox.co.in with UIDAI compliance",
					pricePerVerification: 2.5,
					pricingCurrency: "INR",
					isActive: false,
					isConfigured: false,
					features: [
						"Aadhaar OTP",
						"eKYC Data",
						"Government Source",
						"Bulk Verification",
						"Sandbox Testing",
					],
				},
			],
			[
				"offline_xml",
				{
					provider: "offline_xml",
					name: "Aadhaar Offline XML",
					description:
						"UIDAI-compliant offline Aadhaar XML verification with digital signature validation - no API cost",
					pricePerVerification: 0.0,
					pricingCurrency: "INR",
					isActive: false,
					isConfigured: true,
					features: [
						"No API Cost",
						"Offline Processing",
						"XML Signature Validation",
						"UIDAI Compliant",
						"Privacy-First",
					],
				},
			],
		]);

	constructor() {
		this.initializeProviderStatus();
	}

	private initializeProviderStatus(): void {
		const cashfreeConfig = this.providerConfigs.get("cashfree-bank")!;
		cashfreeConfig.isConfigured = CashfreeAadhaarService.isConfigured();

		const truthscreenConfig = this.providerConfigs.get("truthscreen-aadhaar")!;
		truthscreenConfig.isConfigured =
			TruthscreenAadhaarService.credentialsConfigured();

		const sandboxConfig = this.providerConfigs.get("sandbox-pan")!;
		sandboxConfig.isConfigured = hasSandboxCredentials();

		const offlineXmlConfig = this.providerConfigs.get("offline_xml")!;
		offlineXmlConfig.isConfigured = true;

		if (truthscreenConfig.isConfigured) {
			this.activeProvider = "truthscreen-aadhaar";
			this.providerConfigs.forEach((cfg, key) => {
				cfg.isActive = key === "truthscreen-aadhaar";
			});
		} else if (cashfreeConfig.isConfigured) {
			this.activeProvider = "cashfree-bank";
			this.providerConfigs.forEach((cfg, key) => {
				cfg.isActive = key === "cashfree-bank";
			});
		} else if (sandboxConfig.isConfigured) {
			this.activeProvider = "sandbox-pan";
			this.providerConfigs.forEach((cfg, key) => {
				cfg.isActive = key === "sandbox-pan";
			});
		}

		console.log("✅ Unified Aadhaar Verification Service initialized");
		console.log(`   Active Provider: ${this.activeProvider}`);
	}

	getActiveProvider(): AadhaarProvider {
		return this.activeProvider;
	}

	setActiveProvider(
		provider: AadhaarProvider,
		adminId: string,
	): { success: boolean; message: string } {
		const config = this.providerConfigs.get(provider);
		if (!config) {
			return { success: false, message: `Unknown provider: ${provider}` };
		}

		if (!config.isConfigured) {
			return {
				success: false,
				message: `Cannot activate ${config.name}: Provider is not configured. Please add the required API credentials first.`,
			};
		}

		const previousProvider = this.activeProvider;

		this.providerConfigs.forEach((cfg, key) => {
			cfg.isActive = key === provider;
		});
		this.activeProvider = provider;

		const logEntry: ProviderSwitchLog = {
			timestamp: new Date(),
			adminId,
			fromProvider: previousProvider,
			toProvider: provider,
		};
		this.providerSwitchLogs.push(logEntry);

		console.log(
			`[UnifiedAadhaar] Provider switched from ${previousProvider} to ${provider} by admin: ${adminId} at ${logEntry.timestamp.toISOString()}`,
		);

		return {
			success: true,
			message: `Aadhaar verification provider switched to ${config.name}`,
		};
	}

	getProviderConfigs(): AadhaarProviderConfig[] {
		return Array.from(this.providerConfigs.values()).map((config) => ({
			...config,
			isActive: config.provider === this.activeProvider,
		}));
	}

	getProviderConfig(
		provider: AadhaarProvider,
	): AadhaarProviderConfig | undefined {
		const config = this.providerConfigs.get(provider);
		if (config) {
			return {
				...config,
				isActive: config.provider === this.activeProvider,
			};
		}
		return undefined;
	}

	getProviderSwitchLogs(): ProviderSwitchLog[] {
		return [...this.providerSwitchLogs];
	}

	updateProviderPricing(
		provider: AadhaarProvider,
		pricePerVerification: number,
		adminId: string,
	): { success: boolean; message: string } {
		const config = this.providerConfigs.get(provider);
		if (!config) {
			return { success: false, message: `Unknown provider: ${provider}` };
		}

		config.pricePerVerification = pricePerVerification;
		console.log(
			`[UnifiedAadhaar] Pricing updated for ${config.name}: ₹${pricePerVerification}/verification by admin: ${adminId}`,
		);

		return {
			success: true,
			message: `Pricing updated for ${config.name}: ₹${pricePerVerification}/verification`,
		};
	}

	async generateOTP(aadhaarNumber: string): Promise<AadhaarOTPResponse> {
		const provider = this.activeProvider;
		console.log(`[UnifiedAadhaar] Generating OTP via provider: ${provider}`);

		try {
			switch (provider) {
				case "truthscreen-aadhaar": {
					const result =
						await TruthscreenAadhaarService.generateOTP(aadhaarNumber);
					return {
						success: result.success,
						message: result.message,
						refId: result.refId,
						status: result.status,
						maskedAadhaar: result.maskedAadhaar,
						provider: "truthscreen-aadhaar",
					};
				}

				case "sandbox-pan": {
					const result =
						await sandboxKYCService.generateAadhaarOTP(aadhaarNumber);
					return {
						success: true,
						message: result.message,
						refId: result.referenceId,
						status: "SUCCESS",
						provider: "sandbox-pan",
					};
				}
				default: {
					const result =
						await CashfreeAadhaarService.generateOTP(aadhaarNumber);
					return {
						success: result.success,
						message: result.message,
						refId: result.ref_id,
						status: result.status,
						maskedAadhaar: result.maskedAadhaar,
						provider: "cashfree-bank",
					};
				}
			}
		} catch (error: any) {
			console.error(
				`[UnifiedAadhaar] OTP generation error via ${provider}:`,
				error.message,
			);
			return {
				success: false,
				message: `Failed to generate OTP: ${error.message}`,
				provider,
			};
		}
	}

	async verifyOTP(
		refId: string,
		otp: string,
	): Promise<AadhaarVerificationResponse> {
		const provider = this.detectProviderFromRefId(refId);
		console.log(`[UnifiedAadhaar] Verifying OTP via provider: ${provider}`);

		try {
			switch (provider) {
				case "truthscreen-aadhaar": {
					const result = await TruthscreenAadhaarService.verifyOTP(refId, otp);
					return {
						success: result.success,
						message: result.message,
						verified: result.verified,
						provider: "truthscreen-aadhaar",
						data: result.data
							? {
									aadhaarNumber: result.data.aadhaarNumber,
									name: result.data.name,
									dob: result.data.dob,
									gender: result.data.gender,
									fatherName: result.data.fatherName,
									address: result.data.address,
									mobile: result.data.mobile,
									email: result.data.email,
									photoUrl: result.data.photoBase64
										? `data:image/jpeg;base64,${result.data.photoBase64}`
										: undefined,
								}
							: undefined,
					};
				}

				case "sandbox-pan": {
					const result = await sandboxKYCService.verifyAadhaarOTP(refId, otp);
					return {
						success: result.verified,
						message: result.verified
							? "Aadhaar verified successfully"
							: "Verification failed",
						verified: result.verified,
						provider: "sandbox-pan",
						data: {
							aadhaarNumber: result.aadhaarNumber,
							name: result.fullName,
							dob: result.dateOfBirth,
							gender: result.gender,
							address: {
								house: result.address.house,
								street: result.address.street,
								landmark: result.address.landmark,
								locality: result.address.locality,
								city: result.address.district,
								state: result.address.state,
								pincode: result.address.pincode,
								country: result.address.country,
							},
							photoUrl: result.photo
								? `data:image/jpeg;base64,${result.photo}`
								: undefined,
						},
					};
				}
				default: {
					const result = await CashfreeAadhaarService.verifyOTP(otp, refId);
					return {
						success: result.success,
						message: result.message,
						verified: result.verified,
						provider: "cashfree-bank",
						data: result.data
							? {
									aadhaarNumber: result.data.aadhaarNumber,
									name: result.data.name,
									dob: result.data.dob,
									gender: result.data.gender,
									fatherName: result.data.fatherName,
									address: result.data.address,
									mobile: result.data.mobile,
									email: result.data.email,
									photoUrl: result.data.photoUrl,
								}
							: undefined,
					};
				}
			}
		} catch (error: any) {
			console.error(
				`[UnifiedAadhaar] OTP verification error via ${provider}:`,
				error.message,
			);
			return {
				success: false,
				message: `Failed to verify OTP: ${error.message}`,
				verified: false,
				provider,
			};
		}
	}

	async validateAadhaar(
		aadhaarNumber: string,
	): Promise<AadhaarValidationResponse> {
		const provider = this.activeProvider;
		console.log(
			`[UnifiedAadhaar] Validating Aadhaar via provider: ${provider}`,
		);

		try {
			if (!/^\d{12}$/.test(aadhaarNumber)) {
				return {
					success: false,
					message: "Invalid Aadhaar number format. Must be 12 digits.",
					valid: false,
					provider,
				};
			}

			switch (provider) {
				case "truthscreen-aadhaar": {
					const result =
						await TruthscreenAadhaarService.validateAadhaar(aadhaarNumber);
					return {
						success: result.success,
						message: result.message,
						valid: result.valid,
						maskedAadhaar: result.maskedAadhaar,
						provider: "truthscreen-aadhaar",
					};
				}

				case "sandbox-pan": {
					const maskedAadhaar = `XXXX XXXX ${aadhaarNumber.slice(-4)}`;
					return {
						success: true,
						message: "Aadhaar format is valid. Proceed with OTP verification.",
						valid: true,
						maskedAadhaar,
						provider: "sandbox-pan",
					};
				}
				default: {
					const maskedAadhaar = `XXXX XXXX ${aadhaarNumber.slice(-4)}`;
					return {
						success: true,
						message:
							"Aadhaar format is valid. Use OTP verification for full validation.",
						valid: true,
						maskedAadhaar,
						provider: "cashfree-bank",
					};
				}
			}
		} catch (error: any) {
			console.error(
				`[UnifiedAadhaar] Aadhaar validation error via ${provider}:`,
				error.message,
			);
			return {
				success: false,
				message: `Failed to validate Aadhaar: ${error.message}`,
				valid: false,
				provider,
			};
		}
	}

	async checkPanAadhaarLinkage(
		pan: string,
		aadhaar: string,
	): Promise<PanAadhaarLinkageResponse> {
		const provider = this.activeProvider;
		console.log(
			`[UnifiedAadhaar] Checking PAN-Aadhaar linkage via provider: ${provider}`,
		);

		try {
			switch (provider) {
				case "truthscreen-aadhaar": {
					const result = await TruthscreenAadhaarService.checkPanAadhaarLinkage(
						pan,
						aadhaar,
					);
					return {
						success: result.success,
						message: result.message,
						linked: result.linked,
						linkStatus: result.linkStatus,
						pan: result.pan,
						aadhaarLastFour: result.aadhaarLastFour,
						linkDate: result.linkDate,
						provider: "truthscreen-aadhaar",
					};
				}
				default: {
					return {
						success: false,
						message:
							"PAN-Aadhaar linkage check is not supported by Cashfree provider. Switch to Truthscreen provider.",
						linked: false,
						provider: "cashfree-bank",
					};
				}
			}
		} catch (error: any) {
			console.error(
				`[UnifiedAadhaar] PAN-Aadhaar linkage check error via ${provider}:`,
				error.message,
			);
			return {
				success: false,
				message: `Failed to check PAN-Aadhaar linkage: ${error.message}`,
				linked: false,
				provider,
			};
		}
	}

	private detectProviderFromRefId(refId: string): AadhaarProvider {
		if (refId.startsWith("TS")) {
			return "truthscreen-aadhaar";
		}
		return this.activeProvider;
	}

	getCheapestConfiguredProvider(): AadhaarProvider | null {
		let cheapest: AadhaarProvider | null = null;
		let lowestPrice = Number.POSITIVE_INFINITY;

		this.providerConfigs.forEach((config, provider) => {
			if (config.isConfigured && config.pricePerVerification < lowestPrice) {
				lowestPrice = config.pricePerVerification;
				cheapest = provider;
			}
		});

		return cheapest;
	}

	getProviderUsageStats(): {
		provider: AadhaarProvider;
		name: string;
		switchCount: number;
		lastActive: Date | null;
	}[] {
		const stats: Map<
			AadhaarProvider,
			{ switchCount: number; lastActive: Date | null }
		> = new Map();

		this.providerConfigs.forEach((_, provider) => {
			stats.set(provider, { switchCount: 0, lastActive: null });
		});

		this.providerSwitchLogs.forEach((log) => {
			const stat = stats.get(log.toProvider);
			if (stat) {
				stat.switchCount++;
				if (!stat.lastActive || log.timestamp > stat.lastActive) {
					stat.lastActive = log.timestamp;
				}
			}
		});

		return Array.from(this.providerConfigs.entries()).map(
			([provider, config]) => {
				const stat = stats.get(provider)!;
				return {
					provider,
					name: config.name,
					switchCount: stat.switchCount,
					lastActive: stat.lastActive,
				};
			},
		);
	}
}

export const unifiedAadhaarService = new UnifiedAadhaarService();
export default unifiedAadhaarService;
