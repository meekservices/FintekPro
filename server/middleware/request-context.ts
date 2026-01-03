import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      traceId: string;
    }
  }
}

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const traceId = (req.headers['x-trace-id'] as string) || uuidv4();
  
  req.traceId = traceId;
  res.locals.traceId = traceId;
  
  res.setHeader('X-Trace-ID', traceId);
  
  next();
}
