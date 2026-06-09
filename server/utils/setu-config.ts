/**
 * Setu Credential Configuration
 */

export function getSetuClientId(): string {
	return process.env.SETU_CLIENT_ID || "";
}

export function getSetuSecret(): string {
	return process.env.SETU_SECRET || "";
}

export function getSetuBaseUrl(): string {
	if (process.env.SETU_BASE_URL)
		return process.env.SETU_BASE_URL.replace(/\/$/, "");
	return process.env.NODE_ENV === "production"
		? "https://api.setu.co"
		: "https://staging.setu.co";
}

export function hasSetuCredentials(): boolean {
	return !!(getSetuClientId() && getSetuSecret());
}
