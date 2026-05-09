import { Request, Response, NextFunction } from 'express';

export const hasRole = (user: any, requiredRoles: string[]): boolean => {
  if (!user) return false;
  
  const userRoles = user.roles || (user.role ? [user.role] : []);
  return requiredRoles.some(role => userRoles.includes(role));
};

export const requireAgent = async (req: any, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (!hasRole(req.user, ['agent', 'partner', 'admin', 'superadmin'])) {
    return res.status(403).json({ message: "Agent, partner, or admin access required" });
  }
  
  next();
};

export const requireClientOrHigher = async (req: any, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (!hasRole(req.user, ['user', 'client', 'business_client', 'agent', 'partner', 'admin', 'superadmin'])) {
    return res.status(403).json({ message: "Client access required" });
  }
  
  next();
};

export const requireAdmin = async (req: any, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (!hasRole(req.user, ['admin', 'superadmin'])) {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  next();
};

export const requireAuth = async (req: any, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};
