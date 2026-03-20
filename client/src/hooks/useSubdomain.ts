import { useState, useEffect } from 'react';

const KNOWN_SUBDOMAINS = ['admin', 'partner', 'agent'] as const;
type KnownSubdomain = typeof KNOWN_SUBDOMAINS[number];

function detectSubdomain(): string {
  const hostname = window.location.hostname.toLowerCase();
  const search = window.location.search;
  const pathname = window.location.pathname;
  const parts = hostname.split('.');
  
  const urlParams = new URLSearchParams(search);
  const isReplitEnv = hostname.includes('replit.dev') || hostname.includes('replit.app');
  const isDev = import.meta.env.DEV || isReplitEnv;
  
  // Debug logging only on initial detection (not during polling)
  // Note: Removed frequent console.log to improve performance
  
  // PRIORITY 1: Query params for development/Replit environments
  if (isDev) {
    if (urlParams.get('admin') === 'true') {
      return 'admin';
    } else if (urlParams.get('partner') === 'true') {
      return 'partner';
    } else if (urlParams.get('agent') === 'true') {
      return 'agent';
    }
  }
  
  // PRIORITY 2: Path-based portal detection (works in all environments)
  // /agent/*, /admin/*, /partner/* paths always route to their respective portals
  if (pathname.startsWith('/agent/') || pathname === '/agent') {
    return 'agent';
  } else if (pathname.startsWith('/admin/') || pathname === '/admin') {
    return 'admin';
  } else if (pathname.startsWith('/partner/') || pathname === '/partner') {
    return 'partner';
  }
  
  // PRIORITY 3: Localhost subdomain detection
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
  
  // PRIORITY 4: Production subdomain detection (admin.fintekpro.com, etc.)
  const firstPart = parts[0];
  if (parts.length >= 2 && KNOWN_SUBDOMAINS.includes(firstPart as KnownSubdomain)) {
    return firstPart;
  }
  
  // PRIORITY 5: Fallback pattern matching
  for (const sub of KNOWN_SUBDOMAINS) {
    if (hostname.startsWith(`${sub}.`) || hostname.startsWith(`${sub}-`)) {
      return sub;
    }
  }
  
  return '';
}

export function getPortalQueryParams(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const adminParam = urlParams.get('admin');
  const partnerParam = urlParams.get('partner');
  const agentParam = urlParams.get('agent');
  
  if (adminParam === 'true') return '?admin=true';
  if (partnerParam === 'true') return '?partner=true';
  if (agentParam === 'true') return '?agent=true';
  return '';
}

export function withPortalParams(path: string): string {
  const portalParams = getPortalQueryParams();
  if (!portalParams) return path;
  
  if (path.includes('?')) {
    return path + '&' + portalParams.substring(1);
  }
  return path + portalParams;
}

export function useSubdomain() {
  // Use state to ensure re-render when subdomain is detected
  const [subdomain, setSubdomain] = useState<string>(() => detectSubdomain());
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  
  // Re-detect on mount and URL changes
  useEffect(() => {
    const detected = detectSubdomain();
    if (detected !== subdomain) {
      setSubdomain(detected);
    }
    
    // Listen for popstate events (back/forward navigation)
    const handlePopState = () => {
      const newSubdomain = detectSubdomain();
      setSubdomain(newSubdomain);
      setCurrentPath(window.location.pathname);
    };
    
    // Poll for pathname changes (handles pushState navigation)
    const checkPathChange = () => {
      const newPath = window.location.pathname;
      if (newPath !== currentPath) {
        setCurrentPath(newPath);
        const newSubdomain = detectSubdomain();
        if (newSubdomain !== subdomain) {
          setSubdomain(newSubdomain);
        }
      }
    };
    
    // Use 500ms polling interval - balances responsiveness with performance
    const interval = setInterval(checkPathChange, 500);
    
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(interval);
    };
  }, [subdomain, currentPath]);
  
  const isAdminPortal = subdomain === 'admin';
  const isPartnerPortal = subdomain === 'partner';
  const isAgentPortal = subdomain === 'agent';
  
  return {
    subdomain,
    isAdminPortal,
    isPartnerPortal,
    isAgentPortal,
    isClientPortal: !isAdminPortal && !isPartnerPortal && !isAgentPortal,
    withPortalParams
  };
}
