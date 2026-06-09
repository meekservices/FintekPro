import axios from "axios";
import type { AxiosResponse } from "axios";

const SANDBOX_API_KEY = process.env.SANDBOX_API_KEY || "";
const SANDBOX_API_SECRET = process.env.SANDBOX_API_SECRET || "";

let cachedToken: string | null = null;
let tokenExpiry: number = 0;
let baseUrlWarned = false;

export function getSandboxBaseUrl(): string {
	const explicit = process.env.SANDBOX_BASE_URL;
	if (explicit) return explicit.replace(/\/$/, "");
	// Only warn when credentials are configured, and only once per process boot
	if (SANDBOX_API_KEY && SANDBOX_API_SECRET && !baseUrlWarned) {
		baseUrlWarned = true;
		console.warn(
			"[Sandbox] SANDBOX_BASE_URL not set — defaulting to test environment (https://test-api.sandbox.co.in). Set SANDBOX_BASE_URL=https://api.sandbox.co.in for production.",
		);
	}
	return "https://test-api.sandbox.co.in";
}

export function getSandboxEnvironment(): "TEST" | "PRODUCTION" {
	const url = getSandboxBaseUrl();
	return url.includes("test-api") ? "TEST" : "PRODUCTION";
}

export function hasSandboxCredentials(): boolean {
	return !!(SANDBOX_API_KEY && SANDBOX_API_SECRET);
}

export function getSandboxApiKey(): string {
	return SANDBOX_API_KEY;
}

export function getSandboxApiSecret(): string {
	return SANDBOX_API_SECRET;
}

export async function getSandboxAccessToken(): Promise<string> {
	if (cachedToken && Date.now() < tokenExpiry) {
		return cachedToken;
	}

	if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
		console.warn(
			"[Sandbox Auth] API credentials not configured. Returning dummy token for degraded mode.",
		);
		cachedToken = "dummy_token_degraded_mode";
		tokenExpiry = Date.now() + 3600 * 1000;
		return cachedToken;
	}

	const baseUrl = getSandboxBaseUrl();
	const keyPrefix = SANDBOX_API_KEY.substring(0, 12);
	console.log(
		`[Sandbox Auth] Authenticating → ${baseUrl}/authenticate (key prefix: ${keyPrefix}...)`,
	);

	let response: AxiosResponse<any>;
	try {
		response = await axios.post(
			`${baseUrl}/authenticate`,
			{},
			{
				headers: {
					"x-api-key": SANDBOX_API_KEY,
					"x-api-secret": SANDBOX_API_SECRET,
					"x-api-version": "1.0.0",
					"Content-Type": "application/json",
				},
			},
		);
	} catch (authError: any) {
		const status = authError.response?.status;
		const errData = authError.response?.data;
		console.error(
			`[Sandbox Auth] Authentication failed (HTTP ${status}) → ${baseUrl}`,
			JSON.stringify(errData || authError.message).substring(0, 300),
		);

		if (process.env.NODE_ENV === "production") {
			console.warn(
				"[Sandbox Auth] Production authentication failed. Falling back to dummy token to maintain service availability.",
			);
			cachedToken = "dummy_token_auth_failed";
			tokenExpiry = Date.now() + 600 * 1000; // Retry in 10 mins
			return cachedToken;
		}
		throw new Error(
			`Sandbox authentication failed (HTTP ${status}): ${errData?.message || authError.message}`,
		);
	}

	const token =
		response.data?.data?.access_token || response.data?.access_token;
	if (!token) {
		console.error(
			"[Sandbox Auth] Unexpected response structure:",
			JSON.stringify(response.data).substring(0, 200),
		);
		if (process.env.NODE_ENV === "production") {
			return "dummy_token_malformed_response";
		}
		throw new Error(
			"Sandbox authentication succeeded but no access_token returned",
		);
	}

	cachedToken = token;
	const expiresIn =
		response.data?.data?.expires_in || response.data?.expires_in || 86400;
	tokenExpiry = Date.now() + (expiresIn - 300) * 1000;

	return cachedToken!;
}

export function clearSandboxToken(): void {
	cachedToken = null;
	tokenExpiry = 0;
}

export function logSandboxInit(serviceName: string): void {
	const env = getSandboxEnvironment();
	const baseUrl = getSandboxBaseUrl();
	const hasCreds = hasSandboxCredentials();

	if (!hasCreds) {
		console.warn(`⚠️ [${serviceName}] Sandbox API credentials not configured`);
		return;
	}

	console.log(
		`✅ [${serviceName}] Initialized (${env} environment → ${baseUrl})`,
	);
}
