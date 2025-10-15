import { Request, Response, NextFunction } from 'express';

// Extend Express Request interface to include subdomain info
declare global {
  namespace Express {
    interface Request {
      isAdminPortal?: boolean;
      subdomain?: string;
    }
  }
}

/**
 * Middleware to detect subdomain from hostname and set portal context
 * Supports:
 * - admin.fintekpro.com → Admin Portal
 * - fintekpro.com / www.fintekpro.com → Client Portal
 * - admin.localhost:5000 → Admin Portal (dev)
 * - localhost:5000 → Client Portal (dev)
 */
export function subdomainDetection(req: Request, res: Response, next: NextFunction) {
  const hostname = req.hostname || req.get('host') || '';
  
  // Extract subdomain
  const parts = hostname.split('.');
  let subdomain = '';
  
  // For localhost development (admin.localhost or just localhost)
  if (hostname.includes('localhost')) {
    subdomain = parts[0] === 'admin' ? 'admin' : '';
  }
  // For production domains (admin.fintekpro.com or fintekpro.com)
  else if (parts.length >= 2) {
    // Check if first part is a subdomain (not www)
    if (parts[0] !== 'www' && parts.length > 2) {
      subdomain = parts[0];
    }
  }
  
  // Check for query parameter override for easier development testing
  if (req.query.admin === 'true') {
    subdomain = 'admin';
  }
  
  // Set flags on request
  req.subdomain = subdomain;
  req.isAdminPortal = subdomain === 'admin';
  
  // Log for debugging
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🌐 Subdomain: ${subdomain || '(none)'} | Admin Portal: ${req.isAdminPortal || false} | Hostname: ${hostname}`);
  }
  
  next();
}

/**
 * Middleware to restrict routes to admin portal only
 */
export function requireAdminPortal(req: Request, res: Response, next: NextFunction) {
  if (!req.isAdminPortal) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'This resource is only available on the admin portal',
      redirectTo: `https://admin.${req.hostname}`
    });
  }
  next();
}

/**
 * Middleware to restrict routes to client portal only
 */
export function requireClientPortal(req: Request, res: Response, next: NextFunction) {
  if (req.isAdminPortal) {
    return res.status(403).json({ 
      error: 'Access denied',
      message: 'This resource is not available on the admin portal',
      redirectTo: `https://${req.hostname.replace('admin.', '')}`
    });
  }
  next();
}
