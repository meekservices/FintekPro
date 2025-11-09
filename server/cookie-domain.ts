/**
 * Shared utility for determining appropriate cookie domain
 * based on request hostname and environment
 */

/**
 * Get appropriate cookie domain based on hostname
 * 
 * Returns:
 * - undefined in development (for localhost)
 * - undefined for .replit.app domains (browser uses exact domain)
 * - '.fintekpro.com' for custom fintekpro.com domains
 * - undefined as fallback for other domains
 */
export function getCookieDomain(hostname: string): string | undefined {
  if (process.env.NODE_ENV !== 'production') {
    return undefined;
  }
  
  if (hostname.endsWith('.replit.app')) {
    return undefined;
  }
  
  if (hostname.endsWith('.fintekpro.com') || hostname === 'fintekpro.com') {
    return '.fintekpro.com';
  }
  
  return undefined;
}
