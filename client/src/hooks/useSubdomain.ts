import { useMemo } from 'react';

export function useSubdomain() {
  const subdomain = useMemo(() => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    // Development-only override - NEVER allow in production
    const urlParams = new URLSearchParams(window.location.search);
    const isDev = import.meta.env.DEV;
    if (isDev) {
      if (urlParams.get('admin') === 'true') {
        return 'admin';
      } else if (urlParams.get('partner') === 'true') {
        return 'partner';
      }
    }
    
    // For localhost development (admin.localhost, partner.localhost, or just localhost)
    if (hostname.includes('localhost')) {
      if (parts[0] === 'admin') {
        return 'admin';
      } else if (parts[0] === 'partner') {
        return 'partner';
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
  }, []);
  
  const isAdminPortal = subdomain === 'admin';
  const isPartnerPortal = subdomain === 'partner';
  
  return {
    subdomain,
    isAdminPortal,
    isPartnerPortal,
    isClientPortal: !isAdminPortal && !isPartnerPortal
  };
}
