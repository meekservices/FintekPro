import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
}

export function requireAgentPortal(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (!user || user.role !== 'agent') {
    return res.status(403).json({ message: 'Agent portal access required' });
  }
  next();
}
