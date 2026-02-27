/**
 * getAppBaseUrl()
 *
 * Resolves the public base URL of this deployment across all environments:
 *   Dev repl:   REPLIT_DEV_DOMAIN  → https://<dev-domain>
 *   Deployed:   REPLIT_DOMAINS     → https://<first-domain>   (custom > replit.app)
 *   Override:   APP_URL            → explicit value (custom domain, CI)
 *   Fallback:                      → https://fintekpro.com
 *
 * Never returns http://localhost in production.
 * Use this everywhere a public-facing callback/webhook/share URL is built.
 */
export function getAppBaseUrl(): string {
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (process.env.REPLIT_DOMAINS) {
    const first = process.env.REPLIT_DOMAINS.split(',')[0].trim();
    return `https://${first}`;
  }
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  return 'https://fintekpro.com';
}
