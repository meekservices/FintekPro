/**
 * getAppBaseUrl()
 *
 * Resolves the public base URL of this deployment across all environments:
 *   Explicit:   APP_URL                → explicit value (Railway, custom domain, CI)
 *   Railway:    RAILWAY_PUBLIC_DOMAIN  → https://<railway-domain>
 *   Replit dev: REPLIT_DEV_DOMAIN      → https://<dev-domain>
 *   Replit dep: REPLIT_DOMAINS         → https://<first-domain>
 *   Fallback:                          → https://fintekpro.com
 *
 * Never returns http://localhost in production.
 * Use this everywhere a public-facing callback/webhook/share URL is built.
 */
export function getAppBaseUrl(): string {
	if (process.env.APP_URL) {
		return process.env.APP_URL.replace(/\/$/, "");
	}
	if (process.env.RAILWAY_PUBLIC_DOMAIN) {
		return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
	}
	if (process.env.REPLIT_DEV_DOMAIN) {
		return `https://${process.env.REPLIT_DEV_DOMAIN}`;
	}
	if (process.env.REPLIT_DOMAINS) {
		const first = process.env.REPLIT_DOMAINS.split(",")[0].trim();
		return `https://${first}`;
	}
	return "https://fintekpro.com";
}
