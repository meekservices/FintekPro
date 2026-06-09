/**
 * CKYC Environment Service
 *
 * SEBI-Compliant Environment Segregation & Enforcement
 * Ensures mock CKYC cannot be executed in production under any condition.
 *
 * Environment Modes:
 * - DEV: Mock provider allowed for development
 * - UAT: Mock provider allowed for testing
 * - DEMO: Mock provider allowed for demos
 * - PROD: Mock provider COMPLETELY DISABLED at code level
 */

export type CkycEnvironmentMode = "DEV" | "UAT" | "DEMO" | "PROD";

export type CkycVerificationStatus =
	| "pending"
	| "in_progress"
	| "verified"
	| "rejected"
	| "expired"
	| "ckyc_deferred" // New: All providers exhausted, awaiting manual/admin action
	| "manual_review_in_progress"; // New: Manual review initiated

export interface CkycDeferralReason {
	code: string;
	message: string;
	lastProviderAttempted?: string;
	failureReasons: Array<{
		provider: string;
		reason: string;
		timestamp: string;
	}>;
	slaStartedAt: string;
	slaDeadline: string;
}

export interface EnvironmentComplianceResult {
	isCompliant: boolean;
	mode: CkycEnvironmentMode;
	mockProviderAllowed: boolean;
	violations: string[];
	warnings: string[];
}

export interface MockBlockedAttempt {
	timestamp: string;
	attemptedProvider: string;
	userId?: string;
	panNumber?: string;
	blockedReason: string;
	isSecurityEvent: boolean;
}

class CkycEnvironmentService {
	private static instance: CkycEnvironmentService;
	private mode: CkycEnvironmentMode;
	private blockedAttempts: MockBlockedAttempt[] = [];

	private constructor() {
		this.mode = this.detectEnvironmentMode();
		console.log(`[CKYC Environment] Mode: ${this.mode}`);

		if (this.mode === "PROD") {
			console.log(
				"[CKYC Environment] Production mode - mock provider disabled",
			);
		}
	}

	static getInstance(): CkycEnvironmentService {
		if (!CkycEnvironmentService.instance) {
			CkycEnvironmentService.instance = new CkycEnvironmentService();
		}
		return CkycEnvironmentService.instance;
	}

	private detectEnvironmentMode(): CkycEnvironmentMode {
		const explicitMode = process.env.CKYC_ENV_MODE?.toUpperCase() as
			| CkycEnvironmentMode
			| undefined;

		if (explicitMode && ["DEV", "UAT", "DEMO", "PROD"].includes(explicitMode)) {
			return explicitMode;
		}

		const nodeEnv = process.env.NODE_ENV?.toLowerCase();
		const isReplitProduction = process.env.REPL_SLUG && !process.env.REPLIT_DEV;

		if (nodeEnv === "production" || isReplitProduction) {
			return "PROD";
		}

		if (nodeEnv === "test" || process.env.CI) {
			return "UAT";
		}

		return "DEV";
	}

	getMode(): CkycEnvironmentMode {
		return this.mode;
	}

	isProductionMode(): boolean {
		return this.mode === "PROD";
	}

	isMockProviderAllowed(): boolean {
		return this.mode !== "PROD";
	}

	assertMockAllowed(context?: { userId?: string; panNumber?: string }): void {
		if (this.mode === "PROD") {
			const attempt: MockBlockedAttempt = {
				timestamp: new Date().toISOString(),
				attemptedProvider: "mock",
				userId: context?.userId,
				panNumber: context?.panNumber,
				blockedReason: "Mock provider invocation blocked in PROD environment",
				isSecurityEvent: true,
			};

			this.blockedAttempts.push(attempt);
			console.error(
				`[CKYC SECURITY] 🚫 Mock provider blocked in PROD:`,
				attempt,
			);

			throw new CkycComplianceError(
				"MOCK_BLOCKED_IN_PROD",
				"Mock CKYC provider cannot be used in production environment. This is a compliance requirement.",
			);
		}
	}

	blockMockProviderInvocation(
		provider: string,
		context?: { userId?: string; panNumber?: string },
	): boolean {
		if (this.mode === "PROD" && provider === "mock") {
			const attempt: MockBlockedAttempt = {
				timestamp: new Date().toISOString(),
				attemptedProvider: provider,
				userId: context?.userId,
				panNumber: context?.panNumber,
				blockedReason: "Mock provider routing blocked in PROD",
				isSecurityEvent: true,
			};

			this.blockedAttempts.push(attempt);
			console.error(
				`[CKYC SECURITY] 🚫 Blocked mock provider in PROD:`,
				attempt,
			);

			return true; // Blocked
		}
		return false; // Not blocked
	}

	runStartupComplianceCheck(): EnvironmentComplianceResult {
		const result: EnvironmentComplianceResult = {
			isCompliant: true,
			mode: this.mode,
			mockProviderAllowed: this.isMockProviderAllowed(),
			violations: [],
			warnings: [],
		};

		if (this.mode === "PROD") {
			console.log(
				"[CKYC Environment] ✅ Running production compliance assertion...",
			);

			const hasTruthScreenCreds = !!(
				process.env.TRUTHSCREEN_USERNAME && process.env.TRUTHSCREEN_PASSWORD
			);
			const hasCkycApiCreds = !!(
				process.env.CKYC_API_KEY && process.env.CKYC_API_SECRET
			);

			if (!hasTruthScreenCreds && !hasCkycApiCreds) {
				result.warnings.push(
					"No CKYC API credentials configured. Manual CKYC will be the only option.",
				);
				console.warn(
					"[CKYC Environment] ⚠️ No CKYC API credentials - Manual CKYC only",
				);
			}

			if (
				process.env.CKYC_ENV_MODE?.toUpperCase() === "DEV" &&
				process.env.NODE_ENV === "production"
			) {
				result.violations.push(
					"CKYC_ENV_MODE set to DEV but NODE_ENV is production - potential misconfiguration",
				);
				result.isCompliant = false;
			}
		}

		console.log(
			`[CKYC Environment] Compliance check: ${result.isCompliant ? "✅ PASSED" : "❌ FAILED"}`,
		);
		if (result.warnings.length > 0) {
			console.log(`[CKYC Environment] Warnings: ${result.warnings.join(", ")}`);
		}
		if (result.violations.length > 0) {
			console.error(
				`[CKYC Environment] Violations: ${result.violations.join(", ")}`,
			);
		}

		return result;
	}

	getBlockedAttempts(): MockBlockedAttempt[] {
		return [...this.blockedAttempts];
	}

	getBlockedAttemptsCount(): number {
		return this.blockedAttempts.length;
	}

	calculateSlaDeadline(hoursFromNow: number = 72): Date {
		return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
	}

	getSlaAgingBucket(slaStartedAt: Date): "<24h" | "24-72h" | ">72h" {
		const hoursElapsed =
			(Date.now() - slaStartedAt.getTime()) / (1000 * 60 * 60);

		if (hoursElapsed < 24) return "<24h";
		if (hoursElapsed < 72) return "24-72h";
		return ">72h";
	}

	isSlaBreach(slaStartedAt: Date, slaHours: number = 72): boolean {
		const hoursElapsed =
			(Date.now() - slaStartedAt.getTime()) / (1000 * 60 * 60);
		return hoursElapsed > slaHours;
	}
}

export class CkycComplianceError extends Error {
	code: string;

	constructor(code: string, message: string) {
		super(message);
		this.code = code;
		this.name = "CkycComplianceError";
	}
}

export const ckycEnvironmentService = CkycEnvironmentService.getInstance();
