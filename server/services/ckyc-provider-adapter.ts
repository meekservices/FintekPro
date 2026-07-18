/**
 * CKYC Provider Adapter Interface
 *
 * Abstracts CKYC verification providers for runtime selection and lazy-loading.
 * Supports TruthScreen (formerly AuthBridge — same company), CERSAI Reference, Offline Aadhaar, V-KYC, and Manual verification.
 */

import { AppError } from "../utils/errors";

export interface CkycVerificationRequest {
	panNumber: string;
	fullName: string;
	dateOfBirth: string;
	aadhaarNumber?: string;
	mobileNumber?: string;
	emailAddress?: string;
	userId: string;
}

export interface CkycVerificationResult {
	success: boolean;
	found: boolean;
	provider: string;
	kin?: string;
	status?: "active" | "inactive" | "pending" | "not_found";
	verificationLevel?: "simplified" | "normal" | "enhanced";
	data?: {
		fullName: string;
		fatherName?: string;
		motherName?: string;
		dateOfBirth: string;
		gender: string;
		address: {
			line1: string;
			line2?: string;
			city: string;
			state: string;
			pincode: string;
			country: string;
		};
		mobile?: string;
		email?: string;
		photoUrl?: string;
		signatureUrl?: string;
		documents?: Array<{
			type: string;
			number: string;
			verified: boolean;
		}>;
		kycDate?: string;
	};
	responseTimeMs: number;
	message: string;
	errorCode?: string;
}

export interface CkycProviderHealth {
	provider: string;
	healthy: boolean;
	latencyMs?: number;
	lastChecked: Date;
	errorMessage?: string;
}

export interface ICkycProviderAdapter {
	readonly providerCode: string;
	readonly providerName: string;

	isConfigured(): boolean;
	isInMockMode(): boolean;
	verify(request: CkycVerificationRequest): Promise<CkycVerificationResult>;
	checkHealth(): Promise<CkycProviderHealth>;
}

const adapterRegistry: Map<string, ICkycProviderAdapter> = new Map();
const adapterLoaders: Map<string, () => Promise<ICkycProviderAdapter>> =
	new Map();

adapterLoaders.set("truthscreen", async () => {
	const { TruthScreenCkycAdapter } = await import(
		"./adapters/truthscreen-ckyc-adapter"
	);
	return new TruthScreenCkycAdapter();
});

adapterLoaders.set("sandbox", async () => {
	const { SandboxCkycAdapter } = await import(
		"./adapters/sandbox-ckyc-adapter"
	);
	return new SandboxCkycAdapter();
});

adapterLoaders.set("cersai_reference", async () => {
	const { CersaiCkycAdapter } = await import("./adapters/cersai-ckyc-adapter");
	return new CersaiCkycAdapter();
});

adapterLoaders.set("offline_aadhaar", async () => {
	const { OfflineAadhaarCkycAdapter } = await import(
		"./adapters/offline-aadhaar-ckyc-adapter"
	);
	return new OfflineAadhaarCkycAdapter();
});

adapterLoaders.set("vkyc", async () => {
	const { VkycCkycAdapter } = await import("./adapters/vkyc-ckyc-adapter");
	return new VkycCkycAdapter();
});

adapterLoaders.set("manual", async () => {
	const { ManualCkycAdapter } = await import("./adapters/manual-ckyc-adapter");
	return new ManualCkycAdapter();
});

/**
 * IRIS KFintech — preferred provider when IRIS credentials are configured.
 * Used for investor KYC initiation, eKYC status, and FATCA submission.
 * Provider code: "iris"
 */
adapterLoaders.set("iris", async () => {
	const { IrisKycAdapter } = await import("./iris/iris-kyc-adapter");
	// IrisKycAdapter implements BaseEkycProvider, not ICkycProviderAdapter.
	// Wrap it in a thin shim so it satisfies the ICkycProviderAdapter contract.
	const adapter = new IrisKycAdapter();
	return {
		get providerCode() { return "iris"; },
		get providerName() { return "IRIS KFintech eKYC"; },
		isConfigured() {
			return !!(process.env.IRIS_USERNAME && process.env.IRIS_PASSWORD);
		},
		isInMockMode() { return false; },
		async verify(request: CkycVerificationRequest): Promise<CkycVerificationResult> {
			const start = Date.now();
			try {
				const record = await adapter.lookupByPan(request.panNumber);
				if (!record) {
					return {
						success: true,
						found: false,
						provider: "iris",
						status: "not_found",
						responseTimeMs: Date.now() - start,
						message: "Investor not found in IRIS",
					};
				}
				return {
					success: true,
					found: true,
					provider: "iris",
					kin: record.kraKinNumber,
					status: record.kycStatus === "active" ? "active" : "inactive",
					verificationLevel: "normal",
					data: {
						fullName:    record.fullLegalName,
						dateOfBirth: record.dateOfBirth,
						gender:      record.gender,
						address: { line1: "", city: "", state: "", pincode: "", country: record.nationality },
					},
					responseTimeMs: Date.now() - start,
					message: `IRIS KYC: ${record.kycStatus}`,
				};
			} catch (err: any) {
				return {
					success: false,
					found: false,
					provider: "iris",
					responseTimeMs: Date.now() - start,
					message: err.message,
					errorCode: "IRIS_KYC_ERROR",
				};
			}
		},
		async checkHealth(): Promise<CkycProviderHealth> {
			return {
				provider: "iris",
				healthy: !!(process.env.IRIS_USERNAME && process.env.IRIS_PASSWORD),
				lastChecked: new Date(),
			};
		},
	} satisfies ICkycProviderAdapter;
});


export async function getAdapter(
	providerCode: string,
): Promise<ICkycProviderAdapter> {
	let adapter = adapterRegistry.get(providerCode);
	if (adapter) {
		return adapter;
	}

	const loader = adapterLoaders.get(providerCode);
	if (!loader) {
		throw new AppError(
			`Unknown CKYC provider: ${providerCode}`,
			400,
			"UNKNOWN_PROVIDER",
		);
	}

	adapter = await loader();
	adapterRegistry.set(providerCode, adapter);

	return adapter;
}

export function registerAdapter(adapter: ICkycProviderAdapter): void {
	adapterRegistry.set(adapter.providerCode, adapter);
}

export function getLoadedAdapters(): string[] {
	return Array.from(adapterRegistry.keys());
}

export function clearAdapterCache(): void {
	adapterRegistry.clear();
}
