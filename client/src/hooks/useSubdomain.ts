import { useMemo } from 'react';

export function useSubdomain() {
  // Get current URL search params - read on each render to ensure fresh value
  const currentSearch = window.location.search;
  const currentHostname = window.location.hostname;
  
  const subdomain = useMemo(() => {
    const hostname = currentHostname;
    const parts = hostname.split('.');
    
    // Development/Replit override via query params
    const urlParams = new URLSearchParams(currentSearch);
    const isDev = import.meta.env.DEV || hostname.includes('replit.dev') || hostname.includes('replit.app');
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
    if (hostname.includes('replit.dev') || hostname.includes('replit.app')) {
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
    
    // For production domains (admin.fintekpro.com, partner.fintekpro.com, or fintekpro.com)
    if (parts.length >= 2) {
      // Check if first part is a subdomain (not www)
      if (parts[0] !== 'www' && parts.length > 2) {
        return parts[0];
      }
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
