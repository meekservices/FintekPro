import { Request, Response } from 'express';
import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Health Check Endpoints for Production Deployment
 * 
 * /health - Basic health check (always returns 200 if server is running)
 * /ready - Readiness check (checks database connectivity)
 */

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
}

interface ReadinessStatus extends HealthStatus {
  database: {
    connected: boolean;
    responseTime?: number;
    error?: string;
  };
}

/**
 * Basic health check - returns 200 if server is running
 * Used by load balancers to check if server process is alive
 */
export async function healthCheck(req: Request, res: Response) {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  };

  res.status(200).json(health);
}

/**
 * Readiness check - verifies all dependencies are ready
 * Used by orchestrators (Kubernetes, etc.) to know when to route traffic
 */
export async function readinessCheck(req: Request, res: Response) {
  const startTime = Date.now();
  
  const readiness: ReadinessStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    database: {
      connected: false
    }
  };

  try {
    // Check database connectivity with a simple query
    await db.execute(sql`SELECT 1`);
    const responseTime = Date.now() - startTime;
    
    readiness.database.connected = true;
    readiness.database.responseTime = responseTime;
    
    // Server is ready to accept traffic
    res.status(200).json(readiness);
    
  } catch (error) {
    // Database connection failed
    readiness.status = 'unhealthy';
    readiness.database.connected = false;
    readiness.database.error = error instanceof Error ? error.message : 'Database connection failed';
    
    // Return 503 Service Unavailable - tells load balancer not to route traffic here
    res.status(503).json(readiness);
  }
}

/**
 * Liveness check - similar to health but can include more detailed checks
 * Used to determine if the application should be restarted
 */
export async function livenessCheck(req: Request, res: Response) {
  // For now, same as health check
  // Can be enhanced to check for deadlocks, memory leaks, etc.
  return healthCheck(req, res);
}
