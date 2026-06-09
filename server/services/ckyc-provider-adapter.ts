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
