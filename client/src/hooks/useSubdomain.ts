import { useMemo } from 'react';

export function useSubdomain() {
  const subdomain = useMemo(() => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    // Check for query parameter override (for easy development testing)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true') {
      return 'admin';
    }
    
    // For localhost development (admin.localhost or just localhost)
    if (hostname.includes('localhost')) {
      return parts[0] === 'admin' ? 'admin' : '';
    }
    
    // For production domains (admin.fintekpro.com or fintekpro.com)
    if (parts.length >= 2) {
      // Check if first part is a subdomain (not www)
      if (parts[0] !== 'www' && parts.length > 2) {
        return parts[0];
      }
    }
    
    return '';
  }, []);
  
  const isAdminPortal = subdomain === 'admin';
  
  return {
    subdomain,
    isAdminPortal,
    isClientPortal: !isAdminPortal
  };
}
