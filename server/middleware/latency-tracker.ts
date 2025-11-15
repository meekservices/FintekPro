/**
 * API Latency Tracking Middleware
 * 
 * Automatically measures request/response times and logs metrics to the database.
 * Tracks slow endpoints, helps identify performance bottlenecks.
 */

import { Request, Response, NextFunction } from 'express';
import { monitoringStorage } from '../monitoringStorage';
import { logger } from '../logger';

interface LatencyConfig {
  // Threshold in ms to log warnings for slow requests
  slowRequestThreshold?: number;
  // Skip latency tracking for certain paths (e.g., health checks)
  skipPaths?: string[];
  // Sample rate (0-1) to reduce logging volume
  sampleRate?: number;
}

const defaultConfig: LatencyConfig = {
  slowRequestThreshold: 1000, // 1 second
  skipPaths: ['/health', '/favicon.ico'],
  sampleRate: 1.0, // Track 100% of requests
};

export function createLatencyTracker(config: LatencyConfig = {}) {
  const finalConfig = { ...defaultConfig, ...config };

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip tracking for certain paths
    if (finalConfig.skipPaths?.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Apply sampling rate
    if (Math.random() > (finalConfig.sampleRate || 1.0)) {
      return next();
    }

    const startTime = Date.now();
    const startHrTime = process.hrtime();

    // Use response 'finish' event instead of overriding res.end
    res.on('finish', () => {
      // Calculate duration
      const hrDuration = process.hrtime(startHrTime);
      const duration = hrDuration[0] * 1000 + hrDuration[1] / 1000000; // Convert to ms

      // Log to console
      logger.http(
        req.method,
        req.path,
        res.statusCode,
        duration,
        {
          query: Object.keys(req.query).length > 0 ? req.query : undefined,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      // Log slow requests as warnings
      if (finalConfig.slowRequestThreshold && duration > finalConfig.slowRequestThreshold) {
        logger.warn('Slow request detected', {
          method: req.method,
          path: req.path,
          duration,
          threshold: finalConfig.slowRequestThreshold,
          statusCode: res.statusCode,
        });
      }

      // Async: Log to database (don't block response)
      setImmediate(async () => {
        try {
          const dimensions = {
            method: req.method,
            path: req.path,
            statusCode: String(res.statusCode),
            statusClass: `${Math.floor(res.statusCode / 100)}xx`,
          };

          await monitoringStorage.logMetric({
            metricName: 'api_latency',
            metricType: 'histogram',
            service: 'api',
            value: String(duration),
            unit: 'ms',
            dimensions,
          });

          // Also log response status counts
          await monitoringStorage.logMetric({
            metricName: 'api_response',
            metricType: 'counter',
            service: 'api',
            value: '1',
            unit: 'count',
            dimensions,
          });
        } catch (error) {
          logger.error('Failed to log latency metric', {
            error: error instanceof Error ? error.message : String(error),
            method: req.method,
            path: req.path,
          });
        }
      });
    });

    next();
  };
}

// Export default instance
export const latencyTracker = createLatencyTracker();
