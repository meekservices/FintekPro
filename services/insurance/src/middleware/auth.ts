import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SECRET = process.env.SERVICE_JWT_SECRET!;

export interface ServiceUser {
  sub: number;
  role: string;
  roles: string[];
  email: string | null;
  mobile: string | null;
}

declare global {
  namespace Express {
    interface Request {
      serviceUser?: ServiceUser;
    }
  }
}

export function requireServiceAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    if (!SECRET) throw new Error('SERVICE_JWT_SECRET not configured');
    const payload = jwt.verify(token, SECRET, { issuer: 'fintekpro-main' }) as ServiceUser;
    req.serviceUser = payload;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'Invalid or expired service token', detail: err.message });
  }
}
