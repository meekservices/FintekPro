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
  if (process.env.NODE_ENV === 'development') {
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
  
  // Log for debugging
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🌐 Subdomain: ${subdomain || '(none)'} | Admin Portal: ${req.isAdminPortal || false} | Partner Portal: ${req.isPartnerPortal || false} | Agent Portal: ${req.isAgentPortal || false} | Hostname: ${hostname}`);
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
