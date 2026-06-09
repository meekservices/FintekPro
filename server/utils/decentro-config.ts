/**
 * Decentro Credential Configuration
 */

export function getDecentroClientId(): string {
	return process.env.DECENTRO_CLIENT_ID || "";
}

export function getDecentroClientSecret(): string {
	return process.env.DECENTRO_CLIENT_SECRET || "";
}

export function getDecentroModuleSecret(): string {
	return process.env.DECENTRO_MODULE_SECRET || "";
}

export function getDecentroBaseUrl(): string {
	if (process.env.DECENTRO_BASE_URL)
		return process.env.DECENTRO_BASE_URL.replace(/\/$/, "");
	return process.env.NODE_ENV === "production"
		? "https://in.decentro.tech"
		: "https://sandbox.decentro.tech";
}

export function hasDecentroCredentials(): boolean {
	return !!(getDecentroClientId() && getDecentroClientSecret());
}
