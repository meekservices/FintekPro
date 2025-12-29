import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

const processedIdempotencyKeys = new Map<string, { timestamp: number; result: any }>();

const IDEMPOTENCY_KEY_TTL = 24 * 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  const entries = Array.from(processedIdempotencyKeys.entries());
  for (const [key, value] of entries) {
    if (now - value.timestamp > IDEMPOTENCY_KEY_TTL) {
      processedIdempotencyKeys.delete(key);
    }
  }
}, 60 * 60 * 1000);

const EXECUTION_ENDPOINTS = [
  '/api/orders',
  '/api/trade',
  '/api/execute',
  '/api/payment',
  '/api/consent',
  '/api/submit',
  '/api/transactions',
  '/api/kyc/submit',
  '/api/bonds/order',
  '/api/mutual-funds/order',
  '/api/stocks/order',
];

function isExecutionEndpoint(path: string): boolean {
  return EXECUTION_ENDPOINTS.some(endpoint => path.startsWith(endpoint));
}

export interface ExecutionGuardOptions {
  requireNetworkHeader?: boolean;
  logExecution?: boolean;
  blockOfflineExecution?: boolean;
}

export function executionGuard(options: ExecutionGuardOptions = {}) {
  const {
    requireNetworkHeader = true,
    logExecution = true,
    blockOfflineExecution = true,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    if (!isExecutionEndpoint(req.path)) {
      return next();
    }

    const networkState = req.headers['x-network-state'] as string;
    const idempotencyKey = req.headers['x-idempotency-key'] as string;
    const queuedAt = req.headers['x-queued-at'] as string;

    const executionId = uuidv4();
    (req as any).executionId = executionId;

    if (logExecution) {
      console.log(`[EXECUTION_GUARD] ${req.method} ${req.path}`, {
        executionId,
        userId: (req as any).user?.id,
        networkState: networkState || 'unknown',
        idempotencyKey: idempotencyKey || 'none',
        queuedAt: queuedAt || 'immediate',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
      });
    }

    if (blockOfflineExecution && (networkState === 'offline' || networkState === 'slow')) {
      const isOffline = networkState === 'offline';
      console.warn(`[EXECUTION_GUARD] BLOCKED ${networkState} execution: ${req.path}`, {
        executionId,
        userId: (req as any).user?.id,
        networkState,
      });
      
      return res.status(400).json({
        success: false,
        error: isOffline ? 'OFFLINE_EXECUTION_BLOCKED' : 'SLOW_NETWORK_EXECUTION_BLOCKED',
        message: isOffline 
          ? 'This action cannot be executed offline. Please ensure you have an active internet connection.'
          : 'This action cannot be executed on a slow network. Please wait for a stable connection to ensure transaction integrity.',
        executionId,
        code: 'NETWORK_REQUIRED',
        networkState,
      });
    }

    if (idempotencyKey) {
      const existing = processedIdempotencyKeys.get(idempotencyKey);
      if (existing) {
        console.log(`[EXECUTION_GUARD] Duplicate idempotency key detected: ${idempotencyKey}`, {
          executionId,
          originalTimestamp: new Date(existing.timestamp).toISOString(),
        });
        
        return res.status(200).json({
          ...existing.result,
          idempotent: true,
          originalExecutionTime: new Date(existing.timestamp).toISOString(),
        });
      }

      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          processedIdempotencyKeys.set(idempotencyKey, {
            timestamp: Date.now(),
            result: body,
          });
        }
        return originalJson(body);
      };
    }

    res.on('finish', () => {
      if (logExecution) {
        console.log(`[EXECUTION_GUARD] Completed ${req.method} ${req.path}`, {
          executionId,
          statusCode: res.statusCode,
          userId: (req as any).user?.id,
        });
      }
    });

    next();
  };
}

export function auditLog(
  action: string,
  details: Record<string, any>,
  req: Request
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    executionId: (req as any).executionId,
    userId: (req as any).user?.id,
    userRole: (req as any).user?.role,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    networkState: req.headers['x-network-state'] || 'unknown',
    ...details,
  };

  console.log('[AUDIT]', JSON.stringify(logEntry));
  
  return logEntry;
}

export function requireOnline(req: Request, res: Response, next: NextFunction) {
  const networkState = req.headers['x-network-state'] as string;
  
  if (networkState === 'offline') {
    return res.status(400).json({
      success: false,
      error: 'NETWORK_REQUIRED',
      message: 'This action requires an active internet connection.',
    });
  }
  
  next();
}

export function requireIdempotencyKey(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const idempotencyKey = req.headers['x-idempotency-key'] as string;
  
  if (!idempotencyKey) {
    return res.status(400).json({
      success: false,
      error: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'An idempotency key is required for this operation.',
    });
  }
  
  next();
}
