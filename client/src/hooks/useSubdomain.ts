import { useMemo } from 'react';

const KNOWN_SUBDOMAINS = ['admin', 'partner', 'agent'] as const;
type KnownSubdomain = typeof KNOWN_SUBDOMAINS[number];

export function useSubdomain() {
  // Get current URL search params - read on each render to ensure fresh value
  const currentSearch = window.location.search;
  const currentHostname = window.location.hostname;
  
  const subdomain = useMemo(() => {
    const hostname = currentHostname.toLowerCase();
    const parts = hostname.split('.');
    
    // Debug logging for production troubleshooting
    if (typeof window !== 'undefined' && !hostname.includes('localhost')) {
      console.log('[Subdomain Detection]', { hostname, parts, partsLength: parts.length });
    }
    
    // Development/Replit override via query params
    const urlParams = new URLSearchParams(currentSearch);
    const isReplitEnv = hostname.includes('replit.dev') || hostname.includes('replit.app');
    const isDev = import.meta.env.DEV || isReplitEnv;
    
    if (isDev) {
      if (urlParams.get('admin') === 'true') {
        return 'admin';
      } else if (urlParams.get('partner') === 'true') {
        return 'partner';
      } else if (urlParams.get('agent') === 'true') {
        return 'agent';
      }
    }
    
    // Check for path-based portal detection for Replit environments (both dev and production)
    const pathname = window.location.pathname;
    if (isReplitEnv) {
      if (pathname.startsWith('/admin')) {
        return 'admin';
      } else if (pathname.startsWith('/agent')) {
        return 'agent';
      } else if (pathname.startsWith('/partner')) {
        return 'partner';
      }
    }
    
    // For localhost development (admin.localhost, partner.localhost, agent.localhost, or just localhost)
    if (hostname.includes('localhost')) {
      if (parts[0] === 'admin') {
        return 'admin';
      } else if (parts[0] === 'partner') {
        return 'partner';
      } else if (parts[0] === 'agent') {
        return 'agent';
      }
      return '';
    }
    
    // PRIORITY: Check for known subdomains FIRST (admin, partner, agent)
    // This handles custom domains like agent.fintekpro.com, admin.fintekpro.com, partner.fintekpro.com
    const firstPart = parts[0];
    if (parts.length >= 2 && KNOWN_SUBDOMAINS.includes(firstPart as KnownSubdomain)) {
      console.log('[Subdomain Detection] Detected known subdomain:', firstPart);
      return firstPart;
    }
    
    // Fallback: Check if hostname starts with a known subdomain pattern
    // This catches edge cases like 'agent-fintekpro.com' or similar
    for (const sub of KNOWN_SUBDOMAINS) {
      if (hostname.startsWith(`${sub}.`) || hostname.startsWith(`${sub}-`)) {
        console.log('[Subdomain Detection] Fallback detected subdomain:', sub);
        return sub;
      }
    }
    
    // For production domains with unknown subdomains (e.g., staging.fintekpro.com)
    if (parts.length > 2 && parts[0] !== 'www') {
      console.log('[Subdomain Detection] Unknown subdomain, treating as client:', parts[0]);
      // Don't return unknown subdomains - treat them as client portal
    }
    
    return '';
  }, [currentSearch, currentHostname]);
  
  const isAdminPortal = subdomain === 'admin';
  const isPartnerPortal = subdomain === 'partner';
  const isAgentPortal = subdomain === 'agent';
  
  return {
    subdomain,
    isAdminPortal,
    isPartnerPortal,
    isAgentPortal,
    isClientPortal: !isAdminPortal && !isPartnerPortal && !isAgentPortal
  };
}
