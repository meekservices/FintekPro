import { Request, Response, NextFunction } from 'express';

// Extend Express Request interface to include subdomain info
declare global {
  namespace Express {
    interface Request {
      isAdminPortal?: boolean;
      isPartnerPortal?: boolean;
      isAgentPortal?: boolean;
      subdomain?: string;
    }
  }
}

/**
 * Middleware to detect subdomain from hostname and set portal context
 * Supports:
 * - admin.fintekpro.com → Admin Portal
 * - partner.fintekpro.com → Partner Portal
 * - agent.fintekpro.com → Agent Portal
 * - fintekpro.com / www.fintekpro.com → Client Portal
 * - admin.localhost:5000 → Admin Portal (dev)
 * - partner.localhost:5000 → Partner Portal (dev)
 * - agent.localhost:5000 → Agent Portal (dev)
 * - localhost:5000 → Client Portal (dev)
 */
export function subdomainDetection(req: Request, res: Response, next: NextFunction) {
  const hostname = req.hostname || req.get('host') || '';
  
  // Extract subdomain
  const parts = hostname.split('.');
  let subdomain = '';
  
  // For localhost development (admin.localhost, partner.localhost, agent.localhost, or just localhost)
  if (hostname.includes('localhost')) {
    if (parts[0] === 'admin') {
      subdomain = 'admin';
    } else if (parts[0] === 'partner') {
      subdomain = 'partner';
    } else if (parts[0] === 'agent') {
      subdomain = 'agent';
    } else {
      subdomain = '';
    }
  }
  // For production domains (admin.fintekpro.com or fintekpro.com)
  else if (parts.length >= 2) {
    // Check if first part is a subdomain (not www)
    if (parts[0] !== 'www' && parts.length > 2) {
      subdomain = parts[0];
    }
  }
  
  // Development-only override - NEVER allow in production
  // Allow override when NOT in production (covers development, test, or unset NODE_ENV)
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    if (req.query.admin === 'true') {
      subdomain = 'admin';
    } else if (req.query.partner === 'true') {
      subdomain = 'partner';
    } else if (req.query.agent === 'true') {
      subdomain = 'agent';
    }
  }
  
  // Set flags on request
  req.subdomain = subdomain;
  req.isAdminPortal = subdomain === 'admin';
  req.isPartnerPortal = subdomain === 'partner';
  req.isAgentPortal = subdomain === 'agent';
  
  // Log only for portal requests to reduce noise (disabled by default)
  // Enable with DEBUG_SUBDOMAIN=true for troubleshooting
  if (process.env.DEBUG_SUBDOMAIN === 'true' && (req.isAdminPortal || req.isPartnerPortal || req.isAgentPortal)) {
    console.log(`🌐 Portal: ${subdomain} | Host: ${hostname}`);
  }
  
  next();
}

/**
 * Middleware to restrict routes to admin portal only
 * SECURITY: Requires BOTH admin subdomain AND admin user role
 */
export async function requireAdminPortal(req: Request, res: Response, next: NextFunction) {
  // First check: Must be on admin subdomain
  if (!req.isAdminPortal) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'This resource is only available on the admin portal',
      redirectTo: `https://admin.${req.hostname}`
    });
  }
  
  // Second check: User must be authenticated
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access the admin portal'
    });
  }
  
  // Third check: User must have admin role
  const userRoles = req.user.roles || [];
  const isAdmin = userRoles.includes('admin') || userRoles.includes('super_admin');
  
  if (!isAdmin) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Admin privileges required'
    });
  }
  
  next();
}

/**
 * Middleware to restrict routes to partner portal only
 * SECURITY: Requires BOTH partner subdomain AND partner/agent user role
 */
export async function requirePartnerPortal(req: Request, res: Response, next: NextFunction) {
  // First check: Must be on partner subdomain
  if (!req.isPartnerPortal) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'This resource is only available on the partner portal',
      redirectTo: `https://partner.${req.hostname.replace(/^(admin\.|partner\.)/, '')}`
    });
  }
  
  // Second check: User must be authenticated
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access the partner portal'
    });
  }
  
  // Third check: User must have agent/partner role
  const userRoles = req.user.roles || [];
  const isPartner = userRoles.includes('agent') || 
                    userRoles.includes('master_agent') || 
                    userRoles.includes('sub_agent');
  
  if (!isPartner) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Partner privileges required'
    });
  }
  
  next();
}

/**
 * Middleware to restrict routes to agent portal only
 * SECURITY: Requires BOTH agent subdomain AND agent user role
 */
export async function requireAgentPortal(req: Request, res: Response, next: NextFunction) {
  // First check: Must be on agent subdomain
  if (!req.isAgentPortal) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'This resource is only available on the agent portal',
      redirectTo: `https://agent.${req.hostname.replace(/^(admin\.|partner\.|agent\.)/, '')}`
    });
  }
  
  // Second check: User must be authenticated
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access the agent portal'
    });
  }
  
  // Third check: User must have agent role
  const userRoles = req.user.roles || [];
  const isAgent = userRoles.includes('agent') || 
                  userRoles.includes('master_agent') || 
                  userRoles.includes('sub_agent');
  
  if (!isAgent) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Agent privileges required'
    });
  }
  
  next();
}

/**
 * Middleware to restrict routes to client portal only
 */
export function requireClientPortal(req: Request, res: Response, next: NextFunction) {
  if (req.isAdminPortal || req.isPartnerPortal || req.isAgentPortal) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'This resource is not available on the admin, partner, or agent portal',
      redirectTo: `https://${req.hostname.replace(/^(admin\.|partner\.|agent\.)/, '')}`
    });
  }
  next();
}

/**
 * Middleware to stamp session with portal type on login.
 * Call this after successful authentication to bind the session to a portal.
 */
export function stampSessionPortal(req: Request) {
  if (req.session) {
    (req.session as any).portalType = req.subdomain || 'main';
  }
}

/**
 * Middleware to validate that session portal matches current subdomain.
 * If mismatch detected, forces logout for security.
 * Only enforced for authenticated users on non-main portals.
 */
export function validateSessionPortal(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.session) {
    return next();
  }

  const sessionPortal = (req.session as any).portalType;
  const currentPortal = req.subdomain || 'main';

  if (!sessionPortal) {
    (req.session as any).portalType = currentPortal;
    return next();
  }

  const isPrivilegedPortal = (p: string) => ['admin', 'partner', 'agent'].includes(p);

  const isMismatch =
    (isPrivilegedPortal(currentPortal) && sessionPortal !== currentPortal) ||
    (currentPortal === '' && isPrivilegedPortal(sessionPortal)) ||
    (currentPortal === 'main' && isPrivilegedPortal(sessionPortal));

  if (isMismatch) {
    console.warn(`⚠️ [PORTAL_MISMATCH] User ${req.user.id} session portal: ${sessionPortal}, current: ${currentPortal || 'main'}`);
    req.logout((err) => {
      if (err) console.error('[PortalValidation] Logout error:', err);
      res.status(403).json({
        error: 'Portal mismatch',
        message: 'Your session was created on a different portal. Please log in again.',
        sessionPortal,
        currentPortal: currentPortal || 'main',
        action: 'force_logout'
      });
    });
    return;
  }

  next();
}
